import type { Raw } from 'vue';
import type Period from '@/utils/period';
import type DateTime from '@/utils/datetime';
import type Day from '@/utils/day';

export enum Type {
    /** Sélection de ou des dates uniquement (jour, mois, année). */
    DATE = 'date',

    /** Sélection de date et heures. */
    DATETIME = 'datetime',
}

export type DisableDateFunction = (date: DateTime, granularity: 'day' | 'minute') => boolean;

//
// - Valeur
//

/** Représente une valeur du datepicker. */
export type Value<T extends Type = Type, R extends boolean = boolean> = (
    | (
        R extends true
            ? Raw<Period<T extends Type.DATE ? true : false>>
            : T extends Type.DATETIME
                ? Raw<DateTime>
                : Raw<Day>
    )
    | null
);

/** Représente une valeur dans le format du "core" pour une date seule. */
export type CoreDateValue = string | null;

/** Représente une valeur dans le format du "core" du datepicker. */
export type CoreValue = (
    | [start: CoreDateValue, end: CoreDateValue]
    | CoreDateValue
);

//
// - Snippets
//

export type RawDateSnippet = {
    labelKey: string,
    period(today: Day): Day,
};

export type RawRangeSnippet = {
    labelKey: string,
    period(today: Day): Period<true>,
};

export type Snippet = {
    label: string,
    periodLabel: string,
    isActive: boolean,
    period: Date | [Date, Date],
};
