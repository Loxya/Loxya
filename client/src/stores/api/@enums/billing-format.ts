/** Format des factures et devis. */
enum BillingFormat {
    /**
     * Format avec support d'un unique tarif dégressif
     * global au devis / facture, pas de remise de ligne.
     *
     * Format déprécié.
     */
    V1 = 1,

    /**
     * Format avec support des tarifs dégressif et remise
     * par ligne, des lignes d'extras (sans remise) et de
     * taxes à prix fixe non soumis à T.V.A.
     *
     * Format déprécié.
     */
    V2 = 2,

    /**
     * Format avec support des tarifs dégressif, remise
     * par ligne, lignes d'extras avec remise et de la
     * facturation électronique (FacturX / UBL).
     *
     * Les taxes à prix fixe ne sont plus supportées par ce format.
     */
    V3 = 3,
}

export default BillingFormat;
