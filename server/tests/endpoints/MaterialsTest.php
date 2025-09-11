<?php
declare(strict_types=1);

namespace Loxya\Tests;

use Fig\Http\Message\StatusCodeInterface as StatusCode;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Loxya\Models\Enums\CustomFieldType;
use Loxya\Models\Enums\PropertyEntity;
use Loxya\Models\Event;
use Loxya\Models\Material;
use Loxya\Support\Arr;
use Loxya\Support\File\UploadedFile;
use Loxya\Support\Period;

final class MaterialsTest extends ApiTestCase
{
    public static function data(?int $id = null, string $format = Material::SERIALIZE_DEFAULT)
    {
        $materials = new Collection([
            [
                'id' => 1,
                'name' => 'Console Yamaha CL3',
                'reference' => 'CL3',
                'description' => 'Console numérique 64 entrées / 8 sorties + Master + Sub',
                'park_id' => 1,
                'category_id' => 1,
                'sub_category_id' => 1,
                'rental_price' => '300.00',
                'degressive_rate_id' => 3,
                'tax_id' => 1,
                'stock_quantity' => 5,
                'out_of_order_quantity' => 1,
                'available_quantity' => 4,
                'departure_inventory_todo' => null,
                'return_inventory_todo' => null,
                'replacement_price' => '19400.00',
                'is_hidden_on_bill' => false,
                'is_discountable' => false,
                'is_deleted' => false,
                'picture' => 'http://loxya.test/static/materials/1/picture',
                'note' => null,
                'properties' => [
                    array_merge(PropertiesTest::data(2), [
                        'value' => 'Grise',
                    ]),
                    array_merge(PropertiesTest::data(1), [
                        'value' => 36.5,
                    ]),
                    array_merge(PropertiesTest::data(3), [
                        'value' => 850,
                    ]),
                ],
                'tags' => [
                    TagsTest::data(1),
                ],
                'created_at' => '2021-02-12 23:00:00',
                'updated_at' => '2021-02-12 23:00:00',
            ],
            [
                'id' => 2,
                'name' => 'Processeur DBX PA2',
                'reference' => 'DBXPA2',
                'description' => 'Système de diffusion numérique',
                'park_id' => 1,
                'category_id' => 1,
                'sub_category_id' => 2,
                'rental_price' => '25.50',
                'degressive_rate_id' => null,
                'tax_id' => 1,
                'stock_quantity' => 2,
                'out_of_order_quantity' => 0,
                'available_quantity' => 2,
                'departure_inventory_todo' => null,
                'return_inventory_todo' => null,
                'replacement_price' => '349.90',
                'is_hidden_on_bill' => false,
                'is_discountable' => true,
                'is_deleted' => false,
                'picture' => null,
                'note' => null,
                'properties' => [
                    array_merge(PropertiesTest::data(1), [
                        'value' => 2.2,
                    ]),
                    array_merge(PropertiesTest::data(3), [
                        'value' => 35,
                    ]),
                ],
                'tags' => [
                    TagsTest::data(1),
                ],
                'created_at' => '2021-02-12 23:01:00',
                'updated_at' => '2021-02-12 23:02:00',
            ],
            [
                'id' => 3,
                'name' => 'PAR64 LED',
                'reference' => 'PAR64LED',
                'description' => 'Projecteur PAR64 à LED, avec son set de gélatines',
                'park_id' => 1,
                'category_id' => 2,
                'sub_category_id' => 3,
                'rental_price' => '3.50',
                'degressive_rate_id' => 1,
                'tax_id' => null,
                'stock_quantity' => 34,
                'out_of_order_quantity' => 4,
                'available_quantity' => 30,
                'departure_inventory_todo' => null,
                'return_inventory_todo' => null,
                'replacement_price' => '89.00',
                'is_hidden_on_bill' => false,
                'is_discountable' => true,
                'is_deleted' => false,
                'picture' => null,
                'note' => 'Soyez délicats avec ces projos !',
                'properties' => [
                    array_merge(PropertiesTest::data(1), [
                        'value' => 0.85,
                    ]),
                    array_merge(PropertiesTest::data(3), [
                        'value' => 150,
                    ]),
                ],
                'tags' => [
                    TagsTest::data(1),
                ],
                'created_at' => '2021-02-12 23:02:00',
                'updated_at' => '2021-02-12 23:02:00',
            ],
            [
                'id' => 4,
                'name' => 'Showtec SDS-6',
                'reference' => 'SDS-6-01',
                'description' => "Console DMX (jeu d'orgue) Showtec 6 canaux",
                'park_id' => 1,
                'category_id' => 2,
                'sub_category_id' => 4,
                'rental_price' => '15.95',
                'degressive_rate_id' => 1,
                'tax_id' => 1,
                'stock_quantity' => 2,
                'out_of_order_quantity' => 0,
                'available_quantity' => 2,
                'departure_inventory_todo' => null,
                'return_inventory_todo' => null,
                'replacement_price' => '59.00',
                'is_hidden_on_bill' => false,
                'is_discountable' => true,
                'is_deleted' => false,
                'picture' => null,
                'note' => null,
                'properties' => [
                    array_merge(PropertiesTest::data(4), [
                        'value' => true,
                    ]),
                    array_merge(PropertiesTest::data(1), [
                        'value' => 3.15,
                    ]),
                    array_merge(PropertiesTest::data(3), [
                        'value' => 60,
                    ]),
                ],
                'tags' => [],
                'created_at' => '2021-02-12 23:03:00',
                'updated_at' => '2021-02-12 23:03:00',
            ],
            [
                'id' => 5,
                'name' => 'Câble XLR 10m',
                'reference' => 'XLR10',
                'description' => 'Câble audio XLR 10 mètres, mâle-femelle',
                'park_id' => 1,
                'category_id' => null,
                'sub_category_id' => null,
                'rental_price' => '0.50',
                'degressive_rate_id' => 3,
                'tax_id' => 2,
                'stock_quantity' => 40,
                'out_of_order_quantity' => 8,
                'available_quantity' => 32,
                'departure_inventory_todo' => null,
                'return_inventory_todo' => null,
                'replacement_price' => '9.50',
                'is_hidden_on_bill' => true,
                'is_discountable' => true,
                'is_deleted' => false,
                'picture' => null,
                'note' => null,
                'properties' => [],
                'tags' => [],
                'created_at' => '2021-02-12 23:14:00',
                'updated_at' => '2021-02-12 23:14:00',
            ],
            [
                'id' => 6,
                'name' => 'Behringer X Air XR18',
                'reference' => 'XR18',
                'description' => 'Mélangeur numérique 18 canaux',
                'park_id' => 1,
                'category_id' => 1,
                'sub_category_id' => 1,
                'rental_price' => '49.99',
                'degressive_rate_id' => 1,
                'tax_id' => 1,
                'stock_quantity' => 3,
                'out_of_order_quantity' => 1,
                'available_quantity' => 2,
                'departure_inventory_todo' => null,
                'return_inventory_todo' => null,
                'replacement_price' => '419.00',
                'is_hidden_on_bill' => false,
                'is_discountable' => false,
                'is_deleted' => false,
                'picture' => null,
                'note' => null,
                'tags' => [],
                'properties' => [
                    array_merge(PropertiesTest::data(5), [
                        'value' => '2021-01-28',
                    ]),
                    array_merge(PropertiesTest::data(7), [
                        'value' => "Polyvalent",
                    ]),
                ],
                'created_at' => '2021-02-12 23:15:00',
                'updated_at' => '2021-02-12 23:15:00',
            ],
            [
                'id' => 7,
                'name' => 'Volkswagen Transporter',
                'reference' => 'Transporter',
                'description' => 'Volume utile: 9.3 m3',
                'park_id' => 2,
                'category_id' => 3,
                'sub_category_id' => null,
                'rental_price' => '300.00',
                'degressive_rate_id' => 2,
                'tax_id' => null,
                'stock_quantity' => 2,
                'out_of_order_quantity' => 0,
                'available_quantity' => 2,
                'departure_inventory_todo' => null,
                'return_inventory_todo' => null,
                'replacement_price' => '32000.00',
                'is_hidden_on_bill' => false,
                'is_discountable' => false,
                'is_deleted' => false,
                'picture' => null,
                'note' => null,
                'tags' => [],
                'properties' => [
                    array_merge(PropertiesTest::data(7), [
                        'value' => "Extérieur",
                    ]),
                ],
                'created_at' => '2021-02-12 23:16:00',
                'updated_at' => '2021-02-12 23:16:00',
            ],
            [
                'id' => 8,
                'name' => 'Décor Thème Forêt',
                'description' => 'Forêt mystique, typique des récits fantastiques.',
                'reference' => 'Decor-Forest',
                'park_id' => 1,
                'category_id' => 4,
                'sub_category_id' => null,
                'rental_price' => '1500.00',
                'degressive_rate_id' => 3,
                'tax_id' => 4,
                'stock_quantity' => 2,
                'out_of_order_quantity' => 0,
                'available_quantity' => 2,
                'departure_inventory_todo' => null,
                'return_inventory_todo' => null,
                'replacement_price' => '8500.00',
                'is_hidden_on_bill' => false,
                'is_discountable' => true,
                'is_deleted' => false,
                'picture' => null,
                'note' => null,
                'tags' => [],
                'properties' => [
                    array_merge(PropertiesTest::data(7), [
                        'value' => "Intérieur",
                    ]),
                ],
                'created_at' => '2021-02-12 23:18:00',
                'updated_at' => '2021-02-12 23:18:00',
            ],
        ]);

        $materials = match ($format) {
            Material::SERIALIZE_DEFAULT => $materials->map(static fn ($material) => (
                Arr::except($material, [
                    'available_quantity',
                    'departure_inventory_todo',
                    'return_inventory_todo',
                    'is_deleted',
                ])
            )),
            Material::SERIALIZE_WITH_CONTEXT_EXCERPT => $materials->map(static fn ($material) => (
                Arr::except($material, [
                    'available_quantity',
                    'departure_inventory_todo',
                    'return_inventory_todo',
                ])
            )),
            Material::SERIALIZE_WITH_CONTEXT,
            Material::SERIALIZE_WITH_AVAILABILITY => $materials->map(static fn ($material) => (
                Arr::except($material, [
                    'departure_inventory_todo',
                    'return_inventory_todo',
                ])
            )),
            Material::SERIALIZE_DETAILS => $materials->map(static fn ($material) => (
                Arr::except($material, ['is_deleted'])
            )),
            Material::SERIALIZE_PUBLIC => $materials->map(static fn ($material) => (
                Arr::only($material, [
                    'id',
                    'name',
                    'description',
                    'picture',
                    'available_quantity',
                    'rental_price',
                ])
            )),
            default => throw new \InvalidArgumentException(sprintf("Unknown format \"%s\"", $format)),
        };

        return static::dataFactory($id, $materials->all());
    }

