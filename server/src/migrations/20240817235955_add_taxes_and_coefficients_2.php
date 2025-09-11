<?php
declare(strict_types=1);

use Brick\Math\BigDecimal as Decimal;
use Brick\Math\RoundingMode;
use Loxya\Config\Config;
use Loxya\Services\I18n;
use Loxya\Support\Period;
use Phinx\Migration\AbstractMigration;

final class AddTaxesAndCoefficients2 extends AbstractMigration
{
    public function up(): void
    {
        $prefix = Config::get('db.prefix');
        $i18n = new I18n(Config::get('defaultLang'));

        $existingVatRate = Config::get('legacy.companyData.vatRate');
        $existingDegressiveRateFunction = Config::get('legacy.degressiveRateFunction');

        $defaultTaxData = null;
        if ($existingVatRate !== null && $existingVatRate > 0) {
            $defaultTaxData = [
                'name' => $i18n->translate('vat'),
                'is_rate' => true,
                'value' => $existingVatRate,
            ];
        }

        //
        // - Réservations
        //

        $reservations = $this->table('reservations');
        $reservations
            ->changeColumn('currency', 'char', [
                'length' => 3,
                'null' => false,
            ])
            ->update();

        $reservation_materials = $this->table('reservation_materials');
        $reservation_materials
            ->addColumn('name', 'string', [
                'length' => 191,
                'null' => true,
                'after' => 'material_id',
            ])
            ->addColumn('reference', 'string', [
                'length' => 64,
                'null' => true,
                'after' => 'name',
            ])
            ->addColumn('degressive_rate', 'decimal', [
                'precision' => 7,
                'scale' => 2,
                'null' => true, // => `null`: Facturation désactivée pour la réservation.
                'default' => null,
                'after' => 'unit_price',
            ])
            ->addColumn('discount_rate', 'decimal', [
                'precision' => 7,
                'scale' => 4,
                'null' => true, // => `null`: Facturation désactivée pour la réservation.
                'default' => null,
                'after' => 'degressive_rate',
            ])
            // Note: Copie de la structure de la taxe du matériel lié au moment
            //       de l'insertion / lors de la dernière synchro.
            ->addColumn('taxes', 'json', [
                'null' => true, // => `null`: Pas de taxe ou facturation désactivée pour la réservation.
                'default' => null,
                'after' => 'discount_rate',
            ])
            ->addColumn('unit_replacement_price', 'decimal', [
                'precision' => 14,
                'scale' => 2,
                'null' => true,
                'default' => null,
                'after' => 'taxes',
            ])
            ->update();

        $data = $this->fetchAll(vsprintf(
            'SELECT
                `reservation_material`.`id`,
                `reservation`.`is_billable`,
                `material`.`name`,
                `material`.`reference`,
                `material`.`replacement_price`,
                `reservation`.`degressive_rate`,
                `reservation`.`vat_rate`
            FROM `%1$sreservation_materials` AS `reservation_material`
            INNER JOIN `%1$smaterials` AS `material`
                ON `material`.`id` = `reservation_material`.`material_id`
            INNER JOIN `%1$sreservations` AS `reservation`
                ON `reservation`.`id` = `reservation_material`.`reservation_id`',
            [$prefix],
        ));
        foreach ($data as $datum) {
            $_isBillingEnabled = (bool) $datum['is_billable'];

            $taxData = null;
            if ($_isBillingEnabled && $datum['vat_rate'] !== null) {
                $taxData = json_encode([
                    [
                        'name' => $i18n->translate('vat'),
                        'is_rate' => true,
                        'value' => $datum['vat_rate'],
                    ],
                ]);
            }

            $qb = $this->getUpdateBuilder();
            $qb
                ->update(sprintf('%sreservation_materials', $prefix))
                ->set('name', $datum['name'])
                ->set('reference', $datum['reference'])
                ->set('unit_replacement_price', $datum['replacement_price'])
                ->set('degressive_rate', $datum['degressive_rate'])
                ->set('discount_rate', $_isBillingEnabled ? 0 : null)
                ->set('taxes', $taxData)
                ->where(['id' => $datum['id']])
                ->execute();
        }

        $reservation_materials
            ->changeColumn('name', 'string', [
                'length' => 191,
                'null' => false,
            ])
            ->changeColumn('reference', 'string', [
                'length' => 64,
                'null' => false,
            ])
            ->update();

        $reservations = $this->table('reservations');
        $reservations
            ->addColumn('global_discount_rate', 'decimal', [
                'precision' => 7,
                'scale' => 4,
                'null' => true, // => `null`: Facturation désactivée pour la réservation.
                'default' => null,
                'after' => 'is_billable',
            ])
            ->removeColumn('degressive_rate')
            ->removeColumn('vat_rate')
            ->update();

        $qb = $this->getUpdateBuilder();
        $qb
            ->update(sprintf('%sreservations', $prefix))
            ->set('global_discount_rate', 0)
            ->where(['is_billable' => 1])
            ->execute();

        //
        // - Lignes de facturation en extra d'une réservation
        //

        $reservation_extras = $this->table('reservation_extras', ['signed' => true]);
        $reservation_extras
            ->addColumn('reservation_id', 'integer', ['signed' => true, 'null' => false])
            ->addColumn('description', 'string', [
                'length' => 191,
                'null' => false,
            ])
            ->addColumn('unit_price', 'decimal', [
                'precision' => 14,
                'scale' => 2,
                'null' => false,
            ])
            ->addColumn('quantity', 'smallinteger', [
                'signed' => false,
                'length' => 5,
                'null' => false,
            ])
            ->addColumn('tax_id', 'integer', [
                'signed' => true,
                'null' => true,
                'default' => null,
            ])
            // Note: Copie de la structure de la taxe lié au moment
            //       de l'insertion / lors de la dernière synchro.
            ->addColumn('taxes', 'json', [
                'null' => true, // => `null`: Pas de taxe.
                'default' => null,
            ])
            ->addIndex(['reservation_id'])
            ->addForeignKey('reservation_id', 'reservations', 'id', [
                'delete' => 'CASCADE',
                'update' => 'NO_ACTION',
                'constraint' => 'fk__reservation_extra__reservation',
            ])
            ->addIndex(['tax_id'])
            ->addForeignKey('tax_id', 'taxes', 'id', [
                'delete' => 'SET_NULL',
                'update' => 'NO_ACTION',
                'constraint' => 'fk__reservation_extra__tax',
            ])
            ->create();

        //
        // - Événements
        //

        $events = $this->table('events');
        $events
            ->addColumn('global_discount_rate', 'decimal', [
                'precision' => 7,
                'scale' => 4,
                'null' => true, // => `null`: Facturation désactivée pour l'événement.
                'default' => null,
                'after' => 'is_billable',
            ])
            ->addColumn('currency', 'char', [
                'length' => 3,
                'null' => true,
                'default' => null,
                'after' => 'is_billable',
            ])
            ->update();

        $qb = $this->getUpdateBuilder();
        $qb
            ->update(sprintf('%sevents', $prefix))
            ->set('currency', Config::get('currency'))
            ->execute();

        $qb = $this->getUpdateBuilder();
        $qb
            ->update(sprintf('%sevents', $prefix))
            ->set('global_discount_rate', 0)
            ->where(['is_billable' => 1])
            ->execute();

        $events = $this->table('events');
        $events
            ->changeColumn('currency', 'char', [
                'length' => 3,
                'null' => false,
            ])
            ->update();

        $event_materials = $this->table('event_materials');
        $event_materials
            ->addColumn('name', 'string', [
                'length' => 191,
                'null' => true,
                'after' => 'material_id',
            ])
            ->addColumn('reference', 'string', [
                'length' => 64,
                'null' => true,
                'after' => 'name',
            ])
            ->addColumn('unit_price', 'decimal', [
                'precision' => 14,
                'scale' => 2,
                'null' => true,
                'default' => null,
                'after' => 'quantity',
            ])
            ->addColumn('degressive_rate', 'decimal', [
                'precision' => 7,
                'scale' => 2,
                'null' => true, // => `null`: Facturation désactivée pour l'événement.
                'default' => null,
                'after' => 'unit_price',
            ])
            ->addColumn('discount_rate', 'decimal', [
                'precision' => 7,
                'scale' => 4,
                'null' => true, // => `null`: Facturation désactivée pour l'événement.
                'default' => null,
                'after' => 'degressive_rate',
            ])
            // Note: Copie de la structure de la taxe du matériel lié au moment
            //       de l'insertion / lors de la dernière synchro.
            ->addColumn('taxes', 'json', [
                'null' => true, // => `null`: Pas de taxe ou facturation désactivée pour l'événement.
                'default' => null,
                'after' => 'discount_rate',
            ])
            ->addColumn('unit_replacement_price', 'decimal', [
                'precision' => 14,
                'scale' => 2,
                'null' => true,
                'default' => null,
                'after' => 'taxes',
            ])
            ->update();

        $data = $this->fetchAll(vsprintf(
            'SELECT
                `event_material`.`id`,
                `event`.`operation_start_date`,
                `event`.`operation_end_date`,
                `event`.`operation_is_full_days`,
                `event`.`is_billable`,
                `material`.`name`,
                `material`.`reference`,
                `material`.`rental_price`,
                `material`.`replacement_price`
            FROM `%1$sevent_materials` AS `event_material`
            INNER JOIN `%1$smaterials` AS `material`
                ON `material`.`id` = `event_material`.`material_id`
            INNER JOIN `%1$sevents` AS `event`
                ON `event`.`id` = `event_material`.`event_id`',
            [$prefix],
        ));
        foreach ($data as $datum) {
            $_isBillingEnabled = (bool) $datum['is_billable'];

            $taxData = null;
            if ($_isBillingEnabled && $defaultTaxData !== null) {
                $taxData = json_encode([$defaultTaxData]);
            }

            $degressiveRate = null;
            if ($_isBillingEnabled) {
                $operationPeriod = new Period(
                    $datum['operation_start_date'],
                    $datum['operation_end_date'],
                    (bool) $datum['operation_is_full_days'],
                );
                $durationDays = $operationPeriod->asDays();

                $result = null;
                if (
                    !empty($existingDegressiveRateFunction) &&
                    str_contains($existingDegressiveRateFunction, 'daysCount')
                ) {
                    $function = preg_replace('/daysCount/', (string) $durationDays, $existingDegressiveRateFunction);
                    eval(sprintf('$result = %s;', $function)); // phpcs:ignore Squiz.PHP.Eval
                }
                /** @var mixed $result */

                $degressiveRate = (string) Decimal::of(is_numeric($result) && $result > 0 ? $result : $durationDays)
                    ->toScale(2, RoundingMode::UNNECESSARY);
            }

            $qb = $this->getUpdateBuilder();
            $qb
                ->update(sprintf('%sevent_materials', $prefix))
                ->set('name', $datum['name'])
                ->set('reference', $datum['reference'])
                ->set('unit_price', $_isBillingEnabled ? ($datum['rental_price'] ?? 0) : null)
                ->set('unit_replacement_price', $datum['replacement_price'])
                ->set('degressive_rate', $degressiveRate)
                ->set('discount_rate', $_isBillingEnabled ? 0 : null)
                ->set('taxes', $taxData)
                ->where(['id' => $datum['id']])
                ->execute();
        }

        $event_materials
            ->changeColumn('name', 'string', [
                'length' => 191,
                'null' => false,
            ])
            ->changeColumn('reference', 'string', [
                'length' => 64,
                'null' => false,
            ])
            ->update();

        //
        // - Lignes de facturation en extra d'un événement
        //

        $event_extras = $this->table('event_extras', ['signed' => true]);
        $event_extras
            ->addColumn('event_id', 'integer', ['signed' => true, 'null' => false])
            ->addColumn('description', 'string', [
                'length' => 191,
                'null' => false,
            ])
            ->addColumn('unit_price', 'decimal', [
                'precision' => 14,
                'scale' => 2,
                'null' => false,
            ])
            ->addColumn('quantity', 'smallinteger', [
                'signed' => false,
                'length' => 5,
                'null' => false,
            ])
            ->addColumn('tax_id', 'integer', [
                'signed' => true,
                'null' => true,
                'default' => null,
            ])
            // Note: Copie de la structure de la taxe lié au moment
            //       de l'insertion / lors de la dernière synchro.
            ->addColumn('taxes', 'json', [
                'null' => true, // => `null`: Pas de taxe.
                'default' => null,
            ])
            ->addIndex(['event_id'])
            ->addForeignKey('event_id', 'events', 'id', [
                'delete' => 'CASCADE',
                'update' => 'NO_ACTION',
                'constraint' => 'fk__event_extra__event',
            ])
            ->addIndex(['tax_id'])
            ->addForeignKey('tax_id', 'taxes', 'id', [
                'delete' => 'SET_NULL',
                'update' => 'NO_ACTION',
                'constraint' => 'fk__event_extra__tax',
            ])
            ->create();

        //
        // - Factures
        //

        $invoices = $this->table('invoices');
        $invoices
            ->addColumn('is_legacy', 'boolean', [
                'default' => false,
                'null' => false,
                'after' => 'beneficiary_id',
            ])
            ->changeColumn('degressive_rate', 'decimal', [
                'precision' => 7,
                'scale' => 2,
                'null' => true, // - `null`: Si non "legacy".
                'default' => null,
                'comment' => 'Legacy only.',
            ])
            ->changeColumn('daily_total', 'decimal', [
                'precision' => 14,
                'scale' => 2,
                'null' => true, // - `null`: Si non "legacy".
                'default' => null,
                'comment' => 'Legacy only.',
            ])
            ->renameColumn('discount_rate', 'global_discount_rate')
            ->changeColumn('global_discount_rate', 'decimal', [
                'precision' => 7,
                'scale' => 4,
                'null' => false,
            ])
            ->renameColumn('total_without_discount', 'total_without_global_discount')
            ->renameColumn('total_discount', 'total_global_discount')
            ->renameColumn('total_taxes', 'total_taxes_old')
            ->removeColumn('total_discountable')
            ->addColumn('total_taxes_new', 'json', [
                'null' => true,
                'default' => null,
                'after' => 'total_without_taxes',
            ])
            ->update();

        $data = $this->fetchAll(vsprintf(
            'SELECT
                `invoice`.`id`,
                `invoice`.`vat_rate`,
                `invoice`.`total_taxes_old`
            FROM `%1$sinvoices` AS `invoice`',
            [$prefix],
        ));
        foreach ($data as $datum) {
            $taxData = null;
            if (!Decimal::of($datum['vat_rate'])->isZero()) {
                $taxData = json_encode([
                    [
                        'name' => $i18n->translate('vat'),
                        'is_rate' => true,
                        'value' => $datum['vat_rate'],
                        'total' => $datum['total_taxes_old'],
                    ],
                ]);
            }

            $qb = $this->getUpdateBuilder();
            $qb
                ->update(sprintf('%sinvoices', $prefix))
                ->set('is_legacy', true)
                ->set('total_taxes_new', $taxData)
                ->where(['id' => $datum['id']])
                ->execute();
        }

        $invoices
            ->removeColumn('vat_rate')
            ->removeColumn('total_taxes_old')
            ->renameColumn('total_taxes_new', 'total_taxes')
            ->update();

        $invoice_materials = $this->table('invoice_materials');
        $invoice_materials
            ->addColumn('degressive_rate', 'decimal', [
                'precision' => 7,
                'scale' => 2,
                'null' => true, // => `null`: Facture "legacy".
                'default' => null,
                'after' => 'unit_price',
            ])
            ->addColumn('unit_price_period', 'decimal', [
                'precision' => 14,
                'scale' => 2,
                'null' => true,
                'default' => null, // => `null`: Facture "legacy".
                'after' => 'degressive_rate',
            ])
            ->addColumn('discount_rate', 'decimal', [
                'precision' => 7,
                'scale' => 4,
                'null' => true,
                'default' => null,
                'after' => 'unit_price_period',
            ])
            ->addColumn('taxes', 'json', [
                'null' => true, // => `null`: Pas de taxe pour la réservation ou facture "legacy".
                'default' => null,
                'after' => 'discount_rate',
            ])
            ->renameColumn('total_price', 'total_without_discount')
            ->addColumn('total_discount', 'decimal', [
                'precision' => 14,
                'scale' => 2,
                'null' => true,
                'default' => null,
                'after' => 'total_without_discount',
            ])
            ->addColumn('total_without_taxes', 'decimal', [
                'precision' => 14,
                'scale' => 2,
                'null' => true,
                'default' => null,
                'after' => 'total_discount',
            ])
            ->renameColumn('replacement_price', 'unit_replacement_price')
            ->addColumn('total_replacement_price', 'decimal', [
                'precision' => 14,
                'scale' => 2,
                'null' => true,
                'default' => null,
                'after' => 'unit_replacement_price',
            ])
            ->removeColumn('is_discountable')
            ->update();

        $data = $this->fetchAll(vsprintf(
            'SELECT
                `invoice_material`.`id`,
                `invoice_material`.`quantity`,
                `invoice_material`.`unit_replacement_price`,
                `invoice_material`.`total_without_discount`
            FROM `%1$sinvoice_materials` AS `invoice_material`',
            [$prefix],
        ));
        foreach ($data as $datum) {
            $unitReplacementPrice = $datum['unit_replacement_price'] !== null
                ? Decimal::of($datum['unit_replacement_price'])
                : null;

            $totalReplacementPrice = null;
            if ($unitReplacementPrice !== null) {
                $totalReplacementPrice = $unitReplacementPrice
                    ->multipliedBy($datum['quantity'])
                    ->toScale(2, RoundingMode::UNNECESSARY);
            }

            $qb = $this->getUpdateBuilder();
            $qb
                ->update(sprintf('%sinvoice_materials', $prefix))
                ->set('discount_rate', 0)
                ->set('total_discount', 0)
                ->set('total_without_taxes', $datum['total_without_discount'])
                ->set('total_replacement_price', $totalReplacementPrice)
                ->where(['id' => $datum['id']])
                ->execute();
        }

        $invoice_materials
            ->changeColumn('discount_rate', 'decimal', [
                'precision' => 7,
                'scale' => 4,
                'null' => false,
            ])
            ->changeColumn('total_discount', 'decimal', [
                'precision' => 14,
                'scale' => 2,
                'null' => false,
            ])
            ->changeColumn('total_without_taxes', 'decimal', [
                'precision' => 14,
                'scale' => 2,
                'null' => false,
            ])
            ->update();

        //
        // - Lignes de facturation en extra d'une facture
        //

        $invoice_extras = $this->table('invoice_extras', ['signed' => true]);
        $invoice_extras
            ->addColumn('invoice_id', 'integer', ['signed' => true, 'null' => false])
            ->addColumn('description', 'string', [
                'length' => 191,
                'null' => false,
            ])
            ->addColumn('unit_price', 'decimal', [
                'precision' => 14,
                'scale' => 2,
                'null' => false,
            ])
            ->addColumn('quantity', 'smallinteger', [
                'signed' => false,
                'length' => 5,
                'null' => false,
            ])
            ->addColumn('total_without_taxes', 'decimal', [
                'precision' => 14,
                'scale' => 2,
                'null' => false,
            ])
            ->addColumn('taxes', 'json', [
                'null' => true, // => `null`: Pas de taxe.
                'default' => null,
            ])
            ->addIndex(['invoice_id'])
            ->addForeignKey('invoice_id', 'invoices', 'id', [
                'delete' => 'CASCADE',
                'update' => 'NO_ACTION',
                'constraint' => 'fk__invoice_extra__invoice',
            ])
            ->create();

        //
        // - Devis
        //

        $estimates = $this->table('estimates');
        $estimates
            ->addColumn('is_legacy', 'boolean', [
                'default' => false,
                'null' => false,
                'after' => 'beneficiary_id',
            ])
            ->changeColumn('degressive_rate', 'decimal', [
                'precision' => 7,
                'scale' => 2,
                'null' => true, // - `null`: Si non "legacy".
                'default' => null,
                'comment' => 'Legacy only.',
            ])
            ->changeColumn('daily_total', 'decimal', [
                'precision' => 14,
                'scale' => 2,
                'null' => true, // - `null`: Si non "legacy".
                'default' => null,
                'comment' => 'Legacy only.',
            ])
            ->renameColumn('discount_rate', 'global_discount_rate')
            ->changeColumn('global_discount_rate', 'decimal', [
                'precision' => 7,
                'scale' => 4,
                'null' => false,
            ])
            ->renameColumn('total_without_discount', 'total_without_global_discount')
            ->renameColumn('total_discount', 'total_global_discount')
            ->renameColumn('total_taxes', 'total_taxes_old')
            ->removeColumn('total_discountable')
            ->addColumn('total_taxes_new', 'json', [
                'null' => true,
                'default' => null,
                'after' => 'total_without_taxes',
            ])
            ->update();

        $data = $this->fetchAll(vsprintf(
            'SELECT
                `estimate`.`id`,
                `estimate`.`vat_rate`,
                `estimate`.`total_taxes_old`
            FROM `%1$sestimates` AS `estimate`',
            [$prefix],
        ));
        foreach ($data as $datum) {
            $taxData = null;
            if (!Decimal::of($datum['vat_rate'])->isZero()) {
                $taxData = json_encode([
                    [
                        'name' => $i18n->translate('vat'),
                        'is_rate' => true,
                        'value' => $datum['vat_rate'],
                        'total' => $datum['total_taxes_old'],
                    ],
                ]);
            }

            $qb = $this->getUpdateBuilder();
            $qb
                ->update(sprintf('%sestimates', $prefix))
                ->set('is_legacy', true)
                ->set('total_taxes_new', $taxData)
                ->where(['id' => $datum['id']])
                ->execute();
        }

        $estimates
            ->removeColumn('vat_rate')
            ->removeColumn('total_taxes_old')
            ->renameColumn('total_taxes_new', 'total_taxes')
            ->update();

        $estimate_materials = $this->table('estimate_materials');
        $estimate_materials
            ->addColumn('degressive_rate', 'decimal', [
                'precision' => 7,
                'scale' => 2,
                'null' => true, // => `null`: Facture "legacy".
                'default' => null,
                'after' => 'unit_price',
            ])
            ->addColumn('unit_price_period', 'decimal', [
                'precision' => 14,
                'scale' => 2,
                'null' => true,
                'default' => null, // => `null`: Facture "legacy".
                'after' => 'degressive_rate',
            ])
            ->addColumn('discount_rate', 'decimal', [
                'precision' => 7,
                'scale' => 4,
                'null' => true,
                'default' => null,
                'after' => 'unit_price_period',
            ])
            ->addColumn('taxes', 'json', [
                'null' => true, // => `null`: Pas de taxe pour la réservation ou facture "legacy".
                'default' => null,
                'after' => 'discount_rate',
            ])
            ->renameColumn('total_price', 'total_without_discount')
            ->addColumn('total_discount', 'decimal', [
                'precision' => 14,
                'scale' => 2,
                'null' => true,
                'default' => null,
                'after' => 'total_without_discount',
            ])
            ->addColumn('total_without_taxes', 'decimal', [
                'precision' => 14,
                'scale' => 2,
                'null' => true,
                'default' => null,
                'after' => 'total_discount',
            ])
            ->renameColumn('replacement_price', 'unit_replacement_price')
            ->addColumn('total_replacement_price', 'decimal', [
                'precision' => 14,
                'scale' => 2,
                'null' => true,
                'default' => null,
                'after' => 'unit_replacement_price',
            ])
            ->removeColumn('is_discountable')
            ->update();

        $data = $this->fetchAll(vsprintf(
            'SELECT
                `estimate_material`.`id`,
                `estimate_material`.`quantity`,
                `estimate_material`.`unit_replacement_price`,
                `estimate_material`.`total_without_discount`
            FROM `%1$sestimate_materials` AS `estimate_material`',
            [$prefix],
        ));
        foreach ($data as $datum) {
            $unitReplacementPrice = $datum['unit_replacement_price'] !== null
                ? Decimal::of($datum['unit_replacement_price'])
                : null;

            $totalReplacementPrice = null;
            if ($unitReplacementPrice !== null) {
                $totalReplacementPrice = $unitReplacementPrice
                    ->multipliedBy($datum['quantity'])
                    ->toScale(2, RoundingMode::UNNECESSARY);
            }

            $qb = $this->getUpdateBuilder();
            $qb
                ->update(sprintf('%sestimate_materials', $prefix))
                ->set('discount_rate', 0)
                ->set('total_discount', 0)
                ->set('total_without_taxes', $datum['total_without_discount'])
                ->set('total_replacement_price', $totalReplacementPrice)
                ->where(['id' => $datum['id']])
                ->execute();
        }

        $estimate_materials
            ->changeColumn('discount_rate', 'decimal', [
                'precision' => 7,
                'scale' => 4,
                'null' => false,
            ])
            ->changeColumn('total_discount', 'decimal', [
                'precision' => 14,
                'scale' => 2,
                'null' => false,
            ])
            ->changeColumn('total_without_taxes', 'decimal', [
                'precision' => 14,
                'scale' => 2,
                'null' => false,
            ])
            ->update();

        //
        // - Lignes de facturation en extra d'un devis
        //

        $estimate_extras = $this->table('estimate_extras', ['signed' => true]);
        $estimate_extras
            ->addColumn('estimate_id', 'integer', ['signed' => true, 'null' => false])
            ->addColumn('description', 'string', [
                'length' => 191,
                'null' => false,
            ])
            ->addColumn('unit_price', 'decimal', [
                'precision' => 14,
                'scale' => 2,
                'null' => false,
            ])
            ->addColumn('quantity', 'smallinteger', [
                'signed' => false,
                'length' => 5,
                'null' => false,
            ])
            ->addColumn('total_without_taxes', 'decimal', [
                'precision' => 14,
                'scale' => 2,
                'null' => false,
            ])
            ->addColumn('taxes', 'json', [
                'null' => true, // => `null`: Pas de taxe.
                'default' => null,
            ])
            ->addIndex(['estimate_id'])
            ->addForeignKey('estimate_id', 'estimates', 'id', [
                'delete' => 'CASCADE',
                'update' => 'NO_ACTION',
                'constraint' => 'fk__estimate_extra__invoice',
            ])
            ->create();
    }

