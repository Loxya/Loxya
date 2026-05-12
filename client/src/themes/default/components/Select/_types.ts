export type OptionValue = string | number | Record<string, unknown>;

export type Option<T extends OptionValue = OptionValue, ExtraData = any> = {
    /** Le libellé qui sera affiché pour cette option. */
    label: string,

    /** La valeur de l'option. */
    value: T,

    /** Données additionnelles éventuelles. */
    data?: ExtraData,

    /**
     * L'option est-elle désactivée ?
     *
     * @default false
     */
    disabled?: boolean,
};

export type Options<T extends OptionValue = OptionValue, ExtraData = any> = (
    Array<Option<T, ExtraData>>
);

export type LooseOptions<T extends OptionValue, ExtraData> = string[] | Options<T, ExtraData>;
export type SearcherFunc = (search: string) => Promise<void> | void;

/** Retourne le type de valeur des options. */
export type ValuesOf<T extends readonly unknown[], TO = T[number]> = (
    TO extends { value: infer V } ? V
        : TO extends string | number ? TO
            : never
);
