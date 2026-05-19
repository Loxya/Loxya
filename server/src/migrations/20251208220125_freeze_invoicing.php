<?php
declare(strict_types=1);

use Brick\Math\BigDecimal as Decimal;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;
use Loxya\Config\Config;
use Loxya\Services\I18n;
use Loxya\Services\View;
use Loxya\Support\Address;
use Loxya\Support\Country;
use Loxya\Support\Pdf\Pdf;
use Loxya\Support\Period;
use Loxya\Support\Storage\StorageFactory;
use Loxya\Support\Str;
use Phinx\Migration\AbstractMigration;

final class FreezeInvoicing extends AbstractMigration
{
    public function up(): void
    {
        $prefix = Config::get('db.prefix');
        $i18n = new I18n(Config::get('defaultLang'));
        $view = new View($i18n, MIGRATIONS_FOLDER . DS . 'legacy');

        //
        // - On persiste le PDF lié aux factures existantes.
        //

        $invoicesStorage = StorageFactory::createLocalDriver([
            'root' => DATA_FOLDER . DS . 'invoices',
        ]);

        $invoices = $this->table('invoices');
        $invoices
            ->addColumn('uuid', 'string', [
                'after' => 'id',
                'length' => 36,
                'null' => true,
            ])
            ->update();

        foreach ($this->getInvoicesData() as $datum) {
            $uuid = (string) Str::uuid();

            $qb = $this->getUpdateBuilder();
            $qb
                ->update(sprintf('%sinvoices', $prefix))
                ->set('uuid', $uuid)
                ->where(['id' => $datum['id']])
                ->execute();

            $isCreditNote = $datum['totalWithTaxes']->isNegative();
            $baseFilename = Str::slugify(implode('-', array_filter([
                $i18n->translate($isCreditNote ? 'credit-note' : 'invoice'),
                $datum['seller']['name'] ?? null,
                $datum['number'],
                $datum['beneficiary']['full_name'],
            ])));
            $filename = sprintf('%s.pdf', $baseFilename);

            $html = $view->fetch('invoice', $datum);
            $pdf = new Pdf($filename, $html);

            $invoicesStorage->write(
                sprintf('%s.pdf', $uuid),
                $pdf->asBinaryString(),
            );
        }

        $invoices
            ->changeColumn('uuid', 'string', [
                'length' => 36,
                'null' => false,
            ])
            ->addIndex(['uuid'], [
                'unique' => true,
            ])
            ->update();

        //
        // - On persiste le PDF lié aux devis existants.
        //

        $estimatesStorage = StorageFactory::createLocalDriver([
            'root' => DATA_FOLDER . DS . 'estimates',
        ]);

        $estimates = $this->table('estimates');
        $estimates
            ->addColumn('uuid', 'string', [
                'after' => 'id',
                'length' => 36,
                'null' => true,
            ])
            ->update();

        foreach ($this->getEstimatesData() as $datum) {
            $uuid = (string) Str::uuid();

            $qb = $this->getUpdateBuilder();
            $qb
                ->update(sprintf('%sestimates', $prefix))
                ->set('uuid', $uuid)
                ->where(['id' => $datum['id']])
                ->execute();

            // - Nom du fichier.
            $baseFilename = Str::slugify(implode('-', array_filter([
                $i18n->translate('estimate'),
                $datum['seller']['name'] ?? null,
                $datum['date']->format('Ymd-Hi'),
                $datum['beneficiary']['full_name'],
            ])));
            $filename = sprintf('%s.pdf', $baseFilename);

            $html = $view->fetch('estimate', $datum);
            $pdf = new Pdf($filename, $html);

            $estimatesStorage->write(
                sprintf('%s.pdf', $uuid),
                $pdf->asBinaryString(),
            );
        }

        $estimates
            ->changeColumn('uuid', 'string', [
                'length' => 36,
                'null' => false,
            ])
            ->addIndex(['uuid'], [
                'unique' => true,
            ])
            ->update();
    }

    public function down(): void
    {
        throw new \RuntimeException(
            "This migration cannot be reverted as sensitive " .
            "data would be deleted otherwise.",
        );
    }

    // ------------------------------------------------------
    // -
    // -    Méthodes internes
    // -
    // ------------------------------------------------------

