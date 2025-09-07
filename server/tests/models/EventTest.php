<?php
declare(strict_types=1);

namespace Loxya\Tests;

use Illuminate\Support\Carbon;
use Loxya\Errors\Exception\ValidationException;
use Loxya\Models\Event;
use Loxya\Models\Property;
use Loxya\Models\User;
use Loxya\Services\I18n;
use Loxya\Support\Arr;
use Loxya\Support\Pdf\Pdf;
use Loxya\Support\Period;

final class EventTest extends TestCase
{
    public function testInPeriodScope(): void
    {
        // - Récupère les événements de 2018
        $result = Event::inPeriod(new Period('2018-01-01', '2018-12-31'))->get();
        $expected = [
            [
                'id' => 3,
                'title' => "Avant-premier événement",
                'description' => null,
                'reference' => null,
                'mobilization_start_date' => '2018-12-15 08:30:00',
                'mobilization_end_date' => '2018-12-16 15:45:00',
                'operation_start_date' => '2018-12-15 09:00:00',
                'operation_end_date' => '2018-12-17 00:00:00',
                'operation_is_full_days' => false,
                'color' => null,
                'is_confirmed' => false,
                'is_archived' => true,
                'location' => "Brousse",
                'materials_count' => 23,
                'is_billable' => false,
                'currency' => 'EUR',
                'total_without_global_discount' => null,
                'global_discount_rate' => null,
                'total_global_discount' => null,
                'total_without_taxes' => null,
                'total_taxes' => null,
                'total_with_taxes' => null,
                'is_departure_inventory_done' => true,
                'departure_inventory_datetime' => '2018-12-15 08:17:00',
                'departure_inventory_author_id' => 1,
                'is_return_inventory_done' => true,
                'return_inventory_datetime' => '2018-12-16 15:42:00',
                'return_inventory_author_id' => 1,
                'note' => null,
                'author_id' => 1,
                'manager_id' => null,
                'preparer_id' => null,
                'request_id' => null,
                'created_at' => '2018-12-14 12:20:00',
                'updated_at' => '2018-12-14 12:30:00',
                'deleted_at' => null,
            ],
            [
                'id' => 1,
                'title' => "Premier événement",
                'description' => null,
                'reference' => null,
                'mobilization_start_date' => '2018-12-16 15:45:00',
                'mobilization_end_date' => '2018-12-19 00:00:00',
                'operation_start_date' => '2018-12-17 10:00:00',
                'operation_end_date' => '2018-12-18 18:00:00',
                'operation_is_full_days' => false,
                'color' => null,
                'is_confirmed' => false,
                'is_archived' => false,
                'location' => "Gap",
                'materials_count' => 3,
                'is_billable' => true,
                'currency' => 'EUR',
                'total_without_global_discount' => '422.54',
                'global_discount_rate' => '10.0000',
                'total_global_discount' => '42.25',
                'total_without_taxes' => '380.29',
                'total_taxes' => [
                    [
                        'name' => 'T.V.A.',
                        'value' => '20.000',
                        'is_rate' => true,
                        'total' => '76.06',
                    ],
                ],
                'total_with_taxes' => '456.35',
                'is_departure_inventory_done' => true,
                'departure_inventory_datetime' => '2018-12-16 15:35:00',
                'departure_inventory_author_id' => 1,
                'is_return_inventory_done' => true,
                'return_inventory_datetime' => null,
                'return_inventory_author_id' => null,
                'note' => null,
                'author_id' => 1,
                'manager_id' => 2,
                'preparer_id' => null,
                'request_id' => null,
                'created_at' => '2018-12-01 12:50:45',
                'updated_at' => '2018-12-05 08:31:21',
                'deleted_at' => null,
            ],
            [
                'id' => 2,
                'title' => "Second événement",
                'description' => null,
                'reference' => null,
                'mobilization_start_date' => '2018-12-18 00:00:00',
                'mobilization_end_date' => '2018-12-20 00:00:00',
                'operation_start_date' => '2018-12-18 00:00:00',
                'operation_end_date' => '2018-12-20 00:00:00',
                'operation_is_full_days' => true,
                'color' => '#ffba49',
                'is_confirmed' => false,
                'is_archived' => false,
                'location' => "Lyon",
                'materials_count' => 5,
                'is_billable' => true,
                'currency' => 'EUR',
                'total_without_global_discount' => '-909.67',
                'global_discount_rate' => '0.0000',
                'total_global_discount' => '0.00',
                'total_without_taxes' => '-909.67',
                'total_taxes' => [
                    [
                        'name' => 'T.V.A.',
                        'is_rate' => true,
                        'value' => '20.000',
                        'total' => '376.07',
                    ],
                    [
                        'name' => 'Taxes diverses',
                        'is_rate' => false,
                        'value' => '10.00',
                        'total' => '20.00',
                    ],
                ],
                'total_with_taxes' => '-513.60',
                'is_departure_inventory_done' => false,
                'departure_inventory_datetime' => null,
                'departure_inventory_author_id' => null,
                'is_return_inventory_done' => true,
                'return_inventory_datetime' => '2018-12-20 14:30:00',
                'return_inventory_author_id' => 2,
                'note' => "Il faudra envoyer le matériel sur Lyon avant l'avant-veille.",
                'author_id' => 1,
                'manager_id' => 1,
                'preparer_id' => null,
                'request_id' => null,
                'created_at' => '2018-12-16 12:50:45',
                'updated_at' => null,
                'deleted_at' => null,
            ],
        ];
        $this->assertCount(3, $result);
        $this->assertEquals($expected, $result->toArray());

        // - Récupère les événements de la fin décembre 2018.
        $results = Event::inPeriod(new Period('2018-12-19', '2018-12-31'))->get();
        $this->assertCount(1, $results);
        $this->assertEquals(2, $results[0]->id);

        // - Doit accepter les formats relatifs.
        $results = Event::query()
            ->inPeriod(new Period(
                'first day of December 2018', // -> `2018-12-01`
                'third sun of December 2018', // -> `2018-12-16`
            ))
            ->get();
        $this->assertCount(1, $results);
        $this->assertEquals(3, $results[0]->id);
    }

    public function testSearchScope(): void
    {
        // - Retourne les événements qui ont le terme "premier" dans le titre.
        $this->assertEquals(
            [
                1 => 'Premier événement',
                3 => 'Avant-premier événement',
            ],
            Event::search('premier')
                ->get()->pluck('title', 'id')->all(),
        );

        // - Retourne les événements qui ont un bénéficiaire, un auteur,
        //   ou un chef de projet dont le nom contient "tain".
        $this->assertSame(
            [
                1 => 'Premier événement',
                2 => 'Second événement',
                3 => 'Avant-premier événement',
                4 => 'Concert X',
                5 => "Kermesse de l'école des trois cailloux",
                6 => 'Un événement sans inspiration',
                7 => 'Médiévales de Machin-le-chateau 2023',
                8 => 'Japan Festival 2024',
            ],
            Event::search('tain')
                ->get()->pluck('title', 'id')->all(),
        );
    }

