<?php
declare(strict_types=1);

namespace Loxya\Observers;

use Brick\Math\BigDecimal as Decimal;
use Carbon\CarbonImmutable;
use Loxya\Config\Config;
use Loxya\Config\Enums\ReturnPolicy;
use Loxya\Models\Event;
use Loxya\Support\Period;

final class EventObserver
{
    public $afterCommit = true;

    public function created(Event $event): void
    {
        debug("[Event] Événement #%s ajouté.", $event->id);

        //
        // - Dans le doute, on supprime le cache de l'événement lors de sa création.
        //

        $event->invalidateCache();

        //
        // - On invalide le cache du matériel manquant des bookables voisins à celui qui vient d'être créé.
        //

        //
        // -- Événements ...
        //

        // Note: Sans la période de retard car seules les périodes nominales des
        //       événements sont pertinentes pour le calcul du matériel disponible.
        $neighborEvents = Event::inPeriod($event, withOverdue: false)->get();
        foreach ($neighborEvents as $neighborEvent) {
            $neighborEvent->invalidateCache('has_missing_materials');
        }
    }

    public function updated(Event $event): void
    {
        debug("[Event] Événement #%s modifié.", $event->id);

        $this->onUpdateSyncCache($event);
        $this->onUpdateSyncEventMaterials($event);
        $this->onUpdateSyncDepartureInventories($event);
        $this->onUpdateSyncReturnInventories($event);
    }

    public function restored(Event $event): void
    {
        debug("[Event] Événement #%s restauré.", $event->id);

        $this->onRestoreSyncCache($event);
    }

    public function deleting(Event $event): void
    {
        if ($event->isForceDeleting()) {
            debug("[Event] Événement #%s supprimé définitivement.", $event->id);
        } else {
            debug("[Event] Événement #%s supprimé.", $event->id);
        }

        //
        // - On invalide le cache de l'événement "soft-delete".
        //   (pour éviter une reprise de cache malheureuse lors d'un éventuel rétablissement)
        //

        $event->invalidateCache();

        //
        // - On invalide le cache du matériel manquant des bookables voisins à celui-ci.
        //

        //
        // -- Événements ...
        //

        // Note: Sans la période de retard car seules les périodes nominales des
        //       événements sont pertinentes pour le calcul du matériel disponible.
        $neighborEvents = Event::inPeriod($event, withOverdue: false)->get();
        foreach ($neighborEvents as $neighborEvent) {
            $neighborEvent->invalidateCache('has_missing_materials');
        }
    }

    public function deleted(Event $event): void
    {
        if (!$event->isForceDeleting()) {
            return;
        }

        //
        // - Supprime les factures et devis liés, ainsi que les entrées d'historique.
        //   (Doit être géré manuellement car tables polymorphes)
        //

        $event->invoices->each->delete();
        $event->estimates->each->delete();
    }

    // ------------------------------------------------------
    // -
    // -    Event sub-processing
    // -
    // ------------------------------------------------------

    private function onUpdateSyncCache(Event $event): void
    {
        //
        // - On invalide le cache du présent événement.
        //

        $event->invalidateCache();

        //
        // - On invalide le cache du matériel manquant des bookables voisins à celui qui vient
        //   d'être modifié lors de la modification de la période de mobilisation de l'événement
        //   (anciens voisins ou nouveaux, peu importe) ou la modification du statut d'inventaire.
        //

        $hasRelevantChanges = $event->wasChanged([
            'mobilization_start_date',
            'mobilization_end_date',
            'is_departure_inventory_done',
            'is_return_inventory_done',
            'return_inventory_datetime',
            'is_archived',
        ]);
        if (!$hasRelevantChanges) {
            return;
        }
        $oldData = $event->getPrevious();

        $oldMobilizationPeriod = new Period(
            $oldData['mobilization_start_date'],
            $oldData['mobilization_end_date'],
        );
        $oldPeriod = $oldMobilizationPeriod;
        $useManualReturn = Config::get('returnPolicy') === ReturnPolicy::MANUAL;
        if ($useManualReturn && $oldMobilizationPeriod->isPast() && $event->has_materials) {
            // - Si l'inventaire de retour était fait et que la date
            //   d'inventaire était postérieure à la fin de la mobilisation,
            //   il y avait un retard.
            if (
                $oldData['is_return_inventory_done'] &&
                $oldData['return_inventory_datetime'] !== null &&
                $oldMobilizationPeriod->getEndDate()->isBefore(
                    $oldData['return_inventory_datetime'],
                )
            ) {
                $oldPeriod = new Period(
                    $oldData['mobilization_start_date'],
                    CarbonImmutable::parse($oldData['return_inventory_datetime'])
                        ->roundMinutes(15, 'ceil'),
                );
            }

            // - Sinon, si l'événement n'était pas archivé et qu'il n'y avait pas
            //   d'inventaire de retour, il n'y avait pas de date de fin.
            if (!$oldData['is_archived'] && !$oldData['is_return_inventory_done']) {
                $oldPeriod = new Period($oldData['mobilization_start_date'], null);
            }
        }

        //
        // -- Événements ...
        //

        // Note: Sans la période de retard car seules les périodes nominales des
        //       événements sont pertinentes pour le calcul du matériel disponible.
        $newNeighborEvents = Event::inPeriod($event, withOverdue: false)->get();
        $oldNeighborEvents = Event::inPeriod($oldPeriod, withOverdue: false)->get();

        $neighborEvents = $oldNeighborEvents->merge($newNeighborEvents)
            ->unique('id')
            ->values();

        foreach ($neighborEvents as $neighborEvent) {
            $neighborEvent->invalidateCache('has_missing_materials');
        }
    }

