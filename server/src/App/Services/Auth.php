<?php
declare(strict_types=1);

namespace Loxya\Services;

use Fig\Http\Message\StatusCodeInterface as StatusCode;
use Illuminate\Support\Collection;
use Loxya\Config\Config;
use Loxya\Events\LoginEvent;
use Loxya\Http\Request;
use Loxya\Middlewares\Acl;
use Loxya\Models\Enums\Group;
use Loxya\Models\User;
use Loxya\Services\Auth\Contracts\AuthenticatorInterface;
use Loxya\Services\Auth\Contracts\RemoteAuthenticatorInterface;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Server\RequestHandlerInterface as RequestHandler;
use Slim\Exception\HttpUnauthorizedException;
use Slim\Psr7\Response;
use Slim\Routing\RouteContext;

final class Auth
{
    private static User|null $user = null;

    /** @var Collection<array-key, AuthenticatorInterface> */
    private Collection $authenticators;

    /**
     * Constructeur.
     *
     * @param AuthenticatorInterface[] $authenticators
     */
    public function __construct(array $authenticators)
    {
        $this->authenticators = new Collection($authenticators);
    }

    public function middleware(Request $request, RequestHandler $handler)
    {
        if (!$this->needsAuthentication($request)) {
            $this->authenticate($request);
            return $handler->handle($request);
        }

        if (!$this->authenticate($request)) {
            return $this->unauthenticated($request, $handler);
        }

        return $handler->handle($request);
    }

    /**
     * Permet de déconnecter l'utilisateur courant.
     *
     * NOTE: Cette méthode ne devrait jamais être utilisée dans un contexte stateless.
     *
     * @param string|null $returnTo Si ce paramètre est spécifié, la déconnexion sera considérée comme
     *                              une déconnexion "complète" et la méthode retournera une réponse
     *                              {@link ResponseInterface} de redirection. La destination de cette
     *                              redirection dépendra de l'état de connexion de l'utilisateur sur
     *                              les systèmes de connexion distant activés.
     *                              Voir {@link RemoteAuthenticatorInterface::logout()} à ce sujet.
     *                              Quoi qu'il en soit, l'utilisateur sera, à la fin du processus de
     *                              déconnexion, redirigé vers l'URL spécifiée dans ce paramètre.
     *                              Si ce paramètre est passé à `null`, il n'y aura pas de redirection
     *                              de retournée et l'utilisateur sera uniquement déconnecté "localement"
     *                              (= sur Loxya).
     *
     * @return ?ResponseInterface Si c'est une déconnexion complète (voir `$returnTo` ci-dessus), une
     *                            réponse de type "redirection" sera retournée par cette méthode.
     *                            Sinon, `null` sera retourné.
     */
    public function logout(?string $returnTo): ?ResponseInterface
    {
        $isFullLogout = $returnTo !== null;

        if (!static::isAuthenticated()) {
            return $isFullLogout
                ? (new Response(StatusCode::STATUS_FOUND))
                    ->withHeader('Location', $returnTo)
                : null;
        }

        // - Récupère le premier authentifieur externe qui considère l'utilisateur
        //   comme authentifié via son système d'authentification distant.
        //
        // NOTE: S'il y en a plusieurs dans ce cas, malheureusement, seul le
        //       premier sera "complètement" déconnecté car on ne peut pas rediriger
        //       vers deux URLs en même temps (ce cas de figure étant assez rare étant
        //       donné qu'il faut qu'un utilisateur soit connecté sur plusieurs système
        //       distants en même temps et que Loxya en ait conscience).
        /** @var ?RemoteAuthenticatorInterface $remoteAuthenticator */
        $remoteAuthenticator = $isFullLogout
            ? $this->authenticators->first(static fn (AuthenticatorInterface $authenticator) => (
                $authenticator->isEnabled() &&
                $authenticator instanceof RemoteAuthenticatorInterface &&
                $authenticator->isAuthenticated()
            ))
            : null;

        // - Dispatch le logout aux authenticators.
        foreach ($this->authenticators as $auth) {
            if (!$auth->isEnabled()) {
                continue;
            }

            // - Si c'est une déconnexion "totale" et que c'est l'authentifieur
            //   externe qui a été choisi pour la déconnexion distante, on le
            //   passe car il sera déconnecté complètement plus bas.
            if ($isFullLogout && $auth === $remoteAuthenticator) {
                continue;
            }

            // - Sinon, on supprime les données d'authentification
            //   persistées localement.
            $auth->clearPersistentData();
        }

        // - Reset l'utilisateur connecté courant.
        static::reset();

        // - Si on a un authentifieur qui nécessite un logout avec redirection,
        //   on l'appelle maintenant que l'on a déconnecté localement les autres.
        if ($isFullLogout && $remoteAuthenticator !== null) {
            // - /!\ L'utilisateur va potentiellement être redirigé hors de Loxya !!!
            return $remoteAuthenticator->logout($returnTo);
        }

        return $isFullLogout
            ? (new Response(StatusCode::STATUS_FOUND))
                ->withHeader('Location', $returnTo)
            : null;
    }

