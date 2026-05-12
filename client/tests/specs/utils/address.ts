import Address from '@/utils/address';

describe('Utils / Address', () => {
    describe('format()', () => {
        it('allows to format an address', () => {
            let address1 = new Address('US')
                .withAddressLine1('101 Independence Ave. S.E.')
                .withLocality('Washington');

            expect(address1.format()).toBe((
                `101 Independence Ave. S.E.\n` +
                `Washington`
            ));

            // - Avec le code postal en plus.
            address1 = address1.withPostalCode('20559-6000');

            expect(address1.format()).toBe((
                `101 Independence Ave. S.E.\n` +
                `Washington, 20559-6000`
            ));

            // - Avec toutes les infos.
            address1 = address1
                .withAddressLine2('Headquarters')
                .withAdministrativeArea('DC');

            expect(address1.format()).toBe((
                `101 Independence Ave. S.E.\n` +
                `Headquarters\n` +
                `Washington, DC 20559-6000`
            ));

            // - Adresse française
            const address2 = new Address('FR')
                .withAddressLine1('1 rue de paris')
                .withAdministrativeArea('Auvergne-Rhône-Alpes')
                .withPostalCode('73000')
                .withLocality('Chambery');

            expect(address2.format()).toBe((
                `1 rue de paris\n` +
                `73000 Chambery`
            ));
        });

        it('should be compatible with previous implementation (`formatAddress`)', () => {
            // - Adresse complète.
            const result1 = new Address('FR', '5 rue des tests', null, '05000', null, 'Gap').format(true);
            expect(result1).toBe('5 rue des tests\n05000 Gap\nFrance');

            // - Rue uniquement.
            const result2 = new Address('FR', '5 rue des tests').format();
            expect(result2).toBe('5 rue des tests');

            // - Code postal uniquement.
            const result3 = new Address('FR', null, null, '05000').format();
            expect(result3).toBe('05000');

            // - Ville uniquement.
            const result4 = new Address('FR', null, null, null, null, 'Gap').format();
            expect(result4).toBe('Gap');

            // - Code postal + Ville.
            const result5 = new Address('FR', null, null, '05000', null, 'Gap').format();
            expect(result5).toBe('05000 Gap');

            // - Rue + Ville.
            const result6 = new Address('FR', '5 rue des tests', null, null, null, 'Gap').format();
            expect(result6).toBe('5 rue des tests\nGap');

            // - Pays uniquement.
            const result7 = new Address('FR').format(true);
            expect(result7).toBe('France');

            // - Rue + Pays.
            const result8 = new Address('FR', '5 rue des tests').format(true);
            expect(result8).toBe('5 rue des tests\nFrance');
        });

        it('returns null when nothing given', () => {
            expect(new Address('FR').format()).toBeNull();
        });
    });
});
