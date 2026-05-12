import './index.scss';
import { defineComponent } from 'vue';
import Icon from '@/themes/default/components/Icon';
import StepperOrientation from '../_constants';

import type { PropType } from 'vue';
import type { Step } from '..';

type Props = {
    /** Le numéro de l'étape. */
    number: number,

    /** L'étape à afficher. */
    step: Step,

    /** L'étape est-elle l'étape active ? */
    active: boolean,

    /** L'étape a-t-elle été dépassée (remplie ou non) ? */
    behind: boolean,

    /** L'orientation du stepper. */
    orientation: StepperOrientation | `${StepperOrientation}`,

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
        behind: {
            type: Boolean as PropType<Props['behind']>,
            required: true,
        },
        orientation: {
            type: String as PropType<Props['orientation']>,
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
        const { number, icon, orientation, active, behind, handleClick } = this;
        const isVertical = orientation === StepperOrientation.VERTICAL;

        const classNames = ['StepperItem', `StepperItem--${orientation}`, {
            'StepperItem--active': active,
            'StepperItem--reachable': reachable,
            'StepperItem--validated': !active && filled,
            'StepperItem--behind': behind,
        }];

        return (
            <li class={classNames}>
                <div role="button" class="StepperItem__link" onClick={handleClick}>
                    {isVertical && <Icon class="StepperItem__icon" name={icon} />}
                    <span class="StepperItem__content">
                        <span class="StepperItem__number">{number}</span>
                        <span class="StepperItem__text">{name}</span>
                    </span>
                </div>
            </li>
        );
    },
});

export default StepperItem;
