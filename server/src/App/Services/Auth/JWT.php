<?php
declare(strict_types=1);

namespace Loxya\Services\Auth;

use Carbon\CarbonImmutable;
use Loxya\Config\Config;
use Loxya\Http\Request;
use Loxya\Models\User;
use Loxya\Services\Auth\Contracts\AuthenticatorInterface;
use Loxya\Support\JWT\Token;
use Loxya\Support\JWT\TokenScope;
use Loxya\Support\Validation\Validator as V;
use Respect\Validation\Rules as Rule;
use Respect\Validation\Rules\KeySet;

final class JWT implements AuthenticatorInterface
{
    private const TOKEN_TYPE_USER = 'user';

    public function isEnabled(): bool
    {
        return true;
    }

    public function getUser(Request $request): User|null
    {
        try {
            $token = $this->fetchToken($request);
            $decoded = $this->decodeToken($request, $token);
        } catch (\RuntimeException | \DomainException) {
            return null;
        }

        return User::find($decoded['sub']);
    }

    public function clearPersistentData(): void
    {
        if (Config::getEnv() === 'test') {
            return;
        }

        $cookieName = Config::get('auth.cookie');
        $shouldSecureCookie = Config::isSslEnabled();

        setcookie($cookieName, '', [
            'expires' => time() - 42_000,
            'path' => '/',
            'secure' => $shouldSecureCookie,
            'httponly' => false,

            // - Note: Permet la création de cookies lorsque Loxya est
            //   intégré dans des systèmes tiers (e.g. Notion).
            'samesite' => $shouldSecureCookie ? 'None' : 'Lax',
        ]);
    }

    // ------------------------------------------------------
    // -
    // -    Méthodes internes
    // -
    // ------------------------------------------------------

    private function fetchToken(Request $request): string
    {
        // - Tente de récupérer le token dans les headers HTTP.
        $header = $request->getNormalizedHeaderLine(Config::get('httpAuthHeader'));
        if (!empty($header)) {
            if (preg_match('/Bearer\s+(.*)$/i', $header, $matches)) {
                return $matches[1];
            }
        }

        if (!$request->isApi()) {
            // - Sinon tente de récupérer le token dans les cookies.
            $cookieName = Config::get('auth.cookie');
            $cookieParams = $request->getCookieParams();
            if (isset($cookieParams[$cookieName])) {
                if (preg_match('/Bearer\s+(.*)$/i', $cookieParams[$cookieName], $matches)) {
                    return $matches[1];
                }
                return $cookieParams[$cookieName];
            }
        }

        throw new \RuntimeException('Token not found.');
    }

    private function decodeToken(Request $request, string $token): array
    {
        $schema = V::arrayType()->oneOf(
            new KeySet(
                new Rule\Key('type', V::equals(self::TOKEN_TYPE_USER)),
                new Rule\Key('sub', V::intType()),
            ),
        );
        return Token::decode($request, TokenScope::AUTH, $token, $schema);
    }

    // ------------------------------------------------------
    // -
    // -    Méthodes "helpers" statiques
    // -
    // ------------------------------------------------------

    /**
     * Génère un JWT signé pour l'utilisateur fourni.
     *
     * @param Request  $request La requête HTTP courante.
     * @param User     $user    L'utilisateur pour lequel générer le token.
     *
     * @return string Le token JWT généré.
     */
    public static function generateToken(Request $request, User $user): string
    {
        $expires = CarbonImmutable::now()->addHours(Config::get('sessionExpireHours'));

        return Token::generate($request, TokenScope::AUTH, $expires, [
            'type' => self::TOKEN_TYPE_USER,
            'sub' => $user->id,
        ]);
    }

    /**
     * Génère un token JWT et l'enregistre dans un cookie de session.
     *
     * @param Request  $request La requête HTTP courante.
     * @param User     $user    L'utilisateur pour lequel générer et enregistrer le token.
     *
     * @return string Le token JWT généré.
     */
    public static function registerSessionToken(Request $request, User $user): string
    {
        $token = static::generateToken($request, $user);

        if (Config::getEnv() === 'test') {
            return $token;
        }

        $cookieName = Config::get('auth.cookie');
        $shouldSecureCookie = Config::isSslEnabled();

        setcookie($cookieName, $token, [
            'expires' => 0,
            'path' => '/',
            'secure' => $shouldSecureCookie,
            'httponly' => false,

            // - Note: Permet la création de cookies lorsque Loxya est
            //   intégré dans des systèmes tiers (e.g. Notion).
            'samesite' => $shouldSecureCookie ? 'None' : 'Lax',
        ]);

        return $token;
    }
}
