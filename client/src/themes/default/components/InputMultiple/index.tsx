import './index.scss';
import Draggable from 'vuedraggable';
import { defineComponent } from 'vue';
import Input, { InputType } from '@/themes/default/components/Input';
import Icon from '@/themes/default/components/Icon';
import Button from '@/themes/default/components/Button';
import Fragment from '@/components/Fragment';

import type { PropType } from 'vue';

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
     * Type des champs (e.g. `text`, `email`, etc.).
     * @see {@link InputType} pour les types possibles.
     *
     * @default {@link InputType.TEXT}
     */
    type?: InputType,

    /** Valeurs actuelles. */
    value: Array<string | number> | null,

    /**
     * Fonction appelée immédiatement lorsque la valeur du
     * champ change suite à une action utilisateur.
     *
     * @param newValue - Les nouvelles valeurs du champ.
     */
    onInput?(newValues: Array<string | number>): void,

    /**
     * Fonction appelée lorsque la valeur du champ a changé,
     * lorsque le champ perd le focus.
     *
     * @param newValue - Les nouvelles valeurs du champ.
     */
    onChange?(newValues: Array<string | number>): void,
};

/**
 * Champ de formulaire permettant de renseigner
 * plusieurs valeurs textuelles.
 */
const InputMultiple = defineComponent({
    name: 'InputMultiple',
    props: {
        name: {
            type: String as PropType<Props['name']>,
            default: undefined,
        },
        type: {
            type: String as PropType<Required<Props>['type']>,
            default: InputType.TEXT,
            validator: (value: unknown): boolean => (
                typeof value === 'string' &&
                (Object.values(InputType) as string[]).includes(value)
            ),
        },
        value: {
            type: Array as PropType<Required<Props>['value']>,
            default: null,
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
    computed: {
        values(): Array<string | number> {
            return [...(this.value ?? [])];
        },

        withDragging(): boolean {
            return this.values.length >= 2;
        },
    },
    methods: {
        // ------------------------------------------------------
        // -
        // -    Handlers
        // -
        // ------------------------------------------------------

        handleAddItem() {
            const newValues = [...this.values, ''];
            this.$emit('input', newValues);
            this.$emit('change', newValues);
        },

        handleRemoveItem(index: number) {
            const newValues = this.values.toSpliced(index, 1);
            this.$emit('input', newValues);
            this.$emit('change', newValues);
        },

        handleInputChange(index: number, value: string | number) {
            const newValues = this.values.toSpliced(index, 1, value);
            this.$emit('input', newValues);
            this.$emit('change', newValues);
        },

        handleDrag(newValues: Array<string | number>) {
            this.$emit('input', newValues);
            this.$emit('change', newValues);
        },

        // ------------------------------------------------------
        // -
        // -    Méthodes internes
        // -
        // ------------------------------------------------------

        __(key: string, params?: Record<string, number | string>, count?: number): string {
            key = !key.startsWith('global.')
                ? `components.InputMultiple.${key}`
                : key.replace(/^global\./, '');

            return this.$t(key, params, count);
        },
    },
    render() {
        const {
            __,
            name,
            type,
            values,
            withDragging,
            handleDrag,
            handleAddItem,
            handleRemoveItem,
            handleInputChange,
        } = this;

        const classNames = ['InputMultiple', {
            'InputMultiple--with-dragging': withDragging,
        }];

        const renderHiddenInput = (): JSX.Element | null => {
            if (!name) {
                return null;
            }

            return (
                <Fragment>
                    <input type="hidden" name={name} value="" />
                    {values.map((value: string | number) => (
                        <input
                            key={value}
                            type="hidden"
                            name={`${name}[]`}
                            value={value}
                        />
                    ))}
                </Fragment>
            );
        };

        return (
            <div class={classNames}>
                {values.length > 0 && (
                    <Draggable
                        tag="ul"
                        value={values}
                        class="InputMultiple__list"
                        onInput={(newValues: Array<string | number>) => {
                            handleDrag(newValues);
                        }}
                    >
                        {values.map((value: string | number, index: number) => (
                            <li key={index} class="InputMultiple__list__item">
                                <span class="InputMultiple__item">
                                    {withDragging && (
                                        <span class="InputMultiple__item__drag-handle">
                                            <Icon
                                                name="arrows-alt-v"
                                                class="InputMultiple__item__drag-handle__icon"
                                            />
                                        </span>
                                    )}
                                    <Input
                                        type={type}
                                        value={value}
                                        class="InputMultiple__item__input"
                                        onInput={(_value: string | number) => {
                                            handleInputChange(index, _value);
                                        }}
                                    />
                                    <Button
                                        icon="trash"
                                        type="danger"
                                        aria-label={__('remove-item')}
                                        onClick={() => { handleRemoveItem(index); }}
                                        class="InputMultiple__item__remove"
                                    />
                                </span>
                            </li>
                        ))}
                    </Draggable>
                )}
                <Button
                    type="add"
                    class="InputMultiple__add"
                    onClick={handleAddItem}
                    size="small"
                >
                    {__('add-item')}
                </Button>
                {renderHiddenInput()}
            </div>
        );
    },
});

export { InputType };
export default InputMultiple;
