import { defineComponent } from 'vue';
import StateMessage, { State } from '@/themes/default/components/StateMessage';

import type { PropType } from 'vue';
import type { Action } from '@/themes/default/components/StateMessage';

/** Les variantes d'état possibles pour le {@link EmptyMessage}. */
export enum Variant {
    /** Aucun enregistrement dans la source de données. */
    EMPTY = 'empty',

    /** Aucun résultat ne correspond à une recherche / des filtres actifs. */
    NO_RESULTS = 'no-results',
}

type Props = {
    /**
     * Permet de customiser le message affiché pour
     * signifier l'absence de données.
     */
    message?: string,

    /**
     * Variante de l'état à représenter.
     *
     * Voir {@link Variant}.
     */
    variant?: Variant | `${Variant}`,

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
        variant: {
            type: String as PropType<Required<Props>['variant']>,
            default: Variant.EMPTY,
            validator: (value: unknown) => (
                typeof value === 'string' &&
                (Object.values(Variant) as string[]).includes(value)
            ),
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
        const { $t: __, size, variant, message, action } = this;

        const type = variant === Variant.NO_RESULTS
            ? State.NO_RESULT
            : State.EMPTY;

        const defaultMessage = variant === Variant.NO_RESULTS
            ? __('no-results-state')
            : __('empty-state');

        return (
            <StateMessage
                type={type}
                size={size}
                message={message ?? defaultMessage}
                action={action}
            />
        );
    },
});

export type { Action, Action as EmptyMessageAction };

export { Variant as EmptyMessageVariant };
export default EmptyMessage;
