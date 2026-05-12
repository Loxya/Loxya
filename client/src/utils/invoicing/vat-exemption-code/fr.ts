import TaxRegime from '@/utils/invoicing/tax-regime';
import VatExemptionCodeEu, { getEuGlobalCodes, getEuLineCodes } from './eu';

/**
 * Motifs d'exemption de TVA spécifiquement françaises.
 *
 * Attention, pour avoir la liste complète des exemptions applicables en
 * France il faut aussi utiliser les exemptions au niveau européen.
 *
 * Ces codes respectent la norme Peppol 3.0.
 * - https://docs.peppol.eu/poacc/billing/3.0/codelist/vatex/
 * - https://ec.europa.eu/digital-building-blocks/sites/spaces/DIGITAL/pages/467108957/Code+lists
 */
enum VatExemptionCodeFrOnly {
    /**
     * France domestic VAT franchise in base (art. 293 B of CGI)
     *
     * For domestic invoicing in France
     */
    VATEX_FR_FRANCHISE = 'VATEX-FR-FRANCHISE',

    /**
     * France domestic Credit Notes without VAT, due to supplier forfeit of VAT for discount
     *
     * For domestic Credit Notes only in France
     */
    VATEX_FR_CNWVAT = 'VATEX-FR-CNWVAT',

    /**
     * Exempt based on 1 of article 261 of the Code Général des Impôts
     *
     * Operations subject to other taxes
     */
    VATEX_FR_CGI261_1 = 'VATEX-FR-CGI261-1',

    /**
     * Exempt based on 2 of article 261 of the Code Général des Impôts
     *
     * Agricultural and fisheries activities
     */
    VATEX_FR_CGI261_2 = 'VATEX-FR-CGI261-2',

    /**
     * Exempt based on 3 of article 261 of the Code Général des Impôts
     *
     * Sales of used goods
     */
    VATEX_FR_CGI261_3 = 'VATEX-FR-CGI261-3',

    /**
     * Exempt based on 4 of article 261 of the Code Général des Impôts
     *
     * Activities of the professions and various activities
     */
    VATEX_FR_CGI261_4 = 'VATEX-FR-CGI261-4',

    /**
     * Exempt based on 5 of article 261 of the Code Général des Impôts
     *
     * Real-estate operations
     */
    VATEX_FR_CGI261_5 = 'VATEX-FR-CGI261-5',

    /**
     * Exempt based on 7 of article 261 of the Code Général des Impôts
     *
     * Non-profit organizations operations
     */
    VATEX_FR_CGI261_7 = 'VATEX-FR-CGI261-7',

    /**
     * Exempt based on 8 of article 261 of the Code Général des Impôts
     *
     * Goods/services linked to an EU-area disaster
     */
    VATEX_FR_CGI261_8 = 'VATEX-FR-CGI261-8',

    /**
     * Exempt based on article 261 A of the Code Général des Impôts
     *
     * Free-of-charge provision of property by legal entities
     */
    VATEX_FR_CGI261A = 'VATEX-FR-CGI261A',

    /**
     * Exempt based on article 261 B of the Code Général des Impôts
     *
     * Member services by groups carrying out exempt activities
     */
    VATEX_FR_CGI261B = 'VATEX-FR-CGI261B',

    /**
     * Exempt based on 1° of article 261 C of the Code Général des Impôts
     *
     * Banking and financial transactions
     */
    VATEX_FR_CGI261C_1 = 'VATEX-FR-CGI261C-1',

    /**
     * Exempt based on 2° of article 261 C of the Code Général des Impôts
     *
     * Insurance/reinsurance transactions and related services
     */
    VATEX_FR_CGI261C_2 = 'VATEX-FR-CGI261C-2',

    /**
     * Exempt based on 3° of article 261 C of the Code Général des Impôts
     *
     * Sale of fiscal and postage stamps at their official value
     */
    VATEX_FR_CGI261C_3 = 'VATEX-FR-CGI261C-3',

    /**
     * Exempt based on 1° of article 261 D of the Code Général des Impôts
     *
     * Rentals of land and buildings for agricultural use
     */
    VATEX_FR_CGI261D_1 = 'VATEX-FR-CGI261D-1',

    /**
     * Exempt based on 1°bis of article 261 D of the Code Général des Impôts
     *
     * Leases of immovable property conferring a right in rem
     */
    VATEX_FR_CGI261D_1BIS = 'VATEX-FR-CGI261D-1BIS',

    /**
     * Exempt based on 2° of article 261 D of the Code Général des Impôts
     *
     * Leases of undeveloped land or bare premises
     */
    VATEX_FR_CGI261D_2 = 'VATEX-FR-CGI261D-2',

    /**
     * Exempt based on 3° of article 261 D of the Code Général des Impôts
     *
     * Rights/leases relating to real-estate portfolio management
     */
    VATEX_FR_CGI261D_3 = 'VATEX-FR-CGI261D-3',

    /**
     * Exempt based on 4° of article 261 D of the Code Général des Impôts
     *
     * Rentals of furnished accommodation for residential use
     */
    VATEX_FR_CGI261D_4 = 'VATEX-FR-CGI261D-4',

