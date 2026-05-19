import allMetadata from './_metadata';
import { z } from '@/utils/validation';
import stringCompare from '@/utils/stringCompare';
import { TaxRegime } from '../invoicing/tax-regime';
import LegalEntityType from '@/stores/api/@enums/legal-entity-type';
import { AVAILABLE_LANGUAGES } from '@/globals/lang/@constants';
import { getAddressingData, AddressField } from '@/utils/address';
import { getFrLineCodes } from '../invoicing/vat-exemption-code/fr';
import { getBeLineCodes } from '../invoicing/vat-exemption-code/be';
import { getEuLineCodes } from '../invoicing/vat-exemption-code/eu';

import type { Buyer } from '../invoicing';
import type { StrictTaxRegime } from '../invoicing/tax-regime';
import type VatExemptionCode from '../invoicing/vat-exemption-code';
import type {
    CountryMetadata,
    AddressFieldDefinition,
} from './_types';
import type {
    LocalityType,
    AddressingData,
    PostalCodeType,
    AdministrativeAreaType,
} from '@/utils/address';

class Country {
    /** Le code du pays. */
    private readonly _code: string;

    /** Locale pour les traductions, configurée globalement. */
    private static _locale: string = 'en';

    private get metadata(): CountryMetadata | null {
        return allMetadata.get(this._code)
            ?? allMetadata.get(this.inheritedCode)
            ?? null;
    }

    /** Données d'adresse mises en cache par pays. */
    /* eslint-disable @stylistic/lines-between-class-members */
    private static _addressingDataCache: Map<string, AddressingData> = new Map();
    private static _addressFieldsCaches: Map<string, AddressFieldDefinition[]> = new Map();
    /* eslint-enable @stylistic/lines-between-class-members */

    private get rawAddressingData(): AddressingData {
        if (!Country._addressingDataCache.has(this._code)) {
            Country._addressingDataCache.set(this._code, getAddressingData(this._code));
        }
        return Country._addressingDataCache.get(this._code)!;
    }

    constructor(code: string | Country) {
        this._code = !(code instanceof Country)
            ? code.toUpperCase()
            : code.code;
    }

    /**
     * Retourne le code du pays.
     *
     * @returns Le code du pays.
     */
    public get code(): string {
        return this._code;
    }

    /**
     * Permet de récupérer le code du pays de rattachement du présent pays.
     *
     * @returns Le code du pays, au format ISO 3166-1 alpha-2 du pays.
     */
    public get inheritedCode(): string {
        switch (this._code) {
            case 'GP':
            case 'MQ':
            case 'GF':
            case 'YT':
            case 'RE':
            case 'BL':
            case 'MF':
            case 'PM':
            case 'WF':
            case 'TF': {
                return 'FR';
            }
            default: {
                return this._code;
            }
        }
    }

    /**
     * Retourne le nom du pays, localisé.
     *
     * @returns Le nom du pays, localisé.
     */
    public get name(): string {
        return this.getLocalizedName(Country._locale);
    }

    /**
     * Determine si le pays est un État membre de l'Union européenne au sens T.V.A.
     *
     * @returns `true` s'il fait partie de l'UE au sens T.V.A., `false` sinon.
     */
    public get isEuVatMember(): boolean {
        const euCountries = [
            'AT', // Autriche
            'BE', // Belgique
            'BG', // Bulgarie
            'CY', // Chypre
            'CZ', // République tchèque
            'DE', // Allemagne
            'DK', // Danemark
            'EE', // Estonie
            'ES', // Espagne
            'FI', // Finlande
            'FR', // France
            'GR', // Grèce
            'HR', // Croatie
            'HU', // Hongrie
            'IE', // Irlande
            'IT', // Italie
            'LT', // Lituanie
            'LU', // Luxembourg
            'LV', // Lettonie
            'MT', // Malte
            'NL', // Pays-Bas
            'PL', // Pologne
            'PT', // Portugal
            'RO', // Roumanie
            'SE', // Suède
            'SI', // Slovénie
            'SK', // Slovaquie

            // - Cas spéciaux
            'MC', // Monaco
        ];
        return euCountries.includes(this.code);
    }

