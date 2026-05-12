<?php
declare(strict_types=1);

namespace Loxya\Models\Enums;

/** Statuts des factures. */
enum InvoiceStatus: string
{
    /** La facture est un brouillon, en attente de finalisation. */
    case DRAFT = 'draft';

    /**
     * La facture brouillon est obsolète.
     * (sa date d'échéance fixe est dépassée)
     */
    case OBSOLETE = 'obsolete';

    /** La facture n'a pas encore été envoyée. */
    case PENDING = 'pending';

    /** La facture a été envoyée. */
    case SENT = 'sent';

    /** Le paiement de la facture est en retard. */
    case OVERDUE = 'overdue';

    /** La facture a été partiellement payée. */
    case PARTIALLY_PAID = 'partially-paid';

    /** La facture a été payée. */
    case PAID = 'paid';

    /** La facture a été annulée par un avoir. */
    case CANCELLED = 'cancelled';
}
