import Country from '@/utils/country';
import {
    AddressField,
    LocalityType,
    PostalCodeType,
    AdministrativeAreaType,
} from '@/utils/address';

describe('Utils / Country', () => {
    describe('code', () => {
        it('return the country code', () => {
            expect(new Country('FR').code).toBe('FR');
            expect(new Country('US').code).toBe('US');
        });
    });

    describe('name', () => {
        it('return the localized country name', () => {
            expect(new Country('FR').name).toBe('France');
            expect(new Country('US').name).toBe('États-Unis');
        });
    });

    describe('getAddressFields()', () => {
        it('return the address fields data for the country', () => {
            expect(new Country('FR').getAddressFields()).toStrictEqual([
                { field: AddressField.ADDRESS_LINE1, required: true },
                { field: AddressField.ADDRESS_LINE2, required: false },
                {
                    field: AddressField.POSTAL_CODE,
                    required: true,
                    type: PostalCodeType.POSTAL,
                },
                {
                    field: AddressField.LOCALITY,
                    required: true,
                    type: LocalityType.CITY,
                },
            ]);
            expect(new Country('US').getAddressFields()).toStrictEqual([
                { field: AddressField.ADDRESS_LINE1, required: true },
                { field: AddressField.ADDRESS_LINE2, required: false },
                {
                    field: AddressField.LOCALITY,
                    required: true,
                    type: LocalityType.CITY,
                },
                {
                    field: AddressField.ADMINISTRATIVE_AREA,
                    required: true,
                    type: AdministrativeAreaType.STATE,
                },
                {
                    field: AddressField.POSTAL_CODE,
                    required: true,
                    type: PostalCodeType.ZIP,
                },
            ]);
        });

        it('return the grouped address fields data for the country', () => {
            expect(new Country('FR').getAddressFields(true)).toStrictEqual([
                [{ field: AddressField.ADDRESS_LINE1, required: true }],
                [{ field: AddressField.ADDRESS_LINE2, required: false }],
                [
                    {
                        field: AddressField.POSTAL_CODE,
                        required: true,
                        type: PostalCodeType.POSTAL,
                    },
                    {
                        field: AddressField.LOCALITY,
                        required: true,
                        type: LocalityType.CITY,
                    },
                ],
            ]);
            expect(new Country('US').getAddressFields(true)).toStrictEqual([
                [{ field: AddressField.ADDRESS_LINE1, required: true }],
                [{ field: AddressField.ADDRESS_LINE2, required: false }],
                [
                    {
                        field: AddressField.LOCALITY,
                        required: true,
                        type: LocalityType.CITY,
                    },
                    {
                        field: AddressField.ADMINISTRATIVE_AREA,
                        required: true,
                        type: AdministrativeAreaType.STATE,
                    },
                    {
                        field: AddressField.POSTAL_CODE,
                        required: true,
                        type: PostalCodeType.ZIP,
                    },
                ],
            ]);
        });
    });

    describe('getAdministrativeAreaType()', () => {
        it('return the administrative area type for the country', () => {
            expect(new Country('FR').getAdministrativeAreaType()).toBe(AdministrativeAreaType.REGION);
            expect(new Country('US').getAdministrativeAreaType()).toBe(AdministrativeAreaType.STATE);
        });
    });

    describe('getLocalityType()', () => {
        it('return the locality type for the country', () => {
            expect(new Country('FR').getLocalityType()).toBe(LocalityType.CITY);
            expect(new Country('HK').getLocalityType()).toBe(LocalityType.DISTRICT);
        });
    });

    describe('getPostalCodeType()', () => {
        it('return the postal code type for the country', () => {
            expect(new Country('FR').getPostalCodeType()).toBe(PostalCodeType.POSTAL);
            expect(new Country('US').getPostalCodeType()).toBe(PostalCodeType.ZIP);
        });
    });

    describe('from()', () => {
        it('should allow to create an instance from an ISO code', () => {
            const test1 = Country.tryFrom('FR');
            expect(test1).toBeInstanceOf(Country);
            expect(test1!.code).toBe('FR');

            const test2 = Country.tryFrom('US');
            expect(test2).toBeInstanceOf(Country);
            expect(test2!.code).toBe('US');
        });

        it('should allow to create an instance from a french name', () => {
            const test1 = Country.tryFrom('France');
            expect(test1).toBeInstanceOf(Country);
            expect(test1!.code).toBe('FR');

            const test2 = Country.tryFrom('Etats unis');
            expect(test2).toBeInstanceOf(Country);
            expect(test2!.code).toBe('US');

            const test3 = Country.tryFrom('États-unis');
            expect(test3).toBeInstanceOf(Country);
            expect(test3!.code).toBe('US');
        });

        it('should allow to create an instance from an english name', () => {
            const test1 = Country.tryFrom('Belgium');
            expect(test1).toBeInstanceOf(Country);
            expect(test1!.code).toBe('BE');

            const test2 = Country.tryFrom('United-states');
            expect(test2).toBeInstanceOf(Country);
            expect(test2!.code).toBe('US');
        });

        it('should return null if there is no matching country', () => {
            expect(Country.tryFrom('Allo ?')).toBeNull();
        });
    });
});
