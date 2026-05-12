import pick from 'lodash/pick';
import Decimal from 'decimal.js';
import config from '@/globals/config';
import TaxRegime from '@/utils/invoicing/tax-regime';
import areTaxesEqualsFactory from './areLineTaxesEquals';

import type { Tax as LiveTax } from '@/stores/api/taxes';
import type VatExemptionCode from '@/utils/invoicing/vat-exemption-code';
import type {
    Booking,
    BookingMaterial,
} from '@/stores/api/bookings';
import type {
    LineTax,
    Buyer,
    PriceDetails,
    BillingMaterial,
    UnsyncedDataValue,
    RawMaterialBillingData,
} from '../_types';

const getMaterialsDataFactory = (allTaxes: LiveTax[]) => (
    (booking: Booking<true>, pendingData: RawMaterialBillingData[], buyer: Buyer | null): BillingMaterial[] => {
        const baseCurrency = config.currency;
        const { isVatExempted } = config.organization;
        const hasUnsyncedCurrency = !booking.currency.isSame(baseCurrency);
        const areTaxesEquals = areTaxesEqualsFactory();

        // - Régimes de taxe par défaut pour le matériel.
        const sellerCountry = config.organization.country;
        const defaultTaxRegime = buyer === null ? TaxRegime.STANDARD : (
            sellerCountry.getLineDefaultTaxRegime(buyer, true)
        );

        return booking.materials.map(
            (bookingMaterial: BookingMaterial<true>): BillingMaterial => {
                const { material } = bookingMaterial;

                const data = pendingData.find(
                    (_datum: RawMaterialBillingData) => (
                        _datum.id === material.id
                    ),
                );

                const name: UnsyncedDataValue<string> = (() => {
                    const base = material.name;
                    const current = bookingMaterial.name;
                    const isUnsynced = !material.is_deleted && base !== current;

                    return {
                        base,
                        current,
                        isUnsynced,
                        isResyncable: isUnsynced,
                    };
                })();

                const reference: UnsyncedDataValue<string> = (() => {
                    const base = material.reference;
                    const current = bookingMaterial.reference;
                    const isUnsynced = !material.is_deleted && base !== current;

                    return {
                        base,
                        current,
                        isUnsynced,
                        isResyncable: isUnsynced,
                    };
                })();

                const unitPrice: UnsyncedDataValue<PriceDetails, Decimal> = (() => {
                    const basePrice = material.rental_price ?? new Decimal(0);
                    const currentPrice = data?.unit_price ?? null;

                    const isUnsynced = material.is_deleted || currentPrice === null ? false : (
                        hasUnsyncedCurrency || !currentPrice.equals(basePrice)
                    );

                    const isResyncable = isUnsynced && !hasUnsyncedCurrency;

                    const base: PriceDetails = { amount: basePrice, currency: baseCurrency };
                    const current: Decimal = (() => {
                        if (currentPrice !== null) {
                            return currentPrice;
                        }
                        return !hasUnsyncedCurrency ? base.amount : new Decimal(0);
                    })();

                    return {
                        base,
                        current,
                        isUnsynced,
                        isResyncable,
                    };
                })();

                const unitReplacementPrice: UnsyncedDataValue<Decimal | null> = (() => {
                    const base = material.replacement_price;
                    const current = bookingMaterial.unit_replacement_price;

                    // - Si la valeur courante et la base sont nulles, alors ce n'est pas unsynced.
                    //   Si la valeur courante est non nulle, alors c'est unsynced quand la base est
                    //   nulle ou qu'elle est différente de la valeur courante.
                    const isUnsynced = !material.is_deleted && (
                        current !== null
                            ? base === null || !base.equals(current)
                            : base !== null
                    );

                    return {
                        base,
                        current,
                        isUnsynced,
                        isResyncable: isUnsynced,
                    };
                })();

                const degressiveRate: UnsyncedDataValue<Decimal> = (() => {
                    const base = material.degressive_rate ?? new Decimal(booking.operation_period.asDays());
                    const current = bookingMaterial.degressive_rate;
                    const isUnsynced = !material.is_deleted && !current.equals(base);

                    return {
                        base,
                        current,
                        isUnsynced,
                        isResyncable: isUnsynced,
                    };
                })();

                const unitPricePeriod = unitPrice.current
                    .times(degressiveRate.current)
                    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

                // eslint-disable-next-line @typescript-eslint/prefer-destructuring
                const quantity = bookingMaterial.quantity;

                const totalWithoutDiscount = unitPricePeriod
                    .times(bookingMaterial.quantity)
                    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

                const discountRate: Decimal = data !== undefined
                    ? data.discount_rate
                    : new Decimal(0);

                const totalDiscount = totalWithoutDiscount
                    .times(discountRate.dividedBy(100).toDecimalPlaces(6))
                    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

                const totalWithoutTaxes = totalWithoutDiscount
                    .minus(totalDiscount)
                    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

                const taxRegime: UnsyncedDataValue<TaxRegime | null> = (() => {
                    const base: TaxRegime | null = (() => {
                        if (isVatExempted) {
                            return null;
                        }

                        if (buyer === null) {
                            return TaxRegime.STANDARD;
                        }

                        return typeof defaultTaxRegime !== 'string'
                            ? defaultTaxRegime.regime
                            : defaultTaxRegime;
                    })();

                    const current: TaxRegime | null = (() => {
                        if (isVatExempted) {
                            return null;
                        }

                        if (buyer === null) {
                            return TaxRegime.STANDARD;
                        }

                        return data?.tax_regime ?? base;
                    })();

                    const isUnsynced = !material.is_deleted && base !== current;
                    return {
                        base,
                        current,
                        isUnsynced,
                        isResyncable: isUnsynced,
                    };
                })();

                const taxExemptionCode: UnsyncedDataValue<VatExemptionCode | null> = (() => {
                    const base: VatExemptionCode | null = (() => {
                        if (isVatExempted || buyer === null) {
                            return null;
                        }

                        return typeof defaultTaxRegime !== 'string'
                            ? defaultTaxRegime.exemptionCode
                            : null;
                    })();

                    const current: VatExemptionCode | null = (() => {
                        if (isVatExempted || buyer === null) {
                            return null;
                        }

                        if (taxRegime.current === TaxRegime.STANDARD) {
                            return null;
                        }

                        if (data?.tax_regime !== undefined) {
                            return data.tax_exemption_code ?? null;
                        }

                        return taxRegime.base === taxRegime.current
                            ? base
                            : null;
                    })();

                    const isUnsynced = !material.is_deleted && base !== current;
                    return {
                        base,
                        current,
                        isUnsynced,
                        isResyncable: isUnsynced,
                    };
                })();

                const taxId: UnsyncedDataValue<LiveTax['id'] | null> = (() => {
                    const base: LiveTax['id'] | null = (() => {
                        if (isVatExempted) {
                            return null;
                        }

                        // - Seul le régime "standard" autorise la présence d'une taxe.
                        if (taxRegime.base !== TaxRegime.STANDARD) {
                            return null;
                        }

                        const baseTax: LiveTax | undefined = ![null, undefined].includes(material.tax_id as any)
                            ? allTaxes.find(({ id: _id }: LiveTax) => _id === material.tax_id!)
                            : undefined;

                        return baseTax?.id ?? null;
                    })();

                    const current: LiveTax['id'] | null = (() => {
                        if (isVatExempted) {
                            return null;
                        }

                        // - Seul le régime "standard" autorise la présence d'une taxe.
                        if (taxRegime.current !== TaxRegime.STANDARD) {
                            return null;
                        }

                        if (data?.tax_id !== undefined) {
                            return data.tax_id;
                        }

                        return taxRegime.base === taxRegime.current
                            ? base
                            : null;
                    })();

                    const isUnsynced = !material.is_deleted && base !== current;
                    return {
                        base,
                        current,
                        isUnsynced,
                        isResyncable: isUnsynced,
                    };
                })();

                const taxes: UnsyncedDataValue<LineTax[] | null> = (() => {
                    const base: LineTax[] | null = (() => {
                        if (isVatExempted) {
                            return null;
                        }

                        // - Seul le régime "standard" autorise la présence d'une taxe.
                        if (taxRegime.base !== TaxRegime.STANDARD) {
                            return null;
                        }

                        const baseTax: LiveTax | undefined = taxId.base !== null
                            ? allTaxes.find(({ id: _id }: LiveTax) => _id === taxId.base)
                            : undefined;

                        if (baseTax === undefined) {
                            return [];
                        }

                        return !baseTax.is_group
                            ? [pick(baseTax, ['name', 'value'])]
                            : baseTax.components;
                    })();

                    const current: LineTax[] | null = (() => {
                        if (isVatExempted) {
                            return null;
                        }

                        // - Seul le régime "standard" autorise la présence d'une taxe.
                        if (taxRegime.current !== TaxRegime.STANDARD) {
                            return null;
                        }

                        if (
                            data !== undefined &&
                            data.tax_id === bookingMaterial.tax_id &&
                            data.taxes !== undefined
                        ) {
                            return data.taxes ?? [];
                        }

                        const liveTax: LiveTax | undefined = taxId.current !== null
                            ? allTaxes.find(({ id: _id }: LiveTax) => _id === taxId.current)
                            : undefined;

                        if (liveTax === undefined) {
                            return [];
                        }

                        return !liveTax.is_group
                            ? [pick(liveTax, ['name', 'value'])]
                            : liveTax.components;
                    })();

                    const isUnsynced = !material.is_deleted && !areTaxesEquals(base, current);
                    return {
                        base,
                        current,
                        isUnsynced,
                        isResyncable: isUnsynced,
                    };
                })();

                const isDiscountable = material.is_discountable ?? true;

                const isUnsynced = (
                    name.isUnsynced ||
                    reference.isUnsynced ||
                    unitPrice.isUnsynced ||
                    unitReplacementPrice.isUnsynced ||
                    degressiveRate.isUnsynced ||
                    taxRegime.isUnsynced ||
                    taxExemptionCode.isUnsynced ||
                    taxId.isUnsynced ||
                    taxes.isUnsynced
                );

                const isResyncable = (
                    name.isResyncable ||
                    reference.isResyncable ||
                    unitPrice.isResyncable ||
                    unitReplacementPrice.isResyncable ||
                    degressiveRate.isResyncable ||
                    taxRegime.isResyncable ||
                    taxExemptionCode.isResyncable ||
                    taxId.isResyncable ||
                    taxes.isResyncable
                );

                // - Est-ce que le matériel va être caché sur la facture ?
                const willBeHidden = (
                    unitPrice.current.isZero() &&
                    totalWithoutTaxes.isZero() &&
                    !!(material.is_hidden_on_bill ?? false)
                );

                return {
                    id: material.id,
                    name,
                    reference,
                    quantity,
                    will_be_hidden: willBeHidden,
                    is_discountable: isDiscountable,
                    is_unsynced: isUnsynced,
                    is_resyncable: isResyncable,
                    unit_price: unitPrice,
                    degressive_rate: degressiveRate,
                    unit_price_period: unitPricePeriod,
                    unit_replacement_price: unitReplacementPrice,
                    total_without_discount: totalWithoutDiscount,
                    discount_rate: discountRate,
                    total_discount: totalDiscount,
                    total_without_taxes: totalWithoutTaxes,
                    tax_regime: taxRegime,
                    tax_exemption_code: taxExemptionCode,
                    tax_id: taxId,
                    taxes,
                };
            },
        );
    }
);

export default getMaterialsDataFactory;
