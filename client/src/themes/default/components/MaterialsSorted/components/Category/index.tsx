import './index.scss';
import Decimal from 'decimal.js';
import { defineComponent } from 'vue';
import formatAmount from '@/utils/formatAmount';
import Item from './Item';

import type Currency from '@/utils/currency';
import type { PropType } from 'vue';
import type { EmbeddedMaterial } from '../../_types';
import type { EmbeddedMaterialsByCategory } from '../../utils/groupByCategories';

type Props = {
    /**
     * La section à afficher, comportant :
     * - `id` : l'identifiant de la catégorie,
     * - `name` : le nom de la catégorie,
     * - `materials` : le matériel de la catégorie.
     */
    data: EmbeddedMaterialsByCategory,

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

/** Une catégorie dans la liste de matériel triée. */
const MaterialsSortedCategory = defineComponent({
    name: 'MaterialsSortedCategory',
    props: {
        data: {
            type: Object as PropType<Required<Props>['data']>,
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
        subTotal(): Decimal | undefined {
            const { data, withBilling } = this;

            if (!withBilling) {
                return undefined;
            }

            return data.materials.reduce(
                (total: Decimal, embeddedMaterial: EmbeddedMaterial) => {
                    const totalWithoutTaxes = 'total_without_taxes' in embeddedMaterial
                        ? embeddedMaterial.total_without_taxes
                        : new Decimal(0);

                    return total.plus(totalWithoutTaxes);
                },
                new Decimal(0),
            );
        },
    },
    render() {
        const {
            $t: __,
            data,
            withBilling,
            subTotal,
            currency,
        } = this;

        return (
            <div class="MaterialsSortedCategory">
                <h4 class="MaterialsSortedCategory__title">
                    {data.name ?? __('not-categorized')}
                </h4>
                <table class="MaterialsSortedCategory__list">
                    {data.materials.map((material: EmbeddedMaterial) => (
                        <Item
                            key={material.id}
                            material={material}
                            withBilling={withBilling}
                            currency={currency}
                        />
                    ))}
                </table>
                {withBilling && (
                    <div class="MaterialsSortedCategory__subtotal">
                        <div class="MaterialsSortedCategory__subtotal__name">
                            {__('subtotal')}
                        </div>
                        <div class="MaterialsSortedCategory__subtotal__price">
                            {formatAmount(subTotal, currency)}
                        </div>
                    </div>
                )}
            </div>
        );
    },
});

export default MaterialsSortedCategory;
