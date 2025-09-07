<?php
declare(strict_types=1);

namespace Loxya\Tests;

use Illuminate\Support\Carbon;
use Loxya\Models\Enums\CustomFieldType;
use Loxya\Models\Enums\PropertyEntity;
use Loxya\Models\Property;

final class PropertyTest extends TestCase
{
    public function testValidation(): void
    {
        $testValidation = function (array $testData, array $expectedErrors): void {
            $this->assertSameCanonicalize($expectedErrors, (new Property($testData))->validationErrors());
        };

        // - Test `max_length`: Doit être à `null` si type autre que `string`.
        // - Test `unit`: Doit être à `null` si type autre que `float` ou `integer`.
        // - Test `is_totalisable`: Doit être à `null` si type autre que `float` ou `integer`.
        // - Test `entities`: Ne peut pas contenir de valeur inconnues.
        $testData = [
            'id' => 6,
            'name' => 'Testing',
            'entities' => [
                PropertyEntity::MATERIAL->value,
                '--UNKNOWN--',
            ],
            'type' => CustomFieldType::DATE->value,
            'unit' => 'kg',
            'max_length' => 100,
            'is_totalisable' => false,
        ];
        $testValidation($testData, [
            'entities' => 'Ce champ est invalide.',
            'is_totalisable' => "Ce champ ne devrait pas être spécifié.",
            'config' => [
                'unit' => "Ce champ ne devrait pas être spécifié.",
                'max_length' => "Ce champ ne devrait pas être spécifié.",
            ],
        ]);

        // - Si `max_length`, `unit` et `is_totalisable` sont à `null` pour les
        //   caractéristiques autres (cf. commentaire au dessus) => Pas d'erreur.
        $testData = [
            'id' => 6,
            'name' => 'Testing',
            'entities' => [
                PropertyEntity::MATERIAL->value,
            ],
            'type' => CustomFieldType::DATE->value,
            'unit' => 'kg',
            'max_length' => 100,
            'is_totalisable' => false,
        ];
        $testValidation($testData, [
            'config' => [
                'unit' => "Ce champ ne devrait pas être spécifié.",
                'max_length' => "Ce champ ne devrait pas être spécifié.",
            ],
            'is_totalisable' => "Ce champ ne devrait pas être spécifié.",
        ]);

        // - Si `max_length`, `unit` et `is_totalisable` sont à `null` pour les
        //   attributs autres (cf. commentaire au dessus) => Pas d'erreur.
        $testData = array_replace($testData, array_fill_keys(['unit', 'max_length', 'is_totalisable'], null));
        (new Property($testData))->validate();

        // - Test `max_length`: Vérification "normale" si caractéristique de type `string`.
        $testData = [
            'id' => 6,
            'name' => 'Testing',
            'entities' => [PropertyEntity::MATERIAL->value],
            'type' => CustomFieldType::STRING->value,
            'max_length' => 'NOT_A_NUMBER',
        ];
        $testValidation($testData, [
            'config' => [
                'max_length' => "Ce champ doit contenir un nombre entier.",
            ],
        ]);

        // - Test `max_length`: Si valide pour les caractéristiques de type `string` => Pas d'erreur.
        $testData = array_replace($testData, ['max_length' => 100]);
        (new Property($testData))->validate();

        // - Test `unit`: Vérification "normale" si caractéristique de type `float` ou `integer`.
        $baseTestData = [
            'id' => 6,
            'name' => 'Testing',
            'entities' => [PropertyEntity::MATERIAL->value],
            'unit' => 'TROP_LOOOOOOOOOOOOOONG',
            'is_totalisable' => true,
        ];
        $numericTypes = [
            CustomFieldType::INTEGER->value,
            CustomFieldType::FLOAT->value,
        ];
        foreach ($numericTypes as $type) {
            $testData = array_replace($baseTestData, compact('type'));
            $testValidation($testData, [
                'config' => [
                    'unit' => "1 caractères min., 8 caractères max.",
                ],
            ]);
        }

        // - Test `unit`: si valide pour les caractéristiques de type `float` ou `integer` => Pas d'erreur.
        foreach ($numericTypes as $type) {
            $testData = array_replace($baseTestData, compact('type'), ['unit' => 'kg']);
            (new Property($testData))->validate();
        }

        // - Test `is_totalisable`: Vérification "normale" si caractéristique de type `float` ou `integer`.
        $baseTestData = [
            'id' => 6,
            'name' => 'Testing',
            'entities' => [PropertyEntity::MATERIAL->value],
            'unit' => 'cm',
            'is_totalisable' => 'not-a-boolean',
        ];
        foreach ($numericTypes as $type) {
            $testData = array_replace($baseTestData, compact('type'));
            $testValidation($testData, [
                'is_totalisable' => "Ce champ doit être un booléen.",
            ]);
        }

        // - Test `is_totalisable`: si valide pour les caractéristiques de type `float` ou `integer` => Pas d'erreur.
        foreach ($numericTypes as $type) {
            $testData = array_replace($baseTestData, compact('type'), ['is_totalisable' => true]);
            (new Property($testData))->validate();
        }

        // - Tests `entities`: doit être un sous-ensemble des valeurs possibles.
        $baseTestData = [
            'id' => 6,
            'name' => 'Testing',
            'type' => CustomFieldType::STRING->value,
        ];
        $invalidSets = [
            '',
            [],
            null,
            ['not-recognized'],
            ['material', 'not-recognized'],
            ['material', 'material-unit', 'not-recognized'],
        ];
        foreach ($invalidSets as $invalidSet) {
            $testData = array_replace($baseTestData, ['entities' => $invalidSet]);
            $testValidation($testData, [
                'entities' => "Ce champ est invalide.",
            ]);
        }

        // - Test avec des valeurs et sous-ensembles valides.
        $validValues = [
            [PropertyEntity::MATERIAL->value],
        ];
        foreach ($validValues as $validValue) {
            $testData = array_replace($baseTestData, ['entities' => $validValue]);
            (new Property($testData))->validationErrors();
        }
    }

