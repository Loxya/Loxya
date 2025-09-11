<?php
declare(strict_types=1);

namespace Loxya\Tests;

use Fig\Http\Message\StatusCodeInterface as StatusCode;
use Loxya\Models\Company;

final class CompaniesTest extends ApiTestCase
{
    public static function data(?int $id = null)
    {
        return static::dataFactory($id, [
            [
                'id' => 1,
                'legal_name' => 'Testing, Inc',
                'registration_id' => null,
                'street' => '1, company st.',
                'postal_code' => '1234',
                'locality' => 'Megacity',
                'country_id' => 1,
                'full_address' => "1, company st.\n1234 Megacity",
                'phone' => '+4123456789',
                'note' => 'Just for tests',
                'country' => CountriesTest::data(1),
            ],
            [
                'id' => 2,
                'legal_name' => 'Obscure',
                'registration_id' => '123456789',
                'street' => null,
                'postal_code' => null,
                'locality' => null,
                'country_id' => null,
                'full_address' => null,
                'phone' => null,
                'note' => null,
                'country' => null,
            ],
        ]);
    }

    public function testGetCompanies(): void
    {
        $this->client->get('/api/companies');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponsePaginatedData(2, [
            self::data(2),
            self::data(1),
        ]);

        $this->client->get('/api/companies?deleted=1');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponsePaginatedData(0);
    }

    public function testGetCompanyNotFound(): void
    {
        $this->client->get('/api/companies/999');
        $this->assertStatusCode(StatusCode::STATUS_NOT_FOUND);
    }

    public function testGetCompany(): void
    {
        $this->client->get('/api/companies/1');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponseData([
            'id' => 1,
            'legal_name' => 'Testing, Inc',
            'registration_id' => null,
            'street' => '1, company st.',
            'postal_code' => '1234',
            'locality' => 'Megacity',
            'country_id' => 1,
            'full_address' => "1, company st.\n1234 Megacity",
            'phone' => '+4123456789',
            'note' => 'Just for tests',
            'country' => CountriesTest::data(1),
        ]);
    }

    public function testGetCompanySearchByLegalName(): void
    {
        $this->client->get('/api/companies?search=testin');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponseData([
            'pagination' => [
                'currentPage' => 1,
                'perPage' => 100,
                'total' => ['items' => 1, 'pages' => 1],
            ],
            'data' => [
                [
                    'id' => 1,
                    'legal_name' => 'Testing, Inc',
                    'registration_id' => null,
                    'street' => '1, company st.',
                    'postal_code' => '1234',
                    'locality' => 'Megacity',
                    'country_id' => 1,
                    'full_address' => "1, company st.\n1234 Megacity",
                    'phone' => '+4123456789',
                    'note' => 'Just for tests',
                    'country' => CountriesTest::data(1),
                ],
            ],
        ]);
    }

    public function testCreateCompanyWithoutData(): void
    {
        $this->client->post('/api/companies');
        $this->assertStatusCode(StatusCode::STATUS_BAD_REQUEST);
        $this->assertApiErrorMessage("No data was provided.");
    }

    public function testCreateCompanyBadData(): void
    {
        $this->client->post('/api/companies', ['foo' => 'bar']);
        $this->assertApiValidationError([
            'legal_name' => "This field is mandatory.",
        ]);
    }

    public function testCreateCompanyDuplicate(): void
    {
        $this->client->post('/api/companies', [
            'registration_id' => '123456789',
        ]);
        $this->assertApiValidationError();
    }

    public function testCreateCompany(): void
    {
        $data = [
            'legal_name' => 'test company',
            'registration_id' => '574 122 444',
            'street' => 'Somewhere street, 123',
            'postal_code' => '75000',
            'locality' => 'Paris',
            'country_id' => 1,
            'phone' => '+00336 25 25 21 25',
        ];
        $this->client->post('/api/companies', $data);
        $this->assertStatusCode(StatusCode::STATUS_CREATED);
        $this->assertResponseData([
            'id' => 3,
            'legal_name' => 'test company',
            'registration_id' => '574122444',
            'street' => 'Somewhere street, 123',
            'postal_code' => '75000',
            'locality' => 'Paris',
            'country_id' => 1,
            'full_address' => "Somewhere street, 123\n75000 Paris",
            'phone' => '+0033625252125',
            'note' => null,
            'country' => CountriesTest::data(1),
        ]);
    }

    public function testDeleteAndDestroyCompany(): void
    {
        // - First call: soft delete.
        $this->client->delete('/api/companies/2');
        $this->assertStatusCode(StatusCode::STATUS_NO_CONTENT);
        $softDeleted = Company::withTrashed()->find(2);
        $this->assertNotNull($softDeleted);
        $this->assertNotEmpty($softDeleted->deleted_at);

        // - Second call: actually DESTROY record from DB
        $this->client->delete('/api/companies/2');
        $this->assertStatusCode(StatusCode::STATUS_NO_CONTENT);
        $this->assertNull(Company::withTrashed()->find(2));
    }

    public function testRestoreCompanyNotFound(): void
    {
        $this->client->put('/api/companies/restore/999');
        $this->assertStatusCode(StatusCode::STATUS_NOT_FOUND);
    }

    public function testRestoreCompany(): void
    {
        // - First, delete company #2
        $this->client->delete('/api/companies/2');
        $this->assertStatusCode(StatusCode::STATUS_NO_CONTENT);

        // - Then, restore company #2
        $this->client->put('/api/companies/restore/2');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertNotNull(Company::find(2));
    }
}
