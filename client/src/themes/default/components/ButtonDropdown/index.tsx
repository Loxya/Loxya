import './index.scss';
import invariant from 'invariant';
import { defineComponent } from 'vue';
import ClickOutside from 'vue-click-outside';
import { MountingPortal as Portal } from 'portal-vue';
import {
    offset,
    autoUpdate,
    autoPlacement,
    computePosition,
} from '@floating-ui/dom';
import Icon from '@/themes/default/components/Icon';
import Button, { TYPES } from '@/themes/default/components/Button';
import Transition from './components/Transition';

import type { PropType } from 'vue';
import type { RawLocation } from 'vue-router';
import type { Type } from '@/themes/default/components/Button';
import type { Props as IconProps } from '@/themes/default/components/Icon';

type Action = {
    /** Le contenu à afficher dans le bouton d'action secondaire. */
    label: string,

    /** Le type de bouton d'action secondaire à utiliser. */
    type?: Type,

    /**
     * Si l'action secondaire est un lien, la cible du lien sous forme de chaîne,
     * ou d'objet `Location` compatible avec Vue-Router.
     *
     * Si non définie, un élément HTML `<button>` sera utilisé et
     * vous devriez écouter l'événement `onClick` pour réagir au click.
     */
    target?: RawLocation,

    /**
     * Si l'action secondaire est un lien, permet d'indiquer que c'est un lien externe.
     *
     * Si c'est le cas, le fonctionnement sera le suivant :
     * - Le routing interne ("Vue Router"), ne sera pas utilisé.
     *   (Il ne faut donc pas passer d'objet à `target` mais bien une chaîne)
     * - Si c'est une URL absolue, celle-ci s'ouvrira dans une autre fenêtre / onglet.
     */
    external?: boolean,

    /**
     * Si l'action secondaire est un lien, permet d'indiquer qu'il s'agit d'un fichier à télécharger.
     *
     * Si oui, alors cela forcera `external` à `true`.
     */
    download?: boolean,

    /**
     * L'éventuel icône à utiliser avant le texte de l'action secondaire.
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
     * Action supplémentaire éventuelle, qui sera affichée sur la même ligne
     * que l'action secondaire, à droite.
     */
    secondary?: Action,

    /**
     * Fonction appelée lors d'un clic sur le bouton d'action secondaire.
     *
     * @param event - L'événement d'origine.
     */
    onClick?(event: MouseEvent): void,
};

type Props = {
    /**
     * Le type (= variante) du bouton dropdown.
     *
     * Voir {@link TYPES} pour les types acceptés.
     *
     * @default 'default'
     */
    type?: Type,

    /** Le contenu à afficher dans le bouton principal. */
    label: string,

    /**
     * Si le bouton principal est un lien, la cible du lien sous forme de chaîne,
     * ou d'objet `Location` compatible avec Vue-Router.
     *
     * Si non définie, un élément HTML `<button>` sera utilisé et
     * vous devriez écouter l'événement `onClick` pour réagir au click.
     */
    to?: RawLocation,

    /**
     * Si le bouton principal est un lien, permet d'indiquer que c'est un lien externe.
     *
     * Si c'est le cas, le component fonctionnera comme suit:
     * - Le routing interne ("Vue Router"), ne sera pas utilisé.
     *   (Il ne faut donc pas passer d'objet à `to` mais bien une chaîne)
     * - Si c'est une URL absolue, celle-ci s'ouvrira dans une autre fenêtre / onglet.
     */
    external?: boolean,

    /**
     * Si le bouton principal est un lien, permet d'indiquer qu'il s'agit d'un fichier à télécharger.
     *
     * Si oui, alors cela forcera `external` à `true`.
     *
     * @default false
     */
    download?: boolean,

    /**
     * L'éventuel icône à utiliser avant le texte du bouton principal.
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
     * Permet d'indiquer si le bouton principal et les actions secondaires sont désactivés.
     *
     * Si c'est le cas (true), le bouton principal et toutes les actions secondaires seront
     * affichés grisés et ne seront pas cliquables.
     *
     * @default false
     */
    disabled?: boolean,

    /**
     * Un tableau d'objets décrivant toutes les actions présentes dans le dropdown.
     *
     * Voir le type {@link Action} pour plus de détails.
     */
    actions: Action[],
};

