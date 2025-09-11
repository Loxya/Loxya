<?php
declare(strict_types=1);

namespace Loxya\Tests;

use Fig\Http\Message\StatusCodeInterface as StatusCode;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Loxya\Models\Event;
use Loxya\Models\Material;
use Loxya\Models\Setting;
use Loxya\Models\User;
use Loxya\Support\Arr;
use Loxya\Support\File\UploadedFile;
use Loxya\Support\Period;

final class EventsTest extends ApiTestCase
{
    public static function data(?int $id, string $format = Event::SERIALIZE_DEFAULT)
    {
        $events = new Collection([
            [
                'id' => 1,
                'reference' => null,
                'title' => "Premier événement",
                'description' => null,
                'location' => "Gap",
                'manager' => UsersTest::data(2),
                'color' => null,
                'mobilization_period' => [
                    'start' => '2018-12-16 15:45:00',
                    'end' => '2018-12-19 00:00:00',
                    'isFullDays' => false,
                ],
                'operation_period' => [
                    'start' => '2018-12-17 10:00:00',
                    'end' => '2018-12-18 18:00:00',
                    'isFullDays' => false,
                ],
                'materials_count' => 3,
                'currency' => 'EUR',
                'total_without_global_discount' => '422.54',
                'global_discount_rate' => '10.0000',
                'total_global_discount' => '42.25',
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
                'is_confirmed' => false,
                'is_archived' => false,
                'is_billable' => true,
                'is_departure_inventory_done' => true,
                'departure_inventory_datetime' => '2018-12-16 15:35:00',
                'departure_inventory_author' => UsersTest::data(1),
                'is_return_inventory_started' => true,
                'is_return_inventory_done' => true,
                'return_inventory_datetime' => null,
                'return_inventory_author' => null,
                'has_materials' => true,
                'has_missing_materials' => null,
                'has_deleted_materials' => false,
                'has_not_returned_materials' => false,
                'has_unassigned_mandatory_positions' => false,
                'categories' => [1, 2],
                'parks' => [1],
                'positions' => [
                    [
                        'id' => 1,
                        'name' => "Régisseur",
                        'is_mandatory' => true,
                        'is_assigned' => true,
                    ],
                    [
                        'id' => 2,
                        'name' => "Technicien plateau",
                        'is_mandatory' => false,
                        'is_assigned' => true,
                    ],
                ],
                'technicians' => [
                    [
                        'id' => 1,
                        'event_id' => 1,
                        'technician_id' => 1,
                        'period' => [
                            'start' => '2018-12-17 09:00:00',
                            'end' => '2018-12-18 22:00:00',
                            'isFullDays' => false,
                        ],
                        'role' => RolesTest::data(1),
                        'technician' => TechniciansTest::data(1),
                    ],
                    [
                        'id' => 2,
                        'event_id' => 1,
                        'technician_id' => 2,
                        'period' => [
                            'start' => '2018-12-18 14:00:00',
                            'end' => '2018-12-18 18:00:00',
                            'isFullDays' => false,
                        ],
                        'role' => RolesTest::data(2),
                        'technician' => TechniciansTest::data(2),
                    ],
                ],
                'beneficiaries' => [
                    BeneficiariesTest::data(1),
                ],
                'materials' => [
                    [
                        'id' => 1,
                        'name' => "Console Yamaha CL3",
                        'reference' => 'CL3',
                        'category_id' => 1,
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
                        'quantity_departed' => 1,
                        'quantity_returned' => 1,
                        'quantity_returned_broken' => 0,
                        'departure_comment' => null,
                        'material' => array_merge(
                            MaterialsTest::data(1, Material::SERIALIZE_WITH_CONTEXT_EXCERPT),
                            [
                                'degressive_rate' => '1.00',
                                'rental_price_period' => '300.00',
                            ],
                        ),
                    ],
                    [
                        'id' => 2,
                        'name' => "DBX PA2",
                        'reference' => 'DBXPA2',
                        'category_id' => 1,
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
                        'quantity_departed' => 1,
                        'quantity_returned' => 1,
                        'quantity_returned_broken' => 0,
                        'departure_comment' => "Le matériel n'est pas en très bon état.",
                        'material' => array_merge(
                            MaterialsTest::data(2, Material::SERIALIZE_WITH_CONTEXT_EXCERPT),
                            [
                                'degressive_rate' => '2.00',
                                'rental_price_period' => '51.00',
                            ],
                        ),
                    ],
                    [
                        'id' => 4,
                        'name' => "Showtec SDS-6",
                        'reference' => 'SDS-6-01',
                        'category_id' => 2,
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
                        'quantity_departed' => 1,
                        'quantity_returned' => 1,
                        'quantity_returned_broken' => 1,
                        'departure_comment' => null,
                        'material' => array_merge(
                            MaterialsTest::data(4, Material::SERIALIZE_WITH_CONTEXT_EXCERPT),
                            [
                                'degressive_rate' => '1.75',
                                'rental_price_period' => '27.91',
                            ],
                        ),
                    ],
                ],
                'extras' => [],
                'invoices' => [
                    InvoicesTest::data(1),
                ],
                'estimates' => [
                    EstimatesTest::data(2),
                    EstimatesTest::data(1),
                ],
                'note' => null,
                'author' => UsersTest::data(1),
                'created_at' => '2018-12-01 12:50:45',
                'updated_at' => '2018-12-05 08:31:21',
            ],
            [
                'id' => 2,
                'reference' => null,
                'title' => 'Second événement',
                'description' => null,
                'location' => 'Lyon',
                'manager' => UsersTest::data(1),
                'color' => '#ffba49',
                'mobilization_period' => [
                    'start' => '2018-12-18 00:00:00',
                    'end' => '2018-12-20 00:00:00',
                    'isFullDays' => false,
                ],
                'operation_period' => [
                    'start' => '2018-12-18',
                    'end' => '2018-12-19',
                    'isFullDays' => true,
                ],
                'materials_count' => 5,
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
                'total_replacement' => '58899.80',
                'is_archived' => false,
                'is_billable' => true,
                'is_confirmed' => false,
                'has_materials' => true,
                'has_missing_materials' => null,
                'has_deleted_materials' => false,
                'has_not_returned_materials' => true,
                'has_unassigned_mandatory_positions' => true,
                'is_departure_inventory_done' => false,
                'departure_inventory_datetime' => null,
                'departure_inventory_author' => null,
                'is_return_inventory_started' => true,
                'is_return_inventory_done' => true,
                'return_inventory_datetime' => '2018-12-20 14:30:00',
                'return_inventory_author' => UsersTest::data(2),
                'categories' => [1],
                'parks' => [1],
                'positions' => [
                    [
                        'id' => 4,
                        'name' => 'Installateur',
                        'is_mandatory' => true,
                        'is_assigned' => false,
                    ],
                ],
                'materials' => [
                    [
                        'id' => 2,
                        'name' => "Processeur DBX PA2",
                        'reference' => 'DBXPA2',
                        'category_id' => 1,
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
                        'quantity_departed' => 2,
                        'quantity_returned' => 2,
                        'quantity_returned_broken' => 0,
                        'departure_comment' => "Validé avec le client.",
                        'material' => array_merge(
                            MaterialsTest::data(2, Material::SERIALIZE_WITH_CONTEXT_EXCERPT),
                            [
                                'degressive_rate' => '2.00',
                                'rental_price_period' => '51.00',
                            ],
                        ),
                    ],
                    [
                        'id' => 1,
                        'name' => "Yamaha CL3",
                        'reference' => 'CL-3',
                        'category_id' => 1,
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
                        'quantity_departed' => 2,
                        'quantity_returned' => 2,
                        'quantity_returned_broken' => 0,
                        'departure_comment' => null,
                        'material' => array_merge(
                            MaterialsTest::data(1, Material::SERIALIZE_WITH_CONTEXT_EXCERPT),
                            [
                                'degressive_rate' => '1.00',
                                'rental_price_period' => '300.00',
                            ],
                        ),
                    ],
                ],
                'extras' => [
                    [
                        'id' => 1,
                        'description' => 'Services additionnels',
                        'quantity' => 2,
                        'unit_price' => '155.00',
                        'tax_id' => 2,
                        'taxes' => [
                            [
                                'name' => 'Taxes diverses',
                                'is_rate' => false,
                                'value' => '10.00',
                            ],
                        ],
                        'total_without_taxes' => '310.00',
                    ],
                    [
                        'id' => 2,
                        'description' => 'Avoir facture du 17/12/2018',
                        'quantity' => 1,
                        'unit_price' => '-3100.00',
                        'tax_id' => null,
                        'taxes' => [],
                        'total_without_taxes' => '-3100.00',
                    ],
                ],
                'beneficiaries' => [
                    BeneficiariesTest::data(3),
                ],
                'technicians' => [],
                'estimates' => [],
                'invoices' => [],
                'note' => "Il faudra envoyer le matériel sur Lyon avant l'avant-veille.",
                'author' => UsersTest::data(1),
                'created_at' => '2018-12-16 12:50:45',
                'updated_at' => null,
            ],
            [
                'id' => 3,
                'reference' => null,
                'title' => 'Avant-premier événement',
                'description' => null,
                'location' => 'Brousse',
                'manager' => null,
                'color' => null,
                'mobilization_period' => [
                    'start' => '2018-12-15 08:30:00',
                    'end' => '2018-12-16 15:45:00',
                    'isFullDays' => false,
                ],
                'operation_period' => [
                    'start' => '2018-12-15 09:00:00',
                    'end' => '2018-12-17 00:00:00',
                    'isFullDays' => false,
                ],
                'materials_count' => 23,
                'currency' => 'EUR',
                'total_replacement' => '1210.99',
                'has_materials' => true,
                'has_missing_materials' => null,
                'has_deleted_materials' => false,
                'has_not_returned_materials' => null,
                'has_unassigned_mandatory_positions' => null,
                'is_archived' => true,
                'is_billable' => false,
                'is_confirmed' => false,
                'is_departure_inventory_done' => true,
                'departure_inventory_datetime' => '2018-12-15 08:17:00',
                'departure_inventory_author' => UsersTest::data(1),
                'is_return_inventory_started' => true,
                'is_return_inventory_done' => true,
                'return_inventory_datetime' => '2018-12-16 15:42:00',
                'return_inventory_author' => UsersTest::data(1),
                'categories' => [1, 2],
                'parks' => [1],
                'positions' => [],
                'materials' => [
                    [
                        'id' => 5,
                        'name' => "Câble XLR 10m",
                        'reference' => 'XLR10',
                        'category_id' => null,
                        'quantity' => 12,
                        'unit_replacement_price' => null,
                        'total_replacement_price' => null,
                        'quantity_departed' => 12,
                        'quantity_returned' => 0,
                        'quantity_returned_broken' => 0,
                        'departure_comment' => null,
                        'material' => array_merge(
                            MaterialsTest::data(5, Material::SERIALIZE_WITH_CONTEXT_EXCERPT),
                            [
                                'degressive_rate' => '1.00',
                                'rental_price_period' => '0.50',
                            ],
                        ),
                    ],
                    [
                        'id' => 3,
                        'name' => "PAR64 LED",
                        'reference' => 'PAR64LED',
                        'category_id' => 2,
                        'quantity' => 10,
                        'unit_replacement_price' => '89.00',
                        'total_replacement_price' => '890.00',
                        'quantity_departed' => 10,
                        'quantity_returned' => 0,
                        'quantity_returned_broken' => 0,
                        'departure_comment' => null,
                        'material' => array_merge(
                            MaterialsTest::data(3, Material::SERIALIZE_WITH_CONTEXT_EXCERPT),
                            [
                                'degressive_rate' => '1.75',
                                'rental_price_period' => '6.13',
                            ],
                        ),
                    ],
                    [
                        'id' => 2,
                        'name' => "Processeur DBX PA2",
                        'reference' => 'DBXPA2',
                        'category_id' => 1,
                        'quantity' => 1,
                        'unit_replacement_price' => '320.99',
                        'total_replacement_price' => '320.99',
                        'quantity_departed' => 1,
                        'quantity_returned' => 0,
                        'quantity_returned_broken' => 0,
                        'departure_comment' => null,
                        'material' => array_merge(
                            MaterialsTest::data(2, Material::SERIALIZE_WITH_CONTEXT_EXCERPT),
                            [
                                'degressive_rate' => '2.00',
                                'rental_price_period' => '51.00',
                            ],
                        ),
                    ],
                ],
                'beneficiaries' => [],
                'technicians' => [],
                'author' => UsersTest::data(1),
                'note' => null,
                'created_at' => '2018-12-14 12:20:00',
                'updated_at' => '2018-12-14 12:30:00',
            ],
            [
                'id' => 4,
                'reference' => null,
                'title' => 'Concert X',
                'description' => null,
                'location' => 'Moon',
                'manager' => null,
                'color' => '#ef5b5b',
                'mobilization_period' => [
                    'start' => '2019-03-01 00:00:00',
                    'end' => '2019-04-11 00:00:00',
                    'isFullDays' => false,
                ],
                'operation_period' => [
                    'start' => '2019-03-01',
                    'end' => '2019-04-10',
                    'isFullDays' => true,
                ],
                'materials_count' => 6,
                'currency' => 'EUR',
                'total_replacement' => '115499.98',
                'is_archived' => false,
                'is_billable' => false,
                'is_confirmed' => false,
                'is_departure_inventory_done' => false,
                'departure_inventory_datetime' => null,
                'departure_inventory_author' => null,
                'is_return_inventory_started' => true,
                'is_return_inventory_done' => false,
                'return_inventory_datetime' => null,
                'return_inventory_author' => null,
                'has_materials' => true,
                'has_missing_materials' => true,
                'has_deleted_materials' => false,
                'has_not_returned_materials' => null,
                'has_unassigned_mandatory_positions' => false,
                'categories' => [1, 3],
                'parks' => [1, 2],
                'positions' => [],
                'materials' => [
                    [
                        'id' => 6,
                        'name' => "Behringer X Air XR18",
                        'reference' => 'XR18',
                        'category_id' => 1,
                        'quantity' => 2,
                        'unit_replacement_price' => '49.99',
                        'total_replacement_price' => '99.98',
                        'quantity_departed' => 1,
                        'quantity_returned' => 1,
                        'quantity_returned_broken' => 0,
                        'departure_comment' => null,
                        'material' => array_merge(
                            MaterialsTest::data(6, Material::SERIALIZE_WITH_CONTEXT_EXCERPT),
                            [
                                'degressive_rate' => '30.93',
                                'rental_price_period' => '1546.19',
                            ],
                        ),
                    ],
                    [
                        'id' => 1,
                        'name' => "Console Yamaha CL3",
                        'reference' => 'CL',
                        'category_id' => 1,
                        'quantity' => 1,
                        'unit_replacement_price' => '19400.00',
                        'total_replacement_price' => '19400.00',
                        'quantity_departed' => null,
                        'quantity_returned' => 0,
                        'quantity_returned_broken' => 0,
                        'departure_comment' => null,
                        'material' => array_merge(
                            MaterialsTest::data(1, Material::SERIALIZE_WITH_CONTEXT_EXCERPT),
                            [
                                'degressive_rate' => '1.00',
                                'rental_price_period' => '300.00',
                            ],
                        ),
                    ],
                    [
                        'id' => 7,
                        'name' => "Voiture 1",
                        'reference' => 'V-1',
                        'category_id' => 3,
                        'quantity' => 3,
                        'unit_replacement_price' => '32000.00',
                        'total_replacement_price' => '96000.00',
                        'quantity_departed' => null,
                        'quantity_returned' => 0,
                        'quantity_returned_broken' => 0,
                        'departure_comment' => null,
                        'material' => array_merge(
                            MaterialsTest::data(7, Material::SERIALIZE_WITH_CONTEXT_EXCERPT),
                            [
                                'degressive_rate' => '30.75',
                                'rental_price_period' => '9225.00',
                            ],
                        ),
                    ],
                ],
                'beneficiaries' => [],
                'technicians' => [],
                'note' => "Penser à contacter Cap Canaveral fin janvier pour booker le pas de tir.",
                'author' => UsersTest::data(1),
                'created_at' => '2019-01-01 20:12:00',
                'updated_at' => null,
            ],
            [
                'id' => 5,
                'reference' => null,
                'title' => "Kermesse de l'école des trois cailloux",
                'description' => null,
                'location' => 'Saint-Jean-la-Forêt',
                'manager' => null,
                'color' => null,
                'mobilization_period' => [
                    'start' => '2020-01-01 00:00:00',
                    'end' => '2020-01-02 00:00:00',
                    'isFullDays' => false,
                ],
                'operation_period' => [
                    'start' => '2020-01-01',
                    'end' => '2020-01-01',
                    'isFullDays' => true,
                ],
                'materials_count' => 2,
                'currency' => 'EUR',
                'total_replacement' => '17000.00',
                'is_archived' => false,
                'is_billable' => false,
                'is_confirmed' => false,
                'is_departure_inventory_done' => false,
                'departure_inventory_datetime' => null,
                'departure_inventory_author' => null,
                'is_return_inventory_started' => false,
                'is_return_inventory_done' => false,
                'return_inventory_datetime' => null,
                'return_inventory_author' => null,
                'has_materials' => true,
                'has_missing_materials' => false,
                'has_deleted_materials' => false,
                'has_not_returned_materials' => null,
                'has_unassigned_mandatory_positions' => false,
                'categories' => [4],
                'parks' => [1],
                'positions' => [],
                'materials' => [
                    [
                        'id' => 8,
                        'name' => "Décor Thème Forêt",
                        'reference' => 'Decor-Forest',
                        'category_id' => 4,
                        'quantity' => 2,
                        'unit_replacement_price' => '8500.00',
                        'total_replacement_price' => '17000.00',
                        'quantity_departed' => 1,
                        'quantity_returned' => null,
                        'quantity_returned_broken' => null,
                        'departure_comment' => null,
                        'material' => array_merge(
                            MaterialsTest::data(8, Material::SERIALIZE_WITH_CONTEXT_EXCERPT),
                            [
                                'degressive_rate' => '1.00',
                                'rental_price_period' => '1500.00',
                            ],
                        ),
                    ],
                ],
                'beneficiaries' => [
                    BeneficiariesTest::data(1),
                ],
                'technicians' => [],
                'note' => null,
                'author' => UsersTest::data(1),
                'created_at' => '2019-12-25 14:59:40',
                'updated_at' => null,
            ],
            [
                'id' => 6,
                'reference' => null,
                'title' => 'Un événement sans inspiration',
                'description' => null,
                'location' => 'La Clusaz',
                'manager' => null,
                'color' => '#ef5b5b',
                'mobilization_period' => [
                    'start' => '2019-03-15 00:00:00',
                    'end' => '2019-04-02 00:00:00',
                    'isFullDays' => false,
                ],
                'operation_period' => [
                    'start' => '2019-03-15',
                    'end' => '2019-04-01',
                    'isFullDays' => true,
                ],
                'materials_count' => 0,
                'currency' => 'EUR',
                'total_replacement' => '0.00',
                'is_archived' => false,
                'is_billable' => false,
                'is_confirmed' => false,
                'is_departure_inventory_done' => false,
                'departure_inventory_datetime' => null,
                'departure_inventory_author' => null,
                'is_return_inventory_started' => false,
                'is_return_inventory_done' => false,
                'return_inventory_datetime' => null,
                'return_inventory_author' => null,
                'has_materials' => false,
                'has_missing_materials' => false,
                'has_deleted_materials' => false,
                'has_not_returned_materials' => null,
                'has_unassigned_mandatory_positions' => false,
                'categories' => [],
                'parks' => [],
                'positions' => [],
                'materials' => [],
                'beneficiaries' => [],
                'technicians' => [],
                'note' => null,
                'author' => UsersTest::data(1),
                'created_at' => '2019-02-01 12:00:00',
                'updated_at' => '2019-02-01 12:05:00',
            ],
            [
                'id' => 7,
                'reference' => null,
                'title' => 'Médiévales de Machin-le-chateau 2023',
                'description' => null,
                'location' => 'Machin-le-chateau',
                'manager' => UsersTest::data(1),
                'color' => null,
                'mobilization_period' => [
                    'start' => '2023-05-25 00:00:00',
                    'end' => '2023-05-29 00:00:00',
                    'isFullDays' => false,
                ],
                'operation_period' => [
                    'start' => '2023-05-25',
                    'end' => '2023-05-28',
                    'isFullDays' => true,
                ],
                'materials_count' => 7,
                'currency' => 'EUR',
                'total_without_global_discount' => '3353.62',
                'global_discount_rate' => '0.0000',
                'total_global_discount' => '0.00',
                'total_without_taxes' => '3353.62',
                'total_taxes' => [
                    [
                        'name' => 'T.V.A.',
                        'is_rate' => true,
                        'value' => '20.000',
                        'total' => '670.72',
                    ],
                ],
                'total_with_taxes' => '4024.34',
                'total_replacement' => '99099.98',
                'is_archived' => false,
                'is_billable' => true,
                'is_confirmed' => true,
                'is_departure_inventory_done' => false,
                'departure_inventory_datetime' => null,
                'departure_inventory_author' => null,
                'is_return_inventory_started' => true,
                'is_return_inventory_done' => false,
                'return_inventory_datetime' => null,
                'return_inventory_author' => null,
                'has_materials' => true,
                'has_missing_materials' => false,
                'has_deleted_materials' => false,
                'has_not_returned_materials' => null,
                'has_unassigned_mandatory_positions' => false,
                'categories' => [1, 2, 3],
                'parks' => [1, 2],
                'positions' => [
                    [
                        'id' => 3,
                        'name' => "Ingénieur du son",
                        'is_mandatory' => false,
                        'is_assigned' => true,
                    ],
                ],
                'materials' => [
                    [
                        'id' => 6,
                        'name' => "Behringer X Air XR18",
                        'reference' => 'XR18',
                        'category_id' => 1,
                        'quantity' => 2,
                        'unit_price' => '49.99',
                        'degressive_rate' => '3.25',
                        'unit_price_period' => '162.47',
                        'total_without_discount' => '324.94',
                        'discount_rate' => '0.0000',
                        'total_discount' => '0.00',
                        'total_without_taxes' => '324.94',
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
                        'material' => array_merge(
                            MaterialsTest::data(6, Material::SERIALIZE_WITH_CONTEXT_EXCERPT),
                            [
                                'degressive_rate' => '3.25',
                                'rental_price_period' => '162.47',
                            ],
                        ),
                    ],
                    [
                        'id' => 1,
                        'name' => "Console Yamaha CL3",
                        'reference' => 'CL3',
                        'category_id' => 1,
                        'quantity' => 2,
                        'unit_price' => '300.00',
                        'degressive_rate' => '3.25',
                        'unit_price_period' => '975.00',
                        'total_without_discount' => '1950.00',
                        'discount_rate' => '0.0000',
                        'total_discount' => '0.00',
                        'total_without_taxes' => '1950.00',
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
                        'material' => array_merge(
                            MaterialsTest::data(1, Material::SERIALIZE_WITH_CONTEXT_EXCERPT),
                            [
                                'degressive_rate' => '1.00',
                                'rental_price_period' => '300.00',
                            ],
                        ),
                    ],
                    [
                        'id' => 4,
                        'name' => "Showtec SDS-6",
                        'reference' => 'SDS-6-01',
                        'category_id' => 2,
                        'quantity' => 2,
                        'unit_price' => '15.95',
                        'degressive_rate' => '3.25',
                        'unit_price_period' => '51.84',
                        'total_without_discount' => '103.68',
                        'discount_rate' => '0.0000',
                        'total_discount' => '0.00',
                        'total_without_taxes' => '103.68',
                        'taxes' => [
                            [
                                'name' => 'T.V.A.',
                                'is_rate' => true,
                                'value' => '20.000',
                            ],
                        ],
                        'unit_replacement_price' => '100.00',
                        'total_replacement_price' => '200.00',
                        'quantity_departed' => null,
                        'quantity_returned' => 1,
                        'quantity_returned_broken' => 1,
                        'departure_comment' => null,
                        'material' => array_merge(
                            MaterialsTest::data(4, Material::SERIALIZE_WITH_CONTEXT_EXCERPT),
                            [
                                'degressive_rate' => '3.25',
                                'rental_price_period' => '51.84',
                            ],
                        ),
                    ],
                    [
                        'id' => 7,
                        'name' => "Volkswagen Transporter",
                        'reference' => 'Transporter',
                        'category_id' => 3,
                        'quantity' => 1,
                        'unit_price' => '300.00',
                        'degressive_rate' => '3.25',
                        'unit_price_period' => '975.00',
                        'total_without_discount' => '975.00',
                        'discount_rate' => '0.0000',
                        'total_discount' => '0.00',
                        'total_without_taxes' => '975.00',
                        'taxes' => [
                            [
                                'name' => 'T.V.A.',
                                'is_rate' => true,
                                'value' => '20.000',
                            ],
                        ],
                        'unit_replacement_price' => '60000.00',
                        'total_replacement_price' => '60000.00',
                        'quantity_departed' => null,
                        'quantity_returned' => null,
                        'quantity_returned_broken' => null,
                        'departure_comment' => null,
                        'material' => array_merge(
                            MaterialsTest::data(7, Material::SERIALIZE_WITH_CONTEXT_EXCERPT),
                            [
                                'degressive_rate' => '3.00',
                                'rental_price_period' => '900.00',
                            ],
                        ),
                    ],
                ],
                'extras' => [],
                'beneficiaries' => [],
                'technicians' => [
                    [
                        'id' => 3,
                        'event_id' => 7,
                        'technician_id' => 2,
                        'technician' => TechniciansTest::data(2),
                        'period' => [
                            'start' => '2023-05-25 00:00:00',
                            'end' => '2023-05-29 00:00:00',
                            'isFullDays' => false,
                        ],
                        'role' => RolesTest::data(3),
                    ],
                ],
                'invoices' => [],
                'estimates' => [],
                'note' => null,
                'author' => UsersTest::data(1),
                'created_at' => '2022-05-29 18:00:00',
                'updated_at' => '2022-05-29 18:05:00',
            ],
            [
                'id' => 8,
                'reference' => null,
                'title' => 'Japan Festival 2024',
                'description' => null,
                'location' => 'Lausanne',
                'manager' => null,
                'color' => '#ffffff',
                'mobilization_period' => [
                    'start' => '2024-06-15 12:00:00',
                    'end' => '2024-08-10 10:00:00',
                    'isFullDays' => false,
                ],
                'operation_period' => [
                    'start' => '2024-07-01 08:00:00',
                    'end' => '2024-07-30 18:00:00',
                    'isFullDays' => false,
                ],
                'materials_count' => 1,
                'currency' => 'EUR',
                'total_replacement' => '1000.00',
                'is_archived' => false,
                'is_billable' => false,
                'is_confirmed' => false,
                'is_departure_inventory_done' => false,
                'departure_inventory_datetime' => null,
                'departure_inventory_author' => null,
                'is_return_inventory_started' => false,
                'is_return_inventory_done' => false,
                'return_inventory_datetime' => null,
                'return_inventory_author' => null,
                'has_materials' => true,
                'has_missing_materials' => false,
                'has_deleted_materials' => false,
                'has_not_returned_materials' => null,
                'has_unassigned_mandatory_positions' => false,
                'categories' => [1],
                'parks' => [1],
                'positions' => [],
                'materials' => [
                    [
                        'id' => 6,
                        'name' => 'Behringer X Air XR18',
                        'reference' => 'XR18',
                        'category_id' => 1,
                        'quantity' => 1,
                        'unit_replacement_price' => '1000.00',
                        'total_replacement_price' => '1000.00',
                        'quantity_departed' => null,
                        'quantity_returned' => null,
                        'quantity_returned_broken' => null,
                        'departure_comment' => null,
                        'material' => array_merge(
                            MaterialsTest::data(6, Material::SERIALIZE_WITH_CONTEXT_EXCERPT),
                            [
                                'degressive_rate' => '22.63',
                                'rental_price_period' => '1131.27',
                            ],
                        ),
                    ],
                ],
                'beneficiaries' => [],
                'technicians' => [],
                'note' => null,
                'author' => UsersTest::data(1),
                'created_at' => '2024-02-12 18:02:29',
                'updated_at' => '2024-02-14 14:22:36',
            ],
        ]);

        $events = match ($format) {
            Event::SERIALIZE_DEFAULT => $events->map(static fn ($event) => (
                Arr::only($event, [
                    'id',
                    'title',
                    'reference',
                    'description',
                    'location',
                    'color',
                    'mobilization_period',
                    'operation_period',
                    'materials_count',
                    'beneficiaries',
                    'is_confirmed',
                    'is_billable',
                    'is_archived',
                    'is_departure_inventory_done',
                    'is_return_inventory_done',
                    'return_inventory_datetime',
                    'has_materials',
                    'note',
                    'created_at',
                    'updated_at',
                ])
            )),
            Event::SERIALIZE_DETAILS => $events->map(static fn ($event) => (
                Arr::except($event, ['parks', 'categories'])
            )),
            Event::SERIALIZE_SUMMARY => $events->map(static fn ($event) => (
                Arr::only($event, [
                    'id',
                    'title',
                    'mobilization_period',
                    'operation_period',
                    'location',
                ])
            )),
            Event::SERIALIZE_BOOKING_DEFAULT => $events->map(static fn ($event) => (
                array_replace(
                    Arr::except($event, ['parks', 'categories']),
                    ['entity' => Event::TYPE],
                )
            )),
            Event::SERIALIZE_BOOKING_SUMMARY => $events->map(static fn ($event) => (
                array_replace(
                    Arr::only($event, [
                        'id',
                        'title',
                        'reference',
                        'description',
                        'location',
                        'color',
                        'manager',
                        'mobilization_period',
                        'operation_period',
                        'beneficiaries',
                        'technicians',
                        'materials_count',
                        'is_confirmed',
                        'is_billable',
                        'is_archived',
                        'is_departure_inventory_done',
                        'is_return_inventory_done',
                        'return_inventory_datetime',
                        'has_materials',
                        'has_missing_materials',
                        'has_not_returned_materials',
                        'has_unassigned_mandatory_positions',
                        'categories',
                        'parks',
                        'author',
                        'created_at',
                    ]),
                    ['entity' => Event::TYPE],
                )
            )),
            Event::SERIALIZE_BOOKING_EXCERPT => $events->map(static fn ($event) => (
                array_replace(
                    Arr::only($event, [
                        'id',
                        'title',
                        'location',
                        'color',
                        'manager',
                        'mobilization_period',
                        'operation_period',
                        'beneficiaries',
                        'technicians',
                        'is_confirmed',
                        'is_archived',
                        'is_departure_inventory_done',
                        'is_return_inventory_done',
                        'return_inventory_datetime',
                        'has_materials',
                        'has_not_returned_materials',
                        'has_unassigned_mandatory_positions',
                        'categories',
                        'parks',
                        'author',
                        'created_at',
                    ]),
                    ['entity' => Event::TYPE],
                )
            )),
            default => throw new \InvalidArgumentException(sprintf("Unknown format \"%s\"", $format)),
        };

        return static::dataFactory($id, $events->all());
    }

