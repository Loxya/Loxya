import z from 'zod';
import Day, { DayReadableFormat } from '@/utils/day';
import invariant from 'invariant';
import { PartReadableFormat, ReadableFormat } from './_constants';
import DateTime, { DateTimeReadableFormat } from '@/utils/datetime';
import Decimal from 'decimal.js';

import type { SchemaInfer } from '@/utils/validation';
import type { ManipulateUnit as DayManipulateUnit } from '@/utils/day';
import type { I18nTranslate } from 'vuex-i18n';
import type {
    Duration,
    ManipulateUnit as DateTimeManipulateUnit,
} from '@/utils/datetime';

/** Schéma d'une période sérialisée. */
export const SerializedPeriodSchema = z.strictObject({
    start: z.string(),
    end: z.string(),
    isFullDays: z.boolean().default(false),
});

/** Une période sérialisée. */
export type SerializedPeriod = SchemaInfer<typeof SerializedPeriodSchema>;

/** Une période. */
class Period<IsFullDays extends boolean = boolean> {
    /** La date de début de la période. */
    private _start: DateTime;

    /** La date de fin de la période. */
    private _end: DateTime;

    /** La période est-t'elle du type "journées entières" ? */
    private _isFullDays: IsFullDays;

    constructor(period: Period<IsFullDays>);
    // @see https://github.com/microsoft/TypeScript/issues/54157#issuecomment-1869747935
    constructor(
        start: Day | string,
        end: Day | string,
        isFullDays: (
            | IsFullDays extends true ? IsFullDays : never
            | IsFullDays extends boolean ? IsFullDays : never
        ),
    );
    constructor(
        start: DateTime | Date | string,
        end: DateTime | Date | string,
        isFullDays?: (
            | IsFullDays extends true ? IsFullDays : never
            | IsFullDays extends boolean ? IsFullDays : never
        ),
    );
    constructor(
        start: Period<IsFullDays> | DateTime | Day | Date | string,
        end?: DateTime | Day | Date | string,
        isFullDays: IsFullDays = (false as any),
    ) {
        if (start instanceof Period) {
            end = start.end;
            isFullDays = start.isFullDays;
            start = start.start;
        }
        invariant(end !== undefined, 'Missing end date for the period.');

        invariant(
            (
                typeof start === 'string' ||
                (isFullDays && start instanceof Day) ||
                (!isFullDays && (start instanceof DateTime || start instanceof Date))
            ),
            `Invalid start date for period: should be either a string or an instance of ` +
            `\`Day\` if it's a full day period, or a instance of \`DateTime\` otherwise`,
        );
        const normalizedStart: DateTime = (
            !isFullDays
                ? new DateTime(start as DateTime | Date | string)
                : new Day(start as Day | string)
                    .toDateTime()
        );

        invariant(
            (
                typeof end === 'string' ||
                (isFullDays && end instanceof Day) ||
                (!isFullDays && (end instanceof DateTime || start instanceof Date))
            ),
            `Invalid end date for period: should be either a string or an instance of ` +
            `\`Day\` if it's a full day period, or a instance of \`DateTime\` otherwise`,
        );
        const normalizedEnd: DateTime = (
            !isFullDays
                ? new DateTime(end as DateTime | Date | string)
                : new Day(end as Day | string)
                    .toDateTime().endOfDay(true)
        );

        invariant(
            normalizedEnd.isSameOrAfter(normalizedStart),
            'End date should be after start date.',
        );

        this._start = normalizedStart;
        this._end = normalizedEnd;
        this._isFullDays = isFullDays;
    }

    /**
     * La date de début de la période.
     */
    public get start(): IsFullDays extends true ? Day : DateTime {
        // @ts-expect-error -- Typescript n'arrive pas à inférer le bon type avec le generic `IsFullDays`.
        // @see https://github.com/microsoft/TypeScript/issues/48746
        return !this._isFullDays ? this._start : new Day(this._start);
    }

    /**
     * La date de fin de la période.
     */
    public get end(): IsFullDays extends true ? Day : DateTime {
        // @ts-expect-error -- Typescript n'arrive pas à inférer le bon type avec le generic `IsFullDays`.
        // @see https://github.com/microsoft/TypeScript/issues/48746
        return !this._isFullDays ? this._end : new Day(this._end.subDay());
    }