    public function testMissingMaterials(): void
    {
        // - No missing materials for event #3
        $result = Event::find(3)->missingMaterials();
        $this->assertTrue($result->isEmpty());

        // - Get missing materials of event #1
        $result = Event::find(1)->missingMaterials();
        $this->assertCount(1, $result);
        $this->assertEquals('DBXPA2', $result->get(0)['reference']);
        $this->assertEquals(1, $result->get(0)['quantity_missing']);

        // - Get missing materials of event #4
        $result = Event::find(4)->missingMaterials();
        $this->assertCount(1, $result);
        $this->assertEquals('V-1', $result->get(0)['reference']);
        $this->assertEquals(1, $result->get(0)['quantity_missing']);

        // - Get missing materials of event #5
        $result = Event::find(5)->missingMaterials();
        $this->assertCount(0, $result);
    }

    public function testHasMissingMaterials(): void
    {
        static::setNow(Carbon::create(2024, 2, 26, 13, 40, 0));

        // - L'événement #1 contient des pénuries.
        $event = tap(Event::findOrFail(1), static function (Event $event) {
            $event->is_return_inventory_done = false;
            $event->return_inventory_datetime = null;
            $event->return_inventory_author_id = null;
            $event->mobilization_end_date = '2024-02-26 13:30:00';
            $event->save();
            $event->refresh();
        });
        $this->assertTrue($event->has_missing_materials);

        // - L'événement #3 est archivé, pas de calcul des pénuries.
        $event = tap(Event::findOrFail(3), static function (Event $event) {
            // - On met à jour les dates (en annulant l'archivage + inventaire de retour)
            $event->is_archived = false;
            $event->is_departure_inventory_done = false;
            $event->departure_inventory_datetime = null;
            $event->departure_inventory_author_id = null;
            $event->is_return_inventory_done = false;
            $event->return_inventory_datetime = null;
            $event->return_inventory_author_id = null;
            $event->mobilization_period = new Period('2024-02-25 13:30:00', '2024-02-26 13:30:00', false);
            $event->operation_period = new Period('2024-02-26', '2024-02-26', true);
            $event->save();

            // - Puis on ré-active l'inventaire de retour + on ré-archive ...
            $event->is_archived = true;
            $event->is_departure_inventory_done = true;
            $event->departure_inventory_datetime = '2024-02-25 13:30:00';
            $event->is_return_inventory_done = true;
            $event->return_inventory_datetime = '2024-02-26 13:30:00';
            $event->save();
            $event->refresh();
        });
        $this->assertNull($event->has_missing_materials);

        // - L'événement #3 lorsqu'il est désarchivé, ne contient pas de pénurie.
        $event = tap(Event::findOrFail(3), static function (Event $event) {
            $event->is_archived = false;
            $event->is_return_inventory_done = false;
            $event->return_inventory_datetime = null;
            $event->return_inventory_author_id = null;
            $event->save();
            $event->refresh();
        });
        $this->assertFalse($event->has_missing_materials);
    }

    public function testHasNotReturnedMaterials(): void
    {
        // - Event #1 does not have material not returned
        $this->assertFalse(Event::findOrFail(1)->has_not_returned_materials);

        // - Event #2 have some materials not returned.
        $this->assertTrue(Event::findOrFail(2)->has_not_returned_materials);

        // - L'événement #3 est archivé, pas de calcul du matériel non retourné.
        $this->assertNull(Event::findOrFail(3)->has_not_returned_materials);
    }

    public function testTotalWithoutGlobalDiscount(): void
    {
        $this->assertEquals('422.54', (string) Event::find(1)->total_without_global_discount);
    }

    public function testTotalReplacement(): void
    {
        $this->assertEquals('19408.90', (string) Event::find(1)->total_replacement);
    }

    public function testGetParksAttribute(): void
    {
        // - Events qui ont du matériel dans un seul parc
        foreach ([1, 2, 3, 5] as $eventId) {
            $event = Event::find($eventId);
            $this->assertEquals([1], $event->parks);
        }

        // - Event qui a du matériel dans deux parcs
        $event = Event::find(4);
        $this->assertEquals([1, 2], $event->parks);

        // - Event sans matériel
        $event = Event::find(6);
        $this->assertEquals([], $event->parks);
    }

    public function testValidateEventDates(): void
    {
        $data = [
            'title' => "Test dates validation",
            'mobilization_period' => new Period('2020-02-27 14:30:00', '2020-03-06 10:00:00'),
            'operation_period' => new Period('2020-03-01', '2020-03-04', false),
            'is_confirmed' => false,
            'author_id' => 1,
        ];

        // - Pas de soucis au niveau des dates.
        $this->assertTrue((new Event($data))->isValid());

        // - Erreur: La date de fin est avant la date de début.
        $testData = array_merge($data, [
            'mobilization_period' => new Period('2020-03-01 00:00:00', '2020-03-05 00:00:00', false),
            'operation_start_date' => '2020-03-01 00:00:00',
            'operation_end_date' => '2020-02-21 00:00:00',
            'operation_is_full_days' => false,
        ]);
        $expectedErrors = [
            'operation_end_date' => "La date de fin doit être postérieure à la date de début.",
        ];
        $this->assertSameCanonicalize($expectedErrors, (new Event($testData))->validationErrors());

        // - Erreur: Les dates de mobilisation ne sont pas arrondies au quart d'heure près.
        $testData = array_merge($data, [
            'mobilization_period' => new Period('2020-02-27 14:12:00', '2020-03-06 10:02:30'),
        ]);
        $expectedErrors = [
            'mobilization_end_date' => "La date doit être arrondie au quart d'heure le plus proche.",
            'mobilization_start_date' => "La date doit être arrondie au quart d'heure le plus proche.",
        ];
        $this->assertSameCanonicalize($expectedErrors, (new Event($testData))->validationErrors());
    }

