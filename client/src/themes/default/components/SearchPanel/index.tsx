import './index.scss';
import omit from 'lodash/omit';
import { defineComponent } from 'vue';
import { z } from '@/utils/validation';
import { MountingPortal as Portal } from 'portal-vue';
import Button from '@/themes/default/components/Button';
import Select from '@/themes/default/components/Select';
import DatePicker from '@/themes/default/components/DatePicker';
import { hasChangedFilters, generateTokens } from './_utils';
import Search, {
    TokenKind,
    TokenValueSchema,
    TokenOperatorValueSchema,
    createTokenDefinitionSchema,
} from '@/themes/default/components/Search';
import {
    computePosition,
    autoUpdate,
    flip,
    shift,
    offset,
} from '@floating-ui/dom';

import type Day from '@/utils/day';
import type Period from '@/utils/period';
import type { ComponentRef, PropType, Raw } from 'vue';
import type { SchemaInfer } from '@/utils/validation';
import type { SelectRef } from '@/themes/default/components/Select';
import type { DatePickerRef } from '@/themes/default/components/DatePicker';
import type { Token, TokenValue, TokenDefinition } from '@/themes/default/components/Search';

const FilterDefinitionSchema = createTokenDefinitionSchema({
    /**
     * Le placeholder affiché dans les listes de sélection
     * du dropdown "Filtres" lorsqu'aucune valeur n'est
     * sélectionnée pour ce champ.
     *
     * Si cette valeur n'est pas spécifiée, le champ
     * n’apparaîtra pas dans le dropdown "Filtres".
     */
    placeholder: z.string().optional(),
});

export const ComplexFilterValueSchema = z.strictObject({
    operator: TokenOperatorValueSchema,
    value: TokenValueSchema,
});

export const FilterValueSchema = z.union([
    TokenValueSchema,
    ComplexFilterValueSchema,
]);

export const FiltersSchema = z
    .object({ search: z.string().array() })
    .catchall(
        z.union([
            FilterValueSchema,
            FilterValueSchema.array(),
            z.null(),
        ]),
    );

export type FilterDefinition = SchemaInfer<typeof FilterDefinitionSchema>;
export type ComplexFilterValue = SchemaInfer<typeof ComplexFilterValueSchema>;
export type FilterValue = SchemaInfer<typeof FilterValueSchema>;
export type Filters = SchemaInfer<typeof FiltersSchema>;

type ModalFilterComponentRef = (
    | SelectRef
    | DatePickerRef
);

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
    tokens: Token[],
    search: string,
    showModal: boolean,
    modalPosition: Position,
};

