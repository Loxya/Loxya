<?php
declare(strict_types=1);

namespace Loxya\Tests;

use Carbon\CarbonImmutable;
use Fig\Http\Message\StatusCodeInterface as StatusCode;
use Illuminate\Support\Carbon;
use Loxya\Errors\Enums\ApiErrorCode;
use Loxya\Models\User;
use Loxya\Services\Auth;
use Loxya\Services\Cache;
use Loxya\Services\Mailer;
use Loxya\Support\JWT\Token;
use Loxya\Support\JWT\TokenScope;
use Loxya\Support\Str;

final class PasswordTest extends ApiTestCase
{
    public function testRequestReset(): void
    {
        static::setNow(Carbon::create(2025, 05, 03, 12, 30, 0));

        // - On reset l'état connecté.
        Auth\Test::$user = null;

        /** @var Mailer $mailer */
        $mailer = container('mailer');

        /** @var Cache $cache */
        $cache = container('cache');

        $assertCodeCache = function (string $email, string|null $expectedCode) use ($cache) {
            $codeCacheKey = sprintf('password-reset.code.%s', md5($email));
            $codeCache = $cache->getItem($codeCacheKey);

            $this->assertTrue($codeCache->isHit());
            $this->assertSame($expectedCode, $codeCache->get()['code']);
        };

        // - Test avec un payload invalide.
        foreach ([[], ['email' => 'test']] as $invalidPayload) {
            $this->client->post('/api/password-reset', $invalidPayload);
            $this->assertStatusCode(StatusCode::STATUS_BAD_REQUEST);
            $this->assertApiErrorMessage("Invalid email.");
        }

        // - Avec avec une adresse e-mail qui ne correspond à aucun compte...
        // => Doit se comporter comme si l'utilisateur existait.
        $this->client->post('/api/password-reset', [
            'email' => 'unknown-1@test.com',
        ]);
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponseData([
            'resend_at' => '2025-05-03T12:31:00.000000Z',
            'expires_at' => '2025-05-03T12:40:00.000000Z',
        ]);
        $this->assertEmpty($mailer->getSent());
        $assertCodeCache('unknown-1@test.com', null);

        // - Si on re-essai tout de suite, le système doit temporiser, même si l'adresse existe.
        static::setNow(Carbon::create(2025, 05, 03, 12, 30, 10));
        $this->client->post('/api/password-reset', [
            'email' => 'alex.dupont@loxya.com',
        ]);
        $this->assertStatusCode(StatusCode::STATUS_TOO_MANY_REQUESTS);
        $this->assertResponseHasKeyEquals('error.retryAt', '2025-05-03T12:31:00.000000Z');

        // - Avec avec une adresse e-mail d'un administrateur...
        // => Réinitialisation non permise par ce moyen mais doit se
        //    comporter comme si l'utilisateur existait.
        static::setNow(Carbon::create(2025, 05, 03, 12, 31, 0));
        $this->client->post('/api/password-reset', [
            'email' => 'tester@loxya.com',
        ]);
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponseData([
            'resend_at' => '2025-05-03T12:32:00.000000Z',
            'expires_at' => '2025-05-03T12:41:00.000000Z',
        ]);
        $this->assertEmpty($mailer->getSent());
        $assertCodeCache('tester@loxya.com', null);

        // - Après avoir attendu, si on utiliser une adresse e-mail existante...
        // => Envoi d'un mail à l'utilisateur.
        Str::createNumericCodeUsing(static fn () => '123456');
        static::setNow(Carbon::create(2025, 05, 03, 12, 32, 0));
        $this->client->post('/api/password-reset', [
            'email' => 'alex.dupont@loxya.com',
        ]);
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponseData([
            'resend_at' => '2025-05-03T12:33:00.000000Z',
            'expires_at' => '2025-05-03T12:42:00.000000Z',
        ]);

        $lastSentMail = $mailer->getLastSent();
        $this->assertNotNull($lastSentMail);
        $this->assertSame(['alex.dupont@loxya.com'], $lastSentMail['recipients']);
        $this->assertSame("Demande de réinitialisation de mot de passe", $lastSentMail['subject']);
        $this->assertMatchesHtmlSnapshot($lastSentMail['message']);
    }

