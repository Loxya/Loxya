import Day from '@/utils/day';
import invariant from 'invariant';
import RawDateTime, { isRawDateTime } from '@/utils/rawDatetime';
import {
    ReadableFormat,
    RoundingMethod,
    TIME_UNITS,
    TIME_UNITS_MAP,
    TIME_UNITS_MAX,
} from './_constants';

import type Period from '@/utils/period';
import type { TimeUnitTypeLong } from 'dayjs';
import type {
    Unit,
    UnitWithWeek,
    UnitWithQuarter,
    TimeUnit,
    Duration,
    DurationUnit,
    LocaleData,
    ManipulateUnit,
    RawDateTimeInstance,
    DurationUnitsObjectType,
} from '@/utils/rawDatetime';

export type DateTimeInput = string | number | DateTime | Date;

/**
 * Une chaîne de caractère avec un format spécial pour paramétrer les inclusions / exclusions.
 *
 * Les formats suivants sont acceptés:
 * - `[)`: La date de début est incluse, la date de fin est exclue.
 * - `(]`: La date de début est exclue, la date de fin est incluse.
 * - `()`: Les dates de début et de fin sont exclus.
 * - `[]`: Les dates de début et de fin sont inclus.
 */
export type InclusionPattern = '()' | '[]' | '[)' | '(]';

/** Une date et heure (e.g. `2024-01-01 14:30:24`) */
class DateTime {
    private readonly _rawDateTime: RawDateTimeInstance;

    constructor(input?: DateTimeInput | RawDateTimeInstance) {
        let rawDateTime: RawDateTimeInstance | undefined;
        if (input === undefined) {
            rawDateTime = RawDateTime.now();
        }
        if (input instanceof DateTime) {
            rawDateTime = input.toRawDateTime();
        }
        if (input instanceof Date || typeof input === 'number') {
            rawDateTime = RawDateTime.from(input);
        }
        if (isRawDateTime(input)) {
            rawDateTime = input.clone();
        }
        if (typeof input === 'string') {
            rawDateTime = RawDateTime.from(input);
        }

        invariant(!!rawDateTime?.isValid(), 'Invalid datetime input.');
        this._rawDateTime = rawDateTime!;
    }

    /**
     * Permet de déterminer si l'instance courante est identique à une autre
     * date (sous forme d'instance ou de tout autre format accepté par `DateTime`).
     *
     * Par défaut, cette méthode compare à la milliseconde près, vous pouvez
     * modifier ce comportement via le paramètre `granularity`.
     *
     * @example
     * ```
     * DateTime.now().isSame(new DateTime('2024-01-01 00:00:00')); // => Booléen.
     * DateTime.now().isSame('2024-01-01 15:12:24', 'year'); // => Booléen.
     * ```
     *
     * @param other - L'autre date avec laquelle comparer l'instance courante.
     *                (dans n'importe quel format accepté par `DateTime`, voir {@link DateTimeInput})
     * @param granularity - Permet de limiter la granularité à une autre unité que les millisecondes.
     *
     * @returns `true` si l'instance courante est identique à la date passée, dans la granularité
     *          choisie (par défaut les millisecondes si non spécifiée), `false` sinon.
     */
    public isSame(other: DateTimeInput, granularity?: UnitWithWeek): boolean {
        const normalizedOther = new DateTime(other);
        return this._rawDateTime.isSame(normalizedOther.toRawDateTime(), granularity);
    }

    /**
     * Permet de déterminer si l'instance courante est identique ou avant une autre
     * date (sous forme d'instance ou de tout autre format accepté par `DateTime`).
     *
     * Par défaut, cette méthode compare à la milliseconde près, vous pouvez
     * modifier ce comportement via le paramètre `granularity`.
     *
     * @example
     * ```
     * DateTime.now().isSameOrBefore(new DateTime('2024-01-01 00:00:00')); // => Booléen.
     * DateTime.now().isSameOrBefore('2024-01-01 15:12:24', 'year'); // => Booléen.
     * ```
     *
     * @param other - L'autre date avec laquelle comparer l'instance courante.
     *                (dans n'importe quel format accepté par `DateTime`, voir {@link DateTimeInput})
     * @param granularity - Permet de limiter la granularité à une autre unité que les millisecondes.
     *
     * @returns `true` si l'instance courante est identique ou avant la date passée, dans la granularité
     *          choisie (par défaut les millisecondes si non spécifiée), `false` sinon.
     */
    public isSameOrBefore(other: DateTimeInput, granularity?: UnitWithWeek): boolean {
        return this.isSame(other, granularity) || this.isBefore(other, granularity);
    }

    /**
     * Permet de déterminer si l'instance courante est identique ou après une autre
     * date (sous forme d'instance ou de tout autre format accepté par `DateTime`).
     *
     * Par défaut, cette méthode compare à la milliseconde près, vous pouvez
     * modifier ce comportement via le paramètre `granularity`.
     *
     * @example
     * ```
     * DateTime.now().isSameOrAfter(new DateTime('2024-01-01 00:00:00')); // => Booléen.
     * DateTime.now().isSameOrAfter('2024-01-01 15:12:24', 'year'); // => Booléen.
     * ```
     *
     * @param other - L'autre date avec laquelle comparer l'instance courante.
     *                (dans n'importe quel format accepté par `DateTime`, voir {@link DateTimeInput})
     * @param granularity - Permet de limiter la granularité à une autre unité que les millisecondes.
     *
     * @returns `true` si l'instance courante est identique ou après la date passée, dans la granularité
     *          choisie (par défaut les millisecondes si non spécifiée), `false` sinon.
     */
    public isSameOrAfter(other: DateTimeInput, granularity?: UnitWithWeek): boolean {
        return this.isSame(other, granularity) || this.isAfter(other, granularity);
    }

    /**
     * Permet de déterminer si l'instance courante est avant une autre
     * date (sous forme d'instance ou de tout autre format accepté par `DateTime`).
     *
     * Par défaut, cette méthode compare à la milliseconde près, vous pouvez
     * modifier ce comportement via le paramètre `granularity`.
     *
     * @example
     * ```
     * DateTime.now().isBefore(new DateTime('2024-01-01 00:00:00')); // => Booléen.
     * DateTime.now().isBefore('2024-01-01 15:12:24', 'year'); // => Booléen.
     * ```
     *
     * @param other - L'autre date avec laquelle comparer l'instance courante.
     *                (dans n'importe quel format accepté par `DateTime`, voir {@link DateTimeInput})
     * @param granularity - Permet de limiter la granularité à une autre unité que les millisecondes.
     *
     * @returns `true` si l'instance courante est avant la date passée, dans la granularité
     *          choisie (par défaut les millisecondes si non spécifiée), `false` sinon.
     */
    public isBefore(other: DateTimeInput, granularity?: UnitWithWeek): boolean {
        const normalizedOther = new DateTime(other);
        return this._rawDateTime.isBefore(normalizedOther.toRawDateTime(), granularity);
    }

    /**
     * Permet de déterminer si l'instance courante est après une autre
     * date (sous forme d'instance ou de tout autre format accepté par `DateTime`).
     *
     * Par défaut, cette méthode compare à la milliseconde près, vous pouvez
     * modifier ce comportement via le paramètre `granularity`.
     *
     * @example
     * ```
     * DateTime.now().isAfter(new DateTime('2024-01-01 00:00:00')); // => Booléen.
     * DateTime.now().isAfter('2024-01-01 15:12:24', 'year'); // => Booléen.
     * ```
     *
     * @param other - L'autre date avec laquelle comparer l'instance courante.
     *                (dans n'importe quel format accepté par `DateTime`, voir {@link DateTimeInput})
     * @param granularity - Permet de limiter la granularité à une autre unité que les millisecondes.
     *
     * @returns `true` si l'instance courante est après la date passée, dans la granularité
     *          choisie (par défaut les millisecondes si non spécifiée), `false` sinon.
     */
    public isAfter(other: DateTimeInput, granularity?: UnitWithWeek): boolean {
        const normalizedOther = new DateTime(other);
        return this._rawDateTime.isAfter(normalizedOther.toRawDateTime(), granularity);
    }