    public function testGetAll(): void
    {
        $this->client->get('/api/materials');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponsePaginatedData(8, [
            self::data(6, Material::SERIALIZE_WITH_AVAILABILITY),
            self::data(5, Material::SERIALIZE_WITH_AVAILABILITY),
            self::data(1, Material::SERIALIZE_WITH_AVAILABILITY),
            self::data(8, Material::SERIALIZE_WITH_AVAILABILITY),
            self::data(3, Material::SERIALIZE_WITH_AVAILABILITY),
            self::data(2, Material::SERIALIZE_WITH_AVAILABILITY),
            self::data(4, Material::SERIALIZE_WITH_AVAILABILITY),
            self::data(7, Material::SERIALIZE_WITH_AVAILABILITY),
        ]);

        $this->client->get('/api/materials?orderBy=reference&ascending=0');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponsePaginatedData(8);
        $results = $this->client->getResponseAsArray();

        $expectedResults = [
            'XR18',
            'XLR10',
            'Transporter',
            'SDS-6-01',
            'PAR64LED',
            'Decor-Forest',
            'DBXPA2',
            'CL3',
        ];
        foreach ($expectedResults as $index => $expected) {
            $this->assertEquals($expected, $results['data'][$index]['reference']);
        }

        $this->client->get('/api/materials?paginated=0');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $results = $this->client->getResponseAsArray();
        $this->assertCount(8, $results);
        $this->assertEquals('Behringer X Air XR18', $results[0]['name']);
        $this->assertEquals(3, $results[0]['stock_quantity']);
        $this->assertEquals(2, $results[0]['available_quantity']);

        $this->client->get('/api/materials?onlyDeleted=1');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponsePaginatedData(0);
    }

