<?php
declare(strict_types=1);

namespace Loxya\Tests;

use Fig\Http\Message\StatusCodeInterface as StatusCode;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Loxya\Models\Beneficiary;
use Loxya\Models\Enums\BillingFormat;
use Loxya\Models\Enums\InvoiceStatus;
use Loxya\Models\Estimate;
use Loxya\Models\Invoice;
use Loxya\Models\User;
use Loxya\Services\Auth;
use Loxya\Support\Arr;
use Loxya\Support\Invoicing\PaymentMethod;
use Loxya\Support\Invoicing\TaxRegime;
use Loxya\Support\Invoicing\VatExemptionCode\VatExemptionCodeEu;
use PHPUnit\Framework\Attributes\DataProvider;

final class InvoicesTest extends ApiTestCase
{
    public static function data(?int $id = null, string $format = Invoice::SERIALIZE_DEFAULT)
    {
        $invoices = new Collection([
            [
                'id' => 1,
                'format' => BillingFormat::V1->value,
                'number' => '2020-00001',
                'order_number' => null,
                'date' => '2020-01-30 14:00:00',
                'due_date' => '2020-02-15',
                'due_delay' => null,
                'status' => InvoiceStatus::PARTIALLY_PAID->value,
                'url' => [
                    'pdf' => 'http://loxya.test/invoices/1/pdf',
                    'ubl' => null,
                ],
                'buyer' => BeneficiariesTest::data(1, Beneficiary::SERIALIZE_SUMMARY),
                'is_electronic' => false,
                'is_prepayment' => false,
                'is_prepayment_final' => false,
                'is_credit_note' => false,
                'is_cancelled' => false,
                'is_overdue' => true,
                'total_without_taxes' => '544.13',
                'global_tax_regime' => null,
                'global_tax_exemption_code' => null,
                'global_tax_exemption_reason' => null,
                'total_taxes' => [
                    [
                        'name' => 'T.V.A.',
                        'is_rate' => true,
                        'value' => '20.000',
                        'total' => '60.00',
                    ],
                ],
                'total_with_taxes' => '604.13',
                'parent_estimate' => null,
                'parent_invoice' => null,
                'child_invoice' => null,
                'currency' => 'EUR',
                'lang' => 'fr',
                'payments' => [
                    [
                        'id' => 1,
                        'date' => '2020-02-01 10:00:00',
                        'method' => PaymentMethod::CARD->value,
                        'amount' => '200.00',
                        'taxes_breakdown' => null,
                        'reference' => 'PAY-0001',
                    ],
                    [
                        'id' => 2,
                        'date' => '2020-02-10 15:30:00',
                        'method' => PaymentMethod::TRANSFER->value,
                        'amount' => '150.00',
                        'taxes_breakdown' => null,
                        'reference' => null,
                    ],
                ],
                'created_at' => '2020-01-30 14:00:00',
            ],
            [
                'id' => 2,
                'format' => BillingFormat::V3->value,
                'number' => '2020-00002',
                'order_number' => 'BC-0001',
                'date' => '2020-06-16 12:30:45',
                'due_date' => null,
                'due_delay' => 15,
                'status' => InvoiceStatus::PAID->value,
                'url' => [
                    'pdf' => 'http://loxya.test/invoices/2/pdf',
                    'ubl' => null,
                ],
                'buyer' => BeneficiariesTest::data(2, Beneficiary::SERIALIZE_SUMMARY),
                'is_electronic' => true,
                'is_prepayment' => false,
                'is_prepayment_final' => false,
                'is_credit_note' => false,
                'is_cancelled' => false,
                'is_overdue' => false,
                'total_without_taxes' => '3406.51',
                'global_tax_regime' => null,
                'global_tax_exemption_code' => null,
                'global_tax_exemption_reason' => null,
                'total_taxes' => [
                    [
                        'type' => TaxRegime::STANDARD->value,
                        'value' => '20.000',
                        'base' => '2380.51',
                        'total' => '476.10',
                    ],
                    [
                        'type' => TaxRegime::STANDARD->value,
                        'value' => '10.000',
                        'base' => '1026.00',
                        'total' => '102.60',
                    ],
                ],
                'total_with_taxes' => '3985.21',
                'parent_estimate' => null,
                'parent_invoice' => null,
                'child_invoice' => null,
                'currency' => 'EUR',
                'lang' => 'en',
                'payments' => [
                    [
                        'id' => 3,
                        'date' => '2020-06-20 09:15:00',
                        'method' => PaymentMethod::TRANSFER->value,
                        'amount' => '3985.21',
                        'taxes_breakdown' => [
                            ['rate' => '20.000', 'amount' => '2856.61'],
                            ['rate' => '10.000', 'amount' => '1128.60'],
                        ],
                        'reference' => 'PAY-0002',
                    ],
                ],
                'created_at' => '2020-06-16 12:30:45',
            ],
            [
                'id' => 3,
                'format' => BillingFormat::V3->value,
                'number' => '2020-00003',
                'order_number' => null,
                'date' => '2020-09-15 10:00:00',
                'due_date' => '2020-10-15',
                'due_delay' => null,
                'status' => InvoiceStatus::PENDING->value,
                'url' => [
                    'pdf' => 'http://loxya.test/invoices/3/pdf',
                    'ubl' => null,
                ],
                'buyer' => BeneficiariesTest::data(1, Beneficiary::SERIALIZE_SUMMARY),
                'is_electronic' => true,
                'is_prepayment' => false,
                'is_prepayment_final' => false,
                'is_credit_note' => false,
                'is_cancelled' => false,
                'is_overdue' => true,
                'total_without_taxes' => '75.00',
                'global_tax_regime' => null,
                'global_tax_exemption_code' => null,
                'global_tax_exemption_reason' => null,
                'total_taxes' => [
                    [
                        'type' => TaxRegime::REVERSE_CHARGE_SUPPLY->value,
                        'base' => '75.00',
                        'reason' => [],
                    ],
                ],
                'total_with_taxes' => '75.00',
                'parent_estimate' => null,
                'parent_invoice' => null,
                'child_invoice' => null,
                'currency' => 'EUR',
                'lang' => 'fr',
                'payments' => [],
                'created_at' => '2020-09-15 10:00:00',
            ],
            [
                'id' => 4,
                'format' => BillingFormat::V3->value,
                'number' => '2021-00001',
                'order_number' => 'BC-0002',
                'date' => '2021-06-01 10:00:00',
                'due_date' => null,
                'due_delay' => 20,
                'status' => InvoiceStatus::PENDING->value,
                'url' => [
                    'pdf' => 'http://loxya.test/invoices/4/pdf',
                    'ubl' => null,
                ],
                'buyer' => BeneficiariesTest::data(2, Beneficiary::SERIALIZE_SUMMARY),
                'is_electronic' => true,
                'is_prepayment' => false,
                'is_prepayment_final' => false,
                'is_credit_note' => false,
                'is_cancelled' => false,
                'is_overdue' => true,
                'total_without_taxes' => '705.00',
                'global_tax_regime' => null,
                'global_tax_exemption_code' => null,
                'global_tax_exemption_reason' => null,
                'total_taxes' => [
                    [
                        'type' => TaxRegime::STANDARD->value,
                        'value' => '0.000',
                        'base' => '5.00',
                        'total' => '0.00',
                    ],
                    [
                        'type' => TaxRegime::EXEMPTED->value,
                        'reason' => [
                            VatExemptionCodeEu::VATEX_EU_79_C->value,
                            VatExemptionCodeEu::VATEX_EU_151_1D->value,
                        ],
                        'base' => '700.00',
                    ],
                ],
                'total_with_taxes' => '705.00',
                'parent_estimate' => null,
                'parent_invoice' => null,
                'child_invoice' => null,
                'currency' => 'EUR',
                'lang' => 'fr',
                'payments' => [],
                'created_at' => '2021-06-01 10:00:00',
            ],
            [
                'id' => 5,
                'format' => BillingFormat::V3->value,
                'number' => '2021-00002',
                'order_number' => null,
                'date' => '2021-02-15 10:00:00',
                'due_date' => null,
                'due_delay' => 0,
                'status' => InvoiceStatus::PENDING->value,
                'url' => [
                    'pdf' => 'http://loxya.test/invoices/5/pdf',
                    'ubl' => 'http://loxya.test/invoices/5/ubl',
                ],
                'buyer' => BeneficiariesTest::data(1, Beneficiary::SERIALIZE_SUMMARY),
                'is_electronic' => true,
                'is_prepayment' => true,
                'is_prepayment_final' => false,
                'is_credit_note' => false,
                'is_cancelled' => false,
                'is_overdue' => true,
                'total_without_taxes' => '83.39',
                'global_tax_regime' => null,
                'global_tax_exemption_code' => null,
                'global_tax_exemption_reason' => null,
                'total_taxes' => [
                    [
                        'type' => TaxRegime::STANDARD->value,
                        'value' => '20.000',
                        'base' => '82.93',
                        'total' => '16.59',
                    ],
                    [
                        'type' => TaxRegime::STANDARD->value,
                        'value' => '5.500',
                        'base' => '0.46',
                        'total' => '0.03',
                    ],
                ],
                'total_with_taxes' => '100.01',
                'parent_estimate' => EstimatesTest::data(1, Estimate::SERIALIZE_EXCERPT),
                'parent_invoice' => null,
                'child_invoice' => null,
                'currency' => 'EUR',
                'lang' => 'en',
                'payments' => [],
                'created_at' => '2021-02-15 10:00:00',
            ],
            [
                'id' => 6,
                'format' => BillingFormat::V3->value,
                'number' => '2021-00003',
                'order_number' => null,
                'date' => '2021-08-01 10:00:00',
                'due_date' => null,
                'due_delay' => 30,
                'status' => InvoiceStatus::PARTIALLY_PAID->value,
                'url' => [
                    'pdf' => 'http://loxya.test/invoices/6/pdf',
                    'ubl' => null,
                ],
                'buyer' => BeneficiariesTest::data(2, Beneficiary::SERIALIZE_SUMMARY),
                'is_electronic' => false,
                'is_prepayment' => false,
                'is_prepayment_final' => false,
                'is_credit_note' => false,
                'is_cancelled' => false,
                'is_overdue' => true,
                'total_without_taxes' => '900.00',
                'global_tax_regime' => null,
                'global_tax_exemption_code' => null,
                'global_tax_exemption_reason' => null,
                'total_taxes' => [
                    [
                        'type' => TaxRegime::STANDARD->value,
                        'value' => '20.000',
                        'base' => '900.00',
                        'total' => '180.00',
                    ],
                ],
                'total_with_taxes' => '1080.00',
                'parent_estimate' => null,
                'parent_invoice' => null,
                'child_invoice' => null,
                'currency' => 'EUR',
                'lang' => 'fr',
                'payments' => [
                    [
                        'id' => 4,
                        'date' => '2021-08-15 14:00:00',
                        'method' => PaymentMethod::CHEQUE->value,
                        'amount' => '580.00',
                        'taxes_breakdown' => [
                            ['rate' => '20.000', 'amount' => '580.00'],
                        ],
                        'reference' => null,
                    ],
                ],
                'created_at' => '2021-08-01 10:00:00',
            ],
        ]);

        $invoices = match ($format) {
            Invoice::SERIALIZE_EXCERPT => $invoices->map(static fn ($invoice) => (
                Arr::only($invoice, [
                    'id',
                    'format',
                    'number',
                    'status',
                    'date',
                    'url',
                    'total_without_taxes',
                    'global_tax_regime',
                    'global_tax_exemption_code',
                    'global_tax_exemption_reason',
                    'total_taxes',
                    'total_with_taxes',
                    'is_prepayment',
                    'is_credit_note',
                    'is_cancelled',
                    'is_overdue',
                    'currency',
                    'created_at',
                ])
            )),
            Invoice::SERIALIZE_DEFAULT => $invoices->map(static fn ($invoice) => (
                Arr::except($invoice, [
                    'is_prepayment_final',
                    'prepayment_invoices',
                    'payments',
                ])
            )),
            Invoice::SERIALIZE_DETAILS => $invoices->map(static fn ($invoice) => (
                array_replace($invoice, [
                    'buyer' => BeneficiariesTest::data(
                        $invoice['buyer']['id'],
                        Beneficiary::SERIALIZE_DEFAULT,
                    ),
                ])
            )),
            default => throw new \InvalidArgumentException(sprintf("Unknown format \"%s\"", $format)),
        };

        return static::dataFactory($id, $invoices->all());
    }

