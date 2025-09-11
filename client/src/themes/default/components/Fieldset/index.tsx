import './index.scss';
import { defineComponent } from 'vue';

import type { PropType } from 'vue';

export type Props = {
    /** Le titre du groupe de champs. */
    title?: string,

    /** Un éventuel message d'aide pour le groupe de champs. */
    help?: string,

    /**
     * Les éventuelles actions contextuelles du groupe de champs.
     * (sous forme de nœuds vue dans un tableau)
     */
    actions?: JSX.Element[],
};

/** Un groupe de champs ou une section de formulaire. */
const Fieldset = defineComponent({
    name: 'Fieldset',
    props: {
        title: {
            type: String as PropType<Props['title']>,
            default: undefined,
        },
        help: {
            type: String as PropType<Props['help']>,
            default: undefined,
        },
        actions: {
            type: Array as PropType<Props['actions']>,
            default: undefined,
        },
    },
    render() {
        const { title, help, actions } = this;
        const children = this.$slots.default;

        const renderHeader = (): JSX.Element | null => {
            const hasActions = actions && actions.length > 0;
            if (!title && !help && !hasActions) {
                return null;
            }

            return (
                <div class="Fieldset__header">
                    <div class="Fieldset__header__main">
                        {title && <h3 class="Fieldset__header__title">{title}</h3>}
                        {hasActions && (
                            <nav class="Fieldset__header__actions">
                                {actions}
                            </nav>
                        )}
                    </div>
                    {help && <p class="Fieldset__header__help">{help}</p>}
                </div>
            );
        };

        return (
            <section class="Fieldset">
                {renderHeader()}
                <div class="Fieldset__body">
                    {children}
                </div>
            </section>
        );
    },
});

export default Fieldset;
