import { TaxRegime } from '@/utils/invoicing/tax-regime';
import LegalEntityType from '@/stores/api/@enums/legal-entity-type';

import type Country from '..';
import type { Buyer } from '@/utils/invoicing';
import type { CountryMetadata } from '../_types';
import type { StrictTaxRegime } from '@/utils/invoicing/tax-regime';

/**
 * Métadonnées pour la Suisse.
 */
const metadata: CountryMetadata = Object.freeze({
    hasSimpleVatSystem: true,
    useElectronicInvoices: false,
    canInferDefaultInvoiceRoutingIdentifier: false,

    requireBuyerRegistrationId(): boolean {
        return false;
    },

    requireBuyerAddress(): boolean {
        return false;
    },

    inferDefaultInvoiceRoutingIdentifier(): string | null {
        return null;
    },

    isSameVatArea(otherCountry: Country): boolean {
        // - Si Suisse => Suisse ou Liechtenstein => Oui.
        return ['CH', 'LI'].includes(otherCountry.code);
    },

    getLineAvailableTaxRegimes(buyer: Buyer, isService: boolean): StrictTaxRegime[] {
        const buyerCountry = buyer.data.country;
        const buyerIsCompany = buyer.type === LegalEntityType.COMPANY;

        //
        // - B2B
        //

        if (buyerIsCompany) {
            // - Si l'entreprise cliente est aussi en Suisse ou au Liechtenstein...
            if (['CH', 'LI'].includes(buyerCountry.code)) {
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

        // - Si le client est aussi en Suisse ou au Liechtenstein ou que c'est un service...
        if (['CH', 'LI'].includes(buyerCountry.code) || isService) {
            return [TaxRegime.STANDARD, TaxRegime.EXEMPTED];
        }

        // - Sinon, si c'est un autre pays et que c'est un produit, export en priorité.
        return [
            TaxRegime.EXPORT,
            TaxRegime.STANDARD,
            TaxRegime.EXEMPTED,
        ];
    },
});

export default metadata;
