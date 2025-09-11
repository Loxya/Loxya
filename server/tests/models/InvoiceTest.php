<?php
declare(strict_types=1);

namespace Loxya\Tests;

use Brick\Math\BigDecimal as Decimal;
use Illuminate\Support\Carbon;
use Loxya\Models\Beneficiary;
use Loxya\Models\Event;
use Loxya\Models\Invoice;
use Loxya\Models\Setting;
use Loxya\Models\User;
use Loxya\Services\I18n;
use Loxya\Support\Pdf\Pdf;
use Loxya\Support\Period;

final class InvoiceTest extends TestCase
{
    public function testValidation(): void
    {
        $invoice = tap(new Invoice(), static function (Invoice $invoice) {
            $invoice->fill([
                'number' => '',
                'date' => '',
                'booking_start_date' => null,
                'booking_end_date' => null,
                'degressive_rate' => '100000.00',
                'total_taxes' => [
                    [
                        'name' => 'VAT',
                        'is_rate' => true,
                        'value' => '-5.00',
                        'total' => '-1000000000000.00',
                    ],
                ],
                'total_without_taxes' => '1000000000000.00',
                'total_replacement' => '-20.00',
                'currency' => 'a',
            ]);
            $invoice->booking()->associate(Event::findOrFail(1));
            $invoice->beneficiary()->associate(Beneficiary::findOrFail(1));
        });
        $expectedErrors = [
            'number' => "Ce champ est obligatoire.",
            'date' => "Ce champ est obligatoire.",
            'global_discount_rate' => "Ce champ doit contenir un chiffre à virgule.",
            'total_replacement' => "Ce champ est invalide.",
            'currency' => "Ce champ est invalide.",
            'booking_start_date' => "Ce champ est obligatoire.",
            'booking_end_date' => "Ce champ est obligatoire.",
            'booking_is_full_days' => "Ce champ doit être un booléen.",
            'total_without_global_discount' => "Ce champ doit contenir un chiffre à virgule.",
            'total_global_discount' => "Ce champ doit contenir un chiffre à virgule.",
            'total_without_taxes' => "Ce champ est invalide.",
            'total_taxes' => "Ce champ est invalide.",
            'total_with_taxes' => "Ce champ doit contenir un chiffre à virgule.",
        ];
        $errors = $invoice->validationErrors();
        $this->assertEquals($expectedErrors, $errors);

        // - Avec une facture legacy.
        $invoice = tap(new Invoice(), static function (Invoice $invoice) {
            $invoice->is_legacy = true;
            $invoice->fill([
                'number' => '',
                'date' => '',
                'booking_start_date' => null,
                'booking_end_date' => null,
                'degressive_rate' => '100000.00',
                'total_without_taxes' => '1000000000000.00',
                'total_replacement' => '-20.00',
                'currency' => 'a',
            ]);
            $invoice->booking()->associate(Event::findOrFail(1));
            $invoice->beneficiary()->associate(Beneficiary::findOrFail(1));
        });
        $expectedErrors = [
            'number' => "Ce champ est obligatoire.",
            'date' => "Ce champ est obligatoire.",
            'degressive_rate' => "Ce champ est invalide.",
            'global_discount_rate' => "Ce champ doit contenir un chiffre à virgule.",
            'total_replacement' => "Ce champ est invalide.",
            'currency' => "Ce champ est invalide.",
            'booking_start_date' => "Ce champ est obligatoire.",
            'booking_end_date' => "Ce champ est obligatoire.",
            'booking_is_full_days' => "Ce champ doit être un booléen.",
            'daily_total' => "Ce champ est invalide.",
            'total_without_global_discount' => "Ce champ doit contenir un chiffre à virgule.",
            'total_global_discount' => "Ce champ doit contenir un chiffre à virgule.",
            'total_without_taxes' => "Ce champ est invalide.",
            'total_with_taxes' => "Ce champ doit contenir un chiffre à virgule.",
        ];
        $errors = $invoice->validationErrors();
        $this->assertEquals($expectedErrors, $errors);

        // - Test de validation du numéro de facture et du taux de remise.
        $invoice = tap(new Invoice(), static function (Invoice $invoice) {
            $invoice->fill([
                'number' => '2020-00001',
                'date' => '2024-01-19 16:00:00',
                'booking_period' => new Period('2018-12-17', '2018-12-18', true),
                'total_without_global_discount' => 1750.0,
                'global_discount_rate' => '101.00',
                'total_global_discount' => '875.00',
                'total_without_taxes' => '875.00',
                'total_taxes' => [
                    [
                        'name' => 'Tax',
                        'is_rate' => false,
                        'value' => '175.0',
                        'total' => '175.0',
                    ],
                ],
                'total_with_taxes' => '1050.00',
                'total_replacement' => '2000.00',
                'currency' => 'EUR',
            ]);
            $invoice->booking()->associate(Event::findOrFail(1));
            $invoice->beneficiary()->associate(Beneficiary::findOrFail(1));
        });
        $errors = $invoice->validationErrors();

        $expectedErrors = [
            'number' => "Une facture existe déjà avec ce numéro.",
            'global_discount_rate' => "Ce champ est invalide.",
        ];
        $this->assertEquals($expectedErrors, $errors);
    }