    public function testValidateIsArchived(): void
    {
        $baseData = [
            'title' => "Test is_archived validation",
            'is_billable' => true,
            'global_discount_rate' => 0,
            'operation_period' => new Period('2020-03-01', '2020-03-03', true),
            'mobilization_period' => new Period('2020-03-01', '2020-03-03', true),
            'is_confirmed' => false,
            'currency' => 'EUR',
            'author_id' => 1,
        ];

        // - Pas de soucis: L'événement a un inventaire de retour.
        $event1 = new Event($baseData);
        $event1->is_return_inventory_done = true;
        $event1->is_archived = true;
        $this->assertTrue($event1->isValid());

        // - Pas de soucis: L'événement n'est pas archivé.
        $event2 = new Event($baseData);
        $event2->is_return_inventory_done = true;
        $event2->is_archived = false;
        $this->assertTrue($event2->isValid());

        // - Soucis: L'événement n'a pas d'inventaire de retour.
        $event3 = new Event($baseData);
        $event3->is_return_inventory_done = false;
        $event3->is_archived = true;
        $expectedErrors = [
            'is_archived' => (
                "Un événement ne peut pas être archivé si son " .
                "inventaire de retour n'a pas encore été effectué !"
            ),
        ];
        $this->assertFalse($event3->isValid());
        $this->assertSameCanonicalize($expectedErrors, $event3->validationErrors());
    }

    public function testValidateIsArchivedNotPast(): void
    {
        $event = new Event([
            'title' => "Test is_archive validation failure",
            'operation_period' => new Period('2120-03-01', '2120-03-03', true),
            'mobilization_period' => new Period('2120-03-01 00:00:00', '2120-03-04 00:00:00'),
            'is_confirmed' => true,
            'author_id' => 1,
        ]);
        $event->is_archived = true;
        $expectedErrors = [
            'is_archived' => (
                "Un événement ne peut pas être archivé si son " .
                "inventaire de retour n'a pas encore été effectué !"
            ),
        ];
        $this->assertFalse($event->isValid());
        $this->assertSameCanonicalize($expectedErrors, $event->validationErrors());
    }

    public function testValidateReference(): void
    {
        $data = [
            'title' => "Test dates validation",
            'mobilization_period' => new Period('2020-03-01', '2020-03-03', true),
            'operation_period' => new Period('2020-03-01', '2020-03-03', true),
            'is_confirmed' => false,
            'author_id' => 1,
        ];

        foreach (['REF1', null] as $testValue) {
            $testData = array_merge($data, ['reference' => $testValue]);
            $this->assertTrue((new Event($testData))->isValid());
        }

        $event = new Event(array_merge($data, ['reference' => 'forb1dden-ch@rs']));
        $expectedErrors = [
            'reference' => "Ce champ contient des caractères non autorisés.",
        ];
        $this->assertFalse($event->isValid());
        $this->assertSameCanonicalize($expectedErrors, $event->validationErrors());
    }

    public function testValidation(): void
    {
        $generateEvent = static function (array $data = []): Event {
            $data = Arr::defaults($data, [
                'title' => "Les vieilles charrues",
                'mobilization_period' => new Period('2020-02-22', '2020-04-03', true),
                'operation_period' => new Period('2020-03-01', '2020-03-03', true),
                'is_confirmed' => false,
                'author_id' => 1,
            ]);
            return new Event($data);
        };

        // - Avec des données valides.
        $this->assertTrue($generateEvent()->isValid());
        $this->assertTrue(Event::findOrFail(1)->isValid());

        // - Avec des erreurs de base...
        $event = $generateEvent([
            'title' => '',
            'color' => 'not-a-color',
        ]);
        $expectedErrors = [
            'title' => "Ce champ est obligatoire.",
            'color' => "Code de couleur invalide (doit être un code hexadécimal).",
        ];
        $this->assertFalse($event->isValid());
        $this->assertSame($expectedErrors, $event->validationErrors());
    }

    public function testToPdf(): void
    {
        static::setNow(Carbon::create(2022, 9, 23, 12, 0, 0));

        $result = Event::findOrFail(1)->toPdf(new I18n('fr_CH'));
        $this->assertInstanceOf(Pdf::class, $result);
        $this->assertSame('fiche-de-sortie-testing-corp-premier-evenement.pdf', $result->getName());
        $this->assertMatchesHtmlSnapshot($result->getHtml());

        $result = Event::findOrFail(2)->toPdf(new I18n('en'));
        $this->assertInstanceOf(Pdf::class, $result);
        $this->assertSame('release-sheet-testing-corp-second-evenement.pdf', $result->getName());
        $this->assertMatchesHtmlSnapshot($result->getHtml());
    }

