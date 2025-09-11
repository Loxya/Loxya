<?php
declare(strict_types=1);

namespace Loxya\Listeners;

use Loxya\Events\LoginEvent;
use Loxya\Services\Cache;

final class LoginHandler
{
    public function handle(LoginEvent $event): void
    {
        $loggedUser = $event->user;

        /** @var Cache $cache */
        $cache = container('cache');

        //
        // - On supprime les éventuelles procédures de réinitialisation
        //   de mot de passe liées à l'adresse e-mail de l'utilisateur
        //   qui vient de se connecter.
        //

        $cache->deleteItem(sprintf('password-reset.code.%s', md5($loggedUser->email)));
    }
}