    public function testGetAllSearchByName(): void
    {
        // - Recherche simple.
        $this->client->get('/api/materials?search=console');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponsePaginatedData(1);
        $this->assertResponseHasKeyEquals('data.0.reference', 'CL3');

        // - Recherche simple (2).
        $this->client->get('/api/materials?search[]=PA');
        $this->assertResponsePaginatedData(2);
        $this->assertResponseHasKeyEquals('data.0.reference', 'PAR64LED');
        $this->assertResponseHasKeyEquals('data.1.reference', 'DBXPA2');

        // - Recherche multiple.
        $this->client->get('/api/materials?search[]=sds&search[]=PA');
        $this->assertResponsePaginatedData(3);
        $this->assertResponseHasKeyEquals('data.0.reference', 'PAR64LED');
        $this->assertResponseHasKeyEquals('data.1.reference', 'DBXPA2');
        $this->assertResponseHasKeyEquals('data.2.reference', 'SDS-6-01');
    }

    public function testGetMaterialNotFound(): void
    {
        $this->client->get('/api/materials/999');
        $this->assertStatusCode(StatusCode::STATUS_NOT_FOUND);
    }

    public function testGetAllWhileEvent(): void
    {
        $this->client->get('/api/materials/while-event/1');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponseData([
            array_replace_recursive(
                self::data(1, Material::SERIALIZE_WITH_CONTEXT),
                [
                    'degressive_rate' => '1.00',
                    'rental_price_period' => '300.00',
                    'available_quantity' => 1,
                    'is_deleted' => false,
                ],
            ),
            array_replace_recursive(
                self::data(2, Material::SERIALIZE_WITH_CONTEXT),
                [
                    'degressive_rate' => '2.00',
                    'rental_price_period' => '51.00',
                    'available_quantity' => 0,
                    'is_deleted' => false,
                ],
            ),
            array_replace_recursive(
                self::data(8, Material::SERIALIZE_WITH_CONTEXT),
                [
                    'degressive_rate' => '1.00',
                    'rental_price_period' => '1500.00',
                    'available_quantity' => 2,
                    'is_deleted' => false,
                ],
            ),
            array_replace_recursive(
                self::data(3, Material::SERIALIZE_WITH_CONTEXT),
                [
                    'degressive_rate' => '1.75',
                    'rental_price_period' => '6.13',
                    'available_quantity' => 30,
                    'is_deleted' => false,
                ],
            ),
            array_replace_recursive(
                self::data(4, Material::SERIALIZE_WITH_CONTEXT),
                [
                    'degressive_rate' => '1.75',
                    'rental_price_period' => '27.91',
                    'available_quantity' => 2,
                    'is_deleted' => false,
                ],
            ),
            array_replace_recursive(
                self::data(7, Material::SERIALIZE_WITH_CONTEXT),
                [
                    'degressive_rate' => '1.50',
                    'rental_price_period' => '450.00',
                    'available_quantity' => 2,
                    'is_deleted' => false,
                ],
            ),
            array_replace_recursive(
                self::data(5, Material::SERIALIZE_WITH_CONTEXT),
                [
                    'degressive_rate' => '1.00',
                    'rental_price_period' => '0.50',
                    'available_quantity' => 32,
                    'is_deleted' => false,
                ],
            ),
            array_replace_recursive(
                self::data(6, Material::SERIALIZE_WITH_CONTEXT),
                [
                    'degressive_rate' => '1.75',
                    'rental_price_period' => '87.48',
                    'available_quantity' => 2,
                    'is_deleted' => false,
                ],
            ),
        ]);
    }

