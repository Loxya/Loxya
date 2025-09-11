import './index.scss';
import config from '@/globals/config';
import { defineComponent } from 'vue';
import apiEvents from '@/stores/api/events';
import BeneficiariesSelect from './BeneficiariesSelect';
import Button from '@/themes/default/components/Button';
import IconMessage from '@/themes/default/components/IconMessage';

import type { PropType } from 'vue';
import type { EventDetails } from '@/stores/api/events';
import type { Beneficiary } from '@/stores/api/beneficiaries';

type Props = {
    /** L'événement en cours d'édition. */
    event: EventDetails,
};

type Data = {
    selectedIds: Array<Beneficiary['id']>,
};

/** Étape 2 de l'edition d'un événement : Sélection des bénéficiaires. */
const EventEditStepBeneficiaries = defineComponent({
    name: 'EventEditStepBeneficiaries',
    props: {
        event: {
            type: Object as PropType<Props['event']>,
            required: true,
        },
    },
    emits: [
        'loading',
        'stopLoading',
        'goToStep',
        'updateEvent',
        'dataChange', // eslint-disable-line vue/no-unused-emit-declarations
        'dataReset', // eslint-disable-line vue/no-unused-emit-declarations
    ],
    data(): Data {
        const { event } = this;

        return {
            selectedIds: event.beneficiaries.map(({ id }: Beneficiary) => id),
        };
    },
    computed: {
        isBillingEnabled(): boolean {
            return this.event.is_billable;
        },

        isTechniciansEnabled(): boolean {
            return config.features.technicians;
        },
    },
    methods: {
        // ------------------------------------------------------
        // -
        // -    Handlers
        // -
        // ------------------------------------------------------

        handleChangeSelected(ids: Array<Beneficiary['id']>) {
            this.selectedIds = ids;

            const savedList = this.event.beneficiaries.map(
                (beneficiary: Beneficiary) => beneficiary.id,
            );
            const differences = ids
                .filter((id: Beneficiary['id']) => !savedList.includes(id))
                .concat(savedList.filter((id: Beneficiary['id']) => !ids.includes(id)));

            const hasDifferences = differences.length > 0;
            this.$emit(hasDifferences ? 'dataChange' : 'dataReset');
        },

        handleSubmit(e: SubmitEvent) {
            e.preventDefault();

            this.saveAndGoToStep(this.isTechniciansEnabled ? 3 : 4);
        },

        handlePrevClick(e: MouseEvent) {
            e.preventDefault();

            this.saveAndGoToStep(1);
        },

        handleNextClick(e: MouseEvent) {
            e.preventDefault();

            this.saveAndGoToStep(this.isTechniciansEnabled ? 3 : 4);
        },

        // ------------------------------------------------------
        // -
        // -    Méthodes internes
        // -
        // ------------------------------------------------------

        async saveAndGoToStep(nextStep: number) {
            this.$emit('loading');

            const { id } = this.event;

            try {
                const data = await apiEvents.update(id, {
                    beneficiaries: this.selectedIds,
                });
                this.$emit('updateEvent', data);
                this.$emit('goToStep', nextStep);
            } catch {
                const { $t: __ } = this;
                this.$toasted.error(__('errors.unexpected-while-saving'));
            } finally {
                this.$emit('stopLoading');
            }
        },
    },
    render() {
        const {
            $t: __,
            event,
            isBillingEnabled,
            handleSubmit,
            handlePrevClick,
            handleNextClick,
            handleChangeSelected,
        } = this;

        return (
            <form class="EventEditStepBeneficiaries" method="POST" onSubmit={handleSubmit}>
                <header class="EventEditStepBeneficiaries__header">
                    <h1 class="EventEditStepBeneficiaries__title">
                        {__('page.event-edit.steps.beneficiaries.title')}
                    </h1>
                    {isBillingEnabled && (
                        <p class="EventEditStepBeneficiaries__help">
                            <IconMessage
                                name="info-circle"
                                message={__('page.event-edit.beneficiary-billing-help')}
                            />
                        </p>
                    )}
                </header>
                <BeneficiariesSelect
                    defaultValues={event.beneficiaries}
                    onChange={handleChangeSelected}
                />
                <section class="EventEditStepBeneficiaries__actions">
                    <Button
                        htmlType="submit"
                        type="default"
                        icon={{ name: 'arrow-left', position: 'before' }}
                        onClick={handlePrevClick}
                    >
                        {__('page.event-edit.save-and-go-to-prev-step')}
                    </Button>
                    <Button
                        htmlType="submit"
                        type="primary"
                        icon={{ name: 'arrow-right', position: 'after' }}
                        onClick={handleNextClick}
                    >
                        {__('page.event-edit.save-and-go-to-next-step')}
                    </Button>
                </section>
            </form>
        );
    },
});

export default EventEditStepBeneficiaries;