    /**
     * La période est-t'elle du type "journées entières" ?
     *
     * @returns `true` si la période est en jours entiers, `false` sinon.
     */
    public get isFullDays(): IsFullDays {
        return this._isFullDays;
    }

    /**
     * Retourne `true` si la période est équivalente à une période en jours
     * entiers, sans pour autant en être une.
     *
     * C'est le cas par exemple pour les périodes à l'heure près qui commence à
     * `00:00:00` et se termine à `00:00:00` (e.g. `2024-01-01 00:00:00 => 2025-05-06 00:00:00`
     * est équivalent à une période en journées entière du type `2024-01-01 => 2025-05-05`).
     *
     * @returns `true` si la période à l'heure près est équivalente à une période en jours entiers.
     */
    public isFullDaysLike(): boolean {
        if (this._isFullDays) {
            return false;
        }
        return this._start.isStartOfDay() && this._end.isStartOfDay();
    }

    /**
     * Retourne `true` si la période est identique à une autre.
     *
     * Les deux périodes doivent utiliser le même mode (jour entier ou heures précises),
     * et doivent avec des dates de début et de fin identiques.
     *
     * @param otherPeriod - La période avec laquelle il faut comparer.
     *
     * @returns `true` si les périodes sont identiques, `false` sinon.
     */
    public isSame(otherPeriod: Period): boolean {
        return (
            this.isFullDays === otherPeriod.isFullDays &&
            this.start.isSame(otherPeriod.start as any) &&
            this.end.isSame(otherPeriod.end as any)
        );
    }

    /**
     * Permet de déterminer si la période est avant une autre période, jour ou date.
     *
     * @param other - La date, le jour ou l'autre période avec laquelle comparer
     *                la période courante.
     *
     * @returns `true` si l'instance courante est avant l'autre date, jour ou
     *          période passée, `false` sinon.
     */
    public isBefore(other: DateTime | Day | Period): boolean {
        const otherNormalized: DateTime = (() => {
            if (other instanceof Period) {
                return other.setFullDays(false).start;
            }
            if (other instanceof Day) {
                return other.toDateTime();
            }
            return other;
        })();
        return this._end.isSameOrBefore(otherNormalized);
    }

    /**
     * Permet de déterminer si la période est avant ou pendant une autre période, jour ou date.
     *
     * @param other - La date, le jour ou l'autre période avec laquelle comparer
     *                la période courante.
     *
     * @returns `true` si l'instance courante est avant ou pendant l'autre date, jour ou
     *          période passée, `false` sinon.
     */
    public isBeforeOrDuring(other: DateTime | Day | Period): boolean {
        if (other instanceof Period) {
            const otherNormalized = other.setFullDays(false).end;
            return this._start.isBefore(otherNormalized);
        }
        return this._start.isSameOrBefore(
            other instanceof Day ? other.toDateTime() : other,
        );
    }

    /**
     * Retourne `true` si la période est actuellement en cours, `false` sinon.
     *
     * @returns `true` si la période est actuellement en cours, `false` sinon.
     */
    public isOngoing(): boolean {
        return DateTime.now().isBetween(this);
    }

    /**
     * Retourne `true` si la période est complètement passée, `false` sinon.
     *
     * @returns `true` si la période est complètement passée, `false` sinon.
     */
    public isPast(): boolean {
        return this.isBefore(DateTime.now());
    }

    /**
     * Retourne `true` si la période est complètement passée ou en cours, `false` sinon.
     *
     * @returns `true` si la période est complètement passée ou en cours, `false` sinon.
     */
    public isPastOrOngoing(): boolean {
        return this.isBeforeOrDuring(DateTime.now());
    }

    /**
     * Retourne une copie de la période avec la configuration des jours
     * entiers modifiée en fonction du paramètre passé.
     *
     * @param inFullDays - La nouvelle période doit-elle être du type "journées entières" ?
     * @param midday - En passant en période à l'heure près, dois-t'on ajuster les heures
     *                     à midi plutôt que mettre à minuit le jour de début et de fin ?
     *
     * @returns Une copie de la présente période avec la configuration "journées entières" modifiée.
     */
    public setFullDays(inFullDays: true): Period<true>;
    public setFullDays(inFullDays: false, midday?: boolean): Period<false>;
    public setFullDays(inFullDays: boolean, midday?: boolean): Period;
    public setFullDays(inFullDays: boolean, midday: boolean = false): Period {
        if (inFullDays) {
            if (this.isFullDays) {
                return this.clone();
            }

            const start = this._start;

            // - Si la fin de la période en heures précises était `00:00:00`,
            //   on considère que la journée de fin est donc la journée précédente.
            const end = this._end.isStartOfDay()
                ? this._end.subDay()
                : this._end;

            return new Period(new Day(start), new Day(end), true);
        }

        if (!this.isFullDays) {
            return this.clone();
        }

        return new Period(
            !midday ? this._start : this._start.set('hour', 12),
            !midday ? this._end : this._end.subDay().set('hour', 12),
            false,
        );
    }

