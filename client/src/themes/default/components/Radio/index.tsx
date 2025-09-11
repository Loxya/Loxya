import './index.scss';
import { defineComponent } from 'vue';
import generateUniqueId from 'lodash/uniqueId';

import type { PropType } from 'vue';

type Option = {
    /** Le libellé qui sera affiché pour cette option. */
    label: string,

    /** La valeur de l'option. */
    value: string,
};

type Props = {
    /**
     * Le nom du champ (attribut `[name]`).
     *
     * Ceci permettra notamment de récupérer la valeur du champ dans
     * le jeu de données d'un formulaire parent lors de la soumission
     * (`submit`) de celui-ci.
     */
    name?: string,

    /**
     * Les options du champ radio.
     *
     * Doit être fournie sous forme de tableau d'objet (Une option = Un objet).
     * Voir le type {@link Option} pour plus de détails sur le format de chaque option.
     */
    options: Option[],

    /**
     * Valeur actuellement sélectionnée.
     *
     * Si `null` est passé, aucune valeur ne sera sélectionnée.
     */
    value: string | null,

    /** Le champ est-il désactivé ? */
    disabled?: boolean,

    /** Le champ doit-il être marqué comme invalide ? */
    invalid?: boolean,

    /**
     * Fonction appelée lorsque la valeur du champ change.
     *
     * @param newValue - La nouvelle valeur du champ.
     */
    onInput?(newValue: string): void,

    /**
     * Fonction appelée lorsque la valeur du champ change.
     *
     * @param newValue - La nouvelle valeur du champ.
     */
    onChange?(newValue: string): void,
};

type InstanceProperties = {
    uniqueId: string | undefined,
};

type Data = {
    componentKey: number,
};

/** Groupe de champ de formulaire de type "radio". */
const Radio = defineComponent({
    name: 'Radio',
    inject: {
        'input.invalid': { default: false },
        'input.disabled': { default: false },
    },
    props: {
        name: {
            type: String as PropType<Props['name']>,
            default: undefined,
        },
        options: {
            type: Array as PropType<Props['options']>,
            required: true,
            validator: (options: unknown) => {
                if (!Array.isArray(options)) {
                    return false;
                }

                return options.every((option: unknown) => {
                    if (typeof option !== 'object' || option === null) {
                        return false;
                    }

                    return ['label', 'value'].every((field: string) => (
                        ['string', 'number'].includes(typeof (option as any)[field])
                    ));
                });
            },
        },
        value: {
            type: String as PropType<Props['value']>,
            required: true,
        },
        disabled: {
            type: Boolean as PropType<Props['disabled']>,
            default: undefined,
        },
        invalid: {
            type: Boolean as PropType<Props['invalid']>,
            default: undefined,
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
        uniqueId: undefined,
    }),
    data: (): Data => ({
        componentKey: 0,
    }),
    computed: {
        inheritedInvalid(): boolean {
            if (this.invalid !== undefined) {
                return this.invalid;
            }

            // @ts-expect-error -- Normalement fixé lors du passage à Vue 3 (et son meilleur typage).
            // @see https://github.com/vuejs/core/pull/6804
            return this['input.invalid'];
        },

        inheritedDisabled(): boolean {
            if (this.disabled !== undefined) {
                return this.disabled;
            }

            // @ts-expect-error -- Normalement fixé lors du passage à Vue 3 (et son meilleur typage).
            // @see https://github.com/vuejs/core/pull/6804
            return this['input.disabled'];
        },
    },
    created() {
        const { $options } = this;

        this.uniqueId = generateUniqueId(`${$options.name!}-`);
    },
    methods: {
        handleSelect(event: MouseEvent) {
            this.$forceRerender();

            if (this.inheritedDisabled) {
                return;
            }

            const newValue = (event.target! as HTMLInputElement).value;
            this.$emit('input', newValue);
            this.$emit('change', newValue);
        },

        // ------------------------------------------------------
        // -
        // -    Méthodes internes
        // -
        // ------------------------------------------------------

        $forceRerender() {
            this.componentKey += 1;
        },
    },
    render() {
        const {
            uniqueId,
            componentKey,
            name,
            value,
            options,
            inheritedDisabled: disabled,
            inheritedInvalid: invalid,
            handleSelect,
        } = this;

        const className = ['Radio', {
            'Radio--invalid': invalid,
            'Radio--disabled': disabled,
        }];

        const renderHiddenInput = (): JSX.Element | null => {
            if (!name || disabled) {
                return null;
            }
            return <input type="hidden" name={name} value="" />;
        };

        return (
            <div class={className}>
                <div class="Radio__choices">
                    {options.map((option: Option) => {
                        const active = value !== null && option.value === value;

                        return (
                            <div key={option.value} class="Radio__choice">
                                <input
                                    // - Requis pour "controller" le component, sans quoi
                                    //   Vue ne respecte pas le `checked`...
                                    key={`${componentKey}--${option.value}`}
                                    id={`${uniqueId!}--${option.value}`}
                                    class="Radio__choice__radio"
                                    type="radio"
                                    name={name}
                                    value={option.value}
                                    disabled={disabled}
                                    checked={active}
                                    onClick={handleSelect}
                                />
                                <label
                                    for={`${uniqueId!}--${option.value}`}
                                    class="Radio__choice__label"
                                >
                                    {option.label}
                                </label>
                            </div>
                        );
                    })}
                </div>
                {renderHiddenInput()}
            </div>
        );
    },
});

export default Radio;
