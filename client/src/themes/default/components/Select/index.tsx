import './index.scss';
import { computed, defineComponent, inject } from 'vue';
import { DisabledKey, InvalidKey } from '@/themes/default/components/@constants';
import stringIncludes from '@/utils/stringIncludes';
import VueSelect from 'vue-select';
import Button from '@/themes/default/components/Button';
import Fragment from '@/components/Fragment';
import { areValuesEqual } from './_utils';
import icons from './icons';

import type { Injected, PropType, ComponentRef } from 'vue';
import type { DebouncedFunc } from 'lodash';
import type {
    OptionValue,
    LooseOptions,
    SearcherFunc,
    ValuesOf,
    Options,
    Option,
} from './_types';

type Props<
    ValueType extends OptionValue = OptionValue,
    ExtraData = any,
    InnerOptions extends LooseOptions<ValueType, ExtraData> = LooseOptions<ValueType, ExtraData>,
    IsMultiple extends boolean = boolean,
    Placeholder extends boolean | string = boolean | string,
    NullValue = (
        /* eslint-disable @stylistic/indent */
        Placeholder extends false ? never
            : IsMultiple extends true ? never
            : null
        /* eslint-enable @stylistic/indent */
    ),
> = {
    /**
     * Le nom du champ (attribut `[name]`).
     *
     * Ceci permettra notamment de récupérer la valeur du champ dans
     * le jeu de données d'un formulaire parent lors de la soumission
     * (`submit`) de celui-ci.
     */
    name?: string,

    /** Le champ est-il désactivé ? */
    disabled?: boolean,

    /** Le champ doit-il être marqué comme invalide ? */
    invalid?: boolean,

    /**
     * L'éventuel texte affiché en filigrane dans le
     * champ quand celui-ci est vide.
     *
     * @default true
     */
    placeholder?: Placeholder,

    /**
     * Permet de spécifier le type d'assistance automatisée
     * attendue par le navigateur.
     *
     * @see https://developer.mozilla.org/fr/docs/Web/HTML/Attributes/autocomplete
     *
     * @default 'off'
     */
    autocomplete?: AutoFill,

    /**
     * Le champ doit-il être mis en surbrillance ?
     *
     * @default false
     */
    highlight?: boolean,

    /**
     * S'agit-il d'un sélecteur à choix multiple ?
     *
     * @default false
     */
    multiple?: IsMultiple,

    /**
     * Permet de déléguer la recherche à une fonction externe.
     *
     * Lorsque cette option est utilisée, le filtrage interne du champ est désactivé.
     */
    searcher?: SearcherFunc | DebouncedFunc<SearcherFunc>,

    /**
     * Une éventuelle fonction de rendu pour customiser l'affichage
     * des options et/ou de la valeur sélectionnée.
     *
     * @param value - La valeur à rendre.
     * @param asSelection - Indique si la valeur doit être rendue en tant que valeur
     *                      sélectionnée du champ (`true`) ou en tant qu'option de la
     *                      liste déroulante (`false`).
     *
     * @returns La valeur à rendre.
     */
    renderer?(value: InnerOptions[number], asSelection?: boolean): JSX.Node,

    /**
     * Permet de customiser le rendu de la zone "aucune option" qui
     * s'affiche dans la liste déroulante quand aucun résultat n'est trouvé.
     *
     * Si non spécifié, un rendu par défaut sera utilisé en fonction
     * du contexte (recherche en cours, caractères minimaux, etc.).
     *
     * @param currentSearch - Le texte actuellement saisi par l'utilisateur dans
     *                        le champ de recherche.
     *
     * @returns La valeur à rendre ou `null` si vous souhaitez utiliser la sortie par défaut.
     */
    noOptionsRenderer?(currentSearch: string): JSX.Node | null,

    /**
     * Peut-on ajouter une option en écrivant sa valeur dans le champ ?
     * À utiliser avec l'event `onCreate` pour récupérer la nouvelle valeur.
     *
     * Si une fonction externe est utilisée pour la recherche, un bouton d'ajout
     * sera proposé à l'utilisateur si aucun résultat ne correspond à sa recherche.
     *
     * @default false
     */
    canCreate?: boolean,

    /**
     * Permet de customiser le texte utilisé pour proposer la
     * création d'une entrée quand `canCreate` est à `true`.
     *
     * Peut contenir:
     * - Une chaîne de caractères qui sera utilisée telle quelle.
     * - Une fonction à laquelle sera passée la valeur que
     *   l'utilisateur a demandé à créer.
     *
     * @example
     * createLabel="Ajouter la société"
     * createLabel={(name: string) => __('create-label', { name })}
     */
    createLabel?: string | ((newValue: string) => string),

    /**
     * Valeur actuellement sélectionnée.
     *
     * Dans le cas d'un choix multiple, un tableau peut être passé.
     * Si `null` est passé, aucune valeur ne sera sélectionnée.
     */
    value: (
        IsMultiple extends true
            ? Array<ValuesOf<InnerOptions>>
            : ValuesOf<InnerOptions>
    ) | NullValue,

    /**
     * Les options du champ select.
     *
     * Doit être fournie sous forme de tableau d'objet (Une option = Un objet).
     * Voir le type {@link Option} pour plus de détails sur le format de chaque option.
     * Peut également être fourni sous la forme d'un tableau de simples chaînes de caractères.
     */
    options: InnerOptions,

    /**
     * Fonction appelée lorsque la valeur du select change.
     *
     * @param newValue - La nouvelle valeur du select.
     */
    onInput?: IsMultiple extends true
        ? (newValue: Array<ValuesOf<InnerOptions>> | NullValue) => void
        : (newValue: ValuesOf<InnerOptions> | NullValue) => void,

    /**
     * Fonction appelée lorsque la valeur du select change.
     *
     * @param newValue - La nouvelle valeur du select.
     */
    onChange?: IsMultiple extends true
        ? (newValue: Array<ValuesOf<InnerOptions>> | NullValue) => void
        : (newValue: ValuesOf<InnerOptions> | NullValue) => void,

    /**
     * Fonction appelée lorsque l'utilisateur demande
     * à créer une nouvelle valeur dans le select.
     *
     * @param input - La nouvelle valeur demandée.
     */
    onCreate?(input: string): void,
};

