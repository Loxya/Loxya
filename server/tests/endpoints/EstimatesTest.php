<?php
declare(strict_types=1);

namespace Loxya\Tests;

use Carbon\Carbon;
use Fig\Http\Message\StatusCodeInterface as StatusCode;
use Illuminate\Support\Collection;
use Loxya\Models\Beneficiary;
use Loxya\Models\Enums\BillingFormat;
use Loxya\Models\Enums\EstimateStatus;
use Loxya\Models\Enums\InvoiceStatus;
use Loxya\Models\Estimate;
use Loxya\Models\Invoice;
use Loxya\Support\Arr;
use Loxya\Support\Invoicing\TaxRegime;
use Loxya\Support\Invoicing\VatExemptionCode\VatExemptionCodeEu;
use PHPUnit\Framework\Attributes\DataProvider;

final class EstimatesTest extends ApiTestCase
{
    public static function data(?int $id = null, string $format = Estimate::SERIALIZE_DEFAULT)
    {
        $estimates = new Collection([
            [
                'id' => 1,
                'format' => BillingFormat::V3->value,
                'number' => 'D-2021-00001',
                'date' => '2021-01-30 14:00:00',
                'due_date' => null,
                'due_delay' => 30,
                'status' => EstimateStatus::PARTIALLY_INVOICED->value,
                'url' => 'http://loxya.test/estimates/1/pdf',
                'buyer' => BeneficiariesTest::data(1, Beneficiary::SERIALIZE_SUMMARY),
                'has_final_invoice' => false,
                'total_without_taxes' => '822.28',
                'global_tax_regime' => null,
                'global_tax_exemption_code' => null,
                'global_tax_exemption_reason' => null,
                'total_taxes' => [
                    [
                        'type' => TaxRegime::STANDARD->value,
                        'value' => '20.000',
                        'base' => '817.71',
                        'total' => '163.54',
                    ],
                    [
                        'type' => TaxRegime::STANDARD->value,
                        'value' => '5.500',
                        'base' => '4.57',
                        'total' => '0.25',
                    ],
                ],
                'total_with_taxes' => '986.07',
                'currency' => 'EUR',
                'lang' => 'en',
                'related_invoices' => static fn (): array => [
                    InvoicesTest::data(5, Invoice::SERIALIZE_EXCERPT),
                ],
                'created_at' => '2021-01-30 14:00:00',
            ],
            [
                'id' => 2,
                'format' => BillingFormat::V1->value,
                'date' => '2022-06-14 22:48:20',
                'due_date' => '2022-06-20',
                'due_delay' => null,
                'status' => EstimateStatus::EXPIRED->value,
                'url' => 'http://loxya.test/estimates/2/pdf',
                'buyer' => BeneficiariesTest::data(1, Beneficiary::SERIALIZE_SUMMARY),
                'has_final_invoice' => false,
                'total_without_taxes' => '550.28',
                'global_tax_regime' => null,
                'global_tax_exemption_code' => null,
                'global_tax_exemption_reason' => null,
                'total_taxes' => [],
                'total_with_taxes' => '550.28',
                'currency' => 'EUR',
                'lang' => 'fr',
                'related_invoices' => [],
                'created_at' => '2022-06-14 22:48:20',
            ],
            [
                'id' => 3,
                'format' => BillingFormat::V3->value,
                'number' => 'D-2026-00002',
                'date' => '2026-04-15 09:30:00',
                'due_date' => null,
                'due_delay' => 30,
                'status' => EstimateStatus::ACCEPTED->value,
                'url' => 'http://loxya.test/estimates/3/pdf',
                'buyer' => BeneficiariesTest::data(2, Beneficiary::SERIALIZE_SUMMARY),
                'has_final_invoice' => false,
                'total_without_taxes' => '-50.00',
                'global_tax_regime' => null,
                'global_tax_exemption_code' => null,
                'global_tax_exemption_reason' => null,
                'total_taxes' => [
                    [
                        'type' => TaxRegime::STANDARD->value,
                        'value' => '20.000',
                        'base' => '-50.00',
                        'total' => '-10.00',
                    ],
                ],
                'total_with_taxes' => '-60.00',
                'currency' => 'EUR',
                'lang' => 'fr',
                'related_invoices' => [],
                'created_at' => '2026-04-15 09:30:00',
            ],
            [
                'id' => 4,
                'format' => BillingFormat::V3->value,
                'number' => 'D-2026-00003',
                'date' => '2026-05-10 10:00:00',
                'due_date' => null,
                'due_delay' => 30,
                'status' => EstimateStatus::EXPIRED->value,
                'url' => 'http://loxya.test/estimates/4/pdf',
                'buyer' => BeneficiariesTest::data(2, Beneficiary::SERIALIZE_SUMMARY),
                'has_final_invoice' => false,
                'total_without_taxes' => '0.00',
                'global_tax_regime' => null,
                'global_tax_exemption_code' => null,
                'global_tax_exemption_reason' => null,
                'total_taxes' => [
                    [
                        'type' => TaxRegime::STANDARD->value,
                        'value' => '20.000',
                        'base' => '0.00',
                        'total' => '0.00',
                    ],
                ],
                'total_with_taxes' => '0.00',
                'currency' => 'EUR',
                'lang' => 'en',
                'related_invoices' => [],
                'created_at' => '2026-05-10 10:00:00',
            ],
            [
                'id' => 5,
                'format' => BillingFormat::V3->value,
                'number' => 'D-2026-00001',
                'date' => '2026-01-15 09:00:00',
                'due_date' => null,
                'due_delay' => 30,
                'status' => EstimateStatus::ACCEPTED->value,
                'url' => 'http://loxya.test/estimates/5/pdf',
                'buyer' => BeneficiariesTest::data(2, Beneficiary::SERIALIZE_SUMMARY),
                'has_final_invoice' => false,
                'total_without_taxes' => '1.44',
                'global_tax_regime' => null,
                'global_tax_exemption_code' => null,
                'global_tax_exemption_reason' => null,
                'total_taxes' => [
                    [
                        'type' => TaxRegime::STANDARD->value,
                        'value' => '20.000',
                        'base' => '1000.00',
                        'total' => '200.00',
                    ],
                    [
                        'type' => TaxRegime::STANDARD->value,
                        'value' => '10.000',
                        'base' => '-998.56',
                        'total' => '-99.86',
                    ],
                ],
                'total_with_taxes' => '101.58',
                'currency' => 'EUR',
                'lang' => 'fr',
                'related_invoices' => [],
                'created_at' => '2026-01-15 09:00:00',
            ],
        ]);

        $estimates = match ($format) {
            Estimate::SERIALIZE_EXCERPT => $estimates->map(static fn ($estimate) => (
                Arr::only($estimate, [
                    'id',
                    'format',
                    'status',
                    'number',
                    'date',
                    'url',
                    'has_final_invoice',
                    'total_without_taxes',
                    'global_tax_regime',
                    'global_tax_exemption_code',
                    'global_tax_exemption_reason',
                    'total_taxes',
                    'total_with_taxes',
                    'currency',
                    'created_at',
                ])
            )),
            Estimate::SERIALIZE_DEFAULT => $estimates,
            Estimate::SERIALIZE_DETAILS => $estimates->map(static fn ($estimate) => (
                array_replace($estimate, [
                    'buyer' => BeneficiariesTest::data(
                        $estimate['buyer']['id'],
                        Beneficiary::SERIALIZE_DEFAULT,
                    ),
                ])
            )),
            default => throw new \InvalidArgumentException(sprintf("Unknown format \"%s\"", $format)),
        };

        return static::dataFactory($id, $estimates->all());
    }