    /**
     * Exempt based on 1° of article 261 E of the Code Général des Impôts
     *
     * Organisation of games of chance subject to levies
     */
    VATEX_FR_CGI261E_1 = 'VATEX-FR-CGI261E-1',

    /**
     * Exempt based on 2° of article 261 E of the Code Général des Impôts
     *
     * Proceeds from lotteries, horse/sports betting and online circle games
     */
    VATEX_FR_CGI261E_2 = 'VATEX-FR-CGI261E-2',

    /**
     * Exempt based on article 277 A of the Code Général des Impôts
     *
     * VAT suspensive scheme
     */
    VATEX_FR_CGI277A = 'VATEX-FR-CGI277A',

    /**
     * Exempt based on article 275 of the Code Général des Impôts
     *
     * VAT-free purchases of goods intended for export or exempt supplies
     */
    VATEX_FR_CGI275 = 'VATEX-FR-CGI275',

    /**
     * Exempt based on article 298 sexdecies A of the Code Général des Impôts
     *
     * Investment gold
     */
    VATEX_FR_298SEXDECIESA = 'VATEX-FR-298SEXDECIESA',

    /**
     * Exempt based on article 295 of the Code Général des Impôts
     *
     * French territories under Arts. 349 and 355(1) TFEU
     */
    VATEX_FR_CGI295 = 'VATEX-FR-CGI295',

    /**
     * Exempt based on 2 of article 283 of the Code Général des Impôts
     *
     * For domestic reverse charge only in France
     */
    VATEX_FR_AE = 'VATEX-FR-AE',

    //
    // - Codes customs.
    //

    /**
     * Exempt based on 1 of article 259 of the Code Général des Impôts
     *
     * For outside-EU service export in France
     */
    CUSTOM_FR_G_SERVICE = 'CUSTOM-FR-G-SERVICE',

    /**
     * Exempt based on article 294 of the Code Général des Impôts
     *
     * For delivery to the French overseas territories
     */
    CUSTOM_FR_DROM = 'CUSTOM-FR-DROM',
}

const VatExemptionCodeFr = Object.freeze({
    ...VatExemptionCodeEu,
    ...VatExemptionCodeFrOnly,
});

// eslint-disable-next-line @typescript-eslint/no-redeclare -- Volontaire, simule un enum unifié.
type VatExemptionCodeFr = (
   | VatExemptionCodeFrOnly
   | VatExemptionCodeEu
);

export const getFrGlobalCodes = (): VatExemptionCodeFr[] => [
    VatExemptionCodeFr.VATEX_FR_FRANCHISE,
    VatExemptionCodeFr.VATEX_FR_CGI261_1,
    // VatExemptionCodeFr.VATEX_FR_CGI261_2,
    VatExemptionCodeFr.VATEX_FR_CGI261_3,
    VatExemptionCodeFr.VATEX_FR_CGI261_4,
    VatExemptionCodeFr.VATEX_FR_CGI261_7,
    VatExemptionCodeFr.VATEX_FR_CGI261A,
    VatExemptionCodeFr.VATEX_FR_CGI261B,
    // VatExemptionCodeFr.VATEX_FR_CGI261C_1,
    VatExemptionCodeFr.VATEX_FR_CGI261D_1,
    VatExemptionCodeFr.VATEX_FR_CGI261D_1BIS,
    VatExemptionCodeFr.VATEX_FR_CGI261D_2,
    VatExemptionCodeFr.VATEX_FR_CGI261D_3,
    VatExemptionCodeFr.VATEX_FR_CGI261D_4,
    // VatExemptionCodeFr.VATEX_FR_CGI261E_1,
    // VatExemptionCodeFr.VATEX_FR_CGI261E_2,
    VatExemptionCodeFr.VATEX_FR_CGI277A,
    // VatExemptionCodeFr.VATEX_FR_298SEXDECIESA,
    VatExemptionCodeFr.VATEX_FR_CGI295,
    ...getEuGlobalCodes(),
];

export const getFrLineCodes = (
    regime: Exclude<TaxRegime, TaxRegime.STANDARD>,
): VatExemptionCodeFr[] => {
    switch (regime) {
        case TaxRegime.EXEMPTED: {
            return [
                // VatExemptionCodeFr.VATEX_FR_CGI261_8,
                // VatExemptionCodeFr.VATEX_FR_CGI261C_1,
                // VatExemptionCodeFr.VATEX_FR_CGI261C_2,
                // VatExemptionCodeFr.VATEX_FR_CGI261C_3,
                // VatExemptionCodeFr.VATEX_FR_CGI261E_1,
                // VatExemptionCodeFr.VATEX_FR_CGI261E_2,
                VatExemptionCodeFr.CUSTOM_FR_DROM,
                ...getEuLineCodes(regime),
            ];
        }
        case TaxRegime.REVERSE_CHARGE: {
            return [
                VatExemptionCodeFr.VATEX_FR_AE,
                ...getEuLineCodes(regime),
            ];
        }
        case TaxRegime.EXPORT: {
            return [
                VatExemptionCodeFr.CUSTOM_FR_G_SERVICE,
                ...getEuLineCodes(regime),
            ];
        }
        default: {
            return getEuLineCodes(regime);
        }
    }
};

export default VatExemptionCodeFr;
