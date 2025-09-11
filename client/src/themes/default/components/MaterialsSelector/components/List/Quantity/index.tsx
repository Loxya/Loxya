import { defineComponent } from 'vue';
import debounce from 'lodash/debounce';
import { DEBOUNCE_WAIT_DURATION } from '@/globals/constants';
import QuantityInput from '@/themes/default/components/QuantityInput';

import type { DebouncedMethod } from 'lodash';
import type { PropType } from 'vue';
import type { SourceMaterial } from '../../../_types';

type Props = {
    /** Le matériel dont on veut définir les quantités. */
    material: SourceMaterial,

    /** La quantité actuelle. */
    quantity: number,

    /**
     * Fonction appelée lorsque la quantité change.
     *
     * @param material - Le matériel dont la quantité a changé.
     * @param quantity - La nouvelle quantité.
     */
    onChange?(material: SourceMaterial, quantity: number): void,
};

type Data = {
    bouncedQuantity: number,
};

type InstanceProperties = {
    updateQuantityDebounced: (
        | DebouncedMethod<typeof MaterialsSelectorListQuantity, 'updateQuantity'>
        | undefined
    ),
};

/** Sélecteur de quantité de matériel. */
const MaterialsSelectorListQuantity = defineComponent({
    name: 'MaterialsSelectorListQuantity',
    props: {
        material: {
            type: Object as PropType<Required<Props>['material']>,
            required: true,
        },
        quantity: {
            type: Number as PropType<Required<Props>['quantity']>,
            required: true,
        },
        // eslint-disable-next-line vue/no-unused-properties
        onChange: {
            type: Function as PropType<Props['onChange']>,
            default: undefined,
        },
    },
    emits: ['change'],
    setup: (): InstanceProperties => ({
        updateQuantityDebounced: undefined,
    }),
    data(): Data {
        return {
            bouncedQuantity: this.quantity,
        };
    },
    watch: {
        quantity(newValue: number) {
            this.bouncedQuantity = newValue;
        },
    },
    created() {
        this.updateQuantityDebounced = debounce(
            this.updateQuantity.bind(this),
            DEBOUNCE_WAIT_DURATION.asMilliseconds(),
        );
    },
    beforeDestroy() {
        this.updateQuantityDebounced?.cancel();
    },
    methods: {
        // ------------------------------------------------------
        // -
        // -    Handlers
        // -
        // ------------------------------------------------------

        handleChange(value: number) {
            this.bouncedQuantity = value;
            this.updateQuantityDebounced!();
        },

        // ------------------------------------------------------
        // -
        // -    Méthodes internes
        // -
        // ------------------------------------------------------

        updateQuantity() {
            const { material, bouncedQuantity } = this;
            this.$emit('change', material, bouncedQuantity);
        },
    },
    render() {
        const { bouncedQuantity, handleChange } = this;

        return (
            <QuantityInput
                limit={{ min: 0 }}
                value={bouncedQuantity}
                onChange={handleChange}
            />
        );
    },
});

export default MaterialsSelectorListQuantity;
