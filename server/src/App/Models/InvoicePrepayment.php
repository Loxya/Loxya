<?php
declare(strict_types=1);

namespace Loxya\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Liaison entre une facture de solde et une facture d'acompte.
 *
 * @property-read ?int $id
 * @property int $invoice_id
 * @property-read Invoice $invoice
 * @property int $prepayment_invoice_id
 * @property-read Invoice $prepayment_invoice
 * @property-read Invoice $prepaymentInvoice
 */
final class InvoicePrepayment extends BasePivot
{
    protected $table = 'invoice_prepayments';

    // ------------------------------------------------------
    // -
    // -    Relations
    // -
    // ------------------------------------------------------

    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class, 'invoice_id')
            ->withTrashed();
    }

    public function prepaymentInvoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class, 'prepayment_invoice_id')
            ->withTrashed();
    }

    // ------------------------------------------------------
    // -
    // -    Mutators
    // -
    // ------------------------------------------------------

    protected $casts = [
        'invoice_id' => 'integer',
        'prepayment_invoice_id' => 'integer',
    ];
}
