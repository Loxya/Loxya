import DateTime from '@/utils/datetime';
import Day from '@/utils/day';
import Period, { PeriodPartReadableFormat, PeriodReadableFormat } from '@/utils/period';
import Decimal from 'decimal.js';

import type { I18nTranslate } from 'vuex-i18n';

describe('Utils / Period', () => {
    it('should correctly handle full days periods', () => {
        // - Période "pleine" simples.
        const period1 = new Period('2024-01-01', '2024-01-02', true);
        expect(period1.start.toString()).toBe('2024-01-01');
        expect(period1.end.toString()).toBe('2024-01-02');

        // - Période "pleine" avec heures spécifiée => Invalide.
        expect(() => new Period('2024-01-01 14:12:10', '2024-01-02 12:45:00', true)).toThrow();
    });

    it('support JSON stringification', () => {
        const data = { period: new Period('2024-01-01 10:12:10', '2024-01-01 12:45:00') };
        // eslint-disable-next-line unicorn/prefer-structured-clone
        expect(JSON.parse(JSON.stringify(data))).toStrictEqual({
            period: {
                start: '2024-01-01 10:12:10',
                end: '2024-01-01 12:45:00',
                isFullDays: false,
            },
        });
    });

    describe('isBefore()', () => {
        it('should return true if the period is before various formats', () => {
            const period1 = new Period('2024-01-15', '2024-01-20', true);
            expect(period1.isBefore(period1)).toBeFalsy();
            expect(period1.isBefore(new Period('2024-01-16', '2024-01-17', true))).toBeFalsy();
            expect(period1.isBefore(new Period('2024-01-16 12:12:00', '2024-01-22 14:35:00'))).toBeFalsy();
            expect(period1.isBefore(new DateTime('2024-01-16 12:12:00'))).toBeFalsy();
            expect(period1.isBefore(new Day('2024-01-20'))).toBeFalsy();

            expect(period1.isBefore(new Period('2024-01-21', '2024-01-22', true))).toBeTruthy();
            expect(period1.isBefore(new Period('2024-01-21 01:35:42', '2024-01-22 12:45:45'))).toBeTruthy();
            expect(period1.isBefore(new DateTime('2024-01-22 12:12:00'))).toBeTruthy();
            expect(period1.isBefore(new Day('2024-01-22'))).toBeTruthy();

            const period2 = new Period('2024-01-15 12:30:20', '2024-01-20 15:48:00');
            expect(period2.isBefore(period2)).toBeFalsy();
            expect(period2.isBefore(new Period('2024-01-20 15:48:00', '2024-01-20 15:49:00'))).toBeTruthy();
            expect(period2.isBefore(new DateTime('2024-01-20 15:48:00'))).toBeTruthy();
        });
    });

    describe('isBeforeOrDuring()', () => {
        it('should return true if the period is before or during various formats', () => {
            const period1 = new Period('2024-01-15', '2024-01-20', true);
            expect(period1.isBeforeOrDuring(new Period('2024-01-14', '2024-01-14', true))).toBeFalsy();
            expect(period1.isBeforeOrDuring(new Period('2024-01-14 00:00:00', '2024-01-14 23:59:59'))).toBeFalsy();
            expect(period1.isBeforeOrDuring(period1)).toBeTruthy();
            expect(period1.isBeforeOrDuring(new Period('2024-01-15', '2024-01-15', true))).toBeTruthy();
            expect(period1.isBeforeOrDuring(new Period('2024-01-16', '2024-01-17', true))).toBeTruthy();
            expect(period1.isBeforeOrDuring(new Period('2024-01-16 12:12:00', '2024-01-22 14:35:00'))).toBeTruthy();
            expect(period1.isBeforeOrDuring(new DateTime('2024-01-16 12:12:00'))).toBeTruthy();
            expect(period1.isBeforeOrDuring(new Day('2024-01-20'))).toBeTruthy();

            const period2 = new Period('2024-01-15 12:30:20', '2024-01-20 15:48:00');
            expect(period2.isBeforeOrDuring(new Period('2024-01-12 15:48:00', '2024-01-15 12:29:00'))).toBeFalsy();
            expect(period2.isBeforeOrDuring(period2)).toBeTruthy();
            expect(period2.isBeforeOrDuring(new Period('2024-01-20 15:48:00', '2024-01-20 15:49:00'))).toBeTruthy();
            expect(period2.isBeforeOrDuring(new DateTime('2024-01-20 15:48:00'))).toBeTruthy();
            expect(period2.isBeforeOrDuring(new DateTime('2024-01-15 12:30:20'))).toBeTruthy();
        });
    });

    describe('isFullDaysLike()', () => {
        it('should false if the period is not hourly', () => {
            expect(new Period('2024-01-01', '2024-01-02', true).isFullDaysLike()).toBeFalsy();
        });

        it('returns true if the period is a hourly period that look like a full-day one', () => {
            expect(new Period('2024-01-01 00:00:00', '2024-01-02 00:00:00').isFullDaysLike()).toBeTruthy();
            expect(new Period('2024-01-01 01:20:00', '2024-01-01 01:21:00').isFullDaysLike()).toBeFalsy();
        });
    });

    describe('setFullDays()', () => {
        it('should handle same mode change', () => {
            const doTest = (result: Period, expected: [string, string, boolean]): void => {
                expect(result.start.toString()).toBe(expected[0]);
                expect(result.end.toString()).toBe(expected[1]);
                expect(result.isFullDays).toBe(expected[2]);
            };

            // - Avec une période à l'heure près vers une période à l'heure près.
            doTest(
                new Period('2024-01-01 14:30:00', '2024-01-02 10:20:00').setFullDays(false),
                ['2024-01-01 14:30:00', '2024-01-02 10:20:00', false],
            );

            // - Avec une période en journées entières vers une période en journées entières.
            doTest(
                new Period('2024-01-01', '2024-01-02', true).setFullDays(true),
                ['2024-01-01', '2024-01-02', true],
            );
        });

        it('should allow to convert hourly period to full-day', () => {
            const doTest = (result: Period, expected: [string, string, boolean]): void => {
                expect(result.start.toString()).toBe(expected[0]);
                expect(result.end.toString()).toBe(expected[1]);
                expect(result.isFullDays).toBe(expected[2]);
            };

            // - Avec une heure de fin en milieu de journée.
            doTest(
                new Period('2024-01-01 14:30:00', '2024-01-02 10:20:00').setFullDays(true),
                ['2024-01-01', '2024-01-02', true],
            );

            // - Avec une heure de fin à `00:00:00` de journée suivante (= Fin de la journée précédente).
            doTest(
                new Period('2024-01-01 00:00:00', '2024-01-02 00:00:00').setFullDays(true),
                ['2024-01-01', '2024-01-01', true],
            );
        });

        it('should allow to convert full-day period to hourly', () => {
            const doTest = (result: Period, expected: [string, string, boolean]): void => {
                expect(result.start.toString()).toBe(expected[0]);
                expect(result.end.toString()).toBe(expected[1]);
                expect(result.isFullDays).toBe(expected[2]);
            };

            // - Avec une période plusieurs jours.
            doTest(
                new Period('2024-01-01', '2024-01-02', true).setFullDays(false),
                ['2024-01-01 00:00:00', '2024-01-03 00:00:00', false],
            );

            // - Avec une période sur une seule journée.
            doTest(
                new Period('2024-01-01', '2024-01-01', true).setFullDays(false),
                ['2024-01-01 00:00:00', '2024-01-02 00:00:00', false],
            );
        });

        it('should allow to convert full-day period to hourly / midday', () => {
            const doTest = (result: Period, expected: [string, string, boolean]): void => {
                expect(result.start.toString()).toBe(expected[0]);
                expect(result.end.toString()).toBe(expected[1]);
                expect(result.isFullDays).toBe(expected[2]);
            };

            // - Avec une période plusieurs jours.
            doTest(
                new Period('2024-01-01', '2024-01-02', true).setFullDays(false, true),
                ['2024-01-01 12:00:00', '2024-01-02 12:00:00', false],
            );

            // - Avec une période sur une seule journée.
            doTest(
                new Period('2024-01-01', '2024-01-01', true).setFullDays(false, true),
                ['2024-01-01 12:00:00', '2024-01-01 12:00:00', false],
            );
        });
    });

    describe('asDays()', () => {
        it('should handle full days periods correctly', () => {
            // - Avec des journées entières (1).
            const period1 = new Period('2024-01-01', '2024-01-02', true);
            expect(period1.asDays()).toBe(2);

            // - Avec des journées entières (2).
            const period2 = new Period('2024-01-01', '2024-01-01', true);
            expect(period2.asDays()).toBe(1);
        });

        it('should handle hourly periods correctly', () => {
            // - Avec une période à l'heure près (1).
            const period1 = new Period('2024-01-01 14:30:00', '2024-01-02 10:20:00');
            expect(period1.asDays()).toBe(2);

            // - Avec une période à l'heure près (1).
            const period2 = new Period('2024-01-01 14:30:00', '2024-01-01 15:30:00');
            expect(period2.asDays()).toBe(1);
        });
    });

    describe('asHours()', () => {
        it('should handle full days periods correctly', () => {
            // - Avec des journées entières (1).
            const period1 = new Period('2024-01-01', '2024-01-02', true);
            expect(period1.asHours()).toBe(48);

            // - Avec des journées entières (2).
            const period2 = new Period('2024-01-01', '2024-01-01', true);
            expect(period2.asHours()).toBe(24);
        });

        it('should handle hourly periods correctly', () => {
            // - Avec une période à l'heure près (1).
            const period1 = new Period('2024-01-01 14:30:00', '2024-01-02 10:20:00');
            expect(period1.asHours()).toBe(21);

            // - Avec une période à l'heure près (1).
            const period2 = new Period('2024-01-01 14:30:00', '2024-01-01 15:30:00');
            expect(period2.asHours()).toBe(2);
        });

        it('should return decimal hourly periods correctly', () => {
            const period1 = new Period('2024-01-01 14:30:00', '2024-01-02 10:00:00');
            const result1 = period1.asHours(true);
            expect(result1).toBeInstanceOf(Decimal);
            expect(result1.toString()).toBe('19.5');

            const period2 = new Period('2024-01-01 13:30:00', '2024-01-01 15:30:00');
            const result2 = period2.asHours(true);
            expect(result2).toBeInstanceOf(Decimal);
            expect(result2.toString()).toBe('2');
        });
    });

    describe('asDuration()', () => {
        it('should handle full days periods correctly', () => {
            // - Avec des journées entières (1).
            const period1 = new Period('2024-01-01', '2024-01-02', true);
            expect(DateTime.isDuration(period1.asDuration())).toBeTruthy();
            expect(period1.asDuration().format('Y[y] M[mo] D[d] H[h] m[m] s[s]')).toBe('0y 0mo 2d 0h 0m 0s');

            // - Avec des journées entières (2).
            const period2 = new Period('2024-01-01', '2024-01-01', true);
            expect(DateTime.isDuration(period1.asDuration())).toBeTruthy();
            expect(period2.asDuration().format('Y[y] M[mo] D[d] H[h] m[m] s[s]')).toBe('0y 0mo 1d 0h 0m 0s');
        });

        it('should handle hourly periods correctly', () => {
            // - Avec une période à l'heure près (1).
            const period1 = new Period('2024-01-01 14:30:00', '2024-01-02 10:20:00');
            expect(DateTime.isDuration(period1.asDuration())).toBeTruthy();
            expect(period1.asDuration().format('Y[y] M[mo] D[d] H[h] m[m] s[s]')).toBe('0y 0mo 0d 19h 50m 0s');

            // - Avec une période à l'heure près (2).
            const period2 = new Period('2024-01-01 14:30:00', '2024-01-01 15:30:00');
            expect(DateTime.isDuration(period1.asDuration())).toBeTruthy();
            expect(period2.asDuration().format('Y[y] M[mo] D[d] H[h] m[m] s[s]')).toBe('0y 0mo 0d 1h 0m 0s');

            // - Avec une période à l'heure près (3).
            const period3 = new Period('2024-01-01 14:30:00', '2024-01-01 14:35:00');
            expect(DateTime.isDuration(period1.asDuration())).toBeTruthy();
            expect(period3.asDuration().format('Y[y] M[mo] D[d] H[h] m[m] s[s]')).toBe('0y 0mo 0d 0h 5m 0s');

            // - Avec une période à l'heure près (4).
            const period4 = new Period('2020-01-01 14:30:00', '2024-01-02 10:20:00');
            expect(DateTime.isDuration(period4.asDuration())).toBeTruthy();
            expect(period4.asDuration().format('Y[y] M[mo] D[d] H[h] m[m] s[s]')).toBe('4y 0mo 1d 19h 50m 0s');

            // - Avec une période à l'heure près (5).
            const period5 = new Period('2024-01-02 14:30:00.250', '2024-01-02 14:30:00.950');
            expect(DateTime.isDuration(period5.asDuration())).toBeTruthy();
            expect(period5.asDuration().format('Y[y] M[mo] D[d] H[h] m[m] s[s]')).toBe('0y 0mo 0d 0h 0m 1s');

            // - Avec une période à l'heure près (6).
            const period6 = new Period('2024-01-02 14:30:01', '2024-01-02 14:30:45');
            expect(DateTime.isDuration(period6.asDuration())).toBeTruthy();
            expect(period6.asDuration().format('Y[y] M[mo] D[d] H[h] m[m] s[s]')).toBe('0y 0mo 0d 0h 0m 44s');
        });
    });

    describe('merge()', () => {
        it('should allow to merge the duration of two periods', () => {
            const doTest = (result: Period, expected: [string, string, boolean]): void => {
                expect(result.start.toString()).toBe(expected[0]);
                expect(result.end.toString()).toBe(expected[1]);
                expect(result.isFullDays).toBe(expected[2]);
            };

            // - Avec des périodes identiques.
            const period1 = new Period('2024-01-01 00:00:00', '2024-01-02 00:00:00');
            const period2 = new Period('2024-01-01 00:00:00', '2024-01-02 00:00:00');
            doTest(period1.merge(period2), ['2024-01-01 00:00:00', '2024-01-02 00:00:00', false]);

            // - Avec des périodes de longueur différentes (1).
            const period3 = new Period('2024-01-01 16:00:00', '2024-01-03 14:30:00');
            doTest(period1.merge(period3), ['2024-01-01 00:00:00', '2024-01-03 14:30:00', false]);

            // - Avec des périodes de longueur différentes (2).
            const period4 = new Period('2024-01-01 08:00:00', '2024-01-01 12:17:00');
            doTest(period1.merge(period4), ['2024-01-01 00:00:00', '2024-01-02 00:00:00', false]);

            // - Avec des périodes de longueur différentes (3).
            const period5 = new Period('2023-06-22 10:18:35', '2025-04-12 12:18:20');
            doTest(period1.merge(period5), ['2023-06-22 10:18:35', '2025-04-12 12:18:20', false]);
        });

        it('should correctly handle full days periods', () => {
            const doTest = (result: Period, expected: [string, string, boolean]): void => {
                expect(result.start.toString()).toBe(expected[0]);
                expect(result.end.toString()).toBe(expected[1]);
                expect(result.isFullDays).toBe(expected[2]);
            };

            // - Avec des périodes identiques.
            const period1 = new Period('2024-01-01', '2024-01-03', true);
            const period2 = new Period('2024-01-01', '2024-01-03', true);
            doTest(period1.merge(period2), ['2024-01-01', '2024-01-03', true]);

            // - Avec des périodes de longueur différentes (1).
            const period3 = new Period('2024-01-01', '2024-01-05', true);
            doTest(period1.merge(period3), ['2024-01-01', '2024-01-05', true]);

            // - Avec des périodes de longueur différentes (2).
            const period4 = new Period('2024-01-02', '2024-01-02', true);
            doTest(period1.merge(period4), ['2024-01-01', '2024-01-03', true]);

            // - Avec des périodes de longueur différentes (3).
            const period5 = new Period('2023-06-22', '2025-04-12', true);
            doTest(period1.merge(period5), ['2023-06-22', '2025-04-12', true]);

            // - Avec des périodes de type et longueur différentes (1).
            const period6 = new Period('2024-01-01 16:00:00', '2024-01-05 14:30:00');
            doTest(period1.merge(period6), ['2024-01-01 00:00:00', '2024-01-05 14:30:00', false]);

            // - Avec des périodes de type et longueur différentes (2).
            const period7 = new Period('2024-01-01 08:00:00', '2024-01-03 12:17:00');
            doTest(period1.merge(period7), ['2024-01-01 00:00:00', '2024-01-04 00:00:00', false]);

            // - Avec des périodes de type et longueur différentes (3).
            const period8 = new Period('2023-06-22 10:18:35', '2025-04-12 12:18:20');
            doTest(period1.merge(period8), ['2023-06-22 10:18:35', '2025-04-12 12:18:20', false]);
        });
    });

    describe('narrow()', () => {
        const doTest = (result: Period | null, expected: [string, string, boolean]): void => {
            expect(result).not.toBeNull();
            expect(result!.start.toString()).toBe(expected[0]);
            expect(result!.end.toString()).toBe(expected[1]);
            expect(result!.isFullDays).toBe(expected[2]);
        };

        it('should allow to narrow the period within another one', () => {
            // - Avec des périodes identiques.
            const period1 = new Period('2024-01-01 00:00:00', '2024-01-02 00:00:00');
            const period2 = new Period('2024-01-01 00:00:00', '2024-01-02 00:00:00');
            doTest(period1.narrow(period2), ['2024-01-01 00:00:00', '2024-01-02 00:00:00', false]);

            // - Avec des périodes de longueur différentes (1).
            const period3 = new Period('2024-01-01 16:00:00', '2024-01-02 14:30:00');
            doTest(period1.narrow(period3), ['2024-01-01 16:00:00', '2024-01-02 00:00:00', false]);
            doTest(period3.narrow(period1), ['2024-01-01 16:00:00', '2024-01-02 00:00:00', false]);

            // - Avec des périodes de longueur différentes (2).
            const period4 = new Period('2024-01-01 08:00:00', '2024-01-08 12:17:00');
            doTest(period1.narrow(period4), ['2024-01-01 08:00:00', '2024-01-02 00:00:00', false]);

            // - Avec des périodes de longueur différentes (3).
            const period5 = new Period('2023-06-22 10:18:35', '2025-04-12 12:18:20');
            doTest(period1.narrow(period5), ['2024-01-01 00:00:00', '2024-01-02 00:00:00', false]);
            doTest(period5.narrow(period1), ['2024-01-01 00:00:00', '2024-01-02 00:00:00', false]);

            // - Avec des périodes qui ne se croisent pas.
            const period6 = new Period('2025-06-22 10:18:35', '2025-07-12 12:18:20');
            expect(period1.narrow(period6)).toBeNull();
        });

        it('should correctly handle full days periods', () => {
            // - Avec des périodes identiques.
            const period1 = new Period('2024-01-01', '2024-01-03', true);
            const period2 = new Period('2024-01-01', '2024-01-03', true);
            doTest(period1.narrow(period2), ['2024-01-01', '2024-01-03', true]);

            // - Avec des périodes de longueur différentes (1).
            const period3 = new Period('2024-01-01', '2024-01-05', true);
            doTest(period1.narrow(period3), ['2024-01-01', '2024-01-03', true]);

            // - Avec des périodes de longueur différentes (2).
            const period4 = new Period('2024-01-02', '2024-01-02', true);
            doTest(period1.narrow(period4), ['2024-01-02', '2024-01-02', true]);

            // - Avec des périodes de longueur différentes (3).
            const period5 = new Period('2023-06-22', '2025-04-12', true);
            doTest(period1.narrow(period5), ['2024-01-01', '2024-01-03', true]);

            // - Avec des périodes qui ne se croisent pas.
            const period6 = new Period('2023-06-22', '2023-07-12', true);
            expect(period1.narrow(period6)).toBeNull();

            // - Avec des périodes de type et longueur différentes (1).
            const period7 = new Period('2024-01-01 16:00:00', '2024-01-05 14:30:00');
            doTest(period1.narrow(period7), ['2024-01-01 16:00:00', '2024-01-04 00:00:00', false]);
            doTest(period7.narrow(period1), ['2024-01-01 16:00:00', '2024-01-04 00:00:00', false]);

            // - Avec des périodes de type et longueur différentes (2).
            const period8 = new Period('2024-01-01 08:00:00', '2024-01-03 12:17:00');
            doTest(period1.narrow(period8), ['2024-01-01 08:00:00', '2024-01-03 12:17:00', false]);

            // - Avec des périodes de type et longueur différentes (3).
            const period9 = new Period('2023-06-22 10:18:35', '2025-04-12 12:18:20');
            doTest(period1.narrow(period9), ['2024-01-01 00:00:00', '2024-01-04 00:00:00', false]);

            // - Avec des périodes qui ne se croisent pas.
            const period10 = new Period('2024-01-04 00:00:00', '2024-01-04 00:00:01');
            expect(period1.narrow(period10)).toBeNull();
        });
    });

    describe('offset()', () => {
        it('should allow to add a duration before and after a period', () => {
            const doTest = (result: Period, expected: [string, string, boolean]): void => {
                expect(result.start.toString()).toBe(expected[0]);
                expect(result.end.toString()).toBe(expected[1]);
                expect(result.isFullDays).toBe(expected[2]);
            };

            // - Avec une période à l'heure près.
            const period1 = new Period('2024-01-15 15:22:10', '2024-02-16 16:38:45');
            doTest(period1.offset(1, 'day'), ['2024-01-14 15:22:10', '2024-02-17 16:38:45', false]);
            doTest(period1.offset(1, 'year'), ['2023-01-15 15:22:10', '2025-02-16 16:38:45', false]);
            doTest(period1.offset(1, 'month'), ['2023-12-15 15:22:10', '2024-03-16 16:38:45', false]);
            doTest(period1.offset(1, 'hour'), ['2024-01-15 14:22:10', '2024-02-16 17:38:45', false]);
            doTest(period1.offset(1, 'minute'), ['2024-01-15 15:21:10', '2024-02-16 16:39:45', false]);
            doTest(period1.offset(1, 'second'), ['2024-01-15 15:22:09', '2024-02-16 16:38:46', false]);

            // - Avec une période aux jours entiers.
            const period2 = new Period('2024-01-15', '2024-02-16', true);
            doTest(period2.offset(1, 'day'), ['2024-01-14', '2024-02-17', true]);
            doTest(period2.offset(1, 'year'), ['2023-01-15', '2025-02-16', true]);
            doTest(period2.offset(1, 'month'), ['2023-12-15', '2024-03-16', true]);
        });

        it('should allow to used an instance of `Duration` for specifying the duration', () => {
            const doTest = (result: Period, expected: [string, string, boolean]): void => {
                expect(result.start.toString()).toBe(expected[0]);
                expect(result.end.toString()).toBe(expected[1]);
                expect(result.isFullDays).toBe(expected[2]);
            };

            // - Avec une période à l'heure près.
            const period1 = new Period('2024-01-15 15:22:10', '2024-02-16 16:38:45');
            doTest(period1.offset(DateTime.duration(1, 'day')), ['2024-01-14 15:22:10', '2024-02-17 16:38:45', false]);
            doTest(period1.offset(DateTime.duration(1, 'year')), ['2023-01-15 15:22:10', '2025-02-16 16:38:45', false]);
            doTest(period1.offset(DateTime.duration(1, 'month')), ['2023-12-15 15:22:10', '2024-03-16 16:38:45', false]);
            doTest(period1.offset(DateTime.duration(1, 'hour')), ['2024-01-15 14:22:10', '2024-02-16 17:38:45', false]);
            doTest(period1.offset(DateTime.duration(1, 'minute')), ['2024-01-15 15:21:10', '2024-02-16 16:39:45', false]);
            doTest(period1.offset(DateTime.duration(1, 'second')), ['2024-01-15 15:22:09', '2024-02-16 16:38:46', false]);

            // - Avec une période aux jours entiers.
            const period2 = new Period('2024-01-15', '2024-02-16', true);
            doTest(period2.offset(DateTime.duration(1, 'day')), ['2024-01-14', '2024-02-17', true]);
            doTest(period2.offset(DateTime.duration(1, 'year')), ['2023-01-15', '2025-02-16', true]);
            doTest(period2.offset(DateTime.duration(1, 'month')), ['2023-12-15', '2024-03-16', true]);
        });
    });

    describe('tail()', () => {
        it('should allow to retrieve a tail period', () => {
            const doTest = (result: Period, expected: [string, string, boolean]): void => {
                expect(result.start.toString()).toBe(expected[0]);
                expect(result.end.toString()).toBe(expected[1]);
                expect(result.isFullDays).toBe(expected[2]);
            };

            // - Avec une période à l'heure près.
            const period1 = new Period('2024-01-15 15:22:10', '2024-02-16 16:38:45');
            doTest(
                period1.tail(new DateTime('2024-02-22 12:12:00')),
                ['2024-02-16 16:38:45', '2024-02-22 12:12:00', false],
            );
            doTest(
                period1.tail(new Day('2024-02-22')),
                ['2024-02-16 16:38:45', '2024-02-23 00:00:00', false],
            );

            // - Avec une période aux jours entiers.
            const period2 = new Period('2024-01-15', '2024-02-16', true);
            doTest(
                period2.tail(new Day('2024-02-22')),
                ['2024-02-16', '2024-02-22', true],
            );
            doTest(
                period2.tail(new DateTime('2024-02-22 12:12:00')),
                ['2024-02-17 00:00:00', '2024-02-22 12:12:00', false],
            );
        });
    });

    describe('toReadableParts()', () => {
        it('should format period as readable parts', () => {
            // - Période simple.
            const period1 = new Period('2024-01-01 10:12:10', '2024-01-01 12:45:00');
            expect(period1.toReadableParts()).toStrictEqual({
                start: '01/01/2024 - 10:12',
                end: '01/01/2024 - 12:45',
            });

            // - Période sans heures.
            const period2 = new Period('2024-01-01', '2024-01-02');
            expect(period2.toReadableParts()).toStrictEqual({
                start: '01/01/2024 - 00:00',
                end: '01/02/2024 - 00:00', // - Format anglais.
            });
        });

        it('should handle full days periods', () => {
            // - Période "pleine" simple.
            const period1 = new Period('2024-01-01', '2024-01-02', true);
            expect(period1.toReadableParts()).toStrictEqual({
                start: '01/01/2024',
                end: '01/02/2024', // - Format anglais.
            });

            // - Période "pleine" simple sur une seule journée.
            const period2 = new Period('2024-01-01', '2024-01-01', true);
            expect(period2.toReadableParts()).toStrictEqual({
                start: '01/01/2024',
                end: '01/01/2024', // - Format anglais.
            });
        });

        it('should format period as readable parts with specified format', () => {
            // - Période simple.
            const period1 = new Period('2024-01-01 10:12:10', '2024-01-01 12:45:00');
            expect(period1.toReadableParts(PeriodPartReadableFormat.SHORT)).toStrictEqual({
                start: '01/01/2024 - 10:12',
                end: '01/01/2024 - 12:45',
            });
            expect(period1.toReadableParts(PeriodPartReadableFormat.MEDIUM)).toStrictEqual({
                start: 'Jan 1, 2024 - 10:12',
                end: 'Jan 1, 2024 - 12:45',
            });
            expect(period1.toReadableParts(PeriodPartReadableFormat.LONG)).toStrictEqual({
                start: 'January 1, 2024 - 10:12',
                end: 'January 1, 2024 - 12:45',
            });

            // - Période sans heures.
            const period2 = new Period('2024-01-01', '2024-01-02');
            expect(period2.toReadableParts(PeriodPartReadableFormat.SHORT)).toStrictEqual({
                start: '01/01/2024 - 00:00',
                end: '01/02/2024 - 00:00', // - Format anglais.
            });
            expect(period2.toReadableParts(PeriodPartReadableFormat.MEDIUM)).toStrictEqual({
                start: 'Jan 1, 2024 - 00:00',
                end: 'Jan 2, 2024 - 00:00',
            });
            expect(period2.toReadableParts(PeriodPartReadableFormat.LONG)).toStrictEqual({
                start: 'January 1, 2024 - 00:00',
                end: 'January 2, 2024 - 00:00',
            });

            // - Période "pleine" simples.
            const period3 = new Period('2024-01-01', '2024-01-02', true);
            expect(period3.toReadableParts(PeriodPartReadableFormat.SHORT)).toStrictEqual({
                start: '01/01/2024',
                end: '01/02/2024', // - Format anglais.
            });
            expect(period3.toReadableParts(PeriodPartReadableFormat.MEDIUM)).toStrictEqual({
                start: 'Jan 1, 2024',
                end: 'Jan 2, 2024',
            });
            expect(period3.toReadableParts(PeriodPartReadableFormat.LONG)).toStrictEqual({
                start: 'January 1, 2024',
                end: 'January 2, 2024',
            });

            // - Période "pleine" simples sur une seule journée.
            const period4 = new Period('2024-01-01', '2024-01-01', true);
            expect(period4.toReadableParts(PeriodPartReadableFormat.SHORT)).toStrictEqual({
                start: '01/01/2024',
                end: '01/01/2024', // - Format anglais.
            });
            expect(period4.toReadableParts(PeriodPartReadableFormat.MEDIUM)).toStrictEqual({
                start: 'Jan 1, 2024',
                end: 'Jan 1, 2024',
            });
            expect(period4.toReadableParts(PeriodPartReadableFormat.LONG)).toStrictEqual({
                start: 'January 1, 2024',
                end: 'January 1, 2024',
            });
        });
    });

    describe('toReadable()', () => {
        const fakeTranslateFn: I18nTranslate = (key: string, params?: Record<string, number | string>, count?: number) => (
            JSON.stringify({ key, params, count })
        );

        it('should format period as humanely readable', () => {
            const doTest = (period: Period, expectedResult: Record<string, any>): void => {
                expect(period.toReadable(fakeTranslateFn)).toStrictEqual(JSON.stringify(expectedResult));
            };

            // - Période simple.
            const period1 = new Period('2024-01-01 10:12:10', '2024-01-01 12:45:00');
            doTest(period1, {
                key: 'from-date-to-date',
                params: {
                    from: '01/01/2024 - 10:12',
                    to: '01/01/2024 - 12:45',
                },
            });

            // - Période sans heures.
            const period2 = new Period('2024-01-01', '2024-01-02');
            doTest(period2, {
                key: 'from-date-to-date',
                params: {
                    from: '01/01/2024 - 00:00',
                    to: '01/02/2024 - 00:00', // - Format anglais.
                },
            });
        });

        it('should handle full days periods', () => {
            const doTest = (period: Period, expectedResult: Record<string, any>): void => {
                expect(period.toReadable(fakeTranslateFn)).toStrictEqual(JSON.stringify(expectedResult));
            };

            // - Période "pleine" simple.
            const period1 = new Period('2024-01-01', '2024-01-02', true);
            doTest(period1, {
                key: 'from-date-to-date',
                params: {
                    from: '01/01/2024',
                    to: '01/02/2024', // - Format anglais.
                },
            });

            // - Période "pleine" simple sur une seule journée.
            const period2 = new Period('2024-01-01', '2024-01-01', true);
            doTest(period2, {
                key: 'on-date',
                params: {
                    date: '01/01/2024', // - Format anglais.
                },
            });
        });

        it('should format period as humanely readable with specified basic format', () => {
            const doTest = (period: Period, format: any, expectedResult: Record<string, any>): void => {
                expect(period.toReadable(fakeTranslateFn, format)).toStrictEqual(JSON.stringify(expectedResult));
            };

            // - Période simple.
            const period1 = new Period('2024-01-01 10:12:10', '2024-01-01 12:45:00');
            doTest(period1, PeriodReadableFormat.SHORT, {
                key: 'from-date-to-date',
                params: {
                    from: '01/01/2024 - 10:12',
                    to: '01/01/2024 - 12:45',
                },
            });
            doTest(period1, PeriodReadableFormat.MEDIUM, {
                key: 'from-date-to-date',
                params: {
                    from: 'Jan 1, 2024 - 10:12',
                    to: 'Jan 1, 2024 - 12:45',
                },
            });
            doTest(period1, PeriodReadableFormat.LONG, {
                key: 'from-date-to-date',
                params: {
                    from: 'January 1, 2024 - 10:12',
                    to: 'January 1, 2024 - 12:45',
                },
            });

            // - Période sans heures.
            const period2 = new Period('2024-01-01', '2024-01-02');
            doTest(period2, PeriodReadableFormat.SHORT, {
                key: 'from-date-to-date',
                params: {
                    from: '01/01/2024 - 00:00',
                    to: '01/02/2024 - 00:00', // - Format anglais.
                },
            });
            doTest(period2, PeriodReadableFormat.MEDIUM, {
                key: 'from-date-to-date',
                params: {
                    from: 'Jan 1, 2024 - 00:00',
                    to: 'Jan 2, 2024 - 00:00',
                },
            });
            doTest(period2, PeriodReadableFormat.LONG, {
                key: 'from-date-to-date',
                params: {
                    from: 'January 1, 2024 - 00:00',
                    to: 'January 2, 2024 - 00:00',
                },
            });

            // - Période "pleine" simples.
            const period3 = new Period('2024-01-01', '2024-01-02', true);
            doTest(period3, PeriodReadableFormat.SHORT, {
                key: 'from-date-to-date',
                params: {
                    from: '01/01/2024',
                    to: '01/02/2024', // - Format anglais.
                },
            });
            doTest(period3, PeriodReadableFormat.MEDIUM, {
                key: 'from-date-to-date',
                params: {
                    from: 'Jan 1, 2024',
                    to: 'Jan 2, 2024',
                },
            });
            doTest(period3, PeriodReadableFormat.LONG, {
                key: 'from-date-to-date',
                params: {
                    from: 'January 1, 2024',
                    to: 'January 2, 2024',
                },
            });

            // - Période "pleine" simples sur une seule journée.
            const period4 = new Period('2024-01-01', '2024-01-01', true);
            doTest(period4, PeriodReadableFormat.SHORT, {
                key: 'on-date',
                params: {
                    date: '01/01/2024', // - Format anglais.
                },
            });
            doTest(period4, PeriodReadableFormat.MEDIUM, {
                key: 'on-date',
                params: {
                    date: 'Jan 1, 2024',
                },
            });
            doTest(period4, PeriodReadableFormat.LONG, {
                key: 'on-date',
                params: {
                    date: 'January 1, 2024',
                },
            });
        });

        it('should format period as humanely readable with "minimalist" format', () => {
            const doTest = (period: Period, expectedResult: string): void => {
                expect(period.toReadable(fakeTranslateFn, PeriodReadableFormat.MINIMALIST))
                    .toStrictEqual(expectedResult);
            };

            // - Période simple.
            const period1 = new Period('2024-01-01 10:12:10', '2024-01-01 12:45:00');
            doTest(period1, '1 Jan - 10:12 ⇒ 1 Jan - 12:45');

            // - Période sans heures.
            const period2 = new Period('2024-01-01', '2024-01-02');
            doTest(period2, '1 Jan - 00:00 ⇒ 2 Jan - 00:00');

            // - Période "pleine" simples.
            const period3 = new Period('2024-01-01', '2024-01-02', true);
            doTest(period3, '1 Jan ⇒ 2 Jan');

            // - Période "pleine" simples sur une seule journée.
            const period4 = new Period('2024-01-01', '2024-01-01', true);
            doTest(period4, '1 Jan');
        });

        it('should format period as humanely readable with "sentence" format', () => {
            const doTest = (period: Period, expectedResult: Record<string, any>): void => {
                expect(period.toReadable(fakeTranslateFn, PeriodReadableFormat.SENTENCE))
                    .toStrictEqual(JSON.stringify(expectedResult));
            };

            // - Période simple.
            const period1 = new Period('2024-01-01 10:12:10', '2024-01-01 12:45:00');
            doTest(period1, {
                key: 'period-in-sentence',
                params: {
                    from: '01/01/2024 - 10:12',
                    to: '01/01/2024 - 12:45',
                },
            });

            // - Période sans heures.
            const period2 = new Period('2024-01-01', '2024-01-02');
            doTest(period2, {
                key: 'period-in-sentence',
                params: {
                    from: '01/01/2024 - 00:00',
                    to: '01/02/2024 - 00:00', // - Format anglais.
                },
            });

            // - Période "pleine" simples.
            const period3 = new Period('2024-01-01', '2024-01-02', true);
            doTest(period3, {
                key: 'period-in-sentence',
                params: {
                    from: '01/01/2024',
                    to: '01/02/2024', // - Format anglais.
                },
            });

            // - Période "pleine" simples sur une seule journée.
            const period4 = new Period('2024-01-01', '2024-01-01', true);
            doTest(period4, {
                key: 'date-in-sentence',
                params: {
                    date: '01/01/2024', // - Format anglais.
                },
            });
        });
    });

    describe('toReadableDuration()', () => {
        const fakeTranslateFn: I18nTranslate = (key: string, params?: Record<string, number | string>, count?: number) => (
            JSON.stringify({ key, params, count })
        );

        it('should handle full days periods correctly', () => {
            const doTest = (period: Period, expectedResult: Record<string, any>): void => {
                expect(period.toReadableDuration(fakeTranslateFn)).toStrictEqual(JSON.stringify(expectedResult));
            };

            // - Avec des journées entières (1).
            const period1 = new Period('2024-01-01', '2024-01-02', true);
            doTest(period1, {
                key: 'durations.days',
                params: { count: 2 },
                count: 2,
            });

            // - Avec des journées entières (2).
            const period2 = new Period('2024-01-01', '2024-01-01', true);
            doTest(period2, {
                key: 'durations.hours',
                params: { count: 24 },
                count: 24,
            });
        });

        it('should handle hourly periods correctly', () => {
            const doTest = (period: Period, expectedResult: Record<string, any>): void => {
                expect(period.toReadableDuration(fakeTranslateFn)).toStrictEqual(JSON.stringify(expectedResult));
            };

            // - Avec une période à l'heure près (1).
            const period1 = new Period('2024-01-01 14:30:00', '2024-01-02 10:20:00');
            doTest(period1, {
                key: 'durations.hours',
                params: { count: 20 },
                count: 20,
            });

            // - Avec une période à l'heure près (2).
            const period2 = new Period('2024-01-01 14:30:00', '2024-01-01 15:30:00');
            doTest(period2, {
                key: 'durations.hours',
                params: { count: 1 },
                count: 1,
            });

            // - Avec une période à l'heure près (3).
            const period3 = new Period('2024-01-01 14:30:00', '2024-01-01 14:35:00');
            doTest(period3, {
                key: 'durations.minutes',
                params: { count: 5 },
                count: 5,
            });

            // - Avec une période à l'heure près (4).
            const period4 = new Period('2020-01-01 14:30:00', '2024-01-02 10:20:00');
            doTest(period4, {
                key: 'durations.days',
                params: { count: 1462 },
                count: 1462,
            });

            // - Avec une période à l'heure près (5).
            const period5 = new Period('2024-01-02 14:30:00.250', '2024-01-02 14:30:00.950');
            doTest(period5, {
                key: 'durations.seconds',
                params: { count: 1 },
                count: 1,
            });

            // - Avec une période à l'heure près (6).
            const period6 = new Period('2024-01-02 14:30:01', '2024-01-02 14:30:45');
            doTest(period6, {
                key: 'durations.seconds',
                params: { count: 44 },
                count: 44,
            });
        });
    });

    describe('toSerialized()', () => {
        it('should serialize period', () => {
            // - Période simple.
            const period1 = new Period('2024-01-01 10:12:10', '2024-01-01 12:45:00');
            expect(period1.toSerialized()).toStrictEqual({
                start: '2024-01-01 10:12:10',
                end: '2024-01-01 12:45:00',
                isFullDays: false,
            });

            // - Période sans heures.
            const period2 = new Period('2024-01-01', '2024-01-02');
            expect(period2.toSerialized()).toStrictEqual({
                start: '2024-01-01 00:00:00',
                end: '2024-01-02 00:00:00',
                isFullDays: false,
            });
        });

        it('should handle full days periods', () => {
            // - Période "pleine" simples.
            const period1 = new Period('2024-01-01', '2024-01-02', true);
            expect(period1.toSerialized()).toStrictEqual({
                start: '2024-01-01',
                end: '2024-01-02',
                isFullDays: true,
            });
        });
    });

    describe('toQueryParams()', () => {
        it('should format period as query parameters', () => {
            // - Période simple.
            const period1 = new Period('2024-01-01 10:12:10', '2024-01-01 12:45:00');
            expect(period1.toQueryParams('period')).toStrictEqual({
                'period[start]': '2024-01-01 10:12:10',
                'period[end]': '2024-01-01 12:45:00',
            });

            // - Période sans heures.
            const period2 = new Period('2024-01-01', '2024-01-02');
            expect(period2.toQueryParams('period')).toStrictEqual({
                'period[start]': '2024-01-01 00:00:00',
                'period[end]': '2024-01-02 00:00:00',
            });
        });

        it('should handle full days periods', () => {
            // - Période "pleine" simples.
            const period1 = new Period('2024-01-01', '2024-01-02', true);
            expect(period1.toQueryParams('period')).toStrictEqual({
                'period[start]': '2024-01-01',
                'period[end]': '2024-01-02',
            });
        });
    });

    describe('fromSerialized()', () => {
        it('should work as expected', () => {
            // - Format de données invalide.
            const invalidData = [
                {},
                { start: '2019-01-01', end: '[Invalid]' },
                { start: '[Invalid]', end: '2019-01-01' },
                { start: '[Invalid]', end: '[Invalid]', isFullDays: 'ok' },
            ];
            invalidData.forEach((invalidDatum: any) => {
                expect(() => Period.fromSerialized(invalidDatum)).toThrow();
            });

            const doTest = (data: any, expected: [string, string, boolean]): void => {
                const result = Period.fromSerialized(data);

                expect(result).toBeInstanceOf(Period);
                expect(result.start.toString()).toBe(expected[0]);
                expect(result.end.toString()).toBe(expected[1]);
                expect(result.isFullDays).toBe(expected[2]);
            };

            doTest(
                { start: '2019-01-01', end: '2019-02-01', isFullDays: false },
                ['2019-01-01 00:00:00', '2019-02-01 00:00:00', false],
            );

            // - Format complexe: Journée entière.
            doTest(
                { start: '2019-01-01', end: '2019-02-01', isFullDays: true },
                ['2019-01-01', '2019-02-01', true],
            );

            doTest(
                {
                    start: '2019-01-01 10:28:14',
                    end: '2019-01-01 11:42:32',
                    isFullDays: false,
                },
                ['2019-01-01 10:28:14', '2019-01-01 11:42:32', false],
            );

            // - Format complexe avec journées entières déduite.
            doTest(
                { start: '2019-01-01', end: '2019-02-01', isFullDays: true },
                ['2019-01-01', '2019-02-01', true],
            );
        });
    });

    describe('from()', () => {
        it('should work as expected', () => {
            // - Avec des valeurs invalides.
            const invalidData = [
                '',
                {},
                [],
                null,
                ['[Invalid]', '[Invalid]'],
                { start: '2019-01-01', end: '[Invalid]' },
                { start: '[Invalid]', end: '2019-01-01' },
                { start: '[Invalid]', end: '[Invalid]', isFullDays: 'ok' },
            ];
            invalidData.forEach((invalidDatum: any) => {
                expect(() => { Period.from(invalidDatum); }).toThrow();
            });

            const doTest = (data: any, expected: [string, string, boolean]): void => {
                const result = Period.from(data);

                expect(result).toBeInstanceOf(Period);
                expect(result.start.toString()).toBe(expected[0]);
                expect(result.end.toString()).toBe(expected[1]);
                expect(result.isFullDays).toBe(expected[2]);
            };

            // - Avec une période.
            doTest(
                new Period('2024-01-01 14:42:21', '2024-12-01 10:02:20'),
                ['2024-01-01 14:42:21', '2024-12-01 10:02:20', false],
            );

            // - Avec une période en journées entières.
            doTest(
                new Period('2024-01-01', '2024-12-02', true),
                ['2024-01-01', '2024-12-02', true],
            );

            // - Avec un objet.
            doTest(
                { start: '2019-01-01', end: '2019-01-01 23:59:59' },
                ['2019-01-01 00:00:00', '2019-01-01 23:59:59', false],
            );
        });
    });

    describe('tryFrom()', () => {
        it('should work as expected', () => {
            // - Format de données invalide.
            const invalidData = [
                '',
                {},
                [],
                null,
                ['[Invalid]', '[Invalid]'],
                { start: '2019-01-01', end: '[Invalid]' },
                { start: '[Invalid]', end: '2019-01-01' },
                { start: '[Invalid]', end: '[Invalid]', isFullDays: 'ok' },
            ];
            invalidData.forEach((invalidDatum: any) => {
                expect(Period.tryFrom(invalidDatum)).toBeNull();
            });

            const doTest = (data: any, expected: [string, string, boolean]): void => {
                const result = Period.tryFrom(data);

                expect(result).not.toBeNull();
                expect(result).toBeInstanceOf(Period);
                expect(result!.start.toString()).toBe(expected[0]);
                expect(result!.end.toString()).toBe(expected[1]);
                expect(result!.isFullDays).toBe(expected[2]);
            };

            // - Avec une période.
            doTest(
                new Period('2024-01-01 14:42:21', '2024-12-01 10:02:20'),
                ['2024-01-01 14:42:21', '2024-12-01 10:02:20', false],
            );

            // - Avec une période en journées entières.
            doTest(
                new Period('2024-01-01', '2024-12-02', true),
                ['2024-01-01', '2024-12-02', true],
            );

            // - Avec un objet.
            doTest(
                { start: '2019-01-01', end: '2019-01-01 23:59:59' },
                ['2019-01-01 00:00:00', '2019-01-01 23:59:59', false],
            );
        });
    });
});
