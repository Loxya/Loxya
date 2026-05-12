import Country from '@/utils/country';
import { getAddressingData } from './_utils';
import { AddressField } from './_constants';

/** Une adresse. */
class Address {
    /** La première ligne d'adresse (e.g. rue et numéro). */
    private readonly _addressLine1: string | null;

    /** La seconde ligne d'adresse (e.g. complément d'adresse). */
    private readonly _addressLine2: string | null;

    /** La zone administrative (état, province, ...). */
    private readonly _administrativeArea: string | null;

    /** La localité (ville, district, ...). */
    private readonly _locality: string | null;

    /** Le code postal. */
    private readonly _postalCode: string | null;

    /** Le pays. */
    private readonly _country: Country;

    /**
     * Permet de créer une adresse.
     *
     * @param country - Le pays (sous forme d'instance ou de code ISO).
     * @param addressLine1 - La première ligne d'adresse (e.g. rue et numéro).
     * @param addressLine2 - La seconde ligne d'adresse (e.g. complément d'adresse).
     * @param postalCode - Le code postal.
     * @param administrativeArea - La zone administrative (état, province, ...).
     * @param locality - La localité (ville, district, ...).
     */
    constructor(
        country: Country | string,
        addressLine1?: string | null,
        addressLine2?: string | null,
        postalCode?: string | null,
        administrativeArea?: string | null,
        locality?: string | null,
    ) {
        this._addressLine1 = addressLine1 ?? null;
        this._addressLine2 = addressLine2 ?? null;
        this._postalCode = postalCode ?? null;
        this._administrativeArea = administrativeArea ?? null;
        this._locality = locality ?? null;
        this._country = new Country(country);
    }

    public get country(): Country {
        return this._country;
    }

    public withCountryCode(country: Country | string): Address {
        return new Address(
            country,
            this.addressLine1,
            this.addressLine2,
            this.postalCode,
            this.administrativeArea,
            this.locality,
        );
    }

    public get administrativeArea(): string | null {
        return this._administrativeArea;
    }

    public withAdministrativeArea(administrativeArea: string | null): Address {
        return new Address(
            this._country,
            this.addressLine1,
            this.addressLine2,
            this.postalCode,
            administrativeArea,
            this.locality,
        );
    }

    public get locality(): string | null {
        return this._locality;
    }

    public withLocality(locality: string | null): Address {
        return new Address(
            this._country,
            this.addressLine1,
            this.addressLine2,
            this.postalCode,
            this.administrativeArea,
            locality,
        );
    }

    public get postalCode(): string | null {
        return this._postalCode;
    }

    public withPostalCode(postalCode: string | null): Address {
        return new Address(
            this._country,
            this.addressLine1,
            this.addressLine2,
            postalCode,
            this.administrativeArea,
            this.locality,
        );
    }

    public get addressLine1(): string | null {
        return this._addressLine1;
    }

    public withAddressLine1(addressLine1: string | null): Address {
        return new Address(
            this._country,
            addressLine1,
            this.addressLine2,
            this.postalCode,
            this.administrativeArea,
            this.locality,
        );
    }

    public get addressLine2(): string | null {
        return this._addressLine2;
    }

    public withAddressLine2(addressLine2: string | null): Address {
        return new Address(
            this._country,
            this.addressLine1,
            addressLine2,
            this.postalCode,
            this.administrativeArea,
            this.locality,
        );
    }

    /**
     * Formate l'adresse.
     *
     * @param withCountry - Le pays doit-il être affiché ?
     *
     * @returns L'adresse sous forme de chaîne lisible par un humain.
     *          (ou `null` si elle ne contient aucune données)
     */
    public format(withCountry: boolean = false): string | null {
        const { format, usedFields } = getAddressingData(this.country.code);

        const values: Record<AddressField, string | null> = {
            [AddressField.ADDRESS_LINE1]: this.addressLine1,
            [AddressField.ADDRESS_LINE2]: this.addressLine2,
            [AddressField.POSTAL_CODE]: this.postalCode,
            [AddressField.ADMINISTRATIVE_AREA]: this.administrativeArea,
            [AddressField.LOCALITY]: this.locality,
        };

        const replacements = usedFields.map((field: AddressField) => {
            if (!(field in values)) {
                throw new Error(`Unsupported address field \`${field as any}\`.`);
            }
            return [`%${field}`, (values[field] ?? '').trim()];
        });

        const output = replacements.reduce(
            (_output: string, [key, value]) => (
                _output.replaceAll(key, value)
            ),
            format,
        );

        // - On supprime la ponctuation orpheline, les espaces
        //   indésirables et les lignes vides.
        const lines = output.split('\n')
            .map((line: string) => (
                line
                    .replaceAll(/^[\s,-]+|[\s,-]+$/g, '')
                    .replaceAll(/\s{2,}/g, ' ')
                    .replaceAll(/\s+,/g, ',')
                    .replaceAll(/,{2,}/g, ',')
                    .replaceAll(/-{2,}/g, '-')
            ))
            .filter(Boolean);

        if (withCountry) {
            lines.push(this.country.name);
        }

        return lines.length > 0 ? lines.join('\n') : null;
    }
}

export default Address;