    /**
     * Retourne le nombre de jours de la période.
     *
     * Toute journée commencée est comptabilisée (même si la date de fin se termine à 00:01).
     *
     * @returns Le nombre de jours de la période.
     */
    public asDays(): number {
        const start = this._start.startOf('day');
        const end = this._end.format('HH:mm:ss') !== '00:00:00'
            ? this._end.endOfDay(true)
            : this._end;

        return Math.max(end.diff(start, 'days'), 1);
    }

    /**
     * Retourne le nombre d'heures de la période.
     *
     * @param asDecimal - Faut-il retourner la durée en heure en nombre entier (`false`, par défaut),
     *                  ou en nombre décimal (`true`) ?
     *                  En nombre entier, toute heure commencée est comptabilisée (même si l'heure
     *                  de fin se termine à xx:01).
     *
     * @returns Le nombre d'heure de la période.
     */
    public asHours(asDecimal: true): Decimal;
    public asHours(asDecimal?: false): number;
    public asHours(asDecimal: boolean = false): number | Decimal {
        if (asDecimal) {
            return new Decimal(this._end.diff(this._start, 'hours'));
        }

        const start = this._start.startOf('hour');
        const end = this._end.format('mm:ss') !== '00:00'
            ? this._end.endOfHour(true)
            : this._end;

        return Math.max(end.diff(start, 'hours'), 1);
    }

    /**
     * Retourne l'instance sous forme d'instance de `Duration`
     *
     * @returns Une instance de `Duration` équivalente à la durée de la période.
     */
    public asDuration(): Duration {
        const start = this._start.startOfSecond();
        const end = this._end.format('SSS') !== '000'
            ? this._end.endOf('millisecond')
            : this._end;

        const seconds = Math.max(end.diff(start, 'seconds'), 1);
        return DateTime.duration(seconds, 'seconds');
    }

    /**
     * Vérifie si la période courante "chevauche" une autre période.
     *
     * @param otherPeriod - L'autre période à comparer.
     *
     * @returns `true` si les périodes se chevauchent, `false` sinon.
     */
    public overlaps(otherPeriod: Period): boolean {
        const currentPeriodHourly = this.setFullDays(false);
        const otherPeriodHourly = otherPeriod.setFullDays(false);

        return (
            currentPeriodHourly.start.isBefore(otherPeriodHourly.end) &&
            currentPeriodHourly.end.isAfter(otherPeriodHourly.start)
        );
    }

    /**
     * Fusionne la période courante avec une autre et retourne la période résultante.
     *
     * @param otherPeriod - La période avec laquelle il faut fusionner.
     *
     * @returns La période résultante.
     */
    public merge(otherPeriod: Period): Period {
        if (this.isFullDays && otherPeriod.isFullDays) {
            const start: Day = (
                (this.start as Day).isSameOrBefore(otherPeriod.start)
                    ? this.start : otherPeriod.start
            ) as Day;

            const end: Day = (
                (this.end as Day).isSameOrAfter(otherPeriod.end)
                    ? this.end : otherPeriod.end
            ) as Day;

            return new Period(start, end, true);
        }

        const currentPeriodHourly = this.setFullDays(false);
        const otherPeriodHourly = otherPeriod.setFullDays(false);

        // - Début.
        const currentPeriodStart: DateTime = currentPeriodHourly.start;
        const otherPeriodStart: DateTime = otherPeriodHourly.start;
        const start: DateTime = currentPeriodStart.isSameOrBefore(otherPeriodStart)
            ? currentPeriodStart
            : otherPeriodStart;

        // - Fin.
        const currentPeriodEnd: DateTime = currentPeriodHourly.end;
        const otherPeriodEnd: DateTime = otherPeriodHourly.end;
        const end: DateTime = currentPeriodEnd.isSameOrAfter(otherPeriodEnd)
            ? currentPeriodEnd
            : otherPeriodEnd;

        return new Period(start, end, false);
    }

