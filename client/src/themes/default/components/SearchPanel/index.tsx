import './index.scss';
import omit from 'lodash/omit';
import { defineComponent } from 'vue';
import { z } from '@/utils/validation';
import ClickOutside from 'vue-click-outside';
import { MountingPortal as Portal } from 'portal-vue';
import Button from '@/themes/default/components/Button';
import Select from '@/themes/default/components/Select';
import DatePicker from '@/themes/default/components/DatePicker';
import { hasChanged } from './_utils';
import Search, {
    TokenValueSchema,
    TokenDefinitionSchema,
} from '@/themes/default/components/Search';
import {
    computePosition,
    autoUpdate,
    flip,
    shift,
    offset,
} from '@floating-ui/dom';

import type { ComponentRef, PropType, Raw } from 'vue';
import type Period from '@/utils/period';
import type { SelectRef } from '@/themes/default/components/Select';
import type { DatePickerRef } from '@/themes/default/components/DatePicker';
import type { Simplify } from 'type-fest';
import type {
    TokenValue,
    CustomToken,
    TokenDefinition,
} from '@/themes/default/components/Search';

export enum FilterKind {
    /** Une liste de valeurs sélectionnables. */
    LIST = 'list',

    /** Champ de type sélecteur de période. */
    PERIOD = 'period',
}

const FilterDefinitionSchema = z.union([
    TokenDefinitionSchema.extend({
        placeholder: z.string(),
        kind: z.literal(FilterKind.LIST).optional(),
    }),
    TokenDefinitionSchema
        .pick({ type: true, icon: true, title: true, disabled: true })
        .extend({
            placeholder: z.string(),
            kind: z.literal(FilterKind.PERIOD),
        }),
]);

const FiltersSchema = z
    .object({ search: z.string().array() })
    .catchall(
        z.union([
            TokenValueSchema,
            TokenValueSchema.array(),
            z.period(),
            z.null(),
        ]),
    );

export type FilterDefinition = Simplify<(
    | (
        & TokenDefinition
        & {
            /**
             * Le placeholder affiché dans les listes de sélection
             * du dropdown "Filtres" lorsqu'aucune valeur n'est
             * sélectionnée pour ce champ.
             */
            placeholder: string,

            /**
             * Le type de champ.
             *
             * Valeurs possibles:
             * - `list`: Une liste de valeurs sélectionnables (défaut).
             * - `period`: Une sélecteur de période.
             */
            kind?: FilterKind,
        }
    )
    | (
        & Pick<TokenDefinition, 'type' | 'icon' | 'title' | 'disabled'>
        & {
            /**
             * Le placeholder affiché dans les listes de sélection
             * du dropdown "Filtres" lorsqu'aucune valeur n'est
             * sélectionnée pour ce champ.
             */
            placeholder: string,

            /** Champ de type sélecteur de période. */
            kind: FilterKind.PERIOD,
        }
    )
)>;

type ModalFilterComponentRef = (
    | SelectRef
    | DatePickerRef
);

type Filters = {
    search: string[],
    [filter: FilterDefinition['type']]: (
        | TokenValue
        | TokenValue[]
        | Raw<Period>
        | null
    ),
};

type Tokens = Array<CustomToken | string>;

type Props<F extends Filters = Filters> = {
    /**
     * Liste des filtres disponibles.
     *
     * Ceux-ci seront utilisés dans le champ et recherche
     * et dans le dropdown "Filtres".
     */
    definitions?: FilterDefinition[],

    /** Les valeurs actuelles des filtres. */
    values: F,

    /**
     * Fonction appelée lorsque les filtres ont changés.
     *
     * @param newFilters - Les nouveaux filtres.
     */
    onChange?(newFilters: F): void,

    /**
     * Fonction appelée lorsque l'utilisateur a soumis
     * les changements dans les filtres.
     */
    onSubmit?(): void,
};

type InstanceProperties = {
    cancelModalPositionUpdater: (() => void) | undefined,
};

