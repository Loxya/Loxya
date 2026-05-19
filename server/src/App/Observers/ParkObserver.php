<?php
declare(strict_types=1);

namespace Loxya\Observers;

use Loxya\Models\Park;

final class ParkObserver
{
    public bool $afterCommit = true;

    public function deleting(Park $park): void
    {
        $isSoftDeleting = !$park->isForceDeleting();
        if (!$isSoftDeleting) {
            debug("[Event] Parc \"%s\" supprimé définitivement.", $park->name);
        } else {
            debug("[Event] Parc \"%s\" supprimé.", $park->name);
        }

        //
        // - Si un parc est supprimé, tout le matériel qu'il contient est
        //   aussi supprimé, on supprime donc le cache lié.
        //

        foreach ($park->materials as $material) {
            //
            // - Supprime le cache des bookables liés vu que le matériel va être supprimé en cascade.
            //

            //
            // -- Événements ...
            //

            foreach ($material->events as $event) {
                $event->invalidateCache([
                    'has_missing_materials',
                    'has_not_returned_materials',
                ]);
            }
        }
    }
}