    private function getInvoicesData(): array
    {
        $prefix = Config::get('db.prefix');

        $decodeJson = static function ($value) {
            if ($value === null || $value === '') {
                return null;
            }
            return json_decode($value, true, \JSON_THROW_ON_ERROR);
        };

        $rawInvoicesData = $this->getSelectBuilder()
            ->select('*')
            ->from(sprintf('%sinvoices', $prefix))
            ->execute()->fetchAll('assoc');

        if (empty($rawInvoicesData)) {
            return [];
        }

        $rawInvoiceMaterialsData = array_reduce(
            $this->getSelectBuilder()
                ->select('*')
                ->from(sprintf('%sinvoice_materials', $prefix))
                ->orderBy('id')
                ->execute()->fetchAll('assoc'),
            static function (array $acc, array $row) {
                $acc[$row['invoice_id']] ??= [];
                $acc[$row['invoice_id']][] = $row;
                return $acc;
            },
            [],
        );

        $rawInvoiceExtrasData = array_reduce(
            $this->getSelectBuilder()
                ->select('*')
                ->from(sprintf('%sinvoice_extras', $prefix))
                ->orderBy('id')
                ->execute()->fetchAll('assoc'),
            static function (array $acc, array $row) {
                $acc[$row['invoice_id']] ??= [];
                $acc[$row['invoice_id']][] = $row;
                return $acc;
            },
            [],
        );

        $settingsData = $this->getSettings('invoices');
        $beneficiariesData = $this->getBeneficiariesData();
        $materialsData = $this->getMaterialsData();

        $invoiceBookingIds = array_fill_keys(['event', 'reservation'], []);
        foreach ($rawInvoicesData as $datum) {
            $invoiceBookingIds[$datum['booking_type']][] = (int) $datum['booking_id'];
        }
        $bookingsData = [
            'event' => $this->getEventsData($invoiceBookingIds['event']),
            'reservation' => $this->getReservationsData($invoiceBookingIds['reservation']),
        ];

        $invoicesData = [];
        foreach ($rawInvoicesData as $rawDatum) {
            $bookingType = $rawDatum['booking_type'];
            $bookingData = $bookingsData[$bookingType][$rawDatum['booking_id']] ?? null;
            $metadata = $decodeJson($rawDatum['metadata']) ?? [];

            $bookingPeriod = new Period(
                $rawDatum['booking_start_date'],
                $rawDatum['booking_end_date'],
                (bool) $rawDatum['booking_is_full_days'],
            );
            $bookingMobilizationPeriod = $bookingData['mobilization_period'] ?? $bookingPeriod;

            $beneficiaryDatum = $beneficiariesData[$rawDatum['beneficiary_id']] ?? null;
            if ($beneficiaryDatum === null) {
                throw new \RuntimeException(
                    "Unable to retrieve some invoices beneficiaries, please ensure that " .
                    "each invoice is linked to a beneficiary in the database before retrying ",
                );
            }

            $globalDiscountRate = Decimal::of($rawDatum['global_discount_rate']);
            $totalTaxes = array_map(
                static fn (array $tax) => array_replace($tax, [
                    'value' => Decimal::of($tax['value'])
                        ->toScale($tax['is_rate'] ? 3 : 2),
                    'total' => Decimal::of($tax['total'])
                        ->toScale(2),
                ]),
                $decodeJson($rawDatum['total_taxes']) ?? [],
            );

            $invoiceMaterialsData = array_map(
                static function (array $rawMaterialDatum) use ($materialsData, $decodeJson) {
                    $originalMaterial = $rawMaterialDatum['material_id'] !== null
                        ? ($materialsData[$rawMaterialDatum['material_id']] ?? null)
                        : null;

                    return [
                        'material' => $originalMaterial,
                        'material_id' => $rawMaterialDatum['material_id'],
                        'name' => $rawMaterialDatum['name'],
                        'reference' => $rawMaterialDatum['reference'],
                        'quantity' => (int) $rawMaterialDatum['quantity'],
                        'unit_price' => Decimal::of($rawMaterialDatum['unit_price']),
                        'degressive_rate' => (
                            $rawMaterialDatum['degressive_rate'] !== null
                                ? Decimal::of($rawMaterialDatum['degressive_rate'])
                                : null
                        ),
                        'unit_price_period' => (
                            $rawMaterialDatum['unit_price_period'] !== null
                                ? Decimal::of($rawMaterialDatum['unit_price_period'])
                                : null
                        ),
                        'discount_rate' => Decimal::of($rawMaterialDatum['discount_rate']),
                        'taxes' => array_map(
                            static fn (array $tax) => array_replace($tax, [
                                'value' => Decimal::of($tax['value'])
                                    ->toScale($tax['is_rate'] ? 3 : 2),
                            ]),
                            $decodeJson($rawMaterialDatum['taxes']) ?? [],
                        ),
                        'total_without_discount' => Decimal::of($rawMaterialDatum['total_without_discount']),
                        'total_discount' => Decimal::of($rawMaterialDatum['total_discount']),
                        'total_without_taxes' => Decimal::of($rawMaterialDatum['total_without_taxes']),
                        'unit_replacement_price' => (
                            $rawMaterialDatum['unit_replacement_price'] !== null
                                ? Decimal::of($rawMaterialDatum['unit_replacement_price'])
                                : null
                        ),
                        'total_replacement_price' => (
                            $rawMaterialDatum['total_replacement_price'] !== null
                                ? Decimal::of($rawMaterialDatum['total_replacement_price'])
                                : null
                        ),
                        'is_hidden_on_bill' => (bool) $rawMaterialDatum['is_hidden_on_bill'],
                    ];
                },
                $rawInvoiceMaterialsData[$rawDatum['id']] ?? [],
            );

            $invoiceExtrasData = array_map(
                static fn (array $rawExtraDatum) => [
                    'description' => $rawExtraDatum['description'],
                    'unit_price' => Decimal::of($rawExtraDatum['unit_price']),
                    'quantity' => (int) $rawExtraDatum['quantity'],
                    'total_without_taxes' => Decimal::of($rawExtraDatum['total_without_taxes']),
                    'taxes' => array_map(
                        static fn (array $tax) => array_replace($tax, [
                            'value' => Decimal::of($tax['value'])
                                ->toScale($tax['is_rate'] ? 3 : 2),
                        ]),
                        $decodeJson($rawExtraDatum['taxes']) ?? [],
                    ),
                ],
                $rawInvoiceExtrasData[$rawDatum['id']] ?? [],
            );

            $categoriesTotals = [];
            foreach ($invoiceMaterialsData as $line) {
                if ($line['is_hidden_on_bill'] && $line['total_without_taxes']->isZero()) {
                    continue;
                }

                $categoryId = $line['material']['category_id'] ?? null;
                $categoryName = $line['material']['category_name'] ?? null;

                $categoryIdentifier = $categoryId ?? '__UNCATEGORIZED__';
                if (!array_key_exists($categoryIdentifier, $categoriesTotals)) {
                    $categoriesTotals[$categoryIdentifier] = [
                        'id' => $categoryIdentifier,
                        'name' => $categoryName,
                        'quantity' => 0,
                        'subTotal' => Decimal::zero(),
                    ];
                }

                $categoriesTotals[$categoryIdentifier]['quantity'] += $line['quantity'];
                $categoriesTotals[$categoryIdentifier]['subTotal'] = (
                    $categoriesTotals[$categoryIdentifier]['subTotal']
                        ->plus($line['total_without_taxes'])
                );
            }
            foreach ($invoiceExtrasData as $line) {
                if (!array_key_exists('__OTHER__', $categoriesTotals)) {
                    $categoriesTotals['__OTHER__'] = [
                        'id' => '__OTHER__',
                        'name' => null,
                        'quantity' => 0,
                        'subTotal' => Decimal::zero(),
                    ];
                }

                $categoriesTotals['__OTHER__']['quantity'] += $line['quantity'];
                $categoriesTotals['__OTHER__']['subTotal'] = (
                    $categoriesTotals['__OTHER__']['subTotal']
                        ->plus($line['total_without_taxes'])
                );
            }

            $categoriesTotals = (new Collection($categoriesTotals))
                ->sort(static function ($a, $b) {
                    foreach (['__OTHER__', '__UNCATEGORIZED__'] as $specialGroup) {
                        $isAInGroup = $a['id'] === $specialGroup;
                        $isBInGroup = $b['id'] === $specialGroup;
                        if ($isAInGroup || $isBInGroup) {
                            if (!$isAInGroup || !$isBInGroup) {
                                return $isAInGroup ? 1 : -1;
                            }
                            return strcasecmp($a['name'], $b['name']);
                        }
                    }
                    return strcasecmp($a['name'], $b['name']);
                })
                ->values()
                ->all();

            $materialsBySubCategories = (new Collection($invoiceMaterialsData))
                ->mapToGroups(static function ($materialDatum) {
                    $category = $materialDatum['material']['category_name'];
                    if (!$category) {
                        return ['--' => $materialDatum];
                    }

                    $subCategory = $materialDatum['material']['sub_category_name'] ?? '__other';
                    return [sprintf('%s - %s', $category, $subCategory) => $materialDatum];
                })
                ->sortKeys();

            $hasMaterialDiscount = array_reduce(
                $invoiceMaterialsData,
                static fn ($carry, $item) => (
                    $carry || !$item['discount_rate']->isZero()
                ),
                false,
            );

            $invoicesData[] = [
                'id' => $rawDatum['id'],
                'number' => $rawDatum['number'],
                'date' => CarbonImmutable::parse($rawDatum['date']),
                'seller' => $this->getSellerData(),
                'beneficiary' => $beneficiaryDatum,
                'currency' => $rawDatum['currency'],
                'booking' => [
                    'entity' => $bookingType,
                    'title' => $rawDatum['booking_title'],
                    'reference' => $rawDatum['booking_reference'],
                    'period' => $bookingPeriod,
                    'mobilizationPeriod' => $bookingMobilizationPeriod,
                    'description' => $bookingData['description'] ?? null,
                    'location' => $bookingData['location'] ?? null,
                ],
                'isLegacy' => (bool) $rawDatum['is_legacy'],
                'hasTaxes' => !empty($totalTaxes),
                'hasMaterialDiscount' => $hasMaterialDiscount,
                'degressiveRate' => $rawDatum['degressive_rate'] !== null
                    ? Decimal::of($rawDatum['degressive_rate'])
                    : null,
                'dailyTotal' => $rawDatum['daily_total'] !== null
                    ? Decimal::of($rawDatum['daily_total'])
                    : null,
                'hasGlobalDiscount' => !$globalDiscountRate->isZero(),
                'globalDiscountRate' => $globalDiscountRate->dividedBy(100, 6),
                'totalWithoutGlobalDiscount' => (
                    $rawDatum['total_without_global_discount'] !== null
                        ? Decimal::of($rawDatum['total_without_global_discount'])
                        : null
                ),
                'totalGlobalDiscount' => (
                    $rawDatum['total_global_discount'] !== null
                        ? Decimal::of($rawDatum['total_global_discount'])
                        : null
                ),
                'totalWithoutTaxes' => Decimal::of($rawDatum['total_without_taxes']),
                'totalTaxes' => array_map(
                    static fn ($tax) => array_replace($tax, [
                        'value' => $tax['is_rate']
                            ? $tax['value']->dividedBy(100, 5)
                            : $tax['value'],
                    ]),
                    $totalTaxes,
                ),
                'totalWithTaxes' => Decimal::of($rawDatum['total_with_taxes']),
                'totalReplacement' => Decimal::of($rawDatum['total_replacement']),
                'categoriesSubTotals' => $categoriesTotals,
                'materials' => $materialsBySubCategories,
                'extras' => $invoiceExtrasData,
                'totalisableProperties' => new Collection($metadata['properties'] ?? []),
                'customText' => [
                    'title' => $settingsData['customText']['title'],
                    'content' => $settingsData['customText']['content'],
                ],
                'showBookingDescription' => $settingsData['showBookingDescription'],
                'showMobilizationPeriod' => (
                    !$bookingMobilizationPeriod->isSame($bookingPeriod) &&
                    $settingsData['showMobilizationPeriod']
                ),
                'showTotalReplacementPrice' => $settingsData['showTotalReplacementPrice'],
                'showTotalisableProperties' => $settingsData['showTotalisableProperties'],
                'showPictures' => $settingsData['showPictures'],
                'showDescriptions' => $settingsData['showDescriptions'],
                'showReplacementPrices' => $settingsData['showReplacementPrices'],
                'showUnitPrices' => $settingsData['showUnitPrices'],
                'baseUrl' => Config::getBaseUrl(),
            ];
        }

        return $invoicesData;
    }

