import './index.scss';
import { defineComponent } from 'vue';
import ClickOutside from 'vue-click-outside';
import { MountingPortal as Portal } from 'portal-vue';
import Button, { TYPES } from '@/themes/default/components/Button';
import Transition from './components/Transition';
import {
    computePosition,
    autoPlacement,
    autoUpdate,
    offset,
} from '@floating-ui/dom';

import type { PropType } from 'vue';
import type { Type, IconLoose } from '@/themes/default/components/Button';

type IconLooseStates = { opened: IconLoose, closed: IconLoose };

type Props = {
    /**
     * L'icône (ou les icônes) à utiliser pour le bouton dropdown.
     *
     * Peut contenir une chaîne de caractère avec les composantes suivantes séparées par `:`:
     * - Le nom de l'icône sous forme de chaîne (e.g. `plus`, `wrench`)
     *   Pour une liste exhaustive des codes, voir: https://fontawesome.com/v5.15/icons?m=free
     * - La variante à utiliser de l'icône à utiliser (`solid`, `regular`, ...).
     *
     * Ou bien un objet littéral contenant les clés:
     * - `name`: Le nom de l'icône sous forme de chaîne de caractère.
     *           Sa prise en charge est équivalente à ce qui est décrit ci-dessus.
     * - `position`: La position de l'icône dans le bouton: `before` ou `after`.
     *
     * Si vous voulez utiliser des icônes différentes quand le dropdown est ouvert / fermé,
     * vous pouvez passer deux icônes différentes (suivant les spécifications ci-dessus)
     * dans un object content les clés `opened` (= lorsque le dropdown est ouvert) et
     * `closed` (= lorsqu'il est fermé).
     *
     * @default
     * - Si aucun libellé n'est passé: `ellipsis-h`.
     * - Sinon, un chevron sera affiché après le libellé.
     *   (vers le haut quand ouvert, bas quand fermé)
     *
     * @example
     * - `ellipsis-v`
     * - `ellipsis-v:solid`
     * - `{ name: 'ellipsis-v:solid', position: 'after' }`
     * - `{ opened: 'chevron-up', closed: 'chevron-down' }`
     */
    icon?: IconLoose | IconLooseStates,

    /**
     * Le libellé qui sera utilisé dans le bouton dépliant.
     * Si non spécifié, une icône "trois points" sera utilisée.
     */
    label?: string,

    /**
     * Le type (= variante) du bouton dropdown.
     *
     * Voir {@link TYPES} pour les types acceptés.
     *
     * @default 'default'
     */
    type?: Type,
};

type InstanceProperties = {
    cancelDropdownPositionUpdater: (() => void) | undefined,
};

type Data = {
    isOpen: boolean,
    dropdownPosition: Position,
};

/** Un menu déroulant affichant le contenu fourni. */
const Dropdown = defineComponent({
    name: 'Dropdown',
    directives: { ClickOutside },
    props: {
        icon: {
            type: [String, Object] as PropType<Props['icon']>,
            default: undefined,
        },
        label: {
            type: String as PropType<Props['label']>,
            default: undefined,
        },
        type: {
            type: String as PropType<Required<Props>['type']>,
            default: 'default',
            validator: (value: unknown) => (
                typeof value === 'string' &&
                TYPES.includes(value as any)
            ),
        },
    },
    setup: (): InstanceProperties => ({
        cancelDropdownPositionUpdater: undefined,
    }),
    data: (): Data => ({
        isOpen: false,
        dropdownPosition: { x: 0, y: 0 },
    }),
    computed: {
        inferredIcon(): IconLoose {
            const { isOpen, label, icon: rawIcon } = this;

            const icon = undefined !== rawIcon || undefined === label
                ? (rawIcon ?? 'ellipsis-v')
                : {
                    opened: { position: 'after', name: 'chevron-up' },
                    closed: { position: 'after', name: 'chevron-down' },
                };

            if (typeof icon !== 'object') {
                return icon;
            }

            if ('opened' in icon && 'closed' in icon) {
                return (icon as IconLooseStates)[isOpen ? 'opened' : 'closed'];
            }

            return icon;
        },
    },
    mounted() {
        this.registerDropdownPositionUpdater();
    },
    updated() {
        this.registerDropdownPositionUpdater();
    },
    beforeDestroy() {
        this.cleanupDropdownPositionUpdater();
    },
    methods: {
        // ------------------------------------------------------
        // -
        // -    Handlers
        // -
        // ------------------------------------------------------

        handleToggle() {
            this.isOpen = !this.isOpen;
        },

        handleClickOutside(e: Event) {
            // - Si c'est un click dans le dropdown, on ne fait rien.
            const $dropdown = this.$refs.dropdown as HTMLElement | undefined;
            if (e.target !== null && $dropdown?.contains(e.target as Node)) {
                return;
            }
            this.isOpen = false;
        },

        handleClickDropdown() {
            this.isOpen = false;
        },

        // ------------------------------------------------------
        // -
        // -    Méthodes internes
        // -
        // ------------------------------------------------------

        async updateDropdownPosition(): Promise<void> {
            const $button = this.$refs.button as HTMLElement;
            const $dropdown = this.$refs.dropdown as HTMLElement | undefined;

            if (!this.isOpen || !$dropdown) {
                return;
            }

            const oldPosition = { ...this.dropdownPosition };
            const newPosition = await computePosition($button, $dropdown, {
                placement: 'bottom',
                middleware: [
                    autoPlacement({
                        alignment: 'end',
                        allowedPlacements: ['bottom-start', 'bottom-end'],
                    }),
                    offset(10),
                ],
            });

            if (newPosition.x === oldPosition.x && newPosition.y === oldPosition.y) {
                return;
            }

            this.dropdownPosition = { x: newPosition.x, y: newPosition.y };
        },

        cleanupDropdownPositionUpdater() {
            if (typeof this.cancelDropdownPositionUpdater === 'function') {
                this.cancelDropdownPositionUpdater();
                this.cancelDropdownPositionUpdater = undefined;
            }
        },

        registerDropdownPositionUpdater() {
            this.cleanupDropdownPositionUpdater();

            const $button = this.$refs.button as HTMLElement | undefined;
            const $dropdown = this.$refs.dropdown as HTMLElement | undefined;
            if ($button && $dropdown) {
                this.cleanupDropdownPositionUpdater = autoUpdate(
                    $button,
                    $dropdown,
                    this.updateDropdownPosition.bind(this),
                );
            }
        },
    },
    render() {
        const children = this.$slots.default;
        const {
            type,
            label,
            inferredIcon: icon,
            dropdownPosition,
            isOpen,
            handleToggle,
            handleClickOutside,
            handleClickDropdown,
        } = this;

        const classNames = ['Dropdown', {
            'Dropdown--open': isOpen,
        }];

        return (
            <div ref="container" class={classNames} v-clickOutside={handleClickOutside}>
                <div ref="button" class="Dropdown__button">
                    <Button icon={icon} type={type} onClick={handleToggle}>
                        {label}
                    </Button>
                </div>
                {isOpen && (
                    <Portal mountTo="#app" transition={Transition} append>
                        <div
                            ref="dropdown"
                            class="Dropdown__menu"
                            onClick={handleClickDropdown}
                            style={{
                                left: `${dropdownPosition.x}px`,
                                top: `${dropdownPosition.y}px`,
                            }}
                        >
                            {children}
                        </div>
                    </Portal>
                )}
            </div>
        );
    },
});

export default Dropdown;
