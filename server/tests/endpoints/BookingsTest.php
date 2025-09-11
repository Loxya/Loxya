<?php
declare(strict_types=1);

namespace Loxya\Tests;

use Fig\Http\Message\StatusCodeInterface as StatusCode;
use Illuminate\Support\Carbon;
use Loxya\Models\Event;
use Loxya\Models\Material;
use Loxya\Support\Arr;

final class BookingsTest extends ApiTestCase
{
    public function testGetAll(): void
    {
        static::setNow(Carbon::create(2024, 6, 15, 12, 30, 30));

        static::setCustomConfig(['maxItemsPerPage' => 5]);

        // - Test sans pagination, avec une période.
        $this->client->get('/api/bookings?paginated=0&period[start]=2018-12-01&period[end]=2018-12-31');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponseData([
            EventsTest::data(3, Event::SERIALIZE_BOOKING_EXCERPT),
            EventsTest::data(1, Event::SERIALIZE_BOOKING_EXCERPT),
            EventsTest::data(2, Event::SERIALIZE_BOOKING_EXCERPT),
        ]);

        // - Test sans pagination, et sans passer de période.
        $this->client->get('/api/bookings?paginated=0');
        $this->assertStatusCode(StatusCode::STATUS_NOT_ACCEPTABLE);

        // - Test sans pagination, avec un trop grand intervalle.
        $this->client->get('/api/bookings?paginated=0&period[start]=2018-01-01&period[end]=2018-12-31');
        $this->assertStatusCode(StatusCode::STATUS_RANGE_NOT_SATISFIABLE);

        // - Test simple avec pagination (page 1).
        $this->client->get('/api/bookings?paginated=1');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponsePaginatedData(7, [
            EventsTest::data(8, Event::SERIALIZE_BOOKING_EXCERPT),
            EventsTest::data(7, Event::SERIALIZE_BOOKING_EXCERPT),
            EventsTest::data(5, Event::SERIALIZE_BOOKING_EXCERPT),
            EventsTest::data(6, Event::SERIALIZE_BOOKING_EXCERPT),
            EventsTest::data(4, Event::SERIALIZE_BOOKING_EXCERPT),
        ]);

        // - Test simple avec pagination (page 2).
        $this->client->get('/api/bookings?paginated=1&page=2');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponsePaginatedData(7, [
            EventsTest::data(2, Event::SERIALIZE_BOOKING_EXCERPT),
            EventsTest::data(1, Event::SERIALIZE_BOOKING_EXCERPT),
        ]);

        static::setCustomConfig(['maxItemsPerPage' => 7]);

        // - Test avec un terme de recherche (titre, lieu, bénéficiaire, chef de projet ou auteur).
        $this->client->get('/api/bookings?paginated=1&search=fountain');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponsePaginatedData(7, [
            EventsTest::data(8, Event::SERIALIZE_BOOKING_EXCERPT),
            EventsTest::data(7, Event::SERIALIZE_BOOKING_EXCERPT),
            EventsTest::data(5, Event::SERIALIZE_BOOKING_EXCERPT),
            EventsTest::data(6, Event::SERIALIZE_BOOKING_EXCERPT),
            EventsTest::data(4, Event::SERIALIZE_BOOKING_EXCERPT),
            EventsTest::data(2, Event::SERIALIZE_BOOKING_EXCERPT),
            EventsTest::data(1, Event::SERIALIZE_BOOKING_EXCERPT),
        ]);

        static::setCustomConfig(['maxItemsPerPage' => 5]);

        // - Test avec un filtre sur le parc "spare".
        $this->client->get('/api/bookings?paginated=1&park=2');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponsePaginatedData(2, [
            EventsTest::data(7, Event::SERIALIZE_BOOKING_EXCERPT),
            EventsTest::data(4, Event::SERIALIZE_BOOKING_EXCERPT),
        ]);

        // - Test avec un filtre sur la catégorie "Décors".
        $this->client->get('/api/bookings?paginated=1&category=4');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponsePaginatedData(1, [
            EventsTest::data(5, Event::SERIALIZE_BOOKING_EXCERPT),
        ]);

        // - Test avec un filtre sur les bookings archivés.
        $this->client->get('/api/bookings?paginated=1&archived=1');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponsePaginatedData(1, [
            EventsTest::data(3, Event::SERIALIZE_BOOKING_EXCERPT),
        ]);

        // - Test avec un filtre sur le matériel non catégorisé et les événements archivés.
        $this->client->get('/api/bookings?paginated=1&category=uncategorized&archived=1');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponsePaginatedData(1, [
            EventsTest::data(3, Event::SERIALIZE_BOOKING_EXCERPT),
        ]);

        // - Test avec un filtre sur les bookings dont l'inventaire de retour reste à faire.
        $this->client->get('/api/bookings?paginated=1&returnInventoryTodo=1');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponsePaginatedData(4, [
            EventsTest::data(7, Event::SERIALIZE_BOOKING_EXCERPT),
            EventsTest::data(5, Event::SERIALIZE_BOOKING_EXCERPT),
            EventsTest::data(6, Event::SERIALIZE_BOOKING_EXCERPT),
            EventsTest::data(4, Event::SERIALIZE_BOOKING_EXCERPT),
        ]);

        // - Test avec un filtre sur les événements non-confirmés.
        $this->client->get('/api/bookings?paginated=1&notConfirmed=1');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponsePaginatedData(6, [
            EventsTest::data(8, Event::SERIALIZE_BOOKING_EXCERPT),
            EventsTest::data(5, Event::SERIALIZE_BOOKING_EXCERPT),
            EventsTest::data(6, Event::SERIALIZE_BOOKING_EXCERPT),
            EventsTest::data(4, Event::SERIALIZE_BOOKING_EXCERPT),
            EventsTest::data(2, Event::SERIALIZE_BOOKING_EXCERPT),
        ]);

        // - Test avec un filtre sur les bookings non-confirmés ET dont
        //   l'inventaire de retour reste à faire.
        $this->client->get('/api/bookings?paginated=1&notConfirmed=1&returnInventoryTodo=1');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponsePaginatedData(3, [
            EventsTest::data(5, Event::SERIALIZE_BOOKING_EXCERPT),
            EventsTest::data(6, Event::SERIALIZE_BOOKING_EXCERPT),
            EventsTest::data(4, Event::SERIALIZE_BOOKING_EXCERPT),
        ]);

        // - Test avec un filtre sur les bookings se terminant aujourd'hui.
        static::setNow(Carbon::create(2023, 5, 28, 18, 0, 0));

        $this->client->get('/api/bookings?paginated=1&endingToday=1');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponsePaginatedData(1, [
            EventsTest::data(7, Event::SERIALIZE_BOOKING_EXCERPT),
        ]);
    }

