<?php
declare(strict_types=1);

namespace Loxya\Events;

use Loxya\Contracts\Dispatchable;
use Loxya\Models\User;

/**
 * Événement déclenché lors de la connexion d'un utilisateur.
 *
 * @method static array|null dispatch(User $user)
 */
final class LoginEvent extends Dispatchable
{
    /**
     * @param User             $user              L'utilisateur qui vient de se connecter.
     */
    public function __construct(
        public readonly User $user,
    ) {}
}