    /**
     * Le pays a-t-il un système de T.V.A. simple ?
     *
     * Un système de T.V.A. simple implique qu'un seul taux de
     * T.V.A est appliqué à la fois (à l'inverse d'un système comme
     * celui en vigueur au Québec par exemple).
     *
     * @returns `true` si le pays a un système de T.V.A. simple, `false`
     *          sinon et `null` si on a pas l'information.
     */
    public get hasSimpleVatSystem(): boolean | null {
        return this.metadata?.hasSimpleVatSystem ?? (
            this.isEuVatMember ? true : null
        );
    }

    /**
     * Les factures dans ce pays doivent-elles être au format électronique quand c'est possible ?
     *
     * @returns `true` si le pays utilise des factures électroniques, `false` sinon.
     */
    public get useElectronicInvoices(): boolean {
        return this.metadata?.useElectronicInvoices ?? false;
    }

    /**
     * Indique si l'identifiant de routage e-facturation par défaut peut être
     * déduit automatiquement depuis un identifiant de société.
     *
     * @returns `true` si l'identifiant peut être déduit, `false` sinon.
     */
    public get canInferDefaultInvoiceRoutingIdentifier(): boolean {
        return this.metadata?.canInferDefaultInvoiceRoutingIdentifier ?? false;
    }

    /**
     * Retourne les champs d'adresse pour le pays.
     *
     * @param grouped - Indique si les champs doivent être groupés par lignes.
     *
     * @returns Un tableau avec le détails de chaque champ d'adresse pour le pays.
     */
    public getAddressFields(grouped: true): AddressFieldDefinition[][];
    public getAddressFields(grouped?: false): AddressFieldDefinition[];
    public getAddressFields(grouped: boolean = false): AddressFieldDefinition[][] | AddressFieldDefinition[] {
        if (!Country._addressFieldsCaches.has(this._code)) {
            const { usedFields, requiredFields } = this.rawAddressingData;
            const definitions = usedFields.map((field: AddressField) => {
                const required = requiredFields.includes(field);

                switch (field) {
                    case AddressField.POSTAL_CODE: {
                        return { field, required, type: this.getPostalCodeType() };
                    }
                    case AddressField.LOCALITY: {
                        return { field, required, type: this.getLocalityType() };
                    }
                    case AddressField.ADMINISTRATIVE_AREA: {
                        return { field, required, type: this.getAdministrativeAreaType() };
                    }
                    default: {
                        return { field, required };
                    }
                }
            });
            Country._addressFieldsCaches.set(this._code, definitions);
        }
        const definitions = Country._addressFieldsCaches.get(this._code)!;
        if (!grouped) {
            return definitions;
        }

        // - Pour le mode groupé, on ne se base pas sur les lignes de l'adresse
        //   mais sur trois groupes: Ligne d'adresse 1, Ligne d'adresse 2 et
        //   le reste des champs liés à la localité sur une ligne.
        const groups: Partial<Record<AddressField, AddressFieldDefinition[]>> = {
            [AddressField.ADDRESS_LINE1]: [],
            [AddressField.ADDRESS_LINE2]: [],
            [AddressField.LOCALITY]: [],
        };
        const groupOrder: Set<AddressField> = new Set();

        definitions.forEach((definition: AddressFieldDefinition) => {
            const group = (() => {
                switch (definition.field) {
                    case AddressField.ADDRESS_LINE1: {
                        return AddressField.ADDRESS_LINE1;
                    }
                    case AddressField.ADDRESS_LINE2: {
                        return AddressField.ADDRESS_LINE2;
                    }
                    default: {
                        return AddressField.LOCALITY;
                    }
                }
            })();
            if (!groupOrder.has(group)) {
                groupOrder.add(group);
            }
            groups[group]!.push(definition);
        });

        return Array.from(groupOrder.values()).map(
            (group: AddressField) => groups[group]!,
        );
    }

    /**
     * Retourne la liste des champs d'adresse utilisé par le pays.
     *
     * @returns Un tableau avec les champs d'adresse pour le pays.
     */
    public getUsedAddressField(): AddressField[] {
        return this.getAddressFields(false)
            .map(({ field }) => field);
    }

    /**
     * Est-ce que le champ d'adresse est requis pour le pays ?
     *
     * @param field - Le champ concerné.
     *
     * @returns `true` si le champ est obligatoire, `false` sinon.
     */
    public isAddressFieldMandatory(field: AddressField): boolean {
        const definitions = this.getAddressFields(false);
        return definitions.some((definition: AddressFieldDefinition) => (
            definition.field === field && definition.required
        ));
    }

