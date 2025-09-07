import formatAddress from '@/utils/formatAddress';
import countries from '@fixtures/parsed/countries';

describe('formatAddress', () => {
    it('returns the address as a string', () => {
        const country = countries.default(1);

        // - Adresse complète.
        const result1 = formatAddress('5 rue des tests', '05000', 'Gap', country);
        expect(result1).toBe('5 rue des tests\n05000 Gap\nFrance');

        // - Rue uniquement.
        const result2 = formatAddress('5 rue des tests', null, null, null);
        expect(result2).toBe('5 rue des tests');

        // - Code postal uniquement.
        const result3 = formatAddress(null, '05000', null, null);
        expect(result3).toBe('05000');

        // - Ville uniquement.
        const result4 = formatAddress(null, null, 'Gap', null);
        expect(result4).toBe('Gap');

        // - Code postal + Ville.
        const result5 = formatAddress(null, '05000', 'Gap', null);
        expect(result5).toBe('05000 Gap');

        // - Rue + Ville.
        const result6 = formatAddress('5 rue des tests', null, 'Gap', null);
        expect(result6).toBe('5 rue des tests\nGap');

        // - Pays uniquement.
        const result7 = formatAddress(null, null, null, country);
        expect(result7).toBe('France');

        // - Rue + Pays.
        const result8 = formatAddress('5 rue des tests', null, null, country);
        expect(result8).toBe('5 rue des tests\nFrance');
    });

    it('returns null when nothing given', () => {
        const result = formatAddress(null, null, null, null);
        expect(result).toBeNull();
    });
});
