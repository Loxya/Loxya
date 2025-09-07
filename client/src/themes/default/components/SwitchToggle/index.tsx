import './index.scss';
import invariant from 'invariant';
import { z } from '@/utils/validation';
import { defineComponent } from 'vue';
import Icon from '@/themes/default/components/Icon';

import type { SchemaInfer } from '@/utils/validation';
import type { PropType } from 'vue';

const SwitchOptionSchema = z.strictObject({
    /** Le libellé lié à l'option. */
    label: z.string(),

    /** La valeur de l'option du switch. */
    value: z.union([z.string(), z.number(), z.boolean()]),
});

export type SwitchOption = SchemaInfer<typeof SwitchOptionSchema>;
export type SwitchOptions = [left: SwitchOption, right: SwitchOption];

type Props<T extends SwitchOptions = SwitchOptions> = {
    /**
     * Le nom du champ (attribut `[name]`).
     *
     * Ceci permettra notamment de récupérer la valeur du champ dans
     * le jeu de données d'un formulaire parent lors de la soumission
     * (`submit`) de celui-ci.
     *
     * @default undefined
     */
    name?: string,

    /**
     * Les deux options entres lesquelles l'utilisateur va pouvoir switcher.
     *
     * Par défaut, le champ utilisera un mode minimaliste Oui / Non ou seule
     * l'option actuelle est affichée.
     */
    options?: T,

    /**
     * Valeur actuelle du champ.
     *
     * - Si le champ est un switch de base entres une position "Oui" et "Non", un booléen est attendue.
     * - Sinon, s'il y a deux options customs, la valeur (= `value`) d'une des options est attendue.
     */
    value: T[number]['value'],

    /**
     * Le champ est-il désactivé ?
     *
     * Si la valeur de cette prop. est une chaîne de caractère, le champ sera considéré
     * comme désactivé et la chaîne sera utilisée en tant que raison de la désactivation.
     *
     * @default false
     */
    disabled?: boolean | string,

    /**
     * Permet de cacher les libellés affichés à côté du switch lui-même.
     *
     * @default false
     */
    hideLabels?: boolean | string,

    /**
     * Fonction appelée lorsque la valeur du switch change.
     *
     * @param newValue - La nouvelle valeur du switch.
     */
    onInput?(newValue: T[number]['value']): void,

    /**
     * Fonction appelée lorsque la valeur du switch change.
     *
     * @param newValue - La nouvelle valeur du switch.
     */
    onChange?(newValue: T[number]['value']): void,
};