    private function getEstimatesData(): array
    {
        $prefix = Config::get('db.prefix');

        $decodeJson = static function ($value) {
            if ($value === null || $value === '') {
                return null;
            }
            return json_decode($value, true, \JSON_THROW_ON_ERROR);
        };

        $rawEstimatesData = $this->getSelectBuilder()
            ->select('*')
            ->from(sprintf('%sestimates', $prefix))
            ->execute()->fetchAll('assoc');

        if (empty($rawEstimatesData)) {
            return [];
        }

        $rawEstimateMaterialsData = array_reduce(
            $this->getSelectBuilder()
                ->select('*')
                ->from(sprintf('%sestimate_materials', $prefix))
                ->orderBy('id')
                ->execute()->fetchAll('assoc'),
            static function (array $acc, array $row) {
                $acc[$row['estimate_id']] ??= [];
                $acc[$row['estimate_id']][] = $row;
                return $acc;
            },
            [],
        );

        $rawEstimateExtrasData = array_reduce(
            $this->getSelectBuilder()
                ->select('*')
                ->from(sprintf('%sestimate_extras', $prefix))
                ->orderBy('id')
                ->execute()->fetchAll('assoc'),
            static function (array $acc, array $row) {
                $acc[$row['estimate_id']] ??= [];
                $acc[$row['estimate_id']][] = $row;
                return $acc;
            },
            [],
        );

        $settingsData = $this->getSettings('estimates');
        $beneficiariesData = $this->getBeneficiariesData();
        $materialsData = $this->getMaterialsData();

        $estimateBookingIds = array_fill_keys(['event', 'reservation'], []);
        foreach ($rawEstimatesData as $datum) {
            $estimateBookingIds[$datum['booking_type']][] = (int) $datum['booking_id'];
        }
        $bookingsData = [
            'event' => $this->getEventsData($estimateBookingIds['event']),
            'reservation' => $this->getReservationsData($estimateBookingIds['reservation']),
        ];

        $estimatesData = [];
        foreach ($rawEstimatesData as $rawDatum) {
            $bookingType = $rawDatum['booking_type'];
            $bookingData = $bookingsData[$bookingType][$rawDatum['booking_id']] ?? null;
            $metadata = $decodeJson($rawDatum['metadata']) ?? [];

            $bookingPeriod = new Period(
                $rawDatum['booking_start_date'],
                $rawDatum['booking_end_date'],
                (bool) $rawDatum['booking_is_full_days'],
            );
            $bookingMobilizationPeriod = $bookingData['mobilization_period'] ?? $bookingPeriod;

            $beneficiaryDatum = $beneficiariesData[$rawDatum['beneficiary_id']] ?? null;
            if ($beneficiaryDatum === null) {
                throw new \RuntimeException(
                    "Unable to retrieve some estimates beneficiaries, please ensure that " .
                    "each invoice is linked to a beneficiary in the database before retrying ",
                );
            }

            $globalDiscountRate = Decimal::of($rawDatum['global_discount_rate']);
            $totalTaxes = array_map(
                static fn (array $tax) => array_replace($tax, [
                    'value' => Decimal::of($tax['value'])
                        ->toScale($tax['is_rate'] ? 3 : 2),
                    'total' => Decimal::of($tax['total'])
                        ->toScale(2),
                ]),
                $decodeJson($rawDatum['total_taxes']) ?? [],
            );

            $estimateMaterialsData = array_map(
                static function (array $rawMaterialDatum) use ($materialsData, $decodeJson) {
                    $originalMaterial = $rawMaterialDatum['material_id'] !== null
                        ? ($materialsData[$rawMaterialDatum['material_id']] ?? null)
                        : null;

                    return [
                        'material' => $originalMaterial,
                        'material_id' => $rawMaterialDatum['material_id'],
                        'name' => $rawMaterialDatum['name'],
                        'reference' => $rawMaterialDatum['reference'],
                        'quantity' => (int) $rawMaterialDatum['quantity'],
                        'unit_price' => Decimal::of($rawMaterialDatum['unit_price']),
                        'degressive_rate' => (
                            $rawMaterialDatum['degressive_rate'] !== null
                                ? Decimal::of($rawMaterialDatum['degressive_rate'])
                                : null
                        ),
                        'unit_price_period' => (
                            $rawMaterialDatum['unit_price_period'] !== null
                                ? Decimal::of($rawMaterialDatum['unit_price_period'])
                                : null
                        ),
                        'discount_rate' => Decimal::of($rawMaterialDatum['discount_rate']),
                        'taxes' => array_map(
                            static fn (array $tax) => array_replace($tax, [
                                'value' => Decimal::of($tax['value'])
                                    ->toScale($tax['is_rate'] ? 3 : 2),
                            ]),
                            $decodeJson($rawMaterialDatum['taxes']) ?? [],
                        ),
                        'total_without_discount' => Decimal::of($rawMaterialDatum['total_without_discount']),
                        'total_discount' => Decimal::of($rawMaterialDatum['total_discount']),
                        'total_without_taxes' => Decimal::of($rawMaterialDatum['total_without_taxes']),
                        'unit_replacement_price' => (
                            $rawMaterialDatum['unit_replacement_price'] !== null
                                ? Decimal::of($rawMaterialDatum['unit_replacement_price'])
                                : null
                        ),
                        'total_replacement_price' => (
                            $rawMaterialDatum['total_replacement_price'] !== null
                                ? Decimal::of($rawMaterialDatum['total_replacement_price'])
                                : null
                        ),
                        'is_hidden_on_bill' => (bool) $rawMaterialDatum['is_hidden_on_bill'],
                    ];
                },
                $rawEstimateMaterialsData[$rawDatum['id']] ?? [],
            );

            $estimateExtrasData = array_map(
                static fn (array $rawExtraDatum) => [
                    'description' => $rawExtraDatum['description'],
                    'unit_price' => Decimal::of($rawExtraDatum['unit_price']),
                    'quantity' => (int) $rawExtraDatum['quantity'],
                    'total_without_taxes' => Decimal::of($rawExtraDatum['total_without_taxes']),
                    'taxes' => array_map(
                        static fn (array $tax) => array_replace($tax, [
                            'value' => Decimal::of($tax['value'])
                                ->toScale($tax['is_rate'] ? 3 : 2),
                        ]),
                        $decodeJson($rawExtraDatum['taxes']) ?? [],
                    ),
                ],
                $rawEstimateExtrasData[$rawDatum['id']] ?? [],
            );

            $categoriesTotals = [];
            foreach ($estimateMaterialsData as $line) {
                if ($line['is_hidden_on_bill'] && $line['total_without_taxes']->isZero()) {
                    continue;
                }

                $categoryId = $line['material']['category_id'] ?? null;
                $categoryName = $line['material']['category_name'] ?? null;

                $categoryIdentifier = $categoryId ?? '__UNCATEGORIZED__';
                if (!array_key_exists($categoryIdentifier, $categoriesTotals)) {
                    $categoriesTotals[$categoryIdentifier] = [
                        'id' => $categoryIdentifier,
                        'name' => $categoryName,
                        'quantity' => 0,
                        'subTotal' => Decimal::zero(),
                    ];
                }

                $categoriesTotals[$categoryIdentifier]['quantity'] += $line['quantity'];
                $categoriesTotals[$categoryIdentifier]['subTotal'] = (
                    $categoriesTotals[$categoryIdentifier]['subTotal']
                        ->plus($line['total_without_taxes'])
                );
            }
            foreach ($estimateExtrasData as $line) {
                if (!array_key_exists('__OTHER__', $categoriesTotals)) {
                    $categoriesTotals['__OTHER__'] = [
                        'id' => '__OTHER__',
                        'name' => null,
                        'quantity' => 0,
                        'subTotal' => Decimal::zero(),
                    ];
                }

                $categoriesTotals['__OTHER__']['quantity'] += $line['quantity'];
                $categoriesTotals['__OTHER__']['subTotal'] = (
                    $categoriesTotals['__OTHER__']['subTotal']
                        ->plus($line['total_without_taxes'])
                );
            }

            $categoriesTotals = (new Collection($categoriesTotals))
                ->sort(static function ($a, $b) {
                    foreach (['__OTHER__', '__UNCATEGORIZED__'] as $specialGroup) {
                        $isAInGroup = $a['id'] === $specialGroup;
                        $isBInGroup = $b['id'] === $specialGroup;
                        if ($isAInGroup || $isBInGroup) {
                            if (!$isAInGroup || !$isBInGroup) {
                                return $isAInGroup ? 1 : -1;
                            }
                            return strcasecmp($a['name'], $b['name']);
                        }
                    }
                    return strcasecmp($a['name'], $b['name']);
                })
                ->values()
                ->all();

            $materialsBySubCategories = (new Collection($estimateMaterialsData))
                ->mapToGroups(static function ($materialDatum) {
                    $category = $materialDatum['material']['category_name'] ?? null;
                    if (!$category) {
                        return ['--' => $materialDatum];
                    }

                    $subCategory = $materialDatum['material']['sub_category_name'] ?? '__other';
                    return [sprintf('%s - %s', $category, $subCategory) => $materialDatum];
                })
                ->sortKeys();

            $hasMaterialDiscount = array_reduce(
                $estimateMaterialsData,
                static fn ($carry, $item) => (
                    $carry || !$item['discount_rate']->isZero()
                ),
                false,
            );

            $estimatesData[] = [
                'id' => $rawDatum['id'],
                'date' => CarbonImmutable::parse($rawDatum['date']),
                'seller' => $this->getSellerData(),
                'beneficiary' => $beneficiaryDatum,
                'currency' => $rawDatum['currency'],
                'booking' => [
                    'entity' => $bookingType,
                    'title' => $rawDatum['booking_title'],
                    'reference' => $rawDatum['booking_reference'],
                    'period' => $bookingPeriod,
                    'mobilizationPeriod' => $bookingMobilizationPeriod,
                    'description' => $bookingData['description'] ?? null,
                    'location' => $bookingData['location'] ?? null,
                ],
                'isLegacy' => (bool) $rawDatum['is_legacy'],
                'hasTaxes' => !empty($totalTaxes),
                'hasMaterialDiscount' => $hasMaterialDiscount,
                'degressiveRate' => $rawDatum['degressive_rate'] !== null
                    ? Decimal::of($rawDatum['degressive_rate'])
                    : null,
                'dailyTotal' => $rawDatum['daily_total'] !== null
                    ? Decimal::of($rawDatum['daily_total'])
                    : null,
                'hasGlobalDiscount' => !$globalDiscountRate->isZero(),
                'globalDiscountRate' => $globalDiscountRate->dividedBy(100, 6),
                'totalWithoutGlobalDiscount' => (
                    $rawDatum['total_without_global_discount'] !== null
                        ? Decimal::of($rawDatum['total_without_global_discount'])
                        : null
                ),
                'totalGlobalDiscount' => (
                    $rawDatum['total_global_discount'] !== null
                        ? Decimal::of($rawDatum['total_global_discount'])
                        : null
                ),
                'totalWithoutTaxes' => Decimal::of($rawDatum['total_without_taxes']),
                'totalTaxes' => array_map(
                    static fn ($tax) => array_replace($tax, [
                        'value' => $tax['is_rate']
                            ? $tax['value']->dividedBy(100, 5)
                            : $tax['value'],
                    ]),
                    $totalTaxes,
                ),
                'totalWithTaxes' => Decimal::of($rawDatum['total_with_taxes']),
                'totalReplacement' => Decimal::of($rawDatum['total_replacement']),
                'categoriesSubTotals' => $categoriesTotals,
                'materials' => $materialsBySubCategories,
                'extras' => $estimateExtrasData,
                'totalisableProperties' => new Collection($metadata['properties'] ?? []),
                'customText' => [
                    'title' => $settingsData['customText']['title'],
                    'content' => $settingsData['customText']['content'],
                ],
                'showBookingDescription' => $settingsData['showBookingDescription'],
                'showMobilizationPeriod' => (
                    !$bookingMobilizationPeriod->isSame($bookingPeriod) &&
                    $settingsData['showMobilizationPeriod']
                ),
                'showTotalReplacementPrice' => $settingsData['showTotalReplacementPrice'],
                'showTotalisableProperties' => $settingsData['showTotalisableProperties'],
                'showPictures' => $settingsData['showPictures'],
                'showDescriptions' => $settingsData['showDescriptions'],
                'showReplacementPrices' => $settingsData['showReplacementPrices'],
                'showUnitPrices' => $settingsData['showUnitPrices'],
                'baseUrl' => Config::getBaseUrl(),
            ];
        }

        return $estimatesData;
    }

