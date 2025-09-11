import './index.scss';
import generateUniqueId from 'lodash/uniqueId';
import { defineComponent } from 'vue';

import type { PropType } from 'vue';

export type OptionData = {
    /** Le texte à afficher pour l'option. */
    label: string,

    /** La valeur de l'option. */
    value: string | number,
};

type Props<V extends string | number = string | number> = {
    /** Le texte à afficher pour l'option. */
    label: string,

    /** La valeur de l'option. */
    value: V,

    /**
     * L'option est-elle celle qui est active ?
     *
     * @default false
     */
    active: boolean,

    /**
     * L'option fait-elle partie de checkboxes dont le changement
     * de valeur est considéré comme critique ?
     *
     * @default false
     */
    critical?: boolean,

    /**
     * Fonction appelée lorsque l'option a été sélectionnée.
     *
     * @param value - La valeur de l'option.
     */
    onSelect?(value: V): void,

    /**
     * Fonction appelée lorsque l'option a été désélectionnée.
     *
     * @param value - La valeur de l'option.
     */
    onDeselect?(value: V): void,
};

type InstanceProperties = {
    uniqueId: string | undefined,
};

/** Une option pour les Checkboxes. */
const CheckboxesOption = defineComponent({
    name: 'CheckboxesOption',
    props: {
        label: {
            type: String as PropType<Props['label']>,
            required: true,
        },
        value: {
            type: [String, Number] as PropType<Props['value']>,
            required: true,
        },
        active: {
            type: Boolean as PropType<Required<Props>['active']>,
            default: false,
        },
        critical: {
            type: Boolean as PropType<Required<Props>['critical']>,
            default: false,
        },
        // eslint-disable-next-line vue/no-unused-properties
        onSelect: {
            type: Function as PropType<Props['onSelect']>,
            default: undefined,
        },
        // eslint-disable-next-line vue/no-unused-properties
        onDeselect: {
            type: Function as PropType<Props['onSelect']>,
            default: undefined,
        },
    },
    emits: [
        'select', // eslint-disable-line vue/no-unused-emit-declarations
        'deselect', // eslint-disable-line vue/no-unused-emit-declarations
    ],
    setup: (): InstanceProperties => ({
        uniqueId: undefined,
    }),
    created() {
        const { $options } = this;

        this.uniqueId = generateUniqueId(`${$options.name!}-`);
    },
    methods: {
        handleClick(e: MouseEvent) {
            e.preventDefault();

            this.$emit(this.active ? 'deselect' : 'select', this.value);
        },
    },
    render() {
        const { critical, active, uniqueId, label, handleClick } = this;

        const classNames = ['CheckboxesOption', {
            'CheckboxesOption--critical': critical,
            'CheckboxesOption--active': active,
        }];

        return (
            <label for={uniqueId} class={classNames} onClick={handleClick}>
                <input
                    type="checkbox"
                    id={uniqueId}
                    class="CheckboxesOption__input"
                    checked={active}
                />
                {label}
            </label>
        );
    },
});

export default CheckboxesOption;