    public function testGetOne(): void
    {
        // - Matériel simple.
        $this->client->get('/api/materials/1');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponseData(self::data(1, Material::SERIALIZE_DETAILS));
    }

    public function testGetAllByTagsNotFound(): void
    {
        $this->client->get('/api/materials?tags[]=9999');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponseData([
            'pagination' => [
                'currentPage' => 1,
                'perPage' => 100,
                'total' => ['items' => 0, 'pages' => 1],
            ],
            'data' => [],
        ]);
    }

    public function testGetAllByTags(): void
    {
        $this->client->get('/api/materials?tags[]=1');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponsePaginatedData(3);
    }

    public function testGetAllByPark(): void
    {
        $this->client->get('/api/materials?park=1');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponsePaginatedData(7);
    }

    public function testGetAllByCategoryAndSubCategory(): void
    {
        $this->client->get('/api/materials?category=1&subCategory=1');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponsePaginatedData(2);
    }

    public function testGetAllWithQuantitiesPeriod(): void
    {
        // - Récupère le matériel avec les quantités qu'il reste pour une période
        // - pendant laquelle se déroulent les événements #1, #2 et #3
        $this->client->get('/api/materials?quantitiesPeriod[start]=2018-12-16&quantitiesPeriod[end]=2018-12-19');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $response = $this->client->getResponseAsArray();
        $this->assertCount(8, $response['data']);

        foreach ([2, 20, 0, 2, 20, 0, 1, 2] as $index => $expected) {
            $this->assertArrayHasKey('available_quantity', $response['data'][$index]);
            $this->assertEquals($expected, $response['data'][$index]['available_quantity']);
        }

        // - Test avec une période non valide (retourne les quantités en stock uniquement)
        $this->client->get('/api/materials?quantitiesPeriod[end]=2018-12-18');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $response = $this->client->getResponseAsArray();
        $this->assertCount(8, $response['data']);

        foreach ([3, 40, 5, 2, 34, 2, 2, 2] as $index => $expected) {
            $this->assertNotContains('available_quantity', $response['data'][$index]);
            $this->assertEquals($expected, $response['data'][$index]['stock_quantity']);
        }
    }

