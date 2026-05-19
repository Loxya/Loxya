<?php
declare(strict_types=1);

namespace Loxya\Observers;

use Loxya\Models\Enums\InvoiceStatus;
use Loxya\Models\InvoicePayment;

final class InvoicePaymentObserver
{
    public bool $afterCommit = true;

    public function created(InvoicePayment $payment): void
    {
        $invoice = $payment->invoice;

        // - L'enregistrement d'un paiement fait automatiquement passer
        //   une facture en attente à l'état "envoyée".
        if ($invoice->getRawOriginal('status') === InvoiceStatus::PENDING->value) {
            $invoice->update(['status' => InvoiceStatus::SENT->value]);
        }
    }
}
