<?php
declare(strict_types=1);

namespace Loxya\Tests;

use Brick\Math\BigDecimal as Decimal;
use Illuminate\Support\Carbon;
use Loxya\Models\Beneficiary;
use Loxya\Models\Enums\BillingFormat;
use Loxya\Models\Enums\EstimateStatus;
use Loxya\Models\Enums\LegalEntityType;
use Loxya\Models\Estimate;
use Loxya\Models\Event;
use Loxya\Models\Setting;
use Loxya\Models\User;
use Loxya\Support\Invoicing\TaxRegime;
use Loxya\Support\Invoicing\VatExemptionCode\VatExemptionCodeEu;
use Loxya\Support\Invoicing\VatExemptionCode\VatExemptionCodeFr;
use Loxya\Support\Pdf\Pdf;
use Loxya\Support\Period;
use Loxya\Support\Str;

final class EstimateTest extends TestCase
{
    public function testValidation(): void
    {
        $estimate = tap(new Estimate(), static function (Estimate $estimate) {
            $estimate->status = EstimateStatus::PENDING->value;
            $estimate->fill([
                'date' => '',
                'booking_start_date' => null,
                'booking_end_date' => null,
                'global_tax_regime' => TaxRegime::EXEMPTED->value,
                'global_tax_exemption_reason' => 'Exempté.',
                'total_without_taxes' => '1000000000000.00',
                'total_replacement' => '-20.00',
                'currency' => 'a',
            ]);
            $estimate->booking()->associate(Event::findOrFail(1));
            $estimate->buyer()->associate(Beneficiary::findOrFail(1));
        });
        $expectedErrors = [
            'number' => 'Ce champ est obligatoire.',
            'date' => "Ce champ est obligatoire.",
            'due_date' => "Une date d'échéance ou un délai de paiement est requis.",
            'seller_legal_name' => 'Ce champ est obligatoire.',
            'seller_registration_id' => 'Ce champ est obligatoire.',
            'seller_country' => 'Ce champ est obligatoire.',
            'buyer_type' => 'La valeur est invalide.',
            'buyer_is_public_entity' => 'Ce champ doit être un booléen.',
            'buyer_country' => 'Ce champ est obligatoire.',
            'total_replacement' => "Ce champ est invalide.",
            'currency' => 'Ce champ est invalide.',
            'booking_start_date' => "Ce champ est obligatoire.",
            'booking_end_date' => "Ce champ est obligatoire.",
            'booking_is_full_days' => "Ce champ doit être un booléen.",
            'is_vat_due_on_invoice' => 'Ce champ doit être un booléen.',
            'total_without_global_discount' => "Ce champ doit contenir un chiffre à virgule.",
            'global_discount_rate' => "Ce champ doit contenir un chiffre à virgule.",
            'total_global_discount' => "Ce champ doit contenir un chiffre à virgule.",
            'total_without_taxes' => "Ce champ est invalide.",
            'total_with_taxes' => "Ce champ doit contenir un chiffre à virgule.",
        ];
        $this->assertFalse($estimate->isValid());
        $this->assertSameCanonicalize($expectedErrors, $estimate->validationErrors());

        // - Test de validation de la date d'échéance
        $estimate = tap(new Estimate(), static function (Estimate $estimate) {
            $estimate->status = EstimateStatus::PENDING->value;
            $estimate->fill([
                'date' => '2024-01-19 16:00:00',
                'due_date' => '2024-01-18',
                'seller_legal_name' => "Testing corp.",
                'seller_registration_id' => '54321008020145',
                'seller_street' => '5 rue des tests',
                'seller_additional_street' => null,
                'seller_postal_code' => '05555',
                'seller_administrative_area' => null,
                'seller_locality' => 'Testville',
                'seller_country' => 'FR',
                'buyer_type' => LegalEntityType::INDIVIDUAL->value,
                'buyer_is_public_entity' => false,
                'buyer_first_name' => 'Marc',
                'buyer_last_name' => 'Test',
                'buyer_country' => 'FR',
                'booking_period' => new Period('2018-12-17', '2018-12-18', true),
                'is_vat_due_on_invoice' => false,
                'total_without_global_discount' => '1750.00',
                'global_discount_rate' => '100.00',
                'global_discount_breakdown' => [
                    [
                        'base' => '1750.00',
                        'value' => '1750.00',
                        'total' => '0.00',
                        'tax' => [
                            'type' => TaxRegime::EXEMPTED->value,
                            'reason' => [],
                        ],
                    ],
                ],
                'total_global_discount' => '1750.00',
                'total_without_taxes' => '0.00',
                'global_tax_regime' => TaxRegime::EXEMPTED->value,
                'global_tax_exemption_reason' => 'Exempté.',
                'total_taxes' => null,
                'total_with_taxes' => '0.00',
                'currency' => 'EUR',
                'lang' => 'fr',
                'total_replacement' => '2000.00',
            ]);
            $estimate->booking()->associate(Event::findOrFail(1));
            $estimate->buyer()->associate(Beneficiary::findOrFail(1));
        });
        $expectedErrors = [
            'number' => 'Ce champ est obligatoire.',
            'due_date' => "La date d'échéance doit être postérieure à la date du devis.",
        ];
        $this->assertFalse($estimate->isValid());
        $this->assertSameCanonicalize($expectedErrors, $estimate->validationErrors());

        // - Test de validation du taux de remise.
        $estimate = tap(new Estimate(), static function (Estimate $estimate) {
            $estimate->status = EstimateStatus::PENDING->value;
            $estimate->fill([
                'number' => 'D-2024-00001',
                'date' => '2024-01-19 16:00:00',
                'due_date' => '2024-01-19',
                'seller_legal_name' => "Testing corp.",
                'seller_registration_id' => '54321008020145',
                'seller_street' => '5 rue des tests',
                'seller_additional_street' => null,
                'seller_postal_code' => '05555',
                'seller_administrative_area' => null,
                'seller_locality' => 'Testville',
                'seller_country' => 'FR',
                'buyer_type' => LegalEntityType::INDIVIDUAL->value,
                'buyer_is_public_entity' => false,
                'buyer_first_name' => 'Marc',
                'buyer_last_name' => 'Test',
                'buyer_country' => 'FR',
                'booking_period' => new Period('2018-12-17', '2018-12-18', true),
                'is_vat_due_on_invoice' => true,
                'total_without_global_discount' => '1750.00',
                'global_discount_rate' => '100.00',
                'global_discount_breakdown' => [
                    [
                        'base' => '1750.00',
                        'value' => '1750.00',
                        'total' => '0.00',
                        'tax' => [
                            'type' => TaxRegime::EXEMPTED->value,
                            'reason' => [],
                        ],
                    ],
                ],
                'total_global_discount' => '1750.00',
                'total_without_taxes' => '0.00',
                'global_tax_regime' => TaxRegime::EXEMPTED->value,
                'global_tax_exemption_reason' => 'Exempté.',
                'total_taxes' => null,
                'total_with_taxes' => '0.00',
                'currency' => 'EUR',
                'lang' => 'fr',
                'total_replacement' => '2000.00',
            ]);
            $estimate->booking()->associate(Event::findOrFail(1));
            $estimate->buyer()->associate(Beneficiary::findOrFail(1));
        });
        $this->assertTrue($estimate->isValid());
    }

