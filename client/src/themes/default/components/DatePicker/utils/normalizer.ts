import { markRaw } from 'vue';
import invariant from 'invariant';
import DateTime, { DateTimeRoundingMethod } from '@/utils/datetime';
import Period from '@/utils/period';
import Day from '@/utils/day';
import { Type } from '../_types';

import type { Value, CoreValue } from '../_types';

/** Pas entres les minutes sélectionnable dans le datepicker. */
export const MINUTES_STEP = 15;

/**
 * Permet de normaliser une valeur passée en entrée du datepicker.
 *
 * @param value - La valeur passée en entrée.
 * @param type - Le type de datepicker (see {@link Type}).
 * @param isRange - Le datepicker est t'il de type "range" (= période) ?
 * @param withoutMinutes - Les minutes (et inférieurs) doivent-elles mises à `0` ?
 *
 * @returns La valeur normalisé en fonction des contraintes du datepicker.
 */
export function normalizeInputValue<T extends Type, R extends boolean>(
    value: Value,
    type: (
        | T extends Type.DATE ? T : never
        | T extends Type.DATETIME ? T : never
    ),
    isRange: (
        | R extends true ? R : never
        | R extends false ? R : never
    ),
    withoutMinutes: boolean,
): Value<T, R>;
export function normalizeInputValue(
    value: Value,
    type: Type,
    isRange: boolean,
    withoutMinutes: boolean,
): Value {
    if (value === null) {
        return null;
    }

    if (isRange) {
        invariant(
            value instanceof Period,
            `Invalid value in \`range\` mode: Should be an instance of \`Period\`.`,
        );

        const isFullDays = type === Type.DATE;
        invariant(
            isFullDays === value.isFullDays,
            `Invalid value: The \`isFullDays\` configuration of the \`Period\` ` +
            `does not match.`,
        );

        if (isFullDays) {
            return value;
        }

        let { start, end } = value as Period<false>;
        start = start.roundMinutes(
            withoutMinutes ? 60 : MINUTES_STEP,
            DateTimeRoundingMethod.FLOOR,
        );
        end = end.roundMinutes(
            withoutMinutes ? 60 : MINUTES_STEP,
            DateTimeRoundingMethod.CEIL,
        );
        return new Period(start, end, false);
    }

    invariant(
        !(value instanceof Period),
        `Invalid value in non-range mode: Should be an instance of \`Day\` ` +
        `or \`DateTime\`, \`Period\` received.`,
    );

    if (type === Type.DATE) {
        invariant(
            value instanceof Day,
            `Invalid value in non-range \`DATE\` mode: Should be an instance of \`Day\`.`,
        );
        return value;
    }

    invariant(
        value instanceof DateTime,
        `Invalid value in non-range \`DATETIME\` mode: Should be an instance of \`DateTime\`.`,
    );
    return value.roundMinutes(withoutMinutes ? 60 : MINUTES_STEP);
}

/**
 * Permet de normaliser une valeur envoyée par le core datepicker (= `vue2-datepicker`).
 *
 * @param value - La valeur envoyée par le core.
 * @param type - Le type de datepicker (see {@link Type}).
 * @param isRange - Le datepicker est t'il de type "range" (= période) ?
 *
 * @returns La valeur normalisé en fonction des contraintes du datepicker.
 */
export function normalizeCoreValue<T extends Type, R extends boolean>(
    value: CoreValue,
    type: (
        | T extends Type.DATE ? T : never
        | T extends Type.DATETIME ? T : never
    ),
    isRange: (
        | R extends true ? R : never
        | R extends false ? R : never
    ),
): Value<T, R> | null;
export function normalizeCoreValue(value: CoreValue, type: Type, isRange: boolean): Value | null {
    if (value === null) {
        return null;
    }

    if (isRange) {
        const isFullDays = type === Type.DATE;

        if (Array.isArray(value)) {
            if (value.length !== 2 || value[0] === null || value[1] === null) {
                return null;
            }
            return markRaw(new Period(value[0], value[1], isFullDays));
        }

        return markRaw(new Period(value, value, isFullDays));
    }

    const flatValue = Array.isArray(value)
        ? [...value].shift()
        : value;

    if (flatValue === undefined || flatValue === null) {
        return null;
    }

    return markRaw(
        type === Type.DATETIME
            ? new DateTime(flatValue)
            : new Day(flatValue),
    );
}

/**
 * Permet de convertir le type d'une valeur du datepicker (e.g. `date` <=> `datetime`).
 *
 * @param value - La valeur à convertir.
 * @param type - Le nouveau type (see {@link Type}).
 * @param isRange - Le datepicker est t'il de type "range" (= période) ?
 * @param withoutMinutes - Les minutes (et inférieurs) doivent-elles mises à `0` ?
 *
 * @returns La valeur convertie.
 */
export function convertValueType<T extends Type, R extends boolean>(
    value: Value,
    type: (
        | T extends Type.DATE ? T : never
        | T extends Type.DATETIME ? T : never
    ),
    isRange: (
        | R extends true ? R : never
        | R extends false ? R : never
    ),
    withoutMinutes: boolean,
): Value<T, R>;
export function convertValueType(
    value: Value,
    type: Type,
    isRange: boolean,
    withoutMinutes: boolean,
): Value {
    if (value === null) {
        return null;
    }

    if (isRange) {
        invariant(
            value instanceof Period,
            `Invalid value in \`range\` mode: Should be an instance of \`Period\`.`,
        );

        const isFullDays = type === Type.DATE;
        return markRaw(
            isFullDays !== value.isFullDays
                ? value.setFullDays(isFullDays, true)
                : value,
        );
    }

    invariant(
        !(value instanceof Period),
        `Invalid value in non-range mode: Should be an instance of \`Day\` ` +
        `or \`DateTime\`, \`Period\` received.`,
    );

    if (type === Type.DATE) {
        return markRaw(new Day(value as DateTime));
    }

    const normalizedValue = value instanceof Day
        ? value.toDateTime().set('hour', 12)
        : value;

    return markRaw(
        normalizedValue
            .roundMinutes(withoutMinutes ? 60 : MINUTES_STEP),
    );
}
