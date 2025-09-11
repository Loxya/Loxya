<?php
declare(strict_types=1);

namespace Loxya\Tests;

use Fig\Http\Message\StatusCodeInterface as StatusCode;
use Illuminate\Support\Collection;
use Loxya\Models\Enums\BookingViewMode;
use Loxya\Models\Enums\Group;
use Loxya\Models\Enums\TechniciansViewMode;
use Loxya\Models\User;
use Loxya\Support\Arr;

final class UsersTest extends ApiTestCase
{
    public static function data(?int $id = null, string $format = User::SERIALIZE_DEFAULT)
    {
        $users = (new Collection([
            [
                'id' => 1,
                'pseudo' => 'test1',
                'first_name' => 'Jean',
                'last_name' => 'Fountain',
                'full_name' => 'Jean Fountain',
                'phone' => null,
                'street' => "1, somewhere av.",
                'postal_code' => '1234',
                'locality' => "Megacity",
                'country_id' => 1,
                'country' => CountriesTest::data(1),
                'full_address' => "1, somewhere av.\n1234 Megacity",
                'email' => 'tester@loxya.com',
                'group' => Group::ADMINISTRATION,
                'language' => 'en',
                'default_bookings_view' => BookingViewMode::CALENDAR->value,
                'default_technicians_view' => TechniciansViewMode::LISTING->value,
                'disable_contextual_popovers' => true,
                'disable_search_persistence' => false,
            ],
            [
                'id' => 2,
                'pseudo' => 'test2',
                'first_name' => 'Roger',
                'last_name' => 'Rabbit',
                'full_name' => 'Roger Rabbit',
                'phone' => null,
                'street' => null,
                'postal_code' => null,
                'locality' => null,
                'country_id' => null,
                'country' => null,
                'full_address' => null,
                'email' => 'tester2@loxya.com',
                'group' => Group::OPERATION,
                'language' => 'fr',
                'default_bookings_view' => BookingViewMode::CALENDAR->value,
                'default_technicians_view' => TechniciansViewMode::LISTING->value,
                'disable_contextual_popovers' => true,
                'disable_search_persistence' => true,
            ],
            [
                'id' => 3,
                'pseudo' => 'a.dupont',
                'first_name' => 'Alexandre',
                'last_name' => 'Dupont',
                'full_name' => 'Alexandre Dupont',
                'phone' => '+33678901234',
                'street' => "15 Rue de l'Église",
                'postal_code' => '75001',
                'locality' => 'Paris',
                'country_id' => 1,
                'country' => CountriesTest::data(1),
                'full_address' => "15 Rue de l'Église\n75001 Paris",
                'email' => 'alex.dupont@loxya.com',
                'group' => Group::OPERATION,
                'language' => 'fr',
                'default_bookings_view' => BookingViewMode::LISTING->value,
                'default_technicians_view' => TechniciansViewMode::LISTING->value,
                'disable_contextual_popovers' => false,
                'disable_search_persistence' => false,
            ],
            [
                'id' => 4,
                'pseudo' => 'TheVisitor',
                'first_name' => 'Henry',
                'last_name' => 'Berluc',
                'full_name' => 'Henry Berluc',
                'phone' => '+33724000000',
                'street' => null,
                'postal_code' => null,
                'locality' => null,
                'country_id' => 2,
                'country' => CountriesTest::data(2),
                'full_address' => null,
                'email' => 'visitor@loxya.com',
                'group' => Group::READONLY_PLANNING_GENERAL,
                'language' => 'fr',
                'default_bookings_view' => BookingViewMode::CALENDAR->value,
                'default_technicians_view' => TechniciansViewMode::LISTING->value,
                'disable_contextual_popovers' => false,
                'disable_search_persistence' => false,
            ],
            [
                'id' => 5,
                'pseudo' => 'caroline',
                'first_name' => 'Caroline',
                'last_name' => 'Farol',
                'full_name' => 'Caroline Farol',
                'phone' => '+33786325500',
                'street' => null,
                'postal_code' => null,
                'locality' => null,
                'country_id' => null,
                'country' => null,
                'full_address' => null,
                'email' => 'external@loxya.com',
                'group' => Group::READONLY_PLANNING_GENERAL,
                'language' => 'en',
                'default_bookings_view' => BookingViewMode::CALENDAR->value,
                'default_technicians_view' => TechniciansViewMode::LISTING->value,
                'disable_contextual_popovers' => false,
                'disable_search_persistence' => false,
            ],
        ]))->keyBy('id');

        $users = match ($format) {
            User::SERIALIZE_SETTINGS => $users->map(static fn ($user) => (
                Arr::only($user, User::SETTINGS_ATTRIBUTES)
            )),
            User::SERIALIZE_SUMMARY => $users->map(static fn ($user) => (
                Arr::only($user, ['id', 'full_name', 'email'])
            )),
            User::SERIALIZE_DEFAULT => $users->map(static fn ($user) => (
                Arr::except($user, [
                    ...User::SETTINGS_ATTRIBUTES,
                    'street',
                    'postal_code',
                    'locality',
                    'country_id',
                    'country',
                    'full_address',
                ])
            )),
            User::SERIALIZE_DETAILS => $users->map(static fn ($user) => (
                Arr::except($user, User::SETTINGS_ATTRIBUTES)
            )),
            User::SERIALIZE_SESSION => $users->map(static fn ($user) => (
                array_replace($user, ['type' => 'user'])
            )),
            default => throw new \InvalidArgumentException(sprintf("Unknown format \"%s\"", $format)),
        };

        return $id !== null
            ? $users->get($id)
            : $users->values()->all();
    }

