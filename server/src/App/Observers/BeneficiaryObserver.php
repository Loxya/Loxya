<?php
declare(strict_types=1);

namespace Loxya\Observers;

use Loxya\Models\Beneficiary;

final class BeneficiaryObserver
{
    public bool $afterCommit = true;

    public function updated(Beneficiary $beneficiary): void
    {
        debug("[Event] Bénéficiaire #%s modifié.", $beneficiary->id);

        $this->onUpdateSyncBookingBilling($beneficiary);
    }

    public function deleted(Beneficiary $beneficiary): void
    {
        //
        // - Suppression de la Person associée au bénéficiaire si elle n'est
        //   pas utilisée ailleurs (utilisateur ou technicien)
        //

        if ($beneficiary->isForceDeleting()) {
            $beneficiary->person->deleteIfOrphan();
        }
    }

    // ------------------------------------------------------
    // -
    // -    Event sub-processing
    // -
    // ------------------------------------------------------

    private function onUpdateSyncBookingBilling(Beneficiary $beneficiary): void
    {
        if (!$beneficiary->wasChanged(['company_id', 'person_id'])) {
            return;
        }

        //
        // - S'il y a eu changement au niveau de la personne ou de la société liée,
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
