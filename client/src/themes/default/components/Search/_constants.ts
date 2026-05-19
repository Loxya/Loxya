import type { ComputedRef, InjectionKey } from 'vue';

export const TERM_TOKEN_TYPE = Symbol('term-token');

export enum CursorPosition {
    /** Le curseur est positionné au début. */
    START = 'start',

    /** Le curseur est positionné à la fin. */
    END = 'end',
}

export enum TokenPart {
    /** La partie d'un token qui contient son type. */
    TYPE = 'type',

    /** La partie d'un token qui contient son opérateur. */
    OPERATOR = 'operator',

    /** La partie d'un token qui contient sa valeur. */
    VALUE = 'value',
}

/** Genre des tokens. */
export enum TokenKind {
    /**
     * Un token avec une liste de valeurs sélectionnables.
     *
     * Le choix de la valeur se fait donc dans une liste de sélection.
     */
    LIST = 'list',

    /**
     * Un token de recherche textuelle d'un type particulier.
     *
     * La valeur est donc un texte entré par l'utilisateur.
     *
     * À ne pas confondre avec les "Term tokens" qui sont
     * des recherches globales.
     */
    TEXT = 'text',

    /**
     * Un token de recherche booléenne.
     *
     * L'utilisateur a donc le choix entre oui ou non en valeur de ce token.
     */
    BOOLEAN = 'boolean',

    /**
     * Un token de recherche sur un nombre entier.
     *
     * La valeur est donc un nombre entier entré par l'utilisateur.
     */
    INTEGER = 'integer',

    /**
     * Un token de recherche sur un nombre décimal.
     *
     * La valeur est donc un nombre décimal entré par l'utilisateur.
     */
    FLOAT = 'float',

    /**
     * Un token de recherche de type "date".
     *
     * La valeur est donc une date sélectionnée par l'utilisateur
     * dans un picker.
     */
    DATE = 'date',

    /**
     * Un token de recherche de type "période".
     *
     * La valeur est donc une période sélectionnée par
     * l'utilisateur dans un picker.
     */
    PERIOD = 'period',
}

//
// - Clés d'injection
//

/** Clé d'injection pour l'identifiant du portail de la recherche. */
export const SearchPortalIdKey: InjectionKey<ComputedRef<string>> = (
    Symbol('Search.portal-id')
);

/** Clé d'injection pour la fonction de ré-alignement du portail de la recherche. */
export const AlignSearchPortalKey: InjectionKey<($target: HTMLElement) => void> = (
    Symbol('Search.align-portal')
);
