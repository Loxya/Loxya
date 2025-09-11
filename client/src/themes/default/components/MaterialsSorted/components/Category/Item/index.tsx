import './index.scss';
import Decimal from 'decimal.js';
import { defineComponent } from 'vue';
import formatAmount from '@/utils/formatAmount';
import Icon from '@/themes/default/components/Icon';

import type Currency from '@/utils/currency';
import type { PropType } from 'vue';
import type {
    EmbeddedMaterial,
} from '../../../_types';

type Props = {
    /** Le matériel à afficher. */
    material: EmbeddedMaterial,

    /** Doit-on afficher les informations liées à la facturation ? */
    withBilling: boolean,

    /**
     * La devise à utiliser pour les prix.
     *
     * - Uniquement si `withBilling` est utilisé.
     * - Si non fournie, la devise par défaut sera utilisée.
     */
    currency?: Currency,
};

/** Un matériel dans une catégorie de la liste de matériel triée. */
const MaterialsSortedCategoryItem = defineComponent({
    name: 'MaterialsSortedCategoryItem',
    props: {
        material: {
            type: Object as PropType<Required<Props>['material']>,
            required: true,
        },
        withBilling: {
            type: Boolean as PropType<Required<Props>['withBilling']>,
            default: false,
        },
        currency: {
            type: Object as PropType<Props['currency']>,
            default: undefined,
        },
    },
    computed: {
        unitPricePeriod(): Decimal {
            if (!this.withBilling) {
                return new Decimal(0);
            }

            return 'unit_price_period' in this.material
                ? this.material.unit_price_period
                : new Decimal(0);
        },

        quantity(): number {
            return this.material.quantity;
        },

        totalWithoutDiscount(): Decimal {
            return 'total_without_discount' in this.material
                ? this.material.total_without_discount
                : new Decimal(0);
        },

        discountRate(): Decimal {
            return 'discount_rate' in this.material
                ? this.material.discount_rate
                : new Decimal(0);
        },

        hasDiscount(): boolean {
            return !this.discountRate.isZero();
        },

        totalDiscount(): Decimal {
            return 'total_discount' in this.material
                ? this.material.total_discount
                : new Decimal(0);
        },

        totalWithoutTaxes(): Decimal {
            return 'total_without_taxes' in this.material
                ? this.material.total_without_taxes
                : new Decimal(0);
        },
    },
    render() {
        const {
            $t: __,
            material,
            unitPricePeriod,
            quantity,
            discountRate,
            totalWithoutTaxes,
            withBilling,
            hasDiscount,
            currency,
        } = this;

        return (
            <tr class="MaterialsSortedCategoryItem">
                <td
                    class={[
                        'MaterialsSortedCategoryItem__col',
                        'MaterialsSortedCategoryItem__col--label',
                        'MaterialsSortedCategoryItem__label',
                    ]}
                >
                    <div class="MaterialsSortedCategoryItem__label__name">
                        {material.name}
                    </div>
                    <span class="MaterialsSortedCategoryItem__label__ref">
                        {__('ref-ref', { reference: material.reference })}
                    </span>
                </td>
                {withBilling && (
                    <td
                        class={[
                            'MaterialsSortedCategoryItem__col',
                            'MaterialsSortedCategoryItem__col--price',
                        ]}
                    >
                        {formatAmount(unitPricePeriod, currency)}
                    </td>
                )}
                <td
                    class={[
                        'MaterialsSortedCategoryItem__col',
                        'MaterialsSortedCategoryItem__col--quantity',
                        'MaterialsSortedCategoryItem__quantity',
                    ]}
                >
                    <Icon
                        name="times"
                        class="MaterialsSortedCategoryItem__quantity__icon"
                    />
                    {quantity}
                </td>
                {withBilling && (
                    <td
                        class={[
                            'MaterialsSortedCategoryItem__col',
                            'MaterialsSortedCategoryItem__col--discount',
                        ]}
                    >
                        {hasDiscount ? `-${discountRate.toString()}%` : null}
                    </td>
                )}
                {withBilling && (
                    <td
                        class={[
                            'MaterialsSortedCategoryItem__col',
                            'MaterialsSortedCategoryItem__col--total',
                        ]}
                    >
                        {formatAmount(totalWithoutTaxes, currency)}
                    </td>
                )}
            </tr>
        );
    },
});

export default MaterialsSortedCategoryItem;