    public function testCreate(): void
    {
        static::setNow(Carbon::create(2022, 10, 22, 18, 42, 36));

        // - Test avec des données vides.
        $this->client->post('/api/materials');
        $this->assertStatusCode(StatusCode::STATUS_BAD_REQUEST);
        $this->assertApiErrorMessage("No data was provided.");

        // - Test avec des données invalides.
        $this->client->post('/api/materials', [
            'name' => 'Analog Mixing Console Yamaha RM800',
            'reference' => '',
            'park_id' => 1,
            'category_id' => 1,
            'sub_category_id' => 1,
            'rental_price' => '100.00',
            'stock_quantity' => 1,
        ]);
        $this->assertApiValidationError([
            'reference' => "This field is mandatory.",
        ]);

        // - Test avec un matériel qui a déjà la même référence.
        $this->client->post('/api/materials', [
            'name' => 'Analog Mixing Console Yamaha CL3',
            'reference' => 'CL3',
            'park_id' => 1,
            'category_id' => 1,
            'sub_category_id' => 1,
            'rental_price' => '500.00',
            'stock_quantity' => 1,
        ]);
        $this->assertApiValidationError([
            'reference' => "This reference is already in use.",
        ]);

        // - Test avec des caractéristiques spéciales invalides.
        $this->client->post('/api/materials', [
            'name' => 'Console numérique Yamaha 01V96 V2',
            'reference' => '01V96-v2',
            'park_id' => 1,
            'park_location_id' => 3,
            'category_id' => 1,
            'sub_category_id' => 1,
            'rental_price' => '180.00',
            'degressive_rate_id' => 3,
            'tax_id' => 1,
            'replacement_price' => '2000.00',
            'stock_quantity' => 2,
            'properties' => [
                ['id' => 1, 'value' => 'test'],
                ['id' => 2, 'value' => 'Red'],
                ['id' => 3, 'value' => '1000'],
                ['id' => 4, 'value' => 'ok'],
                ['id' => 5, 'value' => '2025-10-21'],
                ['id' => 7, 'value' => new Period('2025-10-21', '2025-10-22', true)],
            ],
        ]);
        $this->assertApiValidationError([
            'properties' => [
                0 => ['value' => 'This field must contain a decimal number.'],
                3 => ['value' => 'This field should be a boolean.'],
                5 => ['value' => 'This field is invalid.'],
            ],
        ]);

        // - Création d'un matériel en lui assignant des tags.
        $this->client->post('/api/materials', [
            'name' => 'Analog Mixing Console Yamaha RM800',
            'reference' => 'RM800',
            'park_id' => 1,
            'category_id' => 1,
            'sub_category_id' => 1,
            'rental_price' => '100.00',
            'replacement_price' => '357.00',
            'stock_quantity' => 1,
            'tags' => [2, 1],
        ]);
        $this->assertStatusCode(StatusCode::STATUS_CREATED);
        $this->assertResponseData([
            'id' => 9,
            'name' => 'Analog Mixing Console Yamaha RM800',
            'reference' => 'RM800',
            'park_id' => 1,
            'category_id' => 1,
            'sub_category_id' => 1,
            'rental_price' => '100.00',
            'degressive_rate_id' => null,
            'tax_id' => null,
            'replacement_price' => '357.00',
            'stock_quantity' => 1,
            'out_of_order_quantity' => 0,
            'available_quantity' => 1,
            'departure_inventory_todo' => null,
            'return_inventory_todo' => null,
            'is_hidden_on_bill' => false,
            'is_discountable' => true,
            'description' => null,
            'picture' => null,
            'note' => null,
            'properties' => [],
            'tags' => [
                TagsTest::data(1),
                TagsTest::data(2),
            ],
            'created_at' => '2022-10-22 18:42:36',
            'updated_at' => '2022-10-22 18:42:36',
        ]);

        // - Création d'un matériel avec des caractéristiques spéciales.
        $this->client->post('/api/materials', [
            'name' => 'Console numérique Yamaha 01V96 V2',
            'reference' => '01V96-v2',
            'park_id' => 1,
            'category_id' => 1,
            'sub_category_id' => 1,
            'rental_price' => '180.00',
            'degressive_rate_id' => 3,
            'tax_id' => 1,
            'replacement_price' => '2000.00',
            'stock_quantity' => 2,
            'properties' => [
                ['id' => 1, 'value' => 12.5],
                ['id' => 3, 'value' => 60],
                ['id' => 4, 'value' => 'true'],
            ],
        ]);
        $this->assertStatusCode(StatusCode::STATUS_CREATED);
        $this->assertResponseData([
            'id' => 10,
            'name' => 'Console numérique Yamaha 01V96 V2',
            'reference' => '01V96-v2',
            'park_id' => 1,
            'category_id' => 1,
            'sub_category_id' => 1,
            'rental_price' => '180.00',
            'replacement_price' => '2000.00',
            'degressive_rate_id' => 3,
            'tax_id' => 1,
            'stock_quantity' => 2,
            'out_of_order_quantity' => 0,
            'available_quantity' => 2,
            'departure_inventory_todo' => null,
            'return_inventory_todo' => null,
            'is_hidden_on_bill' => false,
            'is_discountable' => true,
            'description' => null,
            'picture' => null,
            'note' => null,
            'properties' => [
                [
                    'id' => 4,
                    'name' => 'Conforme',
                    'entities' => [PropertyEntity::MATERIAL->value],
                    'type' => CustomFieldType::BOOLEAN->value,
                    'value' => true,
                ],
                [
                    'id' => 1,
                    'name' => 'Poids',
                    'entities' => [PropertyEntity::MATERIAL->value],
                    'type' => CustomFieldType::FLOAT->value,
                    'unit' => 'kg',
                    'value' => 12.5,
                    'is_totalisable' => true,
                ],
                [
                    'id' => 3,
                    'name' => 'Puissance',
                    'entities' => [PropertyEntity::MATERIAL->value],
                    'type' => CustomFieldType::INTEGER->value,
                    'unit' => 'W',
                    'value' => 60,
                    'is_totalisable' => true,
                ],
            ],
            'tags' => [],
            'created_at' => '2022-10-22 18:42:36',
            'updated_at' => '2022-10-22 18:42:36',
        ]);
    }

