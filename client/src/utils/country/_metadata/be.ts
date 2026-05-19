import { TaxRegime } from '@/utils/invoicing/tax-regime';
import LegalEntityType from '@/stores/api/@enums/legal-entity-type';
import { VatExemptionCodeBe } from '@/utils/invoicing/vat-exemption-code';
import InvoiceRoutingIdentifierScheme from '@/utils/invoicing/routing-identifier-scheme';

import type Country from '..';
import type { Buyer } from '@/utils/invoicing';
import type { CountryMetadata } from '../_types';
import type { StrictTaxRegime } from '@/utils/invoicing/tax-regime';

/**
 * Métadonnées pour la Belgique.
 */
const metadata: CountryMetadata = Object.freeze({
    hasSimpleVatSystem: true,
    useElectronicInvoices: true,
    canInferDefaultInvoiceRoutingIdentifier: true,

    requireBuyerRegistrationId(buyerCountry?: Country | null): boolean {
        // - Si Belgique => Belgique => Requis.
        return (
            buyerCountry === null ||
            buyerCountry === undefined ||
            buyerCountry.code === 'BE'
        );
    },

    requireBuyerAddress(): boolean {
        return true;
    },

    inferDefaultInvoiceRoutingIdentifier(registrationId: string): string | null {
        const pattern = /^(?:BE[.\s-]?)?(?<digits>[01]\d{3}[.\s-]?\d{3}[.\s-]?\d{3})$/i;
        const match = registrationId.match(pattern);
        if (match === null) {
            return null;
        }

        const identifier = match.groups!.digits.replaceAll(/[.\s-]/g, '');
        return `${InvoiceRoutingIdentifierScheme.BE_BCE}:${identifier}`;
    },

    isSameVatArea(otherCountry: Country): boolean {
        // - Si Belgique => Belgique => Oui.
        if (otherCountry.code === 'BE') {
            return true;
        }

        // - Sinon, si c'est un pays européen => "Oui".
        return otherCountry.isEuVatMember;
    },

    getLineAvailableTaxRegimes(buyer: Buyer, isService: boolean): StrictTaxRegime[] {
        const buyerCountry = buyer.data.country;
        const buyerIsCompany = buyer.type === LegalEntityType.COMPANY;

        //
        // - B2B
        //

        if (buyerIsCompany) {
            const buyerHasVatNumber = buyer.data.vat_number !== null;

            // - Si l'entreprise cliente est aussi en Belgique...
            if (buyerCountry.code === 'BE') {
                // - Si c'est un service en B2B domestique, on permet l'auto-liquidation.
                if (buyerHasVatNumber && isService) {
                    return [
                        TaxRegime.STANDARD,
                        {
                            regime: TaxRegime.REVERSE_CHARGE,
                            exemptionCode: VatExemptionCodeBe.CUSTOM_BE_AE,
                        },
                        TaxRegime.EXEMPTED,
                    ];
                }

                return [TaxRegime.STANDARD, TaxRegime.EXEMPTED];
            }

            // - Si l'entreprise cliente est dans l'aire économique européenne...
            if (buyerCountry.isEuVatMember) {
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

        // - Si le client est aussi en Belgique ou dans l'aire économique européenne...
        //   (Note: pour l'EEA il y a une limite de 10000€ pour certains services qui
        //   implique de facturer avec la T.V.A. du pays du preneur, le end-user devra
        //   gérer ce cas via ses taxes et en surchargeant les lignes)
        if (buyerCountry.code === 'BE' || buyerCountry.isEuVatMember) {
            return [TaxRegime.STANDARD, TaxRegime.EXEMPTED];
        }

        // - Sinon, si c'est un autre pays et que c'est un produit, export en priorité.
        if (!isService) {
            return [
                TaxRegime.EXPORT,
                TaxRegime.STANDARD,
                TaxRegime.EXEMPTED,
            ];
        }

        // - Sinon, T.V.A. du pays du vendeur.
        return [TaxRegime.STANDARD, TaxRegime.EXEMPTED];
    },
});

export default metadata;
