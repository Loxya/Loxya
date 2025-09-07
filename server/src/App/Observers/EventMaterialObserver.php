<?php
declare(strict_types=1);

namespace Loxya\Observers;

use Illuminate\Database\Eloquent\Builder;
use Loxya\Models\Event;
use Loxya\Models\EventMaterial;

final class EventMaterialObserver
{
    public $afterCommit = true;

    public function created(EventMaterial $eventMaterial): void
    {
        $this->syncCache($eventMaterial);
    }

    public function updated(EventMaterial $eventMaterial): void
    {
        $this->syncCache($eventMaterial);
    }

    public function deleting(EventMaterial $eventMaterial): void
    {
        $this->syncCache($eventMaterial);
    }

    public function deleted(EventMaterial $eventMaterial): void
    {
        $this->onDeleteSyncInventories($eventMaterial);
    }

    // ------------------------------------------------------
    // -
    // -    Event sub-processing
    // -
    // ------------------------------------------------------

    private function onDeleteSyncInventories(EventMaterial $eventMaterial): void
    {
        $event = $eventMaterial->event;

        // - Si aucun inventaire n'a été fait, on a rien à faire.
        if (!$event->is_departure_inventory_done && !$event->is_return_inventory_done) {
            return;
        }

        // - S'il reste du matériel dans l'événement, on ne fait rien.
        if (!$event->materials->isEmpty()) {
            return;
        }

        // - ... Sinon, on reset les inventaires.
        $event->is_departure_inventory_done = false;
        $event->departure_inventory_author_id = null;
        $event->departure_inventory_datetime = null;
        $event->is_return_inventory_done = false;
        $event->return_inventory_author_id = null;
        $event->return_inventory_datetime = null;
        $event->save();
    }

    private function syncCache(EventMaterial $eventMaterial): void
    {
        $event = $eventMaterial->event;
        $material = $eventMaterial->material;

        // - Edge case: L'event n'est pas complet => On invalide tout le cache des bookables.
        if (!$event || !$material) {
            // phpcs:ignore Generic.Files.LineLength
            debug("[Event] Le matériel d'un événement a été modifié mais il n'a pas été possible de récupérer les modèles liés.");
            debug($eventMaterial->getAttributes());
            container('cache')->invalidateTags([
                Event::getModelCacheKey(),
            ]);
            return;
        }

        debug("[Event] Du matériel de l'événement #%s a été modifié.", $event->id);

        //
        // - On invalide le cache dépendant de la liste de matériel dans l'événement lié.
        //

        $event->invalidateCache([
            'has_missing_materials',
            'has_not_returned_materials',
        ]);

        //
        // - On invalide le cache des autres bookables ayant le matériel lié parmi leurs "dépendances".
        //

        //
        // -- Événements ...
        //

        /** @var Event[] $otherEvents */
        $otherEvents = $material->events()
            ->where($event->qualifyColumn('id'), '<>', $event->id)
            ->where(static function (Builder $eventQuery) use ($event) {
                // Note: Sans la période de retard car seules les périodes nominales des
                //       événements sont pertinentes pour le calcul du matériel disponible.
                /** @var Builder|Event $eventQuery */
                $eventQuery->inPeriod($event, withOverdue: false);
            })
            ->get();

        foreach ($otherEvents as $otherEvent) {
            $otherEvent->invalidateCache('has_missing_materials');
        }
    }
}