    public function testGetOne(): void
    {
        // - Avec un événement inexistant.
        $this->client->get('/api/events/999');
        $this->assertStatusCode(StatusCode::STATUS_NOT_FOUND);

        // - Avec des événements valides
        $ids = array_column(static::data(null), 'id');
        foreach ($ids as $id) {
            $this->client->get(sprintf('/api/events/%d', $id));
            $this->assertStatusCode(StatusCode::STATUS_OK);
            $this->assertResponseData(self::data($id, Event::SERIALIZE_DETAILS));
        }
    }

    public function testCreateEvent(): void
    {
        static::setNow(Carbon::create(2019, 8, 20, 17, 20, 11));

        // - Test avec des données simples
        $data = [
            'title' => "Un nouvel événement",
            'description' => null,
            'mobilization_period' => [
                'start' => '2019-08-15 10:15:00',
                'end' => '2019-09-15 14:30:00',
                'isFullDays' => false,
            ],
            'operation_period' => [
                'start' => '2019-09-01',
                'end' => '2019-09-03',
                'isFullDays' => true,
            ],
            'is_billable' => true,
            'is_confirmed' => true,
            'location' => 'Avignon',
        ];
        $expected = [
            'id' => 9,
            'reference' => null,
            'title' => "Un nouvel événement",
            'description' => null,
            'location' => "Avignon",
            'manager' => null,
            'color' => null,
            'mobilization_period' => [
                'start' => '2019-08-15 10:15:00',
                'end' => '2019-09-15 14:30:00',
                'isFullDays' => false,
            ],
            'operation_period' => [
                'start' => '2019-09-01',
                'end' => '2019-09-03',
                'isFullDays' => true,
            ],
            'materials_count' => 0,
            'currency' => 'EUR',
            'total_without_global_discount' => '0.00',
            'global_discount_rate' => '0.0000',
            'total_global_discount' => '0.00',
            'total_without_taxes' => '0.00',
            'total_taxes' => [],
            'total_with_taxes' => '0.00',
            'total_replacement' => '0.00',
            'is_confirmed' => true,
            'is_archived' => false,
            'is_billable' => true,
            'is_departure_inventory_done' => false,
            'departure_inventory_author' => null,
            'departure_inventory_datetime' => null,
            'is_return_inventory_done' => false,
            'is_return_inventory_started' => false,
            'return_inventory_author' => null,
            'return_inventory_datetime' => null,
            'has_materials' => false,
            'has_missing_materials' => false,
            'has_deleted_materials' => false,
            'has_not_returned_materials' => null,
            'has_unassigned_mandatory_positions' => false,
            'positions' => [],
            'technicians' => [],
            'beneficiaries' => [],
            'materials' => [],
            'extras' => [],
            'invoices' => [],
            'estimates' => [],
            'note' => null,
            'author' => UsersTest::data(1),
            'created_at' => '2019-08-20 17:20:11',
            'updated_at' => '2019-08-20 17:20:11',
        ];
        $this->client->post('/api/events', $data);
        $this->assertStatusCode(StatusCode::STATUS_CREATED);
        $this->assertResponseData($expected);

        // - Test avec des données qui contiennent les sous-entités.
        $this->client->post('/api/events', array_merge($data, [
            'title' => "Encore un événement",
            'beneficiaries' => [3],
            'technicians' => [
                [
                    'id' => 1,
                    'role_id' => 1,
                    'period' => [
                        'start' => '2019-09-01 10:00:00',
                        'end' => '2019-09-03 20:00:00',
                        'isFullDays' => false,
                    ],
                ],
                [
                    'id' => 2,
                    'role_id' => null,
                    'period' => [
                        'start' => '2019-09-01 08:00:00',
                        'end' => '2019-09-03 22:00:00',
                        'isFullDays' => false,
                    ],
                ],
            ],
            'materials' => [
                ['id' => 1, 'quantity' => 1, 'discount_rate' => '50.000'],
                ['id' => 2, 'quantity' => 1],
                ['id' => 4, 'quantity' => 2],
            ],
        ]));
        $this->assertStatusCode(StatusCode::STATUS_CREATED);
        $this->assertResponseData(array_replace($expected, [
            'id' => 10,
            'title' => "Encore un événement",
            'beneficiaries' => [
                BeneficiariesTest::data(3),
            ],
            // - Les postes sont automatiquement ajoutés par l'EventTechnicianObserver.
            'positions' => [
                [
                    'id' => 1,
                    'name' => "Régisseur",
                    'is_mandatory' => false,
                    'is_assigned' => true,
                ],
            ],
            'technicians' => [
                [
                    'id' => 5,
                    'event_id' => 10,
                    'technician_id' => 2,
                    'technician' => TechniciansTest::data(2),
                    'period' => [
                        'start' => '2019-09-01 08:00:00',
                        'end' => '2019-09-03 22:00:00',
                        'isFullDays' => false,
                    ],
                    'role' => null,
                ],
                [
                    'id' => 4,
                    'event_id' => 10,
                    'technician_id' => 1,
                    'technician' => TechniciansTest::data(1),
                    'period' => [
                        'start' => '2019-09-01 10:00:00',
                        'end' => '2019-09-03 20:00:00',
                        'isFullDays' => false,
                    ],
                    'role' => RolesTest::data(1),
                ],
            ],
            'materials' => [
                [
                    'id' => 1,
                    'name' => 'Console Yamaha CL3',
                    'reference' => 'CL3',
                    'category_id' => 1,
                    'quantity' => 1,
                    'unit_price' => '300.00',
                    'degressive_rate' => '1.00',
                    'unit_price_period' => '300.00',
                    'total_without_discount' => '300.00',
                    'discount_rate' => '50.0000',
                    'total_discount' => '150.00',
                    'total_without_taxes' => '150.00',
                    'taxes' => [
                        [
                            'name' => 'T.V.A.',
                            'is_rate' => true,
                            'value' => '20.000',
                        ],
                    ],
                    'quantity_departed' => null,
                    'quantity_returned' => null,
                    'quantity_returned_broken' => null,
                    'departure_comment' => null,
                    'unit_replacement_price' => '19400.00',
                    'total_replacement_price' => '19400.00',
                    'material' => array_merge(
                        MaterialsTest::data(1, Material::SERIALIZE_WITH_CONTEXT_EXCERPT),
                        [
                            'degressive_rate' => '1.00',
                            'rental_price_period' => '300.00',
                        ],
                    ),
                ],
                [
                    'id' => 2,
                    'name' => 'Processeur DBX PA2',
                    'reference' => 'DBXPA2',
                    'category_id' => 1,
                    'quantity' => 1,
                    'unit_price' => '25.50',
                    'degressive_rate' => '3.00',
                    'unit_price_period' => '76.50',
                    'total_without_discount' => '76.50',
                    'discount_rate' => '0.0000',
                    'total_discount' => '0.00',
                    'total_without_taxes' => '76.50',
                    'taxes' => [
                        [
                            'name' => 'T.V.A.',
                            'is_rate' => true,
                            'value' => '20.000',
                        ],
                    ],
                    'quantity_departed' => null,
                    'quantity_returned' => null,
                    'quantity_returned_broken' => null,
                    'departure_comment' => null,
                    'unit_replacement_price' => '349.90',
                    'total_replacement_price' => '349.90',
                    'material' => array_merge(
                        MaterialsTest::data(2, Material::SERIALIZE_WITH_CONTEXT_EXCERPT),
                        [
                            'degressive_rate' => '3.00',
                            'rental_price_period' => '76.50',
                        ],
                    ),
                ],
                [
                    'id' => 4,
                    'name' => 'Showtec SDS-6',
                    'reference' => 'SDS-6-01',
                    'category_id' => 2,
                    'quantity' => 2,
                    'unit_price' => '15.95',
                    'degressive_rate' => '2.50',
                    'unit_price_period' => '39.88',
                    'total_without_discount' => '79.76',
                    'discount_rate' => '0.0000',
                    'total_discount' => '0.00',
                    'total_without_taxes' => '79.76',
                    'taxes' => [
                        [
                            'name' => 'T.V.A.',
                            'is_rate' => true,
                            'value' => '20.000',
                        ],
                    ],
                    'quantity_departed' => null,
                    'quantity_returned' => null,
                    'quantity_returned_broken' => null,
                    'departure_comment' => null,
                    'unit_replacement_price' => '59.00',
                    'total_replacement_price' => '118.00',
                    'material' => array_merge(
                        MaterialsTest::data(4, Material::SERIALIZE_WITH_CONTEXT_EXCERPT),
                        [
                            'degressive_rate' => '2.50',
                            'rental_price_period' => '39.88',
                        ],
                    ),
                ],
            ],
            'materials_count' => 4,
            'has_materials' => true,
            'total_without_global_discount' => '306.26',
            'total_global_discount' => '0.00',
            'total_without_taxes' => '306.26',
            'total_taxes' => [
                [
                    'name' => 'T.V.A.',
                    'is_rate' => true,
                    'value' => '20.000',
                    'total' => '61.25',
                ],
            ],
            'total_with_taxes' => '367.51',
            'total_replacement' => '19867.90',
        ]));
    }

