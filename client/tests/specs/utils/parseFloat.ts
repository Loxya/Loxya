import parseFloat from '@/utils/parseFloat';

describe('parseFloat', () => {
    it('returns the float when value is a valid float', () => {
        expect(parseFloat(10.5)).toBe(10.5);
        expect(parseFloat(-10.5)).toBe(-10.5);
        expect(parseFloat('10.65')).toBe(10.65);
        expect(parseFloat('10546.65')).toBe(10_546.65);
        expect(parseFloat(1)).toBe(1);
        expect(parseFloat(-55_555)).toBe(-55_555);
        expect(parseFloat('10')).toBe(10);
        expect(parseFloat('10546')).toBe(10_546);
        expect(parseFloat('-10')).toBe(-10);
    });

    it('returns null when value is not a valid float', () => {
        expect(parseFloat('foo 10')).toBeNull();
        expect(parseFloat('foo 10.10')).toBeNull();
        expect(parseFloat('Infinity')).toBeNull();
        expect(parseFloat('Infinity.5')).toBeNull();
        expect(parseFloat(Infinity)).toBeNull();
        expect(parseFloat('10 546')).toBeNull();
        expect(parseFloat('10 546.5')).toBeNull();
    });
});