    /**
     * Retourne une nouvelle période issue de la période courante en faisant
     * en sorte qu'elle soit "contenue" dans une autre période.
     *
     * Si les deux périodes n'ont rien en commun, `null` sera retourné.
     *
     * @param otherPeriod - La période qui doit contenir la nouvelle période.
     *
     * @returns La période résultante ou `null` si les périodes n'ont rien en commun.
     */
    public narrow(otherPeriod: Period): Period | null {
        if (!this.overlaps(otherPeriod)) {
            return null;
        }

        if (this.isFullDays && otherPeriod.isFullDays) {
            const start: Day = (
                (this.start as Day).isBefore(otherPeriod.start)
                    ? otherPeriod.start : this.start
            ) as Day;

            const end: Day = (
                (this.end as Day).isAfter(otherPeriod.end)
                    ? otherPeriod.end : this.end
            ) as Day;

            return new Period(start, end, true);
        }

        const currentPeriodHourly = this.setFullDays(false);
        const otherPeriodHourly = otherPeriod.setFullDays(false);

        // - Début.
        const currentPeriodStart: DateTime = currentPeriodHourly.start;
        const otherPeriodStart: DateTime = otherPeriodHourly.start;
        const start: DateTime = currentPeriodStart.isBefore(otherPeriodStart)
            ? otherPeriodStart
            : currentPeriodStart;

        // - Fin.
        const currentPeriodEnd: DateTime = currentPeriodHourly.end;
        const otherPeriodEnd: DateTime = otherPeriodHourly.end;
        const end: DateTime = currentPeriodEnd.isAfter(otherPeriodEnd)
            ? otherPeriodEnd
            : currentPeriodEnd;

        return new Period(start, end, false);
    }

    /**
     * Permet d'obtenir une copie d'une période en l'élargissant d'une quantité de temps.
     *
     * @example
     * ```
     * new Period('2024-01-15', '2024-01-20').offset(DateTime.duration(5, 'days'));
     * // => new Period('2024-01-10', '2024-01-25')
     * ```
     *
     * @param duration - Le temps à ajouter avant et après, sous forme d'instance de `Duration`.
     *
     * @returns Une nouvelle instance avec la durée spécifiée ajoutée avant et après.
     */
    public offset(duration: Duration): Period<IsFullDays>;

    /**
     * Permet d'obtenir une copie d'une période en l'élargissant d'une quantité de temps.
     *
     * @example
     * ```
     * new Period('2024-01-15', '2024-01-20').offset(5, 'days');
     * // => new Period('2024-01-10', '2024-01-25')
     * ```
     *
     * @param value - Le temps à ajouter avant et après, dans l'unité choisie.
     * @param unit - L'unité de temps à ajouter avant et après.
     *
     * @returns Une nouvelle instance avec la durée spécifiée ajoutée avant et après.
     */
    public offset(value: number, unit?: IsFullDays extends true ? DayManipulateUnit : DateTimeManipulateUnit): Period<IsFullDays>;
    public offset(value: number | Duration, unit?: DayManipulateUnit | DateTimeManipulateUnit): Period<IsFullDays> {
        return DateTime.isDuration(value)
            ? new Period(
                this.start.sub(value) as any,
                this.end.add(value) as any,
                this.isFullDays as any,
            )
            : new Period(
                this.start.sub(value, unit as any) as any,
                this.end.add(value, unit as any) as any,
                this.isFullDays as any,
            );
    }

    /**
     * Renvoie une nouvelle période qui commence à la fin de la
     * période actuelle et se termine à la date donnée.
     *
     * @param end - La date de fin de la nouvelle période.
     *
     * @returns Une nouvelle période débutant à la fin de celle-ci, jusqu'à `end`.
     */
    public tail(end: DateTime | Day): Period {
        if (this.isFullDays && end instanceof Day) {
            invariant(
                (this.end as Day).isBefore(end),
                'End date must be after the current period end.',
            );
            return new Period(this.end as Day, end, true);
        }

        const normalizedStart = this._end;
        const normalizedEnd = end instanceof Day
            ? end.toDateTime().endOfDay(true)
            : end;

        invariant(
            normalizedStart.isBefore(normalizedEnd),
            'End date must be after the current period end.',
        );

        return new Period(normalizedStart, normalizedEnd, false);
    }

