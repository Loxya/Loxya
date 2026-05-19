import Country from './country';
import invariant from 'invariant';
import config from '@/globals/config';
import parsePhoneNumber from 'libphonenumber-js/max';

import type { CountryCode, PhoneNumber } from 'libphonenumber-js';

type Options = {
    /**
     * Pays par défaut utilisé lorsque le numéro de téléphone
     * passé n'est pas au format international.
     */
    defaultCountry?: Country | string,

    /**
     * Dois-t'on accepter les numéros invalides ?
     *
     * Si oui, le numéro sera renvoyé tel quel par chaque méthode.
     */
    loose?: boolean,
};

class Phone {
    private readonly _rawNumber: PhoneNumber | string;

    constructor(number: string | Phone, options?: Options);
    constructor(number: string | Phone, defaultCountry?: Country | string);
    constructor(number: string | Phone, options?: Options | Country | string) {
        number = number instanceof Phone ? number.number : number;

        if (options instanceof Country || typeof options === 'string') {
            options = { defaultCountry: options };
        }
        const { loose = false, defaultCountry: rawDefaultCountry } = options ?? {};
        const defaultCountry = new Country(rawDefaultCountry ?? config.mainCountry);

        let rawPhone = parsePhoneNumber(number, {
            defaultCountry: defaultCountry.code as CountryCode,
            extract: false,
        });
        if (!rawPhone?.isValid()) {
            rawPhone = undefined;
        }

        invariant(loose || rawPhone !== undefined, 'Invalid phone number.');
        this._rawNumber = rawPhone !== undefined ? rawPhone : number;
    }

    public get number(): string {
        return typeof this._rawNumber !== 'string'
            ? this._rawNumber.format('E.164')
            : this._rawNumber;
    }

    public get country(): Country | null {
        if (typeof this._rawNumber === 'string') {
            return null;
        }

        const hasUsableCountry = (
            this._rawNumber.country !== undefined &&
            !['AC', 'TA', 'XK', 'XA', 'XO', 'XC'].includes(this._rawNumber.country)
        );
        if (!hasUsableCountry) {
            return null;
        }

        try {
            return new Country(this._rawNumber.country!);
        } catch {
            return null;
        }
    }

    public formatInternational(): string {
        if (typeof this._rawNumber === 'string') {
            return this._rawNumber;
        }
        return this._rawNumber.formatInternational();
    }

    public formatNational(): string {
        if (typeof this._rawNumber === 'string') {
            return this._rawNumber;
        }
        return this._rawNumber.formatNational();
    }

    public toURI(): string {
        return typeof this._rawNumber !== 'string'
            ? this._rawNumber.getURI()
            : `tel:${this._rawNumber}`;
    }

    public toReadable(): string {
        if (typeof this._rawNumber === 'string') {
            return this._rawNumber;
        }

        const numberCountry = this.country;
        const mainCountry = config.mainCountry ?? null;
        if (numberCountry !== null && mainCountry !== null) {
            return !numberCountry.isSame(mainCountry)
                ? this.formatInternational()
                : this.formatNational();
        }

        const formattedNumber = this.formatNational();
        return (this._rawNumber.countryCallingCode ?? '') !== ''
            ? `(+${this._rawNumber.countryCallingCode}) ${formattedNumber}`
            : formattedNumber;
    }

    public toString(): string {
        return this.number;
    }

    /**
     * Retourne l'instance sous forme serializable dans un objet JSON.
     *
     * Note: Ce format pourra être ré-utilisé en entrée.
     *
     * @returns L'instance sous forme sérialisée.
     */
    public toJSON(): string {
        return this.toString();
    }
}

export default Phone;