type Data = {
    tokens: Tokens,
    search: string,
    showModal: boolean,
    modalPosition: Position,
};

const SearchPanel = defineComponent({
    name: 'SearchPanel',
    directives: { ClickOutside },
    props: {
        definitions: {
            type: Array as PropType<Required<Props>['definitions']>,
            default: () => [],
            validator: (value: unknown) => (
                z.array(FilterDefinitionSchema)
                    .safeParse(value).success
            ),
        },
        values: {
            type: Object as PropType<Required<Props>['values']>,
            required: true,
            validator: (value: unknown) => (
                FiltersSchema.safeParse(value).success
            ),
        },
        // eslint-disable-next-line vue/no-unused-properties
        onChange: {
            type: Function as PropType<Props['onChange']>,
            default: undefined,
        },
        // eslint-disable-next-line vue/no-unused-properties
        onSubmit: {
            type: Function as PropType<Props['onSubmit']>,
            default: undefined,
        },
    },
    emits: ['change', 'submit'],
    setup: (): InstanceProperties => ({
        cancelModalPositionUpdater: undefined,
    }),
    data: (): Data => ({
        tokens: [], // - Cf. les watchers.
        search: '', // - Cf. les watchers.
        showModal: false,
        modalPosition: { x: 0, y: 0 },
    }),
    computed: {
        hasModalFilters(): boolean {
            return this.definitions.some((definition: FilterDefinition) => {
                if (definition.disabled) {
                    return false;
                }

                return (
                    (definition.kind ?? FilterKind.LIST) !== FilterKind.LIST ||
                    ((definition as TokenDefinition).unique ?? true)
                );
            });
        },

        modalFiltersCount(): number {
            if (!this.hasModalFilters) {
                return 0;
            }

            return this.definitions.reduce(
                (total: number, definition: FilterDefinition) => {
                    if (definition.disabled) {
                        return total;
                    }

                    if (
                        (definition.kind ?? FilterKind.LIST) === FilterKind.LIST &&
                        !((definition as TokenDefinition).unique ?? true)
                    ) {
                        return total;
                    }

                    const value = this.values[definition.type] ?? null;
                    return value !== null && (!Array.isArray(value) || value.length > 0)
                        ? total + 1
                        : total;
                },
                0,
            );
        },

        isModalFilterEmpty(): boolean {
            return this.modalFiltersCount === 0;
        },

        coreDefinitions(): TokenDefinition[] {
            return this.definitions
                .filter((definition: FilterDefinition) => (
                    (definition.kind ?? 'list') === 'list'
                ))
                .map((definition: FilterDefinition): TokenDefinition => (
                    omit(definition, ['placeholder', 'kind']) as TokenDefinition
                ));
        },
    },
    watch: {
        hasModalFilters(hasModalFilters: boolean) {
            if (!hasModalFilters && this.showModal) {
                this.showModal = false;
            }
        },
        values: {
            handler(newValues: Filters) {
                const { coreDefinitions: definitions, tokens: prevTokens } = this;

                const existingTokens: Tokens = [];

                // - Recherche textuelle.
                const newTerms = new Set(newValues.search);
                prevTokens.forEach((_token: Tokens[number], index: number) => {
                    if (typeof _token !== 'string' || !newTerms.has(_token)) {
                        return;
                    }

                    newTerms.delete(_token);
                    existingTokens[index] = _token;
                });

                this.search = [...newTerms].join(' ');

                // - Custom tokens.
                const newTokens: Tokens = [];
                definitions.forEach((definition: TokenDefinition) => {
                    if (definition.disabled) {
                        return;
                    }

                    const newValue = newValues[definition.type] ?? null;
                    const index = prevTokens.findIndex(
                        (_token: Tokens[number]) => (
                            typeof _token !== 'string' &&
                            _token.type === definition.type
                        ),
                    );
                    if (newValue !== null && (!Array.isArray(newValue) || newValue.length > 0)) {
                        const token = { type: definition.type, value: newValue };
                        if (index !== -1) {
                            existingTokens[index] = token as Tokens[number];
                        } else {
                            newTokens.push(token as Tokens[number]);
                        }
                    }
                });

                this.tokens = existingTokens.concat(...newTerms, ...newTokens)
                    .filter((token: Tokens[number] | undefined) => token !== undefined);
            },
            immediate: true,
            deep: true,
        },
        tokens: {
            handler(newTokens: Tokens) {
                const definitionsMap: Map<FilterDefinition['type'], FilterDefinition> = new Map(
                    this.definitions.map((definition: FilterDefinition) => (
                        [definition.type, definition]
                    )),
                );

                const newValues: Filters = newTokens.reduce(
                    (result: Filters, _token: Tokens[number]) => {
                        if (typeof _token === 'string') {
                            return result;
                        }

                        if (!definitionsMap.has(_token.type)) {
                            return result;
                        }

                        const definition = definitionsMap.get(_token.type)!;
                        if (definition.disabled) {
                            return result;
                        }

                        let value = _token.value as any;
                        if (
                            (definition.kind ?? FilterKind.LIST) === FilterKind.LIST &&
                            !((definition as TokenDefinition).unique ?? true)
                        ) {
                            value = ((result[definition.type] ?? []) as TokenValue[])
                                .concat(_token.value as any);
                        }
                        return { ...result, [definition.type]: value };
                    },
                    this.getDefaultValues({ keepModalOnly: true, keepSearch: true }),
                );

                if (!hasChanged(this.values, newValues)) {
                    return;
                }

                this.$emit('change', newValues);
            },
            deep: true,
        },
    },
    created() {
        this.getDefaultValues.bind(this);
    },
    mounted() {
        this.registerModalPositionUpdater();
    },
    updated() {
        this.registerModalPositionUpdater();
    },
    beforeDestroy() {
        this.cleanupModalPositionUpdater();
    },
    methods: {
        // ------------------------------------------------------
        // -
        // -    Handlers
        // -
        // ------------------------------------------------------

        handleToggleModal() {
            this.showModal = !this.showModal;
        },

        handleSearchChange(newValue: string | null) {
            this.search = newValue ?? '';

            if (newValue === null || newValue.length < 1) {
                this.$emit('change', { ...this.values, search: [] });
                return;
            }

            this.$emit('change', { ...this.values, search: [newValue] });
        },

        handleSearchSubmit() {
            this.$emit('submit');
        },

        handleFilterChange(type: FilterDefinition['type'], newValue: TokenValue | Raw<Period> | null) {
            const definition = this.definitions.find(
                (_definition: FilterDefinition) => _definition.type === type,
            );
            if (definition === undefined || definition.disabled) {
                return;
            }

            // - Les champs non unique ne sont pas proposés dans le dropdown.
            const isList = (definition.kind ?? FilterKind.LIST) === FilterKind.LIST;
            if (isList && !((definition as TokenDefinition).unique ?? true)) {
                return;
            }

            // - On vérifie que la valeur a bien changé.
            const oldValue = this.values[definition.type] ?? (
                isList && (definition as TokenDefinition).multiSelect ? [] : null
            );
            if (!hasChanged(oldValue, newValue)) {
                return;
            }

            this.$emit('change', { ...this.values, [type]: newValue });
        },

        handleFiltersClear() {
            this.$emit('change', this.getDefaultValues({ keepSearch: true }));
        },

        handleClickOutsideModal(e: Event) {
            // - Si l'élément cliqué n'est plus dans le DOM, on part du principe
            //   qu'il faisait partie de la modale des filtres, sans quoi le clic
            //   serait considéré comme "outside" et fermerait la modale.
            //   (e.g. Un tag supprimé, bouton de reset, ...).
            if (!((e.target as HTMLElement).isConnected ?? true)) {
                return;
            }

            // - Vérifie si ce n'est pas un click dans un des filtres de la fenêtre modale.
            const isModalFilterClick = this.definitions.some(
                (definition: FilterDefinition): boolean => {
                    const $filter = this.$refs[`modalFilters[${definition.type}]`] as ModalFilterComponentRef | undefined;
                    if ($filter === undefined) {
                        return false;
                    }

                    const kind = definition.kind ?? FilterKind.LIST;
                    if (kind === FilterKind.PERIOD) {
                        /* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
                        const $picker = $filter.$refs?.picker as ComponentRef | undefined;
                        const $popup = $picker?.$refs?.popup as ComponentRef | undefined;
                        /* eslint-enable @typescript-eslint/no-unnecessary-type-assertion */

                        return (
                            ($picker?.$el.contains(e.target as HTMLElement) ?? false) ||
                            ($popup?.$el.contains(e.target as HTMLElement) ?? false)
                        );
                    }

                    return $filter.$el.contains(e.target as HTMLElement);
                },
            );
            if (isModalFilterClick) {
                return;
            }

            // - Si c'est un click sur le bouton d'affichage des filtres, on ignore.
            const $modalButton = this.$refs.modalButton as ComponentRef<typeof Button>;
            const $modalButtonNode = $modalButton?.$el as HTMLElement | undefined;
            if ($modalButtonNode!.contains(e.target as Element)) {
                return;
            }

            this.showModal = false;
        },

        // ------------------------------------------------------
        // -
        // -    Méthodes internes
        // -
        // ------------------------------------------------------

        getDefaultValues(options: { keepModalOnly?: boolean, keepSearch?: boolean } = {}): Filters {
            const { keepModalOnly = false, keepSearch = false } = options;

            return this.definitions.reduce(
                (values: Partial<Filters>, definition: FilterDefinition) => {
                    const isList = (definition.kind ?? FilterKind.LIST) === FilterKind.LIST;
                    if (!isList && keepModalOnly) {
                        return { ...values, [definition.type]: this.values[definition.type] };
                    }

                    let defaultValue: TokenValue | Period | null = null;
                    if (
                        isList &&
                        (
                            (definition as TokenDefinition).multiSelect ||
                            !((definition as TokenDefinition).unique ?? true)
                        )
                    ) {
                        defaultValue = [];
                    }

                    return { ...values, [definition.type]: defaultValue };
                },
                { search: keepSearch ? [...this.values.search] : [] },
            ) as Filters;
        },

        async updateModalPosition(): Promise<void> {
            const $modal = this.$refs.modal as HTMLDivElement | undefined;
            const $modalButton = this.$refs.modalButton as ComponentRef<typeof Button>;
            const $modalButtonNode = $modalButton?.$el as HTMLElement | undefined;

            if (!this.showModal || !$modal) {
                return;
            }

            const oldPosition = { ...this.modalPosition };
            const newPosition = await computePosition($modalButtonNode!, $modal, {
                placement: 'bottom-end',
                middleware: [flip(), shift(), offset(10)],
            });

            if (newPosition.x === oldPosition.x && newPosition.y === oldPosition.y) {
                return;
            }

            this.modalPosition = { x: newPosition.x, y: newPosition.y };
        },

        cleanupModalPositionUpdater() {
            if (typeof this.cancelModalPositionUpdater === 'function') {
                this.cancelModalPositionUpdater();
                this.cancelModalPositionUpdater = undefined;
            }
        },

        registerModalPositionUpdater() {
            const $modal = this.$refs.modal as HTMLDivElement | undefined;
            const $modalButton = this.$refs.modalButton as ComponentRef<typeof Button>;
            const $modalButtonNode = $modalButton?.$el as HTMLElement | undefined;

            this.cleanupModalPositionUpdater();

            if ($modalButtonNode && $modal) {
                this.cancelModalPositionUpdater = autoUpdate(
                    $modalButtonNode,
                    $modal,
                    this.updateModalPosition.bind(this),
                );
            }
        },
    },
    render() {
        const {
            $t: __,
            values,
            search,
            showModal,
            definitions,
            hasModalFilters,
            modalPosition,
            modalFiltersCount,
            isModalFilterEmpty,
            handleFiltersClear,
            handleToggleModal,
            handleSearchSubmit,
            handleSearchChange,
            handleFilterChange,
            handleClickOutsideModal,
        } = this;

        return (
            <div class="SearchPanel">
                <div class="SearchPanel__container">
                    {hasModalFilters && (
                        <span class="SearchPanel__modal-button">
                            <Button
                                size="large"
                                ref="modalButton"
                                type={modalFiltersCount > 0 ? 'secondary' : 'default'}
                                onClick={handleToggleModal}
                            >
                                {__('filters')}
                            </Button>
                            {modalFiltersCount > 0 && (
                                <span class="SearchPanel__modal-button__counter">
                                    {modalFiltersCount}
                                </span>
                            )}
                        </span>
                    )}
                    <Search
                        class="SearchPanel__search"
                        value={search}
                        onChange={handleSearchChange}
                        onSubmit={handleSearchSubmit}
                    />
                </div>
                {(hasModalFilters && showModal) && (
                    <Portal mountTo="#app" append>
                        <div
                            ref="modal"
                            class="SearchPanel__modal"
                            style={{
                                left: `${modalPosition.x}px`,
                                top: `${modalPosition.y}px`,
                            }}
                            v-clickOutside={handleClickOutsideModal}
                        >
                            {definitions.map((definition: FilterDefinition) => {
                                const isList = (definition.kind ?? FilterKind.LIST) === FilterKind.LIST;
                                if (isList && !((definition as TokenDefinition).unique ?? true)) {
                                    return null;
                                }

                                const isMultiSelect = isList && (definition as TokenDefinition).multiSelect;
                                const value = values[definition.type] ?? (isMultiSelect ? [] : null);

                                const highlighted = !definition.disabled && (
                                    isMultiSelect && Array.isArray(value)
                                        ? value.length > 0
                                        : value !== null
                                );

                                if (definition.kind === FilterKind.PERIOD) {
                                    return (
                                        <DatePicker
                                            ref={`modalFilters[${definition.type}]`}
                                            key={definition.type}
                                            type="date"
                                            placeholder={definition.placeholder}
                                            disabled={definition.disabled}
                                            highlight={highlighted}
                                            value={value as Period<true>}
                                            onChange={(newValue: Raw<Period> | null) => {
                                                handleFilterChange(definition.type, newValue);
                                            }}
                                            withSnippets
                                            clearable
                                            range
                                        />
                                    );
                                }

                                return (
                                    <Select
                                        ref={`modalFilters[${definition.type}]`}
                                        key={definition.type}
                                        class="SearchPanel__modal__filter"
                                        options={definition.options}
                                        disabled={definition.disabled}
                                        placeholder={definition.placeholder}
                                        multiple={definition.multiSelect ?? false}
                                        highlight={highlighted}
                                        value={value as string | number | Array<string | number> | null}
                                        onChange={(newValue: TokenValue | null) => {
                                            handleFilterChange(definition.type, newValue);
                                        }}
                                    />
                                );
                            })}
                            {!isModalFilterEmpty && (
                                <Button
                                    type="danger"
                                    icon="backspace"
                                    class="SearchPanel__modal__reset"
                                    tooltip={__('clear-filters')}
                                    onClick={handleFiltersClear}
                                />
                            )}
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

type SearchPanelGeneric = <F extends Filters>(props: Props<F>) => JSX.Element;

export type {
    TokenOptions,
    TokenOption,
} from '@/themes/default/components/Search';

export type SearchPanelRef = ComponentRef<typeof SearchPanel>;
export default SearchPanel as any as SearchPanelGeneric;
