import frMetadata from './fr';
import TaxRegime from '@/utils/invoicing/tax-regime';
import { VatExemptionCodeFr } from '@/utils/invoicing/vat-exemption-code';

import type Country from '..';
import type { CountryMetadata } from '../_types';
import type { StrictTaxRegime } from '@/utils/invoicing/tax-regime';

/**
 * Métadonnées pour la Guyane française.
 */
const metadata: CountryMetadata = Object.freeze({
    ...frMetadata,

    useElectronicInvoices: false,

    isSameVatArea(otherCountry: Country): boolean {
        return otherCountry.code === 'GF';
    },

    getLineAvailableTaxRegimes(): StrictTaxRegime[] {
        // - La T.V.A. n'étant pas applicable, toutes les opérations sont
        //   exemptées avec le code "DROM" (article 294 du CGI).
        return [
            {
                regime: TaxRegime.EXEMPTED,
                exemptionCode: VatExemptionCodeFr.CUSTOM_FR_DROM,
            },
            TaxRegime.EXEMPTED,
        ];
    },
});

export default metadata;
