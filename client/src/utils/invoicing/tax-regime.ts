import type VatExemptionCode from './vat-exemption-code';

/**
 * Régime de taxe.
 *
 * @see https://unece.org/fileadmin/DAM/trade/untdid/d16b/tred/tred5305.htm
 */
export enum TaxRegime {
    /** Régime standard / normal, taxes appliquées normalement. */
    STANDARD = 'S',

    /** Taux zéro. */
    ZERO_RATED = 'Z',

    /** Auto-liquidation, les taxes sont dues par le preneur. */
    REVERSE_CHARGE = 'AE',

    /** Autoliquidation pour cause de livraison intracommunautaire. */
    REVERSE_CHARGE_SUPPLY = 'K',

    /** Export, non sujet à taxation. */
    EXPORT = 'G',

    /** Exempté de taxe. */
    EXEMPTED = 'E',

    /** Hors du périmètre d'application des taxes. */
    OUT_OF_SCOPE = 'O',
}

/** Un régime de taxe complet. */
export type StrictTaxRegime = (
    | TaxRegime
    | {
        regime: Exclude<TaxRegime, (
            | TaxRegime.STANDARD
            | TaxRegime.ZERO_RATED
        )>,
        exemptionCode: VatExemptionCode | null,
    }
);

export default TaxRegime;
