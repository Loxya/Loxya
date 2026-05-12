import type { Merge } from 'type-fest';
import type { Datum, Column as CoreColumn } from '../@types';

/**
 * Fonction personnalisée de tri de colonne.
 *
 * Cette fonction, à qui la direction de tri souhaité est passé (via `ascending`),
 * doit renvoyer une autre fonction qui s'occupera de comparer deux éléments de
 * la colonne et devra renvoyé si le premier élément (`a`) arrive avant (= `-1`) ou
 * après (= `1`) le deuxième (`b`) (ou s'ils sont égaux (= `0`)).
 *
 * Si non spécifié, le tri consistera en une simple comparaison des valeurs
 * (e.g si ascendant: `a > b ? 1 : -1`) en ayant au préalable mis les chaînes
 * de caractères en minuscules (si ce sont des chaînes qui sont comparés).
 *
 * @param ascending - Spécifie si le tri doit être effectué de manière
 *                    ascendante ou descendante.
 */
export type ColumnSorter<
    D extends Datum<K> = any,
    K extends string = 'id',
> = (ascending: boolean) => (
    (a: D, b: D) => number
);

export type Column<
    D extends Datum<K> = any,
    K extends string = 'id',
> = Merge<CoreColumn<D, K>, {
    /**
     * Le tri doit-il être activé sur cette colonne ?
     *
     * Peut contenir:
     * - Un booléen, auquel cas le tri consistera en une simple comparaison des valeurs
     *   (e.g si ascendant: `a > b ? 1 : -1`) en ayant au préalable mis les chaînes
     *   de caractères en minuscules (si ce sont des chaînes qui sont comparées).
     * - Une fonction personnalisée de tri pour la colonne.
     *   Cette fonction, à qui la direction de tri souhaité est passée (via `ascending`),
     *   doit renvoyer une autre fonction qui s'occupera de comparer deux éléments de
     *   la colonne et devra renvoyer si le premier élément (`a`) arrive avant (= `-1`) ou
     *   après (= `1`) le deuxième (`b`) (ou s'ils sont égaux (= `0`)).
     *
     * @default false
     */
    sortable?: boolean | ColumnSorter<D, K>,
}>;

export type Columns<
    D extends Datum<K> = any,
    K extends string = 'id',
> = Array<Column<D, K>>;