    public function testVerifyReset(): void
    {
        static::setNow(Carbon::create(2025, 05, 03, 12, 30, 0));

        // - On reset l'état connecté.
        Auth\Test::$user = null;

        /** @var Cache $cache */
        $cache = container('cache');

        $setCodeCache = static function (string $email, string|null $code) use ($cache) {
            $codeCacheKey = sprintf('password-reset.code.%s', md5($email));

            $now = CarbonImmutable::now();
            $codeCache = $cache
                ->getItem($codeCacheKey)
                ->set([
                    'email' => $email,
                    'code' => $code,
                    'attempts' => 0,
                    'createdAt' => $now->getTimestamp(),
                ])
                ->expiresAt($now->addMinutes(1));

            $cache->save($codeCache);

            return static fn () => $cache->getItem($codeCacheKey);
        };

        // - Test avec des payloads invalides.
        $invalidPayloads = [
            [],
            ['code' => '123456'],
            ['email' => 'test@loxya.com'],
            ['email' => 'test', 'code' => '123456'],
        ];
        foreach ($invalidPayloads as $invalidPayload) {
            $this->client->put('/api/password-reset', $invalidPayload);
            $this->assertStatusCode(StatusCode::STATUS_BAD_REQUEST);
        }

        // - Test avec une adresse e-mail et un code pour lesquels
        //   une procédure de réinitialisation (simulée ou réelle)
        //   n'est pas en cours.
        // => Doit indiquer un code obsolète.
        $this->client->put('/api/password-reset', [
            'email' => 'unknown@test.com',
            'code' => '123456',
        ]);
        $this->assertStatusCode(StatusCode::STATUS_BAD_REQUEST);
        $this->assertApiError(ApiErrorCode::PASSWORD_RESET_OBSOLETE_CODE);

        // - Avec un code généré pour un autre utilisateur.
        $setCodeCache('alex.dupont@loxya.com', '123456');
        $this->client->put('/api/password-reset', [
            'email' => 'external@loxya.com',
            'code' => '123456',
        ]);
        $this->assertStatusCode(StatusCode::STATUS_BAD_REQUEST);
        $this->assertApiError(ApiErrorCode::PASSWORD_RESET_OBSOLETE_CODE);

        // - Test avec un mauvais code (5 fois pour tester le brute-force).
        for ($i = 0; $i < 5; $i += 1) {
            $this->client->put('/api/password-reset', [
                'email' => 'alex.dupont@loxya.com',
                'code' => '789456',
            ]);
            $this->assertStatusCode(StatusCode::STATUS_BAD_REQUEST);
            $this->assertApiError(ApiErrorCode::PASSWORD_RESET_WRONG_CODE);
        }

        // - Test à nouveau avec un mauvais code => Nombre de tentatives dépassé.
        $this->client->put('/api/password-reset', [
            'email' => 'alex.dupont@loxya.com',
            'code' => '258963',
        ]);
        $this->assertStatusCode(StatusCode::STATUS_TOO_MANY_REQUESTS);
        $this->assertApiError(ApiErrorCode::PASSWORD_RESET_TOO_MANY_ATTEMPTS);

        // - Avec un code dont la validité est dépassée.
        $setCodeCache('alex.dupont@loxya.com', '256369');
        static::setNow(Carbon::create(2025, 05, 03, 12, 31, 1));
        $this->client->put('/api/password-reset', [
            'email' => 'alex.dupont@loxya.com',
            'code' => '256369',
        ]);
        $this->assertStatusCode(StatusCode::STATUS_BAD_REQUEST);
        $this->assertApiError(ApiErrorCode::PASSWORD_RESET_OBSOLETE_CODE);

        // - Avec une procédure fake => On ne peut pas passer un code à `null`.
        $setCodeCache('unknown@loxya.com', null);
        $this->client->put('/api/password-reset', [
            'email' => 'alex.dupont@loxya.com',
            'code' => null,
        ]);
        $this->assertStatusCode(StatusCode::STATUS_BAD_REQUEST);

        // - Avec une procédure fake => Avec un code forcément
        //   invalide (5 fois pour tester le brute-force).
        for ($i = 0; $i < 5; $i += 1) {
            $this->client->put('/api/password-reset', [
                'email' => 'unknown@loxya.com',
                'code' => '123456',
            ]);
            $this->assertStatusCode(StatusCode::STATUS_BAD_REQUEST);
            $this->assertApiError(ApiErrorCode::PASSWORD_RESET_WRONG_CODE);
        }

        // - Test à nouveau avec un mauvais code => Nombre de tentatives dépassé.
        $this->client->put('/api/password-reset', [
            'email' => 'unknown@loxya.com',
            'code' => '258963',
        ]);
        $this->assertStatusCode(StatusCode::STATUS_TOO_MANY_REQUESTS);
        $this->assertApiError(ApiErrorCode::PASSWORD_RESET_TOO_MANY_ATTEMPTS);

        // - Test valide.
        Str::createUuidsUsingSequence(['d8b67860-aace-4a58-8600-5113cd50b619']);
        $cache = $setCodeCache('alex.dupont@loxya.com', '147852');
        $this->client->put('/api/password-reset', [
            'email' => 'alex.dupont@loxya.com',
            'code' => '147852',
        ]);
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponseData([
            'token' => 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzY29wZSI6InBhc3N3b3JkLXJlc2V0IiwiaWF0IjoxNzQ2Mjc1NDYxLCJleHAiOjE3NDYyNzYwNjEsImZwdCI6ImQ3Nzg1YjNjYjg1YmY5MTc0ZDIzM2VlMTg5ZjZlNjA5IiwidWlkIjoiZDhiNjc4NjAtYWFjZS00YTU4LTg2MDAtNTExM2NkNTBiNjE5IiwiZW1haWwiOiJhbGV4LmR1cG9udEBsb3h5YS5jb20iLCJzdWIiOjN9.SRgh9XDAcDLktK0w9lsnAvZ5RX8vVFBMETUNxRFi3zU',
            'expires_at' => '2025-05-03T12:41:01.000000Z',
        ]);
        $this->assertFalse($cache()->isHit());
    }

