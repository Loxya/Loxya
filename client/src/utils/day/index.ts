import invariant from 'invariant';
import DateTime from '@/utils/datetime';
import {
    ReadableFormat,
    EXCLUDED_UNITS,
    EXCLUDED_UNITS_WITH_DAY,
} from './_constants';

import type Period from '@/utils/period';
import type { Duration, InclusionPattern } from '@/utils/datetime';
import type {
    Unit,
    UnitWithWeek,
    ManipulateUnit,
    ManipulateUnitWithoutDay,
} from './_constants';

export type DayInput = string | Day | DateTime | Date;

/** Un jour (e.g. `2024-01-01`) */
class Day {
    private readonly _dateTime: DateTime;

    constructor(input?: DayInput) {
        let dateTime: DateTime | undefined;
        if (input === undefined) {
            dateTime = DateTime.now();
        }
        if (input instanceof Day) {
            dateTime = input.toDateTime();
        }
        if (input instanceof DateTime) {
            dateTime = input.clone();
        }
        if (input instanceof Date) {
            dateTime = new DateTime(input);
        }
        if (typeof input === 'string') {
            dateTime = DateTime.fromFormat(input, 'YYYY-MM-DD');
        }

        invariant(dateTime !== undefined, 'Invalid day input.');
        this._dateTime = dateTime.startOfDay();
    }

    /**
     * Permet de déterminer si l'instance courante est identique à un autre jour
     * ou date (sous forme d'instance ou de tout autre format accepté par `Day`).
     *
     * Par défaut, cette méthode compare à la journée près, vous pouvez
     * modifier ce comportement via le paramètre `granularity`.
     *
     * @example
     * ```
     * Day.today().isSame(new Day('2024-01-01')); // => Booléen.
     * Day.today().isSame('2024-01-01', 'year'); // => Booléen.
     * ```
     *
     * @param other - L'autre jour / date avec laquelle comparer l'instance courante.
     *                (dans n'importe quel format accepté par `Day`, voir {@link DayInput})
     * @param granularity - Permet de limiter la granularité à une autre unité que la journée.
     *                      (seules les unités plus grande ou égale à la journée sont disponibles)
     *
     * @returns `true` si l'instance courante est identique à la date / journée passée, dans la
     *          granularité choisie (par défaut à la journée près si non spécifiée), `false` sinon.
     */
    public isSame(other: DayInput, granularity: UnitWithWeek = 'day'): boolean {
        invariant(
            !EXCLUDED_UNITS.includes(granularity as any),
            `It is not possible to compare a \`Day\` instance with a granularity smaller than a day.`,
        );
        return this._dateTime.isSame(new Day(other).toDateTime(), granularity);
    }

    /**
     * Permet de déterminer si l'instance courante est identique ou avant un autre jour
     * ou date (sous forme d'instance ou de tout autre format accepté par `Day`).
     *
     * Par défaut, cette méthode compare à la journée près, vous pouvez
     * modifier ce comportement via le paramètre `granularity`.
     *
     * @example
     * ```
     * Day.today().isSameOrBefore(new Day('2024-01-01')); // => Booléen.
     * Day.today().isSameOrBefore('2024-01-01', 'year'); // => Booléen.
     * ```
     *
     * @param other - L'autre jour / date avec laquelle comparer l'instance courante.
     *                (dans n'importe quel format accepté par `Day`, voir {@link DayInput})
     * @param granularity - Permet de limiter la granularité à une autre unité que la journée.
     *                      (seules les unités plus grande ou égale à la journée sont disponibles)
     *
     * @returns `true` si l'instance courante est identique ou avant la date / journée passée, dans la
     *          granularité choisie (par défaut à la journée près si non spécifiée), `false` sinon.
     */
    public isSameOrBefore(other: DayInput, granularity: UnitWithWeek = 'day'): boolean {
        return this.isSame(other, granularity) || this.isBefore(other, granularity);
    }