    public function testGetAll(): void
    {
        // - Test simple.
        $this->client->get('/api/users');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponsePaginatedData(5, [
            self::data(3),
            self::data(5),
            self::data(1),
            self::data(2),
            self::data(4),
        ]);

        // - Test de récupération des enregistrements supprimés.
        $this->client->get('/api/users?deleted=1');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponsePaginatedData(0);

        // - Test de récupération avec recherche simple.
        $this->client->get('/api/users?search=rol');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponsePaginatedData(1, [
            self::data(5), // - Caroline Farol
        ]);

        // - Test de récupération avec recherche multiple.
        $this->client->get('/api/users?search[]=rol&search[]=alex');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponsePaginatedData(2, [
            self::data(3), // - Alexandre Dupont
            self::data(5), // - Caroline Farol
        ]);

        // - Test de récupération des membres d'un groupe en particulier.
        $this->client->get(sprintf('/api/users?group=%s', Group::OPERATION));
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponsePaginatedData(2, [
            self::data(3),
            self::data(2),
        ]);
    }

    public function testGetOne(): void
    {
        // - Avec un utilisateur inexistant.
        $this->client->get('/api/users/9999');
        $this->assertStatusCode(StatusCode::STATUS_NOT_FOUND);

        // - Avec une récupération de soi-même => Interdit via cet endpoint.
        $this->client->get('/api/users/1');
        $this->assertStatusCode(StatusCode::STATUS_FORBIDDEN);

        // - Avec le mot clé spécial `self` pour soi-même.
        $this->client->get('/api/users/self');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponseData(self::data(1, User::SERIALIZE_DETAILS));
    }

    public function testGetOneSettings(): void
    {
        // - Avec un utilisateur inexistant.
        $this->client->get('/api/users/9999/settings');
        $this->assertStatusCode(StatusCode::STATUS_NOT_FOUND);

        // - Avec une récupération de soi-même => Interdit via cet endpoint.
        $this->client->get('/api/users/1/settings');
        $this->assertStatusCode(StatusCode::STATUS_FORBIDDEN);

        // - Avec le mot clé spécial `self` pour soi-même.
        $this->client->get('/api/users/self/settings');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponseData(self::data(1, User::SERIALIZE_SETTINGS));

        // - Test valide.
        $this->client->get('/api/users/2/settings');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponseData(self::data(2, User::SERIALIZE_SETTINGS));
    }

    public function testUpdateSettings(): void
    {
        // - Test sans données.
        $this->client->put('/api/users/2/settings', []);
        $this->assertStatusCode(StatusCode::STATUS_BAD_REQUEST);
        $this->assertApiErrorMessage("No data was provided.");

        // - Test avec un utilisateur inexistant.
        $this->client->put('/api/users/999/settings', ['language' => 'fr']);
        $this->assertStatusCode(StatusCode::STATUS_NOT_FOUND);

        // - Avec une récupération de soi-même => Interdit via cet endpoint.
        $this->client->put('/api/users/1/settings', ['language' => 'fr']);
        $this->assertStatusCode(StatusCode::STATUS_FORBIDDEN);

        // - Test valide.
        $this->client->put('/api/users/2/settings', [
            'language' => 'fr',
            'default_bookings_view' => BookingViewMode::CALENDAR->value,
            'default_technicians_view' => TechniciansViewMode::LISTING->value,
            'disable_contextual_popovers' => false,
            'disable_search_persistence' => false,
        ]);
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponseData([
            'language' => 'fr',
            'default_bookings_view' => BookingViewMode::CALENDAR->value,
            'default_technicians_view' => TechniciansViewMode::LISTING->value,
            'disable_contextual_popovers' => false,
            'disable_search_persistence' => false,
        ]);

        // - Avec le mot clé spécial `self` pour soi-même.
        $this->client->put('/api/users/self/settings', [
            'language' => 'en',
            'default_bookings_view' => BookingViewMode::LISTING->value,
            'default_technicians_view' => TechniciansViewMode::TIMELINE->value,
            'disable_contextual_popovers' => true,
            'disable_search_persistence' => true,
        ]);
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponseData([
            'language' => 'en',
            'default_bookings_view' => BookingViewMode::LISTING->value,
            'default_technicians_view' => TechniciansViewMode::TIMELINE->value,
            'disable_contextual_popovers' => true,
            'disable_search_persistence' => true,
        ]);
    }

