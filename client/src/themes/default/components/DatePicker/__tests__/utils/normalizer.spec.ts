import Day from '@/utils/day';
import Period from '@/utils/period';
import DateTime from '@/utils/datetime';
import { Type } from '../../_types';
import {
    normalizeInputValue,
    normalizeCoreValue,
    convertValueType,
} from '../../utils/normalizer';

describe('DatePicker Utils: Normalizer', () => {
    describe('normalizeInputValue()', () => {
        it('should throw when an invalid value is passed for the Datepicker constraints', () => {
            const period = new Period('2024-01-01 14:30:00', '2024-01-01 18:00:00');
            const fullDayPeriod = new Period('2024-01-01', '2025-01-01', true);
            const dateTime = new DateTime('2024-01-01 14:30:00');
            const day = new Day('2024-01-01');

            //
            // - Type: `date` / Mode: Valeur seule.
            //

            // -- ... avec une `Period`.
            expect(() => normalizeInputValue(period, Type.DATE, false, false)).toThrow();
            expect(() => normalizeInputValue(fullDayPeriod, Type.DATE, false, false)).toThrow();

            // -- ... avec une instance de `DateTime`.
            expect(() => normalizeInputValue(dateTime, Type.DATE, false, false)).toThrow();

            // -- ... avec une instance de `Day` => Pas d'erreur.
            expect(() => normalizeInputValue(day, Type.DATE, false, false)).not.toThrow();

            //
            // - Type: `date` / Mode: Période.
            //

            // -- ... avec une instance de `Day`.
            expect(() => normalizeInputValue(day, Type.DATE, true, false)).toThrow();

            // -- ... avec une instance de `DateTime`.
            expect(() => normalizeInputValue(dateTime, Type.DATE, true, false)).toThrow();

            // -- ... avec une `Period` à l'heure près.
            expect(() => normalizeInputValue(period, Type.DATE, true, false)).toThrow();

            // -- ... avec une `Period` en jours entiers => Pas d'erreur.
            expect(() => normalizeInputValue(fullDayPeriod, Type.DATE, true, false)).not.toThrow();

            //
            // - Type: `datetime` / Mode: Valeur seule.
            //

            // -- ... avec une `Period`.
            expect(() => normalizeInputValue(period, Type.DATETIME, false, false)).toThrow();
            expect(() => normalizeInputValue(fullDayPeriod, Type.DATETIME, false, false)).toThrow();

            // -- ... avec une instance de `Day`.
            expect(() => normalizeInputValue(day, Type.DATETIME, false, false)).toThrow();

            // -- ... avec une instance de `DateTime` => Pas d'erreur.
            expect(() => normalizeInputValue(dateTime, Type.DATETIME, false, false)).not.toThrow();

            //
            // - Type: `datetime` / Mode: Période.
            //

            // -- ... avec une instance de `Day`.
            expect(() => normalizeInputValue(day, Type.DATETIME, true, false)).toThrow();

            // -- ... avec une instance de `DateTime`.
            expect(() => normalizeInputValue(dateTime, Type.DATETIME, true, false)).toThrow();

            // -- ... avec une `Period` en jours entiers.
            expect(() => normalizeInputValue(fullDayPeriod, Type.DATETIME, true, false)).toThrow();

            // -- ... avec une `Period` à l'heure près => Pas d'erreur.
            expect(() => normalizeInputValue(period, Type.DATETIME, true, false)).not.toThrow();
        });

        it('should return the right value', () => {
            // - Valeur nulle.
            expect(normalizeInputValue(null, Type.DATE, false, false)).toBeNull();
            expect(normalizeInputValue(null, Type.DATE, true, false)).toBeNull();
            expect(normalizeInputValue(null, Type.DATETIME, false, false)).toBeNull();
            expect(normalizeInputValue(null, Type.DATETIME, true, false)).toBeNull();

            //
            // - Type: `date` / Mode: Valeur seule.
            //

            const day = new Day('2024-01-01');

            // -- ... Avec les minutes.
            const result1 = normalizeInputValue(day, Type.DATE, false, false);
            expect(result1).toBeInstanceOf(Day);
            expect(result1!.toString()).toBe('2024-01-01');

            // -- ... Sans les minutes.
            const result2 = normalizeInputValue(day, Type.DATE, false, true);
            expect(result2).toBeInstanceOf(Day);
            expect(result2!.toString()).toBe('2024-01-01');

            //
            // - Type: `date` / Mode: Période.
            //

            const fullDayPeriod = new Period('2024-01-01', '2025-01-01', true);

            // -- ... Avec les minutes.
            const result3 = normalizeInputValue(fullDayPeriod, Type.DATE, true, false);
            expect(result3).toBeInstanceOf(Period);
            expect(result3!.toSerialized()).toStrictEqual({
                start: '2024-01-01',
                end: '2025-01-01',
                isFullDays: true,
            });

            // -- ... Sans les minutes.
            const result4 = normalizeInputValue(fullDayPeriod, Type.DATE, true, true);
            expect(result4).toBeInstanceOf(Period);
            expect(result4!.toSerialized()).toStrictEqual({
                start: '2024-01-01',
                end: '2025-01-01',
                isFullDays: true,
            });

            //
            // - Type: `datetime` / Mode: Valeur seule.
            //

            const dateTime = new DateTime('2024-01-01 14:38:24');

            // -- ... Avec les minutes.
            const result5 = normalizeInputValue(dateTime, Type.DATETIME, false, false);
            expect(result5).toBeInstanceOf(DateTime);
            expect(result5!.toString()).toBe('2024-01-01 14:45:00');

            // -- ... Sans les minutes.
            const result6 = normalizeInputValue(dateTime, Type.DATETIME, false, true);
            expect(result6).toBeInstanceOf(DateTime);
            expect(result6!.toString()).toBe('2024-01-01 15:00:00');

            //
            // - Type: `datetime` / Mode: Période.
            //

            const period = new Period('2024-01-01 14:38:24', '2024-01-01 14:38:24');

            // -- ... Avec les minutes.
            const result7 = normalizeInputValue(period, Type.DATETIME, true, false);
            expect(result7).toBeInstanceOf(Period);
            expect(result7!.toSerialized()).toStrictEqual({
                start: '2024-01-01 14:30:00',
                end: '2024-01-01 14:45:00',
                isFullDays: false,
            });

            // -- ... Sans les minutes.
            const result8 = normalizeInputValue(period, Type.DATETIME, true, true);
            expect(result8).toBeInstanceOf(Period);
            expect(result8!.toSerialized()).toStrictEqual({
                start: '2024-01-01 14:00:00',
                end: '2024-01-01 15:00:00',
                isFullDays: false,
            });
        });
    });

    describe('normalizeCoreValue()', () => {
        it('works as expected', () => {
            // - Valeur nulle.
            [Type.DATE, Type.DATETIME].forEach((dateMode: Type) => {
                expect(normalizeCoreValue(null, dateMode, false)).toBeNull();
                expect(normalizeCoreValue(null, dateMode, true)).toBeNull();
                expect(normalizeCoreValue([] as any, dateMode, true)).toBeNull();
                expect(normalizeCoreValue([null, null], dateMode, true)).toBeNull();
                expect(normalizeCoreValue(
                    ['2024-01-01', '2024-01-01', '2024-01-01'] as any,
                    dateMode,
                    true,
                )).toBeNull();
            });

            //
            // - Type: `date` / Mode: Valeur seule.
            //

            // -- Avec une valeur simple ...
            const result1 = normalizeCoreValue('2024-01-01', Type.DATE, false);
            expect(result1).toBeInstanceOf(Day);
            expect(result1!.toString()).toBe('2024-01-01');

            // -- Avec un tableau ...
            const result2 = normalizeCoreValue(['2024-01-01', '2024-01-02'], Type.DATE, false);
            expect(result2).toBeInstanceOf(Day);
            expect(result2!.toString()).toBe('2024-01-01');

            //
            // - Type: `date` / Mode: Période.
            //

            // -- Avec un tableau ...
            const result3 = normalizeCoreValue(['2024-01-01', '2025-01-01'], Type.DATE, true);
            expect(result3).toBeInstanceOf(Period);
            expect(result3!.toSerialized()).toStrictEqual({
                start: '2024-01-01',
                end: '2025-01-01',
                isFullDays: true,
            });

            // -- Avec une valeur simple ...
            const result4 = normalizeCoreValue('2024-01-01', Type.DATE, true);
            expect(result4).toBeInstanceOf(Period);
            expect(result4!.toSerialized()).toStrictEqual({
                start: '2024-01-01',
                end: '2024-01-01',
                isFullDays: true,
            });

            //
            // - Type: `datetime` / Mode: Valeur seule.
            //

            // -- Avec une valeur simple ...
            const result5 = normalizeCoreValue('2024-01-01 14:30:00', Type.DATETIME, false);
            expect(result5).toBeInstanceOf(DateTime);
            expect(result5!.toString()).toBe('2024-01-01 14:30:00');

            // -- Avec un tableau ...
            const result6 = normalizeCoreValue(['2024-01-01 14:30:00', '2024-02-12 15:15:00'], Type.DATETIME, false);
            expect(result6).toBeInstanceOf(DateTime);
            expect(result6!.toString()).toBe('2024-01-01 14:30:00');

            //
            // - Type: `datetime` / Mode: Période.
            //

            // -- Avec un tableau ...
            const result7 = normalizeCoreValue(['2024-01-01 14:30:00', '2024-02-12 15:15:00'], Type.DATETIME, true);
            expect(result7).toBeInstanceOf(Period);
            expect(result7!.toSerialized()).toStrictEqual({
                start: '2024-01-01 14:30:00',
                end: '2024-02-12 15:15:00',
                isFullDays: false,
            });

            // -- Avec une valeur simple ...
            const result8 = normalizeCoreValue('2024-01-01 14:30:00', Type.DATETIME, true);
            expect(result8).toBeInstanceOf(Period);
            expect(result8!.toSerialized()).toStrictEqual({
                start: '2024-01-01 14:30:00',
                end: '2024-01-01 14:30:00',
                isFullDays: false,
            });
        });
    });

    describe('convertValueType()', () => {
        it('works as expected', () => {
            // - Valeur nulle.
            expect(convertValueType(null, Type.DATE, false, false)).toBeNull();
            expect(convertValueType(null, Type.DATETIME, false, false)).toBeNull();

            //
            // - Type: `date` / Mode: Valeur seule.
            //

            const dateTime = new DateTime('2024-01-01 14:38:24');

            // -- ... Avec les minutes.
            const result1 = convertValueType(dateTime, Type.DATE, false, false);
            expect(result1).toBeInstanceOf(Day);
            expect(result1!.toString()).toBe('2024-01-01');

            // -- ... Sans les minutes.
            const result2 = convertValueType(dateTime, Type.DATE, false, true);
            expect(result2).toBeInstanceOf(Day);
            expect(result2!.toString()).toBe('2024-01-01');

            //
            // - Type: `date` / Mode: Période.
            //

            const period = new Period('2024-01-01 14:38:24', '2024-01-01 14:38:24');

            // -- ... Avec les minutes.
            const result3 = convertValueType(period, Type.DATE, true, false);
            expect(result3).toBeInstanceOf(Period);
            expect(result3!.toSerialized()).toStrictEqual({
                start: '2024-01-01',
                end: '2024-01-01',
                isFullDays: true,
            });

            // -- ... Sans les minutes.
            const result4 = convertValueType(period, Type.DATE, true, true);
            expect(result4).toBeInstanceOf(Period);
            expect(result4!.toSerialized()).toStrictEqual({
                start: '2024-01-01',
                end: '2024-01-01',
                isFullDays: true,
            });

            //
            // - Type: `datetime` / Mode: Valeur seule.
            //

            const day = new Day('2024-01-01');

            // -- ... Avec les minutes.
            const result5 = convertValueType(day, Type.DATETIME, false, false);
            expect(result5).toBeInstanceOf(DateTime);
            expect(result5!.toString()).toBe('2024-01-01 12:00:00');

            // -- ... Sans les minutes.
            const result6 = convertValueType(day, Type.DATETIME, false, true);
            expect(result6).toBeInstanceOf(DateTime);
            expect(result6!.toString()).toBe('2024-01-01 12:00:00');

            //
            // - Type: `datetime` / Mode: Période.
            //

            const fullDayPeriod = new Period('2024-01-01', '2025-01-01', true);

            // -- ... Avec les minutes.
            const result7 = convertValueType(fullDayPeriod, Type.DATETIME, true, false);
            expect(result7).toBeInstanceOf(Period);
            expect(result7!.toSerialized()).toStrictEqual({
                start: '2024-01-01 12:00:00',
                end: '2025-01-01 12:00:00',
                isFullDays: false,
            });

            // -- ... Sans les minutes.
            const result8 = convertValueType(fullDayPeriod, Type.DATETIME, true, true);
            expect(result8).toBeInstanceOf(Period);
            expect(result8!.toSerialized()).toStrictEqual({
                start: '2024-01-01 12:00:00',
                end: '2025-01-01 12:00:00',
                isFullDays: false,
            });
        });
    });
});
