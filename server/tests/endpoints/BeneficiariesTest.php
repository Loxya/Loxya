<?php
declare(strict_types=1);

namespace Loxya\Tests;

use Fig\Http\Message\StatusCodeInterface as StatusCode;
use Illuminate\Support\Collection;
use Loxya\Models\Beneficiary;
use Loxya\Models\Event;
use Loxya\Support\Arr;

final class BeneficiariesTest extends ApiTestCase
{
    public static function data(?int $id = null, string $format = Beneficiary::SERIALIZE_DEFAULT)
    {
        $beneficiaries = new Collection([
            [
                'id' => 1,
                'user_id' => 1,
                'user' => UsersTest::data(1),
                'first_name' => 'Jean',
                'last_name' => 'Fountain',
                'full_name' => 'Jean Fountain',
                'reference' => '0001',
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
                'company_id' => 1,
                'language' => 'en',
                'note' => null,
                'company' => CompaniesTest::data(1),
                'is_invoiceable' => true,
                'is_deleted' => false,
                'stats' => [
                    'borrowings' => 2,
                ],
            ],
            [
                'id' => 2,
                'user_id' => 2,
                'user' => UsersTest::data(2),
                'first_name' => 'Roger',
                'last_name' => 'Rabbit',
                'full_name' => 'Roger Rabbit',
                'reference' => '0002',
                'email' => 'tester2@loxya.com',
                'phone' => null,
                'street' => null,
                'additional_street' => null,
                'postal_code' => null,
                'administrative_area' => null,
                'locality' => null,
                'country' => 'FR',
                'address' => null,
                'company_id' => null,
                'language' => 'fr',
                'note' => null,
                'company' => null,
                'is_invoiceable' => true,
                'is_deleted' => false,
                'stats' => [
                    'borrowings' => 0,
                ],
            ],
            [
                'id' => 3,
                'user_id' => null,
                'user' => null,
                'first_name' => 'Élise',
                'last_name' => 'Faure',
                'full_name' => 'Élise Faure',
                'reference' => '0003',
                'email' => 'elise@loxya.fr',
                'phone' => '+3211223344',
                'street' => '156 bis, avenue des tests poussés',
                'additional_street' => "Étage 3, Porte 2",
                'postal_code' => '88080',
                'administrative_area' => null,
                'locality' => 'Wazzaville',
                'address' => implode("\n", [
                    "156 bis, avenue des tests poussés",
                    "Étage 3, Porte 2",
                    "88080 Wazzaville",
                ]),
                'country' => 'FR',
                'company_id' => null,
                'language' => null,
                'note' => null,
                'company' => null,
                'is_invoiceable' => true,
                'is_deleted' => false,
                'stats' => [
                    'borrowings' => 1,
                ],
            ],
            [
                'id' => 4,
                'user_id' => null,
                'user' => null,
                'first_name' => 'John',
                'last_name' => 'Doe',
                'full_name' => 'John Doe',
                'reference' => '0004',
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
                'company_id' => null,
                'language' => null,
                'note' => null,
                'company' => null,
                'is_invoiceable' => true,
                'is_deleted' => false,
                'stats' => [
                    'borrowings' => 0,
                ],
            ],
        ]);

        $beneficiaries = match ($format) {
            Beneficiary::SERIALIZE_SUMMARY => $beneficiaries->map(static fn ($beneficiary) => (
                Arr::except($beneficiary, [
                    'user',
                    'user_id',
                    'phone',
                    'street',
                    'additional_street',
                    'postal_code',
                    'administrative_area',
                    'locality',
                    'country',
                    'address',
                    'company_id',
                    'language',
                    'note',
                    'stats',
                    'is_invoiceable',
                    'is_deleted',
                ])
            )),
            Beneficiary::SERIALIZE_DEFAULT => $beneficiaries->map(static fn ($beneficiary) => (
                Arr::except($beneficiary, ['user', 'stats'])
            )),
            Beneficiary::SERIALIZE_DETAILS => $beneficiaries,
            default => throw new \InvalidArgumentException(sprintf("Unknown format \"%s\"", $format)),
        };

        return static::dataFactory($id, $beneficiaries->all());
    }

    public function testGetAll(): void
    {
        $this->client->get('/api/beneficiaries');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponsePaginatedData(4, [
            self::data(4),
            self::data(3),
            self::data(1),
            self::data(2),
        ]);
    }