    public function testEdit(): void
    {
        static::setNow(Carbon::create(2019, 2, 20, 13, 30, 0));

        $event = Event::findOrFail(4)->edit([
            'title' => ' Test update ',
            'description' => '',
            'beneficiaries' => [3],
            'technicians' => [
                [
                    'id' => 1,
                    'role_id' => 1,
                    'period' => new Period('2019-03-01 10:00:00', '2019-03-02 19:00:00'),
                ],
                [
                    'id' => 2,
                    'role_id' => 2,
                    'period' => new Period('2019-03-02 09:00:00', '2019-03-02 16:00:00'),
                ],
            ],
            'materials' => [
                [ 'id' => 3, 'quantity' => 20 ],
                [ 'id' => 2, 'quantity' => 3 ],
                [ 'id' => 5, 'quantity' => 14 ],
                [ 'id' => 1, 'quantity' => 8 ],
                [ 'id' => 6, 'quantity' => 1 ],
            ],
        ]);
        $this->assertSameCanonicalize(
            [
                'id' => 4,
                'title' => "Test update",
                'mobilization_end_date' => '2019-04-11 00:00:00',
                'mobilization_start_date' => '2019-03-01 00:00:00',
                'operation_start_date' => '2019-03-01 00:00:00',
                'operation_end_date' => '2019-04-11 00:00:00',
                'operation_is_full_days' => true,
                'color' => '#ef5b5b',
                'location' => 'Moon',
                'reference' => null,
                'description' => null,
                'manager_id' => null,
                'preparer_id' => null,
                'request_id' => null,
                'materials_count' => 46,
                'is_return_inventory_started' => false,
                'has_missing_materials' => true,
                'is_archived' => false,
                'is_billable' => false,
                'is_confirmed' => false,
                'currency' => 'EUR',
                'total_without_global_discount' => null,
                'global_discount_rate' => null,
                'total_global_discount' => null,
                'total_without_taxes' => null,
                'total_taxes' => null,
                'total_with_taxes' => null,
                'total_replacement' => '158212.69',
                'is_departure_inventory_done' => false,
                'departure_inventory_author_id' => null,
                'departure_inventory_datetime' => null,
                'is_return_inventory_done' => false,
                'return_inventory_author_id' => null,
                'return_inventory_datetime' => null,
                'positions' => [
                    [
                        'id' => 5,
                        'event_id' => 4,
                        'role_id' => 1,
                        'name' => "Régisseur",
                        'is_mandatory' => false,
                        'is_assigned' => true,
                    ],
                    [
                        'id' => 6,
                        'event_id' => 4,
                        'role_id' => 2,
                        'name' => "Technicien plateau",
                        'is_mandatory' => false,
                        'is_assigned' => true,
                    ],
                ],
                'beneficiaries' => [
                    [
                        'id' => 3,
                        'person_id' => 3,
                        'user_id' => null,
                        'reference' => '0003',
                        'last_name' => 'Benef',
                        'first_name' => 'Client',
                        'full_name' => 'Client Benef',
                        'email' => 'client@beneficiaires.com',
                        'street' => '156 bis, avenue des tests poussés',
                        'postal_code' => '88080',
                        'locality' => 'Wazzaville',
                        'phone' => '+33123456789',
                        'country_id' => null,
                        'full_address' => "156 bis, avenue des tests poussés\n88080 Wazzaville",
                        'company_id' => null,
                        'can_make_reservation' => 0,
                        'color' => null,
                        'note' => null,
                        'created_at' => '2018-01-01 00:02:00',
                        'updated_at' => '2022-01-01 00:02:00',
                        'deleted_at' => null,
                    ],
                ],
                'technicians' => [
                    [
                        'id' => 4,
                        'event_id' => 4,
                        'technician_id' => 1,
                        'start_date' => '2019-03-01 10:00:00',
                        'end_date' => '2019-03-02 19:00:00',
                        'role_id' => 1,
                    ],
                    [
                        'id' => 5,
                        'event_id' => 4,
                        'technician_id' => 2,
                        'start_date' => '2019-03-02 09:00:00',
                        'end_date' => '2019-03-02 16:00:00',
                        'role_id' => 2,
                    ],
                ],
                'materials' => [
                    [
                        'id' => 10,
                        'event_id' => 4,
                        'material_id' => 6,
                        'reference' => 'XR18',
                        'name' => 'Behringer X Air XR18',
                        'category_id' => 1,
                        'quantity' => 1,
                        'unit_price' => null,
                        'degressive_rate' => null,
                        'unit_price_period' => null,
                        'discount_rate' => null,
                        'taxes' => null,
                        'total_without_discount' => null,
                        'total_discount' => null,
                        'total_without_taxes' => null,
                        'unit_replacement_price' => '49.99',
                        'total_replacement_price' => '49.99',
                        'quantity_departed' => 1,
                        'quantity_returned' => 1,
                        'quantity_returned_broken' => 0,
                        'departure_comment' => null,
                    ],
                    [
                        'id' => 20,
                        'event_id' => 4,
                        'material_id' => 5,
                        'reference' => 'XLR10',
                        'name' => 'Câble XLR 10m',
                        'category_id' => null,
                        'quantity' => 14,
                        'unit_price' => null,
                        'degressive_rate' => null,
                        'unit_price_period' => null,
                        'discount_rate' => null,
                        'taxes' => null,
                        'total_without_discount' => null,
                        'total_discount' => null,
                        'total_without_taxes' => null,
                        'unit_replacement_price' => '9.50',
                        'total_replacement_price' => '133.00',
                        'quantity_departed' => null,
                        'quantity_returned' => null,
                        'quantity_returned_broken' => null,
                        'departure_comment' => null,
                    ],
                    [
                        'id' => 9,
                        'event_id' => 4,
                        'material_id' => 1,
                        'reference' => 'CL',
                        'name' => 'Console Yamaha CL3',
                        'category_id' => 1,
                        'quantity' => 8,
                        'unit_price' => null,
                        'degressive_rate' => null,
                        'unit_price_period' => null,
                        'discount_rate' => null,
                        'taxes' => null,
                        'total_without_discount' => null,
                        'total_discount' => null,
                        'total_without_taxes' => null,
                        'unit_replacement_price' => '19400.00',
                        'total_replacement_price' => '155200.00',
                        'quantity_departed' => null,
                        'quantity_returned' => 0,
                        'quantity_returned_broken' => 0,
                        'departure_comment' => null,
                    ],
                    [
                        'id' => 18,
                        'event_id' => 4,
                        'material_id' => 3,
                        'reference' => 'PAR64LED',
                        'name' => 'PAR64 LED',
                        'category_id' => 2,
                        'quantity' => 20,
                        'unit_price' => null,
                        'degressive_rate' => null,
                        'unit_price_period' => null,
                        'discount_rate' => null,
                        'taxes' => null,
                        'total_without_discount' => null,
                        'total_discount' => null,
                        'total_without_taxes' => null,
                        'unit_replacement_price' => '89.00',
                        'total_replacement_price' => '1780.00',
                        'quantity_departed' => null,
                        'quantity_returned' => null,
                        'quantity_returned_broken' => null,
                        'departure_comment' => null,
                    ],
                    [
                        'id' => 19,
                        'event_id' => 4,
                        'material_id' => 2,
                        'reference' => 'DBXPA2',
                        'name' => 'Processeur DBX PA2',
                        'category_id' => 1,
                        'unit_price' => null,
                        'degressive_rate' => null,
                        'unit_price_period' => null,
                        'discount_rate' => null,
                        'quantity' => 3,
                        'taxes' => null,
                        'total_without_discount' => null,
                        'total_discount' => null,
                        'total_without_taxes' => null,
                        'unit_replacement_price' => '349.90',
                        'total_replacement_price' => '1049.70',
                        'quantity_departed' => null,
                        'quantity_returned' => null,
                        'quantity_returned_broken' => null,
                        'departure_comment' => null,
                    ],
                ],
                'note' => 'Penser à contacter Cap Canaveral fin janvier pour booker le pas de tir.',
                'author_id' => 1,
                'created_at' => '2019-01-01 20:12:00',
                'updated_at' => '2019-02-20 13:30:00',
                'deleted_at' => null,
            ],
            $event
                ->append([
                    'is_return_inventory_started',
                    'has_missing_materials',
                    'total_replacement',
                    'beneficiaries',
                    'technicians',
                    'materials',
                    'positions',
                ])
                ->toArray(),
        );
    }

    public function testEditBadBeneficiaries(): void
    {
        static::setNow(Carbon::create(2019, 2, 20, 13, 30, 0));

        $this->expectException(\InvalidArgumentException::class);
        Event::findOrFail(4)->edit(['beneficiaries' => 'not_an_array']);
    }

    public function testEditBadTechnicians(): void
    {
        static::setNow(Carbon::create(2019, 2, 20, 13, 30, 0));

        $this->expectException(\InvalidArgumentException::class);
        Event::findOrFail(4)->edit(['technicians' => 'not_an_array']);
    }

