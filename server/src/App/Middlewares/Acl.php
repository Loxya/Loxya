<?php
declare(strict_types=1);

namespace Loxya\Middlewares;

use Loxya\Config;
use Loxya\Models\Enums\Group;
use Loxya\Models\User;
use Loxya\Services\Auth;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface as RequestHandler;
use Slim\Exception\HttpForbiddenException;
use Slim\Interfaces\RouteInterface;
use Slim\Routing\RouteContext;

final class Acl implements MiddlewareInterface
{
    public function process(ServerRequestInterface $request, RequestHandler $handler): ResponseInterface
    {
        if (!($request instanceof \Loxya\Http\Request)) {
            throw new \InvalidArgumentException('Not a Loxya request.');
        }

        if ($request->isOptions()) {
            return $handler->handle($request);
        }

        $route = RouteContext::fromRequest($request)->getRoute();
        if (!$route || !static::isRouteAllowed(Auth::user(), $route)) {
            throw new HttpForbiddenException($request);
        }

        return $handler->handle($request);
    }

    public static function isRouteAllowed(User|null $user, RouteInterface $route): bool
    {
        $group = $user instanceof User ? $user->group : Group::ANONYMOUS;

        $denyList = '*';
        $allowList = Config\Acl::LIST[$group] ?? [];
        if (is_array($allowList) && array_key_exists('allow', $allowList)) {
            $denyList = $allowList['deny'] ?? (
                $allowList['allow'] === '*' ? [] : '*'
            );
            $allowList = $allowList['allow'];
        }

        if (($allowList === '*' && $denyList === '*') || ($allowList !== '*' && $denyList !== '*')) {
            throw new \LogicException('Either `allow` or `deny` list should use wildcard.');
        }
        if (!is_array($allowList) && !is_array($denyList)) {
            throw new \LogicException('Either `allow` or `deny` list should be an array.');
        }
        /** @var array<array-key, string|string[]>|'*' $allowList */
        /** @var array<array-key, string|string[]>|'*' $denyList */

        // - Si on est en mode "Tout autorisé, interdictions au cas par cas" et que
        //   la liste des interdictions est vide, on autorise, sinon si on est dans
        //   le mode inverse et que la liste des autorisations est vide, on interdit.
        // @phpstan-ignore-next-line varTag.nativeType
        if (($allowList === '*' && empty($denyList)) || empty($allowList)) {
            return $allowList === '*';
        }

        $fqn = $route->getCallable();

        // - Si le callable n'est pas un FQN (= `[controller]:[action]`), on cherche à utiliser le nom
        //   pour la route dans les ACLs, toutes les routes doivent avoir soit un FQN, soit un nom,
        //   sinon elles ne peuvent pas être autorisées.
        if (!is_string($fqn)) {
            $name = $route->getName();
            if (empty($name)) {
                throw new \LogicException(
                    "All routes must either contain a callable in text form (= FQN) or contain a name.\n" .
                    "Otherwise, these routes will always be blocked by the ACL.",
                );
            }

            // - Si on est en mode "Tout autorisé, interdictions au cas par cas" et que
            //   la route nommée n'est pas dans les interdictions, on autorise, sinon si
            //   on est dans le mode inverse et si la route nommée n'est PAS dans les
            //   autorisations, on interdit.
            return $allowList === '*'
                ? !in_array($name, $denyList, true)
                : in_array($name, $allowList, true);
        }

        // - Sinon si le FQN est bien au format `[controller]:[action]`, on parse les composantes
        //   de celui-ci est on essai de trouver une valeur correspondante dans le tableau des ACLs.
        $callablePattern = '!^([^\:]+)Controller\:([a-zA-Z_\x7f-\xff][a-zA-Z0-9_\x7f-\xff]*)$!';
        if (!preg_match($callablePattern, $fqn, $matches)) {
            throw new \LogicException(
                "Unable to retrieve the Controller + Action from the route FQN.\n" .
                "Make sure you define the routes with the format `[Name]Controller:action`.",
            );
        }
        [$controller, $action] = [class_basename($matches[1]), $matches[2] ?? '__invoke'];

        // - Si on est en mode "Tout autorisé, interdictions au cas par cas" et
        //   que le controller ou l'action n'est pas dans les interdictions, on
        //   autorise.
        if ($allowList === '*') {
            return (
                !array_key_exists($controller, $denyList) ||
                !in_array($action, $denyList[$controller], true)
            );
        }

        // - ... sinon, si on est dans le mode inverse et le controller ou
        //   l'action n'est pas les routes autorisées, on interdit.
        return (
            array_key_exists($controller, $allowList) &&
            in_array($action, $allowList[$controller], true)
        );
    }
}