    /**
     * Retourne le type de zone administrative (e.g. État, Province, etc.).
     *
     * @returns Le type de zone administrative.
     */
    public getAdministrativeAreaType(): AdministrativeAreaType {
        return this.rawAddressingData.administrativeAreaType;
    }

    /**
     * Retourne le type de localité (e.g. Ville, District, etc.).
     *
     * @returns Le type de localité.
     */
    public getLocalityType(): LocalityType {
        return this.rawAddressingData.localityType;
    }

    /**
     * Retourne le type de code postal utilisé dans le pays (e.g. ZIP Code, Code postal, etc.).
     *
     * @returns Le type de code postal.
     */
    public getPostalCodeType(): PostalCodeType {
        return this.rawAddressingData.postalCodeType;
    }

    /**
     * Retourne le nom du pays, localisé.
     *
     * @param locale - La locale à utiliser.
     *
     * @returns Le nom du pays, localisé.
     */
    public getLocalizedName(locale: string): string {
        if (typeof Intl !== 'undefined' && typeof Intl.DisplayNames === 'function') {
            try {
                const translator = new Intl.DisplayNames([locale], { type: 'region' });
                return translator.of(this._code) ?? this._code.toUpperCase();
            } catch {
                // - On ignore, le code du pays sera retourné.
            }
        }
        return this._code.toUpperCase();
    }

    /**
     * Le numéro d'enregistrement (SIRET, BCE, ...) est-il
     * requis pour un acheteur "société" dans le présent pays ?
     *
     * @param buyerCountry - Pays de l'acheteur.
     *                       Si non spécifié, le pays sera réputé être le pays courant.
     *
     * @returns `true` si le numéro d'enregistrement est requis, `false` sinon.
     */
    public requireBuyerRegistrationId(buyerCountry?: Country | string | null): boolean {
        buyerCountry = typeof buyerCountry === 'string'
            ? new Country(buyerCountry)
            : buyerCountry;

        return this.metadata?.requireBuyerRegistrationId(buyerCountry) ?? false;
    }

    /**
     * L'adresse est-elle requise pour un acheteur dans le pays ?
     *
     * @param isCompany - Est-ce que l'acheteur est une société ?
     *
     * @returns `true` si l'adresse est requise, `false` sinon.
     */
    public requireBuyerAddress(isCompany: boolean): boolean {
        return this.metadata?.requireBuyerAddress(isCompany) ?? false;
    }

    /**
     * Tente de déduire l'identifiant de routage e-facturation
     * par défaut via un identifiant de société.
     *
     * @param registrationId - Un identifiant de société, principal ou non.
     *
     * @returns L'identifiant de routage déduit, ou `null` s'il n'a pas pu être déduit.
     */
    public inferDefaultInvoiceRoutingIdentifier(registrationId: string): string | null {
        return this.metadata?.inferDefaultInvoiceRoutingIdentifier(registrationId) ?? null;
    }

    /**
     * Indique si deux pays appartiennent à la même zone de T.V.A.
     *
     * @param otherCountry - L'autre instance à comparer à celle-ci.
     *
     * @returns `true` si les deux pays sont membres d'un même zone T.V.A., `false` sinon.
     */
    public isSameVatArea(otherCountry: Country): boolean {
        const { metadata } = this;
        if (metadata !== null) {
            return metadata.isSameVatArea(otherCountry);
        }

        // - Si ce sont les même pays, ils sont dans la même zone T.V.A.
        if (this.isSame(otherCountry)) {
            return true;
        }

        // - Sinon, si ce sont des pays de la zone économique européenne.
        return this.isEuVatMember && otherCountry.isEuVatMember;
    }

