import isValidFloat from '@/utils/isValidFloat';

describe('isValidFloat', () => {
    it('returns true when value is a valid float', () => {
        expect(isValidFloat(10.5)).toBe(true);
        expect(isValidFloat(-10.5)).toBe(true);
        expect(isValidFloat('10.65')).toBe(true);
        expect(isValidFloat('10.')).toBe(true);
        expect(isValidFloat('10546.65')).toBe(true);
        expect(isValidFloat(1)).toBe(true);
        expect(isValidFloat(-55_555)).toBe(true);
        expect(isValidFloat('10')).toBe(true);
        expect(isValidFloat('10546')).toBe(true);
        expect(isValidFloat('-10')).toBe(true);
        expect(isValidFloat('-10.')).toBe(true);
    });

    it('returns false when value is not a valid float', () => {
        expect(isValidFloat('foo 10')).toBe(false);
        expect(isValidFloat('foo 10.10')).toBe(false);
        expect(isValidFloat('Infinity')).toBe(false);
        expect(isValidFloat('Infinity.5')).toBe(false);
        expect(isValidFloat(Infinity)).toBe(false);
        expect(isValidFloat('10 546')).toBe(false);
        expect(isValidFloat('10 546.5')).toBe(false);
    });
});