type InstanceProperties = {
    cancelMenuPositionUpdater: (() => void) | undefined,
};

type Data = {
    isOpen: boolean,
    menuPosition: Position,
};

/**
 * Bouton avec sous-actions.
 *
 * Affiche un bouton qui permet de déclencher une action principale, et un menu
 * déroulant contenant des actions secondaires.
 *
 * Le bouton principal peut être soit un lien (externe ou non), soit un button.
 * Dans le premier cas, il faut passer les props `to` et éventuellement `external`
 * ou `download, et dans le second cas il suffit d'utiliser l'événement `onClick`.
 *
 * Pour les actions secondaires, chaque item de la liste `actions` doit être du
 * type `Action` (voir documentation).
 */
const ButtonDropdown = defineComponent({
    name: 'ButtonDropdown',
    directives: { ClickOutside },
    props: {
        type: {
            type: String as PropType<Required<Props>['type']>,
            default: 'default',
            validator: (value: unknown) => (
                typeof value === 'string' &&
                TYPES.includes(value as any)
            ),
        },
        label: {
            type: String as PropType<Props['label']>,
            required: true,
        },
        to: {
            type: [String, Object] as PropType<Props['to']>,
            default: undefined,
        },
        external: {
            type: Boolean as PropType<Props['external']>,
            default: undefined,
        },
        download: {
            type: Boolean as PropType<Required<Props>['download']>,
            default: false,
        },
        icon: {
            type: String as PropType<Props['icon']>,
            default: undefined,
        },
        disabled: {
            type: Boolean as PropType<Required<Props>['disabled']>,
            default: false,
        },
        actions: {
            type: Array as PropType<Props['actions']>,
            required: true,
            validator: (values: unknown) => (
                Array.isArray(values) && values.length > 0
            ),
        },
    },
    setup(props): InstanceProperties {
        invariant(
            !props.download || !props.external,
            'The `external` prop. must not be set when the `download` prop. is true.',
        );
        invariant(
            (!props.download && !props.external) || typeof props.to === 'string',
            'The `to` props. must be a string when the props `download` or `external` are used.',
        );
        props.actions.forEach((action: Action) => {
            invariant(
                !action.external || typeof action.target === 'string',
                `The action's \`target\` prop. must be a string when the prop. \`external\` is used.`,
            );
        });

        return {
            cancelMenuPositionUpdater: undefined,
        };
    },
    data: (): Data => ({
        isOpen: false,
        menuPosition: { x: 0, y: 0 },
    }),
    computed: {
        inheritedExternal(): boolean | undefined {
            if (this.download) {
                return undefined;
            }

            return this.external ?? false;
        },
    },
    mounted() {
        this.registerMenuPositionUpdater();
    },
    updated() {
        this.registerMenuPositionUpdater();
    },
    beforeDestroy() {
        this.cleanupMenuPositionUpdater();
    },
    methods: {
        // ------------------------------------------------------
        // -
        // -    Handlers
        // -
        // ------------------------------------------------------

        handleClickMain() {
            if (this.disabled) {
                return;
            }
            this.isOpen = false;
        },

        handleToggle() {
            if (this.disabled) {
                return;
            }
            this.isOpen = !this.isOpen;
        },

        handleClickOutside(e: Event) {
            // - Si c'est un click dans le dropdown, on ne fait rien.
            const $menu = this.$refs.menu as HTMLElement | undefined;
            if (e.target !== null && $menu?.contains(e.target as Node)) {
                return;
            }
            this.isOpen = false;
        },

        handleClickMenu() {
            this.isOpen = false;
        },

        // ------------------------------------------------------
        // -
        // -    Méthodes internes
        // -
        // ------------------------------------------------------

        async updateMenuPosition(): Promise<void> {
            const $button = this.$refs.button as HTMLElement | undefined;
            const $menu = this.$refs.menu as HTMLElement | undefined;

            if (!this.isOpen || !$button || !$menu) {
                return;
            }

            const oldPosition = { ...this.menuPosition };
            const newPosition = await computePosition($button, $menu, {
                placement: 'bottom-end',
                middleware: [
                    autoPlacement({
                        alignment: 'end',
                        allowedPlacements: [
                            'bottom-start',
                            'bottom-end',
                            'top-start',
                            'top-end',
                        ],
                    }),
                    offset(6),
                ],
            });

            if (newPosition.x === oldPosition.x && newPosition.y === oldPosition.y) {
                return;
            }

            this.menuPosition = { x: newPosition.x, y: newPosition.y };
        },

        cleanupMenuPositionUpdater() {
            if (typeof this.cancelMenuPositionUpdater === 'function') {
                this.cancelMenuPositionUpdater();
                this.cancelMenuPositionUpdater = undefined;
            }
        },

        registerMenuPositionUpdater() {
            this.cleanupMenuPositionUpdater();

            const $button = this.$refs.button as HTMLElement | undefined;
            const $menu = this.$refs.menu as HTMLElement | undefined;
            if ($button && $menu) {
                this.cancelMenuPositionUpdater = autoUpdate(
                    $button,
                    $menu,
                    this.updateMenuPosition.bind(this),
                );
            }
        },
    },
    render() {
        const {
            isOpen,
            disabled,
            menuPosition,
            icon,
            type,
            label,
            to,
            inheritedExternal,
            download,
            handleToggle,
            handleClickMain,
            handleClickOutside,
            handleClickMenu,
            actions,
        } = this;

        const classNames = ['ButtonDropdown', {
            'ButtonDropdown--open': isOpen,
        }];

        return (
            <div class={classNames} v-clickOutside={handleClickOutside}>
                <div ref="button" class="ButtonDropdown__button">
                    <Button
                        to={to}
                        icon={icon}
                        type={type}
                        external={inheritedExternal}
                        download={download}
                        onClick={handleClickMain}
                        disabled={disabled}
                        class="ButtonDropdown__button__main"
                    >
                        {label}
                    </Button>
                    <Button
                        type={type}
                        onClick={handleToggle}
                        class="ButtonDropdown__button__toggle"
                        disabled={disabled}
                    >
                        <Icon name="ellipsis-h" />
                    </Button>
                </div>
                {isOpen && (
                    <Portal mountTo="#app" transition={Transition} append>
                        <ul
                            ref="menu"
                            class="ButtonDropdown__menu"
                            onClick={handleClickMenu}
                            style={{
                                left: `${menuPosition.x}px`,
                                top: `${menuPosition.y}px`,
                            }}
                        >
                            {actions.map((action: Action) => (
                                <li class="ButtonDropdown__menu__item" key={action.label}>
                                    <Button
                                        type={action.type}
                                        to={action.target}
                                        icon={action.icon}
                                        download={action.download}
                                        external={action.external}
                                        onClick={action.onClick ?? (() => {})}
                                        disabled={disabled}
                                        class={[
                                            'ButtonDropdown__action-button',
                                            { 'ButtonDropdown__action-button--primary': !!action.secondary },
                                        ]}
                                    >
                                        {action.label}
                                    </Button>
                                    {!!action.secondary && (
                                        <Button
                                            class={[
                                                'ButtonDropdown__action-button',
                                                'ButtonDropdown__action-button--secondary',
                                            ]}
                                            type={action.secondary.type}
                                            to={action.secondary.target}
                                            icon={action.secondary.icon}
                                            download={action.secondary.download}
                                            external={action.secondary.external}
                                            onClick={action.secondary.onClick ?? (() => {})}
                                            tooltip={action.secondary.label}
                                            disabled={disabled}
                                        />
                                    )}
                                </li>
                            ))}
                        </ul>
                    </Portal>
                )}
            </div>
        );
    },
});

export default ButtonDropdown;
