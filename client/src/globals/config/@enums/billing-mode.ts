/** Mode de facturation de l'application. */
enum BillingMode {
    /**
     * Mode "Location".
     *
     * La facturation est toujours activée dans les
     * événements et réservations.
     */
    ALL = 'all',

    /**
     * Mode hybride: Location et prêt.
     *
     * La facturation peut être activée ou désactivée manuellement
     * dans les événements et réservations.
     */
    PARTIAL = 'partial',

    /**
     * Mode "Prêt".
     *
     * La facturation est toujours désactivée dans les
     * événements et réservations.
     */
    NONE = 'none',
}

export default BillingMode;
