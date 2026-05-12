<?php
declare(strict_types=1);

namespace Loxya\Observers;

use Loxya\Config\Enums\Feature;
use Loxya\Models\EventPosition;
use Loxya\Models\EventTechnician;

final class EventPositionObserver
{
    public bool $afterCommit = true;

    public function deleted(EventPosition $eventPosition): void
    {
        debug(
            "[Event] Poste #%d supprimé de l'événement #%d.",
            $eventPosition->id,
            $eventPosition->event->id,
        );

        if (!isFeatureEnabled(Feature::TECHNICIANS)) {
            return;
        }

        //
        // - Désaffectation du poste pour les éventuels techniciens
        //   assignés à l'événement avec ce poste.
        //

        EventTechnician::query()
            ->where('event_id', $eventPosition->event->id)
            ->where('role_id', $eventPosition->role_id)
            ->get()
            ->each
            ->delete();
    }
}
