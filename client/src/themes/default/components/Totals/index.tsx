import './index.scss';
import Fragment from '@/components/Fragment';
import { defineComponent } from 'vue';
import formatAmount from '@/utils/formatAmount';

import type { PropType } from 'vue';
import type { EventDetails, EventTaxTotal } from '@/stores/api/events';
import type {
    Booking as BookingCore,
    BookingTaxTotal as BookingCoreTaxTotal,
} from '@/stores/api/bookings';

type Booking = (
    | EventDetails
    | BookingCore
);

type BookingTaxTotal = (
    | EventTaxTotal
    | BookingCoreTaxTotal
);

type Props = {
    /** Le booking dont on veut afficher les totaux. */
    booking: Booking,
};

/** Totaux d'un booking. */
const Totals = defineComponent({
    name: 'Totals',
    props: {
        booking: {
            type: Object as PropType<Required<Props>['booking']>,
            required: true,
        },
    },
    computed: {
        duration(): number {
            const { operation_period: operationPeriod } = this.booking;
            return operationPeriod.asDays();
        },

        hasTaxes(): boolean {
            const { is_billable: isBillable } = this.booking;
            if (!isBillable) {
                return false;
            }

            const { total_taxes: totalTaxes } = this.booking;
            return totalTaxes.length > 0;
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
            materialsCount,
            duration,
            hasTaxes,
            hasGlobalDiscount,
        } = this;
        const {
            is_billable: isBillable,
            total_replacement: totalReplacement,
            currency,
        } = booking;

        if (materialsCount === 0) {
            return null;
        }

        const renderInfos = (): JSX.Element => (
            <div class="Totals__infos">
                <div class="Totals__infos__item">
                    {__('materials-count-total', { count: materialsCount }, materialsCount)}
                </div>
                <div class="Totals__infos__item">
                    {__('duration-days', { duration }, duration)}
                </div>
                {!totalReplacement.isZero() && (
                    <div class="Totals__infos__item">
                        {__('total-replacement', {
                            total: formatAmount(totalReplacement, currency),
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
            total_taxes: totalTaxes,
            total_with_taxes: totalWithTaxes,
        } = booking;

        return (
            <div class="Totals">
                {renderInfos()}
                <div class="Totals__billing">
                    {(hasGlobalDiscount || hasTaxes) && (
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
                            {hasTaxes && (
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
                    {hasTaxes && (
                        <Fragment>
                            {totalTaxes.map((tax: BookingTaxTotal, index: number) => {
                                const taxValue = tax.is_rate
                                    ? ` (${tax.value.toString()}%)`
                                    : null;

                                return (
                                    <div key={index} class="Totals__billing__line">
                                        <div class="Totals__billing__line__title">
                                            {tax.name}{taxValue}
                                        </div>
                                        <div class="Totals__billing__line__price">
                                            {formatAmount(tax.total, currency)}
                                        </div>
                                    </div>
                                );
                            })}
                        </Fragment>
                    )}
                    <div class="Totals__billing__line Totals__billing__line--grand-total">
                        <div class="Totals__billing__line__title">
                            {__(hasTaxes ? 'total-with-taxes' : 'total-dots')}
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