    public function testEditBadMaterials(): void
    {
        static::setNow(Carbon::create(2019, 2, 20, 13, 30, 0));

        $this->expectException(\InvalidArgumentException::class);
        Event::findOrFail(4)->edit(['materials' => 'not_an_array']);
    }

    public function testSyncBeneficiaries(): void
    {
        static::setNow(Carbon::create(2019, 2, 20, 13, 30, 0));

        $beneficiaries = [2, 3];
        $event = Event::findOrFail(4);
        $event->syncBeneficiaries($beneficiaries);
        $this->assertEquals(2, count($event->beneficiaries));
        $this->assertEquals('Roger Rabbit', $event->beneficiaries[0]['full_name']);
        $this->assertEquals('Client Benef', $event->beneficiaries[1]['full_name']);
    }

    public function testSyncTechnicians(): void
    {
        static::setNow(Carbon::create(2019, 2, 20, 13, 30, 0));

        $technicians = [
            [
                'id' => 1,
                'role_id' => 1,
                'period' => new Period('2019-03-01 08:00:00', '2019-03-01 20:00:00'),
            ],
            [
                'id' => 1,
                'role_id' => 2,
                'period' => new Period('2019-04-10 08:00:00', '2019-04-10 20:00:00'),
            ],
            [
                'id' => 2,
                'role_id' => 1,
                'period' => new Period('2019-03-02 10:00:00', '2019-04-09 17:00:00'),
            ],
        ];
        $event = Event::findOrFail(4);
        $event->syncTechnicians($technicians);

        $this->assertCount(3, $event->technicians);
        $this->assertEquals('Roger Rabbit', $event->technicians[0]['technician']['full_name']);
        $this->assertEquals('2019-03-01 08:00:00', $event->technicians[0]['start_date']);
        $this->assertEquals('2019-03-01 20:00:00', $event->technicians[0]['end_date']);
        $this->assertEquals(1, $event->technicians[0]['role_id']);
        $this->assertEquals('Jean Technicien', $event->technicians[1]['technician']['full_name']);
        $this->assertEquals('2019-03-02 10:00:00', $event->technicians[1]['start_date']);
        $this->assertEquals('2019-04-09 17:00:00', $event->technicians[1]['end_date']);
        $this->assertEquals(1, $event->technicians[1]['role_id']);
        $this->assertEquals('Roger Rabbit', $event->technicians[2]['technician']['full_name']);
        $this->assertEquals('2019-04-10 08:00:00', $event->technicians[2]['start_date']);
        $this->assertEquals('2019-04-10 20:00:00', $event->technicians[2]['end_date']);
        $this->assertEquals(2, $event->technicians[2]['role_id']);

        $expectedEventPositions = [
            [
                'id' => 5,
                'event_id' => 4,
                'role_id' => 1,
                'name' => "Régisseur",
                'is_mandatory' => false,
                'is_assigned' => true,
            ],
            [
                'id' => 6,
                'event_id' => 4,
                'role_id' => 2,
                'name' => "Technicien plateau",
                'is_mandatory' => false,
                'is_assigned' => true,
            ],
        ];
        $this->assertCount(2, $event->positions);
        $this->assertSameCanonicalize($expectedEventPositions, $event->positions);
    }

    public function testSyncTechniciansValidationErrors(): void
    {
        static::setNow(Carbon::create(2019, 2, 20, 13, 30, 0));

        $errors = null;
        try {
            Event::findOrFail(4)->syncTechnicians([
                [
                    'id' => 1,
                    'role_id' => 999,
                    'period' => new Period('2019-03-01 20:00:00', '2019-03-02 08:00:00'),
                ],
                [
                    'id' => 2,
                    'role_id' => 2,
                    'period' => new Period('2019-04-10 10:00:00', '2019-04-11 17:00:00'),
                ],
            ]);
        } catch (ValidationException $e) {
            $errors = $e->getValidationErrors();
        }

        $expectedErrors = [
            1 => [
                'role_id' => "Ce champ est invalide.",
            ],
            2 => [
                'start_date' => "La période d'assignation du technicien est en dehors de la période de l'événement.",
                'end_date' => "La période d'assignation du technicien est en dehors de la période de l'événement.",
            ],
        ];
        $this->assertEquals($expectedErrors, $errors);
    }

    public function testSyncMaterials(): void
    {
        static::setNow(Carbon::create(2019, 2, 20, 13, 30, 0));

        $materials = [
            ['id' => 2, 'quantity' => 4],
            ['id' => 1, 'quantity' => 7],
            ['id' => 6, 'quantity' => 2],
        ];
        $event = Event::findOrFail(4);
        $event->syncMaterials($materials);
        $this->assertCount(3, $event->materials);

        $expectedData = [
            ['material_id' => 1, 'quantity' => 7],
            ['material_id' => 2, 'quantity' => 4],
            ['material_id' => 6, 'quantity' => 2],
        ];
        $materials = $event->materials->sortBy('material_id')->values();
        foreach ($expectedData as $index => $expected) {
            $this->assertArrayHasKey($index, $materials);
            $resultMaterial = $materials[$index];

            $this->assertEquals($expected['material_id'], $resultMaterial['material_id']);
            $this->assertEquals($expected['quantity'], $resultMaterial['quantity']);
        }
    }

    public function testDuplicateBadData(): void
    {
        $this->expectException(ValidationException::class);
        Event::findOrFail(1)->duplicate([
            // - Période invalide: La start date ne contient pas une heure pile.
            'operation_period' => new Period('2021-08-01 10:38:20', '2021-08-02'),
        ]);
    }

