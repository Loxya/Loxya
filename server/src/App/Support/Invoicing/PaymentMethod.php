<?php
declare(strict_types=1);

namespace Loxya\Support\Invoicing;

use horstoeko\zugferd\codelists\ZugferdPaymentMeans;

/** Moyen de paiement. */
enum PaymentMethod: string
{
    /** Espèces. */
    case CASH = 'cash';

    /** Carte de crédit / débit */
    case CARD = 'card';

    /** Chèque. */
    case CHEQUE = 'cheque';

    /** Virement bancaire. */
    case TRANSFER = 'transfer';

    //
    // - Méthodes
    //

    /**
     * Retourne le code UNTDID 4461 correspondant au moyen de paiement.
     *
     * @see https://service.unece.org/trade/untdid/d24a/tred/tred4461.htm
     *
     * @return string Le code UNTDID 4461.
     */
    public function getCode(): string
    {
        // phpcs:ignore PHPCompatibility.Variables.ForbiddenThisUseContexts
        return match ($this) {
            self::CASH => ZugferdPaymentMeans::UNTDID_4461_10,
            self::CARD => ZugferdPaymentMeans::UNTDID_4461_48,
            self::CHEQUE => ZugferdPaymentMeans::UNTDID_4461_20,
            self::TRANSFER => ZugferdPaymentMeans::UNTDID_4461_58,
        };
    }
}