    public function testCreateFromEvent(): void
    {
        static::setNow(Carbon::create(2022, 10, 22, 18, 42, 36));

        // - Avec un événement au jour entier.
        $event = tap(Event::findOrFail(2), static function ($event) {
            $event->global_discount_rate = Decimal::of('1.3923');
        });
        $result = Invoice::createFromBooking($event, User::findOrFail(1));
        $expected = [
            'id' => 2,
            'number' => '2022-00001',
            'url' => 'http://loxya.test/invoices/2/pdf',
            'date' => '2022-10-22 18:42:36',
            'booking_type' => Event::TYPE,
            'booking_id' => 2,
            'booking_title' => 'Second événement',
            'booking_reference' => null,
            'booking_start_date' => '2018-12-18 00:00:00',
            'booking_end_date' => '2018-12-20 00:00:00',
            'booking_is_full_days' => true,
            'beneficiary_id' => 3,

            'is_legacy' => false,
            'degressive_rate' => null,
            'daily_total' => null,

            'materials' => [
                [
                    'id' => 3,
                    'invoice_id' => 2,
                    'material_id' => 2,
                    'name' => 'Processeur DBX PA2',
                    'reference' => 'DBXPA2',
                    'quantity' => 2,
                    'unit_price' => '25.50',
                    'degressive_rate' => '1.75',
                    'unit_price_period' => '44.63',
                    'total_without_discount' => '89.26',
                    'discount_rate' => '10.0000',
                    'total_discount' => '8.93',
                    'total_without_taxes' => '80.33',
                    'taxes' => [
                        [
                            'name' => 'T.V.A.',
                            'is_rate' => true,
                            'value' => '20.000',
                        ],
                    ],
                    'unit_replacement_price' => '349.90',
                    'total_replacement_price' => '699.80',
                    'is_hidden_on_bill' => false,
                ],
                [
                    'id' => 4,
                    'invoice_id' => 2,
                    'material_id' => 1,
                    'name' => 'Yamaha CL3',
                    'reference' => 'CL-3',
                    'quantity' => 3,
                    'unit_price' => '300.00',
                    'degressive_rate' => '2.00',
                    'unit_price_period' => '600.00',
                    'total_without_discount' => '1800.00',
                    'discount_rate' => '0.0000',
                    'total_discount' => '0.00',
                    'total_without_taxes' => '1800.00',
                    'taxes' => [
                        [
                            'name' => 'T.V.A.',
                            'is_rate' => true,
                            'value' => '20.000',
                        ],
                    ],
                    'unit_replacement_price' => '19400.00',
                    'total_replacement_price' => '58200.00',
                    'is_hidden_on_bill' => false,
                ],
            ],
            'extras' => [
                [
                    'id' => 1,
                    'invoice_id' => 2,
                    'description' => 'Services additionnels',
                    'unit_price' => '155.00',
                    'quantity' => 2,
                    'total_without_taxes' => '310.00',
                    'taxes' => [
                        [
                            'name' => 'Taxes diverses',
                            'is_rate' => false,
                            'value' => '10.00',
                        ],
                    ],
                ],
                [
                    'id' => 2,
                    'invoice_id' => 2,
                    'description' => 'Avoir facture du 17/12/2018',
                    'quantity' => 1,
                    'unit_price' => '-3100.00',
                    'total_without_taxes' => '-3100.00',
                    'taxes' => [],
                ],
            ],

            // - Remise.
            'total_without_global_discount' => '-909.67',
            'global_discount_rate' => '1.3923',
            'total_global_discount' => '0.00',

            // - Totaux.
            'total_without_taxes' => '-909.67',
            'total_taxes' => [
                [
                    'name' => 'T.V.A.',
                    'is_rate' => true,
                    'value' => '20.000',
                    'total' => '370.83',
                ],
                [
                    'name' => 'Taxes diverses',
                    'is_rate' => false,
                    'value' => '10.00',
                    'total' => '20.00',
                ],
            ],
            'total_with_taxes' => '-518.84',

            'total_replacement' => '58899.80',
            'currency' => 'EUR',
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
        $result = Invoice::createFromBooking($event, User::findOrFail(2));
        $expected = [
            'id' => 3,
            'number' => '2022-00002',
            'url' => 'http://loxya.test/invoices/3/pdf',
            'date' => '2022-10-22 18:42:36',
            'booking_type' => Event::TYPE,
            'booking_id' => 1,
            'booking_title' => 'Premier événement',
            'booking_reference' => null,
            'booking_start_date' => '2018-12-17 10:00:00',
            'booking_end_date' => '2018-12-18 18:00:00',
            'booking_is_full_days' => false,
            'beneficiary_id' => 1,

            'is_legacy' => false,
            'degressive_rate' => null,
            'daily_total' => null,

            'materials' => [
                [
                    'id' => 5,
                    'invoice_id' => 3,
                    'material_id' => 1,
                    'name' => 'Console Yamaha CL3',
                    'reference' => 'CL3',
                    'quantity' => 1,
                    'unit_price' => '200.00',
                    'degressive_rate' => '1.75',
                    'unit_price_period' => '350.00',
                    'total_without_discount' => '350.00',
                    'discount_rate' => '0.0000',
                    'total_discount' => '0.00',
                    'total_without_taxes' => '350.00',
                    'taxes' => [
                        [
                            'name' => 'T.V.A.',
                            'is_rate' => true,
                            'value' => '20.000',
                        ],
                    ],
                    'unit_replacement_price' => '19000.00',
                    'total_replacement_price' => '19000.00',
                    'is_hidden_on_bill' => false,
                ],
                [
                    'id' => 6,
                    'invoice_id' => 3,
                    'material_id' => 2,
                    'name' => 'DBX PA2',
                    'reference' => 'DBXPA2',
                    'quantity' => 1,
                    'unit_price' => '25.50',
                    'degressive_rate' => '1.75',
                    'unit_price_period' => '44.63',
                    'total_without_discount' => '44.63',
                    'discount_rate' => '0.0000',
                    'total_discount' => '0.00',
                    'total_without_taxes' => '44.63',
                    'taxes' => [
                        [
                            'name' => 'T.V.A.',
                            'is_rate' => true,
                            'value' => '20.000',
                        ],
                    ],
                    'unit_replacement_price' => '349.90',
                    'total_replacement_price' => '349.90',
                    'is_hidden_on_bill' => false,
                ],
                [
                    'id' => 7,
                    'invoice_id' => 3,
                    'material_id' => 4,
                    'name' => 'Showtec SDS-6',
                    'reference' => 'SDS-6-01',
                    'quantity' => 1,
                    'unit_price' => '15.95',
                    'degressive_rate' => '1.75',
                    'unit_price_period' => '27.91',
                    'total_without_discount' => '27.91',
                    'discount_rate' => '0.0000',
                    'total_discount' => '0.00',
                    'total_without_taxes' => '27.91',
                    'taxes' => [
                        [
                            'name' => 'T.V.A.',
                            'is_rate' => true,
                            'value' => '20.000',
                        ],
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
            'total_global_discount' => '42.25',

            // - Totaux.
            'total_without_taxes' => '380.29',
            'total_taxes' => [
                [
                    'name' => 'T.V.A.',
                    'is_rate' => true,
                    'value' => '20.000',
                    'total' => '76.06',
                ],
            ],
            'total_with_taxes' => '456.35',

            'total_replacement' => '19408.90',
            'currency' => 'EUR',
            'author_id' => 2,
            'metadata' => [
                'properties' => [
                    [
                        'id' => 1,
                        'name' => 'Poids',
                        'type' => 'float',
                        'unit' => 'kg',
                        'value' => '41.85',
                    ],
                    [
                        'id' => 3,
                        'name' => 'Puissance',
                        'type' => 'integer',
                        'unit' => 'W',
                        'value' => '945',
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

        // - Test simple.
        $invoice = Invoice::findOrFail(1);
        $result = $invoice->toPdf(new I18n('fr'));
        $this->assertInstanceOf(Pdf::class, $result);
        $this->assertSame('facture-testing-corp-2020-00001-jean-fountain.pdf', $result->getName());
        $this->assertMatchesHtmlSnapshot($result->getHtml());

        // - La même chose mais formaté pour la Suisse.
        $invoice = Invoice::findOrFail(1);
        $result = $invoice->toPdf(new I18n('fr_CH'));
        $this->assertInstanceOf(Pdf::class, $result);
        $this->assertMatchesHtmlSnapshot($result->getHtml());

        // - Une événement à l'heure près.
        $invoice = Invoice::createFromBooking(Event::findOrFail(1), User::findOrFail(2));
        $result = $invoice->toPdf(new I18n('en'));
        $this->assertInstanceOf(Pdf::class, $result);
        $this->assertMatchesHtmlSnapshot($result->getHtml());

        // - Une événement avec lignes additionnelles.
        $invoice = Invoice::createFromBooking(Event::findOrFail(2), User::findOrFail(2));
        $result = $invoice->toPdf(new I18n('en'));
        $this->assertInstanceOf(Pdf::class, $result);
        $this->assertMatchesHtmlSnapshot($result->getHtml());

        // - Avec des paramètres d'affichage différents.
        Setting::bulkEdit([
            'invoices.customText.title' => 'Test',
            'invoices.customText.content' => 'Un texte personnalisé modifié.',
            'invoices.showBookingDescription' => true,
            'invoices.showMobilizationPeriod' => true,
            'invoices.showTotalReplacementPrice' => true,
            'invoices.showTotalisableProperties' => true,
            'invoices.showPictures' => true,
            'invoices.showDescriptions' => true,
            'invoices.showReplacementPrices' => false,
            'invoices.showUnitPrices' => false,
        ]);

        $result = Invoice::findOrFail(1)->toPdf(new I18n('fr'));
        $this->assertInstanceOf(Pdf::class, $result);
        $this->assertSame('facture-testing-corp-2020-00001-jean-fountain.pdf', $result->getName());
        $this->assertMatchesHtmlSnapshot($result->getHtml());
    }

    public function testGetLastNumber(): void
    {
        $result = Invoice::getLastNumber(2099);
        $this->assertEquals(null, $result);

        $result = Invoice::getLastNumber(2020);
        $this->assertEquals('2020-00001', $result);
    }

    public function testGetNextNumber(): void
    {
        $result = Invoice::getNextNumber(2099);
        $this->assertEquals('2099-00001', $result);

        $result = Invoice::getNextNumber(2020);
        $this->assertEquals('2020-00002', $result);
    }
}
