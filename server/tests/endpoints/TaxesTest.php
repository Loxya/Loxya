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
                'name' => "T.V.A.",
                'is_group' => false,
                'is_rate' => true,
                'is_used' => true,
                'value' => '20.000',
            ],
            [
                'id' => 2,
                'name' => "T.V.A.",
                'is_group' => false,
                'is_rate' => true,
                'is_used' => true,
                'value' => '5.500',
            ],
            [
                'id' => 3,
                'name' => "Taxe écologique",
                'is_group' => false,
                'is_rate' => false,
                'is_used' => false,
                'value' => '1.00',
            ],
            [
                'id' => 4,
                'name' => "Taxe meuble",
                'is_group' => true,
                'is_used' => true,
                'components' => [
                    [
                        'name' => "T.V.A.",
                        'is_rate' => true,
                        'value' => "20.000",
                    ],
                    [
                        'name' => "Éco-participation",
                        'is_rate' => false,
                        'value' => "2.00",
                    ],
                ],
            ],
            [
                'id' => 5,
                'name' => "Taxe Québec (TPS + TVQ)",
                'is_group' => true,
                'is_used' => false,
                'components' => [
                    [
                        'name' => "TPS",
                        'is_rate' => true,
                        'value' => "5.000",
                    ],
                    [
                        'name' => "TVQ",
                        'is_rate' => true,
                        'value' => "9.975",
                    ],
                ],
            ],
        ]);
    }

    public function testGetAll(): void
    {
        $this->client->get('/api/taxes');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponseData(self::data());
    }

    public function testCreate(): void
    {
        // - Test 1.
        $this->client->post('/api/taxes', [
            'name' => '',
            'is_group' => 'ok',
            'is_rate' => 'nok',
            'value' => '__invalid__',
        ]);
        $this->assertApiValidationError([
            'name' => "This field is mandatory.",
            'is_group' => "This field should be a boolean.",
            'is_rate' => "This field should be a boolean.",
            'value' => "This field must contain a decimal number.",
        ]);

        // - Test 2.
        $this->client->post('/api/taxes', [
            'name' => 'invalideeeeeeeeeeeeeeeeeeeeeeee',
            'is_group' => true,
            'is_rate' => true, // => Devrait être `null` vu que c'est un groupe.
            'value' => '100', // => Devrait être `null` vu que c'est un groupe.
        ]);
        $this->assertApiValidationError([
            'name' => "Min. 1 characters, max. 30 characters.",
            'is_rate' => "This field should not be specified.",
            'value' => "This field should not be specified.",
        ]);

        // - Test 3.
        $this->client->post('/api/taxes', [
            'name' => "Taxe Québec (TPS + TVQ)",
            'is_group' => true,
            'is_rate' => null,
            'value' => null,
        ]);
        $this->assertApiValidationError([
            'name' => "A tax name with this name already exists.",
        ]);

        // - Test 4.
        $this->client->post('/api/taxes', [
            'name' => "Taxe électroménager",
            'is_group' => true,
            'components' => [
                [
                    'name' => 'T.V.A.',
                    'is_rate' => true,
                    'value' => '20',
                ],
                [
                    'name' => 'T.V.A.',
                    'is_rate' => true,
                    'value' => '105',
                ],
                [
                    'name' => '',
                    'is_rate' => false,
                    'value' => '__invalid__',
                ],
            ],
        ]);
        $this->assertApiValidationError([
            'components' => [
                1 => [
                    'value' => "This field is invalid.",
                ],
                2 => [
                    'name' => "This field is mandatory.",
                    'value' => "This field must contain a decimal number.",
                ],
            ],
        ]);

        // - Test 5: Valide.
        $this->client->post('/api/taxes', [
            'name' => "Taxe électroménager 2023",
            'is_group' => false,
            'is_rate' => true,
            'value' => '100',

            // - Devrais être ignoré.
            'components' => [
                [
                    'name' => 'T.V.A.',
                    'is_rate' => true,
                    'value' => '20',
                ],
            ],
        ]);
        $this->assertStatusCode(StatusCode::STATUS_CREATED);
        $this->assertResponseData([
            'id' => 7,
            'name' => 'Taxe électroménager 2023',
            'is_group' => false,
            'is_rate' => true,
            'is_used' => false,
            'value' => '100.000',
        ]);
        $this->assertSame(0, TaxComponent::where('tax_id', 7)->count());

        // - Test 7: Valide.
        $this->client->post('/api/taxes', [
            'name' => "Taxe électroménager 2024",
            'is_group' => true,
            'components' => [
                [
                    'name' => 'T.V.A.',
                    'is_rate' => true,
                    'value' => '5.5',
                ],
                [
                    'name' => 'Éco Participation',
                    'is_rate' => false,
                    'value' => '1',
                ],
                [
                    'name' => 'Taxe recyclage',
                    'is_rate' => true,
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
                    'is_rate' => true,
                    'value' => '5.500',
                ],
                [
                    'name' => 'Éco Participation',
                    'is_rate' => false,
                    'value' => '1.00',
                ],
                [
                    'name' => 'Taxe recyclage',
                    'is_rate' => true,
                    'value' => '5.000',
                ],
            ],
        ]);
    }

    public function testUpdate(): void
    {
        // - Test 1.
        $this->client->put('/api/taxes/1', [
            'name' => '',
            'value' => '__invalid__',
        ]);
        $this->assertApiValidationError([
            'name' => "This field is mandatory.",
            'value' => "This field must contain a decimal number.",
        ]);

        // - Test 2.
        $this->client->put('/api/taxes/1', [
            'name' => 'T.V.A.',
            'is_group' => false,
            'is_rate' => true,
            'value' => '5.500',
        ]);
        $this->assertApiValidationError([
            'name' => "A tax name with this name already exists.",
        ]);

        // - Test 3 : Valide.
        $this->client->put('/api/taxes/4', [
            'name' => "Taxe meuble",
            'is_group' => false,
            'is_rate' => false,
            'value' => '1.00',
        ]);
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponseData([
            'id' => 4,
            'name' => "Taxe meuble",
            'is_group' => false,
            'is_used' => true,
            'is_rate' => false,
            'value' => '1.00',
        ]);
        $this->assertSame(0, TaxComponent::where('tax_id', 4)->count());

        // - Test 4 : Valide.
        $this->client->put('/api/taxes/5', [
            'name' => "Taxe Québec (TPS + TVQ)",
            'is_group' => true,
            'components' => [
                [
                    'name' => "TPS + TVQ",
                    'is_rate' => true,
                    'value' => '14.975',
                ],
            ],
        ]);
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponseData([
            'id' => 5,
            'name' => "Taxe Québec (TPS + TVQ)",
            'is_group' => true,
            'is_used' => false,
            'components' => [
                [
                    'name' => "TPS + TVQ",
                    'is_rate' => true,
                    'value' => '14.975',
                ],
            ],
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