    /**
     * @param 'invoices'|'estimates' $type
     */
    private function getSettings(string $type): array
    {
        $prefix = Config::get('db.prefix');

        $rawSettingsData = array_column(
            $this->getSelectBuilder()
                ->select(['key', 'value'])
                ->from(sprintf('%ssettings', $prefix))
                ->where(['key LIKE' => sprintf('%s.%%', $type)])
                ->execute()->fetchAll('assoc'),
            'value',
            'key',
        );

        $getSetting = static fn (string $path) => (
            $rawSettingsData[sprintf('%s.%s', $type, $path)] ?? null
        );
        $getBooleanSetting = static fn (string $path, bool $default) => (
            $getSetting($path) !== null
                ? filter_var($getSetting($path), \FILTER_VALIDATE_BOOLEAN)
                : $default
        );

        return [
            'customText' => [
                'title' => $rawSettingsData['customText.title'] ?? null,
                'content' => $rawSettingsData['customText.content'] ?? null,
            ],
            'showBookingDescription' => $getBooleanSetting('showBookingDescription', false),
            'showMobilizationPeriod' => $getBooleanSetting('showMobilizationPeriod', false),
            'showTotalReplacementPrice' => $getBooleanSetting('showTotalReplacementPrice', false),
            'showTotalisableProperties' => $getBooleanSetting('showTotalisableProperties', false),
            'showPictures' => $getBooleanSetting('showPictures', false),
            'showDescriptions' => $getBooleanSetting('showDescriptions', false),
            'showReplacementPrices' => $getBooleanSetting('showReplacementPrices', true),
            'showUnitPrices' => $getBooleanSetting('showUnitPrices', true),
        ];
    }