    public function testDuplicate(): void
    {
        static::setNow(Carbon::create(2021, 07, 23, 12, 31, 24));

        $originalData = Event::findOrFail(1)
            ->append(['technicians', 'materials'])
            ->toArray();

        // - Test simple.
        $newEvent = Event::findOrFail(1)->duplicate([
            'mobilization_period' => new Period('2021-08-01', '2021-08-02', true),
            'operation_period' => new Period('2021-08-01', '2021-08-02', true),
        ]);
        $expected = array_replace($originalData, [
            'id' => 9,
            'mobilization_start_date' => '2021-08-01 00:00:00',
            'mobilization_end_date' => '2021-08-03 00:00:00',
            'operation_start_date' => '2021-08-01 00:00:00',
            'operation_end_date' => '2021-08-03 00:00:00',
            'operation_is_full_days' => true,
            'is_confirmed' => false,
            'is_archived' => false,
            'total_without_global_discount' => '378.91',
            'global_discount_rate' => '0.0000',
            'total_global_discount' => '0.00',
            'total_without_taxes' => '378.91',
            'total_taxes' => [
                [
                    'name' => 'T.V.A.',
                    'value' => '20.000',
                    'is_rate' => true,
                    'total' => '75.78',
                ],
            ],
            'total_with_taxes' => '454.69',
            'total_replacement' => '19808.90',
            'is_departure_inventory_done' => false,
            'departure_inventory_author_id' => null,
            'departure_inventory_datetime' => null,
            'is_return_inventory_done' => false,
            'return_inventory_author_id' => null,
            'return_inventory_datetime' => null,
            'materials' => [
                array_replace($originalData['materials'][0], [
                    'id' => 18,
                    'event_id' => 9,
                    'name' => 'Console Yamaha CL3',
                    'reference' => 'CL3',
                    'unit_price' => '300.00',
                    'degressive_rate' => '1.00',
                    'unit_price_period' => '300.00',
                    'discount_rate' => '0.0000',
                    'taxes' => [
                        [
                            'name' => 'T.V.A.',
                            'value' => '20.000',
                            'is_rate' => true,
                        ],
                    ],
                    'total_without_discount' => '300.00',
                    'total_discount' => '0.00',
                    'total_without_taxes' => '300.00',
                    'unit_replacement_price' => '19400.00',
                    'total_replacement_price' => '19400.00',
                    'quantity_departed' => null,
                    'quantity_returned' => null,
                    'quantity_returned_broken' => null,
                    'departure_comment' => null,
                ]),
                array_replace($originalData['materials'][1], [
                    'id' => 19,
                    'event_id' => 9,
                    'name' => 'Processeur DBX PA2',
                    'reference' => 'DBXPA2',
                    'unit_price' => '25.50',
                    'degressive_rate' => '2.00',
                    'unit_price_period' => '51.00',
                    'discount_rate' => '0.0000',
                    'taxes' => [
                        [
                            'name' => 'T.V.A.',
                            'value' => '20.000',
                            'is_rate' => true,
                        ],
                    ],
                    'total_without_discount' => '51.00',
                    'total_discount' => '0.00',
                    'total_without_taxes' => '51.00',
                    'unit_replacement_price' => '349.90',
                    'total_replacement_price' => '349.90',
                    'quantity_departed' => null,
                    'quantity_returned' => null,
                    'quantity_returned_broken' => null,
                    'departure_comment' => null,
                ]),
                array_replace($originalData['materials'][2], [
                    'id' => 20,
                    'event_id' => 9,
                    'name' => 'Showtec SDS-6',
                    'reference' => 'SDS-6-01',
                    'unit_price' => '15.95',
                    'degressive_rate' => '1.75',
                    'unit_price_period' => '27.91',
                    'discount_rate' => '0.0000',
                    'taxes' => [
                        [
                            'name' => 'T.V.A.',
                            'value' => '20.000',
                            'is_rate' => true,
                        ],
                    ],
                    'total_without_discount' => '27.91',
                    'total_discount' => '0.00',
                    'total_without_taxes' => '27.91',
                    'unit_replacement_price' => '59.00',
                    'total_replacement_price' => '59.00',
                    'quantity_departed' => null,
                    'quantity_returned' => null,
                    'quantity_returned_broken' => null,
                    'departure_comment' => null,
                ]),
            ],
            'technicians' => [],
            'author_id' => null,
            'created_at' => '2021-07-23 12:31:24',
            'updated_at' => '2021-07-23 12:31:24',
        ]);
        $this->assertEquals($expected, (
            $newEvent
                ->append([
                    'technicians',
                    'materials',
                    'total_replacement',
                ])
                ->toArray()
        ));
        $this->assertCount(1, $newEvent->beneficiaries);

        // - Test avec le même événement mais conservation des données de facturation.
        $newEvent = Event::findOrFail(1)->duplicate(
            [
                'mobilization_period' => new Period('2021-08-03', '2021-08-04', true),
                'operation_period' => new Period('2021-08-03', '2021-08-04', true),
            ],
            true,
        );
        $expected = array_replace($originalData, [
            'id' => 10,
            'mobilization_start_date' => '2021-08-03 00:00:00',
            'mobilization_end_date' => '2021-08-05 00:00:00',
            'operation_start_date' => '2021-08-03 00:00:00',
            'operation_end_date' => '2021-08-05 00:00:00',
            'operation_is_full_days' => true,
            'is_confirmed' => false,
            'is_archived' => false,
            'total_without_global_discount' => '278.91',
            'global_discount_rate' => '10.0000',
            'total_global_discount' => '27.89',
            'total_without_taxes' => '251.02',
            'total_taxes' => [
                [
                    'name' => 'T.V.A.',
                    'value' => '20.000',
                    'is_rate' => true,
                    'total' => '50.20',
                ],
            ],
            'total_with_taxes' => '301.22',
            'total_replacement' => '19808.90',
            'is_departure_inventory_done' => false,
            'departure_inventory_author_id' => null,
            'departure_inventory_datetime' => null,
            'is_return_inventory_done' => false,
            'return_inventory_author_id' => null,
            'return_inventory_datetime' => null,
            'materials' => [
                array_replace($originalData['materials'][0], [
                    'id' => 21,
                    'event_id' => 10,
                    'name' => 'Console Yamaha CL3',
                    'reference' => 'CL3',
                    'degressive_rate' => '1.00',
                    'unit_price_period' => '200.00',
                    'total_without_discount' => '200.00',
                    'total_discount' => '0.00',
                    'total_without_taxes' => '200.00',
                    'unit_replacement_price' => '19400.00',
                    'total_replacement_price' => '19400.00',
                    'quantity_departed' => null,
                    'quantity_returned' => null,
                    'quantity_returned_broken' => null,
                    'departure_comment' => null,
                ]),
                array_replace($originalData['materials'][1], [
                    'id' => 22,
                    'event_id' => 10,
                    'name' => 'Processeur DBX PA2',
                    'reference' => 'DBXPA2',
                    'degressive_rate' => '2.00',
                    'unit_price_period' => '51.00',
                    'total_without_discount' => '51.00',
                    'total_discount' => '0.00',
                    'total_without_taxes' => '51.00',
                    'unit_replacement_price' => '349.90',
                    'total_replacement_price' => '349.90',
                    'quantity_departed' => null,
                    'quantity_returned' => null,
                    'quantity_returned_broken' => null,
                    'departure_comment' => null,
                ]),
                array_replace($originalData['materials'][2], [
                    'id' => 23,
                    'event_id' => 10,
                    'name' => 'Showtec SDS-6',
                    'reference' => 'SDS-6-01',
                    'unit_replacement_price' => '59.00',
                    'total_replacement_price' => '59.00',
                    'quantity_departed' => null,
                    'quantity_returned' => null,
                    'quantity_returned_broken' => null,
                    'departure_comment' => null,
                ]),
            ],
            'technicians' => [],
            'author_id' => null,
            'created_at' => '2021-07-23 12:31:24',
            'updated_at' => '2021-07-23 12:31:24',
        ]);
        $this->assertEquals($expected, (
            $newEvent
                ->append([
                    'technicians',
                    'materials',
                    'total_replacement',
                ])
                ->toArray()
        ));

        // - Test avec un événement dupliqué plus long que l'original (en conservant les données de facturation).
        $newEvent = Event::findOrFail(1)->duplicate(
            [
                // - Un jour de plus que l'original.
                'mobilization_period' => new Period('2021-08-03', '2021-08-05', true),
                'operation_period' => new Period('2021-08-03', '2021-08-05', true),
            ],
            true,
            User::findOrFail(1),
        );
        $expected = array_replace($originalData, [
            'id' => 11,
            'mobilization_start_date' => '2021-08-03 00:00:00',
            'mobilization_end_date' => '2021-08-06 00:00:00',
            'operation_start_date' => '2021-08-03 00:00:00',
            'operation_end_date' => '2021-08-06 00:00:00',
            'operation_is_full_days' => true,
            'is_confirmed' => false,
            'is_archived' => false,
            'total_without_global_discount' => '316.38',
            'global_discount_rate' => '10.0000',
            'total_global_discount' => '31.64',
            'total_without_taxes' => '284.74',
            'total_taxes' => [
                [
                    'name' => 'T.V.A.',
                    'value' => '20.000',
                    'is_rate' => true,
                    'total' => '56.95',
                ],
            ],
            'total_with_taxes' => '341.69',
            'total_replacement' => '19808.90',
            'is_departure_inventory_done' => false,
            'departure_inventory_author_id' => null,
            'departure_inventory_datetime' => null,
            'is_return_inventory_done' => false,
            'return_inventory_author_id' => null,
            'return_inventory_datetime' => null,
            'materials' => [
                array_replace($originalData['materials'][0], [
                    'id' => 24,
                    'event_id' => 11,
                    'name' => 'Console Yamaha CL3',
                    'reference' => 'CL3',
                    'degressive_rate' => '1.00',
                    'unit_price_period' => '200.00',
                    'total_without_discount' => '200.00',
                    'total_discount' => '0.00',
                    'total_without_taxes' => '200.00',
                    'unit_replacement_price' => '19400.00',
                    'total_replacement_price' => '19400.00',
                    'quantity_departed' => null,
                    'quantity_returned' => null,
                    'quantity_returned_broken' => null,
                    'departure_comment' => null,
                ]),
                array_replace($originalData['materials'][1], [
                    'id' => 25,
                    'event_id' => 11,
                    'name' => 'Processeur DBX PA2',
                    'reference' => 'DBXPA2',
                    'degressive_rate' => '3.00',
                    'unit_price_period' => '76.50',
                    'total_without_discount' => '76.50',
                    'total_discount' => '0.00',
                    'total_without_taxes' => '76.50',
                    'unit_replacement_price' => '349.90',
                    'total_replacement_price' => '349.90',
                    'quantity_departed' => null,
                    'quantity_returned' => null,
                    'quantity_returned_broken' => null,
                    'departure_comment' => null,
                ]),
                array_replace($originalData['materials'][2], [
                    'id' => 26,
                    'event_id' => 11,
                    'name' => 'Showtec SDS-6',
                    'reference' => 'SDS-6-01',
                    'degressive_rate' => '2.50',
                    'unit_price_period' => '39.88',
                    'total_without_discount' => '39.88',
                    'total_discount' => '0.00',
                    'total_without_taxes' => '39.88',
                    'unit_replacement_price' => '59.00',
                    'total_replacement_price' => '59.00',
                    'quantity_departed' => null,
                    'quantity_returned' => null,
                    'quantity_returned_broken' => null,
                    'departure_comment' => null,
                ]),
            ],
            'technicians' => [],
            'author_id' => 1,
            'created_at' => '2021-07-23 12:31:24',
            'updated_at' => '2021-07-23 12:31:24',
        ]);
        $this->assertEquals($expected, (
            $newEvent
                ->append([
                    'technicians',
                    'materials',
                    'total_replacement',
                ])
                ->toArray()
        ));

        // - Test avec un événement dupliqué plus court que l'original.
        $newEvent = Event::findOrFail(1)->duplicate([
            // - Un jour de moins que l'original.
            'mobilization_period' => new Period('2021-08-06', '2021-08-06', true),
            'operation_period' => new Period('2021-08-06', '2021-08-06', true),
        ]);

        $expected = array_replace($originalData, [
            'id' => 12,
            'mobilization_start_date' => '2021-08-06 00:00:00',
            'mobilization_end_date' => '2021-08-07 00:00:00',
            'operation_start_date' => '2021-08-06 00:00:00',
            'operation_end_date' => '2021-08-07 00:00:00',
            'operation_is_full_days' => true,
            'is_confirmed' => false,
            'is_archived' => false,
            'total_without_global_discount' => '341.45',
            'global_discount_rate' => '0.0000',
            'total_global_discount' => '0.00',
            'total_without_taxes' => '341.45',
            'total_taxes' => [
                [
                    'name' => 'T.V.A.',
                    'value' => '20.000',
                    'is_rate' => true,
                    'total' => '68.29',
                ],
            ],
            'total_with_taxes' => '409.74',
            'total_replacement' => '19808.90',
            'is_departure_inventory_done' => false,
            'departure_inventory_author_id' => null,
            'departure_inventory_datetime' => null,
            'is_return_inventory_done' => false,
            'return_inventory_author_id' => null,
            'return_inventory_datetime' => null,
            'materials' => [
                array_replace($originalData['materials'][0], [
                    'id' => 27,
                    'event_id' => 12,
                    'name' => 'Console Yamaha CL3',
                    'reference' => 'CL3',
                    'unit_price' => '300.00',
                    'degressive_rate' => '1.00',
                    'unit_price_period' => '300.00',
                    'total_without_discount' => '300.00',
                    'total_discount' => '0.00',
                    'total_without_taxes' => '300.00',
                    'unit_replacement_price' => '19400.00',
                    'total_replacement_price' => '19400.00',
                    'quantity_departed' => null,
                    'quantity_returned' => null,
                    'quantity_returned_broken' => null,
                    'departure_comment' => null,
                ]),
                array_replace($originalData['materials'][1], [
                    'id' => 28,
                    'event_id' => 12,
                    'name' => 'Processeur DBX PA2',
                    'reference' => 'DBXPA2',
                    'degressive_rate' => '1.00',
                    'unit_price_period' => '25.50',
                    'total_without_discount' => '25.50',
                    'total_discount' => '0.00',
                    'total_without_taxes' => '25.50',
                    'unit_replacement_price' => '349.90',
                    'total_replacement_price' => '349.90',
                    'quantity_departed' => null,
                    'quantity_returned' => null,
                    'quantity_returned_broken' => null,
                    'departure_comment' => null,
                ]),
                array_replace($originalData['materials'][2], [
                    'id' => 29,
                    'event_id' => 12,
                    'name' => 'Showtec SDS-6',
                    'reference' => 'SDS-6-01',
                    'degressive_rate' => '1.00',
                    'unit_price_period' => '15.95',
                    'total_without_discount' => '15.95',
                    'total_discount' => '0.00',
                    'total_without_taxes' => '15.95',
                    'unit_replacement_price' => '59.00',
                    'total_replacement_price' => '59.00',
                    'quantity_departed' => null,
                    'quantity_returned' => null,
                    'quantity_returned_broken' => null,
                    'departure_comment' => null,
                ]),
            ],
            'technicians' => [],
            'author_id' => null,
            'created_at' => '2021-07-23 12:31:24',
            'updated_at' => '2021-07-23 12:31:24',
        ]);
        $this->assertEquals($expected, (
            $newEvent
                ->append([
                    'technicians',
                    'materials',
                    'total_replacement',
                ])
                ->toArray()
        ));
    }