/**
 * Longueur minimale du texte lors d'une
 * recherche avec fonction de recherche personnalisée.
 */
const MIN_CUSTOM_SEARCHER_CHARS = 2;

type Data = {
    pendingCreation: string | null,
};

type SelectedValue<T extends OptionValue = OptionValue, ExtraData = any> = (
    | string
    | Option<T, ExtraData>
    | Array<string | Option<T, ExtraData>>
    | null
);

type InstanceProperties = {
    injectedInvalid: Injected<typeof InvalidKey>,
    injectedDisabled: Injected<typeof DisabledKey>,
};

/** Un champ de formulaire de type sélecteur. */
const Select = defineComponent({
    name: 'Select',
    props: {
        name: {
            type: String as PropType<Props['name']>,
            default: undefined,
        },
        disabled: {
            type: Boolean as PropType<Props['disabled']>,
            default: undefined,
        },
        invalid: {
            type: Boolean as PropType<Props['invalid']>,
            default: undefined,
        },
        placeholder: {
            type: [Boolean, String] as PropType<Props['placeholder']>,
            default: true,
        },
        autocomplete: {
            type: String as PropType<Props['autocomplete']>,
            default: 'off',
        },
        highlight: {
            type: Boolean as PropType<Required<Props>['highlight']>,
            default: false,
        },
        multiple: {
            type: Boolean as PropType<Required<Props>['multiple']>,
            default: false,
        },
        searcher: {
            type: Function as PropType<Props['searcher']>,
            default: undefined,
        },
        renderer: {
            type: Function as PropType<Props['renderer']>,
            default: undefined,
        },
        noOptionsRenderer: {
            type: Function as PropType<Props['noOptionsRenderer']>,
            default: undefined,
        },
        canCreate: {
            type: Boolean as PropType<Required<Props>['canCreate']>,
            default: false,
        },
        createLabel: {
            type: [Function, String] as PropType<Props['createLabel']>,
            default: undefined,
        },
        value: {
            // TODO [vue@>3]: Mettre `[Array, String, Number, null]` en Vue 3.
            // @see https://github.com/vuejs/core/issues/3948#issuecomment-860466204
            type: null as unknown as PropType<Props['value']>,
            required: true,
            validator: (value: unknown): boolean => {
                if (value === null) {
                    return true;
                }

                const validateValue = (_value: unknown): boolean => (
                    _value !== null && _value !== undefined &&
                    ['number', 'string', 'object'].includes(typeof _value)
                );

                // - Mode multiple.
                if (Array.isArray(value)) {
                    return value.every((_value: unknown) => validateValue(_value));
                }
                return validateValue(value);
            },
        },
        options: {
            type: Array as PropType<Props['options']>,
            required: true,
            validator: (options: unknown): boolean => {
                if (!Array.isArray(options)) {
                    return false;
                }

                return options.every((option: unknown) => {
                    if (typeof option !== 'object' || option === null) {
                        return ['string', 'number'].includes(typeof option);
                    }

                    const { label, value } = option as Record<string, unknown>;
                    return (
                        typeof label === 'string' &&
                        ['string', 'number', 'object'].includes(typeof value) &&
                        value !== null
                    );
                });
            },
        },
        // eslint-disable-next-line vue/no-unused-properties
        onInput: {
            type: Function as PropType<Props['onInput']>,
            default: undefined,
        },
        // eslint-disable-next-line vue/no-unused-properties
        onChange: {
            type: Function as PropType<Props['onChange']>,
            default: undefined,
        },
        // eslint-disable-next-line vue/no-unused-properties
        onCreate: {
            type: Function as PropType<Props['onCreate']>,
            default: undefined,
        },
    },
    emits: ['input', 'change', 'create'],
    setup: (): InstanceProperties => ({
        injectedInvalid: inject(InvalidKey, computed(() => false)),
        injectedDisabled: inject(DisabledKey, computed(() => false)),
    }),
    data: (): Data => ({
        pendingCreation: null,
    }),
    computed: {
        formattedPlaceholder(): string | undefined {
            const { __, placeholder } = this;

            if (placeholder === false) {
                return undefined;
            }

            return placeholder === true
                ? __('global.please-choose')
                : placeholder;
        },

        filteredOptions(): string[] | Options {
            const { options, value } = this;

            if (value === null || !this.multiple) {
                return options;
            }

            // Note: Si c'est une sélection multiple, on ne repropose
            //       pas les options déjà sélectionnées.
            return options.filter((option: string | Option) => {
                const optionValue = typeof option === 'object' ? option.value : option;
                const values: OptionValue[] = !Array.isArray(value) ? [value] : value;
                return values.every((_value) => !areValuesEqual(optionValue, _value));
            }) as string[] | Options;
        },

        inheritedInvalid(): boolean {
            if (this.invalid !== undefined) {
                return this.invalid;
            }
            return this.injectedInvalid;
        },

        inheritedDisabled(): boolean {
            if (this.disabled !== undefined) {
                return this.disabled;
            }
            return !!this.injectedDisabled;
        },

        selected(): SelectedValue {
            const { options, value } = this;

            if (value === null) {
                return null;
            }

            if (this.multiple) {
                const values: OptionValue[] = !Array.isArray(value) ? [value] : value;
                return values.reduce(
                    (selection: Array<string | Option>, _value: OptionValue) => {
                        const option = options.find((_option: string | Option) => {
                            const rawOption = typeof _option === 'object' ? _option.value : _option;
                            return areValuesEqual(rawOption, _value);
                        });
                        return option !== undefined ? [...selection, option] : selection;
                    },
                    [],
                );
            }

            return options.find((option: string | Option) => {
                const optionValue = typeof option === 'object' && option !== null
                    ? option.value
                    : option;

                return areValuesEqual(value as OptionValue, optionValue);
            }) ?? null;
        },

        clearable() {
            return this.placeholder !== false;
        },
    },
    created() {
        if (this.name !== undefined) {
            const { value, options } = this;

            const hasObjectValue = value !== null && (
                (!Array.isArray(value) && typeof value === 'object') ||
                (Array.isArray(value) && value.some((_value: unknown) => typeof _value === 'object'))
            );
            const hasObjectOption = options.some((option: string | Option) => (
                typeof option === 'object' && typeof option.value === 'object'
            ));
            if (hasObjectValue || hasObjectOption) {
                throw new Error('<Select>: Object values are not compatible with hidden input serialization.');
            }
        }
    },
    methods: {
        // ------------------------------------------------------
        // -
        // -    Handlers
        // -
        // ------------------------------------------------------

        async handleSearch(search: string, setLoading: (isLoading: boolean) => void) {
            if (this.searcher === undefined || search.length < MIN_CUSTOM_SEARCHER_CHARS) {
                return;
            }

            setLoading(true);
            try {
                await this.searcher(search);
            } finally {
                setLoading(false);
            }
        },

        handleInput(selected: SelectedValue) {
            if (this.inheritedDisabled) {
                return;
            }

            if (this.pendingCreation !== null) {
                const { pendingCreation, handleOptionCreate } = this;
                this.pendingCreation = null;

                const isPendingSelected: boolean = (() => {
                    if (selected === null) {
                        return false;
                    }

                    const _selected = this.multiple
                        ? (Array.isArray(selected) ? [...selected].pop() : selected)
                        : selected as Option | string;

                    return (
                        typeof _selected === 'string' &&
                        _selected === pendingCreation
                    );
                })();
                if (isPendingSelected) {
                    handleOptionCreate(pendingCreation);
                    return;
                }
            }

            let selection: OptionValue | OptionValue[] | null = null;
            if (this.multiple) {
                if (selected === null) {
                    selected = [];
                }

                if (!Array.isArray(selected)) {
                    selected = [selected];
                }

                selection = selected.map((item: string | Option) => (
                    typeof item === 'object' ? item.value : item
                ));
            } else if (selected === null) {
                selection = null;
            } else if (typeof selected === 'string') {
                selection = selected;
            } else if (typeof selected === 'object') {
                selection = (selected as Option).value;
            }

            this.$emit('input', selection);
            this.$emit('change', selection);
        },

        handleOptionCreating(input: any): string | Option | undefined {
            if (!this.canCreate || typeof input !== 'string') {
                this.pendingCreation = null;
                return undefined;
            }

            // - Si la valeur recherchée correspond parfaitement à un autre
            //   option, on ne propose pas de création mais l'option existante.
            const existingOption = this.options.find((option: string | Option) => {
                option = typeof option === 'object' ? option.label : option;
                return input.toLocaleLowerCase() === option.toString().toLocaleLowerCase();
            });
            if (existingOption !== undefined) {
                this.pendingCreation = null;
                return existingOption;
            }

            this.pendingCreation = input;
            return input;
        },

        handleOptionCreate(input: string) {
            this.$emit('create', input);
        },

        // ------------------------------------------------------
        // -
        // -    Méthodes internes
        // -
        // ------------------------------------------------------

        dropdownShouldOpen({ open: defaultBehavior }: any): boolean {
            const hasPendingCreation = this.canCreate && this.pendingCreation !== null;

            // - Si on est sur un select multiple, qu'il n'y a PLUS d'options sélectionnable
            //   et que l'on ne peut pas en créer ou qu'on est pas en train de le faire, on
            //   n'affiche pas le dropdown.
            if (
                this.multiple &&
                this.options.length > 0 &&
                this.filteredOptions.length === 0 &&
                (!this.canCreate || !hasPendingCreation)
            ) {
                return false;
            }

            return defaultBehavior;
        },

        isOptionMatchingSearch(option: string | Option, label: string, search: string): boolean {
            return stringIncludes(label, search);
        },

        isOptionSelectable(option: string | Option): boolean {
            return typeof option !== 'object' || !option.disabled;
        },

        __(key: string, params?: Record<string, number | string>, count?: number): string {
            key = !key.startsWith('global.')
                ? `components.Select.${key}`
                : key.replace(/^global\./, '');

            return this.$t(key, params, count);
        },

        // ------------------------------------------------------
        // -
        // -    API Publique
        // -
        // ------------------------------------------------------

        /**
         * Permet de donner le focus au champ de recherche du sélecteur.
         */
        focus() {
            const $input = this.$refs.input as ComponentRef<typeof VueSelect> | undefined;
            $input?.searchEl?.focus();
        },
    },
    render() {
        const hasCustomSearcher = this.searcher !== undefined;
        const {
            __,
            name,
            value,
            createLabel,
            filteredOptions: options,
            selected,
            multiple,
            inheritedInvalid: invalid,
            inheritedDisabled: disabled,
            highlight,
            clearable,
            renderer,
            autocomplete,
            isOptionSelectable,
            isOptionMatchingSearch,
            dropdownShouldOpen,
            formattedPlaceholder,
            noOptionsRenderer,
            canCreate,
            handleInput,
            handleSearch,
            handleOptionCreating,
            handleOptionCreate,
        } = this;

        const renderHiddenInput = (): JSX.Element | null => {
            if (!name || disabled) {
                return null;
            }

            if (multiple && Array.isArray(value)) {
                return (
                    <Fragment>
                        <input type="hidden" name={name} value="" />
                        {(value as Array<string | number>).map((_value: string | number) => (
                            <input
                                key={_value}
                                type="hidden"
                                name={`${name}[]`}
                                value={_value}
                            />
                        ))}
                    </Fragment>
                );
            }

            return <input type="hidden" name={name} value={value ?? ''} />;
        };

        const className = ['Select', {
            'Select--invalid': invalid,
            'Select--highlight': highlight,
        }];

        return (
            <div class={className}>
                <VueSelect
                    ref="input"
                    class="Select__input"
                    disabled={disabled}
                    clearable={clearable}
                    placeholder={formattedPlaceholder}
                    autocomplete={autocomplete}
                    multiple={multiple}
                    options={options}
                    value={selected}
                    taggable={!hasCustomSearcher && canCreate}
                    filterable={!hasCustomSearcher}
                    components={icons}
                    clearSearchOnBlur={() => true}
                    closeOnSelect={!multiple}
                    createOption={handleOptionCreating}
                    dropdownShouldOpen={dropdownShouldOpen}
                    filterBy={isOptionMatchingSearch}
                    selectable={isOptionSelectable}
                    onSearch={handleSearch}
                    onInput={handleInput}
                    scopedSlots={{
                        'selected-option': (option: Option | { label: Option['value'] }) => {
                            // - Récupère l'option d'origine, voir le code ci-dessous.
                            //   https://github.com/sagalbot/vue-select/blob/v3.20.4/src/components/Select.vue#L1231
                            const originalOption: Option | OptionValue = (
                                Object.keys(option).length > 1 || !('label' in option)
                                    ? option as Option
                                    : option.label
                            );
                            return renderer?.(originalOption as any, true) ?? option.label;
                        },
                        'option': (option: Option | { label: Option['value'] }) => {
                            if (
                                this.pendingCreation !== null &&
                                this.pendingCreation === option.label
                            ) {
                                return (
                                    <span class="Select__option Select__option--new">
                                        {(
                                            createLabel !== undefined
                                                ? (typeof createLabel === 'function' ? createLabel(option.label) : createLabel)
                                                : __('create-label', { label: option.label })
                                        )}
                                    </span>
                                );
                            }

                            // - Récupère l'option d'origine, voir le code ci-dessous.
                            //   https://github.com/sagalbot/vue-select/blob/v3.20.4/src/components/Select.vue#L1231
                            const originalOption: Option | OptionValue = (
                                Object.keys(option).length > 1 || !('label' in option)
                                    ? option as Option
                                    : option.label
                            );

                            return (
                                <span class="Select__option">
                                    {renderer?.(originalOption as any, false) ?? option.label}
                                </span>
                            );
                        },
                        'no-options': ({ search: currentSearch }: { search: string }) => {
                            if (hasCustomSearcher && currentSearch.length > 0 && currentSearch.length < MIN_CUSTOM_SEARCHER_CHARS) {
                                return __(
                                    'global.type-at-least-count-chars-to-search',
                                    { count: MIN_CUSTOM_SEARCHER_CHARS - currentSearch.length },
                                    MIN_CUSTOM_SEARCHER_CHARS - currentSearch.length,
                                );
                            }

                            if (noOptionsRenderer !== undefined) {
                                const result = noOptionsRenderer(currentSearch);
                                if (result !== null) {
                                    return result;
                                }
                            }

                            if (hasCustomSearcher) {
                                if (currentSearch.length <= 0) {
                                    return __('global.start-typing-to-search');
                                }

                                if (!canCreate) {
                                    return __('global.no-result-found-try-another-search');
                                }

                                return (
                                    <div class="Select__no-results">
                                        <p class="Select__no-results__message">
                                            {__('global.no-result-found-try-another-search')}
                                        </p>
                                        <Button
                                            type="add"
                                            size="small"
                                            class="Select__no-results__create-action"
                                            onClick={() => { handleOptionCreate(currentSearch); }}
                                        >
                                            {(
                                                createLabel !== undefined
                                                    ? (typeof createLabel === 'function' ? createLabel(currentSearch) : createLabel)
                                                    : __('create-label', { label: currentSearch })
                                            )}
                                        </Button>
                                    </div>
                                );
                            }

                            if (currentSearch.length === 0 || options.length === 0) {
                                return __('no-options');
                            }

                            return __('no-matching-result');
                        },
                    }}
                    clearSearchOnSelect
                    appendToBody
                />
                {renderHiddenInput()}
            </div>
        );
    },
});

//
// - Exports
//

export type { Options, Option } from './_types';

type SelectGeneric = <
    ValueType extends OptionValue,
    ExtraData,
    InnerOptions extends LooseOptions<ValueType, ExtraData>,
    IsMultiple extends boolean = false,
    Placeholder extends boolean | string = true,
>(props: Props<ValueType, ExtraData, InnerOptions, IsMultiple, Placeholder>) => JSX.Element;

export type SelectRef = ComponentRef<typeof Select>;
export default Select as any as SelectGeneric;
