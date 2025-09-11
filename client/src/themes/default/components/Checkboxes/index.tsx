import './index.scss';
import { defineComponent } from 'vue';
import Option from './Option';

import type { PropType } from 'vue';
import type { OptionData } from './Option';

/** Mode de présentation du groupe de checkboxes */
export enum CheckboxesLayout {
    /** Présentation par défaut. */
    DEFAULT = 'default',

    /**
     * Présentation de checkboxes représentant des données
     * considérées comme critiques.
     */
    CRITICAL = 'critical',
}

type Props = {
    /** La liste des options à afficher. */
    options: OptionData[],

    /** La valeur des options sélectionnées (component contrôlé). */
    value: Array<OptionData['value']>,

    /**
     * Le layout à utiliser.
     *
     * @default CheckboxesLayout.DEFAULT
     */
    layout?: CheckboxesLayout,

    /**
     * Fonction appelée lorsque les valeurs sélectionnées changent.
     *
     * @param newValues - Les nouvelles valeurs sélectionnées.
     */
    onInput?(newValues: Array<OptionData['value']>): void,
};

/** Groupe de checkboxes. */
const Checkboxes = defineComponent({
    name: 'Checkboxes',
    props: {
        options: {
            type: Array as PropType<Props['options']>,
            required: true,
        },
        value: {
            type: Array as PropType<Props['value']>,
            required: true,
        },
        layout: {
            type: String as PropType<Required<Props>['layout']>,
            default: CheckboxesLayout.DEFAULT,
        },
        // eslint-disable-next-line vue/no-unused-properties
        onInput: {
            type: Function as PropType<Props['onInput']>,
            default: undefined,
        },
    },
    emits: ['input'],
    methods: {
        handleSelect(value: OptionData['value']) {
            this.$emit('input', [...new Set([...this.value, value])]);
        },

        handleDeselect(value: OptionData['value']) {
            const newValues = [...this.value];
            const foundIndex = newValues.indexOf(value);
            if (foundIndex === -1) {
                return;
            }
            newValues.splice(foundIndex, 1);
            this.$emit('input', newValues);
        },
    },
    render() {
        const { layout, options, value, handleSelect, handleDeselect } = this;

        const classnames = ['Checkboxes', {
            'Checkboxes--critical': layout === CheckboxesLayout.CRITICAL,
        }];

        return (
            <div class={classnames}>
                {options.map((data: OptionData) => (
                    <Option
                        key={data.value}
                        critical={layout === CheckboxesLayout.CRITICAL}
                        label={data.label}
                        value={data.value}
                        active={value.includes(data.value)}
                        onSelect={handleSelect}
                        onDeselect={handleDeselect}
                    />
                ))}
            </div>
        );
    },
});

export default Checkboxes;