    /**
     * Permet de déterminer si l'instance courante est identique ou après un autre jour
     * ou date (sous forme d'instance ou de tout autre format accepté par `Day`).
     *
     * Par défaut, cette méthode compare à la journée près, vous pouvez
     * modifier ce comportement via le paramètre `granularity`.
     *
     * @example
     * ```
     * Day.today().isSameOrAfter(new Day('2024-01-01')); // => Booléen.
     * Day.today().isSameOrAfter('2024-01-01', 'year'); // => Booléen.
     * ```
     *
     * @param other - L'autre jour / date avec laquelle comparer l'instance courante.
     *                (dans n'importe quel format accepté par `Day`, voir {@link DayInput})
     * @param granularity - Permet de limiter la granularité à une autre unité que la journée.
     *                      (seules les unités plus grande ou égale à la journée sont disponibles)
     *
     * @returns `true` si l'instance courante est identique ou après la date / journée passée, dans la
     *          granularité choisie (par défaut à la journée près si non spécifiée), `false` sinon.
     */
    public isSameOrAfter(other: DayInput, granularity: UnitWithWeek = 'day'): boolean {
        return this.isSame(other, granularity) || this.isAfter(other, granularity);
    }

    /**
     * Permet de déterminer si l'instance courante est avant un autre jour
     * ou date (sous forme d'instance ou de tout autre format accepté par `Day`).
     *
     * Par défaut, cette méthode compare à la journée près, vous pouvez
     * modifier ce comportement via le paramètre `granularity`.
     *
     * @example
     * ```
     * Day.today().isBefore(new DateTime('2024-01-01')); // => Booléen.
     * Day.today().isBefore('2024-01-01', 'year'); // => Booléen.
     * ```
     *
     * @param other - L'autre jour / date avec laquelle comparer l'instance courante.
     *                (dans n'importe quel format accepté par `Day`, voir {@link DayInput})
     * @param granularity - Permet de limiter la granularité à une autre unité que la journée.
     *                      (seules les unités plus grande ou égale à la journée sont disponibles)
     *
     * @returns `true` si l'instance courante est avant la date / journée passée, dans la granularité
     *          choisie (par défaut à la journée près si non spécifiée), `false` sinon.
     */
    public isBefore(other: DayInput, granularity: UnitWithWeek = 'day'): boolean {
        invariant(
            !EXCLUDED_UNITS.includes(granularity as any),
            `It is not possible to compare a \`Day\` instance with a granularity smaller than a day.`,
        );
        return this._dateTime.isBefore(new Day(other).toDateTime(), granularity);
    }

    /**
     * Permet de déterminer si l'instance courante est après un autre jour
     * ou date (sous forme d'instance ou de tout autre format accepté par `Day`).
     *
     * Par défaut, cette méthode compare à la journée près, vous pouvez
     * modifier ce comportement via le paramètre `granularity`.
     *
     * @example
     * ```
     * Day.today().isAfter(new DateTime('2024-01-01')); // => Booléen.
     * Day.today().isAfter('2024-01-01', 'year'); // => Booléen.
     * ```
     *
     * @param other - L'autre jour / date avec laquelle comparer l'instance courante.
     *                (dans n'importe quel format accepté par `Day`, voir {@link DayInput})
     * @param granularity - Permet de limiter la granularité à une autre unité que la journée.
     *                      (seules les unités plus grande ou égale à la journée sont disponibles)
     *
     * @returns `true` si l'instance courante est après la date / journée passée, dans la granularité
     *          choisie (par défaut à la journée près si non spécifiée), `false` sinon.
     */
    public isAfter(other: DayInput, granularity: UnitWithWeek = 'day'): boolean {
        invariant(
            !EXCLUDED_UNITS.includes(granularity as any),
            `It is not possible to compare a \`Day\` instance with a granularity smaller than a day.`,
        );
        return this._dateTime.isAfter(new Day(other).toDateTime(), granularity);
    }