    public function testGetAllWithSearch(): void
    {
        // - Prénom
        $this->client->get('/api/beneficiaries?search=éli');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponsePaginatedData(1, [
            self::data(3), // - Élise Faure
        ]);

        // - Prénom nom
        $this->client->get('/api/beneficiaries?search=élise fau');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponsePaginatedData(1, [
            self::data(3), // - Élise Faure
        ]);

        // - Nom Prénom
        $this->client->get('/api/beneficiaries?search=fountain jean');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponsePaginatedData(1, [
            self::data(1), // - Jean Fountain
        ]);

        // - Email
        $this->client->get('/api/beneficiaries?search=@loxya.com');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponsePaginatedData(2, [
            self::data(1), // - Jean Fountain (tester@loxya.com)
            self::data(2), // - Roger Rabbit (tester2@loxya.com)
        ]);

        // - Référence
        $this->client->get('/api/beneficiaries?search=0001');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponsePaginatedData(1, [
            self::data(1), // - Jean Fountain (0001)
        ]);

        // - Société
        $this->client->get('/api/beneficiaries?search=testing,+inc');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponsePaginatedData(1, [
            self::data(1), // - Jean Fountain (Testing, Inc)
        ]);

        // - Recherche multiple
        $this->client->get('/api/beneficiaries?search[]=testing,+inc&search[]=élise fau');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponsePaginatedData(2, [
            self::data(3), // - Élise Faure
            self::data(1), // - Jean Fountain (Testing, Inc)
        ]);
    }

    public function testGetOne(): void
    {
        // - Avec un bénéficiaire inexistante.
        $this->client->get('/api/beneficiaries/999');
        $this->assertStatusCode(StatusCode::STATUS_NOT_FOUND);

        // - Avec des bénéficiaires valides
        $ids = array_column(static::data(null), 'id');
        foreach ($ids as $id) {
            $this->client->get(sprintf('/api/beneficiaries/%d', $id));
            $this->assertStatusCode(StatusCode::STATUS_OK);
            $this->assertResponseData(self::data($id, Beneficiary::SERIALIZE_DETAILS));
        }
    }

    public function testGetBookings(): void
    {
        $this->client->get('/api/beneficiaries/1/bookings');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponsePaginatedData(2, [
            EventsTest::data(5, Event::SERIALIZE_BOOKING_EXCERPT),
            EventsTest::data(1, Event::SERIALIZE_BOOKING_EXCERPT),
        ]);

        // - Test avec une date minimum.
        $this->client->get('/api/beneficiaries/1/bookings?after=2020-01-01');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponsePaginatedData(1, [
            EventsTest::data(5, Event::SERIALIZE_BOOKING_EXCERPT),
        ]);

        // - Test avec un sens ascendant.
        $this->client->get('/api/beneficiaries/1/bookings?direction=asc');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponsePaginatedData(2, [
            EventsTest::data(1, Event::SERIALIZE_BOOKING_EXCERPT),
            EventsTest::data(5, Event::SERIALIZE_BOOKING_EXCERPT),
        ]);
    }

    public function testGetEstimates(): void
    {
        $this->client->get('/api/beneficiaries/1/estimates');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponseData([
            EstimatesTest::data(2),
            EstimatesTest::data(1),
        ]);
    }

    public function testGetInvoices(): void
    {
        $this->client->get('/api/beneficiaries/1/invoices');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponseData([
            InvoicesTest::data(5),
            InvoicesTest::data(3),
            InvoicesTest::data(1),
        ]);
    }

    public function testCreateWithoutData(): void
    {
        $this->client->post('/api/beneficiaries');
        $this->assertStatusCode(StatusCode::STATUS_BAD_REQUEST);
        $this->assertApiErrorMessage("No data was provided.");
    }

    public function testCreateBadData(): void
    {
        $this->client->post('/api/beneficiaries', [
            'foo' => 'bar',
            'first_name' => 'Jean-j@cques',
            'email' => 'invalid',
            'reference' => '0001',
        ]);
        $this->assertApiValidationError([
            'first_name' => "This field contains some unauthorized characters.",
            'last_name' => "This field is mandatory.",
            'reference' => "This reference is already in use.",
            'email' => "This email address is invalid.",
            'country' => "This field is mandatory.",
        ]);
    }