    /**
     * Permet de récupérer la période sous forme sérialisée.
     *
     * @returns La période sous forme sérialisée.
     */
    public toSerialized(): SerializedPeriod {
        return {
            isFullDays: this.isFullDays,
            start: this.start.toString(),
            end: this.end.toString(),
        };
    }

    /**
     * Permet de récupérer la période sous forme de partie lisibles.
     * (par exemple "01/01/2024" ou "01/01/2024 14:30")
     *
     * @param format - Le format pré-défini dans lequel retourner les parties de la période, voir {@link PartReadableFormat}.
     *                 Le résultat dépend du type de période (jours entiers ou non).
     *                 Format par défaut: {@link PartReadableFormat.SHORT}.
     *
     * @returns Un object avec une clé `start` et `end` contenant les
     *          éléments de la période sous forme "lisible".
     */
    public toReadableParts(format: PartReadableFormat = PartReadableFormat.SHORT): Record<'start' | 'end', string> {
        if (this._isFullDays) {
            return {
                start: (this.start as Day).toReadable(DayReadableFormat[format]),
                end: (this.end as Day).toReadable(DayReadableFormat[format]),
            };
        }

        return {
            start: (this.start as DateTime).toReadable(DateTimeReadableFormat[format]),
            end: (this.end as DateTime).toReadable(DateTimeReadableFormat[format]),
        };
    }

    /**
     * Permet de récupérer la période sous forme de chaîne lisible par un humain.
     * (par exemple "du 01/12/2024 au 03/12/2024")
     *
     * @param translateFn - La fonction de traduction à utiliser pour générer les messages.
     * @param format - Le format pré-défini dans lequel retourner la période, voir {@link ReadableFormat}.
     *                 Format par défaut: {@link ReadableFormat.SHORT}.
     *
     * @returns L'instance sous forme de chaîne lisible par un humain.
     */
    public toReadable(translateFn: I18nTranslate, format: ReadableFormat = ReadableFormat.SHORT): string {
        const __ = translateFn;

        if (this._isFullDays) {
            const isOneDayPeriod = this.asDays() === 1;
            if (isOneDayPeriod) {
                switch (format) {
                    case ReadableFormat.MINIMALIST: {
                        return (this.start as Day).format('D MMM');
                    }

                    case ReadableFormat.SENTENCE: {
                        const formattedDate = (this.start as Day).toReadable(DayReadableFormat.SHORT);
                        return __('date-in-sentence', { date: formattedDate });
                    }

                    default: {
                        const formattedDate = (this.start as Day).toReadable(DayReadableFormat[format]);
                        return __('on-date', { date: formattedDate });
                    }
                }
            }

            switch (format) {
                case ReadableFormat.MINIMALIST: {
                    const formattedStart = (this.start as Day).format('D MMM');
                    const formattedEnd = (this.end as Day).format('D MMM');
                    return `${formattedStart} ⇒ ${formattedEnd}`;
                }

                case ReadableFormat.SENTENCE: {
                    const formattedStart = (this.start as Day).toReadable(DayReadableFormat.SHORT);
                    const formattedEnd = (this.end as Day).toReadable(DayReadableFormat.SHORT);
                    return __('period-in-sentence', { from: formattedStart, to: formattedEnd });
                }

                default: {
                    const formattedStart = (this.start as Day).toReadable(DayReadableFormat[format]);
                    const formattedEnd = (this.end as Day).toReadable(DayReadableFormat[format]);
                    return __('from-date-to-date', { from: formattedStart, to: formattedEnd });
                }
            }
        }

        switch (format) {
            case ReadableFormat.MINIMALIST: {
                const formattedStart = (this.start as DateTime).format('D MMM - HH:mm');
                const formattedEnd = (this.end as DateTime).format('D MMM - HH:mm');
                return `${formattedStart} ⇒ ${formattedEnd}`;
            }

            case ReadableFormat.SENTENCE: {
                const formattedStart = (this.start as DateTime).toReadable(DateTimeReadableFormat.SHORT);
                const formattedEnd = (this.end as DateTime).toReadable(DateTimeReadableFormat.SHORT);
                return __('period-in-sentence', { from: formattedStart, to: formattedEnd });
            }

            default: {
                const formattedStart = (this.start as DateTime).toReadable(DateTimeReadableFormat[format]);
                const formattedEnd = (this.end as DateTime).toReadable(DateTimeReadableFormat[format]);
                return __('from-date-to-date', { from: formattedStart, to: formattedEnd });
            }
        }
    }

