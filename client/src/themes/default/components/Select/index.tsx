import './index.scss';
import { defineComponent } from 'vue';
import stringIncludes from '@/utils/stringIncludes';
import VueSelect from 'vue-select';
import Button from '@/themes/default/components/Button';
import Fragment from '@/components/Fragment';
import icons from './icons';

import type { PropType, ComponentRef } from 'vue';
import type { DebouncedFunc } from 'lodash';

export type Option = {
    /** Le libellé qui sera affiché pour cette option. */
    label: string,

    /** La valeur de l'option. */
    value: string | number,
};

type LooseOptions = string[] | Option[];
type SearcherFunc = (search: string) => Promise<void> | void;

/** Retourne le type de valeur des options. */
type ValuesOf<T extends readonly unknown[], TO = T[number]> = (
    TO extends { value: infer V } ? V
        : TO extends string | number ? TO
            : never
);

type Props<
    Options extends LooseOptions = LooseOptions,
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
            ? Array<ValuesOf<Options>>
            : ValuesOf<Options>
    ) | NullValue,

    /**
     * Les options du champ select.
     *
     * Doit être fournie sous forme de tableau d'objet (Une option = Un objet).
     * Voir le type {@link Option} pour plus de détails sur le format de chaque option.
     * Peut également être fourni sous la forme d'un tableau de simples chaînes de caractères.
     */
    options: Options,

    /**
     * Fonction appelée lorsque la valeur du select change.
     *
     * @param newValue - La nouvelle valeur du select.
     */
    onInput?: IsMultiple extends true
        ? (newValue: Array<ValuesOf<Options>> | NullValue) => void
        : (newValue: ValuesOf<Options> | NullValue) => void,

    /**
     * Fonction appelée lorsque la valeur du select change.
     *
     * @param newValue - La nouvelle valeur du select.
     */
    onChange?: IsMultiple extends true
        ? (newValue: Array<ValuesOf<Options>> | NullValue) => void
        : (newValue: ValuesOf<Options> | NullValue) => void,

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

type SelectedValue = string | Option | Array<string | Option> | null;

/** Un champ de formulaire de type sélecteur. */
const Select = defineComponent({
    name: 'Select',
    inject: {
        'input.invalid': { default: false },
        'input.disabled': { default: false },
    },
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
                    ['number', 'string'].includes(typeof _value)
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

                    return ['label', 'value'].every((field: string) => (
                        ['string', 'number'].includes(typeof (option as any)[field])
                    ));
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

        filteredOptions(): string[] | Option[] {
            const { options, value } = this;

            if (value === null || !this.multiple) {
                return options;
            }

            // Note: Si c'est une sélection multiple, on ne repropose
            //       pas les options déjà sélectionnées.
            return options.filter((option: string | number | Option) => {
                const stringifiedOption = (typeof option === 'object' ? option.value : option).toString();
                return (!Array.isArray(value) ? [value] : value).every(
                    (_value: string | number): boolean => (
                        stringifiedOption !== _value.toString()
                    ),
                );
            }) as string[] | Option[];
        },

        inheritedInvalid(): boolean {
            if (this.invalid !== undefined) {
                return this.invalid;
            }

            // @ts-expect-error -- Normalement corrigé lors du passage à Vue 3 (et son meilleur typage).
            // @see https://github.com/vuejs/core/pull/6804
            return this['input.invalid'];
        },

        inheritedDisabled(): boolean {
            if (this.disabled !== undefined) {
                return this.disabled;
            }

            // @ts-expect-error -- Normalement corrigé lors du passage à Vue 3 (et son meilleur typage).
            // @see https://github.com/vuejs/core/pull/6804
            return this['input.disabled'];
        },

        selected(): SelectedValue {
            const { options, value } = this;

            if (value === null) {
                return null;
            }

            if (this.multiple) {
                return (!Array.isArray(value) ? [value] : value).reduce(
                    (selection: Array<string | Option>, _value: string | number) => {
                        const stringifiedValue = _value.toString();
                        const option = options.find((_option: string | Option) => {
                            const rawOption = typeof _option === 'object' ? _option.value : _option;
                            return rawOption.toString() === stringifiedValue;
                        });
                        return option !== undefined ? selection.concat(option) : selection;
                    },
                    [],
                );
            }

            return options.find((option: string | number | Option) => {
                option = typeof option === 'object' && option !== null
                    ? option.value
                    : option;

                return value.toString() === option.toString();
            }) ?? null;
        },

        clearable() {
            return this.placeholder !== false;
        },
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

            let selection: string | number | Array<string | number> | null = null;
            if (this.multiple) {
                if (selected === null) {
                    selected = [];
                }

                if (!Array.isArray(selected)) {
                    selected = [selected];
                }

                selection = selected.map((item: string | number | Option) => (
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

        handleOptionCreating(input: any): string | number | Option | undefined {
            if (!this.canCreate || typeof input !== 'string') {
                this.pendingCreation = null;
                return undefined;
            }

            // - Si la valeur recherchée correspond parfaitement à un autre
            //   option, on ne propose pas de création mais l'option existante.
            const existingOption = this.options.find((option: string | number | Option) => {
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

        __(key: string, params?: Record<string, number | string>, count?: number): string {
            key = !key.startsWith('global.')
                ? `components.Select.${key}`
                : key.replace(/^global\./, '');

            return this.$t(key, params, count);
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
            autocomplete,
            isOptionMatchingSearch,
            dropdownShouldOpen,
            formattedPlaceholder,
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
                        {value.map((_value: Option['value']) => (
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
                    onSearch={handleSearch}
                    onInput={handleInput}
                    scopedSlots={{
                        'no-options': ({ searching, search }: { search: string, searching: boolean }) => {
                            if (hasCustomSearcher) {
                                if (search.length === 0) {
                                    return __('global.start-typing-to-search');
                                }

                                if (search.length > 0 && search.length < MIN_CUSTOM_SEARCHER_CHARS) {
                                    return __(
                                        'global.type-at-least-count-chars-to-search',
                                        { count: MIN_CUSTOM_SEARCHER_CHARS - search.length },
                                        MIN_CUSTOM_SEARCHER_CHARS - search.length,
                                    );
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
                                            onClick={() => { handleOptionCreate(search); }}
                                        >
                                            {(
                                                createLabel !== undefined
                                                    ? (typeof createLabel === 'function' ? createLabel(search) : createLabel)
                                                    : __('create-label', { label: search })
                                            )}
                                        </Button>
                                    </div>
                                );
                            }

                            if (!searching || options.length === 0) {
                                return __('no-options');
                            }
                            return __('no-matching-result');
                        },
                        'option': ({ label }: Option) => {
                            if (
                                this.pendingCreation !== null &&
                                this.pendingCreation === label
                            ) {
                                return (
                                    <span class="Select__option Select__option--new">
                                        {(
                                            createLabel !== undefined
                                                ? (typeof createLabel === 'function' ? createLabel(label) : createLabel)
                                                : __('create-label', { label })
                                        )}
                                    </span>
                                );
                            }

                            return (
                                <span class="Select__option">
                                    {label}
                                </span>
                            );
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

type SelectGeneric = <
    Options extends LooseOptions,
    IsMultiple extends boolean = false,
    Placeholder extends boolean | string = true,
>(props: Props<Options, IsMultiple, Placeholder>) => JSX.Element;

export type SelectRef = ComponentRef<typeof Select>;
export default Select as any as SelectGeneric;