    public function testStatusAttribute(): void
    {
        $estimate = Estimate::findOrFail(2);

        static::setNow(Carbon::create(2022, 06, 19));

        // - Si on est avant la date d'échéance du devis, son statut n'est pas "expiré".
        $this->assertNotSame($estimate->status, EstimateStatus::EXPIRED->value);

        static::setNow(Carbon::create(2022, 06, 21));

        // - Si on est a dépassé la date d'échéance du devis, son statut est "expiré".
        $this->assertSame($estimate->status, EstimateStatus::EXPIRED->value);
    }

    public function testCreateFromEvent(): void
    {
        static::setNow(Carbon::create(2022, 10, 22, 18, 42, 36));

        // - Avec un événement au jour entier.
        $event = tap(Event::findOrFail(2), static function ($event) {
            $event->global_discount_rate = Decimal::of('1.3923');
        });
        $firstUuid = Str::freezeUuids();
        $result = Estimate::createFromBooking($event, User::findOrFail(1));
        Str::createUuidsNormally();
        $expected = [
            'id' => 6,
            'format' => BillingFormat::current()->value,
            'uuid' => (string) $firstUuid,
            'number' => null,
            'date' => null,
            'due_date' => null,
            'due_delay' => 15,
            'status' => EstimateStatus::DRAFT->value,
            'url' => 'http://loxya.test/estimates/6/pdf',

            'seller_legal_name' => 'Testing corp.',
            'seller_registration_id' => '54321008020145',
            'seller_vat_number' => 'FR85543210080',
            'seller_legal_type' => 'FR.SARL',
            'seller_share_capital' => '1000.00',
            'seller_activity_code' => '7729Z',
            'seller_trade_registry_city' => 'TestGrandeVille',
            'seller_street' => '5 rue des tests',
            'seller_additional_street' => null,
            'seller_postal_code' => '05555',
            'seller_administrative_area' => null,
            'seller_locality' => 'Testville',
            'seller_country' => 'FR',
            'seller_email' => 'contact@testing-corp.dev',
            'seller_phone' => '+33123456789',

            'buyer_id' => 3,
            'buyer_type' => LegalEntityType::INDIVIDUAL->value,
            'buyer_reference' => '0003',
            'buyer_legal_name' => null,
            'buyer_is_public_entity' => false,
            'buyer_registration_id' => null,
            'buyer_vat_number' => null,
            'buyer_service_code' => null,
            'buyer_first_name' => 'Élise',
            'buyer_last_name' => 'Faure',
            'buyer_street' => '156 bis, avenue des tests poussés',
            'buyer_additional_street' => 'Étage 3, Porte 2',
            'buyer_postal_code' => '88080',
            'buyer_administrative_area' => null,
            'buyer_locality' => 'Wazzaville',
            'buyer_country' => 'FR',
            'buyer_email' => 'elise@loxya.fr',
            'buyer_phone' => '+3211223344',

            'booking_type' => Event::TYPE,
            'booking_id' => 2,
            'booking_title' => 'Second événement',
            'booking_reference' => null,
            'booking_start_date' => '2018-12-18 00:00:00',
            'booking_end_date' => '2018-12-20 00:00:00',
            'booking_is_full_days' => true,

            'is_vat_due_on_invoice' => true,
            'has_final_invoice' => false,
            'degressive_rate' => null,
            'daily_total' => null,

            'materials' => [
                [
                    'id' => 7,
                    'estimate_id' => 6,
                    'material_id' => 2,
                    'name' => 'Processeur DBX PA2',
                    'reference' => 'DBXPA2',
                    'description' => "Système de diffusion numérique",
                    'quantity' => 2,
                    'unit_price' => '25.50',
                    'degressive_rate' => '1.75',
                    'unit_price_period' => '44.63',
                    'total_without_discount' => '89.26',
                    'discount_rate' => '10.0000',
                    'total_discount' => '8.93',
                    'total_without_taxes' => '80.33',
                    'tax_regime' => TaxRegime::STANDARD->value,
                    'tax_exemption_code' => null,
                    'taxes' => [
                        ['value' => '20.000'],
                    ],
                    'unit_replacement_price' => '349.90',
                    'total_replacement_price' => '699.80',
                    'is_hidden_on_bill' => false,
                ],
                [
                    'id' => 8,
                    'estimate_id' => 6,
                    'material_id' => 1,
                    'name' => 'Yamaha CL3',
                    'reference' => 'CL-3',
                    'description' => "Console numérique 64 entrées / 8 sorties + Master + Sub",
                    'quantity' => 3,
                    'unit_price' => '300.00',
                    'degressive_rate' => '2.00',
                    'unit_price_period' => '600.00',
                    'total_without_discount' => '1800.00',
                    'discount_rate' => '0.0000',
                    'total_discount' => '0.00',
                    'total_without_taxes' => '1800.00',
                    'tax_regime' => TaxRegime::STANDARD->value,
                    'tax_exemption_code' => null,
                    'taxes' => [
                        ['value' => '20.000'],
                    ],
                    'unit_replacement_price' => '19400.00',
                    'total_replacement_price' => '58200.00',
                    'is_hidden_on_bill' => false,
                ],
            ],
            'extras' => [
                [
                    'id' => 6,
                    'estimate_id' => 6,
                    'is_service' => true,
                    'description' => "Services additionnels",
                    'quantity' => 2,
                    'unit_price' => '155.00',
                    'total_without_discount' => '310.00',
                    'discount_rate' => '0.0000',
                    'total_discount' => '0.00',
                    'total_without_taxes' => '310.00',
                    'tax_regime' => TaxRegime::STANDARD->value,
                    'tax_exemption_code' => null,
                    'taxes' => [
                        ['value' => '5.500'],
                    ],
                ],
                [
                    'id' => 7,
                    'estimate_id' => 6,
                    'is_service' => false,
                    'description' => "Achat pile",
                    'quantity' => 1,
                    'unit_price' => '2.00',
                    'total_without_discount' => '2.00',
                    'discount_rate' => '0.0000',
                    'total_discount' => '0.00',
                    'total_without_taxes' => '2.00',
                    'tax_regime' => TaxRegime::EXEMPTED->value,
                    'tax_exemption_code' => VatExemptionCodeEu::VATEX_EU_79_C->value,
                    'taxes' => null,
                ],
            ],

            // - Remise.
            'total_without_global_discount' => '2192.33',
            'global_discount_rate' => '1.3923',
            'global_discount_breakdown' => [
                [
                    'base' => '1880.33',
                    'value' => '26.18',
                    'total' => '1854.15',
                    'tax' => [
                        'type' => TaxRegime::STANDARD->value,
                        'value' => '20.000',
                    ],
                ],
                [
                    'base' => '310.00',
                    'value' => '4.32',
                    'total' => '305.68',
                    'tax' => [
                        'type' => TaxRegime::STANDARD->value,
                        'value' => '5.500',
                    ],
                ],
                [
                    'base' => '2.00',
                    'value' => '0.03',
                    'total' => '1.97',
                    'tax' => [
                        'type' => TaxRegime::EXEMPTED->value,
                        'reason' => [VatExemptionCodeEu::VATEX_EU_79_C->value],
                    ],
                ],
            ],
            'total_global_discount' => '30.53',

            // - Totaux.
            'total_without_taxes' => '2161.80',
            'global_tax_regime' => null,
            'global_tax_exemption_code' => null,
            'global_tax_exemption_reason' => null,
            'total_taxes' => [
                [
                    'type' => TaxRegime::STANDARD->value,
                    'base' => '1854.15',
                    'value' => '20.000',
                    'total' => '370.83',
                ],
                [
                    'type' => TaxRegime::STANDARD->value,
                    'base' => '305.68',
                    'value' => '5.500',
                    'total' => '16.81',
                ],
                [
                    'type' => TaxRegime::EXEMPTED->value,
                    'reason' => [VatExemptionCodeEu::VATEX_EU_79_C->value],
                    'base' => '1.97',
                ],
            ],
            'total_with_taxes' => '2549.44',

            'total_replacement' => '58899.80',
            'special_mentions' => null,
            'currency' => 'EUR',
            'lang' => 'fr',
            'author_id' => 1,
            'metadata' => [
                'properties' => [
                    [
                        'id' => 1,
                        'name' => 'Poids',
                        'type' => 'float',
                        'unit' => 'kg',
                        'value' => 113.9,
                    ],
                    [
                        'id' => 3,
                        'name' => 'Puissance',
                        'type' => 'integer',
                        'unit' => 'W',
                        'value' => 2620,
                    ],
                ],
            ],
            'created_at' => '2022-10-22 18:42:36',
            'updated_at' => '2022-10-22 18:42:36',
            'deleted_at' => null,
        ];

        $result = $result->append(['materials', 'extras'])->toArray();
        $result['global_discount_breakdown'] = $result['global_discount_breakdown'] === null ? null : (
            array_map(
                static function ($discount) {
                    $discount = array_replace($discount, [
                        'base' => (string) $discount['base'],
                        'value' => (string) $discount['value'],
                        'total' => (string) $discount['total'],
                    ]);

                    if ($discount['tax']['type'] !== TaxRegime::STANDARD->value) {
                        return $discount;
                    }

                    return array_replace_recursive($discount, [
                        'tax' => ['value' => (string) $discount['tax']['value']],
                    ]);
                },
                $result['global_discount_breakdown'],
            )
        );
        $result['total_taxes'] = $result['total_taxes'] === null ? null : (
            array_map(
                static function ($tax) {
                    if ($tax['type'] !== TaxRegime::STANDARD->value) {
                        return array_replace($tax, [
                            'base' => (string) $tax['base'],
                        ]);
                    }

                    return array_replace($tax, [
                        'value' => (string) $tax['value'],
                        'base' => (string) $tax['base'],
                        'total' => (string) $tax['total'],
                    ]);
                },
                $result['total_taxes'],
            )
        );
        $this->assertSameCanonicalize($expected, $result);

        // - On active une exemption globale.
        static::setCustomConfig([
            'organization.isVatExempted' => true,
            'organization.vatExemptionCode' => VatExemptionCodeFr::VATEX_FR_FRANCHISE,
        ]);

        // - Avec un événement à l'heure près.
        $secondUuid = (string) Str::freezeUuids();
        $result = Estimate::createFromBooking(Event::findOrFail(1), User::findOrFail(2), [
            'due_date' => '2022-10-30',
            'lang' => 'en',
            'special_mentions' => "Should be paid before 2022/30/10",
        ]);
        Str::createUuidsNormally();
        $expected = [
            'id' => 7,
            'format' => BillingFormat::current()->value,
            'uuid' => $secondUuid,
            'number' => null,
            'status' => EstimateStatus::DRAFT->value,
            'url' => 'http://loxya.test/estimates/7/pdf',
            'date' => null,
            'due_date' => '2022-10-30',
            'due_delay' => null,

            'seller_legal_name' => 'Testing corp.',
            'seller_registration_id' => '54321008020145',
            'seller_vat_number' => null,
            'seller_legal_type' => 'FR.SARL',
            'seller_share_capital' => '1000.00',
            'seller_activity_code' => '7729Z',
            'seller_trade_registry_city' => 'TestGrandeVille',
            'seller_street' => '5 rue des tests',
            'seller_additional_street' => null,
            'seller_postal_code' => '05555',
            'seller_administrative_area' => null,
            'seller_locality' => 'Testville',
            'seller_country' => 'FR',
            'seller_email' => 'contact@testing-corp.dev',
            'seller_phone' => '+33123456789',

            'buyer_id' => 1,
            'buyer_type' => LegalEntityType::COMPANY->value,
            'buyer_reference' => '0001',
            'buyer_legal_name' => 'Testing, Inc',
            'buyer_is_public_entity' => false,
            'buyer_registration_id' => '12345678900001',
            'buyer_vat_number' => 'FR32123456789',
            'buyer_service_code' => null,
            'buyer_first_name' => 'Jean',
            'buyer_last_name' => 'Fountain',
            'buyer_street' => '10 avenue de la gare',
            'buyer_additional_street' => 'Bâtiment D',
            'buyer_postal_code' => '74000',
            'buyer_administrative_area' => null,
            'buyer_locality' => 'Annecy',
            'buyer_country' => 'FR',
            'buyer_email' => 'tester@loxya.com',
            'buyer_phone' => '+33123456789',

            'booking_type' => Event::TYPE,
            'booking_id' => 1,
            'booking_title' => 'Premier événement',
            'booking_reference' => null,
            'booking_start_date' => '2018-12-17 10:00:00',
            'booking_end_date' => '2018-12-18 18:00:00',
            'booking_is_full_days' => false,

            'is_vat_due_on_invoice' => true,
            'has_final_invoice' => false,
            'degressive_rate' => null,
            'daily_total' => null,
            'materials' => [
                [
                    'id' => 9,
                    'estimate_id' => 7,
                    'material_id' => 1,
                    'name' => 'Console Yamaha CL3',
                    'reference' => 'CL3',
                    'description' => "Console numérique 64 entrées / 8 sorties + Master + Sub",
                    'quantity' => 1,
                    'unit_price' => '200.00',
                    'degressive_rate' => '1.75',
                    'unit_price_period' => '350.00',
                    'total_without_discount' => '350.00',
                    'discount_rate' => '0.0000',
                    'total_discount' => '0.00',
                    'total_without_taxes' => '350.00',
                    'tax_regime' => null,
                    'tax_exemption_code' => null,
                    'taxes' => null,
                    'unit_replacement_price' => '19000.00',
                    'total_replacement_price' => '19000.00',
                    'is_hidden_on_bill' => false,
                ],
                [
                    'id' => 10,
                    'estimate_id' => 7,
                    'material_id' => 2,
                    'name' => 'DBX PA2',
                    'reference' => 'DBXPA2',
                    'description' => "Système de diffusion numérique",
                    'quantity' => 1,
                    'unit_price' => '25.50',
                    'degressive_rate' => '1.75',
                    'unit_price_period' => '44.63',
                    'total_without_discount' => '44.63',
                    'discount_rate' => '0.0000',
                    'total_discount' => '0.00',
                    'total_without_taxes' => '44.63',
                    'tax_regime' => null,
                    'tax_exemption_code' => null,
                    'taxes' => null,
                    'unit_replacement_price' => '349.90',
                    'total_replacement_price' => '349.90',
                    'is_hidden_on_bill' => false,
                ],
                [
                    'id' => 11,
                    'estimate_id' => 7,
                    'material_id' => 4,
                    'name' => 'Showtec SDS-6',
                    'reference' => 'SDS-6-01',
                    'description' => "Console DMX (jeu d'orgue) Showtec 6 canaux",
                    'quantity' => 1,
                    'unit_price' => '15.95',
                    'degressive_rate' => '1.75',
                    'unit_price_period' => '27.91',
                    'total_without_discount' => '27.91',
                    'discount_rate' => '0.0000',
                    'total_discount' => '0.00',
                    'total_without_taxes' => '27.91',
                    'tax_regime' => null,
                    'tax_exemption_code' => null,
                    'taxes' => null,
                    'unit_replacement_price' => '59.00',
                    'total_replacement_price' => '59.00',
                    'is_hidden_on_bill' => false,
                ],
            ],
            'extras' => [],

            // - Remise.
            'total_without_global_discount' => '422.54',
            'global_discount_rate' => '10.0000',
            'global_discount_breakdown' => [
                [
                    'base' => '422.54',
                    'value' => '42.25',
                    'total' => '380.29',
                    'tax' => [
                        'type' => TaxRegime::EXEMPTED->value,
                        'reason' => [VatExemptionCodeFr::VATEX_FR_FRANCHISE->value],
                    ],
                ],
            ],
            'total_global_discount' => '42.25',

            // - Totaux.
            'total_without_taxes' => '380.29',
            'global_tax_regime' => TaxRegime::EXEMPTED->value,
            'global_tax_exemption_code' => VatExemptionCodeFr::VATEX_FR_FRANCHISE->value,
            'global_tax_exemption_reason' => null,
            'total_taxes' => null,
            'total_with_taxes' => '380.29',

            'total_replacement' => '19408.90',
            'special_mentions' => "Should be paid before 2022/30/10",
            'currency' => 'EUR',
            'lang' => 'en',
            'author_id' => 2,
            'metadata' => [
                'properties' => [
                    [
                        'id' => 1,
                        'name' => 'Poids',
                        'type' => 'float',
                        'unit' => 'kg',
                        'value' => 41.85,
                    ],
                    [
                        'id' => 3,
                        'name' => 'Puissance',
                        'type' => 'integer',
                        'unit' => 'W',
                        'value' => 945,
                    ],
                ],
            ],
            'created_at' => '2022-10-22 18:42:36',
            'updated_at' => '2022-10-22 18:42:36',
            'deleted_at' => null,
        ];
        $result = $result->append(['materials', 'extras'])->toArray();
        $result['global_discount_breakdown'] = $result['global_discount_breakdown'] === null ? null : (
            array_map(
                static function ($discount) {
                    $discount = array_replace($discount, [
                        'base' => (string) $discount['base'],
                        'value' => (string) $discount['value'],
                        'total' => (string) $discount['total'],
                    ]);

                    if ($discount['tax']['type'] !== TaxRegime::STANDARD->value) {
                        return $discount;
                    }

                    return array_replace_recursive($discount, [
                        'tax' => ['value' => (string) $discount['tax']['value']],
                    ]);
                },
                $result['global_discount_breakdown'],
            )
        );
        $this->assertSameCanonicalize($expected, $result);
    }

