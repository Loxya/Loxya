import './index.scss';
import { defineComponent } from 'vue';
import Icon from '@/themes/default/components/Icon';

import type { PropType } from 'vue';

type Props = {
    /** La valeur actuelle du champ de quantité. */
    value: number,

    /**
     * La ou les limite(s) de quantité à utiliser.
     *
     * Si c'est un simple nombre, défini la quantité maximum. Si c'est un objet,
     * permet de définir les limites minimum et maximum ({ min, max }).
     */
    limit?: number | { min?: number, max?: number },

    /**
     * Doit-t'on afficher une version "en ligne" (compacte) du champ ?
     *
     * @default false
     */
    inline?: boolean,

    /**
     * Fonction appelée lorsque la valeur du champ change.
     *
     * @param newValue - La nouvelle valeur du bloc-note.
     */
    onChange?(newValue: number): void,
};

/**
 * Un champ de formulaire pour gérer une quantité, avec deux
 * boutons autour permettant d'incrémenter ou décrémenter la valeur.
 */
const InputQuantity = defineComponent({
    name: 'InputQuantity',
    props: {
        value: {
            type: Number as PropType<Props['value']>,
            required: true,
        },
        limit: {
            type: [Number, Object] as PropType<Props['limit']>,
            default: undefined,
        },
        inline: {
            type: Boolean as PropType<Required<Props>['inline']>,
            default: false,
        },
        // eslint-disable-next-line vue/no-unused-properties
        onChange: {
            type: Function as PropType<Props['onChange']>,
            default: undefined,
        },
    },
    emits: ['change'],
    computed: {
        min(): number {
            return typeof this.limit === 'object'
                ? (this.limit?.min ?? 0)
                : 0;
        },

        max(): number | undefined {
            return typeof this.limit === 'object'
                ? (this.limit?.max ?? undefined)
                : this.limit;
        },
    },
    methods: {
        // ------------------------------------------------------
        // -
        // -    Handlers
        // -
        // ------------------------------------------------------

        handleInputChange(e: InputEvent) {
            let value = Number.parseInt((e.target! as HTMLInputElement).value, 10);

            if ((!value && value !== 0) || Number.isNaN(value) || !Number.isFinite(value)) {
                value = this.min;
            }

            if (value < this.min) {
                value = this.min;
            }

            if (undefined !== this.max && value > this.max) {
                value = this.max!;
            }

            this.$emit('change', value);
        },

        handleDecrement() {
            const value = this.value - 1;
            if (value < this.min) {
                return;
            }
            this.$emit('change', value);
        },

        handleIncrement() {
            const value = this.value + 1;
            if (undefined !== this.max && value > this.max) {
                return;
            }
            this.$emit('change', value);
        },
    },
    render() {
        const {
            min,
            max,
            inline,
            value,
            handleDecrement,
            handleIncrement,
            handleInputChange,
        } = this;

        return (
            <div class={['InputQuantity', { 'InputQuantity--inline': inline }]}>
                <button
                    type="button"
                    role="button"
                    class={[
                        'InputQuantity__button',
                        'InputQuantity__button--decrement',
                        { 'InputQuantity__button--disabled': value <= min },
                    ]}
                    disabled={value <= min}
                    onClick={handleDecrement}
                >
                    <Icon name="minus" />
                </button>
                <input
                    type="number"
                    class="InputQuantity__input"
                    step={1}
                    min={min}
                    max={max}
                    value={value}
                    onInput={handleInputChange}
                    onFocus={(e: FocusEvent) => {
                        (e.target as HTMLInputElement).select();
                    }}
                />
                <button
                    type="button"
                    role="button"
                    class={[
                        'InputQuantity__button',
                        'InputQuantity__button--increment',
                        { 'InputQuantity__button--disabled': undefined !== max && value >= max },
                    ]}
                    disabled={undefined !== max && value >= max}
                    onClick={handleIncrement}
                >
                    <Icon name="plus" />
                </button>
            </div>
        );
    },
});

export default InputQuantity;
