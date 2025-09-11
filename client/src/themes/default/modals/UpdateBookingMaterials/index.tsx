import './index.scss';
import { RequestError } from '@/globals/requester';
import { defineComponent } from 'vue';
import { debounce } from 'lodash';
import { DEBOUNCE_WAIT_DURATION } from '@/globals/constants';
import { ApiErrorCode } from '@/stores/api/@codes';
import apiBookings, { BookingEntity } from '@/stores/api/bookings';
import Button from '@/themes/default/components/Button';
import MaterialsSelector, {
    getEmbeddedMaterialsQuantities,
} from '@/themes/default/components/MaterialsSelector';

import type { DebouncedMethod } from 'lodash';
import type { PropType } from 'vue';
import type { Booking } from '@/stores/api/bookings';
import type { SelectedMaterial } from '@/themes/default/components/MaterialsSelector';

type Props = {
    /**
     * Le booking (événement ou réservation) dont
     * on veut modifier le matériel, dans son état initial.
     */
    defaultBooking: Booking,
};

type InstanceProperties = {
    debouncedSave: DebouncedMethod<typeof UpdateBookingMaterialsModal, 'save'> | undefined,
};

type Data = {
    isReady: boolean,
    isSaving: boolean,
    booking: Booking,
    materials: SelectedMaterial[],
};

/** Fenêtre modale pour modifier la liste du matériel d'un booking. */
const UpdateBookingMaterialsModal = defineComponent({
    name: 'UpdateBookingMaterialsModal',
    props: {
        defaultBooking: {
            type: Object as PropType<Props['defaultBooking']>,
            required: true,
        },
    },
    modal: {
        width: 1400,
        clickToClose: false,
    },
    emits: ['close'],
    setup: (): InstanceProperties => ({
        debouncedSave: undefined,
    }),
    data(): Data {
        const { materials } = this.defaultBooking;

        return {
            isReady: false,
            isSaving: false,
            booking: this.defaultBooking,
            materials: getEmbeddedMaterialsQuantities(materials),
        };
    },
    computed: {
        modalTitle(): string {
            const { __, booking } = this;

            if (booking.entity === BookingEntity.EVENT) {
                const { title } = booking;
                return __('title-event', { title });
            }

            return __('title');
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

        handleReady() {
            this.isReady = true;
        },

        handleChange(materials: SelectedMaterial[]) {
            this.materials = materials;
        },

        async handleGlobalChange() {
            const { __, booking } = this;

            try {
                this.booking = await apiBookings.one(booking.entity, booking.id);
            } catch {
                this.$toasted.error(__('global.errors.unexpected-while-fetching'));
            }
        },

        handleSave() {
            this.debouncedSave!();
        },

        handleClose() {
            this.$emit('close');
        },

        // ------------------------------------------------------
        // -
        // -    Méthodes internes
        // -
        // ------------------------------------------------------

        async save() {
            const { __, isSaving, booking } = this;
            if (isSaving) {
                return;
            }

            const { id, entity } = booking;
            const materials = this.materials.filter(
                ({ quantity }: SelectedMaterial) => quantity > 0,
            );

            this.isSaving = true;

            try {
                await apiBookings.updateMaterials(entity, id, materials);

                this.$toasted.success(__('materials-saved'));
                this.$emit('close');
            } catch (error) {
                this.isSaving = false;

                if (error instanceof RequestError && error.code === ApiErrorCode.EMPTY_PAYLOAD) {
                    this.$toasted.error(__('list-cannot-be-empty'));
                    return;
                }
                this.$toasted.error(__('global.errors.unexpected-while-saving'));
            }
        },

        __(key: string, params?: Record<string, number | string>, count?: number): string {
            key = !key.startsWith('global.')
                ? `modal.update-booking-materials.${key}`
                : key.replace(/^global\./, '');

            return this.$t(key, params, count);
        },
    },
    render() {
        const {
            __,
            modalTitle,
            handleClose,
            materials,
            booking,
            isReady,
            isSaving,
            handleReady,
            handleChange,
            handleGlobalChange,
            handleSave,
        } = this;

        return (
            <div class="UpdateBookingMaterialsModal">
                <header class="UpdateBookingMaterialsModal__header">
                    <h2 class="UpdateBookingMaterialsModal__header__title">
                        {modalTitle}
                    </h2>
                    <Button
                        type="close"
                        class="UpdateBookingMaterialsModal__header__close-button"
                        onClick={handleClose}
                    />
                </header>
                <div class="UpdateBookingMaterialsModal__body">
                    <MaterialsSelector
                        bookable={booking}
                        defaultValues={materials}
                        onReady={handleReady}
                        onChange={handleChange}
                        onMaterialResynced={handleGlobalChange}
                    />
                </div>
                {isReady && (
                    <footer class="UpdateBookingMaterialsModal__footer">
                        <Button
                            type="primary"
                            icon="save"
                            onClick={handleSave}
                            loading={isSaving}
                        >
                            {__('global.save')}
                        </Button>
                    </footer>
                )}
            </div>
        );
    },
});

export default UpdateBookingMaterialsModal;