    public function testCreate(): void
    {
        $this->client->post('/api/beneficiaries', [
            'first_name' => 'José',
            'last_name' => 'Gatillon',
            'email' => 'test@other-benef.net',
            'reference' => '0005',
            'company_id' => 2,
            'phone' => null,
            'street' => '1 rue du test',
            'postal_code' => '74000',
            'locality' => 'Annecy',
            'country' => 'FR',
            'note' => null,
        ]);

        $this->assertStatusCode(StatusCode::STATUS_CREATED);
        $this->assertResponseData([
            'id' => 5,
            'user_id' => null,
            'first_name' => 'José',
            'last_name' => 'Gatillon',
            'reference' => '0005',
            'email' => 'test@other-benef.net',
            'full_name' => 'José Gatillon',
            'company_id' => 2,
            'company' => CompaniesTest::data(2),
            'phone' => null,
            'street' => '1 rue du test',
            'additional_street' => null,
            'postal_code' => '74000',
            'administrative_area' => null,
            'locality' => 'Annecy',
            'country' => 'FR',
            'address' => "1 rue du test\n74000 Annecy",
            'is_invoiceable' => true,
            'is_deleted' => false,
            'language' => null,
            'note' => null,
            'stats' => [
                'borrowings' => 0,
            ],
            'user' => null,
        ]);

        // - Test avec une adresse e-mail existante.
        $this->client->post('/api/beneficiaries', [
            'first_name' => 'Tester',
            'last_name' => 'Leblanc',
            'pseudo' => 'new-test',
            'email' => 'tester@loxya.com',
            'password' => '0123456',
            'country' => 'CH',
        ]);
        $this->assertStatusCode(StatusCode::STATUS_CREATED);
    }

    public function testUpdateBadData(): void
    {
        $this->client->put('/api/beneficiaries/2', [
            'first_name' => 'Tester',
            'last_name' => 'Tagger',
            'email' => 'invalid',
            'phone' => 'notAphoneNumber',
        ]);
        $this->assertApiValidationError([
            'email' => "This email address is invalid.",
            'phone' => "This phone number is invalid.",
        ]);
    }

    public function testUpdate(): void
    {
        $this->client->put('/api/beneficiaries/1', [
            'first_name' => 'José',
            'last_name' => 'Gatillon',
            'postal_code' => '74000',
            'locality' => 'Annecy',
            'country' => 'FR',
            'note' => "Très bon client.",
        ]);

        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponseData(array_replace(
            self::data(1, Beneficiary::SERIALIZE_DETAILS),
            [
                'first_name' => 'José',
                'last_name' => 'Gatillon',
                'full_name' => 'José Gatillon',
                'postal_code' => '74000',
                'locality' => 'Annecy',
                'country' => 'FR',
                'address' => "1, somewhere av.\n74000 Annecy",
                'note' => "Très bon client.",
                'user' => array_merge(UsersTest::data(1), [
                    'first_name' => 'José',
                    'last_name' => 'Gatillon',
                    'full_name' => 'José Gatillon',
                ]),
            ],
        ));
    }

    public function testDeleteAndDestroy(): void
    {
        // - First call: soft delete.
        $this->client->delete('/api/beneficiaries/2');
        $this->assertStatusCode(StatusCode::STATUS_NO_CONTENT);
        $softDeleted = Beneficiary::withTrashed()->find(2);
        $this->assertNotNull($softDeleted);
        $this->assertNotEmpty($softDeleted->deleted_at);

        // - Second call: actually DESTROY record from DB
        $this->client->delete('/api/beneficiaries/2');
        $this->assertStatusCode(StatusCode::STATUS_NO_CONTENT);
        $this->assertNull(Beneficiary::withTrashed()->find(2));
    }

    public function testRestoreNotFound(): void
    {
        $this->client->put('/api/beneficiaries/restore/999');
        $this->assertStatusCode(StatusCode::STATUS_NOT_FOUND);
    }

    public function testRestore(): void
    {
        // - First, delete person #2
        $this->client->delete('/api/beneficiaries/2');
        $this->assertStatusCode(StatusCode::STATUS_NO_CONTENT);

        // - Then, restore person #2
        $this->client->put('/api/beneficiaries/restore/2');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertNotNull(self::data(2, Beneficiary::SERIALIZE_DETAILS));
    }
}
