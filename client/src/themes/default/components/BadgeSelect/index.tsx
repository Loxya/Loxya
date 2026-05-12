import './index.scss';
import { defineComponent } from 'vue';
import ClickOutside from 'vue-click-outside';
import { MountingPortal as Portal } from 'portal-vue';
import {
    offset,
    autoUpdate,
    autoPlacement,
    computePosition,
} from '@floating-ui/dom';

import type { ComponentRef, PropType } from 'vue';
import type { Options, Option } from './_types';

type Props<V extends string | number = string | number> = {
    /** Valeur actuellement sélectionnée. */
    value: V,

    /**
     * Les options disponibles.
     *
     * Doit être fournie sous forme de tableau d'objet (Une option = Un objet).
     * Voir le type {@link Option} pour plus de détails sur le format de chaque option.
     */
    options: Options<V>,

    /**
     * Le champ est-t'il en désactivé ?
     *
     * @default false
     */
    disabled?: boolean,

    /**
     * Le champ est-t'il en lecture seule ?
     *
     * @default false
     */
    readonly?: boolean,

    /**
     * Fonction appelée lorsque la valeur change.
     *
     * @param newValue - La nouvelle valeur sélectionnée.
     */
    onChange?(newValue: V): void,
};

type InstanceProperties = {
    cancelDropdownPositionUpdater: (() => void) | undefined,
};

type Data = {
    isDropdownOpen: boolean,
    dropdownPosition: Position,
};

/** Un sélecteur de statut avec l'apparence d'un label. */
const BadgeSelect = defineComponent({
    name: 'BadgeSelect',
    directives: { ClickOutside },
    props: {
        value: {
            type: String as PropType<Props['value']>,
            required: true,
        },
        options: {
            type: Array as PropType<Props['options']>,
            required: true,
            validator: (value: unknown) => (
                Array.isArray(value) &&
                value.length > 0
            ),
        },
        disabled: {
            type: Boolean as PropType<Required<Props>['disabled']>,
            default: false,
        },
        readonly: {
            type: Boolean as PropType<Required<Props>['readonly']>,
            default: false,
        },
        // eslint-disable-next-line vue/no-unused-properties
        onChange: {
            type: Function as PropType<Props['onChange']>,
            default: undefined,
        },
    },
    emits: ['change'],
    setup: (): InstanceProperties => ({
        cancelDropdownPositionUpdater: undefined,
    }),
    data: (): Data => ({
        isDropdownOpen: false,
        dropdownPosition: { x: 0, y: 0 },
    }),
    computed: {
        isEditable(): boolean {
            return !this.disabled && !this.readonly;
        },

        selectedOption(): Option | undefined {
            return this.options.find((option) => (
                option.value === this.value
            ));
        },

        selectableOptions(): Options {
            return this.options.filter((option) => (
                option !== this.selectedOption &&
                (option.selectable ?? true)
            ));
        },
    },
    watch: {
        isEditable(isEditable: boolean) {
            if (!isEditable) {
                this.isDropdownOpen = false;
            }
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

        handleClickOutside(e: Event) {
            // - Si c'est un click dans le dropdown, on ne fait rien.
            const $dropdown = this.$refs.dropdown as HTMLElement | undefined;
            if (e.target !== null && $dropdown?.contains(e.target as Node)) {
                return;
            }
            this.isDropdownOpen = false;
        },

        handleToggleDropdown() {
            if (!this.isEditable) {
                return;
            }
            this.isDropdownOpen = !this.isDropdownOpen;
        },

        handleSelect(option: Option) {
            this.isDropdownOpen = false;
            if (!this.isEditable) {
                return;
            }

            if (option.value !== this.value) {
                this.$emit('change', option.value);
            }
        },

        // ------------------------------------------------------
        // -
        // -    Méthodes internes
        // -
        // ------------------------------------------------------

        async updateDropdownPosition(): Promise<void> {
            const $selection = this.$refs.selection as HTMLElement;
            const $dropdown = this.$refs.dropdown as HTMLElement | undefined;

            if (!this.isDropdownOpen || !$dropdown) {
                return;
            }

            const oldPosition = { ...this.dropdownPosition };
            const newPosition = await computePosition($selection, $dropdown, {
                placement: 'bottom-start',
                middleware: [
                    autoPlacement({
                        alignment: 'start',
                        allowedPlacements: ['bottom-start', 'bottom-end'],
                    }),
                    offset(5),
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

            const $selection = this.$refs.selection as HTMLElement | undefined;
            const $dropdown = this.$refs.dropdown as HTMLElement | undefined;
            if ($selection && $dropdown) {
                this.cleanupDropdownPositionUpdater = autoUpdate(
                    $selection,
                    $dropdown,
                    this.updateDropdownPosition.bind(this),
                );
            }
        },
    },
    render() {
        const {
            value,
            readonly,
            isEditable,
            selectedOption,
            selectableOptions: options,
            dropdownPosition,
            isDropdownOpen,
            handleToggleDropdown,
            handleClickOutside,
            handleSelect,
        } = this;

        const classNames = ['BadgeSelect', {
            'BadgeSelect--open': isEditable && isDropdownOpen,
            'BadgeSelect--readonly': readonly,
        }];

        return (
            <div class={classNames} v-clickOutside={handleClickOutside}>
                <button
                    ref="selection"
                    type="button"
                    class={[
                        'BadgeSelect__selection',
                        selectedOption?.type && (
                            `BadgeSelect__selection--${selectedOption.type}`
                        ),
                    ]}
                    onClick={handleToggleDropdown}
                >
                    <span class="BadgeSelect__selection__text">
                        {selectedOption?.label ?? value}
                    </span>
                </button>
                {(isEditable && isDropdownOpen && options.length > 0) && (
                    <Portal mountTo="#app" append>
                        <div
                            ref="dropdown"
                            class="BadgeSelect__dropdown"
                            style={{
                                left: `${dropdownPosition.x}px`,
                                top: `${dropdownPosition.y}px`,
                            }}
                        >
                            {options.map((option: Option) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    class={[
                                        'BadgeSelect__dropdown__option',
                                        `BadgeSelect__dropdown__option--${option.type}`,
                                        { 'BadgeSelect__dropdown__option--selected': option.value === value },
                                    ]}
                                    onClick={() => { handleSelect(option); }}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>
                    </Portal>
                )}
            </div>
        );
    },
});

//
// - Exports
//

export type { Options, Option };

export { Type } from './_constants';

type BadgeSelectGeneric = <
    ValueType extends string | number,
>(props: Props<ValueType>) => JSX.Element;

export type BadgeSelectRef = ComponentRef<typeof BadgeSelect>;
export default BadgeSelect as any as BadgeSelectGeneric;
