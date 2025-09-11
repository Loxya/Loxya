/** Politique de retour / clôture des événements et réservations. */
enum ReturnPolicy {
    /**
     * Clôture automatique à la fin de la période de mobilisation.
     *
     * Le matériel est considéré comme retourné dès que la date de fin de
     * mobilisation est atteinte, qu'un inventaire de retour ait été réalisé
     * ou non. Les notifications de matériel non retourné ne sont envoyées que
     * si un inventaire de départ a été commencé sans être terminé.
     */
    AUTO = 'auto',

    /**
     * Clôture manuelle fondée sur la réalisation effective de l'inventaire de retour.
     *
     * Tant que celui-ci n'a pas été effectué, l'événement ou la réservation reste actif,
     * et le matériel mobilisé demeure indisponible pour d'autres événements.
     */
    MANUAL = 'manual',
}

export default ReturnPolicy;
