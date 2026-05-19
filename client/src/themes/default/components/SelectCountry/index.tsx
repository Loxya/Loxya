import Country from '@/utils/country';
import { computed, defineComponent, inject } from 'vue';
import Select from '@/themes/default/components/Select';
import { DisabledKey } from '@/themes/default/components/@constants';

import type { Injected, PropType } from 'vue';
import type { Options } from '@/themes/default/components/Select';

type Props<
    Placeholder extends boolean | string = boolean | string,
    NullValue = Placeholder extends false ? never : null,
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

    /** Pays actuellement sélectionné. */
    value: Country | NullValue,

    /**
     * Fonction appelée lorsque la valeur du select change.
     *
     * @param newValue - La nouvelle valeur du select.
     */
    onInput?(newValue: Country | NullValue): void,

    /**
     * Fonction appelée lorsque la valeur du select change.
     *
     * @param newValue - La nouvelle valeur du select.
     */
    onChange?(newValue: Country | NullValue): void,
};

type InstanceProperties = {
    injectedDisabled: Injected<typeof DisabledKey>,
};

/** Un champ de formulaire de type sélecteur. */
const SelectCountry = defineComponent({
    name: 'SelectCountry',
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
        value: {
            // TODO [vue@>3]: Mettre `[String, Country, null]` en Vue 3.
            // @see https://github.com/vuejs/core/issues/3948#issuecomment-860466204
            type: null as unknown as PropType<Props['value']>,
            required: true,
            validator: (value: unknown): boolean => {
                if (value === null) {
                    return true;
                }

                // - Code de pays.
                if (typeof value === 'string') {
                    return Country.all().some((country: Country) => (
                        country.code === value
                    ));
                }

                return value instanceof Country;
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
    },
    emits: ['input', 'change'],
    setup: (): InstanceProperties => ({
        injectedDisabled: inject(DisabledKey, computed(() => false)),
    }),
    computed: {
        allCountries(): Country[] {
            return Country.all();
        },

        options(): Options<string, Country> {
            return this.allCountries.map((country: Country) => ({
                label: country.name,
                value: country.code,
                data: country,
            }));
        },

        inheritedDisabled(): boolean {
            if (this.disabled !== undefined) {
                return this.disabled;
            }
            return !!this.injectedDisabled;
        },

        selected(): string | null {
            const { value } = this;

            return value !== null
                ? new Country(value).code
                : null;
        },
    },
    methods: {
        // ------------------------------------------------------
        // -
        // -    Handlers
        // -
        // ------------------------------------------------------

        handleInput(selected: string | null) {
            if (this.inheritedDisabled) {
                return;
            }

            const selection: Country | null = selected === null ? null : (
                this.allCountries.find((country: Country) => (
                    country.code === selected
                )) ?? null
            );
            this.$emit('input', selection);
        },

        handleChange(selected: string | null) {
            if (this.inheritedDisabled) {
                return;
            }

            const selection: Country | null = selected === null ? null : (
                this.allCountries.find((country: Country) => (
                    country.code === selected
                )) ?? null
            );
            this.$emit('change', selection);
        },
    },
    render() {
        const {
            name,
            options,
            selected,
            invalid,
            inheritedDisabled: disabled,
            highlight,
            placeholder,
            autocomplete,
            handleInput,
            handleChange,
        } = this;

        return (
            <Select
                name={name}
                value={selected}
                invalid={invalid}
                disabled={disabled}
                highlight={highlight}
                placeholder={placeholder}
                autocomplete={autocomplete}
                options={options}
                onInput={handleInput}
                onChange={handleChange}
            />
        );
    },
});

export default SelectCountry;
