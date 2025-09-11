import './index.scss';
import { defineComponent } from 'vue';
import Item from './Item';

import type { PropType } from 'vue';

export type Step = {
    id: number | string,
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
            type: Number as PropType<Props['currentStepId']>,
            required: true,
        },
        // eslint-disable-next-line vue/no-unused-properties
        onOpenStep: {
            type: Function as PropType<Props['onOpenStep']>,
            default: undefined,
        },
    },
    emits: ['openStep'],
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
        const { steps, openStep } = this;

        return (
            <div class="Stepper">
                {steps.map((step: Step, index: number) => (
                    <Item
                        key={step.id}
                        step={step}
                        number={index + 1}
                        active={step.id === this.currentStepId}
                        onClick={() => { openStep(step.id); }}
                    />
                ))}
            </div>
        );
    },
});

export default Stepper;
