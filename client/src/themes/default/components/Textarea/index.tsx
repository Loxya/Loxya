import './index.scss';
import { computed, defineComponent, inject } from 'vue';
import { DisabledKey, InvalidKey } from '@/themes/default/components/@constants';

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
    value?: string | number | null,

    /**
     * Le nombre de lignes qui doivent être affichées dans la zone de rédaction.
     *
     * @default 3
     */
    rows?: number,

    /**
     * L'éventuel texte affiché en filigrane dans le
     * champ quand celui-ci est vide.
     */
    placeholder?: string,

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
     * @param newValue - La nouvelle valeur du bloc-note.
     */
    onChange?(newValue: string): void,
};

type InstanceProperties = {
    injectedInvalid: Injected<typeof InvalidKey>,
    injectedDisabled: Injected<typeof DisabledKey>,
};

/** Un champ permettant d'éditer du texte sur plusieurs lignes (= `<textarea>`). */
const Textarea = defineComponent({
    name: 'Textarea',
    props: {
        name: {
            type: String as PropType<Props['name']>,
            default: undefined,
        },
        value: {
            type: [String, Number] as PropType<Props['value']>,
            default: undefined,
        },
        rows: {
            type: Number as PropType<Required<Props>['rows']>,
            default: 3,
        },
        placeholder: {
            type: String as PropType<Props['placeholder']>,
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
        injectedInvalid: inject(InvalidKey, computed(() => false)),
        injectedDisabled: inject(DisabledKey, computed(() => false)),
    }),
    computed: {
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
    },
    methods: {
        // ------------------------------------------------------
        // -
        // -    Handlers
        // -
        // ------------------------------------------------------

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

        // ------------------------------------------------------
        // -
        // -    API Publique
        // -
        // ------------------------------------------------------

        /**
         * Permet de donner le focus au textarea.
         */
        focus() {
            const $textarea = this.$refs.textarea as HTMLTextAreaElement | undefined;
            $textarea?.focus();
        },
    },
    render() {
        const {
            name,
            rows,
            value,
            inheritedInvalid: invalid,
            inheritedDisabled: disabled,
            placeholder,
            handleInput,
            handleChange,
        } = this;

        const className = ['Textarea', {
            'Textarea--invalid': invalid,
        }];

        return (
            <textarea
                ref="textarea"
                class={className}
                name={name}
                value={value ?? undefined}
                rows={rows}
                disabled={disabled}
                placeholder={placeholder}
                onInput={handleInput}
                onChange={handleChange}
            />
        );
    },
});

export default Textarea;