    /**
     * Permet de déterminer si l'instance courante est comprise dans une période donnée.
     *
     * @example
     * ```
     * DateTime.today().isBetween(new Period('2024-01-01', '2024-02-01', false)); // => Booléen.
     * DateTime.today().isBetween(new Period('2024-01-01', '2024-02-01', false), '[]'); // => Booléen.
     * ```
     *
     * @param period - Une instance de `Period` dans laquelle on cherche à savoir si le jour se trouve.
     * @param inclusionPattern - Une chaîne de caractère avec un format spécial pour paramétrer les
     *                           inclusions / exclusions. Voir {@link InclusionPattern}.
     *                           Par défaut, les jours de début et de fin sont inclus (= `[]`).
     *
     * @returns `true` si l'instance courante se trouve dans la période, `false` sinon.
     */
    public isBetween(period: Period, inclusionPattern: InclusionPattern = '[]'): boolean {
        const normalizedPeriod = period.setFullDays(true);
        const shouldExcludeStart = inclusionPattern[0] === '(';
        const shouldExcludeEnd = inclusionPattern[1] === ')';

        return (
            (
                shouldExcludeStart
                    ? this.isAfter(normalizedPeriod.start)
                    : this.isSameOrAfter(normalizedPeriod.start)
            ) && (
                shouldExcludeEnd
                    ? this.isBefore(normalizedPeriod.end)
                    : this.isSameOrBefore(normalizedPeriod.end)
            )
        );
    }

    /**
     * Permet d'effectuer une comparaison avec un autre jour ou date (sous forme d'instance
     * ou de tout autre format accepté par `Day`) et de retourner le résultat sous forme
     * d'entier (pouvant par exemple être utilisé pour du tri dans un callback passé à `Array.sort()`).
     *
     * @example
     * ```
     * [new Day('2024-02-02'), new Day('2024-01-01')].sort((a, b) => a.compare(b));
     * // => [new Day('2024-01-01'), new Day('2024-02-02')]
     *
     * [new Day('2024-02-02'), new Day('2024-01-01')].sort((a, b) => !a.compare(b));
     * // => [new Day('2024-02-02'), new Day('2024-01-01')]
     * ```
     *
     * @param other - L'autre jour / date avec laquelle comparer l'instance courante.
     *                (dans n'importe quel format accepté par `Day`, voir {@link DayInput})
     * @param granularity - Permet de limiter la granularité à une autre unité que la journée.
     *                      (seules les unités plus grande ou égale à la journée sont disponibles)
     *
     * @returns Un nombre représentant le résultat de la comparaison:
     *          - `-1`: Si l'instance courante est "avant" la date comparée dans la granularité
     *                  choisie (par défaut à la journée près si non spécifiée).
     *          - `0`: Si l'instance courante est "égale" à la date comparée dans la granularité
     *                  choisie (par défaut à la journée près si non spécifiée).
     *          - `1`: Si l'instance courante est "après" la date comparée dans la granularité
     *                  choisie (par défaut à la journée près si non spécifiée).
     */
    public compare(other: DayInput, granularity: UnitWithWeek = 'day'): number {
        invariant(
            !EXCLUDED_UNITS.includes(granularity as any),
            `It is not possible to compare a \`Day\` instance with a granularity smaller than a day.`,
        );
        return this._dateTime.compare(new Day(other).toDateTime(), granularity);
    }

    /**
     * Permet de déterminer si l'instance courante est dans le passé.
     *
     * @example
     * ```
     * new Day('2024-01-01').isPast(); // => Booléen.
     * ```
     *
     * @returns `true` si l'instance courante est dans le passé, `false` sinon.
     */
    public isPast(): boolean {
        return this.isBefore(Day.today());
    }