    private function onUpdateSyncEventMaterials(Event $event): void
    {
        // - Si la facturabilité ou la période d'opération de l'événement n'ont pas changés, on ne va pas plus loin.
        $hasChangedIsBillable = $event->wasChanged(['is_billable']);
        $hasChangedOperationPeriod = $event->wasChanged(['operation_start_date', 'operation_end_date']);
        if (!$hasChangedOperationPeriod && !$hasChangedIsBillable) {
            return;
        }

        dbTransaction(static function () use ($event, $hasChangedOperationPeriod, $hasChangedIsBillable) {
            foreach ($event->materials as $eventMaterial) {
                $material = $eventMaterial->material;

                if ($hasChangedIsBillable) {
                    $eventMaterial->unit_price = !$event->is_billable ? null : (
                        $material->rental_price ?? Decimal::zero()
                    );
                    $eventMaterial->discount_rate = !$event->is_billable ? null : (
                        Decimal::zero()
                    );
                    $eventMaterial->taxes = !$event->is_billable ? null : (
                        $material->tax?->asFlatArray()
                    );
                }

                if ($hasChangedIsBillable || $hasChangedOperationPeriod) {
                    $durationDays = $event->operation_period->asDays();
                    $eventMaterial->degressive_rate = !$event->is_billable ? null : (
                        $material->degressive_rate?->computeForDays($durationDays)
                            // - Pas de dégressivité.
                            ?? $durationDays
                    );
                }

                $eventMaterial->save(['validate' => false]);
            }

            if ($hasChangedIsBillable && !$event->is_billable) {
                $event->extras->each->delete();
            }
        });
    }

    private function onUpdateSyncDepartureInventories(Event $event): void
    {
        // - Si les dates de l'événement n'ont pas changées, on ne va pas plus loin.
        $dateFields = [
            'operation_start_date',
            'operation_end_date',
            'mobilization_start_date',
            'mobilization_end_date',
        ];
        if (!$event->wasChanged($dateFields)) {
            return;
        }

        // - Si la période d'inventaire est "ouverte", on laisse passer.
        if ($event->is_departure_inventory_period_open) {
            return;
        }

        // - Si la période d'inventaire départ n'est pas ouverte, on supprime l'inventaire.
        dbTransaction(static function () use ($event) {
            $event->is_departure_inventory_done = false;
            $event->departure_inventory_author_id = null;
            $event->departure_inventory_datetime = null;
            $event->saveQuietly(['validate' => false]);
            $event->refresh();

            foreach ($event->materials as $eventMaterial) {
                $eventMaterial->quantity_departed = null;
                $eventMaterial->departure_comment = null;
                $eventMaterial->save(['validate' => false]);
            }
        });

        // - On trigger le refresh du cache.
        $this->onUpdateSyncCache($event);
    }

    private function onUpdateSyncReturnInventories(Event $event): void
    {
        // - Si les dates  de l'événement n'ont pas changées, on ne va pas plus loin.
        $dateFields = [
            'operation_start_date',
            'operation_end_date',
            'mobilization_start_date',
            'mobilization_end_date',
        ];
        if (!$event->wasChanged($dateFields)) {
            return;
        }

        // - Si la période d'inventaire est "ouverte", on laisse passer.
        if ($event->is_return_inventory_period_open) {
            return;
        }

        // - Si la période d'inventaire de retour n'est pas ouverte, on supprime l'inventaire.
        dbTransaction(static function () use ($event) {
            $event->is_archived = false;
            $event->is_return_inventory_done = false;
            $event->return_inventory_author_id = null;
            $event->return_inventory_datetime = null;
            $event->saveQuietly(['validate' => false]);
            $event->refresh();

            foreach ($event->materials as $eventMaterial) {
                $eventMaterial->quantity_returned = null;
                $eventMaterial->quantity_returned_broken = null;
                $eventMaterial->save(['validate' => false]);
            }
        });

        // - On trigger le refresh du cache.
        $this->onUpdateSyncCache($event);
    }

    private function onRestoreSyncCache(Event $event): void
    {
        //
        // - Dans le doute, on supprime le cache de l'événement lors de son rétablissement.
        //

        $event->invalidateCache();

        //
        // - On invalide le cache du matériel manquant des bookables voisins à celui
        //   qui vient d'être restauré.
        //

        //
        // -- Événements ...
        //

        // Note: Sans la période de retard car seules les périodes nominales des
        //       événements sont pertinentes pour le calcul du matériel disponible.
        $neighborEvents = Event::inPeriod($event, withOverdue: false)->get();
        foreach ($neighborEvents as $neighborEvent) {
            $neighborEvent->invalidateCache('has_missing_materials');
        }
    }
}
