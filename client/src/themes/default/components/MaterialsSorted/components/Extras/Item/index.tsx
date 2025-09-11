import './index.scss';
import Decimal from 'decimal.js';
import { defineComponent } from 'vue';
import formatAmount from '@/utils/formatAmount';
import Icon from '@/themes/default/components/Icon';

import type Currency from '@/utils/currency';
import type { PropType } from 'vue';
import type { EmbeddedExtra } from '../../../_types';

type Props = {
    /** L'extra à afficher. */
    extra: EmbeddedExtra,

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

/** Un élément dans la liste des extras liés à une liste de matériel. */
const MaterialsSortedExtrasItem = defineComponent({
    name: 'MaterialsSortedExtrasItem',
    props: {
        extra: {
            type: Object as PropType<Required<Props>['extra']>,
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
        unitPrice(): Decimal {
            if (!this.withBilling) {
                return new Decimal(0);
            }

            return 'unit_price' in this.extra
                ? this.extra.unit_price
                : new Decimal(0);
        },

        quantity(): number {
            return this.extra.quantity;
        },

        totalWithoutTaxes(): Decimal {
            return 'total_without_taxes' in this.extra
                ? this.extra.total_without_taxes
                : new Decimal(0);
        },
    },
    render() {
        const {
            extra,
            unitPrice,
            quantity,
            totalWithoutTaxes,
            withBilling,
            currency,
        } = this;

        return (
            <tr class="MaterialsSortedExtrasItem">
                <td
                    class={[
                        'MaterialsSortedExtrasItem__col',
                        'MaterialsSortedExtrasItem__col--label',
                        'MaterialsSortedExtrasItem__label',
                    ]}
                >
                    {extra.description}
                </td>
                {withBilling && (
                    <td
                        class={[
                            'MaterialsSortedExtrasItem__col',
                            'MaterialsSortedExtrasItem__col--unit-price',
                        ]}
                    >
                        {formatAmount(unitPrice, currency)}
                    </td>
                )}
                <td
                    class={[
                        'MaterialsSortedExtrasItem__col',
                        'MaterialsSortedExtrasItem__col--quantity',
                        'MaterialsSortedExtrasItem__quantity',
                    ]}
                >
                    <Icon
                        name="times"
                        class="MaterialsSortedExtrasItem__quantity__icon"
                    />
                    {quantity}
                </td>
                {withBilling && (
                    <td
                        class={[
                            'MaterialsSortedExtrasItem__col',
                            'MaterialsSortedExtrasItem__col--total-price',
                        ]}
                    >
                        {formatAmount(totalWithoutTaxes, currency)}
                    </td>
                )}
            </tr>
        );
    },
});

export default MaterialsSortedExtrasItem;
