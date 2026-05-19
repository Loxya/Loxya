import TaxRegime from '@/utils/invoicing/tax-regime';
import LegalEntityType from '@/stores/api/@enums/legal-entity-type';
import { VatExemptionCodeFr } from '@/utils/invoicing/vat-exemption-code';
import InvoiceRoutingIdentifierScheme from '@/utils/invoicing/routing-identifier-scheme';

import type Country from '..';
import type { Buyer } from '@/utils/invoicing';
import type { CountryMetadata } from '../_types';
import type { StrictTaxRegime } from '@/utils/invoicing/tax-regime';

/** Les codes pays des DROM. */
const DROM_CODES: string[] = ['GP', 'MQ', 'GF', 'YT', 'RE'];

/**
 * Métadonnées pour la France.
 */
const metadata: CountryMetadata = Object.freeze({
    hasSimpleVatSystem: true,
    useElectronicInvoices: true,
    canInferDefaultInvoiceRoutingIdentifier: true,

    requireBuyerRegistrationId(buyerCountry?: Country | null): boolean {
        // - Si France => France => Requis.
        if (
            buyerCountry === null ||
            buyerCountry === undefined ||
            buyerCountry.code === 'FR'
        ) {
            return true;
        }

        // - Si c'est un DROM => requis, sinon non requis.
        return DROM_CODES.includes(buyerCountry.code);
    },

    requireBuyerAddress(isCompany: boolean): boolean {
        // - L'adresse est en principe toujours obligatoire mais
        //   les particuliers peuvent s'y opposer.
        return isCompany;
    },

    inferDefaultInvoiceRoutingIdentifier(registrationId: string): string | null {
        const pattern = /^\d{3}\s?\d{3}\s?\d{3}(?:\s?\d{5})?$/;
        if (!pattern.test(registrationId)) {
            return null;
        }

        const identifier = registrationId.replaceAll(' ', '').substring(0, 9);
        return `${InvoiceRoutingIdentifierScheme.FR_CTC}:${identifier}`;
    },

    isSameVatArea(otherCountry: Country): boolean {
        // - Si France => France => Oui.
        if (otherCountry.code === 'FR') {
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

            // - Si l'entreprise cliente est aussi en France...
            if (buyerCountry.code === 'FR') {
                // - Si c'est un service en B2B domestique, on permet l'auto-liquidation.
                if (buyerHasVatNumber && isService) {
                    return [
                        TaxRegime.STANDARD,
                        {
                            regime: TaxRegime.REVERSE_CHARGE,
                            exemptionCode: VatExemptionCodeFr.VATEX_FR_AE,
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

            // - Si le pays de l'entreprise cliente est dans les DROM...
            //   See https://www.impots.gouv.fr/professionnel/questions/quels-sont-les-differents-taux-de-tva-applicables-dans-les-dom
            const isDrom = DROM_CODES.includes(buyerCountry.code);
            if (isDrom) {
                // - Si c'est la Guyane et Mayotte (qui sont exemptés de T.V.A. pour le moment) ou un produit...
                //   => Code d'exemption spécifique pour les DROM en priorité.
                const isExemptedDrom = ['GF', 'YT'].includes(buyerCountry.code);
                if (isExemptedDrom || !isService) {
                    return [
                        {
                            regime: TaxRegime.EXEMPTED,
                            exemptionCode: VatExemptionCodeFr.CUSTOM_FR_DROM,
                        },
                        TaxRegime.STANDARD,
                        TaxRegime.EXEMPTED,
                    ];
                }

                // - Sinon si c'est un service dans un DROM non exempté, T.V.A standard en priorité.
                //   Note: C'est censé être la T.V.A. du pays du preneur, l'utilisateur devra
                //         gérer ceci via ses taux de T.V.A. enregistrés.
                return [TaxRegime.STANDARD, TaxRegime.EXEMPTED];
            }

            // - Sinon, si c'est un autre pays...
            return [
                (
                    !isService
                        ? TaxRegime.EXPORT
                        : {
                            regime: TaxRegime.EXPORT,
                            exemptionCode: VatExemptionCodeFr.CUSTOM_FR_G_SERVICE,
                        }
                ),
                TaxRegime.EXEMPTED,
                TaxRegime.STANDARD,
            ];
        }

        //
        // - B2C.
        //

        // - Si le client est aussi en France ou dans l'aire économique européenne...
        //   (Note: pour l'EEA il y a une limite de 10000€ pour certains services qui
        //   implique de facturer avec la T.V.A. du pays du preneur, le end-user devra
        //   gérer ce cas via ses taxes et en surchargeant les lignes)
        if (buyerCountry.code === 'FR' || buyerCountry.isEuVatMember) {
            return [TaxRegime.STANDARD, TaxRegime.EXEMPTED];
        }

        // - Si le pays du client est dans les DROM...
        //   See https://www.impots.gouv.fr/professionnel/questions/quels-sont-les-differents-taux-de-tva-applicables-dans-les-dom
        const isDrom = DROM_CODES.includes(buyerCountry.code);
        if (isDrom) {
            // - Si c'est un produit, code d'exemption spécifique pour les DROM en priorité.
            if (!isService) {
                return [
                    {
                        regime: TaxRegime.EXEMPTED,
                        exemptionCode: VatExemptionCodeFr.CUSTOM_FR_DROM,
                    },
                    TaxRegime.STANDARD,
                    TaxRegime.EXEMPTED,
                ];
            }

            // - Sinon si c'est un service dans un DROM non exempté, T.V.A. standard en priorité.
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
