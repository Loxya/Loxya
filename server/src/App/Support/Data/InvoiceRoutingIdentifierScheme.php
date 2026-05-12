<?php
declare(strict_types=1);

namespace Loxya\Support\Data;

/** Identifiants de routage e-facturation. */
enum InvoiceRoutingIdentifierScheme: string
{
    /**
     * Adresse électronique "FRCTC".
     *
     * => Identifiant utilisé pour le routage PPF.
     */
    case FR_CTC = '0225';

    /** Code BCE Belge. */
    case BE_BCE = '0208';
}