    /**
     * Permet de déterminer si l'instance courante est dans le futur.
     *
     * @example
     * ```
     * new Day('2024-01-01').isFuture(); // => Booléen.
     * ```
     *
     * @returns `true` si l'instance courante est dans le futur, `false` sinon.
     */
    public isFuture(): boolean {
        return this.isAfter(Day.today());
    }

    /**
     * Permet de déterminer si l'instance courante est aujourd'hui.
     *
     * @example
     * ```
     * new Day('2024-01-01').isToday(); // => Booléen.
     * ```
     *
     * @returns `true` si l'instance courante est aujourd'hui, `false` sinon.
     */
    public isToday(): boolean {
        return this.isSame(Day.today());
    }

    /**
     * Permet d'obtenir une nouvelle instance de `Day` avec la
     * valeur d'une unité du jour modifiée.
     *
     * Les unités ne sont pas sensibles à la casse, supportent
     * le pluriel et les formes raccourcis.
     *
     * @example
     * ```
     * Day.today().set('date', 1);
     * Day.today().set('month', 3); // - Avril.
     * Day.today().set('year', 2023); // - Avril.
     * ```
     *
     * @param unit - L'unité dont on veut modifier la valeur.
     * @param value - La nouvelle valeur de l'unité.
     *
     * @returns Une nouvelle instance avec l'unité modifiée comme spécifié.
     */
    public set(unit: Unit, value: number): Day;

    /**
     * Permet d'obtenir une nouvelle instance de `Day` avec la
     * valeur de plusieurs unités du jour modifiées.
     *
     * Les unités ne sont pas sensibles à la casse, supportent
     * le pluriel et les formes raccourcis.
     *
     * @example
     * ```
     * DateTime.now().set({
     *     date: 1,
     *     month: 3, // - Avril
     *     year: 2023,
     * });
     * ```
     *
     * @param units - Un object contenant en clé les unités à modifier et
     *                en valeur, leur nouvelle valeur.
     *
     * @returns Une nouvelle instance avec les unités modifiées comme spécifié.
     */
    public set(units: Partial<Record<Unit, number>>): Day;
    public set(unit: Unit | Partial<Record<Unit, number>>, value?: number): Day {
        const units: Array<[Unit, number]> = typeof unit !== 'string'
            ? Object.entries(unit) as Array<[Unit, number]>
            : [[unit, value!]];

        return new Day(units.reduce(
            (dateTime: DateTime, [_unit, _value]: [Unit, number]) => {
                invariant(
                    !EXCLUDED_UNITS.includes(unit as any),
                    `It is not possible to set a unit smaller than a day to a \`Day\` instance.`,
                );
                return dateTime.set(_unit, _value);
            },
            this._dateTime,
        ));
    }

    /**
     * Permet de récupérer la valeur d'une unité de la journée.
     *
     * Les unités ne sont pas sensibles à la casse, supportent
     * le pluriel et les formes raccourcis.
     *
     * @example
     * ```
     * Day.today().get('year');
     * Day.today().get('month'); // - Commence à 0.
     * Day.today().get('date');
     * ```
     *
     * @param unit - L'unité dont on veut récupérer la valeur.
     *
     * @returns La valeur de l'unité.
     */
    public get(unit: Unit): number {
        invariant(
            !EXCLUDED_UNITS.includes(unit as any),
            `It is not possible to get a unit smaller than a day in a \`Day\` instance.`,
        );
        return this._dateTime.get(unit);
    }

    /**
     * Retourne une nouvelle instance de `Day` avec la quantité de temps spécifiée ajoutée.
     * La quantité de temps doit toujours être un multiple d'une journée (e.g. 1 année,
     * 1 semaine, 2 jours)
     *
     * @example
     * ```
     * new Day('2024-01-01').add(DateTime.duration(7, 'days'));
     * // => new Day('2024-01-08')
     * ```
     *
     * @param duration - Le temps à ajouter, sous forme d'instance de `Duration`.
     *
     * @returns Une nouvelle instance avec la durée spécifiée ajoutée.
     */
    public add(duration: Duration): Day;