    public function testGetAll(): void
    {
        // - Test simple.
        $this->client->get('/api/invoices');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponsePaginatedData(6, [
            self::data(6),
            self::data(4),
            self::data(5),
            self::data(3),
            self::data(2),
            self::data(1),
        ]);

        // - Test avec recherche sur le nom du bénéficiaire.
        $this->client->get('/api/invoices', ['search' => 'Fount']);
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponsePaginatedData(3, [
            self::data(5),
            self::data(3),
            self::data(1),
        ]);
    }

    #[DataProvider('feedGetAllWithFilters')]
    public function testGetAllWithFilters(array $filtersQuery, array $expectedIds): void
    {
        $this->client->get('/api/invoices', $filtersQuery);
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponsePaginatedData(count($expectedIds));
        foreach ($expectedIds as $index => $expectedId) {
            $this->assertResponseHasKeyEquals(sprintf('data.%d.id', $index), $expectedId);
        }
    }

    public static function feedGetAllWithFilters(): array
    {
        return [
            [['status' => 'overdue'], [6, 1]],
            [['status' => 'partially-paid'], [6, 1]],
            [['status' => 'paid'], [2]],
            [['status' => 'sent', 'date' => '2021-01-28'], []],
            [['date' => ['operator' => '<', 'value' => '2020-04-15']], [1]],
            [['date' => ['operator' => '>', 'value' => '2020-04-15']], [6, 4, 5, 3, 2]],
            [['date' => ['operator' => '=', 'value' => '2020-01-30']], [1]],
            [['date' => '2020-06-16'], [2]],
            [
                [
                    'status' => 'paid',
                    'date' => ['operator' => '>', 'value' => '2020-02-01'],
                ],
                [2],
            ],
            [
                [
                    'date' => ['operator' => '<', 'value' => '2020-02-01'],
                    'dueDate' => ['operator' => '>', 'value' => '2020-02-01'],
                ],
                [1],
            ],
            [['amount' => ['operator' => '>', 'value' => '100']], [6, 4, 2, 1]],
            [['amount' => ['operator' => '<', 'value' => '800']], [4, 5, 3, 1]],
        ];
    }

