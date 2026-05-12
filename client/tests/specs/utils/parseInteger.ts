import parseInteger from '@/utils/parseInteger';

describe('parseInteger', () => {
    it('returns a valid integer when value is a valid integer', () => {
        expect(parseInteger(1)).toBe(1);
        expect(parseInteger(-55_555)).toBe(-55_555);
        expect(parseInteger('10')).toBe(10);
        expect(parseInteger('10546')).toBe(10_546);
        expect(parseInteger('-10')).toBe(-10);
    });

    it('returns null when value is not a valid integer', () => {
        expect(parseInteger(10.5)).toBeNull();
        expect(parseInteger(-10.5)).toBeNull();
        expect(parseInteger('10.65')).toBeNull();
        expect(parseInteger('foo 10')).toBeNull();
        expect(parseInteger('Infinity')).toBeNull();
        expect(parseInteger(Infinity)).toBeNull();
        expect(parseInteger('10 546')).toBeNull();
    });
});
