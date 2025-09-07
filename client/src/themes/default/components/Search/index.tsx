import './index.scss';
import { z } from '@/utils/validation';
import { computed, defineComponent } from 'vue';
import { RawTokenSchema } from './_schemas';
import Icon from '@/themes/default/components/Icon';
import generateUniqueId from 'lodash/uniqueId';

import type { PropType } from 'vue';

type Props = {
    /**
     * La valeur de la recherche.
     *
     * Cette prop. permet de contrôler le component.
     */
    value?: string | null,

    /**
     * La valeur par défaut de la recherche.
     *
     * /!\ Attention, cette prop. ne peut pas être utilisée pour "contrôler" le component.
     *     Utilisez la prop. `value` pour cela.
     */
    defaultValue?: string | null,

    /**
     * L'éventuel texte affiché en filigrane dans le
     * champ quand celui-ci est vide.
     *
     * @default "Recherche"
     */
    placeholder?: string,

    /**
     * Fonction appelée lorsque la recherche change.
     *
     * @param newValue - La nouvelle valeur de recherche.
     */
    onChange?(newValue: string | null): void,

    /**
     * Fonction appelée lors de la soumission de la recherche.
     *
     * @param value - La valeur soumise.
     */
    onSubmit?(value: string | null): void,
};

type Data = {
    inputValue: string,
    portalPositionX: Position['x'],
};

type InstanceProperties = {
    portalId: string,
};

/* Champ de recherche. */
const Search = defineComponent({
    name: 'Search',
    provide() {
        return {
            searchPortalId: computed(() => this.portalId),
            alignSearchPortal: ($target: HTMLElement) => {
                this.alignPortal($target);
            },
        };
    },
    props: {
        value: {
            // TODO [vue@>3]: Mettre `[Array, String, undefined, null]` en Vue 3.
            // @see https://github.com/vuejs/core/issues/3948#issuecomment-860466204
            type: [Array, String] as PropType<Props['value']>,
            default: undefined,
            validator: (value: unknown) => (
                z.union([z.array(RawTokenSchema), z.string(), z.null()])
                    .safeParse(value).success
            ),
        },
        defaultValue: {
            // TODO [vue@>3]: Mettre `[Array, String, null]` en Vue 3.
            // @see https://github.com/vuejs/core/issues/3948#issuecomment-860466204
            type: [Array, String] as PropType<Required<Props>['defaultValue']>,
            default: null,
            validator: (value: unknown) => (
                z.union([z.array(RawTokenSchema), z.string(), z.null()])
                    .safeParse(value).success
            ),
        },
        placeholder: {
            type: String as PropType<Props['placeholder']>,
            default: undefined,
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
    emits: ['submit', 'change'],
    setup: (): InstanceProperties => ({
        portalId: generateUniqueId(`Search--portal-`),
    }),
    data(): Data {
        return {
            inputValue: this.value ?? this.defaultValue ?? '',
            portalPositionX: 0,
        };
    },
    computed: {
        normalizedPlaceholder(): string {
            const { __, placeholder } = this;

            return placeholder ?? __('placeholder');
        },

        hasValue(): boolean {
            return !!this.value;
        },
    },
    methods: {
        // ------------------------------------------------------
        // -
        // -    Handlers
        // -
        // ------------------------------------------------------

        handleInput(e: InputEvent) {
            const { value } = e.target! as HTMLInputElement;
            this.inputValue = value;
            this.$emit('change', value);
        },

        handleClear() {
            this.inputValue = '';
            this.$emit('change', '');
        },

        handleSubmit() {
            this.$emit('submit', this.inputValue);
        },

        // ------------------------------------------------------
        // -
        // -    Public API
        // -
        // ------------------------------------------------------

        /**
         * Permet de donner le focus au champ de recherche.
         */
        focus() {
            const $input = this.$refs.input as HTMLInputElement | undefined;
            if ($input !== undefined) {
                $input.focus();
                $input.scrollIntoView({ block: 'nearest', inline: 'end' });
            }
        },

        // ------------------------------------------------------
        // -
        // -    Méthodes internes
        // -
        // ------------------------------------------------------

        alignPortal($target: HTMLElement): void {
            const offsetRef = $target.getBoundingClientRect().left;
            const offsetMenu = this.$el.getBoundingClientRect().left;
            this.portalPositionX = Math.floor(offsetRef - offsetMenu);
        },

        __(key: string, params?: Record<string, number | string>, count?: number): string {
            key = !key.startsWith('global.')
                ? `components.Search.${key}`
                : key.replace(/^global\./, '');

            return this.$t(key, params, count);
        },
    },
    render() {
        const {
            hasValue,
            inputValue,
            normalizedPlaceholder: placeholder,
            handleInput,
            handleClear,
            handleSubmit,
        } = this;

        return (
            <div class="Search">
                <div class="Search__body">
                    <div class="Search__input">
                        <input
                            ref="input"
                            type="text"
                            autocomplete="off"
                            class="Search__input__field"
                            placeholder={placeholder}
                            value={inputValue}
                            onInput={handleInput}
                        />
                        {hasValue && (
                            <button type="button" class="Search__input__clear" onClick={handleClear}>
                                <Icon name="times-circle" />
                            </button>
                        )}
                    </div>
                    <button type="button" class="Search__button" onClick={handleSubmit}>
                        <Icon name="search" />
                    </button>
                </div>
            </div>
        );
    },
});

export type {
    RawToken as Token,
    RawCustomToken as CustomToken,
    TokenDefinition,
    TokenOptions,
    TokenOption,
    TokenValue,
} from './_types';

export {
    TokenDefinitionSchema,
    TokenValueSchema,
} from './_schemas';

export default Search;