    public function down(): void
    {
        $prefix = Config::get('db.prefix');

        // - Réservations.
        $reservationsData = [];
        $allReservationMaterials = $this->fetchAll(vsprintf(
            'SELECT
                `reservation`.`id`,
                `reservation_material`.`degressive_rate`,
                `reservation_material`.`taxes`
            FROM `%1$sreservation_materials` AS `reservation_material`
            INNER JOIN `%1$sreservations` AS `reservation`
                ON `reservation`.`id` = `reservation_material`.`reservation_id`',
            [$prefix],
        ));
        foreach ($allReservationMaterials as $datum) {
            $taxRate = null;
            $taxData = $datum['taxes'] !== null
                ? json_decode($datum['taxes'], true)
                : null;
            if (!empty($taxData)) {
                if (count($taxData) > 1) {
                    throw new \RuntimeException(
                        "Unable to rollback the migration, this would cause the " .
                        "loss of taxes data in some reservations.",
                    );
                }

                $taxDatum = array_shift($taxData);
                if (!(bool) $taxDatum['is_rate']) {
                    throw new \RuntimeException(
                        "Unable to rollback the migration, this would cause the " .
                        "loss of taxes data in some reservations.",
                    );
                }
                $taxRate = $taxDatum['value'];
            }
            $degressiveRate = $datum['degressive_rate'];

            $existing = $reservationsData[$datum['id']] ?? null;
            if (
                $existing !== null &&
                (
                    $existing['degressive_rate'] !== $degressiveRate ||
                    $existing['vat_rate'] !== $taxRate
                )
            ) {
                throw new \RuntimeException(
                    "Unable to rollback the migration, this would cause the " .
                    "loss of tax or degressive rate data in some reservation materials.",
                );
            }

            $reservationsData[$datum['id']] = [
                'degressive_rate' => $degressiveRate,
                'vat_rate' => $taxRate,
            ];
        }

        // - Factures.
        $hasNonLegacyInvoices = (
            (int) $this->fetchRow(vsprintf(
                'SELECT COUNT(*) AS `count` FROM `%1$sinvoices` WHERE `is_legacy` <> 1',
                [$prefix],
            ))['count']
        ) !== 0;
        if ($hasNonLegacyInvoices) {
            throw new \RuntimeException(
                "Unable to rollback the migration, this would cause the " .
                "loss of newly generated estimates and/or invoices.",
            );
        }
        $invoicesData = [];
        $allInvoices = $this->fetchAll(vsprintf(
            'SELECT
                `invoice`.`id`,
                `invoice`.`total_taxes`,
                `invoice`.`total_without_global_discount`
            FROM `%1$sinvoices` AS `invoice`',
            [$prefix],
        ));
        foreach ($allInvoices as $datum) {
            $taxRate = null;
            $taxTotal = null;
            $taxData = $datum['total_taxes'] !== null
                ? json_decode($datum['total_taxes'], true)
                : null;
            if (!empty($taxData)) {
                if (count($taxData) > 1) {
                    throw new \RuntimeException(
                        "Unable to rollback the migration, this would cause the " .
                        "loss of taxes data in some invoices.",
                    );
                }

                $taxDatum = array_shift($taxData);
                if (!(bool) $taxDatum['is_rate']) {
                    throw new \RuntimeException(
                        "Unable to rollback the migration, this would cause the " .
                        "loss of taxes data in some invoices.",
                    );
                }
                $taxRate = $taxDatum['value'];
                $taxTotal = $taxDatum['total'];
            }

            $invoicesData[$datum['id']] = [
                'vat_rate' => $taxRate,
                'total_taxes' => $taxTotal,
                'total_without_discount' => $datum['total_without_global_discount'],
            ];
        }

        // - Devis.
        $hasNonLegacyEstimates = (
            (int) $this->fetchRow(vsprintf(
                'SELECT COUNT(*) AS `count` FROM `%1$sestimates` WHERE `is_legacy` <> 1',
                [$prefix],
            ))['count']
        ) !== 0;
        if ($hasNonLegacyInvoices || $hasNonLegacyEstimates) {
            throw new \RuntimeException(
                "Unable to rollback the migration, this would cause the " .
                "loss of newly generated estimates and/or invoices.",
            );
        }
        $estimatesData = [];
        $allEstimates = $this->fetchAll(vsprintf(
            'SELECT
                `estimate`.`id`,
                `estimate`.`total_taxes`,
                `estimate`.`total_without_global_discount`
            FROM `%1$sestimates` AS `estimate`',
            [$prefix],
        ));
        foreach ($allEstimates as $datum) {
            $taxRate = null;
            $taxTotal = null;
            $taxData = $datum['total_taxes'] !== null
                ? json_decode($datum['total_taxes'], true)
                : null;
            if (!empty($taxData)) {
                if (count($taxData) > 1) {
                    throw new \RuntimeException(
                        "Unable to rollback the migration, this would cause the " .
                        "loss of taxes data in some estimates.",
                    );
                }

                $taxDatum = array_shift($taxData);
                if (!(bool) $taxDatum['is_rate']) {
                    throw new \RuntimeException(
                        "Unable to rollback the migration, this would cause the " .
                        "loss of taxes data in some estimates.",
                    );
                }
                $taxRate = $taxDatum['value'];
                $taxTotal = $taxDatum['total'];
            }

            $estimatesData[$datum['id']] = [
                'vat_rate' => $taxRate,
                'total_taxes' => $taxTotal,
                'total_without_discount' => $datum['total_without_global_discount'],
            ];
        }

        //
        // - Réservations
        //

        $this->table('reservation_extras')->drop()->save();

        $reservations = $this->table('reservations');
        $reservations
            ->changeColumn('currency', 'char', [
                'length' => 3,
                'null' => true,
                'default' => null,
            ])
            ->update();

        $reservations = $this->table('reservations');
        $reservations
            ->removeColumn('global_discount_rate')
            ->addColumn('degressive_rate', 'decimal', [
                'precision' => 7,
                'scale' => 2,
                'null' => true,
                'default' => null,
                'after' => 'is_billable',
            ])
            ->addColumn('vat_rate', 'decimal', [
                'precision' => 4,
                'scale' => 2,
                'null' => true,
                'default' => null,
                'after' => 'degressive_rate',
            ])
            ->update();

        foreach ($reservationsData as $id => $datum) {
            $qb = $this->getUpdateBuilder();
            $qb
                ->update(sprintf('%sreservations', $prefix))
                ->set('degressive_rate', $datum['degressive_rate'])
                ->set('vat_rate', $datum['vat_rate'])
                ->where(['id' => $id])
                ->execute();
        }

        $reservation_materials = $this->table('reservation_materials');
        $reservation_materials
            ->removeColumn('name')
            ->removeColumn('reference')
            ->removeColumn('degressive_rate')
            ->removeColumn('discount_rate')
            ->removeColumn('taxes')
            ->removeColumn('unit_replacement_price')
            ->update();

        //
        // - Événements
        //

        $this->table('event_extras')->drop()->save();

        $events = $this->table('events');
        $events
            ->removeColumn('global_discount_rate')
            ->removeColumn('currency')
            ->update();

        $event_materials = $this->table('event_materials');
        $event_materials
            ->removeColumn('name')
            ->removeColumn('reference')
            ->removeColumn('unit_price')
            ->removeColumn('degressive_rate')
            ->removeColumn('discount_rate')
            ->removeColumn('taxes')
            ->removeColumn('unit_replacement_price')
            ->update();

        //
        // - Factures
        //

        $this->table('invoice_extras')->drop()->save();

        $invoices = $this->table('invoices');
        $invoices
            ->removeColumn('is_legacy')
            ->removeColumn('total_taxes')
            ->update();
        $invoices
            ->changeColumn('degressive_rate', 'decimal', [
                'precision' => 7,
                'scale' => 2,
                'null' => false,
            ])
            ->changeColumn('daily_total', 'decimal', [
                'precision' => 14,
                'scale' => 2,
                'null' => false,
            ])
            ->addColumn('vat_rate', 'decimal', [
                'precision' => 4,
                'scale' => 2,
                'null' => true,
                'default' => null,
                'after' => 'discount_rate',
            ])
            ->addColumn('total_taxes', 'decimal', [
                'precision' => 14,
                'scale' => 2,
                'null' => true,
                'default' => null,
                'after' => 'total_without_taxes',
            ])
            ->renameColumn('global_discount_rate', 'discount_rate')
            ->changeColumn('discount_rate', 'decimal', [
                'precision' => 6,
                'scale' => 4,
                'null' => false,
            ])
            ->renameColumn('total_without_global_discount', 'total_without_discount')
            ->addColumn('total_discountable', 'decimal', [
                'precision' => 14,
                'scale' => 2,
                'null' => true,
                'after' => 'total_without_discount',
            ])
            ->renameColumn('total_global_discount', 'total_discount')
            ->update();

        foreach ($invoicesData as $id => $datum) {
            $qb = $this->getUpdateBuilder();
            $qb
                ->update(sprintf('%sinvoices', $prefix))
                ->set('vat_rate', $datum['vat_rate'])
                ->set('total_discountable', $datum['total_without_discount'])
                ->set('total_taxes', $datum['total_taxes'])
                ->where(['id' => $id])
                ->execute();
        }

        $invoices
            ->changeColumn('vat_rate', 'decimal', [
                'precision' => 4,
                'scale' => 2,
                'null' => false,
            ])
            ->changeColumn('total_taxes', 'decimal', [
                'precision' => 14,
                'scale' => 2,
                'null' => false,
            ])
            ->update();

        $invoice_materials = $this->table('invoice_materials');
        $invoice_materials
            ->renameColumn('total_without_discount', 'total_price')
            ->removeColumn('degressive_rate')
            ->removeColumn('unit_price_period')
            ->removeColumn('discount_rate')
            ->removeColumn('taxes')
            ->removeColumn('total_discount')
            ->removeColumn('total_without_taxes')
            ->renameColumn('unit_replacement_price', 'replacement_price')
            ->removeColumn('total_replacement_price')
            ->addColumn('is_discountable', 'boolean', [
                'default' => true,
                'null' => false,
                'after' => 'is_hidden_on_bill',
            ])
            ->update();

        //
        // - Devis
        //

        $this->table('estimate_extras')->drop()->save();

        $estimates = $this->table('estimates');
        $estimates
            ->removeColumn('is_legacy')
            ->removeColumn('total_taxes')
            ->update();
        $estimates
            ->changeColumn('degressive_rate', 'decimal', [
                'precision' => 7,
                'scale' => 2,
                'null' => false,
            ])
            ->changeColumn('daily_total', 'decimal', [
                'precision' => 14,
                'scale' => 2,
                'null' => false,
            ])
            ->addColumn('vat_rate', 'decimal', [
                'precision' => 4,
                'scale' => 2,
                'null' => true,
                'default' => null,
                'after' => 'discount_rate',
            ])
            ->addColumn('total_taxes', 'decimal', [
                'precision' => 14,
                'scale' => 2,
                'null' => true,
                'default' => null,
                'after' => 'total_without_taxes',
            ])
            ->renameColumn('global_discount_rate', 'discount_rate')
            ->changeColumn('discount_rate', 'decimal', [
                'precision' => 6,
                'scale' => 4,
                'null' => false,
            ])
            ->renameColumn('total_without_global_discount', 'total_without_discount')
            ->addColumn('total_discountable', 'decimal', [
                'precision' => 14,
                'scale' => 2,
                'null' => true,
                'after' => 'total_without_discount',
            ])
            ->renameColumn('total_global_discount', 'total_discount')
            ->update();

        foreach ($estimatesData as $id => $datum) {
            $qb = $this->getUpdateBuilder();
            $qb
                ->update(sprintf('%sestimates', $prefix))
                ->set('vat_rate', $datum['vat_rate'])
                ->set('total_discountable', $datum['total_without_discount'])
                ->set('total_taxes', $datum['total_taxes'])
                ->where(['id' => $id])
                ->execute();
        }

        $estimates
            ->changeColumn('vat_rate', 'decimal', [
                'precision' => 4,
                'scale' => 2,
                'null' => false,
            ])
            ->changeColumn('total_taxes', 'decimal', [
                'precision' => 14,
                'scale' => 2,
                'null' => false,
            ])
            ->update();

        $estimate_materials = $this->table('estimate_materials');
        $estimate_materials
            ->renameColumn('total_without_discount', 'total_price')
            ->removeColumn('degressive_rate')
            ->removeColumn('unit_price_period')
            ->removeColumn('discount_rate')
            ->removeColumn('taxes')
            ->removeColumn('total_discount')
            ->removeColumn('total_without_taxes')
            ->renameColumn('unit_replacement_price', 'replacement_price')
            ->removeColumn('total_replacement_price')
            ->addColumn('is_discountable', 'boolean', [
                'default' => true,
                'null' => false,
                'after' => 'is_hidden_on_bill',
            ])
            ->update();
    }
}
