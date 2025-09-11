import './index.scss';
import { defineComponent } from 'vue';
import IconMessage from '@/themes/default/components/IconMessage';

import type { PropType } from 'vue';

type Props = {
    /** Le titre de la sous-page. */
    title: string,

    /** Une éventuelle "aide" / un sous-titre pour la sous-page. */
    help?: string,

    /** Permet de centrer le contenu de la sous-page. */
    centered?: boolean,

    /**
     * La page contient t'elle actuellement des erreurs de validation ?
     *
     * Ceci permettra d'afficher une alerte spécifique en haut de la page.
     */
    hasValidationError?: boolean,

    /**
     * Les éventuelles actions contextuelles de la page.
     * (sous forme de nœuds vue dans un tableau)
     */
    actions?: JSX.Element[],
};

/** Sous-page des paramètres globaux. */
const GlobalSettingsSubPage = defineComponent({
    name: 'GlobalSettingsSubPage',
    props: {
        title: {
            type: String as PropType<Props['title']>,
            required: true,
        },
        help: {
            type: String as PropType<Props['help']>,
            default: undefined,
        },
        centered: {
            type: Boolean as PropType<Required<Props>['centered']>,
            default: false,
        },
        hasValidationError: {
            type: Boolean as PropType<Required<Props>['hasValidationError']>,
            default: false,
        },
        actions: {
            type: Array as PropType<Props['actions']>,
            default: undefined,
        },
    },
    computed: {
        hasActions(): boolean {
            const { actions } = this;
            return !!actions && actions.length > 0;
        },
    },
    render() {
        const children = this.$slots.default;
        const { $t: __, title, help, centered, actions, hasActions, hasValidationError } = this;

        const className = ['GlobalSettingsSubPage', {
            'GlobalSettingsSubPage--centered': centered,
        }];

        return (
            <div class={className}>
                <header class="GlobalSettingsSubPage__header">
                    <div class="GlobalSettingsSubPage__header__main">
                        <h2 class="GlobalSettingsSubPage__header__title">{title}</h2>
                        {!!help && <span class="GlobalSettingsSubPage__header__sub-title">{help}</span>}
                    </div>
                    {hasActions && (
                        <nav class="GlobalSettingsSubPage__header__actions">
                            {actions}
                        </nav>
                    )}
                </header>
                <div class="GlobalSettingsSubPage__body__content">
                    {hasValidationError && (
                        <p class="GlobalSettingsSubPage__body__error">
                            <IconMessage
                                name="exclamation-triangle"
                                message={__('errors.validation')}
                            />
                        </p>
                    )}
                    <div class="GlobalSettingsSubPage__body__content">
                        {children}
                    </div>
                </div>
            </div>
        );
    },
});

export default GlobalSettingsSubPage;