    public function testGetOne(): void
    {
        $ids = array_column(EventsTest::data(null), 'id');
        foreach ($ids as $id) {
            $this->client->get(sprintf('/api/bookings/%s/%d', Event::TYPE, $id));
            $this->assertStatusCode(StatusCode::STATUS_OK);
            $this->assertResponseData(EventsTest::data($id, Event::SERIALIZE_BOOKING_DEFAULT));
        }
    }

    public function testGetOneSummary(): void
    {
        $ids = array_column(EventsTest::data(null), 'id');
        foreach ($ids as $id) {
            $this->client->get(sprintf('/api/bookings/%s/%d/summary', Event::TYPE, $id));
            $this->assertStatusCode(StatusCode::STATUS_OK);
            $this->assertResponseData(EventsTest::data($id, Event::SERIALIZE_BOOKING_SUMMARY));
        }
    }

    public function testUpdateEventMaterialsInvalid(): void
    {
        static::setNow(Carbon::create(2023, 5, 3, 18, 0, 0));

        // - Confirmation de l'événement #1 avant le test.
        $event = Event::findOrFail(1);
        $event->is_confirmed = true;
        $event->save();

        // - Un événement inexistant n'est pas modifiable.
        $this->client->put(sprintf('/api/bookings/%s/999/materials', Event::TYPE), []);
        $this->assertStatusCode(StatusCode::STATUS_NOT_FOUND);

        // - Un événement confirmé qui est passé n'est pas modifiable.
        $this->client->put(sprintf('/api/bookings/%s/1/materials', Event::TYPE), []);
        $this->assertStatusCode(StatusCode::STATUS_UNPROCESSABLE_ENTITY);
    }

