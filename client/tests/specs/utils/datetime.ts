import DateTime from '@/utils/datetime';
import Period from '@/utils/period';

describe('Utils / datetime', () => {
    describe('now()', () => {
        it('return an instance with the current date / time', () => {
            jest
                .useFakeTimers()
                .setSystemTime(new Date('2024-02-01T14:48:00.000Z'));

            expect(DateTime.now().format('YYYY-MM-DD HH:mm:ss.SSS')).toBe('2024-02-01 14:48:00.000');
        });
    });

    describe('set()', () => {
        it('should allow to modify single date unit', () => {
            const result1 = new DateTime('2024-01-01 00:00:00.000').set('date', 15);
            expect(result1.format('YYYY-MM-DD HH:mm:ss.SSS')).toBe('2024-01-15 00:00:00.000');

            const result2 = new DateTime('2024-01-01 00:00:00.000').set('month', 3);
            expect(result2.format('YYYY-MM-DD HH:mm:ss.SSS')).toBe('2024-04-01 00:00:00.000');

            const result3 = new DateTime('2024-01-01 00:00:00.000').set('second', 30);
            expect(result3.format('YYYY-MM-DD HH:mm:ss.SSS')).toBe('2024-01-01 00:00:30.000');
        });

        it('should allow to modify multiple units in one go', () => {
            const result = new DateTime('2024-01-01 00:00:00.000').set({ date: 15, month: 3, second: 30 });
            expect(result.format('YYYY-MM-DD HH:mm:ss.SSS')).toBe('2024-04-15 00:00:30.000');
        });
    });

    describe('setTime()', () => {
        it('should allow to set the time in one go', () => {
            const result1 = new DateTime('2024-06-12 14:30:24').setTime('12:35:40');
            expect(result1.format('YYYY-MM-DD HH:mm:ss.SSS')).toBe('2024-06-12 12:35:40.000');

            const result2 = new DateTime('2024-06-12 00:00:00').setTime('12:35:40.500');
            expect(result2.format('YYYY-MM-DD HH:mm:ss.SSS')).toBe('2024-06-12 12:35:40.500');

            const result3 = new DateTime('2024-06-12 23:59:59.999').setTime('12:35');
            expect(result3.format('YYYY-MM-DD HH:mm:ss.SSS')).toBe('2024-06-12 12:35:00.000');
        });
    });

    describe('isStartOf()', () => {
        it('allows getting the start of ... a year', () => {
            expect(new DateTime('2024-06-12 14:30:24').isStartOfYear()).toBeFalsy();
            expect(new DateTime('2024-01-01 00:00:00').isStartOfYear()).toBeTruthy();
        });

        it('allows getting the start of ... a month', () => {
            expect(new DateTime('2024-06-12 14:30:24').isStartOfMonth()).toBeFalsy();
            expect(new DateTime('2024-06-01 00:00:00').isStartOfMonth()).toBeTruthy();
        });

        it('allows getting the start of ... a week', () => {
            expect(new DateTime('2024-06-12 14:30:24').isStartOfWeek()).toBeFalsy();

            // NOTE: On est en anglais => Premier jour de la semaine le dimanche.
            expect(new DateTime('2024-06-09 00:00:00').isStartOfWeek()).toBeTruthy();
        });

        it('allows getting the start of ... a day', () => {
            expect(new DateTime('2024-01-01 00:00:00').isStartOfDay()).toBeTruthy();
            expect(new DateTime('2024-01-01 00:00:00.000').isStartOfDay()).toBeTruthy();

            expect(new DateTime('2024-01-01 12:05:00').isStartOfDay()).toBeFalsy();
            expect(new DateTime('2024-01-01 00:00:00.999').isStartOfDay()).toBeFalsy();
        });

        it('allows getting the start of ... an hour', () => {
            expect(new DateTime('2024-06-12 14:30:24').isStartOfHour()).toBeFalsy();
            expect(new DateTime('2024-06-12 14:00:00').isStartOfHour()).toBeTruthy();
        });

        it('allows getting the start of ... a minute', () => {
            expect(new DateTime('2024-06-12 14:30:24').isStartOfMinute()).toBeFalsy();
            expect(new DateTime('2024-06-12 14:30:00').isStartOfMinute()).toBeTruthy();
        });

        it('allows getting the start of ... a second', () => {
            expect(new DateTime('2024-06-12 14:30:24.333').isStartOfSecond()).toBeFalsy();

            expect(new DateTime('2024-06-12 14:30:24.000').isStartOfSecond()).toBeTruthy();
            expect(new DateTime('2024-06-12 14:30:24').isStartOfSecond()).toBeTruthy();
        });
    });

    describe('isBetween()', () => {
        it('should tell if the date is in a period', () => {
            const period1 = new Period('2024-06-11 14:30:24', '2024-06-12 14:30:24');
            expect(new DateTime('2024-06-11 14:30:23').isBetween(period1)).toBeFalsy();
            expect(new DateTime('2024-06-12 14:30:25').isBetween(period1)).toBeFalsy();
            expect(new DateTime('2024-05-12 18:30:24').isBetween(period1)).toBeFalsy();
            expect(new DateTime('2024-06-12 14:30:24').isBetween(period1)).toBeFalsy();
            expect(new DateTime('2024-06-11 14:30:24').isBetween(period1)).toBeTruthy();
            expect(new DateTime('2024-06-12 08:00:00').isBetween(period1)).toBeTruthy();
            expect(new DateTime('2024-06-12 14:30:23').isBetween(period1)).toBeTruthy();

            const period2 = new Period('2024-06-11', '2024-06-14', true);
            expect(new DateTime('2024-06-10 23:59:59').isBetween(period2)).toBeFalsy();
            expect(new DateTime('2024-06-15 00:00:00').isBetween(period2)).toBeFalsy();
            expect(new DateTime('2024-06-11 00:00:00').isBetween(period2)).toBeTruthy();
            expect(new DateTime('2024-06-12 12:30:00').isBetween(period2)).toBeTruthy();
            expect(new DateTime('2024-06-14 23:59:59').isBetween(period2)).toBeTruthy();

            // - Avec un autre discriminateur.
            expect(new DateTime('2024-06-12 14:30:24').isBetween(period1, '[]')).toBeTruthy();
        });
    });

    describe('compare()', () => {
        it('return 0 when the two dates are equals', () => {
            const a = new DateTime('2021-08-01 12:05:00');
            expect(a.compare(a)).toBe(0);
            expect(a.compare(new DateTime('2021-08-01 12:05:00'))).toBe(0);
            expect(a.compare('2021-08-01 12:05:00')).toBe(0);
        });

        it('return -1 when the current instance if before the other', () => {
            const a = new DateTime('2021-08-01 12:05:00');
            const b = new DateTime('2021-08-01 12:06:01');
            expect(a.compare(b)).toBe(-1);
            expect(b.compare(a)).not.toBe(-1);
            expect(a.compare('2021-08-01 12:06:01')).toBe(-1);
        });

        it('return 1 when the current instance if after the other', () => {
            const a = new DateTime('2021-08-01 12:06:01');
            const b = new DateTime('2021-08-01 12:05:00');
            expect(a.compare(b)).toBe(1);
            expect(b.compare(a)).not.toBe(1);
            expect(a.compare('2021-08-01 12:05:00')).toBe(1);
        });

        it('should allow to customize the granularity', () => {
            const a = new DateTime('2021-08-01 12:05:00');
            const b = new DateTime('2021-08-01 12:06:01');

            expect(a.compare(b, 'year')).toBe(0);
            expect(a.compare(b, 'month')).toBe(0);
            expect(a.compare(b, 'day')).toBe(0);
            expect(a.compare(b, 'hour')).toBe(0);
            expect(a.compare(b, 'minute')).toBe(-1);
        });
    });

    describe('roundMinutes()', () => {
        it('return a date rounded to the nearest quarter', () => {
            // - 12:00.
            const result1 = new DateTime('2021-08-01 12:05:00').roundMinutes(15);
            expect(result1.format('YYYY-MM-DD HH:mm:ss.SSS')).toBe('2021-08-01 12:00:00.000');

            // - 12:15.
            const result2 = new DateTime('2021-08-01 12:12:00').roundMinutes(15);
            expect(result2.format('YYYY-MM-DD HH:mm:ss.SSS')).toBe('2021-08-01 12:15:00.000');

            // - 12:30.
            const result3 = new DateTime('2021-08-01 12:25:00').roundMinutes(15);
            expect(result3.format('YYYY-MM-DD HH:mm:ss.SSS')).toBe('2021-08-01 12:30:00.000');

            // - 13:00 (Heure suivante).
            const result = new DateTime('2021-08-01 12:55:00').roundMinutes(15);
            expect(result.format('YYYY-MM-DD HH:mm:ss.SSS')).toBe('2021-08-01 13:00:00.000');

            // - 00:00 (Jour suivant).
            const result5 = new DateTime('2021-08-01 23:55:00').roundMinutes(15);
            expect(result5.format('YYYY-MM-DD HH:mm:ss.SSS')).toBe('2021-08-02 00:00:00.000');
        });

        it('should handle de lower units before rounding', () => {
            const result1 = new DateTime('2020-01-01 23:46:30').roundMinutes();
            expect(result1.format('YYYY-MM-DD HH:mm:ss.SSS')).toBe('2020-01-01 23:47:00.000');

            // - Doit arrondir à `02:00:00` car en prenant en compte les secondes / millisecondes
            //   on tombe au dessus dans l'heure suivante (et pas `01:45:00`).
            const result2 = new DateTime('2020-01-01 01:52:29.666').roundMinutes(15);
            expect(result2.format('YYYY-MM-DD HH:mm:ss.SSS')).toBe('2020-01-01 02:00:00.000');
        });

        it('return a date rounded to the nearest half-hour', () => {
            // - 13:30 (arrondi vers le haut)
            const result1 = new DateTime('2021-08-01 13:16:00').roundMinutes(30);
            expect(result1.format('YYYY-MM-DD HH:mm:ss.SSS')).toBe('2021-08-01 13:30:00.000');

            // - 13:30 (arrondi vers le bas)
            const result2 = new DateTime('2021-08-01 13:44:00').roundMinutes(30);
            expect(result2.format('YYYY-MM-DD HH:mm:ss.SSS')).toBe('2021-08-01 13:30:00.000');

            // - 00:00 (Jour suivant)
            const result3 = new DateTime('2021-08-01 23:48:00').roundMinutes(30);
            expect(result3.format('YYYY-MM-DD HH:mm:ss.SSS')).toBe('2021-08-02 00:00:00.000');
        });

        it('return a date rounded to the nearest hour', () => {
            // - 14:00 (arrondi vers le haut)
            const result1 = new DateTime('2021-08-01 13:31:00').roundMinutes(60);
            expect(result1.format('YYYY-MM-DD HH:mm:ss.SSS')).toBe('2021-08-01 14:00:00.000');

            // - 14:00 (arrondi vers le bas)
            const result2 = new DateTime('2021-08-01 14:28:00').roundMinutes(60);
            expect(result2.format('YYYY-MM-DD HH:mm:ss.SSS')).toBe('2021-08-01 14:00:00.000');

            // - 00:00 (Jour suivant)
            const result3 = new DateTime('2021-08-01 23:32:00').roundMinutes(60);
            expect(result3.format('YYYY-MM-DD HH:mm:ss.SSS')).toBe('2021-08-02 00:00:00.000');
        });
    });
});
