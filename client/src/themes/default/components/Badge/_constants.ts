/** La taille du badge. */
export enum Size {
    NORMAL = 'normal',
    LARGE = 'large',
}

/** Le type de badge */
export enum Type {
    /** Un badge "neutre" (e.g. brouillon, ...) */
    DEFAULT = 'default',

    /** Un badge de type "alerte" (e.g. en attente, à surveiller, ...) */
    WARNING = 'warning',

    /** Un badge de type "info" (e.g. envoyé, ...) */
    INFO = 'info',

    /** Un badge de type "succès" (e.g. payé, accepté, ...) */
    SUCCESS = 'success',

    /** Un badge de type "danger" (e.g. en retard, refusé, expiré, ...) */
    DANGER = 'danger',
}
