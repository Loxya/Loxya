<?php
declare(strict_types=1);

namespace Loxya\Observers;

use Loxya\Models\Person;

final class PersonObserver
{
    public bool $afterCommit = true;

    public function updated(Person $person): void
    {
        $this->onUpdateSyncBookingBilling($person);
    }

    // ------------------------------------------------------
    // -
    // -    Event sub-processing
    // -
    // ------------------------------------------------------

    private function onUpdateSyncBookingBilling(Person $person): void
    {
        if (!$person->wasChanged(['country'])) {
            return;
        }

        $beneficiary = $person->beneficiary;
        if ($beneficiary === null || $beneficiary->company !== null) {
            return;
        }

        //
        // - S'il y a eu changement au niveau du pays de la personne,
        //   il y a potentiellement un impact sur la facturation des bookings.
        //

        //
        // -- Événements ...
        //

        foreach ($beneficiary->events as $event) {
            if (!$event->is_billable || $event->mainBeneficiary?->id !== $beneficiary->id) {
                continue;
            }
            $event->resynchronizeTaxes();
        }
    }
}
