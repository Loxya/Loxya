import './index.scss';
import { defineComponent } from 'vue';

import type { PropType } from 'vue';
import type { MaterialWithAvailability as Material } from '@/stores/api/materials';

type Props = {
    /** Le matériel pour lequel on veut afficher les quantités. */
    material: Material,
};

// @vue/component
const MaterialsQuantities = defineComponent({
    name: 'MaterialsQuantities',
    props: {
        material: {
            type: Object as PropType<Required<Props>['material']>,
            required: true,
        },
    },
    computed: {
        stockQuantity() {
            const { material } = this;
            return material.stock_quantity;
        },

        availableQuantity() {
            const { material } = this;
            return material.available_quantity;
        },

        isCurrentlyUsed() {
            const { stockQuantity, availableQuantity } = this;
            return stockQuantity !== availableQuantity;
        },
    },
    render() {
        const { stockQuantity, availableQuantity, isCurrentlyUsed } = this;

        const classNames = ['MaterialsQuantities', {
            'MaterialsQuantities--used': isCurrentlyUsed,
            'MaterialsQuantities--exhausted': availableQuantity === 0,
        }];

        return (
            <div class={classNames}>
                <span class="MaterialsQuantities__available">
                    {availableQuantity}
                </span>
                &nbsp;/&nbsp;
                <span class="MaterialsQuantities__stock">
                    {stockQuantity}
                </span>
            </div>
        );
    },
});

export default MaterialsQuantities;
