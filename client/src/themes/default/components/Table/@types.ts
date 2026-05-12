import type { CreateElement } from 'vue';
import type {
    EmptyMessageAction,
    EmptyMessageVariant,
} from '@/themes/default/components/EmptyMessage';

export type Identifier = string | number;

/** Descripteur du message affiché lorsqu'un tableau est vide. */
export type EmptyMessage = {
    /**
     * Texte du message à afficher.
     *
     * Si non défini, un message par défaut adapté à
     * la {@link variant} choisie est utilisé.
     */
    text?: string,

    /**
     * Variante d'état à représenter.
     *
     * @default EmptyMessageVariant.EMPTY
     */
    variant?: EmptyMessageVariant | `${EmptyMessageVariant}`,

    /** Éventuelle action à afficher sous le message. */
    action?: EmptyMessageAction,
};

export type Datum<K extends string = 'id'> = (
    & Record<K, Identifier>
    & Record<string, unknown>
);

export type RenderFunction<
    T extends Datum<K> = any,
    K extends string = 'id',
> = (
    (h: CreateElement, row: T, rowIndex: number) => JSX.Node
);

export type Column<
    D extends Datum<K> = any,
    K extends string = 'id',
> = {
    /**
     * L'identifiant unique de la colonne.
     *
     * Quand la colonne correspond à une clé du tableau de données,
     * cet clé devrait contenir le nom de cette même clé.
     */
    key: string,

    /**
     * Le titre de la colonne tel qu'affiché dans
     * le header du tableau.
     */
    title?: string,

    /**
     * Permet de customiser le nom utilisé pour la colonne,
     * notamment dans le sélecteur des colonnes.
     */
    label?: string,

    /**
     * Une fonction permettant de customiser le rendu de la colonne.
     *
     * Si non spécifiée, la clé `key` sera utilisée pour récupérer la
     * valeur liée pour chaque élément du jeu de données et celui-ci
     * sera affiché tel quel.
     */
    render?: RenderFunction<D, K>,

    /** Une ou plusieurs classes à ajouter à la colonne. */
    class?: JSX.NodeClass,

    /**
     * La colonne peut-elle être cachée par l'utilisateur ?
     *
     * Si non spécifié, la valeur par défaut est généralement `true`.
     * Sauf pour les colonnes avec les clés `name` et `actions`, ou c'est `false` par défaut.
     */
    hideable?: boolean,

    /**
     * La colonne doit-elle être cachée par défaut ?
     *
     * Attention, une colonne marquée comme `hideable` à `false` (explicitement ou en
     * fonction de sa valeur par défaut) ne respectera pas la valeur de cette clé.
     *
     * À noter que cette valeur ne sera prise en compte que si l'utilisateur n'a pas
     * manifesté un choix explicite relatif à cette colonne, sans quoi c'est son avis
     * qui sera pris en compte (avis qui pourra être persisté si le tableau à un nom
     * (prop. `name`)).
     *
     * @default false
     */
    defaultHidden?: boolean,

    /**
     * La direction de tri par défaut est-elle descendante ?
     *
     * @default false
     */
    defaultSortDesc?: boolean,
};

export type Columns<
    D extends Datum<K>,
    K extends string = 'id',
> = Array<Column<D, K>>;

export type OrderBy<
    D extends Datum<K>,
    Cs extends Columns<D, K>,
    K extends string = 'id',
> = {
    /** La clé de la colonne qui sera utilisée pour le tri. */
    column: Cs[number]['key'],

    /**
     * La colonne doit-elle être triée de façon ascendante (= `true`)
     * ou descendante (= `false`).
     */
    ascending?: boolean,
};

//
// - Données "brutes"
//

export type RawColumn<
    D extends Datum<K> = any,
    K extends string = 'id',
> = {
    key: string,
    title: string | undefined,
    sortable: boolean,
    render: RenderFunction<D, K> | undefined,
    class?: JSX.NodeClass,
};

export type RawColumns<
    D extends Datum<K> = any,
    K extends string = 'id',
> = Array<RawColumn<D, K>>;

export type RawOrderBy<
    D extends Datum<K> = any,
    Cs extends RawColumns<D, K> = RawColumns,
    K extends string = 'id',
> = Required<OrderBy<D, Cs, K>>;
