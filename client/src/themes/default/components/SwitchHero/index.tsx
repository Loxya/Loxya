import './index.scss';
import { z } from '@/utils/validation';
import { defineComponent } from 'vue';
import SwitchHeroItem, { SwitchHeroSize } from './Item';

import type { SchemaInfer } from '@/utils/validation';
import type { PropType } from 'vue';

const ChoiceSchema = z.strictObject({
    /** La valeur de l'option du switch. */
    value: z.union([z.string(), z.number()]),

    /** L'illustration à afficher dans le bouton. */
    icon: z.string(),

    /** Le label principal du bouton. */
    title: z.string(),

    /** Une petite description à afficher dans le bouton. */
    description: z.string(),

    /** Des exemples qui montrent l'utilité de l'option du switch. */
    examples: z.string().optional(),
});

export type Choice = SchemaInfer<typeof ChoiceSchema>;

export type Choices = [left: Choice, right: Choice];

type Props<T extends Choices = Choices> = {
    /** La liste des choix possibles pour le switch. */
    choices: T,

    /** La valeur du switch qui doit être sélectionné. */
    value: T[number]['value'],

    /**
     * La taille des boutons ({@see {@link SwitchHeroSize}}).
     *
     * @default SwitchHeroSize.DEFAULT
     */
    size?: SwitchHeroSize,

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

/** Un champ de formulaire de type "radiogroup" visuellement amélioré. */
const SwitchHero = defineComponent({
    name: 'SwitchHero',
    props: {
        choices: {
            type: Array as unknown as PropType<Props['choices']>,
            required: true,
            validator: (value: unknown) => {
                const schema = z.tuple([ChoiceSchema, ChoiceSchema]);
                return schema.safeParse(value).success;
            },
        },
        value: {
            type: String as PropType<Props['value']>,
            required: true,
        },
        size: {
            type: String as PropType<Required<Props>['size']>,
            default: SwitchHeroSize.DEFAULT,
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
    methods: {
        // ------------------------------------------------------
        // -
        // -    Handlers
        // -
        // ------------------------------------------------------

        handleSelect(value: Choice['value']) {
            this.$emit('input', value);
            this.$emit('change', value);
        },
    },
    render() {
        const { choices, value: currentValue, size, handleSelect } = this;

        return (
            <div class="SwitchHero" role="radiogroup">
                {choices.map(({ value, icon, title, description, examples }: Choice) => (
                    <SwitchHeroItem
                        key={value}
                        class="SwitchHero__choice"
                        icon={icon}
                        title={title}
                        description={description}
                        examples={examples}
                        value={value}
                        selected={value === currentValue}
                        size={size}
                        onSelect={handleSelect}
                    />
                ))}
            </div>
        );
    },
});

export { SwitchHeroSize };

export default SwitchHero;
