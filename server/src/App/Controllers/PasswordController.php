<?php
declare(strict_types=1);

namespace Loxya\Controllers;

use Carbon\CarbonImmutable;
use DI\Container;
use Fig\Http\Message\StatusCodeInterface as StatusCode;
use Loxya\Errors\Enums\ApiErrorCode;
use Loxya\Errors\Exception\ApiBadRequestException;
use Loxya\Errors\Exception\ApiTooManyRequestsException;
use Loxya\Errors\Exception\HttpTooManyRequestsException;
use Loxya\Http\Request;
use Loxya\Mails;
use Loxya\Models\Enums\Group;
use Loxya\Models\User;
use Loxya\Services\Cache;
use Loxya\Services\Mailer;
use Loxya\Support\JWT\Token;
use Loxya\Support\JWT\TokenScope;
use Loxya\Support\Str;
use Loxya\Support\Validation\Validator as V;
use Psr\Http\Message\ResponseInterface;
use Respect\Validation\Rules as Rule;
use Respect\Validation\Rules\KeySet;
use Slim\Exception\HttpBadRequestException;
use Slim\Exception\HttpForbiddenException;
use Slim\Http\Response;
use Symfony\Component\Cache\CacheItem;

final class PasswordController extends BaseController
{
    /**
     * Délai minimum (en secondes) entre deux demandes de
     * réinitialisation pour une même adresse IP.
     */
    private const RESET_COOLDOWN_IP_TTL = 60;

    /**
     * Durée (en minutes) pendant laquelle un code de
     * réinitialisation reste valide après son envoi.
     */
    private const RESET_TIMEOUT = 10;

    /**
     * Nombre maximum de tentatives de vérification du code de
     * réinitialisation avant que celui-ci ne soit reset et qu'il
     * faille recommencer la procédure.
     */
    private const RESET_MAX_CODE_ATTEMPTS = 5;

    /**
     * Durée (en minutes) pendant laquelle le jeton de réinitialisation
     * reste valide après la vérification du code, pour permettre
     * la modification du mot de passe.
     */
    private const RESET_PASSWORD_CHANGE_TIMEOUT = 10;

    private Cache $cache;
    private Mailer $mailer;

    public function __construct(Container $container, Cache $cache, Mailer $mailer)
    {
        parent::__construct($container);

        $this->cache = $cache;
        $this->mailer = $mailer;
    }

    public function requestReset(Request $request, Response $response): ResponseInterface
    {
        // - Si l'IP a déjà fait une demande récemment, on temporise.
        $ipCooldownCache = null;
        if ($request->getClientIp() !== null) {
            $ipCooldownCacheKey = sprintf('password-reset.cooldown.%s', md5($request->getClientIp()));
            $ipCooldownCache = $this->cache->getItem($ipCooldownCacheKey);

            if ($ipCooldownCache->isHit()) {
                $rawCooldownExpiresAt = $ipCooldownCache->getMetadata()[CacheItem::METADATA_EXPIRY] ?? null;
                $cooldownExpiresAt = is_int($rawCooldownExpiresAt)
                    ? CarbonImmutable::createFromTimestamp($rawCooldownExpiresAt)
                    : null;

                throw new HttpTooManyRequestsException($request, null, $cooldownExpiresAt);
            }
        }

        // - On récupère l'adresse e-mail envoyée.
        $email = $request->getParsedBodyParam('email');
        if (!V::notEmpty()->email(checkDns: false)->validate($email)) {
            throw new HttpBadRequestException($request, 'Invalid email.');
        }

        $now = CarbonImmutable::now();
        $resetCodeCacheKey = sprintf('password-reset.code.%s', md5($email));
        $resetCodeCache = $this->cache->getItem($resetCodeCacheKey);

        $user = User::fromEmail($email);
        $expiresAt = $now->addMinutes(self::RESET_TIMEOUT);
        $code = $user !== null && $user->group !== Group::ADMINISTRATION
            ? Str::numericCode()
            : null;

        // - Deux cas de figure:
        //   - L'email correspond bien à un utilisateur dont le mot de passe
        //     est réinitialisable, on sauve donc le code en cache et on envoi
        //     un mail avec ce code.
        //   - L'email ne correspond pas à un utilisateur dont le mot de passe
        //     est réinitialisable, on sauve un code vide dans le cache pour
        //     enregistrer la tentative et faire comme si c'était un vrai reset.
        $resetCodeCache->set([
            'email' => $email,
            'code' => $code,
            'attempts' => 0,
            'createdAt' => $now->getTimestamp(),
        ]);
        $resetCodeCache->expiresAt($expiresAt);
        $this->cache->save($resetCodeCache);

        // - On envoie le mail de réinitialisation.
        if ($code !== null) {
            $mail = new Mails\PasswordReset($code, self::RESET_TIMEOUT);
            $this->mailer->sendMailable($email, $mail);
        }

        // - Enregistre la demande dans le cache de cooldown.
        $cooldownExpiresAt = $now->addSeconds(self::RESET_COOLDOWN_IP_TTL);
        if ($ipCooldownCache !== null) {
            $ipCooldownCache->set(true);
            $ipCooldownCache->expiresAt($cooldownExpiresAt);
            $this->cache->save($ipCooldownCache);
        }

        $result = ['resend_at' => $cooldownExpiresAt, 'expires_at' => $expiresAt];
        return $response->withJson($result, StatusCode::STATUS_OK);
    }