    public function testChangeDatesLonger(): void
    {
        static::setNow(Carbon::create(2018, 11, 10, 15, 0, 0));

        // - On invalide l'inventaire de retour pour pouvoir modifier.
        $event = Event::findOrFail(1);
        $event->is_departure_inventory_done = false;
        $event->departure_inventory_datetime = null;
        $event->departure_inventory_author_id = null;
        $event->is_return_inventory_done = false;
        $event->return_inventory_datetime = null;
        $event->return_inventory_author_id = null;
        $event->save();

        // - Test
        $event = Event::findOrFail(1)->edit([
            // - Un jour de plus.
            'mobilization_period' => new Period('2018-12-17', '2018-12-19', true),
            'operation_period' => new Period('2018-12-17', '2018-12-19', true),
        ]);
        $this->assertCount(2, $event->technicians);
        $this->assertEquals('Roger Rabbit', $event->technicians[0]['technician']['full_name']);
        $this->assertEquals('2018-12-17 09:00:00', $event->technicians[0]['start_date']);
        $this->assertEquals('2018-12-18 22:00:00', $event->technicians[0]['end_date']);
        $this->assertEquals('Jean Technicien', $event->technicians[1]['technician']['full_name']);
        $this->assertEquals('2018-12-18 14:00:00', $event->technicians[1]['start_date']);
        $this->assertEquals('2018-12-18 18:00:00', $event->technicians[1]['end_date']);
    }

