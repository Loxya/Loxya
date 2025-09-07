import './index.scss';
import { defineComponent } from 'vue';
import config from '@/globals/config';
import apiEvents from '@/stores/api/events';
import Button from '@/themes/default/components/Button';
import IconMessage from '@/themes/default/components/IconMessage';
import Content from './Content';

import type { PropType } from 'vue';
import type { EventDetails } from '@/stores/api/events';

type Props = {
    /** L'événement en cours d'édition. */
    event: EventDetails,
};

type Data = {
    isConfirming: boolean,
};

/** Étape 6 de l'edition d'un événement : Récapitulatif. */
const EventEditStepOverview = defineComponent({
    name: 'EventEditStepOverview',
    props: {
        event: {
            type: Object as PropType<Props['event']>,
            required: true,
        },
    },
    emits: ['goToStep', 'updateEvent', 'error'],
    data: (): Data => ({
        isConfirming: false,
    }),
    computed: {
        isPrintable(): boolean {
            const { beneficiaries, materials } = this.event;
            return materials.length > 0 && beneficiaries.length > 0;
        },

        eventSummaryPdfUrl(): string {
            const { id } = this.event;
            return `${config.baseUrl}/events/${id}/pdf`;
        },
    },
    methods: {
        // ------------------------------------------------------
        // -
        // -    Handlers
        // -
        // ------------------------------------------------------

        handleConfirm() {
            this.setEventConfirmation(true);
        },

        handleUnconfirm() {
            this.setEventConfirmation(false);
        },

        handlePrevClick() {
            this.$emit('goToStep', this.event.is_billable ? 5 : 4);
        },

        // ------------------------------------------------------
        // -
        // -    Internal
        // -
        // ------------------------------------------------------

        async setEventConfirmation(confirmed: boolean) {
            const { id } = this.event;
            this.isConfirming = true;

            try {
                const data = await apiEvents.update(id, { is_confirmed: confirmed });
                this.$emit('updateEvent', data);
            } catch (error) {
                this.$emit('error', error);
            } finally {
                this.isConfirming = false;
            }
        },
    },
    render() {
        const { is_confirmed: isConfirmed, materials } = this.event;
        const {
            $t: __,
            event,
            isPrintable,
            isConfirming,
            eventSummaryPdfUrl,
            handleConfirm,
            handleUnconfirm,
            handlePrevClick,
        } = this;

        return (
            <div class="EventEditStepOverview">
                <Content event={event} />
                {materials.length > 0 && (
                    <section class="EventEditStepOverview__confirmation">
                        <h3 class="EventEditStepOverview__confirmation__title">
                            {__('page.event-edit.event-confirmation')}
                        </h3>
                        <div
                            class={['EventEditStepOverview__confirmation__help', {
                                'EventEditStepOverview__confirmation__help--confirmed': isConfirmed,
                            }]}
                        >
                            <IconMessage
                                name={isConfirmed ? 'check' : 'hourglass-half'}
                                message={(
                                    isConfirmed
                                        ? __('@event.event-confirmed-help')
                                        : __('@event.event-not-confirmed-help')
                                )}
                            />
                        </div>
                        <div class="EventEditStepOverview__confirmation__actions">
                            {!isConfirmed && (
                                <Button
                                    type="success"
                                    icon="check"
                                    loading={isConfirming}
                                    onClick={handleConfirm}
                                >
                                    {__('confirm-event')}
                                </Button>
                            )}
                            {isConfirmed && (
                                <Button
                                    type="warning"
                                    icon="hourglass-half"
                                    loading={isConfirming}
                                    onClick={handleUnconfirm}
                                >
                                    {__('unconfirm-event')}
                                </Button>
                            )}
                        </div>
                    </section>
                )}
                <section class="EventEditStepOverview__actions">
                    <Button
                        htmlType="submit"
                        type="default"
                        icon={{ name: 'arrow-left', position: 'before' }}
                        onClick={handlePrevClick}
                    >
                        {__('page.event-edit.go-to-prev-step')}
                    </Button>
                    <div class="EventEditStepOverview__actions__right">
                        {isPrintable && (
                            <Button type="secondary" icon="print" to={eventSummaryPdfUrl} external>
                                {__('print-summary')}
                            </Button>
                        )}
                        <Button type="primary" to={{ name: 'schedule' }}>
                            {__('back-to-schedule')}
                        </Button>
                    </div>
                </section>
            </div>
        );
    },
});

export default EventEditStepOverview;
