<?php
declare(strict_types=1);

namespace Loxya\Tests;

use Brick\Math\BigDecimal as Decimal;
use Illuminate\Support\Carbon;
use Loxya\Models\Beneficiary;
use Loxya\Models\Estimate;
use Loxya\Models\Event;
use Loxya\Models\Setting;
use Loxya\Models\User;
use Loxya\Services\I18n;
use Loxya\Support\Pdf\Pdf;
use Loxya\Support\Period;

final class EstimateTest extends TestCase
{
    public function testValidation(): void
    {
        $estimate = new Estimate([
            'date' => '',
            'booking_start_date' => null,
            'booking_end_date' => null,
            'total_without_taxes' => '1000000000000.00',
            'total_replacement' => '-20.00',
            'currency' => 'a',
        ]);
        $estimate->booking()->associate(Event::findOrFail(1));
        $estimate->beneficiary()->associate(Beneficiary::findOrFail(1));
        $expectedErrors = [
            'date' => "Ce champ est obligatoire.",
            'total_replacement' => "Ce champ est invalide.",
            'currency' => 'Ce champ est invalide.',
            'booking_start_date' => "Ce champ est obligatoire.",
            'booking_end_date' => "Ce champ est obligatoire.",
            'booking_is_full_days' => "Ce champ doit être un booléen.",
            'total_without_global_discount' => "Ce champ doit contenir un chiffre à virgule.",
            'global_discount_rate' => "Ce champ doit contenir un chiffre à virgule.",
            'total_global_discount' => "Ce champ doit contenir un chiffre à virgule.",
            'total_without_taxes' => "Ce champ est invalide.",
            'total_with_taxes' => "Ce champ doit contenir un chiffre à virgule.",
        ];
        $this->assertFalse($estimate->isValid());
        $this->assertSameCanonicalize($expectedErrors, $estimate->validationErrors());

        // - Test de validation du taux de remise.
        $estimate = new Estimate([
            'date' => '2024-01-19 16:00:00',
            'booking_period' => new Period('2018-12-17', '2018-12-18', true),
            'total_without_global_discount' => '1750.00',
            'global_discount_rate' => '100.00',
            'total_global_discount' => '1750.00',
            'total_without_taxes' => '0.00',
            'total_taxes' => [],
            'total_with_taxes' => '0.00',
            'currency' => 'EUR',
            'total_replacement' => '2000.00',
        ]);
        $estimate->booking()->associate(Event::findOrFail(1));
        $estimate->beneficiary()->associate(Beneficiary::findOrFail(1));
        $this->assertTrue($estimate->isValid());
    }

    public function testCreateFromEvent(): void
    {
        static::setNow(Carbon::create(2022, 10, 22, 18, 42, 36));

        // - Avec un événement au jour entier.
        $event = tap(Event::findOrFail(2), static function ($event) {
            $event->global_discount_rate = Decimal::of('1.3923');
        });
        $result = Estimate::createFromBooking($event, User::findOrFail(1));
        $expected = [
            'id' => 3,
            'date' => '2022-10-22 18:42:36',
            'url' => 'http://loxya.test/estimates/3/pdf',
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
                    'id' => 7,
                    'estimate_id' => 3,
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
                    'id' => 8,
                    'estimate_id' => 3,
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
                    'id' => 2,
                    'estimate_id' => 3,
                    'description' => "Services additionnels",
                    'quantity' => 2,
                    'unit_price' => '155.00',
                    'total_without_taxes' => '310.00',
                    'taxes' => [
                        [
                            'name' => "Taxes diverses",
                            'is_rate' => false,
                            'value' => '10.00',
                        ],
                    ],
                ],
                [
                    'id' => 3,
                    'estimate_id' => 3,
                    'description' => "Avoir facture du 17/12/2018",
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
                    'name' => "Taxes diverses",
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
        $result['total_taxes'] = $result['total_taxes'] === null ? null : (
            array_map(
                static fn ($tax) => array_replace($tax, [
                    'value' => (string) $tax['value'],
                    'total' => (string) $tax['total'],
                ]),
                $result['total_taxes'],
            )
        );
        $this->assertEquals($expected, $result);

        // - Avec un événement à l'heure près.
        $result = Estimate::createFromBooking(Event::findOrFail(1), User::findOrFail(2));
        $expected = [
            'id' => 4,
            'url' => 'http://loxya.test/estimates/4/pdf',
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
                    'id' => 9,
                    'estimate_id' => 4,
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
                    'id' => 10,
                    'estimate_id' => 4,
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
                    'id' => 11,
                    'estimate_id' => 4,
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

        // - Test simple (legacy).
        $result = Estimate::findOrFail(2)->toPdf(new I18n('fr'));
        $this->assertInstanceOf(Pdf::class, $result);
        $this->assertSame('devis-testing-corp-20210130-1400-jean-fountain.pdf', $result->getName());
        $this->assertMatchesHtmlSnapshot($result->getHtml());

        // - Test simple.
        $result = Estimate::findOrFail(1)->toPdf(new I18n('fr'));
        $this->assertInstanceOf(Pdf::class, $result);
        $this->assertSame('devis-testing-corp-20210130-1400-jean-fountain.pdf', $result->getName());
        $this->assertMatchesHtmlSnapshot($result->getHtml());

        // - Un événement à l'heure près.
        $estimate = Estimate::createFromBooking(Event::findOrFail(1), User::findOrFail(2));
        $result = $estimate->toPdf(new I18n('en'));
        $this->assertInstanceOf(Pdf::class, $result);
        $this->assertMatchesHtmlSnapshot($result->getHtml());

        // - Avec des paramètres d'affichage différents.
        Setting::bulkEdit([
            'estimates.customText.title' => 'Test',
            'estimates.customText.content' => 'Un texte personnalisé modifié.',
            'estimates.showBookingDescription' => true,
            'estimates.showMobilizationPeriod' => true,
            'estimates.showTotalReplacementPrice' => true,
            'estimates.showTotalisableProperties' => true,
            'estimates.showPictures' => true,
            'estimates.showDescriptions' => true,
            'estimates.showReplacementPrices' => false,
            'estimates.showUnitPrices' => false,
        ]);

        $result = Estimate::findOrFail(1)->toPdf(new I18n('fr'));
        $this->assertInstanceOf(Pdf::class, $result);
        $this->assertSame('devis-testing-corp-20210130-1400-jean-fountain.pdf', $result->getName());
        $this->assertMatchesHtmlSnapshot($result->getHtml());
    }
}