    public function testToPdf(): void
    {
        static::setNow(Carbon::create(2022, 10, 22, 18, 42, 36));

        // - Test avec un ancien devis (format legacy).
        $result = Estimate::findOrFail(2)->toPdf();
        $this->assertInstanceOf(Pdf::class, $result);

        // - Test simple.
        $result = Estimate::findOrFail(1)->toPdf();
        $this->assertInstanceOf(Pdf::class, $result);
        $this->assertSame('estimate-testing-corp-d-2021-00001-jean-fountain.pdf', $result->getName());
        $this->assertMatchesPdfSnapshot($result);

        // - Un événement à l'heure près.
        $estimate = Estimate::createFromBooking(Event::findOrFail(1), User::findOrFail(2))->finalize();
        $result = $estimate->toPdf();
        $this->assertInstanceOf(Pdf::class, $result);
        $this->assertMatchesPdfSnapshot($result);

        // - Avec des paramètres d'affichage différents.
        Setting::bulkEdit([
            'estimates.showTotalReplacementPrice' => true,
            'estimates.showTotalisableProperties' => true,
            'estimates.showDescriptions' => true,
            'estimates.showReplacementPrices' => false,
            'estimates.specialMentions' => 'Un texte personnalisé modifié.',
        ]);

        $estimate = Estimate::createFromBooking(Event::findOrFail(1), User::findOrFail(2))->finalize();
        $result = $estimate->toPdf();
        $this->assertInstanceOf(Pdf::class, $result);
        $this->assertMatchesPdfSnapshot($result);

        // - Un brouillon.
        $estimate = Estimate::createFromBooking(Event::findOrFail(1), User::findOrFail(2));
        $this->assertTrue($estimate->is_draft);
        $result = $estimate->toPdf();
        $this->assertInstanceOf(Pdf::class, $result);
        $this->assertMatchesPdfSnapshot($result);
    }
}