    private function getMaterialsData(): array
    {
        $prefix = Config::get('db.prefix');

        $categoriesData = array_column(
            $this->getSelectBuilder()
                ->select(['id', 'name'])
                ->from(sprintf('%scategories', $prefix))
                ->execute()->fetchAll('assoc'),
            null,
            'id',
        );

        $subCategoriesData = array_column(
            $this->getSelectBuilder()
                ->select(['id', 'category_id', 'name'])
                ->from(sprintf('%ssub_categories', $prefix))
                ->execute()->fetchAll('assoc'),
            null,
            'id',
        );

        $rawMaterialsData = $this->getSelectBuilder()
            ->select([
                'id',
                'category_id',
                'sub_category_id',
                'picture',
                'description',
            ])
            ->from(sprintf('%smaterials', $prefix))
            ->execute()->fetchAll('assoc');

        $result = [];
        foreach ($rawMaterialsData as $rawDatum) {
            $categoryName = $rawDatum['category_id'] !== null
                ? ($categoriesData[$rawDatum['category_id']]['name'] ?? null)
                : null;

            $subCategoryName = $rawDatum['sub_category_id'] !== null
                ? ($subCategoriesData[$rawDatum['sub_category_id']]['name'] ?? null)
                : null;

            $picture = $rawDatum['picture'] === null ? null : (
                (string) Config::getBaseUri()
                    ->withPath(sprintf('/static/materials/%s/picture', $rawDatum['id']))
            );

            $result[$rawDatum['id']] = [
                'picture' => $picture,
                'description' => $rawDatum['description'],
                'category_id' => (
                    $rawDatum['category_id'] !== null
                        ? (int) $rawDatum['category_id']
                        : null
                ),
                'category_name' => $categoryName,
                'sub_category_id' => (
                    $rawDatum['sub_category_id'] !== null
                        ? (int) $rawDatum['sub_category_id']
                        : null
                ),
                'sub_category_name' => $subCategoryName,
            ];
        }

        return $result;
    }

