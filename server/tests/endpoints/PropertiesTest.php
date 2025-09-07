<?php
declare(strict_types=1);

namespace Loxya\Tests;

use Fig\Http\Message\StatusCodeInterface as StatusCode;
use Illuminate\Support\Collection;
use Loxya\Models\Enums\CustomFieldType;
use Loxya\Models\Enums\PropertyEntity;
use Loxya\Models\Property;
use Loxya\Support\Arr;

final class PropertiesTest extends ApiTestCase
{
    public static function data(?int $id = null, string $format = Property::SERIALIZE_DEFAULT)
    {
        $properties = new Collection([
            [
                'id' => 1,
                'name' => "Poids",
                'entities' => [PropertyEntity::MATERIAL->value],
                'type' => CustomFieldType::FLOAT->value,
                'unit' => "kg",
                'is_totalisable' => true,
                'categories' => [
                    CategoriesTest::data(2),
                    CategoriesTest::data(1),
                ],
            ],
            [
                'id' => 2,
                'name' => "Couleur",
                'entities' => [
                    PropertyEntity::MATERIAL->value,
                ],
                'type' => CustomFieldType::STRING->value,
                'max_length' => null,
                'categories' => [],
            ],
            [
                'id' => 3,
                'name' => "Puissance",
                'entities' => [PropertyEntity::MATERIAL->value],
                'type' => CustomFieldType::INTEGER->value,
                'unit' => "W",
                'is_totalisable' => true,
                'categories' => [
                    CategoriesTest::data(2),
                    CategoriesTest::data(1),
                ],
            ],
            [
                'id' => 4,
                'name' => "Conforme",
                'entities' => [PropertyEntity::MATERIAL->value],
                'type' => CustomFieldType::BOOLEAN->value,
                'categories' => [],
            ],
            [
                'id' => 5,
                'name' => "Date d'achat",
                'entities' => [
                    PropertyEntity::MATERIAL->value,
                ],
                'type' => CustomFieldType::DATE->value,
                'categories' => [],
            ],
            [
                'id' => 6,
                'name' => "Prix d'achat",
                'entities' => [
                    PropertyEntity::MATERIAL->value,
                ],
                'type' => CustomFieldType::FLOAT->value,
                'unit' => "€",
                'is_totalisable' => true,
                'categories' => [
                    CategoriesTest::data(4),
                    CategoriesTest::data(3),
                ],
            ],
            [
                'id' => 7,
                'name' => "Lieu d'usage",
                'entities' => [
                    PropertyEntity::MATERIAL->value,
                ],
                'type' => CustomFieldType::LIST->value,
                'options' => ["Intérieur", "Extérieur", "Polyvalent"],
                'categories' => [],
            ],
        ]);

        $properties = match ($format) {
            Property::SERIALIZE_SUMMARY => $properties->map(static fn ($property) => (
                Arr::except($property, ['entities', 'categories', 'is_totalisable'])
            )),
            Property::SERIALIZE_DEFAULT => $properties->map(static fn ($property) => (
                Arr::except($property, ['categories'])
            )),
            Property::SERIALIZE_DETAILS => $properties,
            default => throw new \InvalidArgumentException(sprintf("Unknown format \"%s\"", $format)),
        };

        return static::dataFactory($id, $properties->all());
    }

    public function testGetAll(): void
    {
        // - Récupère toutes les caractéristiques spéciales avec leurs catégories.
        $this->client->get('/api/properties');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponseData([
            self::data(4, Property::SERIALIZE_DETAILS),
            self::data(2, Property::SERIALIZE_DETAILS),
            self::data(5, Property::SERIALIZE_DETAILS),
            self::data(7, Property::SERIALIZE_DETAILS),
            self::data(1, Property::SERIALIZE_DETAILS),
            self::data(6, Property::SERIALIZE_DETAILS),
            self::data(3, Property::SERIALIZE_DETAILS),
        ]);

        // - Récupère les caractéristiques spéciales qui n'ont
        //   pas de catégorie + celles de la catégorie #3.
        $this->client->get('/api/properties?category=3');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponseData([
            self::data(4, Property::SERIALIZE_DETAILS),
            self::data(2, Property::SERIALIZE_DETAILS),
            self::data(5, Property::SERIALIZE_DETAILS),
            self::data(7, Property::SERIALIZE_DETAILS),
            self::data(6, Property::SERIALIZE_DETAILS),
        ]);

        // - Récupère les caractéristiques spéciales qui n'ont
        //   pas de catégorie + celles de la catégorie #2.
        $this->client->get('/api/properties?category=2');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponseData([
            self::data(4, Property::SERIALIZE_DETAILS),
            self::data(2, Property::SERIALIZE_DETAILS),
            self::data(5, Property::SERIALIZE_DETAILS),
            self::data(7, Property::SERIALIZE_DETAILS),
            self::data(1, Property::SERIALIZE_DETAILS),
            self::data(3, Property::SERIALIZE_DETAILS),
        ]);

        // - Récupère les caractéristiques spéciales qui n'ont pas de catégorie.
        $this->client->get('/api/properties?category=none');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponseData([
            self::data(4, Property::SERIALIZE_DETAILS),
            self::data(2, Property::SERIALIZE_DETAILS),
            self::data(5, Property::SERIALIZE_DETAILS),
            self::data(7, Property::SERIALIZE_DETAILS),
        ]);
    }

    public function testGetOne(): void
    {
        $this->client->get('/api/properties/1');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponseData(self::data(1, Property::SERIALIZE_DETAILS));
    }

    public function testCreate(): void
    {
        $this->client->post('/api/properties', [
            'name' => 'Speed',
            'entities' => [
                PropertyEntity::MATERIAL->value,
            ],
            'type' => CustomFieldType::FLOAT->value,
            'unit' => 'km/h',
            'categories' => [2, 3],
            'is_totalisable' => false,
        ]);
        $this->assertStatusCode(StatusCode::STATUS_CREATED);
        $this->assertResponseData([
            'id' => 8,
            'name' => 'Speed',
            'entities' => [
                PropertyEntity::MATERIAL->value,
            ],
            'type' => CustomFieldType::FLOAT->value,
            'unit' => 'km/h',
            'categories' => [
                CategoriesTest::data(2),
                CategoriesTest::data(3),
            ],
            'is_totalisable' => false,
        ]);
    }

    public function testUpdate(): void
    {
        $this->client->put('/api/properties/1', [
            'name' => 'Masse',
            'entities' => [
                PropertyEntity::MATERIAL->value,
            ],
            'type' => CustomFieldType::INTEGER->value,
            'unit' => 'g',
            'categories' => [3, 4],
            'is_totalisable' => false,
        ]);
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponseData(array_replace(
            self::data(1, Property::SERIALIZE_DETAILS),
            [
                'name' => 'Masse',
                'entities' => [
                    PropertyEntity::MATERIAL->value,
                ],
                'unit' => 'g',
                'is_totalisable' => false,
                'categories' => [
                    CategoriesTest::data(4),
                    CategoriesTest::data(3),
                ],
            ],
        ));
    }
}