    public function testGetAll(): void
    {
        // - Test simple.
        $this->client->get('/api/estimates');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponsePaginatedData(5, [
            self::data(4),
            self::data(3),
            self::data(5),
            self::data(2),
            self::data(1),
        ]);

        // - Test avec recherche sur le nom du bénéficiaire.
        $this->client->get('/api/estimates', ['search' => 'Fount']);
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponsePaginatedData(2, [
            self::data(2),
            self::data(1),
        ]);
    }

    #[DataProvider('feedGetAllWithFilters')]
    public function testGetAllWithFilters(array $filtersQuery, array $expectedIds): void
    {
        $this->client->get('/api/estimates', $filtersQuery);
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponsePaginatedData(count($expectedIds));
        foreach ($expectedIds as $index => $expectedId) {
            $this->assertResponseHasKeyEquals(sprintf('data.%d.id', $index), $expectedId);
        }
    }

    public static function feedGetAllWithFilters(): array
    {
        return [
            [
                [
                    'status' => 'expired',
                    'date' => '2021-01-28',
                    'dueDate' => '2021-01-28',
                ],
                [],
            ],
            [['status' => 'expired'], [4, 2]],
            [['status' => 'sent'], []],
            [['status' => 'accepted'], [3, 5]],
            [['status' => 'partially-invoiced'], [1]],
            [['date' => ['operator' => '<', 'value' => '2022-01-01']], [1]],
            [['date' => ['operator' => '>', 'value' => '2022-01-01']], [4, 3, 5, 2]],
            [['date' => ['operator' => '=', 'value' => '2021-01-30']], [1]],
            [['date' => '2021-01-30'], [1]],
            [
                [
                    'status' => 'accepted',
                    'date' => ['operator' => '>', 'value' => '2021-01-29'],
                ],
                [3, 5],
            ],
            [
                [
                    'date' => ['operator' => '<', 'value' => '2022-06-21'],
                    'dueDate' => ['operator' => '<', 'value' => '2022-06-21'],
                ],
                [2],
            ],
            [['amount' => ['operator' => '>', 'value' => '100']], [2, 1]],
            [['amount' => ['operator' => '<', 'value' => '800']], [4, 3, 5, 2]],
        ];
    }