    public function testUpdateEventMaterials(): void
    {
        static::setNow(Carbon::create(2019, 3, 15, 18, 0, 0));

        // - Modification d'un événement qui n'est pas encore passé.
        $this->client->put(sprintf('/api/bookings/%s/4/materials', Event::TYPE), [
            ['id' => 1, 'quantity' => 2],
            ['id' => 6, 'quantity' => 2],
        ]);
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $eventData = EventsTest::data(4, Event::SERIALIZE_BOOKING_DEFAULT);
        $this->assertResponseData(array_replace($eventData, [
            'materials_count' => 4,
            'has_missing_materials' => false,
            'total_replacement' => '38899.98',
            'materials' => array_replace_recursive(
                Arr::except($eventData['materials'], 2),
                [
                    [
                        'id' => 6,
                        'quantity' => 2,
                        'quantity_returned' => 1,
                        'quantity_returned_broken' => 0,
                    ],
                    [
                        'id' => 1,
                        'quantity' => 2,
                        'total_replacement_price' => '38800.00',
                    ],
                ],
            ),
        ]));

        static::setNow(Carbon::create(2023, 5, 26, 18, 0, 0));

        // - Modification avec réduction des quantités => Les quantités retournées doit être adapté.
        $this->client->put(sprintf('/api/bookings/%s/7/materials', Event::TYPE), [
            [
                'id' => 6,
                'quantity' => 1,
            ],
        ]);
        $eventData = EventsTest::data(7, Event::SERIALIZE_BOOKING_DEFAULT);
        $this->assertResponseData(array_replace($eventData, [
            'materials_count' => 1,
            'has_missing_materials' => false,
            'total_without_global_discount' => '162.47',
            'total_without_taxes' => '162.47',
            'total_with_taxes' => '194.96',
            'total_replacement' => '49.99',
            'total_taxes' => [
                [
                    'name' => 'T.V.A.',
                    'is_rate' => true,
                    'value' => '20.000',
                    'total' => '32.49',
                ],
            ],
            'materials' => [
                [
                    'id' => 6,
                    'name' => 'Behringer X Air XR18',
                    'reference' => 'XR18',
                    'category_id' => 1,
                    'quantity' => 1,
                    'unit_price' => '49.99',
                    'degressive_rate' => '3.25',
                    'unit_price_period' => '162.47',
                    'total_without_discount' => '162.47',
                    'discount_rate' => '0.0000',
                    'total_discount' => '0.00',
                    'total_without_taxes' => '162.47',
                    'quantity_departed' => null,
                    'quantity_returned' => 1,
                    'quantity_returned_broken' => 1,
                    'departure_comment' => null,
                    'taxes' => [
                        [
                            'name' => 'T.V.A.',
                            'is_rate' => true,
                            'value' => '20.000',
                        ],
                    ],
                    'unit_replacement_price' => '49.99',
                    'total_replacement_price' => '49.99',
                    'material' => array_merge(
                        MaterialsTest::data(6, Material::SERIALIZE_WITH_CONTEXT_EXCERPT),
                        [
                            'degressive_rate' => '3.25',
                            'rental_price_period' => '162.47',
                        ],
                    ),
                ],
            ],
        ]));
    }

