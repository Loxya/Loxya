import './index.scss';
import { defineComponent } from 'vue';
import Icon from '@/themes/default/components/Icon';

import type { PropType } from 'vue';
import type {
    Props as IconProps,
    Variant as IconVariant,
} from '@/themes/default/components/Icon';

type Props = {
    /** Le titre de l'onglet. */
    title: string,

    /** L'icône de l'onglet. */
    icon?: string,

    /**
     * L'onglet est-il l'onglet actif ?
     *
     * @default false
     */
    active?: boolean,

    /**
     * L'onglet est-il être marqué comme désactivé ?
     *
     * @default false
     */
    disabled?: boolean,

    /**
     * Un avertissement doit-il être affiché pour cet onglet ?
     *
     * Cette prop. peut être utilisée pour signaler des informations
     * importantes ou des problèmes liés à l'onglet.
     *
     * @default false
     */
    warning?: boolean,

    /**
     * Un compteur qui peut être affiché dans l'onglet.
     *
     * Il est souvent utilisé pour indiquer une quantité associée à
     * l'onglet, comme le nombre de notifications ou d'éléments.
     */
    counter?: number,

    /**
     * Fonction appelée lorsque le bouton d'onglet est cliqué.
     */
    onClick?(): void,
};

/** Un bouton d'onglet. */
const TabButton = defineComponent({
    name: 'TabButton',
    props: {
        title: {
            type: String as PropType<Props['title']>,
            required: true,
        },
        icon: {
            type: String as PropType<Props['icon']>,
            default: undefined,
        },
        disabled: {
            type: Boolean as PropType<Required<Props>['disabled']>,
            default: false,
        },
        warning: {
            type: Boolean as PropType<Required<Props>['warning']>,
            default: false,
        },
        active: {
            type: Boolean as PropType<Required<Props>['active']>,
            default: false,
        },
        counter: {
            type: Number as PropType<Props['counter']>,
            default: undefined,
        },
        // eslint-disable-next-line vue/no-unused-properties
        onClick: {
            type: Function as PropType<Props['onClick']>,
            default: undefined,
        },
    },
    emits: ['click'],
    computed: {
        normalizedIcon(): IconProps | undefined {
            if (!this.icon) {
                return undefined;
            }

            if (!this.icon.includes(':')) {
                return { name: this.icon };
            }

            const [iconType, variant] = this.icon.split(':');
            return { name: iconType, variant: variant as IconVariant };
        },
    },
    methods: {
        handleClick() {
            if (this.disabled) {
                return;
            }
            this.$emit('click');
        },
    },
    render() {
        const {
            title,
            normalizedIcon: icon,
            disabled,
            warning,
            counter,
            active,
            handleClick,
        } = this;
        const hasCounter = counter !== undefined && counter > 0;

        const className = ['TabButton', {
            'TabButton--selected': active,
            'TabButton--disabled': disabled,
            'TabButton--warning': warning,
            'TabButton--with-counter': hasCounter,
        }];

        return (
            <li role="tab" class={className} onClick={handleClick}>
                {icon && (
                    <Icon
                        name={icon.name}
                        variant={icon.variant}
                        class="TabButton__icon"
                    />
                )}
                {title}
                {hasCounter && (
                    <span class="TabButton__counter">
                        {counter}
                    </span>
                )}
            </li>
        );
    },
});

export default TabButton;
