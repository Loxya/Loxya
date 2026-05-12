import './index.scss';
import Decimal from 'decimal.js';
import { defineComponent } from 'vue';
import config from '@/globals/config';
import Fragment from '@/components/Fragment';
import formatAmount from '@/utils/formatAmount';
import formatNumber from '@/utils/formatNumber';
import TaxRegime from '@/utils/invoicing/tax-regime';

import type { PropType } from 'vue';
import type { EventDetails, EventTax } from '@/stores/api/events';
import type {
    Booking as BookingCore,
    BookingTax as BookingCoreTax,
} from '@/stores/api/bookings';

type Booking = (
    | EventDetails
    | BookingCore
);

type BookingTax = (
    | EventTax
    | BookingCoreTax
);

type Props = {
    /** Le booking dont on veut afficher les totaux. */
    booking: Booking,

    /**
     * Dois-t'on afficher la valeur de remplacement totale ?
     *
     * @default false
     */
    withReplacementAmount?: boolean,

    /**
     * Dois-t'on afficher la durée de l'événement ?
     *
     * @default false
     */
    withDuration?: boolean,

    /**
     * Faut-il afficher le poids total du booking ?
     *
     * @default false
     */
    withWeight?: boolean,
};

/** Totaux d'un booking. */
const Totals = defineComponent({
    name: 'Totals',
    props: {
        booking: {
            type: Object as PropType<Required<Props>['booking']>,
            required: true,
        },
        withReplacementAmount: {
            type: Boolean as PropType<Required<Props>['withReplacementAmount']>,
            default: false,
        },
        withDuration: {
            type: Boolean as PropType<Required<Props>['withDuration']>,
            default: false,
        },
        withWeight: {
            type: Boolean as PropType<Required<Props>['withWeight']>,
            default: false,
        },
    },
    computed: {
        isSimpleVatSystem(): boolean {
            const { country } = config.organization;
            return !!country.hasSimpleVatSystem;
        },

        duration(): number {
            const { operation_period: operationPeriod } = this.booking;
            return operationPeriod.asDays();
        },

        totalTaxes(): Decimal {
            const { is_billable: isBillable } = this.booking;
            if (!isBillable) {
                return new Decimal(0);
            }

            const {
                global_tax_regime: globalTaxRegime,
                total_taxes: totalTaxes,
            } = this.booking;

            if (globalTaxRegime !== null) {
                return new Decimal(0);
            }

            return totalTaxes!.reduce(
                (total: Decimal, tax: BookingTax) => {
                    if (tax.type !== TaxRegime.STANDARD) {
                        return total;
                    }
                    return total.plus(tax.total);
                },
                new Decimal(0),
            );
        },

        showDetailedTotals(): boolean {
            const { is_billable: isBillable } = this.booking;
            if (!isBillable) {
                return false;
            }

            return (
                this.booking.global_tax_regime === null &&
                (this.booking.total_taxes ?? []).length > 0
            );
        },

        hasGlobalDiscount(): boolean {
            const { is_billable: isBillable } = this.booking;
            if (!isBillable) {
                return false;
            }

            const { global_discount_rate: globalDiscountRate } = this.booking;
            return !globalDiscountRate.isZero();
        },

        materialsCount(): number {
            return this.booking.materials_count;
        },
    },
    created() {
        this.$store.dispatch('categories/fetch');
    },
    render() {
        const {
            $t: __,
            booking,
            totalTaxes,
            materialsCount,
            duration,
            withWeight,
            withDuration,
            isSimpleVatSystem,
            showDetailedTotals,
            hasGlobalDiscount,
            withReplacementAmount,
        } = this;
        const {
            is_billable: isBillable,
            total_replacement: totalReplacement,
            total_weight: totalWeight,
            currency,
        } = booking;

        if (materialsCount === 0) {
            return null;
        }

        const renderInfos = (): JSX.Element => (
            <div class="Totals__infos">
                {withDuration && (
                    <div class="Totals__infos__item">
                        {__('duration-days', { duration }, duration)}
                    </div>
                )}
                <div class="Totals__infos__item">
                    {__('materials-count-total', { count: materialsCount }, materialsCount)}
                </div>
                {(withReplacementAmount && !totalReplacement.isZero()) && (
                    <div class="Totals__infos__item">
                        {__('total-replacement', {
                            total: formatAmount(totalReplacement, currency),
                        })}
                    </div>
                )}
                {(withWeight && !totalWeight.isZero()) && (
                    <div class="Totals__infos__item">
                        {__('total-weight', {
                            total: formatNumber(totalWeight),
                            unit: config.measurementUnits.materials.weight,
                        })}
                    </div>
                )}
            </div>
        );

        if (!isBillable) {
            return (
                <div class="Totals">
                    {renderInfos()}
                </div>
            );
        }

        const {
            global_discount_rate: globalDiscountRate,
            total_global_discount: totalGlobalDiscount,
            total_without_global_discount: totalWithoutGlobalDiscount,
            total_without_taxes: totalWithoutTaxes,
            total_taxes: taxes,
            total_with_taxes: totalWithTaxes,
        } = booking;

        return (
            <div class="Totals">
                {renderInfos()}
                <div class="Totals__billing">
                    {(hasGlobalDiscount || showDetailedTotals) && (
                        <div
                            class={[
                                'Totals__billing__line',
                                { 'Totals__billing__line--grand-total': !hasGlobalDiscount },
                            ]}
                        >
                            <div class="Totals__billing__line__title">
                                {__(hasGlobalDiscount ? 'subtotal' : 'total-without-taxes')}
                            </div>
                            <div class="Totals__billing__line__price">
                                {(
                                    hasGlobalDiscount
                                        ? formatAmount(totalWithoutGlobalDiscount, currency)
                                        : formatAmount(totalWithoutTaxes, currency)
                                )}
                            </div>
                        </div>
                    )}
                    {hasGlobalDiscount && (
                        <Fragment>
                            <div class="Totals__billing__line">
                                <div class="Totals__billing__line__title">
                                    {__('discount-rate', { rate: globalDiscountRate.toString() })}
                                </div>
                                <div class="Totals__billing__line__price">
                                    -{formatAmount(totalGlobalDiscount, currency)}
                                </div>
                            </div>
                            {showDetailedTotals && (
                                <div class="Totals__billing__line Totals__billing__line--grand-total">
                                    <div class="Totals__billing__line__title">
                                        {__('total-without-taxes')}
                                    </div>
                                    <div class="Totals__billing__line__price">
                                        {formatAmount(totalWithoutTaxes, currency)}
                                    </div>
                                </div>
                            )}
                        </Fragment>
                    )}
                    {(() => {
                        if (!showDetailedTotals) {
                            return null;
                        }

                        if (isSimpleVatSystem) {
                            return (
                                <div class="Totals__billing__line">
                                    <div class="Totals__billing__line__title">
                                        {__('total-vat')}
                                    </div>
                                    <div class="Totals__billing__line__price">
                                        {formatAmount(totalTaxes, currency)}
                                    </div>
                                </div>
                            );
                        }

                        return (taxes ?? []).map((tax: BookingTax, index: number) => {
                            if (tax.type !== TaxRegime.STANDARD || tax.total.isZero()) {
                                return null;
                            }

                            return (
                                <div key={index} class="Totals__billing__line">
                                    <div class="Totals__billing__line__title">
                                        {__('label-colon', {
                                            label: `${tax.name ?? __('tax')} (${tax.value.toString()}%)`,
                                        })}
                                    </div>
                                    <div class="Totals__billing__line__price">
                                        {formatAmount(tax.total, currency)}
                                    </div>
                                </div>
                            );
                        });
                    })()}
                    <div class="Totals__billing__line Totals__billing__line--grand-total">
                        <div class="Totals__billing__line__title">
                            {__(showDetailedTotals ? 'total-with-taxes' : 'total-dots')}
                        </div>
                        <div class="Totals__billing__line__price">
                            {formatAmount(totalWithTaxes, currency)}
                        </div>
                    </div>
                </div>
            </div>
        );
    },
});

export default Totals;