    public function testUpdate(): void
    {
        static::setNow(Carbon::create(2019, 3, 15, 18, 42, 36));

        tap(Event::findOrFail(1), static function (Event $event) {
            $event->is_return_inventory_done = false;
            $event->save();
        });

        // - Inexistant
        $this->client->put('/api/events/999', ['name' => '__inexistant__']);
        $this->assertStatusCode(StatusCode::STATUS_NOT_FOUND);

        // - Sans données.
        $this->client->put('/api/events/1', []);
        $this->assertStatusCode(StatusCode::STATUS_BAD_REQUEST);
        $this->assertApiErrorMessage("No data was provided.");

        // - Test avec des données simples
        $data = [
            'id' => 4,
            'title' => "Premier événement modifié",
            'description' => null,
            'operation_period' => [
                'start' => '2019-03-01',
                'end' => '2019-04-10',
                'isFullDays' => true,
            ],
            'is_billable' => true,
            'is_confirmed' => true,
            'location' => 'Gap et Briançon',
        ];
        $this->client->put('/api/events/4', $data);
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponseData(array_replace(
            self::data(4, Event::SERIALIZE_DETAILS),
            $data,
            [
                'has_missing_materials' => true,
                'materials' => array_replace_recursive(
                    self::data(4, Event::SERIALIZE_DETAILS)['materials'],
                    [
                        [
                            'unit_price' => '49.99',
                            'degressive_rate' => '30.93',
                            'unit_price_period' => '1546.19',
                            'total_without_discount' => '3092.38',
                            'discount_rate' => '0.0000',
                            'total_discount' => '0.00',
                            'total_without_taxes' => '3092.38',
                            'taxes' => [
                                [
                                    'name' => 'T.V.A.',
                                    'is_rate' => true,
                                    'value' => '20.000',
                                ],
                            ],
                        ],
                        [
                            'unit_price' => '300.00',
                            'degressive_rate' => '1.00',
                            'unit_price_period' => '300.00',
                            'total_without_discount' => '300.00',
                            'discount_rate' => '0.0000',
                            'total_discount' => '0.00',
                            'total_without_taxes' => '300.00',
                            'taxes' => [
                                [
                                    'name' => 'T.V.A.',
                                    'is_rate' => true,
                                    'value' => '20.000',
                                ],
                            ],
                        ],
                        [
                            'unit_price' => '300.00',
                            'degressive_rate' => '30.75',
                            'unit_price_period' => '9225.00',
                            'total_without_discount' => '27675.00',
                            'discount_rate' => '0.0000',
                            'total_discount' => '0.00',
                            'total_without_taxes' => '27675.00',
                            'taxes' => [],
                        ],
                    ],
                ),
                'extras' => [],
                'estimates' => [],
                'invoices' => [],
                'total_without_global_discount' => '31067.38',
                'total_global_discount' => '0.00',
                'global_discount_rate' => '0.0000',
                'total_without_taxes' => '31067.38',
                'total_taxes' => [
                    [
                        'name' => 'T.V.A.',
                        'is_rate' => true,
                        'value' => '20.000',
                        'total' => '678.48',
                    ],
                ],
                'total_with_taxes' => '31745.86',
                'total_replacement' => '115499.98',
                'updated_at' => '2019-03-15 18:42:36',
            ],
        ));

        // - Test avec des données qui contiennent les sous-entités (hasMany)
        $dataWithChildren = array_merge($data, [
            'beneficiaries' => [2],
            'technicians' => [
                [
                    'id' => 1,
                    'role_id' => 1,
                    'period' => [
                        'start' => '2019-03-17 10:30:00',
                        'end' => '2019-03-18 23:30:00',
                        'isFullDays' => false,
                    ],
                ],
                [
                    'id' => 2,
                    'role_id' => 2,
                    'period' => [
                        'start' => '2019-03-18 13:30:00',
                        'end' => '2019-03-18 23:30:00',
                        'isFullDays' => false,
                    ],
                ],
            ],
            'materials' => [
                ['id' => 1, 'quantity' => 2],
                ['id' => 2, 'quantity' => 4],
                ['id' => 4, 'quantity' => 3],
            ],
            'extras' => [
                [
                    'description' => 'Nettoyage',
                    'quantity' => 2,
                    'unit_price' => '100.00',
                    'tax_id' => 1,
                ],
            ],
        ]);
        $this->client->put('/api/events/4', $dataWithChildren);
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponseData(array_replace(
            self::data(4, Event::SERIALIZE_DETAILS),
            $data,
            [
                'has_missing_materials' => true,
                'materials_count' => 9,
                'beneficiaries' => [
                    BeneficiariesTest::data(2),
                ],
                // - Les postes sont automatiquement ajoutés par l'EventTechnicianObserver.
                'positions' => [
                    [
                        'id' => 1,
                        'name' => "Régisseur",
                        'is_mandatory' => false,
                        'is_assigned' => true,
                    ],
                    [
                        'id' => 2,
                        'name' => "Technicien plateau",
                        'is_mandatory' => false,
                        'is_assigned' => true,
                    ],
                ],
                'technicians' => [
                    [
                        'id' => 4,
                        'event_id' => 4,
                        'technician_id' => 1,
                        'technician' => TechniciansTest::data(1),
                        'period' => [
                            'start' => '2019-03-17 10:30:00',
                            'end' => '2019-03-18 23:30:00',
                            'isFullDays' => false,
                        ],
                        'role' => RolesTest::data(1),
                    ],
                    [
                        'id' => 5,
                        'event_id' => 4,
                        'technician_id' => 2,
                        'technician' => TechniciansTest::data(2),
                        'period' => [
                            'start' => '2019-03-18 13:30:00',
                            'end' => '2019-03-18 23:30:00',
                            'isFullDays' => false,
                        ],
                        'role' => RolesTest::data(2),
                    ],
                ],
                'materials' => [
                    [
                        'id' => 1,
                        'name' => "Console Yamaha CL3",
                        'reference' => 'CL',
                        'category_id' => 1,
                        'quantity' => 2,
                        'unit_price' => '300.00',
                        'degressive_rate' => '1.00',
                        'unit_price_period' => '300.00',
                        'total_without_discount' => '600.00',
                        'discount_rate' => '0.0000',
                        'total_discount' => '0.00',
                        'total_without_taxes' => '600.00',
                        'taxes' => [
                            [
                                'name' => 'T.V.A.',
                                'is_rate' => true,
                                'value' => '20.000',
                            ],
                        ],
                        'quantity_departed' => null,
                        'quantity_returned' => 0,
                        'quantity_returned_broken' => 0,
                        'departure_comment' => null,
                        'unit_replacement_price' => '19400.00',
                        'total_replacement_price' => '38800.00',
                        'material' => array_merge(
                            MaterialsTest::data(1, Material::SERIALIZE_WITH_CONTEXT_EXCERPT),
                            [
                                'degressive_rate' => '1.00',
                                'rental_price_period' => '300.00',
                            ],
                        ),
                    ],
                    [
                        'id' => 2,
                        'name' => 'Processeur DBX PA2',
                        'reference' => 'DBXPA2',
                        'category_id' => 1,
                        'quantity' => 4,
                        'unit_price' => '25.50',
                        'degressive_rate' => '41.00',
                        'unit_price_period' => '1045.50',
                        'total_without_discount' => '4182.00',
                        'discount_rate' => '0.0000',
                        'total_discount' => '0.00',
                        'total_without_taxes' => '4182.00',
                        'taxes' => [
                            [
                                'name' => 'T.V.A.',
                                'is_rate' => true,
                                'value' => '20.000',
                            ],
                        ],
                        'quantity_departed' => null,
                        'quantity_returned' => null,
                        'quantity_returned_broken' => null,
                        'departure_comment' => null,
                        'unit_replacement_price' => '349.90',
                        'total_replacement_price' => '1399.60',
                        'material' => array_merge(
                            MaterialsTest::data(2, Material::SERIALIZE_WITH_CONTEXT_EXCERPT),
                            [
                                'degressive_rate' => '41.00',
                                'rental_price_period' => '1045.50',
                            ],
                        ),
                    ],
                    [
                        'id' => 4,
                        'name' => 'Showtec SDS-6',
                        'reference' => 'SDS-6-01',
                        'category_id' => 2,
                        'quantity' => 3,
                        'unit_price' => '15.95',
                        'degressive_rate' => '30.93',
                        'unit_price_period' => '493.33',
                        'total_without_discount' => '1479.99',
                        'discount_rate' => '0.0000',
                        'total_discount' => '0.00',
                        'total_without_taxes' => '1479.99',
                        'taxes' => [
                            [
                                'name' => 'T.V.A.',
                                'is_rate' => true,
                                'value' => '20.000',
                            ],
                        ],
                        'quantity_departed' => null,
                        'quantity_returned' => null,
                        'quantity_returned_broken' => null,
                        'departure_comment' => null,
                        'unit_replacement_price' => '59.00',
                        'total_replacement_price' => '177.00',
                        'material' => array_merge(
                            MaterialsTest::data(4, Material::SERIALIZE_WITH_CONTEXT_EXCERPT),
                            [
                                'degressive_rate' => '30.93',
                                'rental_price_period' => '493.33',
                            ],
                        ),
                    ],
                ],
                'extras' => [
                    [
                        'id' => 3,
                        'description' => 'Nettoyage',
                        'quantity' => 2,
                        'unit_price' => '100.00',
                        'tax_id' => 1,
                        'taxes' => [
                            [
                                'name' => 'T.V.A.',
                                'is_rate' => true,
                                'value' => '20.000',
                            ],
                        ],
                        'total_without_taxes' => '200.00',
                    ],
                ],
                'estimates' => [],
                'invoices' => [],
                'total_without_global_discount' => '6461.99',
                'global_discount_rate' => '0.0000',
                'total_global_discount' => '0.00',
                'total_without_taxes' => '6461.99',
                'total_taxes' => [
                    [
                        'name' => 'T.V.A.',
                        'is_rate' => true,
                        'value' => '20.000',
                        'total' => '1292.40',
                    ],
                ],
                'total_with_taxes' => '7754.39',
                'total_replacement' => '40376.60',
                'updated_at' => '2019-03-15 18:42:36',
            ],
        ));
    }

