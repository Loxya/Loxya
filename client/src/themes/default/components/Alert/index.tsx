import './index.scss';
import Button from '@/themes/default/components/Button';
import { defineComponent } from 'vue';

import type { RawLocation } from 'vue-router';
import type { PropType } from 'vue';
import type { Props as IconProps } from '@/themes/default/components/Icon';

export enum Type {
    /** Une erreur. */
    ERROR = 'error',

    /** Une alerte d'avertissement. */
    WARNING = 'warning',

    /** Une alerte d'information. */
    INFO = 'info',
}

export type Action = {
    /** Le contenu à afficher dans le bouton d'action. */
    label: string,

    /**
     * Si l'action est un lien, la cible du lien sous forme de chaîne,
     * ou d'objet `Location` compatible avec Vue-Router.
     *
     * Si non définie, un élément HTML `<button>` sera utilisé et
     * vous devriez écouter l'événement `onClick` pour réagir au click.
     */
    target?: RawLocation,

    /**
     * Si l'action est un lien, permet d'indiquer que c'est un lien externe.
     *
     * Si c'est le cas, le fonctionnement sera le suivant :
     * - Le routing interne ("Vue Router"), ne sera pas utilisé.
     *   (Il ne faut donc pas passer d'objet à `target` mais bien une chaîne)
     * - Si c'est une URL absolue, celle-ci s'ouvrira dans une autre fenêtre / onglet.
     */
    external?: boolean,

    /**
     * L'éventuel icône à utiliser avant le texte de l'action.
     *
     * Doit contenir une chaîne de caractère avec les composantes suivantes séparées par `:` :
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
     * Fonction appelée lorsque le bouton d'action est cliqué.
     *
     * N'est utile que quand l'action n'est pas un lien.
     *
     * @param event - L'événement d'origine.
     */
    onClick?(event: MouseEvent): void,
};

type Props = {
    /** Le type (= variante) de l'alerte. */
    type: Type | `${Type}`,

    /** Une action éventuelle (= un bouton) affiché au bout de l'alerte. */
    action?: Action,

    /**
     * L'alerte peut-elle être "cachée" ?
     *
     * @default false
     */
    dismissible?: boolean,
};

type Data = {
    dismissed: boolean,
};

/** Une alerte. */
const Alert = defineComponent({
    name: 'Alert',
    props: {
        type: {
            type: String as PropType<Props['type']>,
            required: true,
            validator: (value: unknown) => (
                typeof value === 'string' &&
                (Object.values(Type) as string[]).includes(value)
            ),
        },
        action: {
            type: Object as PropType<Props['action']>,
            default: undefined,
        },
        dismissible: {
            type: Boolean as PropType<Props['dismissible']>,
            default: false,
        },
    },
    data: (): Data => ({
        dismissed: false,
    }),
    methods: {
        handleDismiss() {
            this.dismissed = true;
        },
    },
    render() {
        const { type, action, dismissible, dismissed, handleDismiss } = this;
        const hasActions = action !== undefined || dismissible;
        const children = this.$slots.default;

        if (dismissed) {
            return null;
        }

        const classNames = ['Alert', `Alert--${type}`, {
            'Alert--with-actions': hasActions,
        }];

        return (
            <div class={classNames}>
                <span class="Alert__text">
                    {children}
                </span>
                {hasActions && (
                    <div class="Alert__actions">
                        {action !== undefined && (
                            <Button
                                to={action.target}
                                icon={action.icon}
                                external={action.external}
                                onClick={action.onClick ?? (() => {})}
                                class="Alert__action"
                            >
                                {action.label}
                            </Button>
                        )}
                        {dismissible && (
                            <Button
                                type="close"
                                onClick={handleDismiss}
                            />
                        )}
                    </div>
                )}
            </div>
        );
    },
});

export default Alert;
