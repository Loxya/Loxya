import './index.scss';
import Decimal from 'decimal.js';
import config from '@/globals/config';
import { defineComponent } from 'vue';
import formatAmount from '@/utils/formatAmount';
import Icon from '@/themes/default/components/Icon';
import getRentalPriceData from '../../../../../../../utils/getRentalPriceData';

import type Currency from '@/utils/currency';
import type { PropType } from 'vue';
import type { EmbeddedMaterial } from '../../../_types';

type Props = {
    /** Le matériel à afficher. */
    material: EmbeddedMaterial,

    /** Doit-on afficher les informations liées à la facturation ? */
    withBilling: boolean,
};

const ImportFromEventSelectedSummaryCategoryItem = defineComponent({
    name: 'ImportFromEventSelectedSummaryCategoryItem',
    props: {
        material: {
            type: Object as PropType<Required<Props>['material']>,
            required: true,
        },
        withBilling: {
            type: Boolean as PropType<Required<Props>['withBilling']>,
            default: false,
        },
    },
    computed: {
        name(): string {
            const { material } = this;

            return material.overrides !== null
                ? material.overrides.name
                : material.name;
        },

        reference(): string {
            const { material } = this;

            return material.overrides !== null
                ? material.overrides.reference
                : material.reference;
        },

        quantity(): number {
            return this.material.quantity;
        },

        unitPrice(): { price: Decimal, currency: Currency } {
            if (!this.withBilling) {
                return {
                    price: new Decimal(0),
                    currency: config.currency,
                };
            }
            const rentalPriceData = getRentalPriceData(this.material);

            const isUnsynced = rentalPriceData.override === null ? false : (
                !rentalPriceData.override.currency.isSame(rentalPriceData.sync.currency) ||
                !rentalPriceData.override.rentalPrice.equals(rentalPriceData.sync.rentalPrice)
            );

            const price = isUnsynced
                ? rentalPriceData.override!.rentalPrice
                : rentalPriceData.sync.rentalPrice;

            const currency = isUnsynced
                ? rentalPriceData.override!.currency
                : rentalPriceData.sync.currency;

            return { price, currency };
        },

        totalPrice(): { price: Decimal, currency: Currency } {
            if (!this.withBilling) {
                return {
                    price: new Decimal(0),
                    currency: config.currency,
                };
            }
            const rentalPriceData = getRentalPriceData(this.material);

            const totalPriceSync = rentalPriceData.sync.rentalPrice
                .times(this.quantity)
                .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

            let totalPriceOverride = null;
            if (rentalPriceData.override !== null) {
                totalPriceOverride = rentalPriceData.override.rentalPrice
                    .times(this.quantity)
                    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
            }

            const isUnsynced = totalPriceOverride === null ? false : (
                !rentalPriceData.override!.currency.isSame(rentalPriceData.sync.currency) ||
                !totalPriceOverride.equals(totalPriceSync)
            );

            // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
            const price = isUnsynced ? totalPriceOverride! : totalPriceSync;
            const currency = isUnsynced
                ? rentalPriceData.override!.currency
                : rentalPriceData.sync.currency;

            return { price, currency };
        },
    },
    render() {
        const {
            $t: __,
            name,
            reference,
            quantity,
            unitPrice,
            totalPrice,
            withBilling,
        } = this;

        return (
            <tr class="ImportFromEventSelectedSummaryCategoryItem">
                <td
                    class={[
                        'ImportFromEventSelectedSummaryCategoryItem__col',
                        'ImportFromEventSelectedSummaryCategoryItem__col--label',
                        'ImportFromEventSelectedSummaryCategoryItem__label',
                    ]}
                >
                    <div class="ImportFromEventSelectedSummaryCategoryItem__label__name">
                        {name}
                    </div>
                    <span class="ImportFromEventSelectedSummaryCategoryItem__label__ref">
                        {__('ref-ref', { reference })}
                    </span>
                </td>
                {withBilling && (
                    <td
                        class={[
                            'ImportFromEventSelectedSummaryCategoryItem__col',
                            'ImportFromEventSelectedSummaryCategoryItem__col--price',
                        ]}
                    >
                        {formatAmount(unitPrice.price, unitPrice.currency)}
                    </td>
                )}
                <td
                    class={[
                        'ImportFromEventSelectedSummaryCategoryItem__col',
                        'ImportFromEventSelectedSummaryCategoryItem__col--quantity',
                        'ImportFromEventSelectedSummaryCategoryItem__quantity',
                    ]}
                >
                    <Icon
                        name="times"
                        class="ImportFromEventSelectedSummaryCategoryItem__quantity__icon"
                    />
                    {quantity}
                </td>
                {withBilling && (
                    <td
                        class={[
                            'ImportFromEventSelectedSummaryCategoryItem__col',
                            'ImportFromEventSelectedSummaryCategoryItem__col--total',
                        ]}
                    >
                        {formatAmount(totalPrice.price, totalPrice.currency)}
                    </td>
                )}
            </tr>
        );
    },
});

export default ImportFromEventSelectedSummaryCategoryItem;
