<?php
declare(strict_types=1);

namespace Loxya\Services\Auth\Contracts;

use Loxya\Http\Request;
use Loxya\Models\User;

interface AuthenticatorInterface
{
    /**
     * L'authenticator est t'il activé ?
     *
     * - Si `true`, l'authenticator sera utilisé pour tenter d'identifier l'utilisateur.
     * - Si `false`, l'authenticator ne sera pas utilisé.
     *
     * @return bool `true` si l'authenticator est activé, `false` sinon.
     */
    public function isEnabled(): bool;

    /**
     * Permet d'authentifier l'utilisateur en fonction de la requête courante.
     *
     * Cette méthode doit retourner une instance de l'utilisateur authentifié
     * si elle a pu le récupérer. Dans les autres cas elle doit retourner `null`
     * pour signifier qu'elle n'a pas pu identifier l'utilisateur.
     *
     * @param Request $request La requête courante.
     *
     * @return User|null L'utilisateur s'il a pu
     *                               être authentifié, `null` sinon.
     *
     * @throws \LogicException Si l'authentifieur n'est pas activé (@see {@link self::isEnabled()}).
     */
    public function getUser(Request $request): User|null;

    /**
     * Permet de supprimer les données d'identification persistées actuelles.
     * (Par exemple, supprimer la session ou le cookie qui permettent d'identifier l'utilisateur)
     *
     * Cette méthode est appelée lors de la déconnexion de l'utilisateur courant.
     *
     * @throws \LogicException Si l'authentifieur n'est pas activé (@see {@link self::isEnabled()}).
     */
    public function clearPersistentData(): void;
}