    /**
     * Retourne une nouvelle instance de `Day` avec la quantité de temps spécifiée ajoutée.
     * La quantité de temps doit toujours être un multiple d'une journée (e.g. 1 année,
     * 1 semaine, 2 jours)
     *
     * Les unités ne sont pas sensibles à la casse, supportent
     * le pluriel et les formes raccourcis.
     *
     * @example
     * ```
     * new Day('2024-01-01').add(7, 'days');
     * // => new Day('2024-01-08')
     * ```
     *
     * @param value - Le temps à ajouter, dans l'unité choisie.
     * @param unit - L'unité de temps à ajouter (plus grande ou égale au jour).
     *
     * @returns Une nouvelle instance avec le temps spécifié ajouté.
     */
    public add(value: number, unit?: ManipulateUnit): Day;
    public add(value: number | Duration, unit?: ManipulateUnit): Day {
        invariant(
            DateTime.isDuration(value) || !EXCLUDED_UNITS.includes(unit as any),
            `It is not possible to add to a unit smaller than a day in a \`Day\` instance.`,
        );

        const newDateTime = DateTime.isDuration(value)
            ? this._dateTime.add(value)
            : this._dateTime.add(value, unit);

        invariant(newDateTime.isStartOfDay(), `The duration should be a multiple of one day.`);
        return new Day(newDateTime);
    }

    /**
     * Retourne une nouvelle instance de `Day` avec la quantité d'années spécifiées ajoutées.
     *
     * @example
     * ```
     * new Day('2024-01-01').addYear();
     * // => new Day('2025-01-01')
     *
     * new Day('2024-01-01').addYear(10);
     * // => new Day('2034-01-01')
     * ```
     *
     * @param quantity - La quantité d'année à ajouter.
     *
     * @returns Une nouvelle instance avec les années ajoutées.
     */
    public addYear(quantity: number = 1): Day {
        return this.add(quantity, 'year');
    }

    /**
     * Retourne une nouvelle instance de `Day` avec la quantité de mois spécifiés ajoutés.
     *
     * @example
     * ```
     * new Day('2024-01-01').addMonth();
     * // => new Day('2024-02-01')
     *
     * new Day('2024-01-01').addMonth(10);
     * // => new Day('2024-11-01')
     * ```
     *
     * @param quantity - La quantité de mois à ajouter.
     *
     * @returns Une nouvelle instance avec les mois ajoutés.
     */
    public addMonth(quantity: number = 1): Day {
        return this.add(quantity, 'month');
    }

    /**
     * Retourne une nouvelle instance de `Day` avec la quantité de semaines spécifiées ajoutées.
     *
     * Attention, le résultat de cette méthode dépend de la locale actuellement configurée.
     *
     * @example
     * ```
     * new Day('2024-01-01').addWeek();
     * // => new Day('2024-01-08')
     *
     * new Day('2024-01-01').addWeek(10);
     * // => new Day('2024-03-11')
     * ```
     *
     * @param quantity - La quantité de semaines à ajouter.
     *
     * @returns Une nouvelle instance avec les semaines ajoutées.
     */
    public addWeek(quantity: number = 1): Day {
        return this.add(quantity, 'week');
    }

    /**
     * Retourne une nouvelle instance de `Day` avec la quantité de jours spécifiés ajoutés.
     *
     * @example
     * ```
     * new Day('2024-01-01').addDay();
     * // => new Day('2024-01-02')
     *
     * new Day('2024-01-01').addDay(10);
     * // => new Day('2024-01-11')
     * ```
     *
     * @param quantity - La quantité de jours à ajouter.
     *
     * @returns Une nouvelle instance avec les jours ajoutés.
     */
    public addDay(quantity: number = 1): Day {
        return this.add(quantity, 'day');
    }