    public function testUpdate(): void
    {
        static::setNow(Carbon::create(2023, 5, 26, 16, 0, 0));

        // - Update material #1
        $data = [
            'reference' => 'CL3-v2',
            'stock_quantity' => 6,
        ];
        $this->client->put('/api/materials/1', $data);
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponseData(array_replace_recursive(
            self::data(1, Material::SERIALIZE_DETAILS),
            [
                'reference' => 'CL3-v2',
                'stock_quantity' => 6,
                'available_quantity' => 3,
                'updated_at' => '2023-05-26 16:00:00',
            ],
        ));

        // - Test with a negative value for stock quantity
        $data = ['stock_quantity' => -2];
        $this->client->put('/api/materials/1', $data);
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponseData(array_replace_recursive(
            self::data(1, Material::SERIALIZE_DETAILS),
            [
                'reference' => 'CL3-v2',
                'stock_quantity' => 0,
                'available_quantity' => 0,
                'updated_at' => '2023-05-26 16:00:00',
            ],
        ));

        // - Test with an out-of-order quantity higher than stock quantity
        $data = ['stock_quantity' => 5, 'out_of_order_quantity' => 20];
        $this->client->put('/api/materials/1', $data);
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponseData(array_replace_recursive(
            self::data(1, Material::SERIALIZE_DETAILS),
            [
                'reference' => 'CL3-v2',
                'stock_quantity' => 5,
                'out_of_order_quantity' => 5,
                'available_quantity' => 0,
                'updated_at' => '2023-05-26 16:00:00',
            ],
        ));
    }

