import './index.scss';
import { defineComponent } from 'vue';
import Header from './components/Header';
import Alert from '@/themes/default/components/Alert';

import type { PropType } from 'vue';

export type Props = {
    /** Le nom unique de la page. */
    name: string,

    /**
     * Le titre de la page.
     *
     * Celui-ci sera utilisé dans le header de l'application
     * ainsi que dans le `<title></title>` du document.
     */
    title: string,

    /** Un éventuel message d'aide global à la page. */
    help?: string,

    /**
     * La page contient t'elle actuellement des erreurs de validation ?
     *
     * Ceci permettra d'afficher une alerte spécifique en haut de la page.
     * (à la place du message d'aide s'il a été spécifié (see {@link Props['help']}))
     */
    hasValidationError?: boolean,

    /**
     * La page est-elle en cours de chargement ?
     *
     * Ceci permettra d'afficher un message de chargement spécifique en haut de la page.
     * (à la place du message d'aide s'il a été spécifié (see {@link Props['help']}))
     */
    loading?: boolean,

    /** Permet de centrer le contenu de la page. */
    centered?: boolean,

    /**
     * Les éventuelles actions contextuelles de la page.
     * (sous forme de nœuds vue dans un tableau)
     */
    actions?: JSX.Element[],
};

type Data = {
    isLoading: boolean,
};

/** Une page. */
const Page = defineComponent({
    name: 'Page',
    props: {
        name: {
            type: String as PropType<Props['name']>,
            required: true,
        },
        title: {
            type: String as PropType<Props['title']>,
            required: true,
        },
        help: {
            type: String as PropType<Props['help']>,
            default: undefined,
        },
        hasValidationError: {
            type: Boolean as PropType<Required<Props>['hasValidationError']>,
            default: false,
        },
        loading: {
            type: Boolean as PropType<Required<Props>['loading']>,
            default: false,
        },
        centered: {
            type: Boolean as PropType<Required<Props>['centered']>,
            default: false,
        },
        actions: {
            type: Array as PropType<Props['actions']>,
            default: undefined,
        },
    },
    data: (): Data => ({
        isLoading: false,
    }),
    watch: {
        title(newTitle: Props['title']) {
            this.updateTitle(newTitle);
        },
    },
    mounted() {
        this.updateTitle(this.title);
    },
    beforeDestroy() {
        this.updateTitle(undefined);
    },
    methods: {
        updateTitle(newTitle: string | undefined) {
            this.$store.commit('setPageRawTitle', newTitle ?? null);
            document.title = [newTitle, 'Loxya'].filter(Boolean).join(' - ');
        },

        // ------------------------------------------------------
        // -
        // -    API Publique
        // -
        // ------------------------------------------------------

        /**
         * Permet de faire défiler le document jusqu'en haut de la page.
         *
         * @param behavior - Détermine la manière d'atteindre le haut de la page:
         *                   - `smooth`: La "montée" sera progressive, avec animation (défaut).
         *                   - `instant`: La montée sera instantanée.
         *                   - `auto`: L'animation de montée sera déterminée via la
         *                             propriété CSS `scroll-behavior`.
         */
        scrollToTop(behavior: ScrollBehavior = 'smooth') {
            const $container = this.$refs.container as HTMLElement | undefined;
            $container?.scrollTo({ top: 0, left: 0, behavior });
        },
    },
    render() {
        const children = this.$slots.default;
        const {
            $t: __,
            name,
            title,
            help,
            loading,
            actions,
            centered,
            $scopedSlots: slots,
            hasValidationError,
        } = this;

        const subHeader = ((): JSX.Element | null => {
            const renderSubHeaderContent = (): JSX.Node => {
                const helpContent = ((): JSX.Element | null => {
                    if (!hasValidationError && !help) {
                        return null;
                    }

                    if (hasValidationError) {
                        return (
                            <Alert type="error">
                                {__('errors.validation')}
                            </Alert>
                        );
                    }

                    return <p class="Page__header__sub__help">{help}</p>;
                })();
                const customContent = slots.headerContent?.(undefined) ?? null;
                if (helpContent === null && customContent === null) {
                    return null;
                }

                return (
                    <div class="Page__header__sub__content">
                        {helpContent}
                        {customContent !== null && (
                            <div class="Page__header__sub__content__custom">
                                {customContent}
                            </div>
                        )}
                    </div>
                );
            };

            const headerContent = renderSubHeaderContent();
            return headerContent === null ? null : (
                <div class="Page__header__sub">
                    {headerContent}
                </div>
            );
        })();

        const className = ['Page', `Page--${name}`, {
            'Page--centered': centered,
        }];

        return (
            <div class={className} ref="container">
                <div class="Page__header">
                    <Header
                        title={title}
                        actions={actions}
                        showLoading={loading}
                    />
                    {subHeader}
                </div>
                <div class="Page__body" key="body">
                    {children}
                </div>
            </div>
        );
    },
});

export default Page;