    /**
     * Retourne une nouvelle instance de `Day` avec la quantité de temps spécifiée enlevée.
     * La quantité de temps doit toujours être un multiple d'une journée (e.g. 1 année,
     * 1 semaine, 2 jours)
     *
     * @example
     * ```
     * new Day('2024-01-01').sub(DateTime.duration(7, 'days'));
     * // => new Day('2023-12-24')
     * ```
     *
     * @param duration - Le temps à enlever, sous forme d'instance de `Duration`.
     *
     * @returns Une nouvelle instance avec la durée spécifiée enlevée.
     */
    public sub(duration: Duration): Day;

    /**
     * Retourne une nouvelle instance de `Day` avec la quantité de temps spécifiée enlevée.
     * La quantité de temps doit toujours être un multiple d'une journée (e.g. 1 année,
     * 1 semaine, 2 jours)
     *
     * Les unités ne sont pas sensibles à la casse, supportent
     * le pluriel et les formes raccourcis.
     *
     * @example
     * ```
     * new Day('2024-01-01').sub(7, 'days');
     * // => new Day('2023-12-24')
     * ```
     *
     * @param value - Le temps à enlever, dans l'unité choisie.
     * @param unit - L'unité de temps à enlever (plus grande ou égale au jour).
     *
     * @returns Une nouvelle instance avec le temps spécifié enlevé.
     */
    public sub(value: number, unit?: ManipulateUnit): Day;
    public sub(value: number | Duration, unit?: ManipulateUnit): Day {
        invariant(
            DateTime.isDuration(value) || !EXCLUDED_UNITS.includes(unit as any),
            `It is not possible to subtract ta a unit smaller than a day in a \`Day\` instance.`,
        );

        const newDateTime = DateTime.isDuration(value)
            ? this._dateTime.sub(value)
            : this._dateTime.sub(value, unit);

        invariant(newDateTime.isStartOfDay(), `The duration should be a multiple of one day.`);
        return new Day(newDateTime);
    }

    /**
     * Retourne une nouvelle instance de `Day` avec la quantité d'années spécifiées soustraites.
     *
     * @example
     * ```
     * new Day('2024-01-01').subYear();
     * // => new Day('2023-01-01')
     *
     * new Day('2024-01-01').subYear(10);
     * // => new Day('2014-01-01')
     * ```
     *
     * @param quantity - La quantité d'année à enlever.
     *
     * @returns Une nouvelle instance avec les années spécifiées soustraites.
     */
    public subYear(quantity: number = 1): Day {
        return this.sub(quantity, 'year');
    }

    /**
     * Retourne une nouvelle instance de `Day` avec la quantité de mois spécifiés soustraits.
     *
     * @example
     * ```
     * new Day('2024-01-01').subMonth();
     * // => new Day('2023-12-01')
     *
     * new Day('2024-01-01').subMonth(10);
     * // => new Day('2023-03-01')
     * ```
     *
     * @param quantity - La quantité de mois à enlever.
     *
     * @returns Une nouvelle instance avec les mois spécifiés soustraits.
     */
    public subMonth(quantity: number = 1): Day {
        return this.sub(quantity, 'month');
    }

    /**
     * Retourne une nouvelle instance de `Day` avec la quantité de semaines spécifiées soustraites.
     *
     * Attention, le résultat de cette méthode dépend de la locale actuellement configurée.
     *
     * @example
     * ```
     * new Day('2024-01-01').subWeek();
     * // => new Day('2023-12-25')
     *
     * new Day('2024-01-01').subWeek(10);
     * // => new Day('2023-11-23')
     * ```
     *
     * @param quantity - La quantité de semaines à enlever.
     *
     * @returns Une nouvelle instance avec les semaines spécifiées soustraites.
     */
    public subWeek(quantity: number = 1): Day {
        return this.sub(quantity, 'week');
    }

