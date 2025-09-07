import './index.scss';
import { defineComponent } from 'vue';
import Item from './Item';

import type { PropType } from 'vue';
import type { EmbeddedMaterialsByCategory } from '../../utils/groupByCategories';
import type { EmbeddedMaterial } from '../../_types';

type Props = {
    /** La catégorie à afficher. */
    data: EmbeddedMaterialsByCategory,

    /** Doit-on afficher les informations liées à la facturation ? */
    withBilling: boolean,
};

const ImportFromEventSelectedSummaryCategory = defineComponent({
    name: 'ImportFromEventSelectedSummaryCategory',
    props: {
        data: {
            type: Object as PropType<Required<Props>['data']>,
            required: true,
        },
        withBilling: {
            type: Boolean as PropType<Required<Props>['withBilling']>,
            default: false,
        },
    },
    render() {
        const { $t: __, data, withBilling } = this;

        return (
            <div class="ImportFromEventSelectedSummaryCategory">
                <h4 class="ImportFromEventSelectedSummaryCategory__title">
                    {data.name ?? __('not-categorized')}
                </h4>
                <div class="ImportFromEventSelectedSummaryCategory__list">
                    <table class="ImportFromEventSelectedSummaryCategory__list__table">
                        {data.materials.map((material: EmbeddedMaterial) => (
                            <Item
                                key={material.id}
                                material={material}
                                withBilling={withBilling}
                            />
                        ))}
                    </table>
                </div>
            </div>
        );
    },
});

export default ImportFromEventSelectedSummaryCategory;
