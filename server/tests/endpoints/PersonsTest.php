<?php
declare(strict_types=1);

namespace Loxya\Tests;

use Fig\Http\Message\StatusCodeInterface as StatusCode;

final class PersonsTest extends ApiTestCase
{
    public static function data(?int $id = null)
    {
        return static::dataFactory($id, [
            [
                'id' => 1,
                'user_id' => 1,
                'first_name' => 'Jean',
                'last_name' => 'Fountain',
                'full_name' => 'Jean Fountain',
                'email' => 'tester@loxya.com',
                'phone' => null,
                'street' => "1, somewhere av.",
                'additional_street' => null,
                'postal_code' => '12340',
                'administrative_area' => null,
                'locality' => "Megacity",
                'country' => 'FR',
                'address' => implode("\n", [
                    "1, somewhere av.",
                    "12340 Megacity",
                ]),
            ],
            [
                'id' => 2,
                'user_id' => 2,
                'first_name' => 'Roger',
                'last_name' => 'Rabbit',
                'full_name' => 'Roger Rabbit',
                'email' => 'tester2@loxya.com',
                'phone' => null,
                'street' => null,
                'additional_street' => null,
                'postal_code' => null,
                'administrative_area' => null,
                'locality' => null,
                'country' => 'FR',
                'address' => null,
            ],
            [
                'id' => 3,
                'user_id' => null,
                'first_name' => 'Élise',
                'last_name' => 'Faure',
                'full_name' => 'Élise Faure',
                'email' => 'elise@loxya.fr',
                'phone' => '+3211223344',
                'street' => '156 bis, avenue des tests poussés',
                'additional_street' => "Étage 3, Porte 2",
                'postal_code' => '88080',
                'administrative_area' => null,
                'locality' => 'Wazzaville',
                'country' => 'FR',
                'address' => implode("\n", [
                    "156 bis, avenue des tests poussés",
                    "Étage 3, Porte 2",
                    "88080 Wazzaville",
                ]),
            ],
            [
                'id' => 4,
                'user_id' => null,
                'first_name' => 'Jean',
                'last_name' => 'Garcia',
                'full_name' => 'Jean Garcia',
                'email' => 'jg@loxya.fr',
                'phone' => '+33645698520',
                'street' => null,
                'additional_street' => null,
                'postal_code' => null,
                'administrative_area' => null,
                'locality' => null,
                'country' => 'CH',
                'address' => null,
            ],
            [
                'id' => 5,
                'user_id' => null,
                'first_name' => 'John',
                'last_name' => 'Doe',
                'full_name' => 'John Doe',
                'email' => 'john@doe.test',
                'phone' => '+17705555765',
                'street' => "47 W 13th St",
                'additional_street' => null,
                'postal_code' => '10011',
                'administrative_area' => 'NY',
                'locality' => "New York",
                'address' => implode("\n", [
                    "47 W 13th St",
                    "New York, NY 10011",
                ]),
                'country' => 'US',
            ],
            [
                'id' => 6,
                'user_id' => 4,
                'first_name' => 'Henry',
                'last_name' => 'Berluc',
                'full_name' => 'Henry Berluc',
                'email' => 'visitor@loxya.com',
                'phone' => '+33794589321',
                'street' => '30 avenue du chateau',
                'additional_street' => null,
                'postal_code' => '75000',
                'administrative_area' => null,
                'locality' => 'Paris',
                'country' => 'FR',
                'address' => implode("\n", [
                    "30 avenue du chateau",
                    "75000 Paris",
                ]),
            ],
            [
                'id' => 7,
                'user_id' => 5,
                'first_name' => 'Caroline',
                'last_name' => 'Farol',
                'full_name' => 'Caroline Farol',
                'email' => 'external@loxya.com',
                'phone' => '+33786325500',
                'street' => null,
                'additional_street' => null,
                'postal_code' => null,
                'administrative_area' => null,
                'locality' => null,
                'country' => 'BE',
                'address' => null,
            ],
            [
                'id' => 8,
                'user_id' => 3,
                'first_name' => 'Alexandre',
                'last_name' => 'Dupont',
                'full_name' => 'Alexandre Dupont',
                'email' => 'alex.dupont@loxya.com',
                'phone' => '+33678901234',
                'street' => "15 Rue de l'Église",
                'additional_street' => null,
                'postal_code' => '75001',
                'administrative_area' => null,
                'locality' => 'Paris',
                'country' => 'FR',
                'address' => implode("\n", [
                    "15 Rue de l'Église",
                    "75001 Paris",
                ]),
            ],
        ]);
    }

    public function testGetAll(): void
    {
        $this->client->get('/api/persons');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponsePaginatedData(8, [
            self::data(6),
            self::data(5),
            self::data(8),
            self::data(7),
            self::data(3),
            self::data(1),
            self::data(4),
            self::data(2),
        ]);
    }

    public function testGetAllWithSearch(): void
    {
        $this->client->get('/api/persons?search=jea');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponsePaginatedData(2, [
            self::data(1), // - Jean Fountain
            self::data(4), // - Jean Garcia
        ]);

        $this->client->get('/api/persons?search=jean fou');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponsePaginatedData(1, [
            self::data(1), // - Jean Fountain
        ]);

        $this->client->get('/api/persons?search=garcia jean');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponsePaginatedData(1, [
            self::data(4), // - Jean Garcia
        ]);
    }

    public function testGetAllWithLimit(): void
    {
        $this->client->get('/api/persons?limit=2');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponseHasKeyEquals('pagination.perPage', 2);
        $this->assertResponseHasKeyEquals('pagination.total.pages', 4);
        $this->assertResponsePaginatedData(8, [
            self::data(6),
            self::data(5),
        ]);
    }
}