    public function testUpdateBillingData(): void
    {
        static::setNow(Carbon::create(2023, 5, 25, 12, 0, 0));

        // - Test avec des données incomplètes.
        $billingData = [
            'global_discount_rate' => 'test',
            'materials' => [],
        ];
        $this->client->put('/api/bookings/event/7/billing', $billingData);
        $this->assertStatusCode(StatusCode::STATUS_BAD_REQUEST);
        $this->assertApiErrorMessage("Invalid data format.");

        // - Test avec une liste de matériel différente de celle qui est sauvegardée.
        $billingData = [
            'global_discount_rate' => 'test',
            'materials' => [
                ['id' => 6, 'unit_price' => '49.99', 'discount_rate' => '0'],
                ['id' => 1, 'unit_price' => '300', 'discount_rate' => '0'],
                ['id' => 4, 'unit_price' => '15.95', 'discount_rate' => '0'],
                ['id' => 3, 'unit_price' => '30', 'discount_rate' => '20'],
            ],
            'extras' => [],
        ];
        $this->client->put('/api/bookings/event/7/billing', $billingData);
        $this->assertStatusCode(StatusCode::STATUS_BAD_REQUEST);
        $this->assertApiErrorMessage("The billing data for some materials are missing.");

        // - Test avec des données valides.
        $billingData = [
            'global_discount_rate' => '10',
            'materials' => [
                ['id' => 6, 'unit_price' => '50', 'discount_rate' => '10'],
                ['id' => 1, 'unit_price' => '360', 'discount_rate' => '20'],
                ['id' => 4, 'unit_price' => '15.95', 'discount_rate' => '0'],
                ['id' => 7, 'unit_price' => '300', 'discount_rate' => '0'],
            ],
            'extras' => [
                [
                    'id' => null,
                    'description' => "Un super service pour l'événement.",
                    'quantity' => 2,
                    'unit_price' => '14.5',
                    'tax_id' => 1,
                ],
            ],
        ];
        $this->client->put('/api/bookings/event/7/billing', $billingData);
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponseData(array_replace_recursive(
            EventsTest::data(7, Event::SERIALIZE_BOOKING_DEFAULT),
            [
                'global_discount_rate' => '10.0000',
                'materials' => [
                    [
                        'id' => 6,
                        'name' => "Behringer X Air XR18",
                        'reference' => 'XR18',
                        'category_id' => 1,
                        'quantity' => 2,
                        'unit_price' => '50.00',
                        'degressive_rate' => '3.25',
                        'unit_price_period' => '162.50',
                        'total_without_discount' => '325.00',
                        'discount_rate' => '10.0000',
                        'total_discount' => '32.50',
                        'total_without_taxes' => '292.50',
                        'taxes' => [
                            [
                                'name' => 'T.V.A.',
                                'is_rate' => true,
                                'value' => '20.000',
                            ],
                        ],
                        'unit_replacement_price' => '49.99',
                        'total_replacement_price' => '99.98',
                        'quantity_departed' => null,
                        'quantity_returned' => 2,
                        'quantity_returned_broken' => 1,
                        'departure_comment' => null,
                        'material' => MaterialsTest::data(6),
                    ],
                    [
                        'id' => 1,
                        'name' => "Console Yamaha CL3",
                        'reference' => 'CL3',
                        'category_id' => 1,
                        'quantity' => 2,
                        'unit_price' => '360.00',
                        'degressive_rate' => '3.25',
                        'unit_price_period' => '1170.00',
                        'total_without_discount' => '2340.00',
                        'discount_rate' => '20.0000',
                        'total_discount' => '468.00',
                        'total_without_taxes' => '1872.00',
                        'taxes' => [
                            [
                                'name' => 'T.V.A.',
                                'is_rate' => true,
                                'value' => '20.000',
                            ],
                        ],
                        'unit_replacement_price' => '19400.00',
                        'total_replacement_price' => '38800.00',
                        'quantity_departed' => null,
                        'quantity_returned' => 1,
                        'quantity_returned_broken' => 0,
                        'departure_comment' => null,
                        'material' => MaterialsTest::data(1),
                    ],
                ],
                'extras' => [
                    [
                        'id' => 3,
                        'description' => "Un super service pour l'événement.",
                        'quantity' => 2,
                        'unit_price' => '14.50',
                        'tax_id' => 1,
                        'taxes' => [
                            ['is_rate' => true, 'name' => 'T.V.A.', 'value' => '20.000'],
                        ],
                        'total_without_taxes' => '29.00',
                    ],
                ],
                'total_taxes' => [
                    ['is_rate' => true, 'name' => 'T.V.A.', 'value' => '20.000', 'total' => '589.00', ],
                ],
                'total_global_discount' => '327.22',
                'total_with_taxes' => '3533.96',
                'total_without_global_discount' => '3272.18',
                'total_without_taxes' => '2944.96',
                'updated_at' => '2023-05-25 12:00:00',
            ],
        ));

        // - Test avec des données valides (2).
        $billingData = [
            'global_discount_rate' => '10',
            'materials' => [
                ['id' => 6, 'unit_price' => '50', 'discount_rate' => '10'],
                ['id' => 1, 'unit_price' => '360', 'discount_rate' => '20'],
                ['id' => 4, 'unit_price' => '15.95', 'discount_rate' => '0'],
                ['id' => 7, 'unit_price' => '300', 'discount_rate' => '0'],
            ],
            'extras' => [
                [
                    'id' => 3,
                    'description' => "Un super service pour l'événement.",
                    'quantity' => 2,
                    'unit_price' => '14.5',
                    'tax_id' => null,
                    'taxes' => [
                        [
                            'name' => 'T.V.A. Temporaire',
                            'is_rate' => true,
                            'value' => '25.5',
                        ],
                    ],
                ],
            ],
        ];
        $this->client->put('/api/bookings/event/7/billing', $billingData);
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponseData(array_replace_recursive(
            EventsTest::data(7, Event::SERIALIZE_BOOKING_DEFAULT),
            [
                'materials' => [
                    [
                        'id' => 6,
                        'name' => "Behringer X Air XR18",
                        'reference' => 'XR18',
                        'category_id' => 1,
                        'quantity' => 2,
                        'unit_price' => '50.00',
                        'degressive_rate' => '3.25',
                        'unit_price_period' => '162.50',
                        'total_without_discount' => '325.00',
                        'discount_rate' => '10.0000',
                        'total_discount' => '32.50',
                        'total_without_taxes' => '292.50',
                        'taxes' => [
                            [
                                'name' => 'T.V.A.',
                                'is_rate' => true,
                                'value' => '20.000',
                            ],
                        ],
                        'unit_replacement_price' => '49.99',
                        'total_replacement_price' => '99.98',
                        'quantity_departed' => null,
                        'quantity_returned' => 2,
                        'quantity_returned_broken' => 1,
                        'departure_comment' => null,
                        'material' => MaterialsTest::data(6),
                    ],
                    [
                        'id' => 1,
                        'name' => "Console Yamaha CL3",
                        'reference' => 'CL3',
                        'category_id' => 1,
                        'quantity' => 2,
                        'unit_price' => '360.00',
                        'degressive_rate' => '3.25',
                        'unit_price_period' => '1170.00',
                        'total_without_discount' => '2340.00',
                        'discount_rate' => '20.0000',
                        'total_discount' => '468.00',
                        'total_without_taxes' => '1872.00',
                        'taxes' => [
                            [
                                'name' => 'T.V.A.',
                                'is_rate' => true,
                                'value' => '20.000',
                            ],
                        ],
                        'unit_replacement_price' => '19400.00',
                        'total_replacement_price' => '38800.00',
                        'quantity_departed' => null,
                        'quantity_returned' => 1,
                        'quantity_returned_broken' => 0,
                        'departure_comment' => null,
                        'material' => MaterialsTest::data(1),
                    ],
                ],
                'extras' => [
                    [
                        'id' => 3,
                        'description' => "Un super service pour l'événement.",
                        'quantity' => 2,
                        'unit_price' => '14.50',
                        'tax_id' => null,
                        'taxes' => [
                            [
                                'name' => 'T.V.A. Temporaire',
                                'is_rate' => true,
                                'value' => '25.500',
                            ],
                        ],
                        'total_without_taxes' => '29.00',
                    ],
                ],
                'total_without_global_discount' => '3272.18',
                'global_discount_rate' => '10.0000',
                'total_global_discount' => '327.22',
                'total_without_taxes' => '2944.96',
                'total_taxes' => [
                    [
                        'name' => 'T.V.A.',
                        'is_rate' => true,
                        'value' => '20.000',
                        'total' => '583.78',
                    ],
                    [
                        'name' => 'T.V.A. Temporaire',
                        'is_rate' => true,
                        'value' => '25.500',
                        'total' => '6.66',
                    ],
                ],
                'total_with_taxes' => '3535.40',
                'updated_at' => '2023-05-25 12:00:00',
            ],
        ));

        // - Test avec un événement qui n'est pas facturable.
        $this->client->put('/api/bookings/event/8/billing', $billingData);
        $this->assertStatusCode(StatusCode::STATUS_INTERNAL_SERVER_ERROR);

        // - Test avec un événement qui n'est pas modifiable.
        $this->client->put('/api/bookings/event/1/billing', $billingData);
        $this->assertStatusCode(StatusCode::STATUS_UNPROCESSABLE_ENTITY);
        $this->assertApiErrorMessage("This booking is no longer editable.");
    }
}