    /**
     * Retourne les régimes de taxe applicables pour une ligne de devis ou facture.
     *
     * Les régimes sont retournés dans l'ordre de priorité, le premier étant le plus susceptible d'être utilisé.
     *
     * @param buyer - L'acheteur.
     * @param isService - `true` si c'est une ligne de service, `false` si c'est un bien.
     *
     * @returns La liste des régimes de taxes applicables.
     */
    public getLineAvailableTaxRegimes(buyer: Buyer, isService: boolean): StrictTaxRegime[] {
        const { metadata } = this;
        if (metadata !== null) {
            return metadata.getLineAvailableTaxRegimes(buyer, isService);
        }

        const buyerCountry = buyer.data.country;
        const buyerIsCompany = buyer.type === LegalEntityType.COMPANY;

        //
        // - B2B
        //

        if (buyerIsCompany) {
            const buyerHasVatNumber = buyer.data.vat_number !== null;

            // - Si l'entreprise cliente est dans le même pays...
            if (this.isSame(buyerCountry)) {
                return [TaxRegime.STANDARD, TaxRegime.EXEMPTED];
            }

            // - Si l'entreprise cliente est dans la même zone T.V.A...
            if (this.isSameVatArea(buyerCountry)) {
                // - Si l'entreprise client a un numéro de T.V.A. valide,
                //   => On ajoute les règles d'auto-liquidation (bien / service).
                if (buyerHasVatNumber) {
                    return [
                        (
                            isService
                                ? TaxRegime.REVERSE_CHARGE
                                : TaxRegime.REVERSE_CHARGE_SUPPLY
                        ),
                        TaxRegime.STANDARD,
                        TaxRegime.EXEMPTED,
                    ];
                }

                // - Sinon, si pas de numéro de T.V.A., pas d'auto-liquidation possible.
                return [TaxRegime.STANDARD, TaxRegime.EXEMPTED];
            }

            // - Sinon, si c'est un autre pays...
            return [
                TaxRegime.EXPORT,
                TaxRegime.EXEMPTED,
                TaxRegime.STANDARD,
            ];
        }

        //
        // - B2C.
        //

        // - Si le client est dans le même pays, dans la même zone T.V.A ou que c'est un service...
        if (this.isSame(buyerCountry) || this.isSameVatArea(buyerCountry) || isService) {
            return [TaxRegime.STANDARD, TaxRegime.EXEMPTED];
        }

        // - Sinon, si c'est un autre pays et que c'est un produit, export en priorité.
        return [
            TaxRegime.EXPORT,
            TaxRegime.STANDARD,
            TaxRegime.EXEMPTED,
        ];
    }

    /**
     * Retourne le régime de taxe par défaut pour une ligne de devis ou facture.
     *
     * @param buyer - L'acheteur.
     * @param isService - `true` si c'est une ligne de service, `false` si c'est un bien.
     *
     * @returns Le régime par défaut pour la ligne.
     */
    public getLineDefaultTaxRegime(buyer: Buyer, isService: boolean): StrictTaxRegime {
        const availableRegimes = this.getLineAvailableTaxRegimes(buyer, isService);
        return [...availableRegimes].shift()!;
    }

    /**
     * Retourne les codes d'exemption de T.V.A. disponibles
     * pour une ligne, en fonction du régime de taxe.
     *
     * @param regime - Le régime de taxe (hors régime standard).
     *
     * @returns La liste des codes d'exemption disponibles.
     */
    public getLineAvailableTaxExemptionCodes(regime: Exclude<TaxRegime, TaxRegime.STANDARD>): VatExemptionCode[] {
        switch (this.inheritedCode) {
            case 'FR': {
                return getFrLineCodes(regime);
            }
            case 'BE': {
                return getBeLineCodes(regime);
            }
            default: {
                return this.isEuVatMember
                    ? getEuLineCodes(regime)
                    : [];
            }
        }
    }

    /**
     * Vérifie qu'une instance est équivalente à une autre.
     *
     * @param otherCountry - L'autre instance à comparer à celle-ci.
     * @param withInherited - Dois-t'on considérer les pays rattachés
     *                        comme correspondant au pays ?
     *
     * @returns `true` si les instances sont équivalentes, `false` sinon.
     */
    public isSame(otherCountry: Country, withInherited: boolean = false): boolean {
        return withInherited
            ? this.inheritedCode === otherCountry.inheritedCode
            : this.code === otherCountry.code;
    }

    /**
     * Retourne l'instance sous forme serializable dans un objet JSON.
     *
     * Note: Ce format pourra être ré-utilisé en entrée.
     *
     * @returns L'instance sous forme sérialisée.
     */
    public toJSON(): string {
        return this.code;
    }

    // ------------------------------------------------------
    // -
    // -    Méthodes utilitaires.
    // -
    // ------------------------------------------------------

    /**
     * Permet de définir la locale qui sera utilisée pour
     * les noms de pays notamment.
     *
     * @param locale - La locale à utiliser.
     */
    public static locale(locale: string): void {
        Country._locale = locale;
    }