    /**
     * Retourne une durée lisible en fonction de la période.
     *
     * @param translateFn - La fonction de traduction à utiliser pour générer les messages.
     *
     * @returns Une chaîne lisible représentant la durée.
     */
    public toReadableDuration(translateFn: I18nTranslate): string {
        const __ = translateFn;
        const duration = this.asDuration();

        let asDays = duration.asDays();
        if (asDays >= 2) {
            asDays = Math.round(asDays);
            return __('durations.days', { count: asDays }, asDays);
        }

        let asHours = duration.asHours();
        if (asHours >= 1) {
            asHours = Math.round(asHours);
            return __('durations.hours', { count: asHours }, asHours);
        }

        let asMinutes = duration.asMinutes();
        if (asMinutes >= 1) {
            asMinutes = Math.round(asMinutes);
            return __('durations.minutes', { count: asMinutes }, asMinutes);
        }

        const asSeconds = Math.round(Math.max(duration.asSeconds(), 1));
        return __('durations.seconds', { count: asSeconds }, asSeconds);
    }

    /**
     * Permet de récupérer la période sous forme de paramètres de querystring.
     *
     * @param name - Le nom du paramètre de query dans lequel on veut serializer la période.
     *
     * @returns Un object à utiliser pour les paramètres de query d'une requête.
     */
    public toQueryParams(name: string): Record<string, string> {
        const serialized = this.toSerialized();

        return {
            [`${name}[start]`]: serialized.start,
            [`${name}[end]`]: serialized.end,
        };
    }

    /**
     * Permet de sérialiser la période dans un format compatible JSON.
     *
     * @returns La période sérialisée dans un format compatible JSON.
     */
    public toJSON(): Record<string, unknown> {
        return this.toSerialized();
    }

    /**
     * Bien que chaque instance de `Period` soit immutable, cette méthode permet
     * de retourner une copie de la présente instance si nécessaire.
     *
     * @returns Un clone de l'instance courante.
     */
    public clone(): Period<IsFullDays> {
        return new Period(this);
    }

    // ------------------------------------------------------
    // -
    // -    Méthodes utilitaires.
    // -
    // ------------------------------------------------------

    /**
     * Permet de récupérer une période depuis une valeur mixte ou `null`
     * si la valeur n'a pas pû être convertie en période.
     *
     * @param value - La valeur à convertir en période.
     *
     * @returns La période résultant ou `null` si elle n'a pas pû être récupérée.
     */
    public static tryFrom(value: unknown): Period | null {
        try {
            return Period.from(value);
        } catch {
            return null;
        }
    }

    /**
     * Permet de récupérer une période depuis une valeur mixte.
     *
     * @param value - La valeur à convertir en période.
     *
     * @returns La période résultant.
     *
     * @throws Si la valeur n'a pas pû être convertie en période.
     */
    public static from(value: unknown): Period {
        if (value instanceof Period) {
            return new Period(value);
        }

        const maybeSerializedPeriod = SerializedPeriodSchema.safeParse(value);
        if (maybeSerializedPeriod.success) {
            return Period.fromSerialized(maybeSerializedPeriod.data);
        }

        throw new Error(`The value cannot be converted into a period.`);
    }

    /**
     * Permet de récupérer une instance de période depuis une période sérialisée.
     *
     * @param rawPeriod - La période sérialisée à convertir en instance.
     *                    (Voir {@link Period.toSerialized()} pour le format)
     *
     * @returns L'instance de la période.
     *
     * @throws Si la période n'a pas pû être récupérée depuis le tableau.
     */
    public static fromSerialized(rawPeriod: SerializedPeriod): Period {
        const normalizedRawPeriod = SerializedPeriodSchema.safeParse(rawPeriod);
        invariant(normalizedRawPeriod.success, `The value cannot be converted into a period.`);

        return new Period(
            normalizedRawPeriod.data.start,
            normalizedRawPeriod.data.end,
            normalizedRawPeriod.data.isFullDays,
        );
    }
}

export {
    PartReadableFormat as PeriodPartReadableFormat,
    ReadableFormat as PeriodReadableFormat,
};

export default Period;
