import './index.scss';
import { defineComponent } from 'vue';
import Icon, { Variant } from '@/themes/default/components/Icon';

import type { PropType } from 'vue';

type Props = {
    /**
     * Le nom de l'icône à afficher.
     *
     * Pour une liste exhaustive des codes, voir: https://fontawesome.com/v5.15/icons?m=free
     */
    name: string,

    /** Quelle variante faut-il utiliser pour l'icône ? */
    variant?: Variant,

    /** Le texte à afficher à droite de l'icône */
    message: string,
};

/** Une icône suivie d'un message. */
const IconMessage = defineComponent({
    name: 'IconMessage',
    props: {
        name: {
            type: String as PropType<Props['name']>,
            required: true,
        },
        variant: {
            type: String as PropType<Required<Props>['variant']>,
            default: Variant.SOLID,
            validator: (value: unknown) => (
                typeof value === 'string' &&
                Object.values(Variant).includes(value as any)
            ),
        },
        message: {
            type: String as PropType<Required<Props>['message']>,
            required: true,
        },
    },
    render() {
        const { name, variant, message } = this;

        return (
            <span class="IconMessage">
                <Icon class="IconMessage__icon" name={name} variant={variant} />
                <span class="IconMessage__message">{message}</span>
            </span>
        );
    },
});

export default IconMessage;
