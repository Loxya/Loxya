import { defineComponent } from 'vue';
import StateMessage, { State } from '@/themes/default/components/StateMessage';

import type { PropType } from 'vue';
import type { Action } from '@/themes/default/components/StateMessage';

type Props = {
    /**
     * Permet de customiser le message affiché pour
     * signifier l'absence de données.
     */
    message?: string,

    /**
     * La taille globale du block.
     *
     * Variantes disponibles:
     * - `normal`: Typiquement à utiliser comme message global de page.
     * - `small`: Pour des zones plus petites, comme le contenu d'un tableau.
     */
    size?: 'small' | 'normal',

    /**
     * Une éventuelle action à afficher en dessous du message.
     *
     * Celle-ci doit être passée sous forme d'un objet.
     * Voir le type {@link Action} pour plus de détails.
     */
    action?: Action,
};

/**
 * Un élément d'interface permettant d'indiquer l'absence de données.
 * (que ce soit dans une liste, une page, ou autre)
 */
const EmptyMessage = defineComponent({
    name: 'EmptyMessage',
    props: {
        message: {
            type: String as PropType<Props['message']>,
            default: undefined,
        },
        size: {
            type: String as PropType<Required<Props>['size']>,
            default: 'normal',
            validator: (value: unknown) => (
                typeof value === 'string' &&
                ['small', 'normal'].includes(value)
            ),
        },
        action: {
            type: Object as PropType<Props['action']>,
            default: undefined,
        },
    },
    render() {
        const { $t: __, size, message, action } = this;

        return (
            <StateMessage
                type={State.EMPTY}
                size={size}
                message={message ?? __('empty-state')}
                action={action}
            />
        );
    },
});

export default EmptyMessage;