    public function verifyReset(Request $request, Response $response): ResponseInterface
    {
        // - On récupère l'adresse e-mail envoyée.
        $email = $request->getParsedBodyParam('email');
        $code = $request->getParsedBodyParam('code');
        if (!V::notEmpty()->email(checkDns: false)->validate($email) || empty($code)) {
            throw new HttpBadRequestException($request);
        }
        $user = User::fromEmail($email);

        $resetCodeCacheKey = sprintf('password-reset.code.%s', md5($email));
        $resetCodeCache = $this->cache->getItem($resetCodeCacheKey);

        /** @var array{ email: string, code: string | null, attempts: int, createdAt: int }|null $resetCodeData */
        $resetCodeData = $resetCodeCache->get();

        // - Si le code n'est plus dans le cache ou si le code est marqué à non `null` dans le cache
        //   (donc un utilisateur existait au moment de la génération) et qu'on ne trouve plus
        //   l'utilisateur ou que c'est un administrateur, le code est obsolète.
        $hasMatchingUser = $user !== null && $user->group !== Group::ADMINISTRATION;
        if (
            $resetCodeData === null ||
            $email !== $resetCodeData['email'] ||
            ($resetCodeData['code'] !== null && !$hasMatchingUser)
        ) {
            $this->cache->deleteItem($resetCodeCacheKey);
            throw new ApiBadRequestException(ApiErrorCode::PASSWORD_RESET_OBSOLETE_CODE);
        }

        // - S'il a dépassé le nombre de tentatives autorisées...
        if ($resetCodeData['attempts'] >= self::RESET_MAX_CODE_ATTEMPTS) {
            throw new ApiTooManyRequestsException(ApiErrorCode::PASSWORD_RESET_TOO_MANY_ATTEMPTS);
        }

        // - Si le code ne correspond pas ou qu'on a aucun utilisateur qui correspond à
        //   l'adresse e-mail* ou que ce n'était pas le cas au moment de la demande* ...
        //   *: Ces cas sont gérés pour simuler un flow identique quand un utilisateur
        //      existe ou non et ainsi éviter de dévoiler l'existence des comptes.
        $isValidCode = (
            $hasMatchingUser &&
            $resetCodeData['code'] !== null &&
            $code === $resetCodeData['code']
        );
        if (!$isValidCode) {
            // - On enregistre la tentative, pour éviter le brute-force.
            $resetCodeCache->set(array_replace($resetCodeData, [
                'attempts' => $resetCodeData['attempts'] + 1,
            ]));
            $resetCodeCache->expiresAt(
                CarbonImmutable::createFromTimestamp($resetCodeData['createdAt'])
                    ->addMinutes(self::RESET_TIMEOUT),
            );
            $this->cache->save($resetCodeCache);

            // - On lève une exception spécifique.
            throw new ApiBadRequestException(ApiErrorCode::PASSWORD_RESET_WRONG_CODE);
        }

        // - On supprime l'entrée de cache.
        $this->cache->deleteItem($resetCodeCacheKey);

        // - On génère un token permettant à l'utilisateur d'effectuer une réinitialisation.
        $expiresAt = CarbonImmutable::now()->addMinutes(self::RESET_PASSWORD_CHANGE_TIMEOUT);
        $token = Token::generate($request, TokenScope::PASSWORD_RESET, $expiresAt, [
            'uid' => (string) Str::uuid(),
            'email' => $user->email,
            'sub' => $user->id,
        ]);

        $result = ['token' => $token, 'expires_at' => $expiresAt];
        return $response->withJson($result, StatusCode::STATUS_OK);
    }

    public function finalizeReset(Request $request, Response $response): ResponseInterface
    {
        // - On vérifie qu'on a bien un token de réinitialisation.
        $token = trim($request->getNormalizedHeaderLine('X-Reset-Token'));
        if (empty($token)) {
            throw new HttpForbiddenException($request);
        }

        // - On décode le token.
        try {
            $schema = new KeySet(
                new Rule\Key('uid', V::uuid()),
                new Rule\Key('email', V::email(checkDns: false)),
                new Rule\Key('sub', V::intType()),
            );
            $payload = Token::decode($request, TokenScope::PASSWORD_RESET, $token, $schema);
        } catch (\RuntimeException | \DomainException) {
            throw new HttpForbiddenException($request);
        }

        // - On empêche le replay avec le même token.
        $usedTokenCacheKey = sprintf('password-reset.used-token.%s', $payload['uid']);
        $usedTokenCache = $this->cache->getItem($usedTokenCacheKey);
        if ($usedTokenCache->isHit()) {
            throw new HttpForbiddenException($request);
        }

        // - Nouveau mot de passe.
        $postData = (array) $request->getParsedBody();
        if (!array_key_exists('password', $postData)) {
            throw new HttpBadRequestException($request, "No data was provided.");
        }

        $user = User::find($payload['sub']);
        if ($user === null || $user->email !== $payload['email']) {
            throw new HttpForbiddenException($request);
        }

        $user->password = $postData['password'];
        $user->save();

        // - Token anti-replay.
        $usedTokenCache->set(true);
        $usedTokenCache->expiresAfter(self::RESET_PASSWORD_CHANGE_TIMEOUT * 60);
        $this->cache->save($usedTokenCache);

        return $response->withStatus(StatusCode::STATUS_NO_CONTENT);
    }
}