    public function testUpdateNote(): void
    {
        static::setNow(Carbon::create(2023, 5, 25, 12, 0, 0));

        $this->client->put('/api/events/7/note', [
            'note' => "Une nouvelle note",
        ]);
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponseData(array_replace(
            self::data(7, Event::SERIALIZE_DETAILS),
            [
                'note' => "Une nouvelle note",
                'updated_at' => '2023-05-25 12:00:00',
            ],
        ));
    }

    public function testDuplicateEventNotFound(): void
    {
        $this->client->post('/api/events/999/duplicate', []);
        $this->assertStatusCode(StatusCode::STATUS_NOT_FOUND);
    }

    public function testDuplicateEventBadData(): void
    {
        $this->client->post('/api/events/1/duplicate', [
            'operation_period' => 'invalid-date',
        ]);
        $this->assertApiValidationError([
            'mobilization_period' => "This field is invalid.",
            'operation_period' => "This field is invalid.",
        ]);
    }

    public function testDuplicateEvent(): void
    {
        static::setNow(Carbon::create(2021, 06, 22, 12, 11, 02));

        // - Duplication de l'événement #1
        $this->client->post('/api/events/1/duplicate', [
            'operation_period' => [
                'start' => '2021-07-01',
                'end' => '2021-07-03',
                'isFullDays' => true,
            ],
            'mobilization_period' => [
                'start' => '2021-07-01 00:00:00',
                'end' => '2021-07-05 14:45:00',
                'isFullDays' => false,
            ],
        ]);
        $this->assertStatusCode(StatusCode::STATUS_CREATED);
        $this->assertResponseData(array_replace(
            self::data(1, Event::SERIALIZE_DETAILS),
            [
                'id' => 9,
                'mobilization_period' => [
                    'start' => '2021-07-01 00:00:00',
                    'end' => '2021-07-05 14:45:00',
                    'isFullDays' => false,
                ],
                'operation_period' => [
                    'start' => '2021-07-01',
                    'end' => '2021-07-03',
                    'isFullDays' => true,
                ],
                'has_missing_materials' => false,
                'has_not_returned_materials' => null,
                'beneficiaries' => [
                    BeneficiariesTest::data(1),
                ],
                'materials' => array_replace_recursive(
                    self::data(1, Event::SERIALIZE_DETAILS)['materials'],
                    [
                        [
                            'unit_price' => '300.00',
                            'degressive_rate' => '1.00',
                            'unit_price_period' => '300.00',
                            'total_without_discount' => '300.00',
                            'total_without_taxes' => '300.00',
                            'quantity_departed' => null,
                            'quantity_returned' => null,
                            'quantity_returned_broken' => null,
                            'departure_comment' => null,
                            'unit_replacement_price' => '19400.00',
                            'total_replacement_price' => '19400.00',
                        ],
                        [
                            'name' => "Processeur DBX PA2",
                            'degressive_rate' => '3.00',
                            'unit_price_period' => '76.50',
                            'total_without_discount' => '76.50',
                            'total_without_taxes' => '76.50',
                            'quantity_departed' => null,
                            'quantity_returned' => null,
                            'quantity_returned_broken' => null,
                            'departure_comment' => null,
                            'material' => [
                                'degressive_rate' => '3.00',
                                'rental_price_period' => '76.50',
                            ],
                        ],
                        [
                            'degressive_rate' => '2.50',
                            'unit_price_period' => '39.88',
                            'total_without_discount' => '39.88',
                            'total_without_taxes' => '39.88',
                            'quantity_departed' => null,
                            'quantity_returned' => null,
                            'quantity_returned_broken' => null,
                            'departure_comment' => null,
                            'material' => [
                                'degressive_rate' => '2.50',
                                'rental_price_period' => '39.88',
                            ],
                        ],
                    ],
                ),
                'technicians' => [],
                'invoices' => [],
                'estimates' => [],
                'positions' => array_replace_recursive(
                    self::data(1, Event::SERIALIZE_DETAILS)['positions'],
                    [
                        ['is_assigned' => false],
                        ['is_assigned' => false],
                    ],
                ),
                'has_unassigned_mandatory_positions' => true,
                'total_without_global_discount' => '416.38',
                'global_discount_rate' => '0.0000',
                'total_global_discount' => '0.00',
                'total_with_taxes' => '499.66',
                'total_taxes' => [
                    [
                        'name' => 'T.V.A.',
                        'is_rate' => true,
                        'value' => '20.000',
                        'total' => '83.28',
                    ],
                ],
                'total_without_taxes' => '416.38',
                'is_departure_inventory_done' => false,
                'departure_inventory_author' => null,
                'departure_inventory_datetime' => null,
                'is_return_inventory_started' => false,
                'is_return_inventory_done' => false,
                'return_inventory_author' => null,
                'return_inventory_datetime' => null,
                'total_replacement' => '19808.90',
                'created_at' => '2021-06-22 12:11:02',
                'updated_at' => '2021-06-22 12:11:02',
            ],
        ));

        // - Duplication de l'événement #3
        $this->client->post('/api/events/3/duplicate', [
            'operation_period' => [
                'start' => '2021-07-04',
                'end' => '2021-07-04',
                'isFullDays' => true,
            ],
            'mobilization_period' => [
                'start' => '2021-07-04 00:00:00',
                'end' => '2021-07-05 00:00:00',
                'isFullDays' => false,
            ],
        ]);
        $this->assertStatusCode(StatusCode::STATUS_CREATED);
        $this->assertResponseData(array_replace(
            self::data(3, Event::SERIALIZE_DETAILS),
            [
                'id' => 10,
                'mobilization_period' => [
                    'start' => '2021-07-04 00:00:00',
                    'end' => '2021-07-05 00:00:00',
                    'isFullDays' => false,
                ],
                'operation_period' => [
                    'start' => '2021-07-04',
                    'end' => '2021-07-04',
                    'isFullDays' => true,
                ],
                'is_archived' => false,
                'has_missing_materials' => false,
                'is_departure_inventory_done' => false,
                'departure_inventory_datetime' => null,
                'departure_inventory_author' => null,
                'is_return_inventory_started' => false,
                'is_return_inventory_done' => false,
                'has_unassigned_mandatory_positions' => false,
                'return_inventory_datetime' => null,
                'return_inventory_author' => null,
                'materials' => array_replace_recursive(
                    self::data(3, Event::SERIALIZE_DETAILS)['materials'],
                    [
                        [
                            'quantity_departed' => null,
                            'quantity_returned' => null,
                            'quantity_returned_broken' => null,
                            'departure_comment' => null,
                            'unit_replacement_price' => '9.50',
                            'total_replacement_price' => '114.00',
                        ],
                        [
                            'quantity_departed' => null,
                            'quantity_returned' => null,
                            'quantity_returned_broken' => null,
                            'departure_comment' => null,
                            'material' => [
                                'degressive_rate' => '1.00',
                                'rental_price_period' => '3.50',
                            ],
                        ],
                        [
                            'quantity_departed' => null,
                            'quantity_returned' => null,
                            'quantity_returned_broken' => null,
                            'departure_comment' => null,
                            'unit_replacement_price' => '349.90',
                            'total_replacement_price' => '349.90',
                            'material' => [
                                'degressive_rate' => '1.00',
                                'rental_price_period' => '25.50',
                            ],
                        ],
                    ],
                ),
                'total_replacement' => '1353.90',
                'created_at' => '2021-06-22 12:11:02',
                'updated_at' => '2021-06-22 12:11:02',
            ],
        ));

        // - Duplication de l'événement #4 (avec unités)
        $this->client->post('/api/events/4/duplicate', [
            'operation_period' => [
                'start' => '2021-07-04',
                'end' => '2021-07-04',
                'isFullDays' => true,
            ],
            'mobilization_period' => [
                'start' => '2021-07-03 14:30:00',
                'end' => '2021-07-05 12:00:00',
                'isFullDays' => false,
            ],
        ]);
        $this->assertStatusCode(StatusCode::STATUS_CREATED);
        $this->assertResponseData(array_replace(
            self::data(4, Event::SERIALIZE_DETAILS),
            [
                'id' => 11,
                'color' => '#ef5b5b',
                'mobilization_period' => [
                    'start' => '2021-07-03 14:30:00',
                    'end' => '2021-07-05 12:00:00',
                    'isFullDays' => false,
                ],
                'operation_period' => [
                    'start' => '2021-07-04',
                    'end' => '2021-07-04',
                    'isFullDays' => true,
                ],
                'has_missing_materials' => true,
                'is_return_inventory_started' => false,
                'materials' => array_replace_recursive(
                    self::data(4, Event::SERIALIZE_DETAILS)['materials'],
                    [
                        [
                            'quantity_departed' => null,
                            'quantity_returned' => null,
                            'quantity_returned_broken' => null,
                            'departure_comment' => null,
                            'total_replacement_price' => '838.00',
                            'unit_replacement_price' => '419.00',
                            'material' => [
                                'degressive_rate' => '1.00',
                                'rental_price_period' => '49.99',
                            ],
                        ],
                        [
                            'reference' => 'CL3',
                            'quantity_departed' => null,
                            'quantity_returned' => null,
                            'quantity_returned_broken' => null,
                            'departure_comment' => null,
                        ],
                        [
                            'name' => "Volkswagen Transporter",
                            'reference' => 'Transporter',
                            'quantity_departed' => null,
                            'quantity_returned' => null,
                            'quantity_returned_broken' => null,
                            'departure_comment' => null,
                            'material' => [
                                'degressive_rate' => '1.00',
                                'rental_price_period' => '300.00',
                            ],
                        ],
                    ],
                ),
                'note' => "Penser à contacter Cap Canaveral fin janvier pour booker le pas de tir.",
                'total_replacement' => '116238.00',
                'created_at' => '2021-06-22 12:11:02',
                'updated_at' => '2021-06-22 12:11:02',
            ],
        ));

        // - Duplication de l'événement 7.
        $this->client->post('/api/events/7/duplicate', [
            'operation_period' => [
                'start' => '2023-05-26',
                'end' => '2023-05-29',
                'isFullDays' => true,
            ],
            'mobilization_period' => [
                'start' => '2023-05-26',
                'end' => '2023-05-29',
                'isFullDays' => true,
            ],
        ]);
        $this->assertStatusCode(StatusCode::STATUS_CREATED);
        $this->assertResponseData(array_replace(
            self::data(7, Event::SERIALIZE_DETAILS),
            [
                'id' => 12,
                'mobilization_period' => [
                    'start' => '2023-05-26 00:00:00',
                    'end' => '2023-05-30 00:00:00',
                    'isFullDays' => false,
                ],
                'operation_period' => [
                    'start' => '2023-05-26',
                    'end' => '2023-05-29',
                    'isFullDays' => true,
                ],
                'has_missing_materials' => true,
                'is_departure_inventory_done' => false,
                'departure_inventory_datetime' => null,
                'departure_inventory_author' => null,
                'is_return_inventory_started' => false,
                'is_return_inventory_done' => false,
                'return_inventory_datetime' => null,
                'return_inventory_author' => null,
                'is_confirmed' => false,
                'technicians' => [],
                'positions' => array_replace_recursive(
                    self::data(7, Event::SERIALIZE_DETAILS)['positions'],
                    [
                        ['is_assigned' => false],
                    ],
                ),
                'materials' => [
                    array_replace(
                        self::data(7, Event::SERIALIZE_DETAILS)['materials'][0],
                        [
                            'name' => "Behringer X Air XR18",
                            'reference' => 'XR18',
                            'quantity' => 2,
                            'quantity_departed' => null,
                            'quantity_returned' => null,
                            'quantity_returned_broken' => null,
                            'departure_comment' => null,
                            'unit_replacement_price' => '419.00',
                            'total_replacement_price' => '838.00',
                        ],
                    ),
                    array_replace(
                        self::data(7, Event::SERIALIZE_DETAILS)['materials'][1],
                        [
                            'name' => "Console Yamaha CL3",
                            'reference' => 'CL3',
                            'quantity' => 2,
                            'degressive_rate' => '1.00',
                            'unit_price_period' => '300.00',
                            'total_without_discount' => '600.00',
                            'total_without_taxes' => '600.00',
                            'quantity_departed' => null,
                            'quantity_returned' => null,
                            'quantity_returned_broken' => null,
                            'departure_comment' => null,
                        ],
                    ),
                    array_replace(
                        self::data(7, Event::SERIALIZE_DETAILS)['materials'][2],
                        [
                            'name' => "Showtec SDS-6",
                            'reference' => 'SDS-6-01',
                            'quantity' => 2,
                            'quantity_departed' => null,
                            'quantity_returned' => null,
                            'quantity_returned_broken' => null,
                            'departure_comment' => null,
                            'unit_replacement_price' => '59.00',
                            'total_replacement_price' => '118.00',
                        ],
                    ),
                    array_replace(
                        self::data(7, Event::SERIALIZE_DETAILS)['materials'][3],
                        [
                            'name' => "Volkswagen Transporter",
                            'reference' => 'Transporter',
                            'quantity' => 1,
                            'degressive_rate' => '3.00',
                            'unit_price_period' => '900.00',
                            'total_without_discount' => '900.00',
                            'total_without_taxes' => '900.00',
                            'taxes' => [],
                            'quantity_departed' => null,
                            'quantity_returned' => null,
                            'quantity_returned_broken' => null,
                            'departure_comment' => null,
                            'unit_replacement_price' => '32000.00',
                            'total_replacement_price' => '32000.00',
                        ],
                    ),
                ],
                'total_without_global_discount' => '1928.62',
                'total_without_taxes' => '1928.62',
                'total_taxes' => [
                    [
                        'name' => 'T.V.A.',
                        'is_rate' => true,
                        'value' => '20.000',
                        'total' => '205.72',
                    ],
                ],
                'total_with_taxes' => '2134.34',
                'total_replacement' => '71756.00',
                'created_at' => '2021-06-22 12:11:02',
                'updated_at' => '2021-06-22 12:11:02',
            ],
        ));
    }

