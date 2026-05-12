import pick from 'lodash/pick';
import Decimal from 'decimal.js';
import config from '@/globals/config';
import TaxRegime from '@/utils/invoicing/tax-regime';
import areTaxesEqualsFactory from './areLineTaxesEquals';

import type { Tax as LiveTax } from '@/stores/api/taxes';
import type VatExemptionCode from '@/utils/invoicing/vat-exemption-code';
import type { Booking, BookingExtra } from '@/stores/api/bookings';
import type {
    LineTax,
    Buyer,
    BillingExtra,
    UnsyncedDataValue,
    RawExtraBillingData,
} from '../_types';

const getExtrasData = (allTaxes: LiveTax[], defaultTaxId: LiveTax['id'] | null) => (
    (booking: Booking<true> | undefined, pendingData: RawExtraBillingData[], buyer: Buyer | null): BillingExtra[] => {
        const { isVatExempted } = config.organization;
        const areTaxesEquals = areTaxesEqualsFactory();

        return (
            pendingData.map((data: RawExtraBillingData): BillingExtra => {
                const savedExtra: BookingExtra | undefined = booking?.extras.find(
                    (_extra: BookingExtra) => _extra.uuid === data.uuid,
                );

                // - Un extra persisté nécessite un booking pour pouvoir
                //   appeler l'API de re-synchronisation.
                const canResync = savedExtra === undefined || booking !== undefined;

                // - Régimes de taxe par défaut pour la ligne d'extra.
                const sellerCountry = config.organization.country;
                const defaultTaxRegime = buyer === null ? TaxRegime.STANDARD : (
                    sellerCountry.getLineDefaultTaxRegime(buyer, data.is_service)
                );

                const totalWithoutDiscount = data.unit_price === null
                    ? new Decimal(0)
                    : data.unit_price
                        .times(data.quantity)
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

                        return data.tax_regime ?? base;
                    })();

                    const isUnsynced = base !== current;
                    return {
                        base,
                        current,
                        isUnsynced,
                        isResyncable: isUnsynced && canResync,
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

                        if (data.tax_regime !== undefined) {
                            return data.tax_exemption_code ?? null;
                        }

                        return taxRegime.base === taxRegime.current
                            ? base
                            : null;
                    })();

                    const isUnsynced = base !== current;
                    return {
                        base,
                        current,
                        isUnsynced,
                        isResyncable: isUnsynced && canResync,
                    };
                })();

                const taxId: UnsyncedDataValue<LiveTax['id'] | null> = (() => {
                    const defaultBase: LiveTax['id'] | null = (() => {
                        if (isVatExempted) {
                            return null;
                        }

                        // - Seul le régime "standard" autorise la présence d'une taxe.
                        if (taxRegime.base !== TaxRegime.STANDARD) {
                            return null;
                        }

                        const baseTax: LiveTax | undefined = defaultTaxId !== null
                            ? allTaxes.find(({ id: _id }: LiveTax) => _id === defaultTaxId)
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

                        if (data.tax_id !== undefined) {
                            return data.tax_id;
                        }

                        return taxRegime.base === taxRegime.current
                            ? defaultBase
                            : null;
                    })();

                    // - Si le régime courant est le même que le régime par défaut
                    //   et qu'une taxe a été choisie, elle devient la nouvelle
                    //   valeur par défaut (plutôt que la taxe par défaut globale).
                    const base: LiveTax['id'] | null = (
                        taxRegime.base === taxRegime.current && current !== null
                            ? current
                            : defaultBase
                    );

                    const isUnsynced = base !== current;
                    return {
                        base,
                        current,
                        isUnsynced,
                        isResyncable: isUnsynced && canResync,
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

                        // - Si l'extra a été persisté et que la taxe n'a pas changée, on utilise les
                        //   données persisté dans l'extra, sinon on utilise les données live.
                        if (
                            savedExtra !== undefined &&
                            data.tax_id === savedExtra.tax_id &&
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

                    const isUnsynced = !areTaxesEquals(base, current);
                    return {
                        base,
                        current,
                        isUnsynced,
                        isResyncable: isUnsynced && canResync,
                    };
                })();

                const isUnsynced = (
                    taxRegime.isUnsynced ||
                    taxExemptionCode.isUnsynced ||
                    taxId.isUnsynced ||
                    taxes.isUnsynced
                );

                const isResyncable = (
                    taxRegime.isResyncable ||
                    taxExemptionCode.isResyncable ||
                    taxId.isResyncable ||
                    taxes.isResyncable
                );

                return {
                    ...data,
                    is_unsynced: isUnsynced,
                    is_resyncable: isResyncable,
                    is_persisted: savedExtra !== undefined,
                    total_without_discount: totalWithoutDiscount,
                    discount_rate: discountRate,
                    total_discount: totalDiscount,
                    total_without_taxes: totalWithoutTaxes,
                    tax_regime: taxRegime,
                    tax_exemption_code: taxExemptionCode,
                    tax_id: taxId,
                    taxes,
                };
            })
        );
    }
);

export default getExtrasData;