    public function testChangeDatesHalfTime(): void
    {
        static::setNow(Carbon::create(2018, 12, 10, 15, 0, 0));

        // - On invalide l'inventaire de retour pour pouvoir modifier.
        $event = Event::findOrFail(1);
        $event->is_departure_inventory_done = false;
        $event->departure_inventory_datetime = null;
        $event->departure_inventory_author_id = null;
        $event->is_return_inventory_done = false;
        $event->return_inventory_datetime = null;
        $event->return_inventory_author_id = null;
        $event->save();

        // - Test
        $event = Event::findOrFail(1)->edit([
            // - Un jour de moins.
            'mobilization_period' => new Period('2018-12-17', '2018-12-17', true),
            'operation_period' => new Period('2018-12-17', '2018-12-17', true),
        ]);
        $this->assertCount(1, $event->technicians);
        $this->assertEquals('Roger Rabbit', $event->technicians[0]['technician']['full_name']);
        $this->assertEquals('2018-12-17 09:00:00', $event->technicians[0]['start_date']);
        $this->assertEquals('2018-12-18 00:00:00', $event->technicians[0]['end_date']);
    }

    public function testGetAllNotReturned(): void
    {
        // - Test à une date qui contient un événement, mais dont l'inventaire est terminé (#1).
        $period = new Period('2018-12-18', '2018-12-18', true);
        $this->assertEmpty(Event::notReturned($period)->get()->toArray());

        // - Test à une date qui contient un événement dont l'inventaire
        //   n'est pas terminé, mais qui est archivé (#3).
        $period = new Period('2018-12-16', '2018-12-16', true);
        $this->assertEmpty(Event::notReturned($period)->get()->toArray());

        // - Test à une date qui correspond à la date de fin d'un événement
        //   non archivé, dont l'inventaire n'est pas terminé (#4).
        $period = new Period('2019-04-10', '2019-04-10', true);
        $results = Event::notReturned($period)->get()->pluck('id')->all();
        $this->assertEquals([4], $results);

        // - Test pour une période qui contient deux événements non-archivés,
        //   dont l'inventaire n'est pas terminé (#4 et #5).
        $period = new Period('2018-01-01', '2020-01-15', true);
        $results = Event::notReturned($period)->get()->pluck('id')->all();
        $this->assertEquals([4, 5], $results);
    }

    public function testTotalisableProperties(): void
    {
        $getTestValues = static fn (Property $property) => (
            $property->only(['id', 'name', 'value', 'unit'])
        );

        // - Totaux des caractéristiques numériques pour l'événement #1.
        $result = Event::findOrFail(1)->totalisable_properties;
        $expected = [
            1 => [
                'id' => 1,
                'name' => 'Poids',
                'value' => 41.85,
                'unit' => 'kg',
            ],
            3 => [
                'id' => 3,
                'name' => 'Puissance',
                'value' => 945,
                'unit' => 'W',
            ],
        ];
        $this->assertSame($expected, $result->map($getTestValues)->toArray());

        // - Totaux des caractéristiques numériques pour l'événement #2.
        $result = Event::findOrFail(2)->totalisable_properties;
        $expected = [
            1 => [
                'id' => 1,
                'name' => 'Poids',
                'value' => 113.9,
                'unit' => 'kg',
            ],
            3 => [
                'id' => 3,
                'name' => 'Puissance',
                'value' => 2620,
                'unit' => 'W',
            ],
        ];
        $this->assertSame($expected, $result->map($getTestValues)->toArray());
    }
}