/** Un sélecteur entre deux options exclusives. */
const SwitchToggle = defineComponent({
    name: 'SwitchToggle',
    inject: {
        'input.disabled': { default: false },
    },
    props: {
        name: {
            type: String as PropType<Required<Props>['name']>,
            default: undefined,
        },
        value: {
            type: [Boolean, String, Number] as PropType<Props['value']>,
            required: true,
        },
        options: {
            type: Array as any as PropType<Props['options']>,
            default: undefined,
            validator: (value: unknown) => {
                const schema = z.tuple([SwitchOptionSchema, SwitchOptionSchema]);
                return schema.safeParse(value).success;
            },
        },
        disabled: {
            type: [Boolean, String] as PropType<Required<Props>['disabled']>,
            default: false,
        },
        hideLabels: {
            type: Boolean as PropType<Required<Props>['disabled']>,
            default: false,
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
    setup(props) {
        const { options, value } = props;

        invariant(
            options === undefined || options[0].value !== options[1].value,
            `All switch values must be unique, identical values passed.`,
        );

        invariant(
            value === (options?.[0].value ?? false) || value === (options?.[1].value ?? true),
            `The provided value should match one of the options value, received \`${value.toString()}\` instead.`,
        );

        return {};
    },
    computed: {
        inheritedDisabled(): boolean | string {
            if (this.disabled !== undefined) {
                return this.disabled;
            }

            // @ts-expect-error -- Normalement fixé lors du passage à Vue 3 (et son meilleur typage).
            // @see https://github.com/vuejs/core/pull/6804
            return this['input.disabled'];
        },

        disabledReason(): string | null {
            if (!this.inheritedDisabled || typeof this.inheritedDisabled !== 'string') {
                return null;
            }

            const reason = this.inheritedDisabled.trim();
            return reason.length > 0 ? reason : null;
        },

        isToggled(): boolean {
            return this.value === (this.options?.[1].value ?? true);
        },
    },
    methods: {
        handleSwitch() {
            if (this.inheritedDisabled) {
                return;
            }
            const { value: prevValue, options } = this;

            const newValue: string | number | boolean = (() => {
                if (options === undefined) {
                    return !prevValue;
                }
                return (prevValue === options[0].value ? options[1] : options[0]).value;
            })();

            this.$emit('input', newValue);
            this.$emit('change', newValue);
        },

        handleKeydown(e: KeyboardEvent) {
            const { key } = e;

            if (this.inheritedDisabled) {
                return;
            }

            const handlers: Record<string, () => void> = {
                ' ': () => {
                    e.preventDefault();

                    this.handleSwitch();
                },
                'ArrowLeft': () => {
                    e.preventDefault();

                    const { value: prevValue, options } = this;
                    const targetValue = options?.[0].value ?? false;

                    if (prevValue !== targetValue) {
                        this.$emit('input', targetValue);
                        this.$emit('change', targetValue);
                    }
                },
                'ArrowRight': () => {
                    e.preventDefault();

                    const { value: prevValue, options } = this;
                    const targetValue = options?.[1].value ?? true;

                    if (prevValue !== targetValue) {
                        this.$emit('input', targetValue);
                        this.$emit('change', targetValue);
                    }
                },
            };

            if (!Object.keys(handlers).includes(key)) {
                return;
            }

            handlers[key]();
        },
    },
    render() {
        const {
            $t: __,
            name,
            value,
            options,
            isToggled,
            inheritedDisabled: disabled,
            disabledReason,
            handleKeydown,
            handleSwitch,
            hideLabels,
        } = this;

        const classNames = ['SwitchToggle', {
            'SwitchToggle--toggled': isToggled,
            'SwitchToggle--highlight': options !== undefined || !!value,
            'SwitchToggle--disabled': !!disabled,
        }];

        const renderLeftLabel = (): JSX.Element | null => {
            if (hideLabels || options === undefined) {
                return null;
            }

            const isActive = value === options[0].value;
            return (
                <span
                    class={['SwitchToggle__label', 'SwitchToggle__label--left', {
                        'SwitchToggle__label--active': isActive,
                        'SwitchToggle__label--inactive': !isActive,
                    }]}
                >
                    {options[0].label}
                </span>
            );
        };

        const renderRightLabel = (): JSX.Element | null => {
            if (hideLabels) {
                return null;
            }

            if (options === undefined) {
                return (
                    <span class="SwitchToggle__label">
                        {value ? __('yes') : __('no')}
                    </span>
                );
            }

            const isActive = value === options[1].value;
            return (
                <span
                    class={['SwitchToggle__label', 'SwitchToggle__label--left', {
                        'SwitchToggle__label--active': isActive,
                        'SwitchToggle__label--inactive': !isActive,
                    }]}
                >
                    {options[1].label}
                </span>
            );
        };

        return (
            <div
                role="switch"
                class={classNames}
                onClick={handleSwitch}
                onKeydown={handleKeydown}
                tabindex={!disabled ? 0 : -1}
                aria-checked={isToggled}
            >
                <div class="SwitchToggle__field">
                    {renderLeftLabel()}
                    <div class="SwitchToggle__slide">
                        <div class="SwitchToggle__slide__button" />
                    </div>
                    {renderRightLabel()}
                    {!!(disabled && disabledReason) && (
                        <Icon
                            name="question-circle"
                            class="SwitchToggle__disabled-reason"
                            tooltip={{
                                content: __('locked-reason', { reason: disabledReason }),
                                placement: 'bottom',
                            }}
                        />
                    )}
                </div>
                {!!(name && !disabled) && (
                    <input
                        type="hidden"
                        name={name}
                        value={(
                            typeof value === 'boolean'
                                ? (value ? '1' : '0')
                                : value
                        )}
                    />
                )}
            </div>
        );
    },
});

export default SwitchToggle;
