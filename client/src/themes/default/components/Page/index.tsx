import './index.scss';
import { defineComponent } from 'vue';

import type { PropType } from 'vue';

export type Props = {
    /** Le nom unique de la page. */
    name: string,

    /**
     * L'éventuel titre de la page.
     *
     * Celui-ci sera utilisé dans le header de l'application
     * ainsi que dans le `<title></title>` du document.
     */
    title?: string,

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

/** Une page. */
const Page = defineComponent({
    name: 'Page',
    inject: [
        'setGlobalLoading',
    ],
    props: {
        name: {
            type: String as PropType<Props['name']>,
            required: true,
        },
        title: {
            type: String as PropType<Props['title']>,
            default: undefined,
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
    watch: {
        title(newTitle: Props['title']) {
            this.updateTitle(newTitle);
        },

        loading: {
            handler(isLoading: boolean) {
                this.setLoading(isLoading);
            },
            immediate: true,
        },
    },
    mounted() {
        this.updateTitle(this.title);
    },
    beforeDestroy() {
        this.updateTitle(undefined);
        this.setLoading(false);
    },
    methods: {
        updateTitle(newTitle: string | undefined) {
            this.$store.commit('setPageRawTitle', newTitle ?? null);
            document.title = [newTitle, 'Loxya'].filter(Boolean).join(' - ');
        },

        setLoading(isLoading: boolean) {
            // @ts-expect-error -- Normalement corrigé lors du passage à Vue 3 (et son meilleur typage).
            // @see https://github.com/vuejs/core/pull/6804
            this.setGlobalLoading(isLoading);
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
            help,
            actions,
            centered,
            $scopedSlots: slots,
            hasValidationError,
        } = this;

        const renderHelp = (): JSX.Element | null => {
            if (!hasValidationError && !help) {
                return null;
            }

            return (
                <p
                    class={['Page__header__help', {
                        'Page__header__help--error': hasValidationError,
                    }]}
                >
                    {hasValidationError ? __('errors.validation') : help}
                </p>
            );
        };

        const renderHeader = (): JSX.Element | null => {
            const renderHeaderContent = (): JSX.Node => {
                const helpContent = renderHelp();
                const customContent = slots.headerContent?.(undefined) ?? null;
                if (helpContent === null && customContent === null) {
                    return null;
                }

                return (
                    <div class="Page__header__content">
                        {helpContent}
                        {customContent !== null && (
                            <div class="Page__header__content__custom">
                                {customContent}
                            </div>
                        )}
                    </div>
                );
            };

            const headerContent = renderHeaderContent();
            const hasActions = actions && actions.length > 0;
            if (headerContent === null && !hasActions) {
                return null;
            }

            return (
                <div class="Page__header">
                    {headerContent}
                    {hasActions && (
                        <nav class="Page__header__actions" key="header-actions">
                            {actions}
                        </nav>
                    )}
                </div>
            );
        };

        const className = ['Page', `Page--${name}`, {
            'Page--centered': centered,
        }];

        return (
            <div class={className} ref="container">
                {renderHeader()}
                <div class="Page__body" key="body">
                    {children}
                </div>
            </div>
        );
    },
});

export default Page;
