<?php
declare(strict_types=1);

namespace Loxya\Observers;

use Illuminate\Support\Carbon;
use Loxya\Models\Enums\Group;
use Loxya\Models\Event;
use Loxya\Models\User;
use Loxya\Services\Cache;

final class UserObserver
{
    public $afterCommit = true;

    public function created(User $user): void
    {
        debug('[Event] Utilisateur "%s" ajouté.', $user->full_name);

        /** @var Cache $cache */
        $cache = container('cache');

        //
        // - On supprime la potentielle procédure de réinitialisation de
        //   mot de passe déjà en cours avec la nouvelle adresse e-mail de
        //   l'utilisateur.
        //

        $cache->deleteItem(sprintf('password-reset.code.%s', md5($user->email)));
    }

    public function updated(User $user): void
    {
        debug('[Event] Utilisateur "%s" mis à jour.', $user->full_name);

        /** @var Cache $cache */
        $cache = container('cache');

        //
        // - Si l'utilisateur a changé d'adresse e-mail ou de mot de passe ou bien
        //   qu'il est passé au group administrateur, on supprime les potentielles
        //   procédures de réinitialisation de mot de passe avec l'ancienne ou la
        //   nouvelle adresse e-mail de l'utilisateur.
        //

        if (
            $user->wasChanged('email', 'password') ||
            ($user->wasChanged('group') && $user->group === Group::ADMINISTRATION)
        ) {
            $emails = [$user->email];
            if ($user->wasChanged('email')) {
                $emails[] = $user->getPrevious('email');
            }

            foreach ($emails as $email) {
                $cache->deleteItem(sprintf('password-reset.code.%s', md5($email)));
            }
        }
    }

    public function deleting(User $user): void
    {
        $isSoftDeleting = !$user->isForceDeleting();
        if (!$isSoftDeleting) {
            debug("[Event] Utilisateur #%s supprimé définitivement.", $user->id);
        } else {
            debug("[Event] Utilisateur #%s supprimé.", $user->id);
        }

        /** @var Cache $cache */
        $cache = container('cache');

        //
        // - On supprime le chef de projet des événement à
        //   venir lorsqu'il est soft-delete.
        //

        if ($isSoftDeleting) {
            Event::query()
                ->where('mobilization_start_date', '>', Carbon::now())
                ->whereBelongsTo($user, 'manager')
                ->update(['manager_id' => null]);
        }

        //
        // - On supprime les éventuelles procédures de réinitialisation
        //   de mot de passe liées à l'adresse e-mail de l'utilisateur.
        //

        $cache->deleteItem(sprintf('password-reset.code.%s', md5($user->email)));
    }

    public function deleted(User $user): void
    {
        //
        // - Suppression de la Person associée à l'utilisateur si elle n'est
        //   pas utilisée ailleurs (bénéficiaire ou technicien)
        //

        if ($user->isForceDeleting()) {
            $user->person?->deleteIfOrphan(false);
        }
    }
}
