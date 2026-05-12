import type { Type } from './_constants';

export type Option<V extends string | number = string | number> = {
    /** Le type de badge. */
    type: Type | `${Type}`,

    /** Le libellé qui sera affiché pour cette option. */
    label: string,

    /** La valeur de l'option. */
    value: V,

    /**
     * L'option est-elle sélectionnable ?
     *
     * Si `false`, elle n’apparaîtra pas dans la liste déroulante.
     *
     * @default true
     */
    selectable?: boolean,
};

export type Options<V extends string | number = string | number> = Array<Option<V>>;