const SearchPanel = defineComponent({
    name: 'SearchPanel',
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
        coreDefinitions(): TokenDefinition[] {
            return this.definitions.map(
                (definition: FilterDefinition): TokenDefinition => (
                    omit(definition, ['placeholder']) as TokenDefinition
                ),
            );
        },

        modalDefinitions(): FilterDefinition[] {
            return this.definitions.filter((definition: FilterDefinition) => (
                !definition.disabled && this.isDefinitionUsableInModal(definition)
            ));
        },

        hasModalFilters(): boolean {
            return this.modalDefinitions.length > 0;
        },

        modalFiltersCount(): number {
            if (!this.hasModalFilters) {
                return 0;
            }

            return this.modalDefinitions.reduce(
                (total: number, definition: FilterDefinition) => {
                    if (definition.disabled) {
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
    },
    watch: {
        hasModalFilters(hasModalFilters: boolean) {
            if (!hasModalFilters && this.showModal) {
                this.showModal = false;
            }
        },
        coreDefinitions() {
            const generate = generateTokens(this.coreDefinitions);
            this.tokens = generate(this.values, this.tokens);
        },
        values: {
            handler(newValues: Filters) {
                const generate = generateTokens(this.coreDefinitions);
                this.tokens = generate(newValues, this.tokens);
            },
            immediate: true,
            deep: true,
        },
        tokens: {
            handler(newTokens: Token[]) {
                const definitionsMap: Map<FilterDefinition['type'], FilterDefinition> = new Map(
                    this.definitions.map((definition: FilterDefinition) => (
                        [definition.type, definition]
                    )),
                );

                const newValues: Filters = newTokens.reduce(
                    (result: Filters, _token: Token) => {
                        if (typeof _token === 'string') {
                            if (!result.search.includes(_token)) {
                                result.search.push(_token);
                            }
                            return result;
                        }

                        if (!definitionsMap.has(_token.type)) {
                            return result;
                        }

                        const definition = definitionsMap.get(_token.type)!;
                        if (definition.disabled) {
                            return result;
                        }

                        let value: FilterValue | FilterValue[] = (
                            _token.operator !== undefined
                                ? (omit(_token, 'type') as FilterValue)
                                : _token.value
                        );
                        if (!(definition.unique ?? true)) {
                            value = [
                                ...(result[definition.type] ?? []) as FilterValue[],
                                value as FilterValue,
                            ];
                        }
                        return { ...result, [definition.type]: value };
                    },
                    this.getDefaultValues(),
                );
                if (!hasChangedFilters(this.values, newValues)) {
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

        // - Gestion du clique en dehors de la modale des filtres.
        const clickHandler = (
            'ontouchstart' in document.documentElement
                ? 'touchstart'
                : 'mousedown'
        );
        document.addEventListener(clickHandler, this.handleGlobalClick);
    },
    updated() {
        this.registerModalPositionUpdater();
    },
    beforeDestroy() {
        this.cleanupModalPositionUpdater();

        // - Cleanup de la gestion du clique en dehors de la modale des filtres.
        const clickHandler = (
            'ontouchstart' in document.documentElement
                ? 'touchstart'
                : 'mousedown'
        );
        document.removeEventListener(clickHandler, this.handleGlobalClick);
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

        handleFilterChange(type: FilterDefinition['type'], newValue: TokenValue | null) {
            // - On ne prend que les definitions compatibles avec la modale.
            const definition = this.modalDefinitions.find(
                (_definition: FilterDefinition) => _definition.type === type,
            );
            if (definition === undefined || definition.disabled) {
                return;
            }

            // - On vérifie que la valeur a bien changé.
            const isList = (
                definition.kind === undefined ||
                definition.kind === TokenKind.LIST
            );
            const oldValue = this.values[definition.type] ?? (
                isList && definition.multiSelect ? [] : null
            );
            if (!hasChangedFilters(oldValue, newValue)) {
                return;
            }

            this.$emit('change', { ...this.values, [type]: newValue });
        },

        handleModalFiltersClear() {
            this.$emit('change', this.getDefaultValues({ keepCoreOnly: true }));
        },

        handleGlobalClick(e: Event) {
            if (!this.showModal) {
                return;
            }

            const $modal = this.$refs.modal as HTMLElement | undefined;
            if ($modal === undefined) {
                return;
            }

            const $target = e.target! as HTMLElement;
            const $ancestors = e.composedPath();
            $ancestors.unshift($target);

            const isOutside = (
                !$modal.contains($target) &&
                !$ancestors.includes($modal)
            );
            if (!isOutside) {
                return;
            }

            // - Vérifie si ce n'est pas un click dans un des filtres de la fenêtre modale.
            const isModalFilterClick = this.modalDefinitions.some((definition: FilterDefinition): boolean => {
                const $filter = this.$refs[`modalFilters[${definition.type}]`] as ModalFilterComponentRef | undefined;
                if ($filter === undefined) {
                    return false;
                }

                const kind = definition.kind ?? TokenKind.LIST;
                if (kind === TokenKind.PERIOD || kind === TokenKind.DATE) {
                    const $picker = $filter.$refs?.picker as ComponentRef | undefined;
                    const $popup = $picker?.$refs?.popup as ComponentRef | undefined;

                    return (
                        ($picker?.$el.contains($target) ?? false) ||
                        ($popup?.$el.contains($target) ?? false)
                    );
                }

                return $filter.$el.contains($target);
            });
            if (isModalFilterClick) {
                return;
            }

            // - Si c'est un click sur le bouton d'affichage des filtres, on ignore.
            const $modalButton = this.$refs.modalButton as ComponentRef<typeof Button>;
            const $modalButtonNode = $modalButton?.$el as HTMLElement | undefined;
            if ($modalButtonNode!.contains($target)) {
                return;
            }

            this.showModal = false;
        },

        // ------------------------------------------------------
        // -
        // -    Méthodes internes
        // -
        // ------------------------------------------------------

        isDefinitionUsableInModal(definition: FilterDefinition): boolean {
            if (definition.placeholder === undefined) {
                return false;
            }

            // - Si c'est un filtre avec entrée textuelle...
            //   => On ne l'affiche pas dans la modale.
            const isTextual = (
                definition.kind === TokenKind.TEXT ||
                definition.kind === TokenKind.FLOAT ||
                definition.kind === TokenKind.INTEGER
            );
            if (isTextual) {
                return false;
            }

            // - Idem si c'est un token booléen.
            // TODO: À implémenter ?
            if (definition.kind === TokenKind.BOOLEAN) {
                return false;
            }

            // - Si le filtre requiert un opérateur...
            //   => On ne l'affiche pas dans la modale.
            if ((definition.operators ?? []).length > 0) {
                return false;
            }

            // - On ne garde que les filtres "uniques" pour la modale.
            return definition.unique ?? true;
        },

        getDefaultValues(options: { keepCoreOnly?: boolean } = {}): Filters {
            const { keepCoreOnly = false } = options;

            return this.definitions.reduce(
                (values: Partial<Filters>, definition: FilterDefinition) => {
                    const isList = (
                        definition.kind === undefined ||
                        definition.kind === TokenKind.LIST
                    );
                    let defaultValue: FilterValue | null = null;
                    if (!(definition.unique ?? true) || (isList && definition.multiSelect)) {
                        defaultValue = [];
                    }

                    if (keepCoreOnly && !this.isDefinitionUsableInModal(definition)) {
                        const _value = this.values[definition.type] ?? defaultValue;
                        return { ...values, [definition.type]: _value };
                    }

                    return { ...values, [definition.type]: defaultValue };
                },
                { search: keepCoreOnly ? [...this.values.search] : [] },
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
            modalDefinitions,
            hasModalFilters,
            modalPosition,
            modalFiltersCount,
            isModalFilterEmpty,
            handleModalFiltersClear,
            handleToggleModal,
            handleSearchSubmit,
            handleSearchChange,
            handleFilterChange,
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
                        >
                            {modalDefinitions.map((definition: FilterDefinition) => {
                                const isList = (
                                    definition.kind === undefined ||
                                    definition.kind === TokenKind.LIST
                                );
                                const isMultiSelect = isList && definition.multiSelect;
                                const value = values[definition.type] ?? (isMultiSelect ? [] : null);

                                const highlighted = !definition.disabled && (
                                    isMultiSelect && Array.isArray(value)
                                        ? value.length > 0
                                        : value !== null
                                );

                                switch (definition.kind) {
                                    case TokenKind.DATE:
                                    case TokenKind.PERIOD: {
                                        return (
                                            <DatePicker
                                                ref={`modalFilters[${definition.type}]`}
                                                key={definition.type}
                                                type="date"
                                                placeholder={definition.placeholder}
                                                disabled={definition.disabled}
                                                highlight={highlighted}
                                                range={definition.kind === TokenKind.PERIOD}
                                                value={value as Period<true> | Day}
                                                onChange={(newValue: Raw<Period> | Raw<Day> | null) => {
                                                    handleFilterChange(definition.type, newValue);
                                                }}
                                                withSnippets
                                                clearable
                                            />
                                        );
                                    }
                                    case TokenKind.LIST:
                                    case undefined: {
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
                                    }
                                    default: {
                                        // eslint-disable-next-line no-console
                                        console.warn(`Unsupported kind in \`<SearchPanel />\` modal: \`${definition.kind}\`.`);
                                        return null;
                                    }
                                }
                            })}
                            {!isModalFilterEmpty && (
                                <Button
                                    type="danger"
                                    icon="backspace"
                                    class="SearchPanel__modal__reset"
                                    tooltip={__('clear-filters')}
                                    onClick={handleModalFiltersClear}
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
    TokenOption,
    TokenOptions,
} from '@/themes/default/components/Search';

export {
    TokenKind as FilterKind,
    hasChangedFilters,
};

export type SearchPanelRef = ComponentRef<typeof SearchPanel>;
export default SearchPanel as any as SearchPanelGeneric;
