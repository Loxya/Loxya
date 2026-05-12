import formatNumber from '@/utils/formatNumber';

describe('formatNumber', () => {
    it('returns a correctly formatted integer', () => {
        expect(formatNumber(0)).toBe('0');
        expect(formatNumber(100)).toBe('100');
        expect(formatNumber(1000)).toBe(`1\u202F000`);
        expect(formatNumber(100_000)).toBe(`100\u202F000`);
        expect(formatNumber(-12_425)).toBe(`-12\u202F425`);
        expect(formatNumber(105_432_100)).toBe(`105\u202F432\u202F100`);
        expect(formatNumber(Infinity)).toBe('∞');
        expect(formatNumber(100, 2)).toBe('100,00');
    });

    it('returns a correctly formatted float', () => {
        expect(formatNumber(0.0)).toBe('0');
        expect(formatNumber(1.25)).toBe('1,25');
        expect(formatNumber(50.0)).toBe('50');
        expect(formatNumber(50.0, 2)).toBe('50,00');
        expect(formatNumber(50.001)).toBe('50,001');
        expect(formatNumber(50.9453)).toBe('50,945');
        expect(formatNumber(50.9453, 4)).toBe('50,9453');
        expect(formatNumber(50.000_01, 5)).toBe('50,00001');
        expect(formatNumber(50.000_001, 5)).toBe('50,00000');
    });
});