    /**
     * Tente de récupérer un pays depuis une valeur mixte.
     *
     * @param rawValue - La valeur représentant potentiellement un pays.
     *
     * @returns Le pays résultant, ou `null` si la valeur ne correspond à rien.
     */
    public static tryFrom(rawValue: unknown): Country | null {
        if (rawValue instanceof Country) {
            return rawValue;
        }

        if (typeof rawValue !== 'string' || rawValue === '') {
            return null;
        }

        // - Recherche pas code.
        const normalizedCode = rawValue.toUpperCase();
        if (z.string().length(2).safeParse(normalizedCode).success) {
            return new Country(normalizedCode);
        }

        // - Recherche par nom
        const matchingCountry = Country.all().find((country: Country) => (
            Object.values(AVAILABLE_LANGUAGES).some((lang: string) => (
                stringCompare(rawValue, country.getLocalizedName(lang)) === 0
            ))
        ));
        return matchingCountry ?? null;
    }

    /**
     * Retourne la liste des pays.
     *
     * @returns La liste des pays.
     */
    public static all(): Country[] {
        const list = [
            //
            // - Francophones
            //

            'FR', 'BE', 'CH', 'CA', 'MC', 'LU',
            'GP', 'GF', 'MQ', 'YT', 'NC', 'PF',
            'RE', 'BL', 'MF', 'PM', 'TF', 'WF',

            //
            // - Non francophones
            //

            'AF', 'ZA', 'AL', 'DZ', 'DE', 'AD', 'AO', 'AI', 'AQ', 'AG', 'SA', 'AR',
            'AM', 'AW', 'AU', 'AT', 'AZ', 'BS', 'BH', 'BD', 'BB', 'BZ', 'BJ', 'BM',
            'BT', 'BY', 'MM', 'BO', 'BA', 'BW', 'BR', 'BN', 'BG', 'BF', 'BI', 'KH',
            'CM', 'CV', 'CL', 'CN', 'CY', 'VA', 'CO', 'KM', 'CG', 'KP', 'KR', 'CR',
            'CI', 'HR', 'CU', 'DK', 'DJ', 'DM', 'EG', 'AE', 'EC', 'ER', 'ES', 'EE',
            'SZ', 'PS', 'US', 'ET', 'FJ', 'FI', 'GA', 'GM', 'GE', 'GS', 'GH', 'GI',
            'GR', 'GD', 'GL', 'GU', 'GT', 'GG', 'GN', 'GQ', 'GW', 'GY', 'HT', 'HN',
            'HK', 'HU', 'BV', 'CX', 'IM', 'NF', 'AX', 'KY', 'CC', 'CK', 'FK', 'FO',
            'HM', 'MP', 'MH', 'SB', 'TC', 'IN', 'ID', 'IQ', 'IR', 'IE', 'IS', 'IL',
            'IT', 'JM', 'JP', 'JE', 'JO', 'KZ', 'KE', 'KG', 'KI', 'KW', 'LA', 'LS',
            'LV', 'LB', 'LR', 'LY', 'LI', 'LT', 'MO', 'MK', 'MG', 'MY', 'MW', 'MV',
            'ML', 'MT', 'MA', 'MU', 'MR', 'MX', 'FM', 'MD', 'MN', 'ME', 'MS', 'MZ',
            'NA', 'NR', 'NP', 'NI', 'NE', 'NG', 'NU', 'NO', 'NZ', 'OM', 'UG', 'UZ',
            'PK', 'PW', 'PA', 'PG', 'PY', 'NL', 'PE', 'PH', 'PN', 'PL', 'PR', 'PT',
            'QA', 'CF', 'CD', 'DO', 'CZ', 'RO', 'GB', 'RU', 'RW', 'EH', 'KN', 'SM',
            'VC', 'SH', 'LC', 'SV', 'WS', 'AS', 'ST', 'SN', 'RS', 'SC', 'SL', 'SG',
            'SK', 'SI', 'SO', 'SD', 'LK', 'SE', 'SR', 'SJ', 'SY', 'TJ', 'TW', 'TZ',
            'TD', 'IO', 'TH', 'TL', 'TG', 'TK', 'TO', 'TT', 'TN', 'TM', 'TR', 'TV',
            'UA', 'UY', 'VU', 'VE', 'VN', 'YE', 'ZM', 'ZW',
        ];
        return list.map((code: string) => new Country(code));
    }
}

export type { AddressFieldDefinition };

export default Country;
