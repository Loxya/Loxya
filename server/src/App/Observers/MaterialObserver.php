<?php
declare(strict_types=1);

namespace Loxya\Observers;

use Loxya\Models\Material;

final class MaterialObserver
{
    public bool $afterCommit = true;

    public function updated(Material $material): void
    {
        debug("[Event] Matériel #%s mis à jour.", $material->id);

        $this->onUpdateSyncCache($material);
    }

    public function restored(Material $material): void
    {
        debug("[Event] Matériel #%s restauré.", $material->id);

        //
        // - Supprime le cache des bookable liés lors de la restauration du matériel.
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

    public function deleting(Material $material): void
    {
        $isSoftDeleting = !$material->isForceDeleting();
        if (!$isSoftDeleting) {
            debug("[Event] Matériel #%s supprimé définitivement.", $material->id);
        } else {
            debug("[Event] Matériel #%s supprimé.", $material->id);
        }

        //
        // - Supprime le cache des bookables liés lors de la suppression du matériel.
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

    // ------------------------------------------------------
    // -
    // -    Event sub-processing
    // -
    // ------------------------------------------------------

    private function onUpdateSyncCache(Material $material): void
    {
        if (!$material->wasChanged(['stock_quantity', 'out_of_order_quantity'])) {
            debug('-> Pas de changement dans les quantités.');
            return;
        }

        //
        // -- Événements ...
        //

        foreach ($material->events as $event) {
            $event->invalidateCache('has_missing_materials');
        }
    }
}