    // ------------------------------------------------------
    // -
    // -    Méthodes publiques statiques
    // -
    // ------------------------------------------------------

    public static function user(): User|null
    {
        return static::$user;
    }

    public static function isAuthenticated(): bool
    {
        return (bool) static::user();
    }

    public static function is($groups): bool
    {
        $groups = (array) $groups;

        if (static::isAuthenticated()) {
            return in_array(static::user()->group, $groups, true);
        }

        // - S'il n'est pas connecté, il fait partie du groupe des anonymes.
        if (in_array(Group::ANONYMOUS, $groups, true)) {
            return true;
        }

        // - Si on est en mode CLI, on considère que le process
        //   courant a un accès administrateur.
        return isCli() && in_array(Group::ADMINISTRATION, $groups, true);
    }

    public static function reset(): void
    {
        static::$user = null;
        container('i18n')->refreshLanguage();
    }

    // ------------------------------------------------------
    // -
    // -    Méthodes internes
    // -
    // ------------------------------------------------------

    protected function needsAuthentication(Request $request): bool
    {
        // - HTTP Method: OPTIONS => On laisse passer.
        if ($request->isOptions()) {
            return false;
        }

        $route = RouteContext::fromRequest($request)->getRoute();
        return $route && !Acl::isRouteAllowed(null, $route);
    }

    protected function authenticate(Request $request): User|null
    {
        if (static::isAuthenticated()) {
            return static::user();
        }

        // - On met les instances de JWT en premier.
        $authenticators = (new Collection($this->authenticators))
            ->sort(static function (AuthenticatorInterface $a, AuthenticatorInterface $b) {
                $aIsJwt = $a instanceof Auth\JWT;
                $bIsJwt = $b instanceof Auth\JWT;

                return $aIsJwt !== $bIsJwt ? ($aIsJwt ? -1 : 1) : 0;
            });

        // - On utilise les authenticators pour identifier l'utilisateur.
        $auth = null;
        foreach ($authenticators as $authenticator) {
            if (!$authenticator->isEnabled()) {
                continue;
            }

            $foundUser = $authenticator->getUser($request);
            if ($foundUser === null) {
                continue;
            }

            // - Si l'utilisateur est trouvé, on s'arrête là.
            if ($foundUser instanceof User) {
                $auth = [
                    'user' => $foundUser,
                    'authenticator' => $authenticator,
                ];
                break;
            }
        }

        if ($auth !== null) {
            static::$user = $auth['user'];

            // - L'utilisateur identifié a changé, on demande l'actualisation
            //   de la langue détecté par l'i18n car la valeur a pu changer...
            container('i18n')->refreshLanguage();

            // - Si on est dans un contexte stateful et que ce n'est pas l'authentification JWT qui
            //   a identifié, alors l'utilisateur vient d'être identifié par un tiers...
            if (!$request->isApi() && !($auth['authenticator'] instanceof Auth\JWT)) {
                // - ... On persiste donc l'authentification de l'utilisateur pour que
                //       celui-ci puisse être connu par le front-end.
                Auth\JWT::registerSessionToken($request, $auth['user']);

                // - ... On trigger aussi l'event de login si c'est une connexion.
                if ($auth['user'] instanceof User) {
                    LoginEvent::dispatch($auth['user']);
                }
            }

            return $auth['user'];
        }

        return null;
    }

    protected function unauthenticated(Request $request, RequestHandler $handler): ResponseInterface
    {
        $isLoginRequest = $request->match(['/login', '/auth']);
        if ($isLoginRequest) {
            return $handler->handle($request);
        }

        if (!$request->isXhr() && !$request->isApi()) {
            $url = (string) Config::getBaseUri()->withPath('/login');

            return (new Response(StatusCode::STATUS_FOUND))
                ->withHeader('Location', $url);
        }

        throw new HttpUnauthorizedException($request);
    }
}