    public function testCreate(): void
    {
        static::setNow(Carbon::parse('2026-05-15 10:00:00'));

        $sampleLine = [
            'uuid' => 'b0fca9e2-f1e8-4ef8-921d-82c3dfadcb85',
            'is_service' => true,
            'description' => 'Test',
            'quantity' => 1,
            'unit_price' => '100.00',
            'discount_rate' => '0',
            'tax_regime' => TaxRegime::STANDARD->value,
            'tax_exemption_code' => null,
            'tax_id' => 1,
        ];

        // - Sans données.
        $this->client->post('/api/estimates');
        $this->assertStatusCode(StatusCode::STATUS_BAD_REQUEST);

        // - Sans acheteur.
        $this->client->post('/api/estimates', [
            'lines' => [$sampleLine],
            'global_discount_rate' => '0',
        ]);
        $this->assertApiValidationError(['buyer_id' => "This field is mandatory."]);

        // - Avec un acheteur inexistant.
        $this->client->post('/api/estimates', [
            'buyer_id' => 999,
            'lines' => [$sampleLine],
            'global_discount_rate' => '0',
        ]);
        $this->assertApiValidationError(['buyer_id' => "This field is invalid."]);

        // - Avec des lignes vides et une remise globale invalide.
        $this->client->post('/api/estimates', [
            'buyer_id' => 1,
            'lines' => [],
            'global_discount_rate' => '150',
        ]);
        $this->assertApiValidationError([
            'global_discount_rate' => 'This field is invalid.',
            'lines' => 'This field is mandatory.',
        ]);

        // - Avec plusieurs champs invalides sur une même ligne.
        $this->client->post('/api/estimates', [
            'buyer_id' => 1,
            'lines' => [
                array_replace($sampleLine, [
                    'uuid' => 'not-a-uuid',
                    'quantity' => 0,
                    'unit_price' => 'not-a-number',
                    'discount_rate' => '150',
                    'tax_id' => 999,
                ]),
            ],
            'global_discount_rate' => '0',
        ]);
        $this->assertApiValidationError([
            'lines' => [
                0 => [
                    'discount_rate' => 'This field is invalid.',
                    'quantity' => 'Must be greater than or equal to 1.',
                    'tax_id' => 'This field is invalid.',
                    'unit_price' => 'This field is invalid.',
                    'uuid' => 'This unique identifier (UUID) is invalid.',
                ],
            ],
        ]);

        // - Avec des erreurs réparties sur plusieurs lignes.
        $this->client->post('/api/estimates', [
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
        $this->client->post('/api/estimates', [
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
            'id' => 6,
            'format' => BillingFormat::current()->value,
            'status' => EstimateStatus::DRAFT->value,
            'due_date' => null,
            'due_delay' => 15,
            'url' => 'http://loxya.test/estimates/6/pdf',
            'buyer' => BeneficiariesTest::data(1, Beneficiary::SERIALIZE_DEFAULT),
            'has_final_invoice' => false,
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
            'related_invoices' => [],
            'currency' => 'EUR',
            'lang' => 'en',
            'created_at' => '2026-05-15 10:00:00',
        ]);
        $responseStream = $this->client->get('/estimates/6/pdf');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertMatchesHtmlSnapshot((string) $responseStream);

        // - Création avec plusieurs lignes, remise globale, etc.
        $this->client->post('/api/estimates', [
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
            'due_date' => '2026-06-10',
            'special_mentions' => 'Merci pour votre confiance.',
            'lang' => 'en',
        ]);
        $this->assertStatusCode(StatusCode::STATUS_CREATED);
        $this->assertResponseData([
            'id' => 7,
            'format' => BillingFormat::current()->value,
            'status' => EstimateStatus::DRAFT->value,
            'due_date' => '2026-06-10',
            'due_delay' => null,
            'url' => 'http://loxya.test/estimates/7/pdf',
            'buyer' => BeneficiariesTest::data(2, Beneficiary::SERIALIZE_DEFAULT),
            'has_final_invoice' => false,
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
            'related_invoices' => [],
            'currency' => 'EUR',
            'lang' => 'en',
            'created_at' => '2026-05-15 10:00:00',
        ]);
        $responseStream = $this->client->get('/estimates/7/pdf');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertMatchesHtmlSnapshot((string) $responseStream);

        // - Création avec une ligne exonérée.
        $this->client->post('/api/estimates', [
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
        ]);
        $this->assertStatusCode(StatusCode::STATUS_CREATED);
        $this->assertResponseData([
            'id' => 8,
            'format' => BillingFormat::current()->value,
            'status' => EstimateStatus::DRAFT->value,
            'due_date' => null,
            'due_delay' => 15,
            'url' => 'http://loxya.test/estimates/8/pdf',
            'buyer' => BeneficiariesTest::data(1, Beneficiary::SERIALIZE_DEFAULT),
            'has_final_invoice' => false,
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
            'related_invoices' => [],
            'currency' => 'EUR',
            'lang' => 'en',
            'created_at' => '2026-05-15 10:00:00',
        ]);
        $responseStream = $this->client->get('/estimates/8/pdf');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertMatchesHtmlSnapshot((string) $responseStream);
    }

    public function testCreateInvoiceWithPrepayment(): void
    {
        static::setNow(Carbon::parse('2022-10-22 18:42:36'));

        $this->client->post('/api/estimates/1/invoices', [
            'amount' => 200,
            'due_date' => '2022-10-22',
        ]);
        $this->assertStatusCode(StatusCode::STATUS_CREATED);
        $this->assertResponseData([
            'id' => 7,
            'format' => BillingFormat::V3->value,
            'number' => '2022-00001',
            'order_number' => null,
            'status' => InvoiceStatus::PENDING->value,
            'date' => '2022-10-22 18:42:36',
            'due_date' => '2022-10-22',
            'due_delay' => null,
            'url' => [
                'pdf' => 'http://loxya.test/invoices/7/pdf',
                'ubl' => 'http://loxya.test/invoices/7/ubl',
            ],
            'buyer' => BeneficiariesTest::data(1, Beneficiary::SERIALIZE_DEFAULT),
            'total_without_taxes' => '166.78',
            'global_tax_regime' => null,
            'global_tax_exemption_code' => null,
            'global_tax_exemption_reason' => null,
            'total_taxes' => [
                [
                    'base' => '165.85',
                    'type' => TaxRegime::STANDARD->value,
                    'total' => '33.17',
                    'value' => '20.000',
                ],
                [
                    'base' => '0.93',
                    'type' => TaxRegime::STANDARD->value,
                    'total' => '0.05',
                    'value' => '5.500',
                ],
            ],
            'total_with_taxes' => '200.00',
            'is_electronic' => true,
            'is_overdue' => false,
            'is_prepayment' => true,
            'is_prepayment_final' => false,
            'is_credit_note' => false,
            'is_cancelled' => false,
            'parent_estimate' => EstimatesTest::data(1, Estimate::SERIALIZE_EXCERPT),
            'parent_invoice' => null,
            'child_invoice' => null,
            'currency' => 'EUR',
            'lang' => 'en',
            'payments' => [],
            'created_at' => '2022-10-22 18:42:36',
        ]);
    }

    public function testCreateInvoiceWithoutPrepayment(): void
    {
        static::setNow(Carbon::parse('2022-10-22 18:42:36'));

        // - On supprime la facture d'acompte pour le test.
        Invoice::findOrFail(5)->forceDeleteQuietly();

        $this->client->post('/api/estimates/1/invoices', [
            'due_date' => '2022-10-22',
        ]);
        $this->assertStatusCode(StatusCode::STATUS_CREATED);
        $this->assertResponseData([
            'id' => 7,
            'format' => BillingFormat::V3->value,
            'number' => '2022-00001',
            'order_number' => null,
            'status' => InvoiceStatus::PENDING->value,
            'date' => '2022-10-22 18:42:36',
            'due_date' => '2022-10-22',
            'due_delay' => null,
            'url' => [
                'pdf' => 'http://loxya.test/invoices/7/pdf',
                'ubl' => 'http://loxya.test/invoices/7/ubl',
            ],
            'buyer' => BeneficiariesTest::data(1, Beneficiary::SERIALIZE_DEFAULT),
            'total_without_taxes' => '822.28',
            'global_tax_regime' => null,
            'global_tax_exemption_code' => null,
            'global_tax_exemption_reason' => null,
            'total_taxes' => [
                [
                    'type' => TaxRegime::STANDARD->value,
                    'value' => '20.000',
                    'base' => '817.71',
                    'total' => '163.54',
                ],
                [
                    'type' => TaxRegime::STANDARD->value,
                    'value' => '5.500',
                    'base' => '4.57',
                    'total' => '0.25',
                ],
            ],
            'total_with_taxes' => '986.07',
            'is_electronic' => true,
            'is_overdue' => false,
            'is_prepayment' => false,
            'is_prepayment_final' => false,
            'is_credit_note' => false,
            'is_cancelled' => false,
            'parent_estimate' => array_replace(
                EstimatesTest::data(1, Estimate::SERIALIZE_EXCERPT),
                [
                    'status' => EstimateStatus::INVOICED->value,
                    'has_final_invoice' => true,
                ],
            ),
            'parent_invoice' => null,
            'child_invoice' => null,
            'currency' => 'EUR',
            'lang' => 'en',
            'payments' => [],
            'created_at' => '2022-10-22 18:42:36',
        ]);
    }

    public function testCreateInvoiceAfterPrepayment(): void
    {
        static::setNow(Carbon::parse('2022-10-22 18:42:36'));

        // - On ajoute un autre acompte de 481.65€ TTC.
        //   (sachant qu'il existe déjà un acompte de 100€)
        $this->client->post('/api/estimates/1/invoices', [
            'amount' => '481.65',
            'due_date' => '2022-10-22',
        ]);
        $this->assertStatusCode(StatusCode::STATUS_CREATED);

        // - Puis la facture de solde.
        static::setNow(Carbon::parse('2022-10-22 19:00:00'));
        $this->client->post('/api/estimates/1/invoices', [
            'due_date' => '2022-11-22',
        ]);
        $this->assertStatusCode(StatusCode::STATUS_CREATED);
        $this->assertResponseData([
            'id' => 8,
            'format' => BillingFormat::V3->value,
            'number' => '2022-00002',
            'order_number' => null,
            'status' => InvoiceStatus::PENDING->value,
            'date' => '2022-10-22 19:00:00',
            'due_date' => '2022-11-22',
            'due_delay' => null,
            'url' => [
                'pdf' => 'http://loxya.test/invoices/8/pdf',
                'ubl' => 'http://loxya.test/invoices/8/ubl',
            ],
            'buyer' => BeneficiariesTest::data(1, Beneficiary::SERIALIZE_DEFAULT),
            'total_without_taxes' => '337.24',
            'global_tax_regime' => null,
            'global_tax_exemption_code' => null,
            'global_tax_exemption_reason' => null,
            'total_taxes' => [
                [
                    'type' => TaxRegime::STANDARD->value,
                    'value' => '20.000',
                    'base' => '335.36',
                    'total' => '67.07',
                ],
                [
                    'type' => TaxRegime::STANDARD->value,
                    'value' => '5.500',
                    'base' => '1.88',
                    'total' => '0.10',
                ],
            ],
            'total_with_taxes' => '404.41',
            'is_electronic' => true,
            'is_overdue' => false,
            'is_prepayment' => false,
            'is_prepayment_final' => true,
            'is_credit_note' => false,
            'is_cancelled' => false,
            'parent_estimate' => array_replace(
                EstimatesTest::data(1, Estimate::SERIALIZE_EXCERPT),
                [
                    'status' => EstimateStatus::INVOICED->value,
                    'has_final_invoice' => true,
                ],
            ),
            'parent_invoice' => null,
            'child_invoice' => null,
            'prepayment_invoices' => [
                InvoicesTest::data(5, Invoice::SERIALIZE_EXCERPT),
                [
                    'id' => 7,
                    'format' => BillingFormat::V3->value,
                    'number' => '2022-00001',
                    'status' => InvoiceStatus::PENDING->value,
                    'date' => '2022-10-22 18:42:36',
                    'url' => [
                        'pdf' => 'http://loxya.test/invoices/7/pdf',
                        'ubl' => 'http://loxya.test/invoices/7/ubl',
                    ],
                    'total_without_taxes' => '401.65',
                    'global_tax_regime' => null,
                    'global_tax_exemption_code' => null,
                    'global_tax_exemption_reason' => null,
                    'total_taxes' => [
                        [
                            'type' => TaxRegime::STANDARD->value,
                            'value' => '20.000',
                            'base' => '399.42',
                            'total' => '79.88',
                        ],
                        [
                            'type' => TaxRegime::STANDARD->value,
                            'value' => '5.500',
                            'base' => '2.23',
                            'total' => '0.12',
                        ],
                    ],
                    'total_with_taxes' => '481.65',
                    'is_prepayment' => true,
                    'is_credit_note' => false,
                    'is_cancelled' => false,
                    'is_overdue' => false,
                    'currency' => 'EUR',
                    'created_at' => '2022-10-22 18:42:36',
                ],
            ],
            'currency' => 'EUR',
            'lang' => 'en',
            'payments' => [],
            'created_at' => '2022-10-22 19:00:00',
        ]);
    }

    public function testCreateInvoiceFromNegativeEstimate(): void
    {
        static::setNow(Carbon::parse('2026-10-22 18:42:36'));

        // - Devis négatif.
        $this->client->post('/api/estimates/3/invoices');
        $this->assertStatusCode(StatusCode::STATUS_CREATED);
        $this->assertResponseData([
            'id' => 7,
            'format' => BillingFormat::V3->value,
            'number' => '2026-00001',
            'order_number' => null,
            'status' => InvoiceStatus::PENDING->value,
            'date' => '2026-10-22 18:42:36',
            'due_date' => null,
            'due_delay' => 15,
            'url' => [
                'pdf' => 'http://loxya.test/invoices/7/pdf',
                'ubl' => null,
            ],
            'buyer' => BeneficiariesTest::data(2, Beneficiary::SERIALIZE_DEFAULT),
            'total_without_taxes' => '-50.00',
            'global_tax_regime' => null,
            'global_tax_exemption_code' => null,
            'global_tax_exemption_reason' => null,
            'total_taxes' => [
                [
                    'type' => TaxRegime::STANDARD->value,
                    'value' => '20.000',
                    'base' => '-50.00',
                    'total' => '-10.00',
                ],
            ],
            'total_with_taxes' => '-60.00',
            'is_electronic' => true,
            'is_overdue' => false,
            'is_prepayment' => false,
            'is_prepayment_final' => false,
            'is_credit_note' => false,
            'is_cancelled' => false,
            'parent_estimate' => array_replace(
                EstimatesTest::data(3, Estimate::SERIALIZE_EXCERPT),
                [
                    'status' => EstimateStatus::INVOICED->value,
                    'has_final_invoice' => true,
                ],
            ),
            'parent_invoice' => null,
            'child_invoice' => null,
            'currency' => 'EUR',
            'lang' => 'fr',
            'payments' => [],
            'created_at' => '2026-10-22 18:42:36',
        ]);

        // - Devis à zéro.
        $this->client->post('/api/estimates/4/invoices');
        $this->assertStatusCode(StatusCode::STATUS_CREATED);
        $this->assertResponseData([
            'id' => 8,
            'format' => BillingFormat::V3->value,
            'number' => '2026-00002',
            'order_number' => null,
            'status' => InvoiceStatus::PENDING->value,
            'date' => '2026-10-22 18:42:36',
            'due_date' => null,
            'due_delay' => 15,
            'url' => [
                'pdf' => 'http://loxya.test/invoices/8/pdf',
                'ubl' => null,
            ],
            'buyer' => BeneficiariesTest::data(2, Beneficiary::SERIALIZE_DEFAULT),
            'total_without_taxes' => '0.00',
            'global_tax_regime' => null,
            'global_tax_exemption_code' => null,
            'global_tax_exemption_reason' => null,
            'total_taxes' => [
                [
                    'type' => TaxRegime::STANDARD->value,
                    'value' => '20.000',
                    'base' => '0.00',
                    'total' => '0.00',
                ],
            ],
            'total_with_taxes' => '0.00',
            'is_electronic' => true,
            'is_overdue' => false,
            'is_prepayment' => false,
            'is_prepayment_final' => false,
            'is_credit_note' => false,
            'is_cancelled' => false,
            'parent_estimate' => array_replace(
                EstimatesTest::data(4, Estimate::SERIALIZE_EXCERPT),
                [
                    'status' => EstimateStatus::INVOICED->value,
                    'has_final_invoice' => true,
                ],
            ),
            'parent_invoice' => null,
            'child_invoice' => null,
            'currency' => 'EUR',
            'lang' => 'en',
            'payments' => [],
            'created_at' => '2026-10-22 18:42:36',
        ]);
    }

    public function testCreateInvoiceWithInvalidData(): void
    {
        static::setNow(Carbon::parse('2026-10-22 18:42:36'));

        // - Avec un montant d'acompte négatif.
        $this->client->post('/api/estimates/1/invoices', ['amount' => -10]);
        $this->assertApiValidationError([
            'amount' => "Must be positive.",
        ]);

        // - Avec un acompte sur un devis négatif.
        $this->client->post('/api/estimates/3/invoices', ['amount' => 20]);
        $this->assertStatusCode(StatusCode::STATUS_UNPROCESSABLE_ENTITY);
        $this->assertApiErrorMessage("Cannot create a prepayment invoice for a negative or zero estimate.");

        // - Avec un acompte sur un devis à zéro.
        $this->client->post('/api/estimates/4/invoices', ['amount' => 20]);
        $this->assertStatusCode(StatusCode::STATUS_UNPROCESSABLE_ENTITY);
        $this->assertApiErrorMessage("Cannot create a prepayment invoice for a negative or zero estimate.");
    }

    public function testGetOne(): void
    {
        // - Avec un devis inexistant.
        $this->client->get('/api/estimates/999');
        $this->assertStatusCode(StatusCode::STATUS_NOT_FOUND);

        // - Avec des devis valides.
        $ids = array_column(static::data(null), 'id');
        foreach ($ids as $id) {
            $this->client->get(sprintf('/api/estimates/%d', $id));
            $this->assertStatusCode(StatusCode::STATUS_OK);
            $this->assertResponseData(self::data($id, Estimate::SERIALIZE_DETAILS));
        }
    }

    public function testUpdateStatus(): void
    {
        // - Si le devis n'existe pas...
        $this->client->put('/api/estimates/999/status', [
            'status' => EstimateStatus::ACCEPTED->value,
        ]);
        $this->assertStatusCode(StatusCode::STATUS_NOT_FOUND);

        // - Avec un statut invalide...
        foreach (['__unknown__', EstimateStatus::EXPIRED->value] as $wrongStatus) {
            $this->client->put('/api/estimates/1/status', [
                'status' => $wrongStatus,
            ]);
            $this->assertStatusCode(StatusCode::STATUS_BAD_REQUEST);
        }

        // - Avec un statut valide.
        $this->client->put('/api/estimates/1/status', [
            'status' => EstimateStatus::ACCEPTED->value,
        ]);
        $this->assertStatusCode(StatusCode::STATUS_OK);
    }

    public function testDelete(): void
    {
        // - Un devis lié à au moins une facture ne peut pas être supprimé.
        $this->client->delete('/api/estimates/1');
        $this->assertStatusCode(StatusCode::STATUS_CONFLICT);

        // - Premier appel : Suppression "soft".
        $this->client->delete('/api/estimates/2');
        $this->assertStatusCode(StatusCode::STATUS_NO_CONTENT);
        $softDeleted = Estimate::withTrashed()->find(2);
        $this->assertNotNull($softDeleted);
        $this->assertNotEmpty($softDeleted->deleted_at);

        // - Deuxième appel : Suppression définitive de l'enregistrement en base.
        $this->client->delete('/api/estimates/2');
        $this->assertStatusCode(StatusCode::STATUS_NO_CONTENT);
        $this->assertNull(Estimate::withTrashed()->find(2));

        // - Un brouillon est supprimé définitivement directement.
        $estimate = Estimate::findOrFail(3);
        $estimate->status = EstimateStatus::DRAFT->value;
        $estimate->saveQuietly(['validate' => false]);

        $this->client->delete('/api/estimates/3');
        $this->assertStatusCode(StatusCode::STATUS_NO_CONTENT);
        $this->assertNull(Estimate::withTrashed()->find(3));
    }

    public function testDownloadPdf(): void
    {
        // - Si le devis n'existe pas...
        $this->client->get('/estimates/999/pdf');
        $this->assertStatusCode(StatusCode::STATUS_NOT_FOUND);

        // - Télécharge le PDF du devis #1.
        $responseStream = $this->client->get('/estimates/1/pdf');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertTrue($responseStream->isReadable());
        $this->assertMatchesHtmlSnapshot((string) $responseStream);

        // - Téléchargement du PDF du devis #2 (format legacy).
        $responseStream = $this->client->get('/estimates/2/pdf');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertTrue($responseStream->isReadable());
        $this->assertMatchesHtmlSnapshot((string) $responseStream);
    }
}