    private function getSellerData(): array
    {
        $organization = Config::get('organization');
        return array_replace($organization, [
            'address' => (
                Config::getOrganizationAddress()
                    ->format(withCountry: false)
            ),
            'country' => Config::getOrganizationCountry(),
        ]);
    }

    private function getBeneficiariesData(): array
    {
        $prefix = Config::get('db.prefix');

        $rawData = $this->getSelectBuilder()
            ->select([
                'beneficiary.id',
                'beneficiary.company_id',
                'beneficiary.reference',
                'person.first_name',
                'person.last_name',
                'person.email',
                'person.phone',
                'person.street',
                'person.additional_street',
                'person.postal_code',
                'person.administrative_area',
                'person.locality',
                'person.country',
                'company_legal_name' => 'company.legal_name',
                'company_registration_id' => 'company.registration_id',
                'company_vat_number' => 'company.vat_number',
                'company_phone' => 'company.phone',
                'company_street' => 'company.street',
                'company_additional_street' => 'company.additional_street',
                'company_postal_code' => 'company.postal_code',
                'company_administrative_area' => 'company.administrative_area',
                'company_locality' => 'company.locality',
                'company_country' => 'company.country',
            ])
            ->from(['beneficiary' => sprintf('%sbeneficiaries', $prefix)])
            ->leftJoin(
                ['person' => sprintf('%spersons', $prefix)],
                'beneficiary.person_id = person.id',
            )
            ->leftJoin(
                ['company' => sprintf('%scompanies', $prefix)],
                'beneficiary.company_id = company.id',
            )
            ->execute()->fetchAll('assoc');

        $result = [];
        foreach ($rawData as $rawDatum) {
            $personCountry = new Country($rawDatum['country']);
            $address = (new Address($personCountry))
                ->withAddressLine1($rawDatum['street'])
                ->withAddressLine2($rawDatum['additional_street'])
                ->withPostalCode($rawDatum['postal_code'])
                ->withAdministrativeArea($rawDatum['administrative_area'])
                ->withLocality($rawDatum['locality'])
                ->format(withCountry: false);

            $companyData = null;
            if ($rawDatum['company_id'] !== null) {
                $companyCountry = new Country($rawDatum['company_country']);
                $companyFullAddress = (new Address($companyCountry))
                    ->withAddressLine1($rawDatum['company_street'])
                    ->withAddressLine2($rawDatum['company_additional_street'])
                    ->withPostalCode($rawDatum['company_postal_code'])
                    ->withAdministrativeArea($rawDatum['company_administrative_area'])
                    ->withLocality($rawDatum['company_locality'])
                    ->format(withCountry: false);

                $companyData = [
                    'legal_name' => $rawDatum['company_legal_name'],
                    'registration_id' => $rawDatum['company_registration_id'],
                    'vat_number' => $rawDatum['company_vat_number'],
                    'phone' => $rawDatum['company_phone'],
                    'address' => $companyFullAddress,
                    'country' => $companyCountry,
                ];
            }

            $result[$rawDatum['id']] = [
                'id' => (int) $rawDatum['id'],
                'full_name' => implode(' ', [$rawDatum['first_name'], $rawDatum['last_name']]),
                'reference' => $rawDatum['reference'],
                'email' => $rawDatum['email'],
                'phone' => $rawDatum['phone'],
                'address' => $address,
                'country' => $personCountry,
                'company' => $companyData,
            ];
        }

        return $result;
    }

