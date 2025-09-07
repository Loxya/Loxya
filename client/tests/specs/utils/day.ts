import Day from '@/utils/day';
import Period from '@/utils/period';
import DateTime from '@/utils/datetime';

describe('Utils / Day', () => {
    it('should throw if the input string is not correctly formatted', () => {
        ['[Invalid]', '2024-01-01 18:59:20'].forEach((invalidInput: string) => {
            expect(() => new Day(invalidInput)).toThrow();
        });
        expect(() => new Day('2024-01-01')).not.toThrow();
    });

    it('should parse date correctly', () => {
        expect(new Day('2024-01-01').toString()).toBe('2024-01-01');
        expect(new Day(new Day('2024-01-02')).toString()).toBe('2024-01-02');
        expect(new Day(new DateTime('2024-07-02 14:58:45')).toString()).toBe('2024-07-02');
    });

    describe('today()', () => {
        it('return an instance with the current date', () => {
            jest
                .useFakeTimers()
                .setSystemTime(new Date('2024-02-01T14:48:00.000Z'));

            expect(Day.today().format('YYYY-MM-DD')).toBe('2024-02-01');
        });
    });

    describe('set()', () => {
        it('should allow to modify single day unit', () => {
            const result1 = new Day('2024-01-01').set('date', 15);
            expect(result1.format('YYYY-MM-DD')).toBe('2024-01-15');

            const result2 = new Day('2024-01-01').set('month', 3);
            expect(result2.format('YYYY-MM-DD')).toBe('2024-04-01');
        });

        it('should allow to modify multiple units in one go', () => {
            const result = new Day('2024-01-01').set({ date: 15, month: 3 });
            expect(result.format('YYYY-MM-DD')).toBe('2024-04-15');
        });
    });

    describe('isBetween()', () => {
        it('should tell if the day is in a period', () => {
            const period1 = new Period('2024-06-11 14:30:24', '2024-06-13 14:30:24');
            expect(new Day('2024-06-10').isBetween(period1)).toBeFalsy();
            expect(new Day('2024-06-14').isBetween(period1)).toBeFalsy();
            // expect(new Day('2024-06-11').isBetween(period1)).toBeTruthy();
            expect(new Day('2024-06-12').isBetween(period1)).toBeTruthy();
            expect(new Day('2024-06-13').isBetween(period1)).toBeTruthy();

            const period2 = new Period('2024-06-11', '2024-06-13', true);
            expect(new Day('2024-06-10').isBetween(period2)).toBeFalsy();
            expect(new Day('2024-06-14').isBetween(period2)).toBeFalsy();
            expect(new Day('2024-06-11').isBetween(period2)).toBeTruthy();
            expect(new Day('2024-06-12').isBetween(period2)).toBeTruthy();
            expect(new Day('2024-06-13').isBetween(period2)).toBeTruthy();

            const period3 = new Period('2024-06-11 14:30:24', '2024-06-11 16:30:24');
            expect(new Day('2024-06-10').isBetween(period3)).toBeFalsy();
            expect(new Day('2024-06-12').isBetween(period3)).toBeFalsy();
            expect(new Day('2024-06-11').isBetween(period3)).toBeTruthy();

            const period4 = new Period('2024-06-11 00:00:00', '2024-06-12 00:00:00');
            expect(new Day('2024-06-12').isBetween(period4)).toBeFalsy();
            expect(new Day('2024-06-11').isBetween(period4)).toBeTruthy();

            // - Avec un autre discriminateur.
            expect(new Day('2024-06-11').isBetween(period2, '()')).toBeFalsy();
            expect(new Day('2024-06-11').isBetween(period2, '[)')).toBeTruthy();
            expect(new Day('2024-06-13').isBetween(period2, '()')).toBeFalsy();
            expect(new Day('2024-06-13').isBetween(period2, '(]')).toBeTruthy();
        });
    });

    describe('compare()', () => {
        it('return 0 when the two dates are equals', () => {
            const a = new Day('2021-08-01');
            expect(a.compare(a)).toBe(0);
            expect(a.compare(new Day('2021-08-01'))).toBe(0);
            expect(a.compare('2021-08-01')).toBe(0);
        });

        it('return -1 when the current instance if before the other', () => {
            const a = new Day('2021-08-01');
            const b = new Day('2021-08-02');
            expect(a.compare(b)).toBe(-1);
            expect(b.compare(a)).not.toBe(-1);
            expect(a.compare('2021-08-02')).toBe(-1);
        });

        it('return 1 when the current instance if after the other', () => {
            const a = new Day('2021-08-02');
            const b = new Day('2021-08-01');
            expect(a.compare(b)).toBe(1);
            expect(b.compare(a)).not.toBe(1);
            expect(a.compare('2021-08-01')).toBe(1);
        });

        it('should allow to customize the granularity', () => {
            const a = new Day('2021-08-01');
            const b = new Day('2021-09-02');

            expect(a.compare(b, 'year')).toBe(0);
            expect(a.compare(b, 'month')).toBe(-1);
        });
    });
});