    public function testNew(): void
    {
        static::setNow(Carbon::create(2024, 11, 20, 13, 30, 0));

        // - Crée une caractéristique spéciale
        $result = Property::new([
            'name' => 'Testing',
            'entities' => [PropertyEntity::MATERIAL->value],
            'type' => CustomFieldType::DATE->value,
        ]);
        $expected = [
            'id' => 8,
            'name' => 'Testing',
            'entities' => [PropertyEntity::MATERIAL->value],
            'type' => CustomFieldType::DATE->value,
            'config' => [],
            'is_totalisable' => null,
            'created_at' => '2024-11-20 13:30:00',
            'updated_at' => '2024-11-20 13:30:00',
        ];
        $this->assertEquals($expected, $result->toArray());
    }

    public function testEdit(): void
    {
        // - Modifie une caractéristique spéciale.
        $result = Property::findOrFail(1)->edit([
            'name' => 'Masse',
            'entities' => [
                PropertyEntity::MATERIAL->value,
            ],
            'type' => CustomFieldType::INTEGER->value,
            'unit' => 'g',
            'categories' => [3, 4],
            'is_totalisable' => false,
        ]);

        // - Le type ne doit pas avoir changé
        $this->assertNotEquals(CustomFieldType::INTEGER->value, $result->type);

        // - Mais tout le reste doit avoir été mis à jour
        $this->assertSame(
            [
                PropertyEntity::MATERIAL->value,
            ],
            $result->entities,
        );
        $this->assertEquals('Masse', $result->name);
        $this->assertSameCanonicalize(['unit' => 'g'], $result->config);
        $this->assertFalse($result->is_totalisable);
        $this->assertEquals([4, 3], (
            $result->categories
                ->map(static fn ($category) => $category->id)
                ->toArray()
        ));
    }
}
