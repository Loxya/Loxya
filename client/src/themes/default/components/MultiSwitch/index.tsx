import './index.scss';
import { defineComponent } from 'vue';
import Option from './Option';

import type { PropType } from 'vue';
import type { OptionData } from './Option';

type Props = {
    /** La liste des options à afficher. */
    options: OptionData[],

    /** La valeur de l'option sélectionnée. */
    value: string | number | null,

    /**
     * Fonction appelée lorsque l'option active change.
     *
     * @param selectedValue - La nouvelle option à activer.
     */
    onChange?(selectedValue: string | number): void,
};

/**
 * Affiche plusieurs boutons côte-à-côte.
 * Une seule option peut être sélectionné à la fois.
 */
const MultiSwitch = defineComponent({
    name: 'MultiSwitch',
    props: {
        options: {
            type: Array as PropType<Props['options']>,
            required: true,
        },
        value: {
            type: [String, Number] as PropType<Props['value']>,
            required: true,
            validator: (value: unknown) => (
                ['string', 'number'].includes(typeof value) ||
                value === null
            ),
        },
        // eslint-disable-next-line vue/no-unused-properties
        onChange: {
            type: Function as PropType<Props['onChange']>,
            default: undefined,
        },
    },
    emits: ['change'],
    computed: {
        displayedOptions(): OptionData[] {
            return this.options.filter(({ isDisplayed = true }: OptionData) => isDisplayed);
        },
    },
    methods: {
        handleSelect(selectedValue: string | number) {
            this.$emit('change', selectedValue);
        },
    },
    render() {
        const { displayedOptions, value, handleSelect } = this;

        if (displayedOptions.length === 0) {
            return null;
        }

        return (
            <div class="MultiSwitch">
                {displayedOptions.map((option: OptionData) => (
                    <Option
                        key={option.value}
                        data={option}
                        active={value === option.value}
                        onSelect={handleSelect}
                    />
                ))}
            </div>
        );
    },
});

export type { OptionData as Option };

export default MultiSwitch;
