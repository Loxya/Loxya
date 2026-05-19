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
                'is_public_entity' => false,
                'registration_id' => '12345678900001',
                'vat_number' => 'FR32123456789',
                'invoice_identifier' => '0225:123456789_LOCATION',
                'service_code' => null,
                'street' => "10 avenue de la gare",
                'additional_street' => "Bâtiment D",
                'postal_code' => '74000',
                'administrative_area' => null,
                'locality' => 'Annecy',
                'country' => 'FR',
                'address' => implode("\n", [
                    "10 avenue de la gare",
                    "Bâtiment D",
                    "74000 Annecy",
                ]),
                'phone' => '+33123456789',
                'note' => "Anciennement Machin, Inc.",
            ],
            [
                'id' => 2,
                'legal_name' => 'Obscure',
                'is_public_entity' => false,
                'registration_id' => 'CHE-123.456.789',
                'vat_number' => 'CHE-123.456.789 TVA',
                'invoice_identifier' => null,
                'service_code' => null,
                'street' => "Rue de Cornavin, 1",
                'additional_street' => null,
                'postal_code' => "1000",
                'administrative_area' => null,
                'locality' => "Lausanne",
                'country' => 'CH',
                'address' => implode("\n", [
                    "Rue de Cornavin, 1",
                    "1000 Lausanne",
                ]),
                'phone' => '+41211234567',
                'note' => null,
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
        $this->assertResponseData(self::data(1));
    }

    public function testGetCompanySearchByLegalName(): void
    {
        $this->client->get('/api/companies?search=testin');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponsePaginatedData(1, [
            self::data(1),
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
            'country' => "This field is mandatory.",
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
            'is_legal_entity' => true,
            'registration_id' => '574 122 444',
            'street' => 'Somewhere street, 123',
            'additional_street' => 'Second floor',
            'postal_code' => '75000',
            'locality' => 'Paris',
            'phone' => '+00336 25 25 21 25',
            'country' => 'FR',
        ];
        $this->client->post('/api/companies', $data);
        $this->assertStatusCode(StatusCode::STATUS_CREATED);
        $this->assertResponseData([
            'id' => 3,
            'legal_name' => 'test company',
            'is_public_entity' => false,
            'registration_id' => '574122444',
            'vat_number' => null,
            'service_code' => null,
            'invoice_identifier' => null,
            'street' => 'Somewhere street, 123',
            'additional_street' => 'Second floor',
            'postal_code' => '75000',
            'administrative_area' => null,
            'locality' => 'Paris',
            'country' => 'FR',
            'address' => "Somewhere street, 123\nSecond floor\n75000 Paris",
            'phone' => '+33625252125',
            'note' => null,
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
