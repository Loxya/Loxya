import type { UndefinedOnPartialDeep } from 'type-fest';

/** Type de données dans un champ personnalisé. */
export enum CustomFieldType {
    /** Un champ permettant d'entrer une chaîne de caractère simple. */
    STRING = 'string',

    /** Un champ permettant d'entrer du texte long. */
    TEXT = 'text',

    /** Un champ permettant d'entrer un nombre entier. */
    INTEGER = 'integer',

    /** Un champ permettant d'entrer un nombre décimal. */
    FLOAT = 'float',

    /** Un champ permettant de choisir entre oui ou non. */
    BOOLEAN = 'boolean',

    /** Un champ permettant de choisir une option dans une liste. */
    LIST = 'list',

    /** Un champ permettant de spécifier une période. */
    PERIOD = 'period',

    /** Un champ permettant de spécifier une date. */
    DATE = 'date',
}

//
// - Types liés à la pagination / tri.
//

/** Sens de tri. */
export enum Direction {
    /** Direction ascendante. */
    ASC = 'asc',

    /** Direction descendante. */
    DESC = 'desc',
}

export type SortableParams = {
    /** La colonne avec laquelle on veut trier le jeu de résultats. */
    orderBy?: string,

    /**
     * Le jeu de résultat doit-il être trié de manière ascendante selon la colonne choisie
     * ci-dessus (ou celle par défaut si aucun colonne n'a été explicitement choisie).
     *
     * - Si `1`, le jeu de résultat sera trié de manière ascendante.
     * - Si `0`, il sera trié de manière descendante.
     *
     */
    // TODO: Modifier ça pour quelque chose du genre : `{ direction: Direction }`.
    //       (il faudra adapter le component de tableau qui utilise cette notation obsolète).
    ascending?: 0 | 1 | boolean,
};

export type PaginationParams = {
    /**
     * La page dont on veut récupérer le résultat.
     *
     * @default 1
     */
    page?: number,

    /** Le nombre de résultats par page que l'on souhaite récupérer. */
    limit?: number,
};

export type ListingParams = UndefinedOnPartialDeep<(
    & {
        /**
         * Permet de rechercher un terme en particulier.
         *
         * @default undefined
         */
        search?: string | string[],
    }
    & SortableParams
    & PaginationParams
)>;

//
// - Enveloppes.
//

export type PaginatedData<T> = {
    data: T,
    pagination: {
        perPage: number,
        currentPage: number,
        total: {
            items: number,
            pages: number,
        },
    },
};

export type CountedData<T> = {
    data: T,
    count: number,
};
