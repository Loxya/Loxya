<?php
declare(strict_types=1);

namespace Loxya\Models\Enums;

/** Format des factures et devis. */
enum BillingFormat: int
{
    /**
     * Format avec support d'un unique tarif dégressif
     * global au devis / facture, pas de remise de ligne.
     *
     * Format déprécié.
     */
    case V1 = 1;

    /**
     * Format avec support des tarifs dégressif et remise
     * par ligne, des lignes d'extras (sans remise) et de
     * taxes à prix fixe non soumis à T.V.A.
     *
     * Format déprécié.
     */
    case V2 = 2;

    /**
     * Format avec support des tarifs dégressif, remise
     * par ligne, lignes d'extras avec remise et de la
     * facturation électronique (FacturX / UBL).
     *
     * Les taxes à prix fixe ne sont plus supportées par ce format.
     */
    case V3 = 3;

    /**
     * Permet de récupérer la version en vigueur.
     *
     * @return self
     */
    public static function current(): self
    {
        return self::V3;
    }
}
