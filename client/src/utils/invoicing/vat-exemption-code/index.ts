import VatExemptionCodeEu from './eu';
import VatExemptionCodeFr from './fr';
import VatExemptionCodeBe from './be';

const VatExemptionCode = Object.freeze({
    ...VatExemptionCodeFr,
    ...VatExemptionCodeBe,
});

// eslint-disable-next-line @typescript-eslint/no-redeclare -- Volontaire, simule un enum unifié.
type VatExemptionCode = (
    | VatExemptionCodeFr
    | VatExemptionCodeBe
);

const vatExemptionCodeValues = new Set<string>(Object.values(VatExemptionCode));

const isValidCode = (value: unknown): value is VatExemptionCode => (
    typeof value === 'string' && vatExemptionCodeValues.has(value)
);

export const tryFrom = (value: string): VatExemptionCode | null => (
    isValidCode(value) ? value : null
);

export const from = (value: string): VatExemptionCode => {
    const code = tryFrom(value);
    if (code === null) {
        throw new Error(`Unknown VAT Exemption value \`${value}\`.`);
    }
    return code;
};

export {
    VatExemptionCodeEu,
    VatExemptionCodeFr,
    VatExemptionCodeBe,
};

export { getFrGlobalCodes, getFrLineCodes } from './fr';
export { getBeGlobalCodes, getBeLineCodes } from './be';

export default VatExemptionCode;