    public function testCreateBadData(): void
    {
        $this->client->post('/api/users', [
            'email' => 'not-an-email',
            'first_name' => '',
            'last_name' => '',
            'group' => 'invalid',
        ]);
        $this->assertApiValidationError([
            'pseudo' => "This field is mandatory.",
            'email' => "This email address is invalid.",
            'group' => "This field is invalid.",
            'password' => "This field is mandatory.",
            'first_name' => "This field is mandatory.",
            'last_name' => "This field is mandatory.",
        ]);
    }

    public function testCreateDuplicate(): void
    {
        $this->client->post('/api/users', [
            'pseudo' => 'test1',
            'first_name' => 'Nouveau',
            'last_name' => 'Testeur',
            'email' => 'tester@loxya.com',
            'password' => 'test-dupe',
            'group' => Group::OPERATION,
        ]);
        $this->assertApiValidationError([
            'pseudo' => "This pseudo is already in use.",
            'email' => "This email address is already in use.",
        ]);
    }

    public function testCreate(): void
    {
        $this->client->post('/api/users', [
            'email' => 'someone@test.org',
            'pseudo' => 'Jeanne',
            'first_name' => 'Jeanne',
            'last_name' => 'Testeur',
            'password' => 'my-ultim4te-paßwor!',
            'group' => Group::OPERATION,
        ]);
        $this->assertStatusCode(StatusCode::STATUS_CREATED);
        $this->assertResponseData([
            'id' => 6,
            'first_name' => 'Jeanne',
            'last_name' => 'Testeur',
            'full_name' => 'Jeanne Testeur',
            'email' => 'someone@test.org',
            'pseudo' => 'Jeanne',
            'phone' => null,
            'street' => null,
            'postal_code' => null,
            'locality' => null,
            'country' => null,
            'country_id' => null,
            'full_address' => null,
            'group' => Group::OPERATION,
        ]);
    }

    public function testUpdateNoData(): void
    {
        $this->client->put('/api/users/2', []);
        $this->assertStatusCode(StatusCode::STATUS_BAD_REQUEST);
        $this->assertApiErrorMessage("No data was provided.");
    }

    public function testUpdateNotFound(): void
    {
        $this->client->put('/api/users/999', ['pseudo' => '__inexistant__']);
        $this->assertStatusCode(StatusCode::STATUS_NOT_FOUND);
    }

    public function testForbidUpdateSelfWithId(): void
    {
        $this->client->put('/api/users/1', ['pseudo' => 'Admin']);
        $this->assertStatusCode(StatusCode::STATUS_FORBIDDEN);
    }

    public function testUpdate(): void
    {
        // - L'utilisateur lui-même
        $updatedData = ['pseudo' => 'Admin'];
        $this->client->put('/api/users/self', $updatedData);
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponseData(array_replace(
            self::data(1, User::SERIALIZE_DETAILS),
            $updatedData,
        ));

        // - Un autre utilisateur (en tant qu'admin)
        $updatedData = [
            'pseudo' => 'userEdited',
            'first_name' => 'Edited',
            'last_name' => 'Tester',
            'full_name' => 'Edited Tester',
            'group' => Group::ADMINISTRATION,
        ];
        $this->client->put('/api/users/3', $updatedData);
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponseData(array_replace(
            self::data(3, User::SERIALIZE_DETAILS),
            $updatedData,
        ));
    }

    public function testDeleteAndDestroy(): void
    {
        // - First call: soft delete.
        $this->client->delete('/api/users/3');
        $this->assertStatusCode(StatusCode::STATUS_NO_CONTENT);
        $softDeleted = User::withTrashed()->find(3);
        $this->assertNotNull($softDeleted);
        $this->assertNotEmpty($softDeleted->deleted_at);

        // - Second call: actually DESTROY record from DB
        $this->client->delete('/api/users/3');
        $this->assertStatusCode(StatusCode::STATUS_NO_CONTENT);
        $this->assertNull(User::withTrashed()->find(3));

        // - Test de suppression d'un utilisateur qui a un bénéficiaire lié
        $this->client->delete('/api/users/2');
        $this->assertStatusCode(StatusCode::STATUS_NO_CONTENT);
        $user = User::withTrashed()->find(2);
        $this->assertNotNull($user);
        $this->assertNotEmpty($user->deleted_at);
    }

    public function testRestoreNotFound(): void
    {
        $this->client->put('/api/users/restore/999');
        $this->assertStatusCode(StatusCode::STATUS_NOT_FOUND);
    }

    public function testRestore(): void
    {
        // - First, delete user #2
        $this->client->delete('/api/users/2');
        $this->assertStatusCode(StatusCode::STATUS_NO_CONTENT);

        // - Then, restore user #2
        $this->client->put('/api/users/restore/2');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertNotNull(User::find(2));
    }
}
