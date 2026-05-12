/* eslint-disable @typescript-eslint/naming-convention */

import type { Raw } from 'vue';
import type Decimal from 'decimal.js';
import type Currency from '@/utils/currency';
import type { STANDALONE_ENTITY } from './_constants';
import type { SetOptional, Simplify } from 'type-fest';
import type TaxRegime from '@/utils/invoicing/tax-regime';
import type VatExemptionCode from '@/utils/invoicing/vat-exemption-code';
import type { Tax as LiveTax } from '@/stores/api/taxes';
import type { Beneficiary } from '@/stores/api/beneficiaries';
import type {
    Booking,
    BillingData,
    ExtraBillingData,
    MaterialBillingData,
} from '@/stores/api/bookings';

export type { Buyer } from '@/utils/invoicing';

//
// - Types utilitaires
//

/** Contexte de facturation en mode autonome (sans booking). */
export type StandaloneContext = {
    /** Identifiant de contexte autonome. */
    entity: typeof STANDALONE_ENTITY,

    /** L'acheteur concerné par la facturation. */
    buyer: Beneficiary | null,

    /** La devise à utiliser pour les prix. */
    currency: Currency,

    /** Les lignes de la facturation. */
    lines: ExtraBillingData[],

    /** Le taux de l'éventuelle remise globale. */
    global_discount_rate: Raw<Decimal>,
};

/** Contexte de facturation de l'éditeur. */
export type BillingContext = Booking<true> | StandaloneContext;

export type UnsyncedDataValue<Base, Current = Base> = {
    base: Base,
    current: Current,
    isUnsynced: boolean,
    isResyncable: boolean,
};

export type PriceDetails = {
    amount: Decimal,
    currency: Currency,
};

//
// - Données de facturation brutes
//

export type RawMaterialBillingData = Simplify<(
    SetOptional<MaterialBillingData, (
        | 'tax_regime'
        | 'tax_exemption_code'
        | 'tax_id'
    )>
)>;

export type RawExtraBillingData = Simplify<(
    SetOptional<ExtraBillingData, (
        | 'tax_regime'
        | 'tax_exemption_code'
        | 'tax_id'
    )>
)>;

export type RawBillingData = Simplify<(
    & Omit<BillingData, 'materials' | 'extras'>
    & {
        materials: RawMaterialBillingData[],
        extras: RawExtraBillingData[],
    }
)>;

//
// - Remise globale
//

export type DiscountTaxStandard = {
    type: TaxRegime.STANDARD,
    name?: string,
    value: Decimal,
};

export type DiscountTaxSpecial = {
    type: Exclude<TaxRegime, TaxRegime.STANDARD>,
    reason: string[],
};

export type DiscountTax = (
    | DiscountTaxStandard
    | DiscountTaxSpecial
);

export type DiscountData = {
    base: Decimal,
    value: Decimal,
    total: Decimal,
    tax: DiscountTax,
};

//
// - Taxes
//

export type LineTax = {
    name?: string,
    value: Decimal,
};

export type LineTaxDetail = (
    | {
        regime: TaxRegime.STANDARD,
        taxId: LiveTax['id'] | null,
        taxes: LineTax[] | null,
    }
    | { regime: TaxRegime.ZERO_RATED }
    | {
        regime: Exclude<TaxRegime, TaxRegime.STANDARD | TaxRegime.ZERO_RATED>,
        exemptionCode: VatExemptionCode | null,
    }
);

export type TotalTaxStandard = {
    type: TaxRegime.STANDARD,
    name?: string,
    value: Decimal,
    base: Decimal,
    total: Decimal,
};

export type TotalTaxSpecial = {
    type: Exclude<TaxRegime, TaxRegime.STANDARD>,
    reason: string[],
    base: Decimal,
};

export type TotalTax = (
    | TotalTaxStandard
    | TotalTaxSpecial
);

//
// - Lignes de facturation
//

export type BillingMaterial = Simplify<(
    & Omit<RawMaterialBillingData, (
        | 'unit_price'
        | 'tax_regime'
        | 'tax_exemption_code'
        | 'tax_id'
        | 'taxes'
    )>
    & {
        name: UnsyncedDataValue<string>,
        reference: UnsyncedDataValue<string>,
        quantity: number,
        will_be_hidden: boolean,
        is_discountable: boolean,
        is_unsynced: boolean,
        is_resyncable: boolean,
        unit_price: UnsyncedDataValue<PriceDetails, Decimal>,
        unit_replacement_price: UnsyncedDataValue<Decimal | null>,
        degressive_rate: UnsyncedDataValue<Decimal>,
        unit_price_period: Decimal,
        total_without_discount: Decimal,
        total_discount: Decimal,
        total_without_taxes: Decimal,
        tax_regime: UnsyncedDataValue<TaxRegime | null>,
        tax_exemption_code: UnsyncedDataValue<VatExemptionCode | null>,
        tax_id: UnsyncedDataValue<LiveTax['id'] | null>,
        taxes: UnsyncedDataValue<LineTax[] | null>,
    }
)>;

export type BillingExtra = Simplify<(
    & Omit<RawExtraBillingData, (
        | 'tax_regime'
        | 'tax_exemption_code'
        | 'tax_id'
        | 'taxes'
    )>
    & {
        is_unsynced: boolean,
        is_resyncable: boolean,
        is_persisted: boolean,
        total_without_discount: Decimal,
        total_discount: Decimal,
        total_without_taxes: Decimal,
        tax_regime: UnsyncedDataValue<TaxRegime | null>,
        tax_exemption_code: UnsyncedDataValue<VatExemptionCode | null>,
        tax_id: UnsyncedDataValue<LiveTax['id'] | null>,
        taxes: UnsyncedDataValue<LineTax[] | null>,
    }
)>;
