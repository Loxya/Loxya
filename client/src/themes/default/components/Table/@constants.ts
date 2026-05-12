import type { ComputedRef, InjectionKey } from 'vue';
import type { RawOrderBy } from './@types';

/** Les différentes variantes disponibles pour la présentation du tableau. */
export enum Variant {
    /** Variante par défaut. */
    DEFAULT = 'default',

    /** Présentation "légère", sans fond mais avec séparateurs. */
    LIGHT = 'light',

    /** Présentation minimaliste, sans fond ni séparateurs. */
    MINIMALIST = 'minimalist',
}

//
// - Clés d'injection
//

/** Clé d'injection pour la page courante du tableau. */
export const PageKey: InjectionKey<ComputedRef<number>> = (
    Symbol('Table.page')
);

/** Clé d'injection pour la limite d'éléments par page du tableau. */
export const LimitKey: InjectionKey<ComputedRef<number>> = (
    Symbol('Table.limit')
);

/** Clé d'injection pour le critère de tri courant du tableau. */
export const OrderByKey: InjectionKey<ComputedRef<RawOrderBy | null>> = (
    Symbol('Table.order-by')
);