    public function testFinalizeReset(): void
    {
        static::setNow(Carbon::create(2025, 05, 03, 12, 30, 0));

        // - On reset l'état connecté.
        Auth\Test::$user = null;

        // - Test sans token de réinitialisation.
        $this->client->post('/api/password-reset/set', ['password' => '123456']);
        $this->assertStatusCode(StatusCode::STATUS_FORBIDDEN);

        // - Test avec un token invalide.
        $this->client->post('/api/password-reset/set', ['password' => '123456'], null, static fn ($request) => [
            'X-Reset-Token' => json_encode(['email' => 'alex.dupont@loxya.com', 'sub' => 3]),
        ]);
        $this->assertStatusCode(StatusCode::STATUS_FORBIDDEN);

        // - Test avec un token expiré.
        $headerCallback = static function ($request) {
            $expiresAt = CarbonImmutable::now()->addMinutes(1);
            $token = Token::generate($request, TokenScope::PASSWORD_RESET, $expiresAt, [
                'email' => 'alex.dupont@loxya.com',
                'sub' => 3,
            ]);

            static::setNow(Carbon::create(2025, 05, 03, 12, 31, 1));
            return ['X-Reset-Token' => $token];
        };
        $this->client->post('/api/password-reset/set', ['password' => 'myp@ssw0rd'], null, $headerCallback);
        $this->assertStatusCode(StatusCode::STATUS_FORBIDDEN);

        // - Avec un payload vide / sans mot de passe.
        static::setNow(Carbon::create(2025, 05, 03, 12, 40, 0));
        foreach ([[], ['email' => 'new@loxya.com']] as $invalidPayload) {
            $expiresAt = CarbonImmutable::now()->addMinutes(1);
            $this->client->post('/api/password-reset/set', $invalidPayload, null, static fn ($request) => [
                'X-Reset-Token' => Token::generate($request, TokenScope::PASSWORD_RESET, $expiresAt, [
                    'uid' => (string) Str::uuid(),
                    'email' => 'alex.dupont@loxya.com',
                    'sub' => 3,
                ]),
            ]);
            $this->assertStatusCode(StatusCode::STATUS_BAD_REQUEST);
            $this->assertApiErrorMessage("No data was provided.");
        }

        // - Avec un utilisateur qui n'existe plus.
        $expiresAt = CarbonImmutable::now()->addMinutes(1);
        $this->client->post('/api/password-reset/set', ['password' => 'myp@ssw0rd'], null, static fn ($request) => [
            'X-Reset-Token' => Token::generate($request, TokenScope::PASSWORD_RESET, $expiresAt, [
                'uid' => (string) Str::uuid(),
                'email' => 'alex.dupont@loxya.com',
                'sub' => 9999,
            ]),
        ]);
        $this->assertStatusCode(StatusCode::STATUS_FORBIDDEN);

        // - Avec une adresse e-mail qui ne correspond plus.
        $expiresAt = CarbonImmutable::now()->addMinutes(1);
        $this->client->post('/api/password-reset/set', ['password' => 'myp@ssw0rd'], null, static fn ($request) => [
            'X-Reset-Token' => Token::generate($request, TokenScope::PASSWORD_RESET, $expiresAt, [
                'uid' => (string) Str::uuid(),
                'email' => 'alexdu07@loxya.com',
                'sub' => 3,
            ]),
        ]);
        $this->assertStatusCode(StatusCode::STATUS_FORBIDDEN);

        // - Avec un mot de passe qui ne correspond pas aux critères de validation (vide).
        foreach ([null, ''] as $invalidPassword) {
            $expiresAt = CarbonImmutable::now()->addMinutes(1);
            $invalidPayload = ['password' => $invalidPassword];
            $this->client->post('/api/password-reset/set', $invalidPayload, null, static fn ($request) => [
                'X-Reset-Token' => Token::generate($request, TokenScope::PASSWORD_RESET, $expiresAt, [
                    'uid' => (string) Str::uuid(),
                    'email' => 'alex.dupont@loxya.com',
                    'sub' => 3,
                ]),
            ]);
            $this->assertApiValidationError([
                'password' => "Ce champ est obligatoire.",
            ]);
        }

        // - Avec un mot de passe qui ne correspond pas aux critères de validation (longueur).
        $expiresAt = CarbonImmutable::now()->addMinutes(1);
        $this->client->post('/api/password-reset/set', ['password' => '12'], null, static fn ($request) => [
            'X-Reset-Token' => Token::generate($request, TokenScope::PASSWORD_RESET, $expiresAt, [
                'uid' => (string) Str::uuid(),
                'email' => 'alex.dupont@loxya.com',
                'sub' => 3,
            ]),
        ]);
        $this->assertApiValidationError([
            'password' => "4 caractères min., 191 caractères max.",
        ]);

        // - Avec un test valide.
        $tokenUid = (string) Str::uuid();
        $expiresAt = CarbonImmutable::now()->addMinutes(1);
        $this->client->post('/api/password-reset/set', ['password' => 'myp@ssw0rd'], null, static fn ($request) => [
            'X-Reset-Token' => Token::generate($request, TokenScope::PASSWORD_RESET, $expiresAt, [
                'uid' => $tokenUid,
                'email' => 'alex.dupont@loxya.com',
                'sub' => 3,
            ]),
        ]);
        $this->assertStatusCode(StatusCode::STATUS_NO_CONTENT);
        $this->assertSame(3, User::fromLogin('alex.dupont@loxya.com', 'myp@ssw0rd')?->id);

        // - Une fois utilisé, on ne doit pas pouvoir ré-utiliser le token.
        $this->client->post('/api/password-reset/set', ['password' => 'repl@y'], null, static fn ($request) => [
            'X-Reset-Token' => Token::generate($request, TokenScope::PASSWORD_RESET, $expiresAt, [
                'uid' => $tokenUid,
                'email' => 'alex.dupont@loxya.com',
                'sub' => 3,
            ]),
        ]);
        $this->assertStatusCode(StatusCode::STATUS_FORBIDDEN);
    }
}
