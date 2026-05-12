import './index.scss';
import { defineComponent } from 'vue';
import StepperOrientation from './_constants';
import Item from './Item';

import type { PropType } from 'vue';

export type Step<T extends number | string = number | string> = {
    id: T,
    name: string,
    filled: boolean,
    reachable?: boolean,
};

type Props = {
    /**
     * Un tableau contenant toutes les étapes de l'édition de réservation.
     *
     * Voir le type {@link Step} pour plus de détails sur le format des
     * objets attendus dans ce tableau.
     */
    steps: Step[],

    /** Le numéro de l'étape actuelle. */
    currentStepId: Step['id'],

    /**
     * L'orientation des étapes.
     *
     * - `vertical` (défaut) : Étapes empilées, type sidebar.
     * - `horizontal` : Étapes alignées sur une ligne.
     */
    orientation?: StepperOrientation | `${StepperOrientation}`,

    /**
     * Fonction appelée lorsque l'utilisateur a demandé un changement d'étape.
     *
     * @param id - L'identifiant de l'étape à ouvrir.
     */
    onOpenStep?(id: Step['id']): void,
};

/** Une navigation multi-étapes. */
const Stepper = defineComponent({
    name: 'Stepper',
    props: {
        steps: {
            type: Array as PropType<Props['steps']>,
            required: true,
        },
        currentStepId: {
            type: [Number, String] as PropType<Props['currentStepId']>,
            required: true,
        },
        orientation: {
            type: String as PropType<Required<Props>['orientation']>,
            default: StepperOrientation.VERTICAL,
            validator: (value: unknown) => (
                typeof value === 'string' &&
                (Object.values(StepperOrientation) as string[]).includes(value)
            ),
        },
        // eslint-disable-next-line vue/no-unused-properties
        onOpenStep: {
            type: Function as PropType<Props['onOpenStep']>,
            default: undefined,
        },
    },
    emits: ['openStep'],
    computed: {
        currentStepIndex(): number {
            return this.steps.findIndex((step: Step) => (
                step.id === this.currentStepId
            ));
        },

        progressPercent(): number {
            const stepsCount = this.steps.length - 1;
            if (stepsCount <= 0) {
                return 0;
            }
            const percent = Math.round((this.currentStepIndex / stepsCount) * 100);
            return Math.min(percent, 100);
        },
    },
    methods: {
        openStep(id: Step['id']): void {
            const step = this.steps.find((_step: Step) => _step.id === id);
            if (step === undefined || step.reachable === false) {
                return;
            }
            this.$emit('openStep', step.id);
        },
    },
    render() {
        const isHorizontal = this.orientation === StepperOrientation.HORIZONTAL;
        const {
            steps,
            orientation,
            currentStepId,
            currentStepIndex,
            progressPercent,
            openStep,
        } = this;

        return (
            <div
                class={['Stepper', `Stepper--${orientation}`]}
                style={{ '--steps-count': steps.length }}
            >
                <ol class="Stepper__list">
                    {steps.map((step: Step, index: number) => {
                        const isActive = step.id === currentStepId;
                        const isBehind = index < currentStepIndex;

                        return (
                            <Item
                                key={step.id}
                                step={step}
                                number={index + 1}
                                active={isActive}
                                behind={isBehind}
                                orientation={orientation}
                                class="Stepper__list__item"
                                onClick={() => { openStep(step.id); }}
                            />
                        );
                    })}
                </ol>
                {isHorizontal && (
                    <div
                        class="Stepper__progressbar"
                        style={{ '--progressbar-value': progressPercent }}
                    >
                        <span class="Stepper__progressbar__bar" />
                        <div class="Stepper__progressbar__value" />
                    </div>
                )}
            </div>
        );
    },
});

export { StepperOrientation };
export default Stepper;