    public function testUpdateDepartureInventory(): void
    {
        static::setNow(Carbon::create(2019, 3, 15, 10, 00, 00));

        // - On crée une pénurie dans l'événement #3 en modifiant l'événement #1.
        $event1 = Event::findOrFail(1);
        $event1->operation_start_date = '2018-12-14 00:00:00';
        $event1->mobilization_start_date = '2018-12-14 00:00:00';
        $event1->departure_inventory_author_id = null;
        $event1->departure_inventory_datetime = null;
        $event1->is_departure_inventory_done = false;
        $event1->return_inventory_author_id = null;
        $event1->return_inventory_datetime = null;
        $event1->is_return_inventory_done = false;
        $event1->save();
        $event1->syncMaterials([
            ['id' => 1, 'quantity' => 1],
            ['id' => 2, 'quantity' => 100],
            ['id' => 4, 'quantity' => 1],
        ]);

        $validInventories = [
            3 => [
                ['id' => 3, 'actual' => 5],
                ['id' => 2, 'actual' => 0],
                [
                    'id' => 5,
                    'actual' => 10,
                    'comment' => 'Bon état général.',
                ],
            ],
            7 => [
                ['id' => 1, 'actual' => 0],
                [
                    'id' => 6,
                    'actual' => 1,
                    'comment' => 'Ok, un des mélangeur en attente de réception.',
                ],
                [
                    'id' => 7,
                    'actual' => 1,
                ],
                [
                    'id' => 4,
                    'actual' => 1,
                    'comment' => "Potard droit de l'une des deux console endommagé.",
                ],
            ],
        ];

        // - Avec un événement inexistant.
        $this->client->put('/api/events/999/departure');
        $this->assertStatusCode(StatusCode::STATUS_NOT_FOUND);

        // - Avec un événement vide.
        $this->client->put('/api/events/6/departure', []);
        $this->assertStatusCode(StatusCode::STATUS_UNPROCESSABLE_ENTITY);
        $this->assertApiErrorMessage('This event contains no material, so there can be no inventory.');

        // - Avec un événement archivé.
        $this->client->put('/api/events/3/departure', $validInventories[3]);
        $this->assertStatusCode(StatusCode::STATUS_UNPROCESSABLE_ENTITY);
        $this->assertApiErrorMessage("This event is archived.");

        // - On repasse l'événement en non archivé.
        $event3 = Event::findOrFail(3);
        $event3->is_archived = false;
        $event3->save();

        static::setNow(Carbon::create(2018, 12, 18, 10, 00, 00));

        // - Avec un événement dont l'inventaire de départ est déjà terminé.
        $this->client->put('/api/events/3/departure', $validInventories[3]);
        $this->assertStatusCode(StatusCode::STATUS_CONFLICT);
        $this->assertApiErrorMessage("This event's departure inventory is already done.");

        // - On repasse l'inventaire de départ en non terminé.
        $event3->departure_inventory_author_id = null;
        $event3->departure_inventory_datetime = null;
        $event3->is_departure_inventory_done = false;
        $event3->save();

        // - Avec un événement dont l'inventaire de retour n'est plus réalisable.
        //   => Car : Inventaire de retour déjà effectué.
        $this->client->put('/api/events/3/departure', $validInventories[3]);
        $this->assertStatusCode(StatusCode::STATUS_UNPROCESSABLE_ENTITY);
        $this->assertApiErrorMessage("This event's departure inventory can no longer be done.");

        // - On repasse l'inventaire de retour en non terminé.
        $event3->return_inventory_author_id = null;
        $event3->return_inventory_datetime = null;
        $event3->is_return_inventory_done = false;
        $event3->save();

        // - Avec un événement dont l'inventaire de retour n'est plus réalisable.
        //   => Car : Période de réalisation d'inventaire dépassée.
        $this->client->put('/api/events/3/departure', $validInventories[3]);
        $this->assertStatusCode(StatusCode::STATUS_UNPROCESSABLE_ENTITY);
        $this->assertApiErrorMessage("This event's departure inventory can no longer be done.");

        // - On met la date courante à la date de début de l'événement.
        static::setNow(Carbon::create(2018, 12, 15, 10, 00, 00));

        // - Avec un événement qui contient des pénuries.
        $this->client->put('/api/events/3/departure', $validInventories[3]);
        $this->assertStatusCode(StatusCode::STATUS_UNPROCESSABLE_ENTITY);
        $this->assertApiErrorMessage(
            "This event contains shortage that should be fixed " .
            "before proceeding with the departure inventory.",
        );

        // - On corrige la pénurie en déplaçant l'événement #1.
        $event1->operation_start_date = '2018-12-17 00:00:00';
        $event1->mobilization_start_date = '2018-12-17 00:00:00';
        $event1->save();

        // - Avec un payload vide.
        $this->client->put('/api/events/3/departure', []);
        $this->assertStatusCode(StatusCode::STATUS_BAD_REQUEST);
        $this->assertApiErrorMessage("No data was provided.");

        // - Avec un payload invalide.
        foreach ([[['foo' => 'bar']], [1], [true]] as $invalidInventory) {
            $this->client->put('/api/events/3/departure', $invalidInventory);
            $this->assertStatusCode(StatusCode::STATUS_BAD_REQUEST);
            $this->assertApiErrorMessage("Invalid data format.");
        }

        // - Avec des données invalides...
        $this->client->put('/api/events/3/departure', [
            ['id' => 3, 'actual' => 15],
            ['id' => 5, 'actual' => 0, 'comment' => 'Ok.'],
        ]);
        $this->assertApiValidationError([
            ['id' => 3, 'message' => "The outgoing quantity cannot be greater than the planned quantity."],
            ['id' => 2, 'message' => "Please specify outgoing quantity."],
        ]);

        // - On met la date courante à la date de début de l'événement #3.
        static::setNow(Carbon::create(2018, 12, 15, 10, 00, 00));

        $initialData = array_replace(
            self::data(3, Event::SERIALIZE_DETAILS),
            [
                'is_archived' => false,
                'has_missing_materials' => false,
                'is_departure_inventory_done' => false,
                'departure_inventory_author' => null,
                'departure_inventory_datetime' => null,
                'is_return_inventory_done' => false,
                'return_inventory_author' => null,
                'return_inventory_datetime' => null,
                'has_unassigned_mandatory_positions' => false,
                'updated_at' => '2018-12-18 10:00:00',
            ],
        );

        // - Avec des données valides simples...
        $this->client->put('/api/events/3/departure', $validInventories[3]);
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponseData(array_replace_recursive(
            $initialData,
            [
                'materials' => [
                    [
                        'quantity_departed' => 10,
                        'departure_comment' => 'Bon état général.',
                    ],
                    [
                        'quantity_departed' => 5,
                        'departure_comment' => null,
                    ],
                    [
                        'quantity_departed' => 0,
                        'departure_comment' => null,
                    ],
                ],
            ],
        ));

        // - On met la date courante à la date de début de l'événement #7.
        static::setNow(Carbon::create(2023, 5, 25, 10, 00, 00));

        // - Avec des données valides avec listes...
        $this->client->put('/api/events/7/departure', $validInventories[7]);
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponseData(array_replace_recursive(
            self::data(7, Event::SERIALIZE_DETAILS),
            [
                'materials' => [
                    [
                        'quantity_departed' => 1,
                        'departure_comment' => 'Ok, un des mélangeur en attente de réception.',
                    ],
                    [
                        'quantity_departed' => 0,
                        'departure_comment' => null,
                    ],
                    [
                        'quantity_departed' => 1,
                        'departure_comment' => "Potard droit de l'une des deux console endommagé.",
                    ],
                    [
                        'quantity_departed' => 1,
                        'departure_comment' => null,
                    ],
                ],
            ],
        ));
    }

