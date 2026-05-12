<?php
declare(strict_types=1);

namespace Loxya\Support\Invoicing;

/**
 * Type de facture.
 *
 * @see https://service.unece.org/trade/untdid/d24a/tred/tred1001.htm
 */
enum InvoiceType: string
{
    /** Facture "normale". */
    case INVOICE = "380";

    /** Avoir. */
    case CREDIT_NOTE = "381";

    /** Facture corrective. */
    case CORRECTION = "384";

    /** Facture d'acompte. */
    case PREPAYMENT_INVOICE = "386";

    /** Avoir de facture d'acompte. */
    case PREPAYMENT_CREDIT_NOTE = '503';
}
