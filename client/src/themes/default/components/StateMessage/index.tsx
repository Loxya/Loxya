import './index.scss';
import { defineComponent } from 'vue';
import Button from '@/themes/default/components/Button';

// - Illustrations
import SearchIllustration from './illustrations/search.svg?inline';
import GeneralIllustration from './illustrations/general.svg?inline';
import TimeIllustration from './illustrations/time.svg?inline';
import EmptyIllustration from './illustrations/empty.svg?inline';
import LockedIllustration from './illustrations/locked.svg?inline';

import type { PropType } from 'vue';
import type { Location } from 'vue-router';
import type { Type as ButtonType } from '@/themes/default/components/Button';
import type { Props as IconProps } from '@/themes/default/components/Icon';

export enum State {
    /**
     * État "vide".
     * (e.g. Pas de contenu, liste vide, ...).
     */
    EMPTY = 'empty',

    /**
     * État "non trouvé".
     * (e.g. Erreur 404, ...).
     */
    NOT_FOUND = 'not-found',

    /**
     * État "rien à faire" / "déjà propre".
     * (e.g. aucun action disponible, rien à synchroniser)
     */
    NOTHING_TO_DO = 'nothing-to-do',

    /**
     * État "pas de résultat".
     * (e.g. Recherche infructueuse, ...).
     */
    NO_RESULT = 'no-result',

    /**
     * État "trop tôt".
     * (e.g. Pas encore possible d'effectuer telle action, ...).
     */
    TOO_SOON = 'too-soon',

    /**
     * État "trop tard".
     * (e.g. Plus possible d'effectuer telle action, ...).
     */
    TOO_LATE = 'too-late',

    /**
     * État "verrouillé".
     * (e.g. Pas la main sur l'entité, L'entité est archivée, ...).
     */
    LOCKED = 'locked',
}

const ILLUSTRATIONS = {
    [State.EMPTY]: EmptyIllustration,
    [State.NOT_FOUND]: GeneralIllustration,
    [State.NOTHING_TO_DO]: GeneralIllustration,
    [State.NO_RESULT]: SearchIllustration,
    [State.TOO_SOON]: TimeIllustration,
    [State.TOO_LATE]: TimeIllustration,
    [State.LOCKED]: LockedIllustration,
} as const;

export type Action = {
    /** Le contenu à afficher dans le bouton d'action. */
    label: string,

    /** Le type de bouton d'action à utiliser. */
    type?: ButtonType,

    /**
     * L'éventuel icône à utiliser avant le texte de l'action.
     *
     * Doit contenir une chaîne de caractère avec les composantes suivantes séparées par `:`:
     * - Le nom de l'icône sous forme de chaîne (e.g. `plus`, `wrench`)
     *   Pour une liste exhaustive des codes, voir: https://fontawesome.com/v5.15/icons?m=free
     * - La variante à utiliser de l'icône à utiliser (`solid`, `regular`, ...).
     *
     * @example
     * - `wrench`
     * - `wrench:solid`
     */
    icon?: string | `${string}:${Required<IconProps>['variant']}`,

    /**
     * Si l'action est un lien, la cible du lien sous forme de chaîne,
     * ou d'objet `Location` compatible avec Vue-Router.
     *
     * Si non définie, un élément HTML `<button>` sera utilisé et
     * vous devriez écouter l'événement `onClick` pour réagir au click.
     */
    target?: string | Location,

    /**
     * Si l'action secondaire est un lien, permet d'indiquer que c'est un lien externe.
     *
     * Si c'est le cas, le fonctionnement sera le suivant:
     * - Le routing interne ("Vue Router"), ne sera pas utilisé.
     *   (Il ne faut donc pas passer d'objet à `target` mais bien une chaîne)
     * - Si c'est une URL absolue, celle-ci s'ouvrira dans une autre fenêtre / onglet.
     */
    external?: boolean,

    /**
     * Fonction appelée lorsque le bouton d'action est cliqué.
     *
     * N'est utile que quand l'action n'est pas un lien.
     *
     * @param event - L'événement d'origine.
     */
    onClick?(e: MouseEvent): void,
};

type Props = {
    /**
     * Le type d'état.
     *
     * Si cette prop. n'est pas définie, une illustration généraliste sera utilisée.
     */
    type: State | `${State}`,

    /** Le message d'état à afficher. */
    message: string,

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
 * Un élément d'interface permettant d'indiquer un état.
 * (que ce soit dans une liste, une page, ou autre)
 */
const StateMessage = defineComponent({
    name: 'StateMessage',
    props: {
        type: {
            type: String as PropType<Required<Props>['type']>,
            required: true,
            validator: (value: unknown) => (
                typeof value === 'string' &&
                (Object.values(State) as string[]).includes(value)
            ),
        },
        message: {
            type: String as PropType<Props['message']>,
            required: true,
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
        const { message, size, action } = this;
        const Illustration = ILLUSTRATIONS[this.type];

        const renderAction = (): JSX.Element | null => {
            if (!action) {
                return null;
            }
            const {
                icon,
                label,
                target,
                type,
                external = false,
                onClick,
            } = action;

            return (
                <Button
                    size={size}
                    icon={icon}
                    type={type}
                    to={target}
                    external={external}
                    onClick={onClick ?? (() => {})}
                    class="StateMessage__action"
                >
                    {label}
                </Button>
            );
        };

        return (
            <div class={['StateMessage', `StateMessage--${size}`]}>
                <Illustration class="StateMessage__illustration" />
                <p class="StateMessage__message">{message}</p>
                {renderAction()}
            </div>
        );
    },
});

export default StateMessage;