    public function testFinishDepartureInventory(): void
    {
        static::setNow(Carbon::create(2019, 3, 15, 10, 00, 00));

        // - On crée une pénurie dans l'événement #3 en modifiant l'événement #1.
        $event1 = Event::findOrFail(1);
        $event1->operation_start_date = '2018-12-14 00:00:00';
        $event1->mobilization_start_date = '2018-12-14 00:00:00';
        $event1->departure_inventory_author_id = null;
        $event1->departure_inventory_datetime = null;
        $event1->is_departure_inventory_done = false;
        $event1->return_inventory_author_id = null;
        $event1->return_inventory_datetime = null;
        $event1->is_return_inventory_done = false;
        $event1->save();
        $event1->syncMaterials([
            ['id' => 1, 'quantity' => 1],
            ['id' => 2, 'quantity' => 100],
            ['id' => 4, 'quantity' => 1],
        ]);

        $validInventories = [
            3 => [
                ['id' => 3, 'actual' => 10],
                ['id' => 2, 'actual' => 1],
                [
                    'id' => 5,
                    'actual' => 12,
                    'comment' => 'Bon état général.',
                ],
            ],
            7 => [
                ['id' => 1, 'actual' => 2],
                [
                    'id' => 6,
                    'actual' => 2,
                    'comment' => 'Ok.',
                ],
                [
                    'id' => 7,
                    'actual' => 1,
                ],
                [
                    'id' => 4,
                    'actual' => 2,
                    'comment' => "Potard droit de l'une des deux console endommagé.",
                ],
            ],
        ];

        // - Avec un événement inexistant.
        $this->client->put('/api/events/999/departure/finish');
        $this->assertStatusCode(StatusCode::STATUS_NOT_FOUND);

        // - Avec un événement vide.
        $this->client->put('/api/events/6/departure/finish');
        $this->assertStatusCode(StatusCode::STATUS_UNPROCESSABLE_ENTITY);
        $this->assertApiErrorMessage('This event contains no material, so there can be no inventory.');

        // - Avec un événement archivé.
        $this->client->put('/api/events/3/departure/finish', $validInventories[3]);
        $this->assertStatusCode(StatusCode::STATUS_UNPROCESSABLE_ENTITY);
        $this->assertApiErrorMessage("This event is archived.");

        // - On repasse l'événement en non archivé.
        $event3 = Event::findOrFail(3);
        $event3->is_archived = false;
        $event3->save();

        static::setNow(Carbon::create(2018, 12, 18, 10, 00, 00));

        // - Avec un événement dont l'inventaire de départ est déjà terminé.
        $this->client->put('/api/events/3/departure/finish', $validInventories[3]);
        $this->assertStatusCode(StatusCode::STATUS_CONFLICT);
        $this->assertApiErrorMessage("This event's departure inventory is already done.");

        // - On repasse l'inventaire de départ en non terminé.
        $event3->departure_inventory_author_id = null;
        $event3->departure_inventory_datetime = null;
        $event3->is_departure_inventory_done = false;
        $event3->save();

        // - Avec un événement dont l'inventaire de retour n'est plus réalisable.
        //   => Car : Inventaire de retour déjà effectué.
        $this->client->put('/api/events/3/departure/finish', $validInventories[3]);
        $this->assertStatusCode(StatusCode::STATUS_UNPROCESSABLE_ENTITY);
        $this->assertApiErrorMessage("This event's departure inventory can no longer be done.");

        // - On repasse l'inventaire de retour en non terminé.
        $event3->return_inventory_author_id = null;
        $event3->return_inventory_datetime = null;
        $event3->is_return_inventory_done = false;
        $event3->save();

        // - Avec un événement dont l'inventaire de retour n'est plus réalisable.
        //   => Car : Période de réalisation d'inventaire dépassée.
        $this->client->put('/api/events/3/departure/finish', $validInventories[3]);
        $this->assertStatusCode(StatusCode::STATUS_UNPROCESSABLE_ENTITY);
        $this->assertApiErrorMessage("This event's departure inventory can no longer be done.");

        // - On met la date courante à la date de début de l'événement.
        static::setNow(Carbon::create(2018, 12, 15, 10, 00, 00));

        // - Avec un événement qui contient des pénuries.
        $this->client->put('/api/events/3/departure/finish', $validInventories[3]);
        $this->assertStatusCode(StatusCode::STATUS_UNPROCESSABLE_ENTITY);
        $this->assertApiErrorMessage(
            "This event contains shortage that should be fixed " .
            "before proceeding with the departure inventory.",
        );

        // - On corrige la pénurie en déplaçant l'événement #1.
        $event1->operation_start_date = '2018-12-17 00:00:00';
        $event1->mobilization_start_date = '2018-12-17 00:00:00';
        $event1->save();

        // - Avec un payload invalide.
        foreach ([[['foo' => 'bar']], [1], [true]] as $invalidInventory) {
            $this->client->put('/api/events/3/departure/finish', $invalidInventory);
            $this->assertStatusCode(StatusCode::STATUS_BAD_REQUEST);
            $this->assertApiErrorMessage("Invalid data format.");
        }

        // - Avec des données invalides...
        $this->client->put('/api/events/3/departure/finish', [
            ['id' => 3, 'actual' => 15],
            ['id' => 5, 'actual' => 0, 'comment' => 'Ok.'],
        ]);
        $this->assertApiValidationError([
            ['id' => 3, 'message' => "The outgoing quantity cannot be greater than the planned quantity."],
            ['id' => 2, 'message' => "Please specify outgoing quantity."],
        ]);

        // - On met la date courante à la date de début de l'événement #3.
        static::setNow(Carbon::create(2018, 12, 15, 10, 00, 00));

        $initialData = array_replace(
            self::data(3, Event::SERIALIZE_DETAILS),
            [
                'is_archived' => false,
                'has_missing_materials' => false,
                'is_departure_inventory_done' => false,
                'departure_inventory_author' => null,
                'departure_inventory_datetime' => null,
                'is_return_inventory_done' => false,
                'has_unassigned_mandatory_positions' => false,
                'return_inventory_author' => null,
                'return_inventory_datetime' => null,
                'updated_at' => '2018-12-18 10:00:00',
            ],
        );

        // - Avec un inventaire incomplet.
        $this->client->put('/api/events/3/departure/finish', [
            ['id' => 3, 'actual' => 5],
            ['id' => 2, 'actual' => 0],
            [
                'id' => 5,
                'actual' => 10,
                'comment' => 'Bon état général.',
            ],
        ]);
        $this->assertStatusCode(StatusCode::STATUS_UNPROCESSABLE_ENTITY);
        $this->assertApiErrorMessage("This event's departure inventory cannot be marked as finished.");

        // - Avec des données valides simples...
        $this->client->put('/api/events/3/departure/finish', $validInventories[3]);
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponseData(array_replace_recursive(
            $initialData,
            [
                'is_confirmed' => true,
                'is_departure_inventory_done' => true,
                'departure_inventory_author' => UsersTest::data(1),
                'departure_inventory_datetime' => '2018-12-15 10:00:00',
                'updated_at' => '2018-12-15 10:00:00',
                'materials' => [
                    [
                        'quantity_departed' => 12,
                        'departure_comment' => 'Bon état général.',
                    ],
                    [
                        'quantity_departed' => 10,
                        'departure_comment' => null,
                    ],
                    [
                        'quantity_departed' => 1,
                        'departure_comment' => null,
                    ],
                ],
            ],
        ));

        // - On met la date courante à la date de début de l'événement #7.
        static::setNow(Carbon::create(2023, 5, 25, 10, 00, 00));

        // - Avec un inventaire incomplet.
        $this->client->put('/api/events/7/departure/finish', [
            ['id' => 1, 'actual' => 0],
            [
                'id' => 6,
                'actual' => 1,
                'comment' => 'Ok, un des mélangeur en attente de réception.',
            ],
            [
                'id' => 7,
                'actual' => 1,
            ],
            [
                'id' => 4,
                'actual' => 1,
                'comment' => "Potard droit de l'une des deux console endommagé.",
            ],
        ]);
        $this->assertStatusCode(StatusCode::STATUS_UNPROCESSABLE_ENTITY);
        $this->assertApiErrorMessage("This event's departure inventory cannot be marked as finished.");

        // - Avec des données valides avec listes...
        $this->client->put('/api/events/7/departure/finish', $validInventories[7]);
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponseData(array_replace_recursive(
            self::data(7, Event::SERIALIZE_DETAILS),
            [
                'is_confirmed' => true,
                'is_departure_inventory_done' => true,
                'departure_inventory_author' => UsersTest::data(1),
                'departure_inventory_datetime' => '2023-05-25 10:00:00',
                'updated_at' => '2023-05-25 10:00:00',
                'materials' => [
                    [
                        'quantity_departed' => 2,
                        'departure_comment' => 'Ok.',
                    ],
                    [
                        'quantity_departed' => 2,
                        'departure_comment' => null,
                    ],
                    [
                        'quantity_departed' => 2,
                        'departure_comment' => "Potard droit de l'une des deux console endommagé.",
                    ],
                    [
                        'quantity_departed' => 1,
                        'departure_comment' => null,
                    ],
                ],
            ],
        ));
    }

    public function testCancelDepartureInventory(): void
    {
        static::setNow(Carbon::create(2018, 12, 15, 11, 0, 0));

        // - Impossible d'annuler un inventaire de départ non effectué.
        $this->client->delete('/api/events/2/departure');
        $this->assertStatusCode(StatusCode::STATUS_BAD_REQUEST);
        $this->assertApiErrorMessage("This event's departure inventory is not done.");

        // - Impossible d'annuler l'inventaire de départ d'un événement archivé.
        $this->client->delete('/api/events/3/departure');
        $this->assertStatusCode(StatusCode::STATUS_UNPROCESSABLE_ENTITY);
        $this->assertApiErrorMessage("This event is archived.");

        $event3 = Event::findOrFail(3);
        $event3->is_archived = false;
        $event3->save();

        // - Impossible d'annuler l'inventaire de départ d'un événement dont
        //   l'inventaire de retour a déjà été effectué.
        $this->client->delete('/api/events/3/departure');
        $this->assertStatusCode(StatusCode::STATUS_UNPROCESSABLE_ENTITY);
        $this->assertApiErrorMessage("This event's return inventory is already done, the departure inventory can no longer be cancelled.");

        $event3->is_return_inventory_done = false;
        $event3->return_inventory_datetime = null;
        $event3->return_inventory_author_id = null;
        $event3->save();

        // - Impossible d'annuler l'inventaire de départ d'un événement
        //   après que celui-ci ai commencé.
        $this->client->delete('/api/events/3/departure');
        $this->assertStatusCode(StatusCode::STATUS_UNPROCESSABLE_ENTITY);
        $this->assertApiErrorMessage(
            "This event has already started, the departure inventory can no " .
            "longer be cancelled.",
        );

        static::setNow(Carbon::create(2018, 12, 15, 8, 20, 0));

        $initialData = array_replace(
            self::data(3, Event::SERIALIZE_DETAILS),
            [
                'is_archived' => false,
                'has_missing_materials' => false,
                'is_return_inventory_started' => false,
                'is_return_inventory_done' => false,
                'has_unassigned_mandatory_positions' => false,
                'return_inventory_author' => null,
                'return_inventory_datetime' => null,
                'updated_at' => '2018-12-15 11:00:00',
            ],
        );

        // - Impossible d'annuler l'inventaire de départ d'un événement
        //   après que celui-ci ai commencé.
        $this->client->delete('/api/events/3/departure');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponseData(array_replace($initialData, [
            'is_departure_inventory_done' => false,
            'departure_inventory_author' => null,
            'departure_inventory_datetime' => null,
            'updated_at' => '2018-12-15 08:20:00',
        ]));
    }