    public function testGetOne(): void
    {
        // - Avec une factures inexistante.
        $this->client->get('/api/invoices/999');
        $this->assertStatusCode(StatusCode::STATUS_NOT_FOUND);

        // - Avec des factures valides
        $ids = array_column(static::data(null), 'id');
        foreach ($ids as $id) {
            $this->client->get(sprintf('/api/invoices/%d', $id));
            $this->assertStatusCode(StatusCode::STATUS_OK);
            $this->assertResponseData(self::data($id, Invoice::SERIALIZE_DETAILS));
        }
    }

    public function testUpdateStatus(): void
    {
        // - Si la facture n'existe pas...
        $this->client->put('/api/invoices/999/status', [
            'status' => InvoiceStatus::SENT->value,
        ]);
        $this->assertStatusCode(StatusCode::STATUS_NOT_FOUND);

        // - Avec un statut invalide...
        $wrongStatuses = [
            '__unknown__',
            InvoiceStatus::OVERDUE->value,
            InvoiceStatus::PAID->value,
            InvoiceStatus::PARTIALLY_PAID->value,
        ];
        foreach ($wrongStatuses as $wrongStatus) {
            $this->client->put('/api/invoices/2/status', [
                'status' => $wrongStatus,
            ]);
            $this->assertStatusCode(StatusCode::STATUS_BAD_REQUEST);
        }

        // - Avec un statut valide.
        $this->client->put('/api/invoices/1/status', [
            'status' => InvoiceStatus::SENT->value,
        ]);
        $this->assertStatusCode(StatusCode::STATUS_OK);
    }

