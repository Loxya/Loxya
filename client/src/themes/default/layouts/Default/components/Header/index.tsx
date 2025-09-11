import './index.scss';
import { defineComponent } from 'vue';
import Loading from '@/themes/default/components/Loading';
import Icon from '@/themes/default/components/Icon';

import type { PropType } from 'vue';

type Props = {
    /**
     * Dois-t'on afficher l'état "En chargement" ?
     *
     * @default false
     */
    showLoading?: boolean,

    /**
     * Fonction appelée lorsque l'utilisateur demande
     * à afficher / cacher le menu.
     *
     * @param isOpen - Peut contenir deux types de valeur:
     *                 - Un booléen indiquant si le menu doit être ouvert ou fermé.
     *                 - La chaîne `toggle` pour indiquer que l'inverse de l'état actuel
     *                   doit être activé (e.g. Si actuellement fermé, doit être ouvert).
     */
    onToggleMenu?(isOpen: boolean | 'toggle'): void,
};

/** Header du layout par défaut de l'application. */
const DefaultLayoutHeader = defineComponent({
    name: 'DefaultLayoutHeader',
    props: {
        showLoading: {
            type: Boolean as PropType<Props['showLoading']>,
            default: false,
        },
        // eslint-disable-next-line vue/no-unused-properties
        onToggleMenu: {
            type: Function as PropType<Props['onToggleMenu']>,
            default: undefined,
        },
    },
    emits: ['toggleMenu'],
    computed: {
        pageTitle(): string {
            return this.$store.state.pageRawTitle;
        },
    },
    watch: {
        $route() {
            this.$emit('toggleMenu', false);
        },
    },
    methods: {
        toggleMenu() {
            this.$emit('toggleMenu', 'toggle');
        },
    },
    render() {
        const { pageTitle, showLoading, toggleMenu } = this;

        return (
            <div class="DefaultLayoutHeader">
                <div class="DefaultLayoutHeader__menu-toggle" onClick={toggleMenu}>
                    <Icon name="bars" />
                </div>
                <div class="DefaultLayoutHeader__main">
                    <h1 class="DefaultLayoutHeader__title">
                        {pageTitle}
                    </h1>
                    {showLoading && (
                        <Loading
                            class="DefaultLayoutHeader__loading"
                            minimalist
                            horizontal
                        />
                    )}
                </div>
            </div>
        );
    },
});

export default DefaultLayoutHeader;