    public function testDeleteAndDestroy(): void
    {
        // - First call: soft delete.
        $this->client->delete('/api/materials/5');
        $this->assertStatusCode(StatusCode::STATUS_NO_CONTENT);
        $softDeleted = Material::withTrashed()->find(5);
        $this->assertNotNull($softDeleted);
        $this->assertNotEmpty($softDeleted->deleted_at);

        // - Second call: actually DESTROY record from DB
        $this->client->delete('/api/materials/5');
        $this->assertStatusCode(StatusCode::STATUS_NO_CONTENT);
        $this->assertNull(Material::withTrashed()->find(5));
    }

    public function testRestoreInexistent(): void
    {
        $this->client->put('/api/materials/999/restore');
        $this->assertStatusCode(StatusCode::STATUS_NOT_FOUND);
    }

    public function testRestore(): void
    {
        // - First, delete material #3
        $this->client->delete('/api/materials/3');
        $this->assertStatusCode(StatusCode::STATUS_NO_CONTENT);

        // - Then, restore material #3
        $this->client->put('/api/materials/3/restore');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertNotNull(Material::find(2));
    }

    public function testAttachDocument(): void
    {
        static::setNow(Carbon::create(2022, 10, 22, 18, 42, 36));

        $createUploadedFile = static function (string $from) {
            $tmpFile = tmpfile();
            fwrite($tmpFile, file_get_contents($from));
            return $tmpFile;
        };

        // - Matériel inexistant.
        $this->client->post('/api/materials/999/documents');
        $this->assertStatusCode(StatusCode::STATUS_NOT_FOUND);

        // - Test sans fichier (payload vide)
        $this->client->post('/api/materials/6/documents');
        $this->assertStatusCode(StatusCode::STATUS_BAD_REQUEST);
        $this->assertApiErrorMessage("Invalid number of files sent: a single file is expected.");

        // - Test avec des fichiers sans problèmes.
        $validUploads = [
            [
                'id' => 6,
                'file' => new UploadedFile(
                    $createUploadedFile(TESTS_FILES_FOLDER . DS . 'file.pdf'),
                    13_269,
                    UPLOAD_ERR_OK,
                    "Facture d'achat.pdf",
                    'application/pdf',
                ),
                'expected' => [
                    'id' => 7,
                    'name' => "Facture d'achat.pdf",
                    'type' => 'application/pdf',
                    'size' => 13_269,
                    'url' => 'http://loxya.test/documents/7',
                    'created_at' => '2022-10-22 18:42:36',
                ],
            ],
            [
                'id' => 4,
                'file' => new UploadedFile(
                    $createUploadedFile(TESTS_FILES_FOLDER . DS . 'file.pdf'),
                    13_269,
                    UPLOAD_ERR_OK,
                    'Garantie (expire fin 2023).pdf',
                    'application/pdf',
                ),
                'expected' => [
                    'id' => 8,
                    'name' => 'Garantie (expire fin 2023).pdf',
                    'type' => 'application/pdf',
                    'size' => 13_269,
                    'url' => 'http://loxya.test/documents/8',
                    'created_at' => '2022-10-22 18:42:36',
                ],
            ],
            [
                'id' => 4,
                'file' => new UploadedFile(
                    $createUploadedFile(TESTS_FILES_FOLDER . DS . 'file.pdf'),
                    156_325,
                    UPLOAD_ERR_OK,
                    'Notice.pdf',
                    'application/pdf',
                ),
                'expected' => [
                    'id' => 9,
                    'name' => 'Notice.pdf',
                    'type' => 'application/pdf',
                    'size' => 156_325,
                    'url' => 'http://loxya.test/documents/9',
                    'created_at' => '2022-10-22 18:42:36',
                ],
            ],
        ];
        foreach ($validUploads as $validUpload) {
            $url = sprintf('/api/materials/%d/documents', $validUpload['id']);
            $this->client->post($url, null, $validUpload['file']);
            $this->assertStatusCode(StatusCode::STATUS_CREATED);
            $this->assertResponseData($validUpload['expected']);
        }
        $this->assertSame([7], Material::findOrFail(6)->documents->pluck('id')->all());
        $this->assertSame([8, 9], Material::findOrFail(4)->documents->pluck('id')->all());

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
            $this->client->post('/api/materials/6/documents', null, $invalidUpload['file']);
            $this->assertApiValidationError(['file' => $invalidUpload['expected']]);
        }
    }

    public function testGetDocuments(): void
    {
        // - Matériel inexistant.
        $this->client->get('/api/materials/999/documents');
        $this->assertStatusCode(StatusCode::STATUS_NOT_FOUND);

        // - Documents du matériel #1.
        $this->client->get('/api/materials/1/documents');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponseData([
            DocumentsTest::data(1),
            DocumentsTest::data(2),
        ]);

        // - Documents du matériel #2
        $this->client->get('/api/materials/2/documents');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponseData([]);
    }

    public function testGetBookings(): void
    {
        $this->client->get('/api/materials/1/bookings');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponsePaginatedData(4, [
            array_replace(
                EventsTest::data(7, Event::SERIALIZE_BOOKING_SUMMARY),
                ['pivot' => ['quantity' => 2]],
            ),
            array_replace(
                EventsTest::data(4, Event::SERIALIZE_BOOKING_SUMMARY),
                ['pivot' => ['quantity' => 1]],
            ),
            array_replace(
                EventsTest::data(2, Event::SERIALIZE_BOOKING_SUMMARY),
                ['pivot' => ['quantity' => 3]],
            ),
            array_replace(
                EventsTest::data(1, Event::SERIALIZE_BOOKING_SUMMARY),
                ['pivot' => ['quantity' => 1]],
            ),
        ]);

        // - Avec une limite et un numéro de page.
        $this->client->get('/api/materials/1/bookings?page=2&limit=1');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponsePaginatedData(4, [
            array_replace(
                EventsTest::data(4, Event::SERIALIZE_BOOKING_SUMMARY),
                ['pivot' => ['quantity' => 1]],
            ),
        ]);
    }

    public function testPrintAll(): void
    {
        static::setNow(Carbon::create(2022, 9, 23, 12, 0, 0));

        $responseStream = $this->client->get('/materials/print');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertTrue($responseStream->isReadable());
        $this->assertMatchesHtmlSnapshot((string) $responseStream);
    }
}