    /**
     * Retourne une nouvelle instance de `Day` avec la quantité de jours spécifiés soustraits.
     *
     * @example
     * ```
     * new Day('2024-01-01').subDay();
     * // => new Day('2023-12-31')
     *
     * new Day('2024-01-01').subDay(10);
     * // => new Day('2023-12-22')
     * ```
     *
     * @param quantity - La quantité de jours à enlever.
     *
     * @returns Une nouvelle instance avec les jours spécifiés soustraits.
     */
    public subDay(quantity: number = 1): Day {
        return this.sub(quantity, 'day');
    }

    /**
     * Retourne une nouvelle instance de `Day` avec l'unité choisie mise à son début.
     *
     * Cette fonction est équivalente à appeler les méthodes `startOf[Nom long de l'unité au singulier]()`
     * directement (e.g. `startOf('year')` => `startOfYear()`).
     *
     * Les unités ne sont pas sensibles à la casse, supportent
     * le pluriel et les formes raccourcis.
     *
     * @example
     * ```
     * new Day('2024-06-12').startOf('year');
     * // => new Day('2024-01-01')
     *
     * new Day('2024-06-12').startOf('month');
     * // => new Day('2024-06-01')
     * ```
     *
     * @param unit - L'unité à mettre à son début (plus grande ou égale à `week`).
     *
     * @returns Une nouvelle instance avec l'unité choisie mise à son début.
     */
    public startOf(unit: ManipulateUnitWithoutDay): Day {
        invariant(
            !EXCLUDED_UNITS_WITH_DAY.includes(unit as any),
            `Only weeks and longer can be set at the start in a \`Day\` instance.`,
        );
        return new Day(this._dateTime.startOf(unit));
    }

    /**
     * Retourne une nouvelle instance de `Day` avec l'année mise à son début.
     *
     * @example
     * ```
     * new Day('2024-06-12').startOfYear();
     * // => new Day('2024-01-01')
     * ```
     *
     * @returns Une nouvelle instance avec l'année mise à son début.
     */
    public startOfYear(): Day {
        return this.startOf('year');
    }

    /**
     * Retourne une nouvelle instance de `Day` avec le mois mis à son début.
     *
     * @example
     * ```
     * new Day('2024-06-12').startOfMonth();
     * // => new Day('2024-06-01')
     * ```
     *
     * @returns Une nouvelle instance avec le mois mis à son début.
     */
    public startOfMonth(): Day {
        return this.startOf('month');
    }

    /**
     * Retourne une nouvelle instance de `Day` avec la semaine mise à son début.
     *
     * Attention, le résultat de cette méthode dépend de la locale actuellement configurée.
     *
     * @example
     * ```
     * new Day('2024-06-12').startOfWeek();
     * // => new Day('2024-06-10')
     * ```
     *
     * @returns Une nouvelle instance avec la semaine mise à son début.
     */
    public startOfWeek(): Day {
        return this.startOf('week');
    }

    /**
     * Retourne une nouvelle instance de `Day` avec l'unité choisie mise à sa fin.
     *
     * Cette fonction est équivalente à appeler les méthodes `startOf[Nom long de l'unité au singulier]()`
     * directement (e.g. `startOf('year')` => `startOfYear()`).
     *
     * Les unités ne sont pas sensibles à la casse, supportent
     * le pluriel et les formes raccourcis.
     *
     * @example
     * ```
     * new Day('2024-06-12').startOf('year');
     * // => new Day('2024-01-01')
     *
     * new Day('2024-06-12').startOf('month');
     * // => new Day('2024-06-01')
     * ```
     *
     * @param unit - L'unité à mettre à son début (plus grande ou égale à `week`).
     *
     * @returns Une nouvelle instance avec l'unité choisie mise à sa fin.
     */
    public endOf(unit: ManipulateUnitWithoutDay): Day {
        invariant(
            !EXCLUDED_UNITS_WITH_DAY.includes(unit as any),
            `Only weeks and longer can be set at the start in a \`Day\` instance.`,
        );
        return new Day(this._dateTime.endOf(unit, false).startOfDay());
    }