    /**
     * Permet de déterminer si l'instance courante est comprise dans une période donnée.
     *
     * @example
     * ```
     * DateTime.now().isBetween(new Period('2024-01-01 00:00:00', '2024-02-01 00:00:00')); // => Booléen.
     * DateTime.now().isBetween(new Period('2024-01-01 00:00:00', '2024-02-01 00:00:00'), '[]'); // => Booléen.
     * ```
     *
     * @param period - Une instance de `Period` dans laquelle on cherche à savoir si la date se trouve.
     * @param inclusionPattern - Une chaîne de caractère avec un format spécial pour paramétrer les
     *                           inclusions / exclusions. Voir {@link InclusionPattern}.
     *                           Par défaut, la date de début est incluse et la date de fin
     *                           est exclue (= `[)`).
     *
     * @returns `true` si l'instance courante se trouve dans la période, `false` sinon.
     */
    public isBetween(period: Period, inclusionPattern: InclusionPattern = '[)'): boolean {
        const normalizedPeriod = period.setFullDays(false);
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
     * Permet d'effectuer une comparaison avec une autre date (sous forme d'instance
     * ou de tout autre format accepté par `DateTime`) et de retourner le résultat sous forme
     * d'entier (pouvant par exemple être utilisé pour du tri dans un callback passé à `Array.sort()`).
     *
     * @example
     * ```
     * [new Day('2024-01-01 15:12:24'), new Day('2024-01-01 14:30:00')].sort((a, b) => a.compare(b));
     * // => [new Day('2024-01-01 14:30:00'), new Day('2024-01-01 15:12:24')]
     *
     * [new Day('2024-01-01 15:12:24'), new Day('2024-01-01 14:30:00')].sort((a, b) => !a.compare(b));
     * // => [new Day('2024-01-01 15:12:24'), new Day('2024-01-01 14:30:00')]
     * ```
     *
     * @param other - L'autre date avec laquelle comparer l'instance courante.
     *                (dans n'importe quel format accepté par `DateTime`, voir {@link DateTimeInput})
     * @param granularity - Permet de limiter la granularité à une autre unité que les millisecondes.
     *
     * @returns Un nombre représentant le résultat de la comparaison:
     *          - `-1`: Si l'instance courante est "avant" la date comparée dans la granularité
     *                  choisie (par défaut à les millisecondes si non spécifiée).
     *          - `0`: Si l'instance courante est "égale" à la date comparée dans la granularité
     *                  choisie (par défaut à les millisecondes si non spécifiée).
     *          - `1`: Si l'instance courante est "après" la date comparée dans la granularité
     *                  choisie (par défaut à les millisecondes si non spécifiée).
     */
    public compare(other: DateTimeInput, granularity?: UnitWithWeek): number {
        const normalizedOther = new DateTime(other);
        if (this.isSame(normalizedOther, granularity)) {
            return 0;
        }
        return this.isBefore(normalizedOther, granularity) ? -1 : 1;
    }

    /**
     * Permet de déterminer si l'instance courante est dans le passé.
     *
     * @example
     * ```
     * new DateTime('2024-01-01 14:36:21').isPast(); // => Booléen.
     * ```
     *
     * @returns `true` si l'instance courante est dans le passé, `false` sinon.
     */
    public isPast(): boolean {
        return this.isBefore(DateTime.now());
    }

    /**
     * Permet de déterminer si l'instance courante est dans le futur.
     *
     * @example
     * ```
     * new DateTime('2024-01-01 14:36:21').isFuture(); // => Booléen.
     * ```
     *
     * @returns `true` si l'instance courante est dans le futur, `false` sinon.
     */
    public isFuture(): boolean {
        return this.isAfter(DateTime.now());
    }

    /**
     * Permet d'obtenir une nouvelle instance de `DateTime` avec la
     * valeur d'une unité de la date modifiée.
     *
     * Les unités ne sont pas sensibles à la casse, supportent
     * le pluriel et les formes raccourcis.
     *
     * @example
     * ```
     * DateTime.now().set('date', 1);
     * DateTime.now().set('month', 3); // - Avril.
     * DateTime.now().set('second', 30);
     * ```
     *
     * @param unit - L'unité dont on veut modifier la valeur.
     * @param value - La nouvelle valeur de l'unité.
     *
     * @returns Une nouvelle instance avec l'unité modifiée comme spécifié.
     */
    public set(unit: Unit, value: number): DateTime;

    /**
     * Permet d'obtenir une nouvelle instance de `DateTime` avec la
     * valeur de plusieurs unités de la date modifiées.
     *
     * Les unités ne sont pas sensibles à la casse, supportent
     * le pluriel et les formes raccourcis.
     *
     * @example
     * ```
     * DateTime.now().set({
     *     date: 1,
     *     month: 3, // - Avril
     *     second: 30,
     * });
     * ```
     *
     * @param units - Un object contenant en clé les unités à modifier et
     *                en valeur, leur nouvelle valeur.
     *
     * @returns Une nouvelle instance avec les unités modifiées comme spécifié.
     */
    public set(units: Partial<Record<Unit, number>>): DateTime;
    public set(unit: Unit | Partial<Record<Unit, number>>, value?: number): DateTime {
        const units: Array<[Unit, number]> = typeof unit !== 'string'
            ? Object.entries(unit) as Array<[Unit, number]>
            : [[unit, value!]];

        return new DateTime(units.reduce(
            (rawDateTime: RawDateTimeInstance, [_unit, _value]: [Unit, number]) => (
                rawDateTime.set(_unit, _value)
            ),
            this._rawDateTime,
        ));
    }

    /**
     * Permet, à partir d'une chaîne représentant les heures / minutes / secondes,
     * d'obtenir une nouvelle instance de `DateTime` avec la valeur de temps modifiée.
     *
     * @example
     * ```
     * DateTime.now().setTime('12:30');
     * DateTime.now().setTime('12:30:54');
     * ```
     *
     * @param time - Une chaîne représentant les heures / minutes / secondes sous
     *               la forme `[heures]:[minutes][:[secondes]]`.
     *
     * @returns Une nouvelle instance avec la valeur de temps modifiée.
     */
    public setTime(time: string): DateTime {
        // @see https://regex101.com/r/bg1OMQ/1
        const REGEX = /^(?<h>0[0-9]|1[0-9]|2[0-4]):(?<m>[0-5][0-9])(?::(?<s>[0-5][0-9])(?:\.(?<ms>[0-9]{3}))?)?$/;

        const matches = time.match(REGEX);
        invariant(matches !== null, 'The time string should at least contain the hours + minutes (e.g. `hh:mm`).');

        return this.set({
            hours: parseInt(matches.groups!.h, 10),
            minutes: parseInt(matches.groups!.m, 10),
            seconds: (
                matches.groups!.s !== undefined
                    ? parseInt(matches.groups!.s, 10)
                    : 0
            ),
            milliseconds: (
                matches.groups!.ms !== undefined
                    ? parseInt(matches.groups!.ms, 10)
                    : 0
            ),
        });
    }

    /**
     * Permet de récupérer la valeur d'une unité de la date.
     *
     * Les unités ne sont pas sensibles à la casse, supportent
     * le pluriel et les formes raccourcis.
     *
     * @example
     * ```
     * DateTime.now().get('year');
     * DateTime.now().get('month'); // - Commence à 0.
     * DateTime.now().get('date');
     * ```
     *
     * @param unit - L'unité dont on veut récupérer la valeur.
     *
     * @returns La valeur de l'unité.
     */
    public get(unit: Unit): number {
        return this._rawDateTime.get(unit);
    }

    /**
     * Retourne une nouvelle instance de `DateTime` avec la quantité de temps spécifiée ajoutée.
     *
     * @example
     * ```
     * new DateTime('2024-01-01 23:55:21').add(DateTime.duration(7, 'days'));
     * // => new DateTime('2024-01-08 23:55:21')
     * ```
     *
     * @param duration - Le temps à ajouter, sous forme d'instance de `Duration`.
     *
     * @returns Une nouvelle instance avec la durée spécifiée ajoutée.
     */
    public add(duration: Duration): DateTime;

    /**
     * Retourne une nouvelle instance de `DateTime` avec la quantité de temps spécifiée ajoutée.
     *
     * Les unités ne sont pas sensibles à la casse, supportent
     * le pluriel et les formes raccourcis.
     *
     * @example
     * ```
     * new DateTime('2024-01-01 23:55:21').add(7, 'days');
     * // => new DateTime('2024-01-08 23:55:21')
     * ```
     *
     * @param value - Le temps à ajouter, dans l'unité choisie.
     * @param unit - L'unité de temps à ajouter.
     *
     * @returns Une nouvelle instance avec le temps spécifié ajouté.
     */
    public add(value: number, unit?: ManipulateUnit): DateTime;
    public add(value: number | Duration, unit?: ManipulateUnit): DateTime {
        return new DateTime((
            DateTime.isDuration(value)
                ? this._rawDateTime.add(value)
                : this._rawDateTime.add(value, unit)
        ));
    }

    /**
     * Retourne une nouvelle instance de `DateTime` avec la quantité d'années spécifiées ajoutées.
     *
     * @example
     * ```
     * new DateTime('2024-01-01 23:55:21').addYear();
     * // => new DateTime('2025-01-01 23:55:21')
     *
     * new DateTime('2024-01-01 23:55:21').addYear(10);
     * // => new DateTime('2034-01-01 23:55:21')
     * ```
     *
     * @param quantity - La quantité d'année à ajouter.
     *
     * @returns Une nouvelle instance avec les années ajoutées.
     */
    public addYear(quantity: number = 1): DateTime {
        return this.add(quantity, 'year');
    }

    /**
     * Retourne une nouvelle instance de `DateTime` avec la quantité de mois spécifiés ajoutés.
     *
     * @example
     * ```
     * new DateTime('2024-01-01 23:55:21').addMonth();
     * // => new DateTime('2024-02-01 23:55:21')
     *
     * new DateTime('2024-01-01 23:55:21').addMonth(10);
     * // => new DateTime('2024-11-01 23:55:21')
     * ```
     *
     * @param quantity - La quantité de mois à ajouter.
     *
     * @returns Une nouvelle instance avec les mois ajoutés.
     */
    public addMonth(quantity: number = 1): DateTime {
        return this.add(quantity, 'month');
    }

    /**
     * Retourne une nouvelle instance de `DateTime` avec la quantité de semaines spécifiées ajoutées.
     *
     * Attention, le résultat de cette méthode dépend de la locale actuellement configurée.
     *
     * @example
     * ```
     * new DateTime('2024-01-01 23:55:21').addWeek();
     * // => new DateTime('2024-01-08 23:55:21')
     *
     * new DateTime('2024-01-01 23:55:21').addWeek(10);
     * // => new DateTime('2024-03-11 23:55:21')
     * ```
     *
     * @param quantity - La quantité de semaines à ajouter.
     *
     * @returns Une nouvelle instance avec les semaines ajoutées.
     */
    public addWeek(quantity: number = 1): DateTime {
        return this.add(quantity, 'week');
    }

    /**
     * Retourne une nouvelle instance de `DateTime` avec la quantité de jours spécifiés ajoutés.
     *
     * @example
     * ```
     * new DateTime('2024-01-01 23:55:21').addDay();
     * // => new DateTime('2024-01-02 23:55:21')
     *
     * new DateTime('2024-01-01 23:55:21').addDay(10);
     * // => new DateTime('2024-01-11 23:55:21')
     * ```
     *
     * @param quantity - La quantité de jours à ajouter.
     *
     * @returns Une nouvelle instance avec les jours ajoutés.
     */
    public addDay(quantity: number = 1): DateTime {
        return this.add(quantity, 'day');
    }

    /**
     * Retourne une nouvelle instance de `DateTime` avec la quantité d'heures spécifiées ajoutées.
     *
     * @example
     * ```
     * new DateTime('2024-01-01 23:55:21').addHour();
     * // => new DateTime('2024-01-02 00:55:21')
     *
     * new DateTime('2024-01-01 23:55:21').addHour(10);
     * // => new DateTime('2024-01-02 09:55:21')
     * ```
     *
     * @param quantity - La quantité d'heures à ajouter.
     *
     * @returns Une nouvelle instance avec les heures ajoutées.
     */
    public addHour(quantity: number = 1): DateTime {
        return this.add(quantity, 'hour');
    }

    /**
     * Retourne une nouvelle instance de `DateTime` avec la quantité de minutes spécifiées ajoutées.
     *
     * @example
     * ```
     * new DateTime('2024-01-01 23:55:21').addMinute();
     * // => new DateTime('2024-01-01 23:56:21')
     *
     * new DateTime('2024-01-01 23:55:21').addMinute(10);
     * // => new DateTime('2024-01-02 00:05:21')
     * ```
     *
     * @param quantity - La quantité de minutes à ajouter.
     *
     * @returns Une nouvelle instance avec les minutes ajoutées.
     */
    public addMinute(quantity: number = 1): DateTime {
        return this.add(quantity, 'minute');
    }

    /**
     * Retourne une nouvelle instance de `DateTime` avec la quantité de secondes spécifiées ajoutées.
     *
     * @example
     * ```
     * new DateTime('2024-01-01 23:55:21').addSecond();
     * // => new DateTime('2024-01-01 23:55:22')
     *
     * new DateTime('2024-01-01 23:55:21').addSecond(10);
     * // => new DateTime('2024-01-01 23:55:31')
     * ```
     *
     * @param quantity - La quantité de secondes à ajouter.
     *
     * @returns Une nouvelle instance avec les secondes ajoutées.
     */
    public addSecond(quantity: number = 1): DateTime {
        return this.add(quantity, 'second');
    }

    /**
     * Retourne une nouvelle instance de `DateTime` avec la quantité de temps spécifiée enlevée.
     *
     * @example
     * ```
     * new DateTime('2024-01-01 23:55:21').sub(DateTime.duration(7, 'days'));
     * // => new DateTime('2023-12-24 23:55:21')
     * ```
     *
     * @param duration - Le temps à enlever, sous forme d'instance de `Duration`.
     *
     * @returns Une nouvelle instance avec la durée spécifiée enlevé.
     */
    public sub(duration: Duration): DateTime;

    /**
     * Retourne une nouvelle instance de `DateTime` avec la quantité de temps spécifiée enlevée.
     *
     * Les unités ne sont pas sensibles à la casse, supportent
     * le pluriel et les formes raccourcis.
     *
     * ```
     * new DateTime('2024-01-01 23:55:21').sub(7, 'days');
     * // => new DateTime('2023-12-24 23:55:21')
     * ```
     *
     * @param value - Le temps à enlever, dans l'unité choisie.
     * @param unit - L'unité de temps à enlever.
     *
     * @returns Une nouvelle instance avec le temps spécifié enlevé.
     */
    public sub(value: number, units?: ManipulateUnit): DateTime;
    public sub(value: number | Duration, unit?: ManipulateUnit): DateTime {
        return new DateTime((
            DateTime.isDuration(value)
                ? this._rawDateTime.subtract(value)
                : this._rawDateTime.subtract(value, unit)
        ));
    }

    /**
     * Retourne une nouvelle instance de `DateTime` avec la quantité d'années spécifiées soustraites.
     *
     * @example
     * ```
     * new DateTime('2024-01-01 23:55:21').subYear();
     * // => new DateTime('2023-01-01 23:55:21')
     *
     * new DateTime('2024-01-01 23:55:21').subYear(10);
     * // => new DateTime('2014-01-01 23:55:21')
     * ```
     *
     * @param quantity - La quantité d'année à enlever.
     *
     * @returns Une nouvelle instance avec les années spécifiées soustraites.
     */
    public subYear(quantity: number = 1): DateTime {
        return this.sub(quantity, 'year');
    }

    /**
     * Retourne une nouvelle instance de `DateTime` avec la quantité de mois spécifiés soustraits.
     *
     * @example
     * ```
     * new DateTime('2024-01-01 23:55:21').subMonth();
     * // => new DateTime('2023-12-01 23:55:21')
     *
     * new DateTime('2024-01-01 23:55:21').subMonth(10);
     * // => new DateTime('2023-03-01 23:55:21')
     * ```
     *
     * @param quantity - La quantité de mois à enlever.
     *
     * @returns Une nouvelle instance avec les mois spécifiés soustraits.
     */
    public subMonth(quantity: number = 1): DateTime {
        return this.sub(quantity, 'month');
    }

    /**
     * Retourne une nouvelle instance de `DateTime` avec la quantité de semaines spécifiées soustraites.
     *
     * Attention, le résultat de cette méthode dépend de la locale actuellement configurée.
     *
     * @example
     * ```
     * new DateTime('2024-01-01 23:55:21').subWeek();
     * // => new DateTime('2023-12-25 23:55:21')
     *
     * new DateTime('2024-01-01 23:55:21').subWeek(10);
     * // => new DateTime('2023-11-23 23:55:21')
     * ```
     *
     * @param quantity - La quantité de semaines à enlever.
     *
     * @returns Une nouvelle instance avec les semaines spécifiées soustraites.
     */
    public subWeek(quantity: number = 1): DateTime {
        return this.sub(quantity, 'week');
    }

    /**
     * Retourne une nouvelle instance de `DateTime` avec la quantité de jours spécifiés soustraits.
     *
     * @example
     * ```
     * new DateTime('2024-01-01 23:55:21').subDay();
     * // => new DateTime('2023-12-31 23:55:21')
     *
     * new DateTime('2024-01-01 23:55:21').subDay(10);
     * // => new DateTime('2023-12-22 23:55:21')
     * ```
     *
     * @param quantity - La quantité de jours à enlever.
     *
     * @returns Une nouvelle instance avec les jours spécifiés soustraits.
     */
    public subDay(quantity: number = 1): DateTime {
        return this.sub(quantity, 'day');
    }

    /**
     * Retourne une nouvelle instance de `DateTime` avec la quantité d'heures spécifiées soustraites.
     *
     * @example
     * ```
     * new DateTime('2024-01-01 23:55:21').subHour();
     * // => new DateTime('2024-01-01 22:55:21')
     *
     * new DateTime('2024-01-01 23:55:21').subHour(10);
     * // => new DateTime('2024-01-01 13:55:21')
     * ```
     *
     * @param quantity - La quantité d'heures à enlever.
     *
     * @returns Une nouvelle instance avec les heures spécifiées soustraites.
     */
    public subHour(quantity: number = 1): DateTime {
        return this.sub(quantity, 'hour');
    }

    /**
     * Retourne une nouvelle instance de `DateTime` avec la quantité de minutes spécifiées soustraites.
     *
     * @example
     * ```
     * new DateTime('2024-01-01 23:55:21').subMinute();
     * // => new DateTime('2024-01-01 23:54:21')
     *
     * new DateTime('2024-01-01 23:55:21').subMinute(10);
     * // => new DateTime('2024-01-01 23:45:21')
     * ```
     *
     * @param quantity - La quantité de minutes à enlever.
     *
     * @returns Une nouvelle instance avec les minutes spécifiées soustraites.
     */
    public subMinute(quantity: number = 1): DateTime {
        return this.sub(quantity, 'minute');
    }

    /**
     * Retourne une nouvelle instance de `DateTime` avec la quantité de secondes spécifiées soustraites.
     *
     * @example
     * ```
     * new DateTime('2024-01-01 23:55:21').subSecond();
     * // => new DateTime('2024-01-01 23:55:20')
     *
     * new DateTime('2024-01-01 23:55:21').subSecond(10);
     * // => new DateTime('2024-01-01 23:55:11')
     * ```
     *
     * @param quantity - La quantité de secondes à enlever.
     *
     * @returns Une nouvelle instance avec les secondes spécifiées soustraites.
     */
    public subSecond(quantity: number = 1): DateTime {
        return this.sub(quantity, 'second');
    }

    /**
     * Retourne une nouvelle instance de `DateTime` avec l'unité choisie mise à son début.
     *
     * Cette fonction est équivalente à appeler les méthodes `startOf[Nom long de l'unité au singulier]()`
     * directement (e.g. `startOf('minute')` => `startOfMinute()`).
     *
     * Les unités ne sont pas sensibles à la casse, supportent
     * le pluriel et les formes raccourcis.
     *
     * @example
     * ```
     * new DateTime('2024-06-12 14:30:24').startOf('year');
     * // => new DateTime('2024-01-01 00:00:00')
     *
     * new DateTime('2024-06-12 14:30:24').startOf('month');
     * // => new DateTime('2024-06-01 00:00:00')
     *
     * new DateTime('2024-06-12 14:30:24').startOf('hour');
     * // => new DateTime('2024-06-12 14:00:00')
     *
     * new DateTime('2024-06-12 14:30:24').startOf('minute');
     * // => new DateTime('2024-06-12 14:30:00')
     * ```
     *
     * @param unit - L'unité à mettre à son début.
     *
     * @returns Une nouvelle instance avec l'unité choisie mise à son début.
     */
    public startOf(unit: ManipulateUnit): DateTime {
        return new DateTime(this._rawDateTime.startOf(unit));
    }

    /**
     * Retourne une nouvelle instance de `DateTime` avec l'année mise à son début.
     *
     * @example
     * ```
     * new DateTime('2024-06-12 14:30:24').startOfYear();
     * // => new DateTime('2024-01-01 00:00:00')
     * ```
     *
     * @returns Une nouvelle instance avec l'année mise à son début.
     */
    public startOfYear(): DateTime {
        return this.startOf('year');
    }

    /**
     * Retourne une nouvelle instance de `DateTime` avec le mois mis à son début.
     *
     * @example
     * ```
     * new DateTime('2024-06-12 14:30:24').startOfMonth();
     * // => new DateTime('2024-06-01 00:00:00')
     * ```
     *
     * @returns Une nouvelle instance avec le mois mis à son début.
     */
    public startOfMonth(): DateTime {
        return this.startOf('month');
    }

    /**
     * Retourne une nouvelle instance de `DateTime` avec la semaine mise à son début.
     *
     * Attention, le résultat de cette méthode dépend de la locale actuellement configurée.
     *
     * @example
     * ```
     * new DateTime('2024-06-12 14:30:24').startOfWeek();
     * // => new DateTime('2024-06-10 00:00:00')
     * ```
     *
     * @returns Une nouvelle instance avec la semaine mise à son début.
     */
    public startOfWeek(): DateTime {
        return this.startOf('week');
    }

    /**
     * Retourne une nouvelle instance de `DateTime` avec la journée mise à son début.
     *
     * @example
     * ```
     * new DateTime('2024-06-12 14:30:24').startOfDay();
     * // => new DateTime('2024-06-12 00:00:00')
     * ```
     *
     * @returns Une nouvelle instance avec la journée mise à son début.
     */
    public startOfDay(): DateTime {
        return this.startOf('day');
    }

    /**
     * Retourne une nouvelle instance de `DateTime` avec l'heure mise à son début.
     *
     * @example
     * ```
     * new DateTime('2024-06-12 14:30:24').startOfHour();
     * // => new DateTime('2024-06-12 14:00:00')
     * ```
     *
     * @returns Une nouvelle instance avec l'heure mise à son début.
     */
    public startOfHour(): DateTime {
        return this.startOf('hour');
    }

    /**
     * Retourne une nouvelle instance de `DateTime` avec les minutes mises à leur début.
     *
     * @example
     * ```
     * new DateTime('2024-06-12 14:30:24').startOfMinute();
     * // => new DateTime('2024-06-12 14:30:00')
     * ```
     *
     * @returns Une nouvelle instance avec les minutes mises à leur début.
     */
    public startOfMinute(): DateTime {
        return this.startOf('minute');
    }

    /**
     * Retourne une nouvelle instance de `DateTime` avec les secondes mises à leur début.
     *
     * @example
     * ```
     * new DateTime('2024-06-12 14:30:24.333').startOfSecond();
     * // => new DateTime('2024-06-12 14:30:24')
     * ```
     *
     * @returns Une nouvelle instance avec les secondes mises à leur début.
     */
    public startOfSecond(): DateTime {
        return this.startOf('second');
    }

    /**
     * Retourne une nouvelle instance de `DateTime` avec l'unité choisie mise à sa fin.
     *
     * Cette fonction est équivalente à appeler les méthodes `endOf[Nom long de l'unité au singulier]()`
     * directement (e.g. `endOf('minute')` => `endOfMinute()`).
     *
     * Les unités ne sont pas sensibles à la casse, supportent
     * le pluriel et les formes raccourcis.
     *
     * @example
     * ```
     * new DateTime('2024-06-12 14:30:24').endOf('year');
     * // => new DateTime('2024-12-31 23:59:59.999')
     *
     * new DateTime('2024-06-12 14:30:24').endOf('year', true);
     * // => new DateTime('2025-01-01 00:00:00')
     *
     * new DateTime('2024-06-12 14:30:24').endOf('month');
     * // => new DateTime('2024-06-30 23:59:59.999')
     *
     * new DateTime('2024-06-12 14:30:24').endOf('hour');
     * // => new DateTime('2024-06-12 14:59:59.999')
     *
     * new DateTime('2024-06-12 14:30:24').endOf('minute');
     * // => new DateTime('2024-06-12 13:32:59.999')
     * ```
     *
     * @param unit - L'unité à mettre à sa fin.
     * @param leap - Dois-t'on faire correspondre la fin au début de la période suivante ?
     *               Si `false`, la fin utilisée sera la dernière milliseconde de
     *               la période de l'unité choisie.
     *
     * @returns Une nouvelle instance avec l'unité choisie mise à sa fin.
     */
    public endOf(unit: ManipulateUnit, leap: boolean = false): DateTime {
        const end = new DateTime(this._rawDateTime.endOf(unit));
        return !leap ? end : end.add(1, unit).startOf(unit);
    }

    /**
     * Retourne une nouvelle instance de `DateTime` avec l'année mise à sa fin.
     *
     * @example
     * ```
     * new DateTime('2024-06-12 14:30:24').endOfYear();
     * // => new DateTime('2024-31-12 23:59:59.999')
     *
     * new DateTime('2024-06-12 14:30:24').endOfYear(true);
     * // => new DateTime('2025-01-01 00:00:00')
     * ```
     *
     * @param leap - Dois-t'on faire correspondre la fin au début de la période suivante ?
     *               Si `false`, la fin utilisée sera `23:59:59` du dernier jour de l'année.
     *
     * @returns Une nouvelle instance avec l'année mise à sa fin.
     */
    public endOfYear(leap: boolean = false): DateTime {
        return this.endOf('year', leap);
    }

    /**
     * Retourne une nouvelle instance de `DateTime` avec le mois mis à sa fin.
     *
     * @example
     * ```
     * new DateTime('2024-06-12 14:30:24').endOfMonth();
     * // => new DateTime('2024-06-30 23:59:59.999')
     *
     * new DateTime('2024-06-12 14:30:24').endOfMonth(true);
     * // => new DateTime('2024-07-01 00:00:00')
     * ```
     *
     * @param leap - Dois-t'on faire correspondre la fin au début de la période suivante ?
     *               Si `false`, la fin utilisée sera `23:59:59` du dernier jour du mois.
     *
     * @returns Une nouvelle instance avec le mois mis à sa fin.
     */
    public endOfMonth(leap: boolean = false): DateTime {
        return this.endOf('month', leap);
    }

    /**
     * Retourne une nouvelle instance de `DateTime` avec la semaine mise à sa fin.
     *
     * Attention, le résultat de cette méthode dépend de la locale actuellement configurée.
     *
     * @example
     * ```
     * new DateTime('2024-06-12 14:30:24').endOfWeek();
     * // => new DateTime('2024-06-16 23:59:59.999')
     *
     * new DateTime('2024-06-12 14:30:24').endOfWeek(true);
     * // => new DateTime('2024-06-17 00:00:00')
     * ```
     *
     * @param leap - Dois-t'on faire correspondre la fin au début de la période suivante ?
     *               Si `false`, la fin utilisée sera `23:59:59` du dernier jour de la semaine.
     *
     * @returns Une nouvelle instance avec la semaine mise à sa fin.
     */
    public endOfWeek(leap: boolean = false): DateTime {
        return this.endOf('week', leap);
    }

    /**
     * Retourne une nouvelle instance de `DateTime` avec la journée mise à sa fin.
     *
     * @example
     * ```
     * new DateTime('2024-06-12 14:30:24').endOfDay();
     * // => new DateTime('2024-06-12 23:59:59.999')
     *
     * new DateTime('2024-06-12 14:30:24').endOfDay(true);
     * // => new DateTime('2024-06-13 00:00:00')
     * ```
     *
     * @param leap - Dois-t'on faire correspondre la fin au début de la période suivante ?
     *               Si `false`, la fin utilisée sera `23:59:59` de la journée.
     *
     * @returns Une nouvelle instance avec la journée mise à sa fin.
     */
    public endOfDay(leap: boolean = false): DateTime {
        return this.endOf('day', leap);
    }

    /**
     * Retourne une nouvelle instance de `DateTime` avec l'heure mise à sa fin.
     *
     * @example
     * ```
     * new DateTime('2024-06-12 14:30:24').endOfHour();
     * // => new DateTime('2024-06-12 14:59:59.999')
     *
     * new DateTime('2024-06-12 14:30:24').endOfHour(true);
     * // => new DateTime('2024-06-12 15:00:00')
     * ```
     *
     * @param leap - Dois-t'on faire correspondre la fin au début de la période suivante ?
     *               Si `false`, la fin utilisée sera `:59:59` de l'heure actuelle de l'instance.
     *
     * @returns Une nouvelle instance avec l'heure mise à sa fin.
     */
    public endOfHour(leap: boolean = false): DateTime {
        return this.endOf('hour', leap);
    }

    /**
     * Retourne une nouvelle instance de `DateTime` avec les minutes mises à leur fin.
     *
     * @example
     * ```
     * new DateTime('2024-06-12 14:30:24').endOfMinute();
     * // => new DateTime('2024-06-12 14:30:59.999')
     *
     * new DateTime('2024-06-12 14:30:24').endOfMinute(true);
     * // => new DateTime('2024-06-12 14:31:00')
     * ```
     *
     * @param leap - Dois-t'on faire correspondre la fin au début de la période suivante ?
     *               Si `false`, la fin utilisée sera `59` de la minute actuelle de l'instance.
     *
     * @returns Une nouvelle instance avec les minutes mises à leur fin.
     */
    public endOfMinute(leap: boolean = false): DateTime {
        return this.endOf('minute', leap);
    }

    /**
     * Retourne une nouvelle instance de `DateTime` avec les secondes mises à leur fin.
     *
     * @example
     * ```
     * new DateTime('2024-06-12 14:30:24.333').endOfSecond();
     * // => new DateTime('2024-06-12 14:30:24.999'
     *
     * new DateTime('2024-06-12 14:30:24').endOfSecond(true);
     * // => new DateTime('2024-06-12 14:30:25')
     * ```
     *
     * @param leap - Dois-t'on faire correspondre la fin au début de la période suivante ?
     *               Si `false`, la fin utilisée sera `999` des millisecondes actuelle de l'instance.
     *
     * @returns Une nouvelle instance avec les secondes mises à leur fin.
     */
    public endOfSecond(leap: boolean = false): DateTime {
        return this.endOf('second', leap);
    }

    /**
     * Retourne `true` si la date est au début de l'unité choisie, sinon `false`.
     *
     * Cette fonction est équivalente à appeler les méthodes `isStartOf[Nom long de l'unité au singulier]()`
     * directement (e.g. `isStartOf('minute')` => `isStartOfMinute()`).
     *
     * Les unités ne sont pas sensibles à la casse, supportent
     * le pluriel et les formes raccourcis.
     *
     * @example
     * ```
     * new DateTime('2024-06-12 14:30:24').isStartOf('year');
     * // => false
     * new DateTime('2024-01-01 00:00:00').isStartOf('year');
     * // => true
     *
     * new DateTime('2024-06-12 14:30:24').isStartOf('month');
     * // => false
     * new DateTime('2024-06-01 00:00:00').isStartOf('month');
     * // => true
     *
     * new DateTime('2024-06-12 14:30:24').isStartOf('hour');
     * // => false
     * new DateTime('2024-06-12 14:00:00').isStartOf('hour');
     * // => true
     *
     * new DateTime('2024-06-12 14:30:24').isStartOf('minute');
     * // => false
     * new DateTime('2024-06-12 14:30:00').isStartOf('minute');
     * // => true
     * ```
     *
     * @param unit - L'unité à vérifier.
     *
     * @returns `true` si la date est au début de l'unité choisie, `false` sinon.
     */
    public isStartOf(unit: ManipulateUnit): boolean {
        return this.isSame(this.startOf(unit));
    }

    /**
     * Retourne `true` si la date est au début de l'année, sinon `false`.
     *
     * @example
     * ```
     * new DateTime('2024-06-12 14:30:24').isStartOfYear();
     * // => false
     *
     * new DateTime('2024-01-01 00:00:00').isStartOfYear();
     * // => true
     * ```
     *
     * @returns Une nouvelle instance avec l'année mise à son début.
     */
    public isStartOfYear(): boolean {
        return this.isStartOf('year');
    }

    /**
     * Retourne `true` si la date est au début du mois, sinon `false`.
     *
     * @example
     * ```
     * new DateTime('2024-06-12 14:30:24').isStartOfMonth();
     * // => false
     *
     * new DateTime('2024-06-01 00:00:00').isStartOfMonth();
     * // => true
     * ```
     *
     * @returns Une nouvelle instance avec le mois mis à son début.
     */
    public isStartOfMonth(): boolean {
        return this.isStartOf('month');
    }

    /**
     * Retourne `true` si la date est au début de la semaine, sinon `false`.
     *
     * Attention, le résultat de cette méthode dépend de la locale actuellement configurée.
     *
     * @example
     * ```
     * new DateTime('2024-06-12 14:30:24').isStartOfWeek();
     * // => false
     *
     * new DateTime('2024-06-10 00:00:00').isStartOfWeek();
     * // => true
     * ```
     *
     * @returns Une nouvelle instance avec la semaine mise à son début.
     */
    public isStartOfWeek(): boolean {
        return this.isStartOf('week');
    }

    /**
     * Retourne `true` si la date est au début de la journée, sinon `false`.
     *
     * @example
     * ```
     * new DateTime('2024-01-01 12:05:00').isStartOfDay();
     * // => false
     *
     * new DateTime('2024-01-01 00:00:00').isStartOfDay()
     * // => true
     * ```
     *
     * @returns Une nouvelle instance avec la journée mise à son début.
     */
    public isStartOfDay(): boolean {
        return this.isStartOf('day');
    }

    /**
     * Retourne `true` si la date est au début de l'heure, sinon `false`.
     *
     * @example
     * ```
     * new DateTime('2024-06-12 14:30:24').isStartOfHour();
     * // => false
     *
     * new DateTime('2024-06-12 14:00:00').isStartOfHour();
     * // => true
     * ```
     *
     * @returns Une nouvelle instance avec l'heure mise à son début.
     */
    public isStartOfHour(): boolean {
        return this.isStartOf('hour');
    }

    /**
     * Retourne `true` si la date est au début de la minute, sinon `false`.
     *
     * @example
     * ```
     * new DateTime('2024-06-12 14:30:24').isStartOfMinute();
     * // => false
     *
     * new DateTime('2024-06-12 14:30:00').isStartOfMinute();
     * // => true
     * ```
     *
     * @returns Une nouvelle instance avec les minutes mises à leur début.
     */
    public isStartOfMinute(): boolean {
        return this.isStartOf('minute');
    }

    /**
     * Retourne `true` si la date est au début de la seconde, sinon `false`.
     *
     * @example
     * ```
     * new DateTime('2024-06-12 14:30:24.333').isStartOfSecond();
     * // => false
     *
     * new DateTime('2024-06-12 14:30:24.000').isStartOfSecond();
     * new DateTime('2024-06-12 14:30:24').isStartOfSecond();
     * // => true
     * ```
     *
     * @returns Une nouvelle instance avec les secondes mises à leur début.
     */
    public isStartOfSecond(): boolean {
        return this.isStartOf('second');
    }

    /**
     * Permet de récupérer la différence entres deux dates pour l'unité spécifiée.
     *
     * @example
     * ```
     * // - Sans unité spécifiée, la différence est renvoyée en millisecondes :
     * const date1 = new DateTime('2019-01-25 00:00:00');
     * const date2 = new DateTime('2018-06-05 00:00:00');
     * date1.diff(date2) // => 20221200000
     *
     * // - Pour obtenir la différence dans une autre unité, passez l'unité en second paramètre :
     * const date1 = new DateTime('2019-01-25 00:00:00');
     * date1.diff('2018-06-05 00:00:00', 'months') // => 7
     * ```
     *
     * @param otherDate - L'autre date avec laquelle comparer la présente instance.
     *                    Celle-ci peut aussi être passée sous forme de chaîne de caractère.
     * @param unit - L'unité dans laquelle vous souhaitez récupérer la différence.
     *               (Si non spécifiée, en millisecondes)
     * @param float - Par défaut, les éventuelles décimales seront tronquées, ce
     *                paramètre permet de désactiver ce comportement.
     *
     * @returns La différence dans l'unité demandée ou en millisecondes
     *          si elle n'a pas été spécifiée.
     */
    public diff(
        otherDate?: DateTimeInput,
        unit?: UnitWithQuarter | UnitWithWeek,
        float: boolean = true,
    ): number {
        const normalizedOther = new DateTime(otherDate);
        return this._rawDateTime.diff(normalizedOther.toRawDateTime(), unit, float);
    }

    /**
     * Récupère la date courante sous forme d'une durée depuis maintenant, lisible par les humains.
     *
     * @example
     * ```
     * DateTime.now().add(5, 'minutes').fromNow(); // => Dans 5 minutes.
     * DateTime.now().sub(5, 'minutes').fromNow(); // => Il y a 5 minutes.
     * ```
     *
     * @param withoutPrefix - Permet de supprimer le préfixe (e.g. `Dans 5 minutes` => `5 minutes`).
     *
     * @returns La date sous forme d'une durée depuis maintenant.
     */
    public fromNow(withoutPrefix: boolean = false): string {
        return this._rawDateTime.fromNow(withoutPrefix);
    }

    /**
     * Récupère la date courante sous forme d'une durée depuis une autre date, lisible par les humains.
     *
     * @example
     * ```
     * const date = new DateTime('2024-01-01 12:00:00');
     * date.add(5, 'minutes').from(date); // => Dans 5 minutes.
     * date.sub(5, 'minutes').from(date); // => Il y a 5 minutes.
     * ```
     *
     * @param otherDate - L'autre date (peut aussi être passée sous forme de chaîne de caractère).
     * @param withoutPrefix - Permet de supprimer le préfixe (e.g. `Dans 5 minutes` => `5 minutes`).
     *
     * @returns La date courante sous forme d'une durée depuis une autre date.
     */
    public from(otherDate: DateTimeInput, withoutPrefix: boolean = false): string {
        const normalizedOther = new DateTime(otherDate);
        return this._rawDateTime.from(normalizedOther.toRawDateTime(), withoutPrefix);
    }

    /**
     * Récupère la date courante sous forme d'une durée jusqu'au présent, lisible par les humains.
     *
     * @example
     * ```
     * DateTime.now().add(5, 'minutes').toNow(); // => Il y a 5 minutes.
     * DateTime.now().sub(5, 'minutes').toNow(); // => Dans 5 minutes.
     * ```
     *
     * @param withoutPrefix - Permet de supprimer le préfixe (e.g. `Dans 5 minutes` => `5 minutes`).
     *
     * @returns La date sous forme d'une durée jusqu'au présent.
     */
    public toNow(withoutPrefix: boolean = false): string {
        return this._rawDateTime.toNow(withoutPrefix);
    }

    /**
     * Récupère la date courante sous forme d'une durée jusqu'à une autre date, lisible par les humains.
     *
     * @example
     * ```
     * const date = new DateTime('2024-01-01 12:00:00');
     * date.add(5, 'minutes').from(date); // => Dans 5 minutes.
     * date.sub(5, 'minutes').from(date); // => Il y a 5 minutes.
     * ```
     *
     * @param otherDate - L'autre date (peut aussi être passée sous forme de chaîne de caractère).
     * @param withoutPrefix - Permet de supprimer le préfixe (e.g. `Dans 5 minutes` => `5 minutes`).
     *
     * @returns La date courante sous forme d'une durée jusqu'à une autre date.
     */
    public to(otherDate: DateTimeInput, withoutPrefix: boolean = false): string {
        const normalizedOther = new DateTime(otherDate);
        return this._rawDateTime.to(normalizedOther.toRawDateTime(), withoutPrefix);
    }

    /**
     * Permet de récupérer une nouvelle instance avec une unité de temps arrondie à une certaine précision.
     * Cela aura aussi pour effet de mettre à 0 les unités plus petites.
     *
     * Cette fonction est équivalente à appeler les méthodes `round[Nom long de l'unité]()`
     * directement (e.g. `roundTimeUnit('minutes', 15)` => `roundMinutes(15)`).
     *
     * @example
     * ```
     * new DateTime('2024-01-01 14:30:24').roundTimeUnit('hours', 4);
     * // => new DateTime('2024-01-01 16:00:00')
     *
     * new DateTime('2024-01-01 14:30:24').roundTimeUnit('minutes', 15);
     * // => new DateTime('2024-01-01 14:30:00')
     *
     * new DateTime('2024-01-01 14:30:24').roundTimeUnit('seconds', 15);
     * // => new DateTime('2024-01-01 14:30:30')
     *
     * new DateTime('2024-01-01 13:32:34.333').roundTimeUnit('milliseconds', 500);
     * // => new DateTime('2024-01-01 13:32:35.500')
     * ```
     *
     * @param unit - L'unité dont l'on souhaite changer la précision.
     * @param precision - La précision désirée, dans l'unité choisie.
     * @param roundingMethod - La méthode d'arrondie, voir {@link RoundingMethod}
     *
     * @returns Une nouvelle instance de `DateTime` dont l'unité spécifiée a été fixée à une certaine précision.
     *
     * @throws Si la précision demandée est supérieure au maximum de l'unité.
     *         (e.g. `> 60` pour les secondes)
     * @throws Si la précision demandée n'est pas un diviseur du maximum de l'unité.
     *         (e.g. `7` pour des secondes car `60 % 7 != 0`)
     */
    public roundTimeUnit(unit: TimeUnit, precision: number = 1, roundingMethod: RoundingMethod = RoundingMethod.ROUND): DateTime {
        invariant(TIME_UNITS.includes(unit), `Unsupported unit \`${unit}\`.`);

        const normalizedUnit = TIME_UNITS_MAP[unit];
        const unitMax: number = TIME_UNITS_MAX[normalizedUnit];
        invariant(
            precision > 0,
            `Invalid precision (${precision}), must be superior to 0.`,
        );
        invariant(
            precision <= unitMax,
            `Invalid precision (${precision}), must be inferior or equal to ${unitMax}.`,
        );
        invariant(
            unitMax % precision === 0,
            `Invalid precision (${precision}), must be a divisor of ${unitMax}.`,
        );

        let roundedDate: DateTime = this;

        // - On arrondi les unités inférieures.
        const indexedUnits = Object.keys(TIME_UNITS_MAX) as TimeUnitTypeLong[];
        const unitIndex = indexedUnits.indexOf(normalizedUnit);
        for (let index = 0; index < unitIndex; index++) {
            const _unit: TimeUnitTypeLong = indexedUnits[index];
            roundedDate = roundedDate.roundTimeUnit(_unit, TIME_UNITS_MAX[_unit], roundingMethod);
        }

        // - On arrondi l'unité demandée.
        const unitValue = roundedDate.get(unit);
        const roundedValue = Math[roundingMethod](unitValue / precision) * precision;
        roundedDate = roundedDate.set(unit, roundedValue % unitMax);

        if (roundedValue < unitMax) {
            return roundedDate;
        }

        const nextUnit: TimeUnit | 'day' = unitIndex !== (indexedUnits.length - 1)
            ? indexedUnits[unitIndex + 1]
            : 'day';

        return roundedDate.add(1, nextUnit);
    }

    /**
     * Permet de récupérer une nouvelle instance avec les heures fixés à une certaine précision.
     * Cela aura aussi pour effet de mettre à 0 les unités plus petites (= minutes, secondes, millisecondes).
     *
     * Par exemple si on souhaite n'avoir que des heures pleines `00:00:00` et
     * `12:00:00`, on utilisera une précision de `6` heures.
     *
     * @example
     * ```
     * new DateTime('2024-01-01 13:30:24').roundHours();
     * // => new DateTime('2024-01-01 14:00:00')
     *
     * new DateTime('2024-01-01 13:30:24').roundHours(12);
     * // => new DateTime('2024-01-01 12:00:00')
     *
     * new DateTime('2024-01-01 14:30:24').roundHours(4);
     * // => new DateTime('2024-01-01 16:00:00')
     *
     * new DateTime('2024-01-01 14:30:24').roundHours(4, RoundingMethod.FLOOR);
     * // => new DateTime('2024-01-01 12:00:00')
     * ```
     *
     * @param precision - La précision désirée, en heures.
     * @param roundingMethod - La méthode d'arrondie, voir {@link RoundingMethod}
     *
     * @returns Une nouvelle instance de `DateTime` dont l'heure a été fixée à une certaine précision.
     *
     * @throws Si la précision demandée est supérieure à 24.
     * @throws Si la précision demandée n'est pas un diviseur de 24.
     */
    public roundHours(precision: number = 1, roundingMethod: RoundingMethod = RoundingMethod.ROUND): DateTime {
        return this.roundTimeUnit('hour', precision, roundingMethod);
    }

    /**
     * Permet de récupérer une nouvelle instance avec les minutes fixées à une certaine précision.
     * Cela aura aussi pour effet de mettre à 0 les unités plus petites (= secondes, millisecondes).
     *
     * Par exemple si on souhaite n'avoir que des minutes arrondies au quart d'heures,
     * on utilisera une précision de `15` minutes.
     *
     * @example
     * ```
     * new DateTime('2024-01-01 13:30:24').roundMinutes();
     * // => new DateTime('2024-01-01 12:00:00')
     *
     * new DateTime('2024-01-01 13:32:34').roundMinutes(5);
     * // => new DateTime('2024-01-01 13:35:00')
     *
     * new DateTime('2024-01-01 14:30:24').roundMinutes(15);
     * // => new DateTime('2024-01-01 14:30:00')
     *
     * new DateTime('2024-01-01 14:30:24').roundMinutes(15, RoundingMethod.FLOOR);
     * // => new DateTime('2024-01-01 14:45:00')
     * ```
     *
     * @param precision - La précision désirée, en minutes.
     * @param roundingMethod - La méthode d'arrondie, voir {@link RoundingMethod}
     *
     * @returns Une nouvelle instance de `DateTime` dont les minutes ont été fixées à une certaine précision.
     *
     * @throws Si la précision demandée est supérieure à 60.
     * @throws Si la précision demandée n'est pas un diviseur de 60.
     */
    public roundMinutes(precision: number = 1, roundingMethod: RoundingMethod = RoundingMethod.ROUND): DateTime {
        return this.roundTimeUnit('minute', precision, roundingMethod);
    }

    /**
     * Permet de récupérer une nouvelle instance avec les secondes fixées à une certaine précision.
     * Cela aura aussi pour effet de mettre à 0 les unités plus petites (= millisecondes).
     *
     * Par exemple si on souhaite n'avoir que des demi-secondes on utilisera une
     * précision de `30` secondes.
     *
     * @example
     * ```
     * new DateTime('2024-01-01 13:30:24.550').roundSeconds();
     * // => new DateTime('2024-01-01 13:30:25')
     *
     * new DateTime('2024-01-01 13:32:34').roundSeconds(5);
     * // => new DateTime('2024-01-01 13:32:35')
     *
     * new DateTime('2024-01-01 14:30:24').roundSeconds(15);
     * // => new DateTime('2024-01-01 14:30:30')
     *
     * new DateTime('2024-01-01 14:30:24').roundSeconds(15, RoundingMethod.FLOOR);
     * // => new DateTime('2024-01-01 14:30:15')
     * ```
     *
     * @param precision - La précision désirée, en secondes.
     * @param roundingMethod - La méthode d'arrondie, voir {@link RoundingMethod}
     *
     * @returns Une nouvelle instance de `DateTime` dont les secondes ont été fixées à une certaine précision.
     *
     * @throws Si la précision demandée est supérieure à 60.
     * @throws Si la précision demandée n'est pas un diviseur de 60.
     */
    public roundSeconds(precision: number = 1, roundingMethod: RoundingMethod = RoundingMethod.ROUND): DateTime {
        return this.roundTimeUnit('second', precision, roundingMethod);
    }

    /**
     * Permet de récupérer une nouvelle instance avec les millisecondes fixées à une certaine précision.
     *
     * Par exemple si on souhaite n'avoir que des demi-millisecondes on utilisera
     * une précision de `500` millisecondes.
     *
     * @example
     * ```
     * new DateTime('2024-01-01 13:32:34.333').roundMilliseconds(500);
     * // => new DateTime('2024-01-01 13:32:35.500')
     *
     * new DateTime('2024-01-01 13:32:34.333').roundMilliseconds(500, RoundingMethod.FLOOR);
     * // => new DateTime('2024-01-01 13:32:35')
     *
     * new DateTime('2024-01-01 13:32:34.501').roundMilliseconds(500, RoundingMethod.CEIL);
     * // => new DateTime('2024-01-01 13:32:36')
     * ```
     *
     * @param precision - La précision désirée, en secondes.
     * @param roundingMethod - La méthode d'arrondie, voir {@link RoundingMethod}
     *
     * @returns Une nouvelle instance de `DateTime` dont les secondes ont été fixées à une certaine précision.
     *
     * @throws Si la précision demandée est supérieure à 1000.
     * @throws Si la précision demandée n'est pas un diviseur de 1000.
     */
    public roundMilliseconds(precision: number = 1, roundingMethod: RoundingMethod = RoundingMethod.ROUND): DateTime {
        return this.roundTimeUnit('millisecond', precision, roundingMethod);
    }

    /**
     * Permet de formatter la date en fonction du template fourni.
     *
     * Note: Pour échapper des caractères, entourez-les avec des crochets (e.g. `[MM]`).
     *
     * @example
     * ```
     * new DateTime('2024-01-01 22:12:28').format(); // => `2024-01-01 22:12:28`
     * new DateTime('2024-01-01 22:12:28').format('DD/MM/YYY à HH[h]mm'); // => `01/01/2024 à 22h12`
     * ```
     *
     * @param template - Le template à utiliser pour formatter la date (e.g. `DD/MM/YYY à HH:mm`).
     *
     * @returns La date sous forme de chaîne de caractère formatée selon le template.
     */
    public format(template: string = 'YYYY-MM-DD HH:mm:ss'): string {
        return this._rawDateTime.format(template);
    }

    /**
     * Retourne l'instance sous forme d'instance de `RawDateTime` (= Dayjs).
     *
     * Note: Ce format pourra être ré-utilisé en entrée.
     *
     * @returns Une instance de `RawDateTime` équivalente à la présente instance.
     */
    public toRawDateTime(): RawDateTimeInstance {
        return this._rawDateTime.clone();
    }

    /**
     * Retourne l'instance sous forme d'instance de `Date`.
     *
     * Note: Ce format pourra être ré-utilisé en entrée.
     *
     * @returns Une instance de `Date` équivalente à la présente instance.
     */
    public toDate(): Date {
        return this._rawDateTime.toDate();
    }

    /**
     * Retourne l'instance sous forme d'instance de `Day`.
     *
     * @returns Une instance de `Day` équivalente à la présente instance.
     */
    public toDay(): Day {
        return new Day(this);
    }

    /**
     * Retourne l'instance en nombre de millisecondes depuis l'époque Unix.
     *
     * Note: Ce format pourra être ré-utilisé en entrée.
     *
     * @returns Le nombre de millisecondes depuis l'époque Unix.
     */
    public toUnix(): number {
        return this._rawDateTime.valueOf();
    }

    /**
     * Retourne l'instance sous forme de chaîne caractère au format `Y-m-d H:i:s`.
     *
     * Note: Ce format pourra être ré-utilisé en entrée.
     *
     * @returns L'instance sous forme de chaîne de caractère.
     */
    public toString(): string {
        return this.format('YYYY-MM-DD HH:mm:ss');
    }

    /**
     * Retourne l'instance sous forme de chaîne lisible par un humain.
     *
     * @param format - Le format pré-défini dans lequel retourner l'instance, voir {@link ReadableFormat}.
     *                 Par défaut: {@link ReadableFormat.SHORT} (e.g. `01/12/2024 14:38`)
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
     * Bien que chaque instance de `DateTime` soit immutable, cette méthode permet
     * de retourner une copie de la présente instance si nécessaire.
     *
     * @returns Un clone de l'instance courante.
     */
    public clone(): DateTime {
        return new DateTime(this);
    }

    // ------------------------------------------------------
    // -
    // -    Méthodes utilitaires.
    // -
    // ------------------------------------------------------

    public static fromFormat(input: string, format: string): DateTime {
        let rawDateTime: RawDateTimeInstance | null;
        try {
            rawDateTime = RawDateTime.fromFormat(input, format);
        } catch {
            rawDateTime = null;
        }
        invariant(!!rawDateTime?.isValid(), 'Invalid datetime input.');
        return new DateTime(rawDateTime!);
    }

    public static duration(input: number, unit?: DurationUnit): Duration;
    public static duration(input: string | DurationUnitsObjectType): Duration;
    public static duration(input: string | number | DurationUnitsObjectType, unit?: DurationUnit): Duration {
        if (typeof input === 'number') {
            return RawDateTime.duration(input, unit);
        }
        if (typeof input === 'string') {
            return RawDateTime.duration(input);
        }
        return RawDateTime.duration(input);
    }

    public static isDuration(value: unknown): value is Duration {
        return RawDateTime.isDuration(value);
    }

    public static localeData(): LocaleData {
        return RawDateTime.localeData();
    }

    /**
     * Permet de récupérer une instance de `DateTime` pour le moment présent.
     *
     * @returns Une instance de `DateTime` avec la date et l'heure courante.
     */
    public static now(): DateTime {
        return new DateTime();
    }
}

export type {
    Unit,
    TimeUnit,
    UnitWithWeek,
    UnitWithQuarter,
    ManipulateUnit,
    Duration,
};

export {
    RoundingMethod as DateTimeRoundingMethod,
    ReadableFormat as DateTimeReadableFormat,
};

export default DateTime;
