import { defineComponent } from 'vue';
import Fragment from '@/components/Fragment';

import type { PropType } from 'vue';

type Props = {
    /** Le titre de l'onglet. */
    title: string,

    /** L'icône de l'onglet. */
    icon?: string,

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
};

/** Un onglet. */
const Tab = defineComponent({
    name: 'Tab',
    props: {
        // - Ces props sont utilisées dans le composant parent 'Tabs'.
        /* eslint-disable vue/no-unused-properties */
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
        counter: {
            type: Number as PropType<Props['counter']>,
            default: undefined,
        },
        /* eslint-enable vue/no-unused-properties */
    },
    render() {
        const children = this.$slots.default;
        return <Fragment>{children}</Fragment>;
    },
});

export default Tab;
