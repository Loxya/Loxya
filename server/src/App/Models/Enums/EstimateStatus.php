<?php
declare(strict_types=1);

namespace Loxya\Models\Enums;

/** Statuts des devis. */
enum EstimateStatus: string
{
    /** Le devis est un brouillon, en attente de finalisation. */
    case DRAFT = 'draft';

    /**
     * Le devis brouillon est obsolète.
     * (sa date d'échéance fixe est dépassée)
     */
    case OBSOLETE = 'obsolete';

    /** Le devis n'a pas encore été envoyé. */
    case PENDING = 'pending';

    /** Le devis a été envoyé. */
    case SENT = 'sent';

    /** Le devis a été accepté. */
    case ACCEPTED = 'accepted';

    /** Le devis a été refusé. */
    case REJECTED = 'rejected';

    /** Le devis est expiré. */
    case EXPIRED = 'expired';

    /** Le devis a été partiellement facturé (au moins un acompte). */
    case PARTIALLY_INVOICED = 'partially-invoiced';

    /** Le devis a été entièrement facturé. */
    case INVOICED = 'invoiced';
}
