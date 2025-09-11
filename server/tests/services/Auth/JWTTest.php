<?php
declare(strict_types=1);

namespace Loxya\Tests;

use Illuminate\Support\Carbon;
use Loxya\Config\Config;
use Loxya\Http\Request;
use Loxya\Models\User;
use Loxya\Services\Auth\JWT;
use Loxya\Support\JWT\JWT as JWTCore;
use Loxya\Support\JWT\TokenScope;
use Slim\Psr7\Factory\ServerRequestFactory;

final class JWTTest extends TestCase
{
    public function testGetUser(): void
    {
        $now = Carbon::create(2025, 4, 13, 11, 25, 0);
        static::setNow($now);

        $generateTokenRequest = static function ($payload, $secret = null, $algorithm = 'HS256') {
            $token = JWTCore::encode($payload, $secret ?? Config::get('JWTSecret'), $algorithm);
            return new Request(
                (new ServerRequestFactory())
                    ->createServerRequest('GET', '/')
                    ->withHeader('user-agent', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36')
                    ->withHeader('accept-language', 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7')
                    ->withHeader('Authorization', sprintf('Bearer %s', $token)),
            );
        };

        // - Sans données d'authentification JWT.
        $request = new Request((new ServerRequestFactory())->createServerRequest('GET', '/'));
        $this->assertNull((new JWT())->getUser($request));

        // - Avec un token JWT invalide (valeur complètement invalide).
        foreach (['__INVALID__', 'Bearer __INVALID__', ''] as $token) {
            $request = new Request(
                (new ServerRequestFactory())
                    ->createServerRequest('GET', '/')
                    ->withHeader('Authorization', $token),
            );
            $this->assertNull((new JWT())->getUser($request));
        }

        // - Avec un payload invalide.
        $request = $generateTokenRequest(['sub' => 1]);
        $this->assertNull((new JWT())->getUser($request));

        $validPayloadUser = [
            'scope' => TokenScope::AUTH,
            'iat' => $now->getTimestamp(),
            'exp' => $now->addSeconds(1)->getTimestamp(),
            'fpt' => 'd7785b3cb85bf9174d233ee189f6e609',
            'type' => 'user',
            'sub' => 1,
        ];

        // - Avec un secret invalide.
        $request = $generateTokenRequest($validPayloadUser, '__WHATEVER__');
        $this->assertNull((new JWT())->getUser($request));

        // - Avec un algorithm invalide.
        $request = $generateTokenRequest($validPayloadUser, null, 'HS512');
        $this->assertNull((new JWT())->getUser($request));

        // - Avec une date d'expiration du token passé.
        $request = $generateTokenRequest(array_replace($validPayloadUser, [
            'exp' => $now->subSeconds(1)->getTimestamp(),
        ]));
        $this->assertNull((new JWT())->getUser($request));

        // - Avec un fingerprint invalide.
        $request = $generateTokenRequest(array_replace($validPayloadUser, [
            'fpt' => '__INVALID-FINGERPRINT__',
        ]));
        $this->assertNull((new JWT())->getUser($request));

        // - Avec des infos subject invalide (1).
        $request = $generateTokenRequest(array_replace($validPayloadUser, [
            'type' => '__UNKNOWN__',
        ]));
        $this->assertNull((new JWT())->getUser($request));

        // - Avec des infos subject invalide (2).
        $request = $generateTokenRequest(array_replace($validPayloadUser, [
            'sub' => 9999,
        ]));
        $this->assertNull((new JWT())->getUser($request));

        // - Avec un payload et token valide pour un utilisateur.
        $request = $generateTokenRequest($validPayloadUser);
        $result = (new JWT())->getUser($request);
        $this->assertInstanceOf(User::class, $result);
        $this->assertTrue(User::findOrFail(1)->is($result));

        // - Avec une récupération via un cookie si on est pas sur une requête d'API.
        $token = JWTCore::encode($validPayloadUser, Config::get('JWTSecret'), 'HS256');
        $request = new Request(
            (new ServerRequestFactory())
                ->createServerRequest('GET', '/')
                ->withHeader('user-agent', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36')
                ->withHeader('accept-language', 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7')
                ->withCookieParams(['auth' => $token]),
        );
        $result = (new JWT())->getUser($request);
        $this->assertInstanceOf(User::class, $result);
        $this->assertTrue(User::findOrFail(1)->is($result));

        // - Ne doit pas utiliser de cookie si on est sur une requête d'API.
        $token = JWTCore::encode($validPayloadUser, Config::get('JWTSecret'), 'HS256');
        $request = new Request(
            (new ServerRequestFactory())
                ->createServerRequest('GET', '/api/whatever')
                ->withHeader('user-agent', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36')
                ->withHeader('accept-language', 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7')
                ->withCookieParams(['auth' => $token]),
        );
        $this->assertNull((new JWT())->getUser($request));
    }
}
