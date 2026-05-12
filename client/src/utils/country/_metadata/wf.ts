import frMetadata from './fr';
import TaxRegime from '@/utils/invoicing/tax-regime';

import type Country from '..';
import type { CountryMetadata } from '../_types';
import type { StrictTaxRegime } from '@/utils/invoicing/tax-regime';

/**
 * Métadonnées pour Wallis-et-Futuna.
 */
const metadata: CountryMetadata = Object.freeze({
    ...frMetadata,

    useElectronicInvoices: false,

    isSameVatArea(otherCountry: Country): boolean {
        return otherCountry.code === 'WF';
    },

    getLineAvailableTaxRegimes(): StrictTaxRegime[] {
        // - Hors du champ d'application de la T.V.A. française.
        return [TaxRegime.EXEMPTED];
    },
});

export default metadata;
