import './index.scss';
import { defineComponent } from 'vue';
import { Type, Size } from './_constants';

import type { PropType } from 'vue';

type Props = {
    /** Le type (= variante) du badge. */
    type: Type | `${Type}`,

    /** Le texte du badge. */
    label: string,

    /** La taille du badge. */
    size?: Size | `${Size}`,
};

/** Un badge. */
const Badge = defineComponent({
    name: 'Badge',
    props: {
        type: {
            type: String as PropType<Props['type']>,
            required: true,
        },
        label: {
            type: String as PropType<Props['label']>,
            required: true,
        },
        size: {
            type: String as PropType<Required<Props>['size']>,
            default: Size.NORMAL,
        },
    },
    render() {
        const { type, label, size } = this;

        return (
            <span class={['Badge', `Badge--${type}`, `Badge--${size}`]}>
                {label}
            </span>
        );
    },
});

export { Type, Size };
export default Badge;
