import TaxRegime from '@/utils/invoicing/tax-regime';
import VatExemptionCodeEu, { getEuGlobalCodes, getEuLineCodes } from './eu';

/**
 * Motifs d'exemption de TVA spécifiquement belges.
 *
 * Attention, pour avoir la liste complète des exemptions applicables en
 * Belgique il faut aussi utiliser les exemptions au niveau européen.
 */
enum VatExemptionCodeBeOnly {
    /**
     * Régime particulier de franchise des petites entreprises – TVA non applicable
     */
    CUSTOM_BE_FRANCHISE = 'CUSTOM-BE-FRANCHISE',

    /**
     * Co-contractor – AR CTVA n° 1, article 20
     *
     * For domestic reverse charge only in Belgium
     */
    CUSTOM_BE_AE = 'CUSTOM-BE-AE',
}

const VatExemptionCodeBe = Object.freeze({
    ...VatExemptionCodeEu,
    ...VatExemptionCodeBeOnly,
});

// eslint-disable-next-line @typescript-eslint/no-redeclare -- Volontaire, simule un enum unifié.
type VatExemptionCodeBe = (
    | VatExemptionCodeBeOnly
    | VatExemptionCodeEu
);

export const getBeGlobalCodes = (): VatExemptionCodeBe[] => [
    VatExemptionCodeBe.CUSTOM_BE_FRANCHISE,
    ...getEuGlobalCodes(),
];

export const getBeLineCodes = (
    regime: Exclude<TaxRegime, TaxRegime.STANDARD>,
): VatExemptionCodeBe[] => {
    switch (regime) {
        case TaxRegime.REVERSE_CHARGE: {
            return [
                VatExemptionCodeBe.CUSTOM_BE_AE,
                ...getEuLineCodes(regime),
            ];
        }
        default: {
            return getEuLineCodes(regime);
        }
    }
};

export default VatExemptionCodeBe;