    private function getEventsData(array $ids): array
    {
        if (empty($ids)) {
            return [];
        }
        $prefix = Config::get('db.prefix');

        $rawData = $this->getSelectBuilder()
            ->select([
                'id',
                'description',
                'location',
                'mobilization_start_date',
                'mobilization_end_date',
            ])
            ->from(sprintf('%sevents', $prefix))
            ->whereInList('id', $ids)
            ->execute()->fetchAll('assoc');

        $result = [];
        foreach ($rawData as $rawDatum) {
            $result[$rawDatum['id']] = [
                'description' => $rawDatum['description'],
                'location' => $rawDatum['location'],
                'mobilization_period' => new Period(
                    $rawDatum['mobilization_start_date'],
                    $rawDatum['mobilization_end_date'],
                ),
            ];
        }

        return $result;
    }

    private function getReservationsData(array $ids): array
    {
        if (empty($ids)) {
            return [];
        }
        $prefix = Config::get('db.prefix');

        $rawData = $this->getSelectBuilder()
            ->select([
                'id',
                'mobilization_start_date',
                'mobilization_end_date',
            ])
            ->from(sprintf('%sreservations', $prefix))
            ->whereInList('id', $ids)
            ->execute()->fetchAll('assoc');

        $result = [];
        foreach ($rawData as $rawDatum) {
            $result[$rawDatum['id']] = [
                'description' => null,
                'location' => null,
                'mobilization_period' => new Period(
                    $rawDatum['mobilization_start_date'],
                    $rawDatum['mobilization_end_date'],
                ),
            ];
        }

        return $result;
    }
}
