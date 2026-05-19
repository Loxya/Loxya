import type Country from '.';
import type { Buyer } from '../invoicing';
import type { StrictTaxRegime } from '../invoicing/tax-regime';
import type {
    AddressField,
    LocalityType,
    PostalCodeType,
    AdministrativeAreaType,
} from '@/utils/address';

export type CountryMetadata = {
    /**
     * Le pays a-t-il un système de T.V.A. simple ?
     *
     * Un système de T.V.A. simple implique qu'un seul taux de
     * T.V.A est appliqué à la fois (à l'inverse d'un système comme
     * celui en vigueur au Québec par exemple).
     */
    hasSimpleVatSystem: boolean,

    /**
     * Les factures dans ce pays doivent-elles être au format
     * électronique quand c'est possible ?
     */
    useElectronicInvoices: boolean,

    /**
     * Indique si l'identifiant de routage e-facturation par défaut peut être
     * déduit automatiquement depuis un identifiant de société.
     */
    canInferDefaultInvoiceRoutingIdentifier: boolean,

    /**
     * Le numéro d'enregistrement (SIRET, BCE, ...) est-il
     * requis pour un acheteur "société" dans le présent pays ?
     *
     * @param buyerCountry - Pays de l'acheteur.
     *                       Si non spécifié, le pays sera réputé être le pays courant.
     *
     * @returns `true` si le numéro d'enregistrement est requis, `false` sinon.
     */
    requireBuyerRegistrationId(buyerCountry?: Country | null): boolean,

    /**
     * L'adresse est-elle requise pour un acheteur dans le pays ?
     *
     * @param isCompany - Est-ce que l'acheteur est une société ?
     *
     * @returns `true` si l'adresse est requise, `false` sinon.
     */
    requireBuyerAddress(isCompany: boolean): boolean,

    /**
     * Tente de déduire l'identifiant de routage e-facturation
     * par défaut via un identifiant de société.
     *
     * @param registrationId - Un identifiant de société, principal ou non.
     *
     * @returns L'identifiant de routage déduit, ou `null` s'il n'a pas pu être déduit.
     */
    inferDefaultInvoiceRoutingIdentifier(registrationId: string): string | null,

    /**
     * Indique si deux pays appartiennent à la même zone de T.V.A.
     *
     * @param otherCountry - L'autre instance à comparer à celle-ci.
     *
     * @returns `true` si les deux pays sont membres d'un même zone T.V.A., `false` sinon.
     */
    isSameVatArea(otherCountry: Country): boolean,

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
    getLineAvailableTaxRegimes(buyer: Buyer, isService: boolean): StrictTaxRegime[],
};

//
// - Adresses
//

type AddressFieldTypeMap = {
    [AddressField.ADMINISTRATIVE_AREA]: AdministrativeAreaType,
    [AddressField.LOCALITY]: LocalityType,
    [AddressField.POSTAL_CODE]: PostalCodeType,
};

export type AddressFieldDefinition = (
    | { field: Exclude<AddressField, keyof AddressFieldTypeMap>, required: boolean }
    | {
        [K in keyof AddressFieldTypeMap]: {
            field: K,
            required: boolean,
            type: AddressFieldTypeMap[K],
        }
    }[keyof AddressFieldTypeMap]
);
