<?php
declare(strict_types=1);

namespace Loxya\Support\JWT;

use Carbon\CarbonImmutable;
use Firebase\JWT\Key as JWTKey;
use Loxya\Config\Config;
use Loxya\Http\Request;
use Loxya\Support\Arr;
use Respect\Validation\Validatable;

final class Token
{
    /**
     * Génère un JWT signé.
     *
     * @param Request            $request   La requête HTTP courante, utilisée pour générer l'empreinte.
     * @param TokenScope         $scope     Le scope du token.
     * @param \DateTimeInterface $expiresAt La date d'expiration du token.
     * @param array              $payload   La charge utile du token.
     *
     * @return string Le token JWT généré.
     */
    public static function generate(
        Request $request,
        TokenScope $scope,
        \DateTimeInterface $expiresAt,
        array $payload,
    ): string {
        $secret = Config::get('JWTSecret');
        if ($secret === null) {
            throw new \LogicException('Token secret should be defined.');
        }

        $payload = [
            'scope' => $scope->value,
            'iat' => CarbonImmutable::now()->getTimestamp(),
            'exp' => $expiresAt->getTimestamp(),
            'fpt' => self::generateFingerprint($request),
            ...$payload,
        ];
        return JWT::encode($payload, $secret, 'HS256');
    }

    /**
     * Décode un token JWT et vérifie sa validité.
     *
     * @param Request      $request La requête HTTP courante, utilisée pour vérifier l'empreinte.
     * @param TokenScope   $scope   Le scope attendu du token.
     * @param string       $token   Le token JWT à décoder.
     * @param ?Validatable $schema  (Optionnel) Un schéma de validation à appliquer au payload.
     *
     * @return array Le contenu du token (hors méta-données).
     */
    public static function decode(
        Request $request,
        TokenScope $scope,
        string $token,
        ?Validatable $schema = null,
    ): array {
        $secret = Config::get('JWTSecret');
        if ($secret === null) {
            throw new \LogicException('Token secret should be defined.');
        }

        $key = new JWTKey($secret, 'HS256');
        $decoded = (array) JWT::decode($token, $key);

        // - Scope
        if (($decoded['scope'] ?? null) !== $scope->value) {
            throw new \UnexpectedValueException('Wrong scope.');
        }

        // - Fingerprint
        $fingerprint = $decoded['fpt'] ?? null;
        if ($fingerprint === null || $fingerprint !== self::generateFingerprint($request)) {
            throw new \UnexpectedValueException('Fingerprint does not match.');
        }

        // - Schema
        $payload = Arr::except($decoded, ['scope', 'iat', 'exp', 'fpt']);
        if ($schema !== null && !$schema->validate($payload)) {
            throw new \UnexpectedValueException('Invalid token format.');
        }

        return $payload;
    }

    // ------------------------------------------------------
    // -
    // -    Méthodes internes
    // -
    // ------------------------------------------------------


    private static function generateFingerprint(Request $request): string
    {
        // - En développement on utilise un fingerprint stable pour éviter
        //   d'être déconnecté à chaque utilisation des devtools notamment.
        if (Config::getEnv() === 'development') {
            return '__DEV__';
        }

        $userAgent = $request->getHeaderLine('user-agent') ?? '';
        $acceptLanguage = $request->getHeaderLine('accept-language') ?? '';
        return md5(serialize([$userAgent, $acceptLanguage]));
    }
}
