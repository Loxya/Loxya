import './index.scss';
import { defineComponent, inject } from 'vue';
import { SetGlobalSidebarStateKey } from '@/themes/default/layouts/Default';
import Loading from '@/themes/default/components/Loading';
import Icon from '@/themes/default/components/Icon';

import type { Injected, PropType } from 'vue';

type Props = {
    /**
     * Le titre de la page.
     *
     * Celui-ci sera utilisé dans le header de l'application
     * ainsi que dans le `<title></title>` du document.
     */
    title: string,

    /**
     * Dois-t'on afficher l'état "En chargement" ?
     *
     * @default false
     */
    showLoading?: boolean,

    /**
     * Les éventuelles actions contextuelles de la page.
     * (sous forme de nœuds vue dans un tableau)
     */
    actions?: JSX.Element[],

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

type InstanceProperties = {
    setGlobalSidebarState: Injected<typeof SetGlobalSidebarStateKey> | undefined,
};

/** Header de page. */
const PageHeader = defineComponent({
    name: 'PageHeader',
    props: {
        title: {
            type: String as PropType<Props['title']>,
            required: true,
        },
        showLoading: {
            type: Boolean as PropType<Props['showLoading']>,
            default: false,
        },
        actions: {
            type: Array as PropType<Props['actions']>,
            default: undefined,
        },
        // eslint-disable-next-line vue/no-unused-properties
        onToggleMenu: {
            type: Function as PropType<Props['onToggleMenu']>,
            default: undefined,
        },
    },
    setup: (): InstanceProperties => ({
        setGlobalSidebarState: inject(SetGlobalSidebarStateKey, undefined),
    }),
    computed: {
        showGlobalSidebarToggle(): boolean {
            return this.setGlobalSidebarState !== undefined;
        },
    },
    methods: {
        handleToggleGlobalSidebar() {
            this.setGlobalSidebarState?.('toggle');
        },
    },
    render() {
        const {
            title,
            actions,
            showLoading,
            showGlobalSidebarToggle,
            handleToggleGlobalSidebar,
        } = this;

        return (
            <div class="PageHeader">
                {showGlobalSidebarToggle && (
                    <div class="PageHeader__menu-toggle" onClick={handleToggleGlobalSidebar}>
                        <Icon name="bars" />
                    </div>
                )}
                <div class="PageHeader__main">
                    <div class="PageHeader__main__title">
                        <h1 class="PageHeader__title">
                            {title}
                        </h1>
                        {showLoading && (
                            <Loading
                                class="PageHeader__loading"
                                minimalist
                                horizontal
                            />
                        )}
                    </div>
                    {((actions ?? []).length > 0) && (
                        <nav class="PageHeader__main__actions">
                            {actions}
                        </nav>
                    )}
                </div>
            </div>
        );
    },
});

export default PageHeader;
