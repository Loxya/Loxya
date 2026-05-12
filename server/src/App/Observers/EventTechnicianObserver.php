<?php
declare(strict_types=1);

namespace Loxya\Observers;

use Loxya\Config\Enums\Feature;
use Loxya\Models\EventTechnician;

final class EventTechnicianObserver
{
    public bool $afterCommit = true;

    public function created(EventTechnician $eventTechnician): void
    {
        debug(
            "[Event] Technicien #%d assigné à l'événement #%d.",
            $eventTechnician->technician->id,
            $eventTechnician->event->id,
        );

        if (!isFeatureEnabled(Feature::TECHNICIANS)) {
            return;
        }

        //
        // - Insertion du poste dans l'événement s'il n'est pas déjà présent.
        //

        if ($eventTechnician->role_id !== null) {
            $eventTechnician->event->positions()->firstOrCreate(
                [
                    'event_id' => $eventTechnician->event_id,
                    'role_id' => $eventTechnician->role_id,
                ],
                ['is_mandatory' => false],
            );
        }
    }

    public function updated(EventTechnician $eventTechnician): void
    {
        debug(
            "[Event] Modification de l'assignation du technicien #%d sur l'événement #%d.",
            $eventTechnician->technician->id,
            $eventTechnician->event->id,
        );

        if (!isFeatureEnabled(Feature::TECHNICIANS)) {
            return;
        }

        //
        // - Insertion du poste dans l'événement s'il n'est pas déjà présent.
        //

        if ($eventTechnician->role_id !== null) {
            $eventTechnician->event->positions()->firstOrCreate(
                [
                    'event_id' => $eventTechnician->event_id,
                    'role_id' => $eventTechnician->role_id,
                ],
                ['is_mandatory' => false],
            );
        }
    }
}
