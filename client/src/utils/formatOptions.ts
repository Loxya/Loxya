import type { Simplify } from 'type-fest';

export type DataShape = { id: string | number, name?: string };

/** Représente une option de sélection avec une valeur et un libellé. */
type RawOption<T extends string | number> = {
    label: string,
    value: T,
};

/** Représente une option de sélection liée à une donnée formatée. */
export type Option<T extends DataShape> = Simplify<(
    & RawOption<T['id']>
    & { data: T }
)>;

/** Représente un tableau d'objets {@link Option}. */
export type Options<T extends DataShape> = Array<Option<T>>;

/**
 * Transforme un tableau de données en un tableau d'options utilisables dans des listes de sélection.
 *
 * Chaque élément du tableau de données est converti en une option où la valeur `value` est l'identifiant de l'élément,
 * et le libellé `label` est obtenu soit via une fonction personnalisée fournie, soit en utilisant le nom de l'élément
 * ou une valeur par défaut si aucun nom n'est disponible.
 *
 * @param data - Un tableau contenant les éléments de données ou `null`/`undefined` si aucune donnée n'est disponible.
 * @param getLabel - Une fonction optionnelle pour générer le libellé d'une option à partir des données brutes.
 *                   Si non fournie, le nom de l'élément est utilisé comme libellé, ou 'N/A' si non spécifié.
 *
 * @returns Un tableau d'objets {@link Option}, où chaque objet représente une option pour un élément de sélection.
 *          Retourne un tableau vide si les données d'entrée sont `null` ou `undefined`.
 */
const formatOptions = <T extends DataShape>(
    data: T[] | null | undefined,
    getLabel: ((rawData: T) => string) | null = null,
): Options<T> => {
    if (data === undefined || data === null) {
        return [];
    }

    return data.map((datum: T): Option<T> => {
        const value = datum.id;
        const label = getLabel ? getLabel(datum) : (datum.name ?? 'N/A');
        return { value, label, data: datum };
    });
};

export default formatOptions;
