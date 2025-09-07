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
                'postal_code' => '1234',
                'locality' => "Megacity",
                'country_id' => 1,
                'country' => CountriesTest::data(1),
                'full_address' => "1, somewhere av.\n1234 Megacity",
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
                'postal_code' => null,
                'locality' => null,
                'country_id' => null,
                'country' => null,
                'full_address' => null,
            ],
            [
                'id' => 3,
                'user_id' => null,
                'first_name' => 'Client',
                'last_name' => 'Benef',
                'full_name' => 'Client Benef',
                'email' => 'client@beneficiaires.com',
                'phone' => '+33123456789',
                'street' => '156 bis, avenue des tests poussés',
                'postal_code' => '88080',
                'locality' => 'Wazzaville',
                'country_id' => null,
                'country' => null,
                'full_address' => "156 bis, avenue des tests poussés\n88080 Wazzaville",
            ],
            [
                'id' => 4,
                'user_id' => null,
                'first_name' => 'Jean',
                'last_name' => 'Technicien',
                'full_name' => 'Jean Technicien',
                'email' => 'client@technicien.com',
                'phone' => '+33645698520',
                'street' => null,
                'postal_code' => null,
                'locality' => null,
                'country_id' => 2,
                'country' => CountriesTest::data(2),
                'full_address' => null,
            ],
            [
                'id' => 5,
                'user_id' => null,
                'first_name' => 'Alphonse',
                'last_name' => 'Latour',
                'full_name' => 'Alphonse Latour',
                'email' => 'alphonse@latour.test',
                'phone' => null,
                'street' => null,
                'postal_code' => null,
                'locality' => null,
                'country_id' => null,
                'country' => null,
                'full_address' => null,
            ],
            [
                'id' => 6,
                'user_id' => 4,
                'first_name' => 'Henry',
                'last_name' => 'Berluc',
                'full_name' => 'Henry Berluc',
                'email' => 'visitor@loxya.com',
                'phone' => '+33724000000',
                'street' => '30 avenue du chateau',
                'postal_code' => '75000',
                'locality' => 'Paris',
                'country_id' => 1,
                'country' => CountriesTest::data(1),
                'full_address' => "30 avenue du chateau\n75000 Paris",
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
                'postal_code' => null,
                'locality' => null,
                'country_id' => null,
                'country' => null,
                'full_address' => null,
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
                'postal_code' => '75001',
                'locality' => 'Paris',
                'country_id' => 1,
                'country' => CountriesTest::data(1),
                'full_address' => "15 Rue de l'Église\n75001 Paris",
            ],
        ]);
    }

    public function testGetAll(): void
    {
        $this->client->get('/api/persons');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponsePaginatedData(8, [
            self::data(3),
            self::data(6),
            self::data(8),
            self::data(7),
            self::data(1),
            self::data(5),
            self::data(2),
            self::data(4),
        ]);
    }

    public function testGetAllWithSearch(): void
    {
        $this->client->get('/api/persons?search=jea');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponsePaginatedData(2, [
            self::data(1), // - Jean Fountain
            self::data(4), // - Jean Technicien
        ]);

        $this->client->get('/api/persons?search=jean fou');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponsePaginatedData(1, [
            self::data(1), // - Jean Fountain
        ]);

        $this->client->get('/api/persons?search=technicien jean');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponsePaginatedData(1, [
            self::data(4), // - Jean Technicien
        ]);
    }

    public function testGetAllWithLimit(): void
    {
        $this->client->get('/api/persons?limit=2');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponseHasKeyEquals('pagination.perPage', 2);
        $this->assertResponseHasKeyEquals('pagination.total.pages', 4);
        $this->assertResponsePaginatedData(8, [
            self::data(3),
            self::data(6),
        ]);
    }
}
