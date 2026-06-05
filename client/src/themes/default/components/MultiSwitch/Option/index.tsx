import './index.scss';
import generateUniqueId from 'lodash/uniqueId';
import { defineComponent } from 'vue';
import Icon, { Variant } from '@/themes/default/components/Icon';

import type { PropType } from 'vue';
import type { Props as IconProps } from '@/themes/default/components/Icon';

export type OptionData = {
    value: string | number,
    label: string,
    icon?: string | `${string}:${Required<IconProps>['variant']}`,
    isDisplayed?: boolean,
};

type Props = {
    /** Les données de l'option. */
    data: OptionData,

    /** L'option est-elle celle qui est active ? */
    active: boolean,

    /**
     * L'option peut-elle être affichée de manière minimaliste
     * (= uniquement l'icône) pour les petits écrans ?
     *
     * Quand cette prop. vaut `true`, pour les écrans plus petit que le format
     * tablette, si l'option comporte une icône, seule celle-ci sera affichée.
     *
     * @default false
     */
    collapsible?: boolean,

    /**
     * Fonction appelée lorsqu'un l'option est sélectionnée.
     *
     * @param value - La valeur de l'option.
     */
    onSelect?(value: OptionData['value']): void,
};

type InstanceProperties = {
    uniqueId: string | undefined,
};

/** Une option pour le MultiSwitch. */
const MultiSwitchOption = defineComponent({
    name: 'MultiSwitchOption',
    props: {
        data: {
            type: Object as PropType<Props['data']>,
            required: true,
        },
        active: {
            type: Boolean as PropType<Required<Props>['active']>,
            default: true,
        },
        collapsible: {
            type: Boolean as PropType<Required<Props>['collapsible']>,
            default: false,
        },
        // eslint-disable-next-line vue/no-unused-properties
        onSelect: {
            type: Function as PropType<Props['onSelect']>,
            default: undefined,
        },
    },
    emits: ['select'],
    setup: (): InstanceProperties => ({
        uniqueId: undefined,
    }),
    computed: {
        normalizedIcon(): IconProps | null {
            const { icon } = this.data;

            if (!icon) {
                return null;
            }

            if (!icon.includes(':')) {
                return { name: icon };
            }

            const [name, variant] = icon.split(':');
            if (Object.values(Variant).includes(variant as Variant)) {
                return { name, variant: variant as Variant };
            }

            return { name };
        },
    },
    created() {
        const { $options } = this;

        this.uniqueId = generateUniqueId(`${$options.name!}-`);
    },
    methods: {
        handleClick() {
            if (this.active) {
                return;
            }

            this.$emit('select', this.data.value);
        },
    },
    render() {
        const { uniqueId, data, normalizedIcon: icon, active, collapsible, handleClick } = this;

        const classNames = ['MultiSwitchOption', {
            'MultiSwitchOption--active': active,
            'MultiSwitchOption--collapsible': collapsible,
            'MultiSwitchOption--with-icon': !!icon,
        }];

        return (
            <label for={uniqueId} class={classNames}>
                <input
                    type="radio"
                    id={uniqueId}
                    class="MultiSwitchOption__input"
                    checked={active}
                    onClick={handleClick}
                />
                {!!icon && <Icon {...{ props: icon } as any} class="MultiSwitchOption__icon" />}
                <span class="MultiSwitchOption__label">{data.label}</span>
            </label>
        );
    },
});

export default MultiSwitchOption;
