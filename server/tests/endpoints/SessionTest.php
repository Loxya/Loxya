<?php
declare(strict_types=1);

namespace Loxya\Tests;

use Fig\Http\Message\StatusCodeInterface as StatusCode;
use Loxya\Http\Enums\AppContext;
use Loxya\Models\User;
use Loxya\Services\Auth;

final class SessionTest extends ApiTestCase
{
    public function testGetSelf(): void
    {
        // - Test avec un utilisateur "normal".
        $this->client->get('/api/session');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponseData(UsersTest::data(1, User::SERIALIZE_SESSION));
    }

    public function testLoginBadData(): void
    {
        Auth\Test::$user = null;

        // - Sans aucune données.
        $this->client->post('/api/session');
        $this->assertStatusCode(StatusCode::STATUS_BAD_REQUEST);
        $this->assertApiErrorMessage("Insufficient credentials provided.");

        // - Avec des données insuffisantes (1).
        $this->client->post('/api/session', [
            'identifier' => 'foo',
        ]);
        $this->assertStatusCode(StatusCode::STATUS_BAD_REQUEST);
        $this->assertApiErrorMessage("Insufficient credentials provided.");

        // - Avec des données insuffisantes (2).
        $this->client->post('/api/session', [
            'identifier' => 'foo',
            'password' => '',
        ]);
        $this->assertStatusCode(StatusCode::STATUS_BAD_REQUEST);
        $this->assertApiErrorMessage("Insufficient credentials provided.");

        // - Avec un utilisateur inexistant.
        $this->client->post('/api/session', [
            'identifier' => 'nobody@test.org',
            'password' => 'testing',
        ]);
        $this->assertStatusCode(StatusCode::STATUS_UNAUTHORIZED);
        $this->assertApiErrorMessage("Wrong credentials provided.");

        // - Avec un mot de passe invalide.
        $this->client->post('/api/session', [
            'identifier' => 'tester@loxya.com',
            'password' => 'wrongPassword',
        ]);
        $this->assertStatusCode(StatusCode::STATUS_UNAUTHORIZED);
        $this->assertApiErrorMessage("Wrong credentials provided.");
    }

    public function testLoginSuccess(): void
    {
        Auth\Test::$user = null;

        // - Test d'authentification avec différents types d'identifiants.
        foreach (['tester@loxya.com', 'test1'] as $identifier) {
            $this->client->post('/api/session', [
                'identifier' => $identifier,
                'password' => 'testing-pw',
            ]);
            $this->assertStatusCode(StatusCode::STATUS_OK);
            $this->assertResponseData(array_merge(
                UsersTest::data(1, User::SERIALIZE_SESSION),
                ['token' => '__FAKE-TOKEN__'],
            ));
        }

        // - Test d'identification dans un contexte accessible par l'utilisateur.
        $this->client->post('/api/session', [
            'identifier' => 'test2',
            'password' => 'testing-pw',
            'context' => AppContext::INTERNAL->value,
        ]);
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponseData(array_merge(
            UsersTest::data(2, User::SERIALIZE_SESSION),
            ['token' => '__FAKE-TOKEN__'],
        ));
    }
}
