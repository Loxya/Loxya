<?php
declare(strict_types=1);

namespace Loxya\Observers;

use Loxya\Models\Company;

final class CompanyObserver
{
    public bool $afterCommit = true;

    public function updated(Company $company): void
    {
        $this->onUpdateSyncBookingBilling($company);
    }

    // ------------------------------------------------------
    // -
    // -    Event sub-processing
    // -
    // ------------------------------------------------------

    private function onUpdateSyncBookingBilling(Company $company): void
    {
        if (!$company->wasChanged(['country', 'vat_number'])) {
            return;
        }

        //
        // - S'il y a eu changement au niveau du numéro de T.V.A. ou du pays,
        //   il y a potentiellement un impact sur la facturation des bookings.
        //

        foreach ($company->beneficiaries as $beneficiary) {
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
}
