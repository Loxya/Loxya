<?php
declare(strict_types=1);

namespace Loxya\Tests;

use Fig\Http\Message\StatusCodeInterface as StatusCode;
use Loxya\Models\TaxComponent;

final class TaxesTest extends ApiTestCase
{
    public static function data(?int $id = null)
    {
        return static::dataFactory($id, [
            [
                'id' => 1,
                'is_group' => false,
                'is_used' => true,
                'value' => '20.000',
            ],
            [
                'id' => 2,
                'is_group' => false,
                'is_used' => true,
                'value' => '5.500',
            ],
            [
                'id' => 3,
                'is_group' => false,
                'is_used' => false,
                'value' => '10.000',
            ],
        ]);
    }

    public function testGetAll(): void
    {
        $this->client->get('/api/taxes');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponseData([
            self::data(1),
            self::data(3),
            self::data(2),
        ]);
    }

    public function testCreate(): void
    {
        // - Test 1: Erreurs de types.
        $this->client->post('/api/taxes', [
            'is_group' => 'ok',
            'value' => '__invalid__',
        ]);
        $this->assertApiValidationError([
            'is_group' => "This field should be a boolean.",
            'value' => "This field must contain a decimal number.",
        ]);

        // - Test 2: Groupe interdit (système T.V.A. simple).
        $this->client->post('/api/taxes', [
            'is_group' => true,
            'value' => null,
        ]);
        $this->assertApiValidationError([
            'is_group' => "This field is invalid.",
        ]);

        // - Test 3: Nom spécifié (doit être `null` pour les systèmes avec T.V.A. simple).
        $this->client->post('/api/taxes', [
            'name' => 'T.V.A.',
            'is_group' => false,
            'value' => '19.600',
        ]);
        $this->assertApiValidationError([
            'name' => "This field should not be specified.",
        ]);

        // - Test 4: Ce taux existe déjà.
        $this->client->post('/api/taxes', ['value' => '20.000']);
        $this->assertApiValidationError([
            'value' => "A tax with this rate already exists.",
        ]);

        // - Test 5: Taux non autorisé pour la France.
        $this->client->post('/api/taxes', [
            'is_group' => false,
            'value' => '10.255',
        ]);
        $this->assertApiValidationError([
            'value' => "This rate is not among the allowed rates.",
        ]);

        // - Test 6: Valide.
        $this->client->post('/api/taxes', [
            'is_group' => false,
            'value' => '2.1',
        ]);
        $this->assertStatusCode(StatusCode::STATUS_CREATED);
        $this->assertResponseData([
            'id' => 4,
            'is_group' => false,
            'is_used' => false,
            'value' => '2.100',
        ]);

        // - On utilise un pays avec un système de T.V.A. qui n'est pas "simple".
        static::setCustomConfig(['organization.country' => 'CA']);

        // - Test 7.
        $this->client->post('/api/taxes', [
            'name' => 'invalideeeeeeeeeeeeeeeeeeeeeeee',
            'is_group' => true,
            'value' => '100', // => Devrait être `null` vu que c'est un groupe.
        ]);
        $this->assertApiValidationError([
            'name' => "Min. 1 characters, max. 30 characters.",
            'value' => "This field should not be specified.",
        ]);

        // - Test 8: Valide (groupe sans composants).
        $this->client->post('/api/taxes', [
            'name' => "Taxe Québec (TPS + TVQ)",
            'is_group' => true,
            'value' => null,
        ]);
        $this->assertStatusCode(StatusCode::STATUS_CREATED);
        $this->assertResponseData([
            'id' => 5,
            'name' => "Taxe Québec (TPS + TVQ)",
            'is_group' => true,
            'is_used' => false,
            'components' => [],
        ]);

        // - Test 8b: Doublon de nom.
        $this->client->post('/api/taxes', [
            'name' => "Taxe Québec (TPS + TVQ)",
            'is_group' => true,
            'value' => null,
        ]);
        $this->assertApiValidationError([
            'name' => "A tax name with this name already exists.",
        ]);

        // - Test 9.
        $this->client->post('/api/taxes', [
            'name' => "Taxe électroménager",
            'is_group' => true,
            'components' => [
                [
                    'name' => 'T.V.A.',
                    'value' => '20',
                ],
                [
                    'name' => 'T.V.A.',
                    'value' => '105',
                ],
            ],
        ]);
        $this->assertApiValidationError([
            'components' => [
                1 => [
                    'value' => "This field is invalid.",
                ],
            ],
        ]);

        // - Test 10: Valide.
        $this->client->post('/api/taxes', [
            'name' => "Taxe électroménager 2023",
            'is_group' => false,
            'value' => '100',

            // - Devrais être ignoré.
            'components' => [
                [
                    'name' => 'T.V.A.',
                    'value' => '20',
                ],
            ],
        ]);
        $this->assertStatusCode(StatusCode::STATUS_CREATED);
        $this->assertResponseData([
            'id' => 7,
            'name' => 'Taxe électroménager 2023',
            'is_group' => false,
            'is_used' => false,
            'value' => '100.000',
        ]);
        $this->assertSame(0, TaxComponent::where('tax_id', 6)->count());

        // - Test 11: Valide.
        $this->client->post('/api/taxes', [
            'name' => "Taxe électroménager 2024",
            'is_group' => true,
            'components' => [
                [
                    'name' => 'T.V.A.',
                    'value' => '5.5',
                ],
                [
                    'name' => 'Taxe recyclage',
                    'value' => '5',
                ],
            ],
        ]);
        $this->assertStatusCode(StatusCode::STATUS_CREATED);
        $this->assertResponseData([
            'id' => 8,
            'name' => "Taxe électroménager 2024",
            'is_used' => false,
            'is_group' => true,
            'components' => [
                [
                    'name' => 'T.V.A.',
                    'value' => '5.500',
                ],
                [
                    'name' => 'Taxe recyclage',
                    'value' => '5.000',
                ],
            ],
        ]);
    }

    public function testUpdate(): void
    {
        // - Test 1: Valeur invalide (type incorrect).
        $this->client->put('/api/taxes/3', [
            'value' => '__invalid__',
        ]);
        $this->assertApiValidationError([
            'value' => "This field must contain a decimal number.",
        ]);

        // - Test 2: Taux non autorisé pour la France.
        $this->client->put('/api/taxes/3', [
            'value' => '10.255',
        ]);
        $this->assertApiValidationError([
            'value' => "This rate is not among the allowed rates.",
        ]);

        // - Test 3: Valide.
        $this->client->put('/api/taxes/3', [
            'is_group' => false,
            'value' => '2.1',
        ]);
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponseData([
            'id' => 3,
            'is_group' => false,
            'is_used' => false,
            'value' => '2.100',
        ]);
    }

    public function testDelete(): void
    {
        // - On ne peut pas supprimer la taxe par défaut.
        $this->client->delete('/api/taxes/1');
        $this->assertStatusCode(StatusCode::STATUS_CONFLICT);

        // - On ne peut pas supprimer une taxe utilisée.
        $this->client->delete('/api/taxes/2');
        $this->assertStatusCode(StatusCode::STATUS_CONFLICT);

        // - Test valide.
        $this->client->delete('/api/taxes/3');
        $this->assertStatusCode(StatusCode::STATUS_NO_CONTENT);
    }
}