    public function testUpdateReturnInventory(): void
    {
        static::setNow(Carbon::create(2023, 2, 1, 10, 00, 00));

        $validInventories = [
            2 => [
                ['id' => 1, 'actual' => 2, 'broken' => 0],
                ['id' => 2, 'actual' => 2, 'broken' => 1],
            ],
            7 => [
                [
                    'id' => 1,
                    'actual' => 2,
                    'broken' => 2,
                ],
                [
                    'id' => 6,
                    'actual' => 1,
                    'broken' => 0,
                ],
                [
                    'id' => 7,
                    'actual' => 1,
                    'broken' => 1,
                ],
                [
                    'id' => 4,
                    'actual' => 0,
                    'broken' => 0,
                ],
            ],
        ];

        // - Avec un événement inexistant.
        $this->client->put('/api/events/999/return');
        $this->assertStatusCode(StatusCode::STATUS_NOT_FOUND);

        // - Avec un événement dont l'inventaire de retour est déjà terminé.
        $this->client->put('/api/events/2/return', $validInventories[2]);
        $this->assertStatusCode(StatusCode::STATUS_CONFLICT);
        $this->assertApiErrorMessage("This event's return inventory is already done.");

        // - On repasse l'inventaire de retour en non terminé.
        $event = Event::findOrFail(2);
        $event->return_inventory_author_id = null;
        $event->return_inventory_datetime = null;
        $event->is_return_inventory_done = false;
        $event->save();

        // - Avec un événement qui contient des pénuries.
        $this->client->put('/api/events/2/return', $validInventories[2]);
        $this->assertStatusCode(StatusCode::STATUS_UNPROCESSABLE_ENTITY);
        $this->assertApiErrorMessage(
            "This event contains shortage that should be fixed " .
            "before proceeding with the return inventory.",
        );

        // - On modifie les dates de l'événement pour qu'il n'y ait plus de pénurie.
        $event = Event::findOrFail(2);
        $event->mobilization_period = new Period('2022-12-18', '2022-12-19', true);
        $event->operation_period = new Period('2022-12-18', '2022-12-19', true);
        $event->save();

        $initialData = array_replace_recursive(
            self::data(2, Event::SERIALIZE_DETAILS),
            [
                'mobilization_period' => [
                    'start' => '2022-12-18 00:00:00',
                    'end' => '2022-12-20 00:00:00',
                    'isFullDays' => false,
                ],
                'operation_period' => [
                    'start' => '2022-12-18',
                    'end' => '2022-12-19',
                    'isFullDays' => true,
                ],
                'materials' => [
                    [
                        'degressive_rate' => '2.00',
                        'unit_price_period' => '51.00',
                        'total_discount' => '10.20',
                        'total_without_discount' => '102.00',
                        'total_without_taxes' => '91.80',
                    ],
                    [
                        'degressive_rate' => '1.00',
                        'unit_price_period' => '300.00',
                        'total_without_discount' => '900.00',
                        'total_without_taxes' => '900.00',
                    ],
                ],
                'has_missing_materials' => false,
                'has_not_returned_materials' => null,
                'is_return_inventory_done' => false,
                'return_inventory_author' => null,
                'return_inventory_datetime' => null,
                'total_without_global_discount' => '-1798.20',
                'total_without_taxes' => '-1798.20',
                'total_taxes' => [
                    ['total' => '198.36'],
                ],
                'total_with_taxes' => '-1579.84',
                'updated_at' => '2023-02-01 10:00:00',
            ],
        );

        // - Avec un payload vide.
        $this->client->put('/api/events/2/return', []);
        $this->assertStatusCode(StatusCode::STATUS_BAD_REQUEST);
        $this->assertApiErrorMessage("No data was provided.");

        // - Avec un payload invalide.
        foreach ([[['foo' => 'bar']], [1], [true]] as $invalidInventory) {
            $this->client->put('/api/events/2/return', $invalidInventory);
            $this->assertStatusCode(StatusCode::STATUS_BAD_REQUEST);
            $this->assertApiErrorMessage("Invalid data format.");
        }

        // - Avec des données invalides (1)...
        $this->client->put('/api/events/2/return', [
            ['id' => 1, 'actual' => 2, 'broken' => 3],
            ['id' => 2, 'actual' => 3, 'broken' => 0],
        ]);
        $this->assertApiValidationError([
            ['id' => 2, 'message' => "Returned quantity cannot be greater than output quantity."],
            ['id' => 1, 'message' => "Broken quantity cannot be greater than returned quantity."],
        ]);

        // - Avec des données invalides (2)...
        $this->client->put('/api/events/2/return', [
            ['id' => 1, 'actual' => 2, 'broken' => 0],
        ]);
        $this->assertApiValidationError([
            ['id' => 2, 'message' => "Please specify the returned quantity."],
        ]);

        static::setNow(Carbon::create(2023, 6, 2, 12, 30, 00));

        // - Avec des données valides simples...
        $this->client->put('/api/events/2/return', $validInventories[2]);
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponseData(array_replace_recursive(
            $initialData,
            [
                'materials' => [
                    [
                        'quantity' => 2,
                        'quantity_returned' => 2,
                        'quantity_returned_broken' => 1,
                    ],
                    [
                        'quantity' => 3,
                        'quantity_returned' => 2,
                        'quantity_returned_broken' => 0,
                    ],
                ],
            ],
        ));
    }

    public function testFinishReturnInventory(): void
    {
        static::setNow(Carbon::create(2023, 2, 1, 10, 00, 00));

        // - Avec un événement dont l'inventaire de retour est déjà terminé.
        $this->client->put('/api/events/2/return/finish');
        $this->assertStatusCode(StatusCode::STATUS_CONFLICT);
        $this->assertApiErrorMessage("This event's return inventory is already done.");

        // - On repasse l'inventaire de retour en non terminé.
        $event = Event::findOrFail(2);
        $event->return_inventory_author_id = null;
        $event->return_inventory_datetime = null;
        $event->is_return_inventory_done = false;
        $event->save();

        // - Avec un événement qui contient des pénuries.
        $this->client->put('/api/events/2/return/finish');
        $this->assertStatusCode(StatusCode::STATUS_UNPROCESSABLE_ENTITY);
        $this->assertApiErrorMessage(
            "This event contains shortage that should be fixed " .
            "before proceeding with the return inventory.",
        );

        // - On modifie les dates de l'événement pour qu'il n'y ait plus de pénurie.
        $event = Event::findOrFail(2);
        $event->mobilization_period = new Period('2022-12-18', '2022-12-19', true);
        $event->operation_period = new Period('2022-12-18', '2022-12-19', true);
        $event->save();

        $initialData = array_replace_recursive(
            self::data(2, Event::SERIALIZE_DETAILS),
            [
                'mobilization_period' => [
                    'start' => '2022-12-18 00:00:00',
                    'end' => '2022-12-20 00:00:00',
                    'isFullDays' => false,
                ],
                'operation_period' => [
                    'start' => '2022-12-18',
                    'end' => '2022-12-19',
                    'isFullDays' => true,
                ],
                'is_confirmed' => true,
                'materials' => [
                    [
                        'degressive_rate' => '2.00',
                        'unit_price_period' => '51.00',
                        'total_without_discount' => '102.00',
                        'total_discount' => '10.20',
                        'total_without_taxes' => '91.80',
                    ],
                    [
                        'degressive_rate' => '1.00',
                        'unit_price_period' => '300.00',
                        'total_without_discount' => '900.00',
                        'total_without_taxes' => '900.00',
                    ],
                ],
                'total_taxes' => [
                    ['total' => '198.36'],
                ],
                'total_without_global_discount' => '-1798.20',
                'total_without_taxes' => '-1798.20',
                'total_with_taxes' => '-1579.84',
                'updated_at' => '2023-02-01 10:00:00',
            ],
        );

        // - Avec un payload invalide.
        $invalidData = [
            ['date' => 'ok'],
            ['inventory' => ['foo' => 'bar']],
            ['inventory' => true],
            ['inventory' => 1],
        ];
        foreach ($invalidData as $invalidDatum) {
            $this->client->put('/api/events/2/return/finish', $invalidDatum);
            $this->assertStatusCode(StatusCode::STATUS_BAD_REQUEST);
            $this->assertApiErrorMessage("Invalid data format.");
        }

        // - Test avec du matériel non-unitaire.
        $this->client->put('/api/events/2/return/finish', [
            'inventory' => [
                ['id' => 1, 'actual' => 3, 'broken' => 0],
                ['id' => 2, 'actual' => 2, 'broken' => 1],
            ],
            'date' => '2022-12-21 09:00:00',
        ]);
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponseData(array_replace_recursive(
            $initialData,
            [
                'is_return_inventory_done' => true,
                'return_inventory_author' => UsersTest::data(1),
                'return_inventory_datetime' => '2022-12-21 09:00:00',
                'has_not_returned_materials' => false,
                'materials' => [
                    [
                        'quantity_returned_broken' => 1,
                        'material' => [
                            'out_of_order_quantity' => 1,
                            'updated_at' => '2023-02-01 10:00:00',
                        ],
                    ],
                    [
                        'quantity_returned' => 3,
                    ],
                ],
            ],
        ));
    }

    public function testCancelReturnInventory(): void
    {
        // - Impossible d'annuler un inventaire de retour non effectué.
        $this->client->delete('/api/events/4/return');
        $this->assertStatusCode(StatusCode::STATUS_BAD_REQUEST);
        $this->assertApiErrorMessage("This event's return inventory is not done.");

        // - Impossible d'annuler l'inventaire de retour d'un événement archivé.
        $this->client->delete('/api/events/3/return');
        $this->assertStatusCode(StatusCode::STATUS_UNPROCESSABLE_ENTITY);
        $this->assertApiErrorMessage("This event is archived.");

        static::setNow(Carbon::create(2024, 5, 5, 23, 43, 15));

        $event7 = Event::findOrFail(7);
        $event7->updateReturnInventory([
            ['id' => 1, 'actual' => 2, 'broken' => 1],
            [
                'id' => 6,
                'actual' => 1,
                'broken' => 1,
            ],
            [
                'id' => 7,
                'actual' => 1,
                'broken' => 0,
            ],
            [
                'id' => 4,
                'actual' => 2,
                'broken' => 1,
            ],
        ]);
        $event7->finishReturnInventory(User::findOrFail(1), Carbon::create(2023, 5, 30, 19, 15, 00));
        $this->assertSame(Material::findOrFail(1)->out_of_order_quantity, 2);

        $initialData = array_replace_recursive(
            self::data(7, Event::SERIALIZE_DETAILS),
            [
                'has_missing_materials' => null,
                'is_return_inventory_started' => true,
                'is_return_inventory_done' => true,
                'return_inventory_author' => 1,
                'return_inventory_datetime' => '2023-05-30 19:15:00',
                'updated_at' => '2024-05-05 23:43:15',
                'materials' => [
                    [
                        'quantity_returned' => 1,
                        'quantity_returned_broken' => 1,
                    ],
                    [
                        'quantity_returned' => 2,
                        'quantity_returned_broken' => 1,
                        'material' => [
                            'updated_at' => '2024-05-05 23:43:15',
                        ],
                    ],
                    [
                        'quantity_returned' => 2,
                        'quantity_returned_broken' => 1,
                        'material' => [
                            'updated_at' => '2024-05-05 23:43:15',
                        ],
                    ],
                    [
                        'quantity_returned' => 1,
                        'quantity_returned_broken' => 0,
                    ],
                ],
            ],
        );

        static::setNow(Carbon::create(2024, 5, 15, 12, 12, 34));

        // - Impossible d'annuler l'inventaire de retour d'un événement
        //   avec du matériel retourné cassé passé 1 semaine après
        //   l'inventaire de retour initial.
        $this->client->delete('/api/events/7/return');
        $this->assertStatusCode(StatusCode::STATUS_UNPROCESSABLE_ENTITY);
        $this->assertApiErrorMessage("This event's return inventory can no longer been cancelled.");

        static::setNow(Carbon::create(2023, 6, 2, 12, 12, 34));

        // - Test valide.
        $this->client->delete('/api/events/7/return');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponseData(array_replace_recursive($initialData, [
            'has_missing_materials' => false,
            'is_return_inventory_done' => false,
            'return_inventory_author' => null,
            'return_inventory_datetime' => null,
            'updated_at' => '2023-06-02 12:12:34',
            'materials' => [
                0 => [
                    'material' => [
                        'updated_at' => '2023-06-02 12:12:34',
                    ],
                ],
                1 => [
                    'material' => [
                        'updated_at' => '2023-06-02 12:12:34',
                    ],
                ],
                2 => [
                    'material' => [
                        'updated_at' => '2023-06-02 12:12:34',
                    ],
                ],
            ],
        ]));
        $this->assertSame(Material::findOrFail(1)->out_of_order_quantity, 1);
    }

    public function testArchiveEvent(): void
    {
        // - Archivage de l'événement #1 possible, car inventaire de retour terminé.
        $this->client->put('/api/events/1/archive');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponseHasKeyEquals('is_archived', true);

        // - Archivage de l'événement #4 impossible car inventaire de retour pas encore fait.
        $this->client->put('/api/events/4/archive');
        $this->assertApiValidationError([
            'is_archived' => "An event cannot be archived if its return inventory is not done!",
        ]);
    }

    public function testUnarchiveEvent(): void
    {
        // - Désarchivage de l'événement #3
        $this->client->put('/api/events/3/unarchive');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponseHasKeyEquals('is_archived', false);
    }

    public function testDeleteAndDestroyEvent(): void
    {
        // - Suppression (soft delete) de l'événement #4
        //   possible car pas d'inventaire de retour ni confirmé
        $this->client->delete('/api/events/4');
        $this->assertStatusCode(StatusCode::STATUS_NO_CONTENT);
        $event = Event::withTrashed()->find(4);
        $this->assertNotNull($event);
        $this->assertNotEmpty($event->deleted_at);

        // - Suppression définitive de l'événement #4
        $this->client->delete('/api/events/4');
        $this->assertStatusCode(StatusCode::STATUS_NO_CONTENT);
        $this->assertNull(Event::withTrashed()->find(4));
    }