    public function testCreate(): void
    {
        static::setNow(Carbon::create(2025, 3, 15, 10, 0, 0));

        $sampleLine = [
            'uuid' => 'b0fca9e2-f1e8-4ef8-921d-82c3dfadcb85',
            'is_service' => false,
            'description' => 'Support de protection',
            'quantity' => 1,
            'unit_price' => '100.00',
            'discount_rate' => '0',
            'tax_regime' => TaxRegime::STANDARD->value,
            'tax_exemption_code' => null,
            'tax_id' => 1,
        ];

        // - Sans données.
        $this->client->post('/api/invoices');
        $this->assertStatusCode(StatusCode::STATUS_BAD_REQUEST);

        // - Sans acheteur.
        $this->client->post('/api/invoices', [
            'lines' => [$sampleLine],
            'global_discount_rate' => '0',
        ]);
        $this->assertApiValidationError(['buyer_id' => "This field is mandatory."]);

        // - Avec un acheteur inexistant.
        $this->client->post('/api/invoices', [
            'buyer_id' => 999,
            'lines' => [$sampleLine],
            'global_discount_rate' => '0',
        ]);
        $this->assertApiValidationError(['buyer_id' => "This field is invalid."]);

        // - Avec des lignes vides et une remise globale invalide.
        $this->client->post('/api/invoices', [
            'buyer_id' => 1,
            'lines' => [],
            'global_discount_rate' => '150',
        ]);
        $this->assertApiValidationError([
            'global_discount_rate' => 'This field is invalid.',
            'lines' => 'This field is mandatory.',
        ]);

        // - Avec plusieurs champs invalides sur une même ligne.
        $this->client->post('/api/invoices', [
            'buyer_id' => 1,
            'lines' => [
                array_replace($sampleLine, [
                    'uuid' => '3234a415-f44b-4f06-8c3e-ba94f66a9eab',
                    'quantity' => -1,
                    'unit_price' => '1',
                    'discount_rate' => '150',
                    'tax_id' => 1,
                ]),
            ],
            'global_discount_rate' => '0',
        ]);
        $this->assertApiValidationError([
            'lines' => [
                0 => [
                    'quantity' => "Must be greater than or equal to 1.",
                    'discount_rate' => "This field is invalid.",
                ],
            ],
        ]);

        // - Avec des erreurs réparties sur plusieurs lignes.
        $this->client->post('/api/invoices', [
            'buyer_id' => 1,
            'lines' => [
                $sampleLine,
                array_replace($sampleLine, ['unit_price' => '10.123']),
                array_replace($sampleLine, [
                    'tax_regime' => TaxRegime::EXEMPTED->value,
                    'tax_exemption_code' => 'INVALID_CODE',
                    'tax_id' => null,
                ]),
                array_replace($sampleLine, ['unit_price' => '9999999999999']),
            ],
            'global_discount_rate' => '0',
        ]);
        $this->assertApiValidationError([
            'lines' => [
                1 => [
                    'unit_price' => 'This field is invalid.',
                ],
                2 => [
                    'tax_exemption_code' => 'This field is invalid.',
                ],
                3 => [
                    'unit_price' => 'This field is invalid.',
                ],
            ],
        ]);

        // - Création simple (une ligne service, TVA 20%).
        $this->client->post('/api/invoices', [
            'buyer_id' => 1,
            'lines' => [
                [
                    'uuid' => 'b0fca9e2-f1e8-4ef8-921d-82c3dfadcb85',
                    'is_service' => true,
                    'description' => 'Prestation technique',
                    'quantity' => 2,
                    'unit_price' => '150.00',
                    'discount_rate' => '0',
                    'tax_regime' => TaxRegime::STANDARD->value,
                    'tax_exemption_code' => null,
                    'tax_id' => 1,
                ],
            ],
            'global_discount_rate' => '0',
        ]);
        $this->assertStatusCode(StatusCode::STATUS_CREATED);
        $this->assertResponseData([
            'id' => 7,
            'format' => BillingFormat::current()->value,
            'order_number' => null,
            'status' => InvoiceStatus::DRAFT->value,
            'due_date' => null,
            'due_delay' => 15,
            'url' => [
                'pdf' => 'http://loxya.test/invoices/7/pdf',
                'ubl' => null,
            ],
            'buyer' => BeneficiariesTest::data(1, Beneficiary::SERIALIZE_DEFAULT),
            'total_without_taxes' => '300.00',
            'global_tax_regime' => null,
            'global_tax_exemption_code' => null,
            'global_tax_exemption_reason' => null,
            'total_taxes' => [
                [
                    'type' => TaxRegime::STANDARD->value,
                    'value' => '20.000',
                    'base' => '300.00',
                    'total' => '60.00',
                ],
            ],
            'total_with_taxes' => '360.00',
            'is_electronic' => true,
            'is_overdue' => false,
            'is_prepayment' => false,
            'is_prepayment_final' => false,
            'is_credit_note' => false,
            'is_cancelled' => false,
            'parent_estimate' => null,
            'parent_invoice' => null,
            'child_invoice' => null,
            'currency' => 'EUR',
            'lang' => 'en',
            'payments' => [],
            'created_at' => '2025-03-15 10:00:00',
        ]);
        $responseStream = $this->client->get('/invoices/7/pdf');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertMatchesHtmlSnapshot((string) $responseStream);

        // - Création avec plusieurs lignes, remise globale, etc.
        $this->client->post('/api/invoices', [
            'buyer_id' => 2,
            'lines' => [
                [
                    'uuid' => '62652e73-f290-4522-8188-68dcade8490d',
                    'is_service' => true,
                    'description' => 'Installation',
                    'quantity' => 1,
                    'unit_price' => '500.00',
                    'discount_rate' => '10',
                    'tax_regime' => TaxRegime::STANDARD->value,
                    'tax_exemption_code' => null,
                    'tax_id' => 1,
                ],
                [
                    'uuid' => 'ab47d6d0-1ea9-4d2c-9405-af0dfd9e98f5',
                    'is_service' => false,
                    'description' => 'Câble HDMI',
                    'quantity' => 3,
                    'unit_price' => '15.00',
                    'discount_rate' => '0',
                    'tax_regime' => TaxRegime::STANDARD->value,
                    'tax_exemption_code' => null,
                    'tax_id' => 1,
                ],
            ],
            'global_discount_rate' => '5',
            'due_date' => '2025-04-10',
            'order_number' => 'BC-TEST-001',
            'special_mentions' => 'Merci pour votre confiance.',
            'lang' => 'en',
        ]);
        $this->assertStatusCode(StatusCode::STATUS_CREATED);
        $this->assertResponseData([
            'id' => 8,
            'format' => BillingFormat::current()->value,
            'order_number' => 'BC-TEST-001',
            'status' => InvoiceStatus::DRAFT->value,
            'due_date' => '2025-04-10',
            'due_delay' => null,
            'url' => [
                'pdf' => 'http://loxya.test/invoices/8/pdf',
                'ubl' => null,
            ],
            'buyer' => BeneficiariesTest::data(2, Beneficiary::SERIALIZE_DEFAULT),
            'total_without_taxes' => '470.25',
            'global_tax_regime' => null,
            'global_tax_exemption_code' => null,
            'global_tax_exemption_reason' => null,
            'total_taxes' => [
                [
                    'type' => TaxRegime::STANDARD->value,
                    'value' => '20.000',
                    'base' => '470.25',
                    'total' => '94.05',
                ],
            ],
            'total_with_taxes' => '564.30',
            'is_electronic' => true,
            'is_overdue' => false,
            'is_prepayment' => false,
            'is_prepayment_final' => false,
            'is_credit_note' => false,
            'is_cancelled' => false,
            'parent_estimate' => null,
            'parent_invoice' => null,
            'child_invoice' => null,
            'currency' => 'EUR',
            'lang' => 'en',
            'payments' => [],
            'created_at' => '2025-03-15 10:00:00',
        ]);
        $responseStream = $this->client->get('/invoices/8/pdf');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertMatchesHtmlSnapshot((string) $responseStream);

        // - Création avec une ligne exonérée.
        $this->client->post('/api/invoices', [
            'buyer_id' => 1,
            'lines' => [
                [
                    'uuid' => '93351d0b-5e59-4250-8da1-72b38bd727ac',
                    'is_service' => true,
                    'description' => 'Formation',
                    'quantity' => 1,
                    'unit_price' => '200.00',
                    'discount_rate' => '0',
                    'tax_regime' => TaxRegime::EXEMPTED->value,
                    'tax_exemption_code' => VatExemptionCodeEu::VATEX_EU_79_C->value,
                    'tax_id' => null,
                ],
            ],
            'global_discount_rate' => '0',
            'lang' => 'fr',
        ]);
        $this->assertStatusCode(StatusCode::STATUS_CREATED);
        $this->assertResponseData([
            'id' => 9,
            'format' => BillingFormat::current()->value,
            'order_number' => null,
            'status' => InvoiceStatus::DRAFT->value,
            'due_date' => null,
            'due_delay' => 15,
            'url' => [
                'pdf' => 'http://loxya.test/invoices/9/pdf',
                'ubl' => null,
            ],
            'buyer' => BeneficiariesTest::data(1, Beneficiary::SERIALIZE_DEFAULT),
            'total_without_taxes' => '200.00',
            'global_tax_regime' => null,
            'global_tax_exemption_code' => null,
            'global_tax_exemption_reason' => null,
            'total_taxes' => [
                [
                    'type' => TaxRegime::EXEMPTED->value,
                    'reason' => [VatExemptionCodeEu::VATEX_EU_79_C->value],
                    'base' => '200.00',
                ],
            ],
            'total_with_taxes' => '200.00',
            'is_electronic' => true,
            'is_overdue' => false,
            'is_prepayment' => false,
            'is_prepayment_final' => false,
            'is_credit_note' => false,
            'is_cancelled' => false,
            'parent_estimate' => null,
            'parent_invoice' => null,
            'child_invoice' => null,
            'currency' => 'EUR',
            'lang' => 'fr',
            'payments' => [],
            'created_at' => '2025-03-15 10:00:00',
        ]);
        $responseStream = $this->client->get('/invoices/9/pdf');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertMatchesHtmlSnapshot((string) $responseStream);
    }

