<?php
declare(strict_types=1);

namespace Loxya\Tests;

use Brick\Math\BigDecimal as Decimal;
use Illuminate\Support\Carbon;
use Loxya\Models\Beneficiary;
use Loxya\Models\Company;
use Loxya\Models\Enums\BillingFormat;
use Loxya\Models\Enums\InvoiceStatus;
use Loxya\Models\Enums\LegalEntityType;
use Loxya\Models\Estimate;
use Loxya\Models\Event;
use Loxya\Models\Invoice;
use Loxya\Models\Setting;
use Loxya\Models\User;
use Loxya\Support\Invoicing\TaxRegime;
use Loxya\Support\Invoicing\UblSpecification;
use Loxya\Support\Invoicing\VatExemptionCode\VatExemptionCodeEu;
use Loxya\Support\Invoicing\VatExemptionCode\VatExemptionCodeFr;
use Loxya\Support\Pdf\Pdf;
use Loxya\Support\Period;
use Loxya\Support\Str;

final class InvoiceTest extends TestCase
{
    public function testValidation(): void
    {
        $invoice = tap(new Invoice(), static function (Invoice $invoice) {
            $invoice->status = InvoiceStatus::PENDING->value;
            $invoice->fill([
                'number' => '',
                'date' => '',
                'booking_start_date' => null,
                'booking_end_date' => null,
                'degressive_rate' => '100000.00',
                'total_taxes' => [
                    [
                        'type' => TaxRegime::STANDARD->value,
                        'name' => 'VAT', // - Le nom ne devrait pas être spécifié.
                        'value' => '5.500',
                        'total' => '5500.00',
                    ],
                ],
                'total_without_taxes' => '1000000000000.00',
                'total_replacement' => '-20.00',
                'currency' => 'a',
            ]);
            $invoice->booking()->associate(Event::findOrFail(1));
            $invoice->buyer()->associate(Beneficiary::findOrFail(1));
        });
        $expectedErrors = [
            'number' => "Ce champ est obligatoire.",
            'date' => "Ce champ est obligatoire.",
            'due_date' => "Une date d'échéance ou un délai de paiement est requis.",
            'seller_legal_name' => 'Ce champ est obligatoire.',
            'seller_registration_id' => 'Ce champ est obligatoire.',
            'seller_country' => 'Ce champ est obligatoire.',
            'buyer_type' => 'La valeur est invalide.',
            'buyer_is_public_entity' => 'Ce champ doit être un booléen.',
            'buyer_country' => 'Ce champ est obligatoire.',
            'global_discount_rate' => "Ce champ doit contenir un chiffre à virgule.",
            'total_replacement' => "Ce champ est invalide.",
            'currency' => "Ce champ est invalide.",
            'booking_start_date' => "Ce champ est obligatoire.",
            'booking_end_date' => "Ce champ est obligatoire.",
            'booking_is_full_days' => "Ce champ doit être un booléen.",
            'is_electronic' => 'Ce champ doit être un booléen.',
            'is_vat_due_on_invoice' => 'Ce champ doit être un booléen.',
            'total_without_global_discount' => "Ce champ doit contenir un chiffre à virgule.",
            'total_global_discount' => "Ce champ doit contenir un chiffre à virgule.",
            'total_without_taxes' => "Ce champ est invalide.",
            'total_taxes' => "Ce champ est invalide.",
            'total_with_taxes' => "Ce champ doit contenir un chiffre à virgule.",
        ];
        $this->assertFalse($invoice->isValid());
        $this->assertSameCanonicalize($expectedErrors, $invoice->validationErrors());

        // - Avec une facture legacy.
        $invoice = tap(new Invoice(), static function (Invoice $invoice) {
            $invoice->status = InvoiceStatus::PENDING->value;
            $invoice->format = BillingFormat::V1->value;
            $invoice->fill([
                'number' => '',
                'date' => '',
                'booking_start_date' => null,
                'booking_end_date' => null,
                'degressive_rate' => '100000.00',
                'total_without_taxes' => '1000000000000.00',
                'global_tax_regime' => TaxRegime::EXEMPTED->value,
                'global_tax_exemption_reason' => 'Exempté.',
                'total_replacement' => '-20.00',
                'currency' => 'a',
            ]);
            $invoice->booking()->associate(Event::findOrFail(1));
            $invoice->buyer()->associate(Beneficiary::findOrFail(1));
        });
        $expectedErrors = [
            'number' => "Ce champ est obligatoire.",
            'date' => "Ce champ est obligatoire.",
            'seller_legal_name' => 'Ce champ est obligatoire.',
            'seller_registration_id' => 'Ce champ est obligatoire.',
            'seller_country' => 'Ce champ est obligatoire.',
            'buyer_type' => 'La valeur est invalide.',
            'buyer_is_public_entity' => 'Ce champ doit être un booléen.',
            'buyer_country' => 'Ce champ est obligatoire.',
            'degressive_rate' => "Ce champ est invalide.",
            'global_discount_rate' => "Ce champ doit contenir un chiffre à virgule.",
            'total_replacement' => "Ce champ est invalide.",
            'currency' => "Ce champ est invalide.",
            'booking_start_date' => "Ce champ est obligatoire.",
            'booking_end_date' => "Ce champ est obligatoire.",
            'booking_is_full_days' => "Ce champ doit être un booléen.",
            'is_electronic' => 'Ce champ doit être un booléen.',
            'is_vat_due_on_invoice' => 'Ce champ doit être un booléen.',
            'daily_total' => "Ce champ est invalide.",
            'total_without_global_discount' => "Ce champ doit contenir un chiffre à virgule.",
            'total_global_discount' => "Ce champ doit contenir un chiffre à virgule.",
            'total_without_taxes' => "Ce champ est invalide.",
            'total_with_taxes' => "Ce champ doit contenir un chiffre à virgule.",
        ];
        $this->assertFalse($invoice->isValid());
        $this->assertSameCanonicalize($expectedErrors, $invoice->validationErrors());

        // - Test de validation du numéro de facture, du taux de remise et de la date d'échéance.
        $invoice = tap(new Invoice(), static function (Invoice $invoice) {
            $invoice->status = InvoiceStatus::PENDING->value;
            $invoice->fill([
                'number' => '2020-00001',
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
                'buyer_first_name' => 'Marc',
                'buyer_last_name' => 'Test',
                'buyer_country' => 'FR',
                'booking_period' => new Period('2018-12-17', '2018-12-18', true),
                'is_electronic' => true,
                'is_vat_due_on_invoice' => false,
                'total_without_global_discount' => '1750.00',
                'global_discount_rate' => '101.00',
                'global_discount_breakdown' => [
                    [
                        'base' => '1750.00',
                        'value' => '1767.50',
                        'total' => '-17.50',
                        'tax' => [
                            'type' => TaxRegime::STANDARD->value,
                            'value' => '5.500',
                        ],
                    ],
                ],
                'total_global_discount' => '1767.50',
                'total_without_taxes' => '-17.50',
                'total_taxes' => [
                    [
                        'type' => TaxRegime::STANDARD->value,
                        'base' => '-17.50',
                        'value' => '5.500',
                        'total' => '-0.96',
                    ],
                ],
                'total_with_taxes' => '-18.46',
                'total_replacement' => '2000.00',
                'currency' => 'EUR',
            ]);
            $invoice->booking()->associate(Event::findOrFail(1));
            $invoice->buyer()->associate(Beneficiary::findOrFail(1));
        });
        $expectedErrors = [
            'number' => "Une facture existe déjà avec ce numéro.",
            'due_date' => "La date d'échéance doit être postérieure à la date de la facture.",
            'buyer_is_public_entity' => "Ce champ doit être un booléen.",
            'seller_routing_identifier' => "Ce champ est obligatoire.",
            'global_discount_rate' => "Ce champ est invalide.",
        ];
        $this->assertFalse($invoice->isValid());
        $this->assertSameCanonicalize($expectedErrors, $invoice->validationErrors());
    }

