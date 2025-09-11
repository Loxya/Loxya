import './index.scss';
import { defineComponent } from 'vue';
import Icon from '@/themes/default/components/Icon';

import type { PropType } from 'vue';
import type { Choice } from '..';

/** Taille des choix du switch. */
export enum SwitchHeroSize {
    /** Choix de taille normale. */
    DEFAULT = 'default',

    /** Choix de grande taille. */
    LARGE = 'large',
}

type Props = {
    /** Illustration à afficher dans l'élément. */
    icon: string,

    /** Titre de l'élément. */
    title: string,

    /** Description de l'élément. */
    description: string,

    /** Exemples à afficher dans l'élément. */
    examples?: string,

    /** Valeur de l'élément. */
    value: Choice['value'],

    /** Est-ce que l'élément est sélectionné ? */
    selected: boolean,

    /** La taille du choix ({@see {@link SwitchHeroSize}}). */
    size: SwitchHeroSize,

    /**
     * Fonction appelée lorsqu'un l'élément est sélectionné.
     *
     * @param value - La valeur de l'élément.
     */
    onSelect?(value: Choice['value']): void,
};

/** Choix pour le champ de formulaire de type "radio", visuellement amélioré. */
const SwitchHeroItem = defineComponent({
    name: 'SwitchHeroItem',
    props: {
        value: {
            type: String as PropType<Props['value']>,
            required: true,
        },
        icon: {
            type: String as PropType<Props['icon']>,
            required: true,
        },
        title: {
            type: String as PropType<Props['title']>,
            required: true,
        },
        description: {
            type: String as PropType<Props['description']>,
            required: true,
        },
        examples: {
            type: String as PropType<Props['examples']>,
            default: undefined,
        },
        size: {
            type: String as PropType<Props['size']>,
            required: true,
        },
        selected: {
            type: Boolean as PropType<Props['selected']>,
            required: true,
        },
        // eslint-disable-next-line vue/no-unused-properties
        onSelect: {
            type: Function as PropType<Props['onSelect']>,
            default: undefined,
        },
    },
    emits: ['select'],
    methods: {
        handleClick() {
            this.$emit('select', this.value);
        },
    },
    render() {
        const {
            $t: __,
            icon,
            title,
            description,
            examples,
            selected,
            size,
            handleClick,
        } = this;

        return (
            <div
                role="radio"
                aria-label={title}
                aria-checked={selected}
                onClick={handleClick}
                class={['SwitchHeroItem', {
                    'SwitchHeroItem--large': size === SwitchHeroSize.LARGE,
                    'SwitchHeroItem--selected': selected,
                }]}
            >
                <div class="SwitchHeroItem__header">
                    <Icon class="SwitchHeroItem__illustration" name={icon} />
                    <h4 class="SwitchHeroItem__title">{title}</h4>
                </div>
                <div class="SwitchHeroItem__body">
                    <p class="SwitchHeroItem__description">{description}</p>
                    {examples && (
                        <p class="SwitchHeroItem__examples">
                            {__('examples-list', { list: examples })}
                        </p>
                    )}
                </div>
            </div>
        );
    },
});

export default SwitchHeroItem;
