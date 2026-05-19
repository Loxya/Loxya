import './index.scss';
import { computed, defineComponent, inject } from 'vue';
import { DisabledKey } from '@/themes/default/components/@constants';

import type { Injected, PropType } from 'vue';

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
     * Valeur actuelle du champ.
     *
     * Si cette prop. est omise, le component ne sera pas "contrôlé".
     */
    value?: string | number,

    /**
     * Dois-t'on donner le focus au champ lorsque le component est monté ?
     * (cette prop. est incompatible avec la prop. `readonly`)
     */
    autofocus?: boolean,

    /**
     * Le champ est-il désactivé ?
     * (cette prop. est incompatible avec la prop. `readonly`)
     */
    disabled?: boolean,

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
    injectedDisabled: Injected<typeof DisabledKey>,
};

/**
 * champ de saisie multi-ligne avec une
 * interface type "bloc-note".
 */
const Notepad = defineComponent({
    name: 'Notepad',
    props: {
        name: {
            type: String as PropType<Props['name']>,
            default: undefined,
        },
        value: {
            type: [String, Number] as PropType<Props['value']>,
            default: undefined,
        },
        autofocus: {
            type: Boolean as PropType<Required<Props>['autofocus']>,
            default: false,
        },
        disabled: {
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
    setup: (): InstanceProperties => ({
        injectedDisabled: inject(DisabledKey, computed(() => false)),
    }),
    computed: {
        inheritedDisabled(): boolean {
            if (this.disabled !== undefined) {
                return this.disabled;
            }
            return !!this.injectedDisabled;
        },
    },
    mounted() {
        if (this.autofocus && !this.disabled) {
            this.$nextTick(() => {
                const $input = this.$refs.input as HTMLTextAreaElement | undefined;
                $input?.focus();
            });
        }
    },
    methods: {
        handleInput(e: Event) {
            const { value } = e.target as HTMLTextAreaElement;
            if (this.inheritedDisabled) {
                return;
            }
            this.$emit('input', value);
        },

        handleChange(e: Event) {
            const { value } = e.target as HTMLTextAreaElement;
            if (this.inheritedDisabled) {
                return;
            }
            this.$emit('change', value);
        },
    },
    render() {
        const {
            name,
            value,
            inheritedDisabled: disabled,
            handleInput,
            handleChange,
        } = this;

        const className = ['Notepad', {
            'Notepad--disabled': disabled,
        }];

        return (
            <div class={className}>
                <textarea
                    ref="input"
                    class="Notepad__input"
                    name={name}
                    value={value}
                    onInput={handleInput}
                    onChange={handleChange}
                    disabled={disabled}
                />
            </div>
        );
    },
});

export default Notepad;
