import './index.scss';
import { defineComponent } from 'vue';
import Icon from '@/themes/default/components/Icon';

import type { PropType } from 'vue';
import type { Step } from '..';

type Props = {
    /** Le numéro de l'étape. */
    number: number,

    /** L'étape à afficher. */
    step: Step,

    /** L'étape est-elle l'étape active ? */
    active: boolean,

    /** Fonction appelée lorsque l'élément a été cliqué. */
    onClick?(): void,
};

/** Une étape dans une navigation multi-étapes. */
const StepperItem = defineComponent({
    name: 'StepperItem',
    props: {
        number: {
            type: Number as PropType<Props['number']>,
            required: true,
        },
        step: {
            type: Object as PropType<Props['step']>,
            required: true,
        },
        active: {
            type: Boolean as PropType<Props['active']>,
            required: true,
        },
        // eslint-disable-next-line vue/no-unused-properties
        onClick: {
            type: Function as PropType<Props['onClick']>,
            default: undefined,
        },
    },
    emits: ['click'],
    computed: {
        icon(): string {
            const { active, step: { filled } } = this;

            if (active) {
                return 'arrow-right';
            }

            if (filled) {
                return 'check';
            }

            return 'question';
        },
    },
    methods: {
        handleClick() {
            this.$emit('click');
        },
    },
    render() {
        const { name, filled, reachable = true } = this.step;
        const { number, icon, active, handleClick } = this;

        return (
            <div
                role="button"
                class={[
                    'StepperItem',
                    {
                        'StepperItem--active': active,
                        'StepperItem--reachable': reachable,
                        'StepperItem--validated': !active && filled,
                    },
                ]}
                onClick={handleClick}
            >
                <Icon class="StepperItem__icon" name={icon} />
                <span class="StepperItem__number">{number}</span>
                <span class="StepperItem__name">{name}</span>
            </div>
        );
    },
});

export default StepperItem;
