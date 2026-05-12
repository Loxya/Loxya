<?php
declare(strict_types=1);

namespace Loxya\Observers;

use Loxya\Models\Technician;

final class TechnicianObserver
{
    public bool $afterCommit = true;

    public function deleted(Technician $technician): void
    {
        //
        // - Suppression de la Person associée au technicien si elle n'est
        //   pas utilisée ailleurs (utilisateur ou bénéficiaire)
        //

        if ($technician->isForceDeleting()) {
            $technician->person->deleteIfOrphan();
        }
    }
}