    public function testDownloadPdf(): void
    {
        // - Si la facture n'existe pas...
        $this->client->get('/invoices/999/pdf');
        $this->assertStatusCode(StatusCode::STATUS_NOT_FOUND);

        // - Téléchargement du PDF de la facture #1 (format legacy).
        $responseStream = $this->client->get('/invoices/1/pdf');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertTrue($responseStream->isReadable());
        $this->assertMatchesHtmlSnapshot((string) $responseStream);

        // - Téléchargement du PDF de la facture #2.
        $responseStream = $this->client->get('/invoices/2/pdf');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertTrue($responseStream->isReadable());
        $this->assertMatchesHtmlSnapshot((string) $responseStream);
    }

    public function testAddPayment(): void
    {
        static::setNow(Carbon::create(2024, 2, 1, 9, 30, 0));

        // - Les factures "legacy" n'acceptent pas de paiements.
        $this->client->post('/api/invoices/1/payments', [
            'amount' => '80.50',
            'method' => PaymentMethod::CASH->value,
            'reference' => 'PAY-02',
        ]);
        $this->assertStatusCode(StatusCode::STATUS_UNPROCESSABLE_ENTITY);

        // - Une facture déjà intégralement payée n'accepte plus de paiement positif.
        $this->client->post('/api/invoices/2/payments', [
            'amount' => '100.00',
            'method' => PaymentMethod::CASH->value,
            'reference' => 'PAY-03',
        ]);
        $this->assertApiValidationError([
            'amount' => "The payment amount cannot exceed the remaining amount due.",
        ]);

        // - Une annulation partielle est acceptée sur une facture partiellement payée.
        $this->client->post('/api/invoices/6/payments', [
            'amount' => '-80.50',
            'method' => PaymentMethod::CASH->value,
            'reference' => 'PAY-02',
        ]);
        $this->assertStatusCode(StatusCode::STATUS_CREATED);
        $this->assertResponseData([
            'id' => 5,
            'date' => '2024-02-01 09:30:00',
            'method' => PaymentMethod::CASH->value,
            'amount' => '-80.50',
            'taxes_breakdown' => [
                ['rate' => '20.000', 'amount' => '-80.50'],
            ],
            'reference' => 'PAY-02',
        ]);

        // - Paiement partiel positif sur une facture avec plusieurs taux de T.V.A.:
        //   la ventilation est proportionnelle au restant dû par ligne de taxe.
        Invoice::findOrFail(5)->update(['status' => InvoiceStatus::SENT->value]);

        $this->client->post('/api/invoices/5/payments', [
            'amount' => '50.00',
            'method' => PaymentMethod::CARD->value,
            'reference' => 'PAY-04',
        ]);
        $this->assertStatusCode(StatusCode::STATUS_CREATED);
        $this->assertResponseData([
            'id' => 6,
            'date' => '2024-02-01 09:30:00',
            'method' => PaymentMethod::CARD->value,
            'amount' => '50.00',
            'taxes_breakdown' => [
                ['rate' => '20.000', 'amount' => '49.76'],
                ['rate' => '5.500', 'amount' => '0.24'],
            ],
            'reference' => 'PAY-04',
        ]);
    }

    public function testAddPaymentForbiddenForReadonly(): void
    {
        Auth\Test::$user = User::findOrFail(4);

        $this->client->post('/api/invoices/1/payments', [
            'amount' => '50.00',
        ]);
        $this->assertStatusCode(StatusCode::STATUS_FORBIDDEN);
    }

    public function testDelete(): void
    {
        // - Si la facture n'existe pas...
        $this->client->delete('/api/invoices/999');
        $this->assertStatusCode(StatusCode::STATUS_NOT_FOUND);

        // - Une facture finalisée ne peut pas être supprimée.
        $this->client->delete('/api/invoices/1');
        $this->assertStatusCode(StatusCode::STATUS_UNPROCESSABLE_ENTITY);
        $this->assertNotNull(Invoice::find(1));

        // - Un brouillon est supprimé définitivement directement.
        $invoice = Invoice::findOrFail(3);
        $invoice->status = InvoiceStatus::DRAFT->value;
        $invoice->saveQuietly(['validate' => false]);

        $this->client->delete('/api/invoices/3');
        $this->assertStatusCode(StatusCode::STATUS_NO_CONTENT);
        $this->assertNull(Invoice::withTrashed()->find(3));
    }
}