    public function testStatusAttribute(): void
    {
        // - S'il y a au moins un paiement, la facture est "partiellement payée".
        $this->assertSame(
            InvoiceStatus::PARTIALLY_PAID->value,
            Invoice::findOrFail(1)->status,
        );

        $invoice = Invoice::findOrFail(4);
        $invoice->update(['status' => InvoiceStatus::SENT->value]);

        // - Si on est avant la date d'échéance de la facture, son statut n'est pas "en retard".
        static::setNow(Carbon::create(2021, 6, 20));
        $this->assertSame(InvoiceStatus::SENT->value, $invoice->status);

        // - Si on est a dépassé la date d'échéance de la facture, son statut est "en retard".
        static::setNow(Carbon::create(2021, 6, 22));
        $this->assertSame(InvoiceStatus::OVERDUE->value, $invoice->status);
    }

    public function testCreateFromEvent(): void
    {
        static::setNow(Carbon::create(2022, 10, 22, 18, 42, 36));

        // - Avec un événement au jour entier.
        $event = tap(Event::findOrFail(2), static function ($event) {
            $event->global_discount_rate = Decimal::of('1.3923');
        });
        $firstUuid = Str::freezeUuids();
        $result = Invoice::createFromBooking($event, User::findOrFail(1));
        Str::createUuidsNormally();
        $expected = [
            'id' => 7,
            'format' => BillingFormat::current()->value,
            'uuid' => (string) $firstUuid,
            'number' => null,
            'order_number' => null,
            'date' => null,
            'due_date' => null,
            'due_delay' => 15,
            'status' => InvoiceStatus::DRAFT->value,
            'url' => [
                'pdf' => 'http://loxya.test/invoices/7/pdf',
                'ubl' => null,
            ],

            'seller_legal_name' => 'Testing corp.',
            'seller_registration_id' => '54321008020145',
            'seller_vat_number' => 'FR85543210080',
            'seller_routing_identifier' => '0225:543210080_54321008020145',
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
            'buyer_routing_identifier' => null,
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

            'degressive_rate' => null,
            'daily_total' => null,

            'is_electronic' => true,
            'is_prepayment' => false,
            'is_credit_note' => false,
            'is_cancelled' => false,
            'is_overdue' => false,
            'is_vat_due_on_invoice' => true,

            'parent_estimate_id' => null,
            'parent_invoice_id' => null,

            'materials' => [
                [
                    'id' => 7,
                    'invoice_id' => 7,
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
                    'invoice_id' => 7,
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
                    'id' => 10,
                    'invoice_id' => 7,
                    'is_service' => true,
                    'description' => 'Services additionnels',
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
                    'id' => 11,
                    'invoice_id' => 7,
                    'is_service' => false,
                    'description' => 'Achat pile',
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
        $this->assertEquals($expected, $result);

        // - Avec un événement à l'heure près.
        $event = tap(Event::findOrFail(1), static function ($event) {
            $event->discount_rate = Decimal::zero();
        });
        $secondUuid = Str::freezeUuids();
        $result = Invoice::createFromBooking($event, User::findOrFail(2), [
            'due_date' => '2022-11-30',
        ]);
        Str::createUuidsNormally();
        $expected = [
            'id' => 8,
            'format' => BillingFormat::current()->value,
            'uuid' => (string) $secondUuid,
            'number' => null,
            'order_number' => null,
            'status' => InvoiceStatus::DRAFT->value,
            'url' => [
                'pdf' => 'http://loxya.test/invoices/8/pdf',
                'ubl' => null,
            ],
            'date' => null,
            'due_date' => '2022-11-30',
            'due_delay' => null,

            'seller_legal_name' => 'Testing corp.',
            'seller_registration_id' => '54321008020145',
            'seller_vat_number' => 'FR85543210080',
            'seller_routing_identifier' => '0225:543210080_54321008020145',
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
            'buyer_routing_identifier' => '0225:123456789_LOCATION',
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

            'degressive_rate' => null,
            'daily_total' => null,

            'is_electronic' => true,
            'is_prepayment' => false,
            'is_credit_note' => false,
            'is_cancelled' => false,
            'is_overdue' => false,
            'is_vat_due_on_invoice' => true,

            'parent_estimate_id' => null,
            'parent_invoice_id' => null,

            'materials' => [
                [
                    'id' => 9,
                    'invoice_id' => 8,
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
                    'tax_regime' => TaxRegime::STANDARD->value,
                    'tax_exemption_code' => null,
                    'taxes' => [
                        ['value' => '20.000'],
                    ],
                    'unit_replacement_price' => '19000.00',
                    'total_replacement_price' => '19000.00',
                    'is_hidden_on_bill' => false,
                ],
                [
                    'id' => 10,
                    'invoice_id' => 8,
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
                    'tax_regime' => TaxRegime::STANDARD->value,
                    'tax_exemption_code' => null,
                    'taxes' => [
                        ['value' => '20.000'],
                    ],
                    'unit_replacement_price' => '349.90',
                    'total_replacement_price' => '349.90',
                    'is_hidden_on_bill' => false,
                ],
                [
                    'id' => 11,
                    'invoice_id' => 8,
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
                    'tax_regime' => TaxRegime::STANDARD->value,
                    'tax_exemption_code' => null,
                    'taxes' => [
                        ['value' => '20.000'],
                    ],
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
                        'type' => TaxRegime::STANDARD->value,
                        'value' => '20.000',
                    ],
                ],
            ],
            'total_global_discount' => '42.25',

            // - Totaux.
            'total_without_taxes' => '380.29',
            'global_tax_regime' => null,
            'global_tax_exemption_code' => null,
            'global_tax_exemption_reason' => null,
            'total_taxes' => [
                [
                    'type' => TaxRegime::STANDARD->value,
                    'value' => '20.000',
                    'base' => '380.29',
                    'total' => '76.06',
                ],
            ],
            'total_with_taxes' => '456.35',

            'total_replacement' => '19408.90',
            'special_mentions' => null,
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
        $this->assertEquals($expected, $result);
    }

    public function testToPdf(): void
    {
        static::setNow(Carbon::create(2022, 10, 22, 18, 42, 36));

        // - Test avec une ancienne facture (format legacy).
        $result = Invoice::findOrFail(1)->toPdf();
        $this->assertInstanceOf(Pdf::class, $result);

        // - Test simple (Facture non-legacy).
        $invoice = Invoice::findOrFail(2);
        $this->assertValidFacturx($invoice->toPdf());

        // - Un événement à l'heure près.
        $invoice = Invoice::createFromBooking(Event::findOrFail(1), User::findOrFail(2))->finalize();
        $this->assertValidFacturx($invoice->toPdf());

        // - Un événement avec lignes additionnelles.
        $invoice = Invoice::createFromBooking(Event::findOrFail(2), User::findOrFail(2))->finalize();
        $this->assertValidFacturx($invoice->toPdf());

        // - Avec des paramètres d'affichage différents.
        Setting::bulkEdit([
            'invoices.showTotalReplacementPrice' => true,
            'invoices.showTotalisableProperties' => true,
            'invoices.showDescriptions' => true,
            'invoices.showReplacementPrices' => false,
            'invoices.specialMentions' => 'Test - Un texte personnalisé modifié.',
        ]);

        $invoice = Invoice::createFromBooking(Event::findOrFail(2), User::findOrFail(2))->finalize();
        $this->assertValidFacturx($invoice->toPdf());

        // - Avec un avoir...
        $invoice = Invoice::createCreditNote(Invoice::findOrFail(2), User::findOrFail(1));
        $this->assertValidFacturx($invoice->toPdf());

        // - On active une exemption globale.
        static::setCustomConfig([
            'organization.isVatExempted' => true,
            'organization.vatExemptionCode' => VatExemptionCodeFr::VATEX_FR_FRANCHISE,
        ]);

        // - Un événement avec une exemption globale ...
        $invoice = Invoice::createFromBooking(Event::findOrFail(2), User::findOrFail(2))->finalize();
        $this->assertValidFacturx($invoice->toPdf());

        // - Une facture avec uniquement des lignes extras
        $invoice = Invoice::findOrFail(3);
        $this->assertValidFacturx($invoice->toPdf());

        // - On reset l'exemption globale.
        static::setCustomConfig([
            'organization.isVatExempted' => false,
            'organization.vatExemptionCode' => null,
        ]);

        // - Avec une facture d'acompte.
        $author = User::findOrFail(1);
        $prepaymentInvoice = Invoice::createFromEstimate(Estimate::findOrFail(1), Decimal::of('500'), $author);
        $this->assertValidFacturx($prepaymentInvoice->toPdf());

        // - On annule la facture d'acompte et on en crée une autre.
        static::setNow(Carbon::create(2022, 10, 22, 18, 50, 0));
        $creditNote = Invoice::createCreditNote($prepaymentInvoice, $author);
        $this->assertValidFacturx($creditNote->toPdf());

        static::setNow(Carbon::create(2022, 10, 22, 18, 51, 0));
        $prepaymentInvoice = Invoice::createFromEstimate(Estimate::findOrFail(1), 481.65, $author);
        $this->assertValidFacturx($prepaymentInvoice->toPdf());

        // - Un acompte qui dépasse le montant restant doit déclencher une erreur.
        static::setNow(Carbon::create(2022, 10, 22, 18, 52, 0));
        $this->assertThrow(\InvalidArgumentException::class, static fn () => (
            Invoice::createFromEstimate(Estimate::findOrFail(1), Decimal::of('600.00'), $author)
        ));

        // - Puis facture de solde.
        static::setNow(Carbon::create(2022, 10, 22, 18, 53, 0));
        $invoice = Invoice::createFromEstimate(Estimate::findOrFail(1), null, $author);
        $this->assertValidFacturx($invoice->toPdf());

        // - On ne peut pas créer une nouvelle facture ou un acompte si le devis est soldé.
        static::setNow(Carbon::create(2022, 10, 22, 18, 53, 30));
        $this->assertThrow(\InvalidArgumentException::class, static fn () => (
            Invoice::createFromEstimate(Estimate::findOrFail(1), null, $author)
        ));
        $this->assertThrow(\InvalidArgumentException::class, static fn () => (
            Invoice::createFromEstimate(Estimate::findOrFail(1), 100.0, $author)
        ));

        // - On ne peut pas créer un avoir d'une facture d'acompte pour lequel le devis a eu une facture finale.
        $this->assertThrow(\InvalidArgumentException::class, static fn () => (
            Invoice::createCreditNote($prepaymentInvoice->refresh(), $author)
        ));

        // - On annule la facture de solde...
        static::setNow(Carbon::create(2022, 10, 22, 18, 55, 30));
        $finalCreditNote = Invoice::createCreditNote($invoice, $author);
        $this->assertValidFacturx($finalCreditNote->toPdf());

        // - Après annulation, on peut à nouveau créer un acompte.
        $prepaymentInvoice = Invoice::createFromEstimate(Estimate::findOrFail(1), Decimal::of('101.99'), $author);
        $this->assertValidFacturx($prepaymentInvoice->toPdf());

        // - Puis re-facture de solde.
        static::setNow(Carbon::create(2022, 10, 22, 18, 56, 0));
        $invoice = Invoice::createFromEstimate(Estimate::findOrFail(1), null, $author);
        $this->assertValidFacturx($invoice->toPdf());

        // - Une facture avec deux raisons d'exemptions différentes.
        $invoice = Invoice::findOrFail(4);
        $this->assertValidFacturx($invoice->toPdf());

        // - Avec un client B2G (entité publique avec code de service).
        tap(Company::findOrFail(1), static function (Company $company) {
            $company->is_public_entity = true;
            $company->service_code = 'SERVICE-B2G';
            $company->saveOrFail();
        });
        $invoice = Invoice::createFromBooking(Event::findOrFail(1), User::findOrFail(2))->finalize();
        $this->assertValidFacturx($invoice->toPdf());

        // - Facture d'acompte à montant fixe sur un devis comportant une ligne
        //   négative avec un taux de TVA différent (1000€ HT @ 20% + -998.56€ HT @ 10%).
        static::setNow(Carbon::create(2026, 10, 22, 18, 42, 36));
        $prepaymentInvoice = Invoice::createFromEstimate(
            Estimate::findOrFail(5),
            Decimal::of('1.99'),
            User::findOrFail(1),
        );
        $this->assertValidFacturx($prepaymentInvoice->toPdf());

        // - Avoir sur une facture comportant une ligne négative
        //   (1000€ HT @ 20% + -100€ HT @ 20%).
        static::setNow(Carbon::create(2026, 10, 22, 18, 43, 0));
        $creditNote = Invoice::createCreditNote(Invoice::findOrFail(6), User::findOrFail(1));
        $this->assertValidFacturx($creditNote->toPdf());

        // - Un brouillon (filigrane + tag [BROUILLON], pas de Factur-X).
        static::setNow(Carbon::create(2026, 10, 22, 18, 44, 0));
        $invoice = Invoice::createFromBooking(Event::findOrFail(1), User::findOrFail(2), ['lang' => 'fr']);
        $this->assertTrue($invoice->is_draft);
        $result = $invoice->toPdf();
        $this->assertInstanceOf(Pdf::class, $result);
        $this->assertMatchesPdfSnapshot($result);
    }

    public function testToUbl(): void
    {
        static::setNow(Carbon::create(2022, 10, 22, 18, 42, 36));

        // - Une ancienne facture (format legacy) ne produit pas d'UBL.
        $this->assertNull(Invoice::findOrFail(1)->toUbl());

        // - Une facture pour un particulier ne produit pas d'UBL.
        $invoice = Invoice::findOrFail(2);
        $this->assertNull($invoice->toUbl());

        // - Test simple.
        $invoice = Invoice::createFromBooking(Event::findOrFail(1), User::findOrFail(2))->finalize();
        $this->assertValidUbl(UblSpecification::EXTENDED_CTC_FR, $invoice->toUbl());

        // - On active une exemption globale.
        static::setCustomConfig([
            'organization.isVatExempted' => true,
            'organization.vatExemptionCode' => VatExemptionCodeFr::VATEX_FR_FRANCHISE,
        ]);

        $invoice = Invoice::createFromBooking(Event::findOrFail(1), User::findOrFail(2))->finalize();
        $this->assertValidUbl(UblSpecification::EXTENDED_CTC_FR, $invoice->toUbl());

        // - On reset l'exemption globale.
        static::setCustomConfig([
            'organization.isVatExempted' => false,
            'organization.vatExemptionCode' => null,
        ]);

        // - Avec une facture d'acompte.
        $author = User::findOrFail(1);
        $prepaymentInvoice = Invoice::createFromEstimate(Estimate::findOrFail(1), Decimal::of('500'), $author);
        $this->assertValidUbl(UblSpecification::EXTENDED_CTC_FR, $prepaymentInvoice->toUbl());

        // - On annule la facture d'acompte et on en crée une autre.
        static::setNow(Carbon::create(2022, 10, 22, 18, 50, 0));
        $creditNote = Invoice::createCreditNote($prepaymentInvoice, $author);
        $this->assertValidUbl(UblSpecification::EXTENDED_CTC_FR, $creditNote->toUbl());

        static::setNow(Carbon::create(2022, 10, 22, 18, 51, 0));
        $prepaymentInvoice = Invoice::createFromEstimate(Estimate::findOrFail(1), 481.65, $author);
        $this->assertValidUbl(UblSpecification::EXTENDED_CTC_FR, $prepaymentInvoice->toUbl());

        // - Puis facture de solde.
        static::setNow(Carbon::create(2022, 10, 22, 18, 53, 0));
        $invoice = Invoice::createFromEstimate(Estimate::findOrFail(1), null, $author);
        $this->assertValidUbl(UblSpecification::EXTENDED_CTC_FR, $invoice->toUbl());

        // - On annule la facture de solde....
        static::setNow(Carbon::create(2022, 10, 22, 18, 55, 30));
        $finalCreditNote = Invoice::createCreditNote($invoice, $author);
        $this->assertValidUbl(UblSpecification::EXTENDED_CTC_FR, $finalCreditNote->toUbl());

        // - Après annulation, on peut à nouveau créer un acompte.
        $prepaymentInvoice = Invoice::createFromEstimate(Estimate::findOrFail(1), Decimal::of('101.99'), $author);
        $this->assertValidUbl(UblSpecification::EXTENDED_CTC_FR, $prepaymentInvoice->toUbl());

        // - Puis re-facture de solde.
        static::setNow(Carbon::create(2022, 10, 22, 18, 56, 0));
        $invoice = Invoice::createFromEstimate(Estimate::findOrFail(1), null, $author);
        $this->assertValidUbl(UblSpecification::EXTENDED_CTC_FR, $invoice->toUbl());

        // - Avec un client B2G.
        tap(Company::findOrFail(1), static function (Company $company) {
            $company->is_public_entity = true;
            $company->service_code = 'SERVICE-B2G';
            $company->saveOrFail();
        });
        $invoice = Invoice::createFromBooking(Event::findOrFail(1), User::findOrFail(2))->finalize();
        $this->assertValidUbl(UblSpecification::EXTENDED_CTC_FR, $invoice->toUbl());

        // - Avoir sur une facture comportant une ligne négative.
        static::setNow(Carbon::create(2026, 10, 22, 18, 43, 0));
        $creditNote = Invoice::createCreditNote(Invoice::findOrFail(6), User::findOrFail(1));
        $this->assertNull($creditNote->toUbl());
    }

    public function testGetLastNumber(): void
    {
        $result = Invoice::getLastNumber(2099);
        $this->assertEquals(null, $result);

        $result = Invoice::getLastNumber(2020);
        $this->assertEquals('2020-00003', $result);
    }

    public function testGetNextNumber(): void
    {
        $result = Invoice::getNextNumber(2099);
        $this->assertEquals('2099-00001', $result);

        $result = Invoice::getNextNumber(2020);
        $this->assertEquals('2020-00004', $result);
    }
}
