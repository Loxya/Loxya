import './index.scss';
import debounce from 'lodash/debounce';
import { ApiErrorCode } from '@/stores/api/@codes';
import { RequestError } from '@/globals/requester';
import { defineComponent } from 'vue';
import { DEBOUNCE_WAIT_DURATION } from '@/globals/constants';
import apiEvents from '@/stores/api/events';
import apiBookings, { BookingEntity } from '@/stores/api/bookings';
import Button from '@/themes/default/components/Button';
import InvoiceEditor, {
    hasBillingChanged,
    getEmbeddedBilling,
} from '@/themes/default/components/InvoiceEditor';

import type { ComponentRef, PropType } from 'vue';
import type { DebouncedMethod } from 'lodash';
import type { Booking } from '@/stores/api/bookings';
import type { EventDetails } from '@/stores/api/events';
import type { BillingData } from '@/themes/default/components/InvoiceEditor';

type Props = {
    /** L'événement en cours d'édition. */
    event: EventDetails<true>,
};

type InstanceProperties = {
    debouncedSave: DebouncedMethod<typeof EventEditStepBilling, 'save'> | undefined,
};

type Data = {
    isSaving: boolean,
    validationErrors: Record<string, any> | undefined,
};

/** Étape 5 de l'edition d'un événement : Facturation. */
const EventEditStepBilling = defineComponent({
    name: 'EventEditStepBilling',
    props: {
        event: {
            type: Object as PropType<Props['event']>,
            required: true,
            validator: (event: EventDetails) => (
                event.is_billable
            ),
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
    setup: (): InstanceProperties => ({
        debouncedSave: undefined,
    }),
    data: (): Data => ({
        isSaving: false,
        validationErrors: undefined,
    }),
    computed: {
        booking(): Booking<true> {
            return {
                entity: BookingEntity.EVENT,
                ...this.event,
            };
        },
    },
    created() {
        this.debouncedSave = debounce(
            this.save.bind(this),
            DEBOUNCE_WAIT_DURATION.asMilliseconds(),
        );
    },
    beforeDestroy() {
        this.debouncedSave?.cancel();
    },
    methods: {
        // ------------------------------------------------------
        // -
        // -    Handlers
        // -
        // ------------------------------------------------------

        handleChange(data: BillingData) {
            const savedBilling = getEmbeddedBilling(this.booking);
            const hasChanged = hasBillingChanged(savedBilling, data);
            this.$emit(hasChanged ? 'dataChange' : 'dataReset');
        },

        async handleGlobalChange() {
            const { __ } = this;

            try {
                this.$emit('updateEvent', await apiEvents.one(this.event.id));
            } catch {
                this.$toasted.error(__('global.errors.unexpected-while-fetching'));
            }
        },

        handlePrevClick() {
            if (this.isSaving) {
                return;
            }
            this.saveAndGoToStep(4);
        },

        handleNextClick() {
            if (this.isSaving) {
                return;
            }
            this.saveAndGoToStep(6);
        },

        // ------------------------------------------------------
        // -
        // -    Méthodes internes
        // -
        // ------------------------------------------------------

        async saveAndGoToStep(nextStep: number) {
            const $editor = this.$refs.editor as ComponentRef<typeof InvoiceEditor>;
            if ($editor !== undefined) {
                try {
                    await this.save($editor.values, true);
                } catch {
                    // - On annule le changement de page s'il y a
                    //   une erreur au moment de la sauvegarde.
                    return;
                }
            }
            this.$emit('goToStep', nextStep);
        },

        async save(data: BillingData, shouldRethrow: boolean = false) {
            const { __, isSaving, event: { id } } = this;
            if (isSaving) {
                return;
            }

            this.isSaving = true;
            this.$emit('loading');

            try {
                const updatedEvent = await apiBookings.updateBilling(BookingEntity.EVENT, id, data);
                this.validationErrors = undefined;

                this.$emit('updateEvent', updatedEvent);
            } catch (error) {
                if (error instanceof RequestError && error.code === ApiErrorCode.VALIDATION_FAILED) {
                    this.validationErrors = { ...error.details };
                } else {
                    this.$toasted.error(__('global.errors.unexpected-while-saving'));
                }

                if (shouldRethrow) {
                    throw error;
                }
            } finally {
                this.$emit('stopLoading');
                this.isSaving = false;
            }
        },

        __(key: string, params?: Record<string, number | string>, count?: number): string {
            if (!key.startsWith('global.')) {
                if (!key.startsWith('page.')) {
                    key = `page.steps.billing.${key}`;
                }
                key = key.replace(/^page\./, 'page.event-edit.');
            } else {
                key = key.replace(/^global\./, '');
            }
            return this.$t(key, params, count);
        },
    },
    render() {
        const {
            __,
            booking,
            validationErrors,
            handleChange,
            handlePrevClick,
            handleNextClick,
            handleGlobalChange,
        } = this;

        return (
            <div class="EventEditStepBilling">
                <InvoiceEditor
                    ref="editor"
                    class="EventEditStepBilling__editor"
                    booking={booking}
                    errors={validationErrors}
                    onMaterialResynced={handleGlobalChange}
                    onExtraResynced={handleGlobalChange}
                    onChange={handleChange}
                />
                <section class="EventEditStepBilling__actions">
                    <Button
                        type="default"
                        icon={{ name: 'arrow-left', position: 'before' }}
                        onClick={handlePrevClick}
                    >
                        {__('page.save-and-go-to-prev-step')}
                    </Button>
                    <Button
                        type="primary"
                        icon={{ name: 'arrow-right', position: 'after' }}
                        onClick={handleNextClick}
                    >
                        {__('page.save-and-go-to-next-step')}
                    </Button>
                </section>
            </div>
        );
    },
});

export default EventEditStepBilling;