    /**
     * Retourne une nouvelle instance de `Day` avec l'année mise à sa fin.
     *
     * @example
     * ```
     * new Day('2024-06-12').endOfYear();
     * // => new Day('2024-31-12')
     * ```
     *
     * @returns Une nouvelle instance avec l'année mise à sa fin.
     */
    public endOfYear(): Day {
        return this.endOf('year');
    }

    /**
     * Retourne une nouvelle instance de `Day` avec le mois mis à sa fin.
     *
     * @example
     * ```
     * new Day('2024-06-12').endOfMonth();
     * // => new Day('2024-06-30')
     * ```
     *
     * @returns Une nouvelle instance avec le mois mis à sa fin.
     */
    public endOfMonth(): Day {
        return this.endOf('month');
    }

    /**
     * Retourne une nouvelle instance de `Day` avec la semaine mise à sa fin.
     *
     * Attention, le résultat de cette méthode dépend de la locale actuellement configurée.
     *
     * @example
     * ```
     * new Day('2024-06-12').endOfWeek();
     * // => new Day('2024-06-16')
     * ```
     *
     * @returns Une nouvelle instance avec la semaine mise à sa fin.
     */
    public endOfWeek(): Day {
        return this.endOf('week');
    }

    /**
     * Permet de formatter le jour en fonction du template fourni.
     *
     * Note: Pour échapper des caractères, entourez-les avec des crochets (e.g. `[MM]`).
     *
     * @example
     * ```
     * new Day('2024-01-01').format(); // => `2024-01-01`
     * new Day('2024-01-01').format('DD/MM/YYY'); // => `01/01/2024`
     * ```
     *
     * @param template - Le template à utiliser pour formatter le jour (e.g. `DD/MM/YYY`).
     *
     * @returns La date sous forme de chaîne de caractère formatée selon le template.
     */
    public format(template: string = 'YYYY-MM-DD'): string {
        return this._dateTime.format(template);
    }

    /**
     * Retourne l'instance sous forme d'instance de `DateTime`.
     *
     * Note: Ce format pourra être ré-utilisé en entrée.
     *
     * @returns Une instance de `DateTime` équivalente à la présente instance.
     */
    public toDateTime(): DateTime {
        return this._dateTime.clone();
    }

    /**
     * Retourne l'instance sous forme de chaîne caractère au format `Y-m-d`.
     *
     * Note: Ce format pourra être ré-utilisé en entrée.
     *
     * @returns L'instance sous forme de chaîne de caractère.
     */
    public toString(): string {
        return this.format('YYYY-MM-DD');
    }

    /**
     * Retourne l'instance sous forme de chaîne lisible par un humain.
     *
     * @param format - Le format pré-défini dans lequel retourner l'instance, voir {@link ReadableFormat}.
     *                 Par défaut: {@link ReadableFormat.SHORT} (e.g. `01/12/2024`)
     *
     * @returns L'instance sous forme de chaîne lisible par un humain.
     */
    public toReadable(format: ReadableFormat = ReadableFormat.SHORT): string {
        return this.format(format);
    }

    /**
     * Retourne l'instance sous forme serializable dans un objet JSON.
     *
     * Note: Ce format pourra être ré-utilisé en entrée.
     *
     * @returns L'instance sous forme sérialisée.
     */
    public toJSON(): string {
        return this.toString();
    }

    /**
     * Bien que chaque instance de `Day` soit immutable, cette méthode permet
     * de retourner une copie de la présente instance si nécessaire.
     *
     * @returns Un clone de l'instance courante.
     */
    public clone(): Day {
        return new Day(this);
    }

    // ------------------------------------------------------
    // -
    // -    Méthodes utilitaires.
    // -
    // ------------------------------------------------------

    public static today(): Day {
        return new Day();
    }
}

export type {
    ManipulateUnit,
    InclusionPattern,
};

export {
    ReadableFormat as DayReadableFormat,
};

export default Day;