    public function testDeleteEventFail(): void
    {
        // - On ne peut pas supprimer l'événement #1
        //   car son inventaire de retour est terminé
        $this->client->delete('/api/events/1');
        $this->assertStatusCode(StatusCode::STATUS_NOT_FOUND);

        // - Confirmation de l'événement #4 au préalable
        $event = Event::find(4);
        $event->is_confirmed = true;
        $event->save();

        // - On ne peut plus supprimer l'événement #4 car il est confirmé
        $this->client->delete('/api/events/4');
        $this->assertStatusCode(StatusCode::STATUS_NOT_FOUND);
    }

    public function testRestoreEventNotFound(): void
    {
        $this->client->put('/api/events/restore/999');
        $this->assertStatusCode(StatusCode::STATUS_NOT_FOUND);
    }

    public function testRestoreEvent(): void
    {
        // - Suppression de l'événement #4 au préalable
        $this->client->delete('/api/events/4');
        $this->assertStatusCode(StatusCode::STATUS_NO_CONTENT);

        // - Puis restauration de l'événement #4
        $this->client->put('/api/events/restore/4');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertNotNull(Event::find(4));
    }

    public function testGetMissingMaterials(): void
    {
        // - Get missing materials for event #3 (no missing materials)
        $this->client->get('/api/events/3/missing-materials');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponseData([]);

        // - Get missing materials for event #1
        $this->client->get('/api/events/1/missing-materials');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponseData([
            [
                'id' => 2,
                'name' => "DBX PA2",
                'reference' => 'DBXPA2',
                'category_id' => 1,
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
                'quantity_departed' => 1,
                'quantity_returned' => 1,
                'quantity_returned_broken' => 0,
                'quantity_missing' => 1,
                'departure_comment' => "Le matériel n'est pas en très bon état.",
                'unit_replacement_price' => '349.90',
                'total_replacement_price' => '349.90',
                'material' => array_merge(
                    MaterialsTest::data(2, Material::SERIALIZE_WITH_CONTEXT_EXCERPT),
                    [
                        'degressive_rate' => '2.00',
                        'rental_price_period' => '51.00',
                    ],
                ),
            ],
        ]);

        // - Get missing materials for event #4
        $this->client->get('/api/events/4/missing-materials');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponseData([
            [
                'id' => 7,
                'name' => "Voiture 1",
                'reference' => 'V-1',
                'category_id' => 3,
                'quantity' => 3,
                'quantity_departed' => null,
                'quantity_returned' => 0,
                'quantity_returned_broken' => 0,
                'quantity_missing' => 1,
                'departure_comment' => null,
                'unit_replacement_price' => '32000.00',
                'total_replacement_price' => '96000.00',
                'material' => array_merge(
                    MaterialsTest::data(7, Material::SERIALIZE_WITH_CONTEXT_EXCERPT),
                    [
                        'degressive_rate' => '30.75',
                        'rental_price_period' => '9225.00',
                    ],
                ),
            ],
        ]);

        // - Event not found
        $this->client->get('/api/events/999/missing-materials');
        $this->assertStatusCode(StatusCode::STATUS_NOT_FOUND);
    }

    public function testDownloadPdf(): void
    {
        static::setNow(Carbon::create(2022, 9, 23, 12, 0, 0));

        // - Événement inexistant
        $this->client->get('/events/999/pdf');
        $this->assertStatusCode(StatusCode::STATUS_NOT_FOUND);

        // - Téléchargement du fichier PDF de l'événement #1
        $responseStream = $this->client->get('/events/1/pdf');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertTrue($responseStream->isReadable());
        $this->assertMatchesHtmlSnapshot((string) $responseStream);

        // - Téléchargement du fichier PDF de l'événement #2
        $responseStream = $this->client->get('/events/2/pdf');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertTrue($responseStream->isReadable());
        $this->assertMatchesHtmlSnapshot((string) $responseStream);

        // - Téléchargement du fichier PDF de l'événement #7 (classé par listes)
        $responseStream = $this->client->get('/events/7/pdf');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertTrue($responseStream->isReadable());
        $this->assertMatchesHtmlSnapshot((string) $responseStream);

        // - Téléchargement du fichier PDF de l'événement #7 (classé par parcs)
        $responseStream = $this->client->get('/events/7/pdf?sortedBy=parks');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertTrue($responseStream->isReadable());
        $this->assertMatchesHtmlSnapshot((string) $responseStream);

        // - Téléchargement du fichier PDF de l'événement #1 avec un paramétrage
        //   différent des colonnes à afficher.
        Setting::bulkEdit([
            'eventSummary.showReplacementPrices' => false,
            'eventSummary.showDescriptions' => true,
            'eventSummary.showTags' => true,
            'eventSummary.showPictures' => true,
        ]);
        $responseStream = $this->client->get('/events/1/pdf');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertTrue($responseStream->isReadable());
        $this->assertMatchesHtmlSnapshot((string) $responseStream);

        // - Avec les techniciens désactivés.
        static::setCustomConfig(['features.technicians' => false]);
        $responseStream = $this->client->get('/events/7/pdf');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertTrue($responseStream->isReadable());
        $this->assertMatchesHtmlSnapshot((string) $responseStream);
    }

    public function testSearch(): void
    {
        // - Retourne la liste des événement qui ont le terme "premier" dans le titre
        $this->client->get('/api/events?search=premier');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponseData([
            'count' => 2,
            'data' => [
                EventsTest::data(1, Event::SERIALIZE_SUMMARY),
                EventsTest::data(3, Event::SERIALIZE_SUMMARY),
            ],
        ]);

        // - Pareil, mais en excluant l'événement #3
        $this->client->get('/api/events?search=premier&exclude=3');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponseData([
            'count' => 1,
            'data' => [
                EventsTest::data(1, Event::SERIALIZE_SUMMARY),
            ],
        ]);
    }

    public function testCreateInvoice(): void
    {
        static::setNow(Carbon::create(2022, 10, 22, 18, 42, 36));

        $this->client->post('/api/events/2/invoices');
        $this->assertStatusCode(StatusCode::STATUS_CREATED);
        $this->assertResponseData([
            'id' => 2,
            'number' => '2022-00001',
            'date' => '2022-10-22 18:42:36',
            'url' => 'http://loxya.test/invoices/2/pdf',
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
            'currency' => 'EUR',
        ]);
    }

    public function testCreateEstimate(): void
    {
        static::setNow(Carbon::create(2022, 10, 22, 18, 42, 36));

        $this->client->post('/api/events/2/estimates');
        $this->assertStatusCode(StatusCode::STATUS_CREATED);
        $this->assertResponseData([
            'id' => 3,
            'date' => '2022-10-22 18:42:36',
            'url' => 'http://loxya.test/estimates/3/pdf',
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
            'currency' => 'EUR',
        ]);
    }

    public function testCreateAssignment(): void
    {
        tap(Event::findOrFail(1), static function (Event $event) {
            $event->is_return_inventory_done = false;
            $event->save();
        });

        $this->client->post('/api/events/1/assignments', [
            'event_id' => 1,
            'technician_id' => 2,
            'period' => [
                'start' => '2018-12-17 10:00:00',
                'end' => '2018-12-17 20:30:00',
                'isFullDays' => false,
            ],
            'role_id' => 2,
        ]);
        $this->assertStatusCode(StatusCode::STATUS_CREATED);
        $this->assertResponseData([
            'id' => 4,
            'event_id' => 1,
            'technician_id' => 2,
            'technician' => TechniciansTest::data(2),
            'period' => [
                'start' => '2018-12-17 10:00:00',
                'end' => '2018-12-17 20:30:00',
                'isFullDays' => false,
            ],
            'role' => RolesTest::data(2),
        ]);
    }

    public function testUpdateAssignment(): void
    {
        tap(Event::findOrFail(1), static function (Event $event) {
            $event->is_return_inventory_done = false;
            $event->save();
        });

        // - Inexistant (= l'assignation #7 n'appartient pas à l'événement #1).
        $this->client->put('/api/events/1/assignments/3', []);
        $this->assertStatusCode(StatusCode::STATUS_NOT_FOUND);

        // - Sans données.
        $this->client->put('/api/events/1/assignments/1', []);
        $this->assertStatusCode(StatusCode::STATUS_BAD_REQUEST);
        $this->assertApiErrorMessage("No data was provided.");

        // - Avec des données valides.
        $this->client->put('/api/events/1/assignments/1', [
            'role_id' => 1,
            'period' => [
                'start' => '2018-12-17 10:00:00',
                'end' => '2018-12-18 20:00:00',
                'isFullDays' => false,
            ],
        ]);
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponseData(array_replace(
            self::data(1, Event::SERIALIZE_DETAILS)['technicians'][0],
            [
                'role' => RolesTest::data(1),
                'period' => [
                    'start' => '2018-12-17 10:00:00',
                    'end' => '2018-12-18 20:00:00',
                    'isFullDays' => false,
                ],
            ],
        ));
    }

    public function testDeleteAssignment(): void
    {
        tap(Event::findOrFail(1), static function (Event $event) {
            $event->is_return_inventory_done = false;
            $event->save();
        });

        // - Inexistant (= l'assignation #7 n'appartient pas à l'événement #1).
        $this->client->delete('/api/events/1/assignments/3');
        $this->assertStatusCode(StatusCode::STATUS_NOT_FOUND);

        // - Suppression valide.
        $this->client->delete('/api/events/1/assignments/2');
        $this->assertStatusCode(StatusCode::STATUS_NO_CONTENT);
    }

    public function testCreatePosition(): void
    {
        tap(Event::findOrFail(1), static function (Event $event) {
            $event->is_return_inventory_done = false;
            $event->save();
        });

        $this->client->post('/api/events/1/positions', [
            'id' => 3,
            'is_mandatory' => true,
        ]);
        $this->assertStatusCode(StatusCode::STATUS_CREATED);
        $this->assertResponseData([
            'id' => 3,
            'name' => "Ingénieur du son",
            'is_mandatory' => true,
            'is_assigned' => false,
        ]);
    }

    public function testDeletePosition(): void
    {
        tap(Event::findOrFail(1), static function (Event $event) {
            $event->is_return_inventory_done = false;
            $event->save();
        });

        // - Inexistant (= il n'y a pas de position #3 dans l'événement #1).
        $this->client->delete('/api/events/1/positions/3');
        $this->assertStatusCode(StatusCode::STATUS_NOT_FOUND);

        // - Suppression valide.
        $this->client->delete('/api/events/1/positions/2');
        $this->assertStatusCode(StatusCode::STATUS_NO_CONTENT);
    }

    public function testAttachDocument(): void
    {
        static::setNow(Carbon::create(2022, 10, 22, 18, 42, 36));

        $createUploadedFile = static function (string $from) {
            $tmpFile = tmpfile();
            fwrite($tmpFile, file_get_contents($from));
            return $tmpFile;
        };

        // - Événement inexistant.
        $this->client->post('/api/events/999/documents');
        $this->assertStatusCode(StatusCode::STATUS_NOT_FOUND);

        // - Test sans fichier (payload vide)
        $this->client->post('/api/events/3/documents');
        $this->assertStatusCode(StatusCode::STATUS_BAD_REQUEST);
        $this->assertApiErrorMessage("Invalid number of files sent: a single file is expected.");

        // - Test avec un fichier sans problèmes.
        $this->client->post('/api/events/3/documents', null, (
            new UploadedFile(
                $createUploadedFile(TESTS_FILES_FOLDER . DS . 'file.pdf'),
                13_269,
                UPLOAD_ERR_OK,
                "Rapport d'audit 2022.pdf",
                'application/pdf',
            )
        ));
        $this->assertStatusCode(StatusCode::STATUS_CREATED);
        $this->assertResponseData([
            'id' => 7,
            'name' => "Rapport d'audit 2022.pdf",
            'type' => 'application/pdf',
            'size' => 13_269,
            'url' => 'http://loxya.test/documents/7',
            'created_at' => '2022-10-22 18:42:36',
        ]);
        $this->assertSame([7], Event::findOrFail(3)->documents->pluck('id')->all());

        // - Test avec des fichiers avec erreurs.
        $invalidUploads = [
            [
                'file' => new UploadedFile(
                    $createUploadedFile(TESTS_FILES_FOLDER . DS . 'file.pdf'),
                    262_144_000,
                    UPLOAD_ERR_OK,
                    'Un fichier bien trop volumineux.pdf',
                    'application/pdf',
                ),
                'expected' => "This file exceeds maximum size allowed.",
            ],
            [
                'file' => new UploadedFile(
                    $createUploadedFile(TESTS_FILES_FOLDER . DS . 'file.csv'),
                    54,
                    UPLOAD_ERR_CANT_WRITE,
                    'échec-upload.csv',
                    'text/csv',
                ),
                'expected' => "File upload failed.",
            ],
            [
                'file' => new UploadedFile(
                    tmpfile(),
                    121_540,
                    UPLOAD_ERR_OK,
                    'app.dmg',
                    'application/octet-stream',
                ),
                'expected' => "This file type is not allowed.",
            ],
        ];
        foreach ($invalidUploads as $invalidUpload) {
            $this->client->post('/api/events/4/documents', null, $invalidUpload['file']);
            $this->assertApiValidationError(['file' => $invalidUpload['expected']]);
        }
    }

    public function testGetDocuments(): void
    {
        // - Événement inexistant.
        $this->client->get('/api/events/999/documents');
        $this->assertStatusCode(StatusCode::STATUS_NOT_FOUND);

        // - Documents de l'événement #2.
        $this->client->get('/api/events/2/documents');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponseData([
            DocumentsTest::data(3),
        ]);

        // - Documents de l'événement #1.
        $this->client->get('/api/events/1/documents');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponseData([]);
    }
}
