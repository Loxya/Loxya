import './index.scss';
import config from '@/globals/config';
import debounce from 'lodash/debounce';
import { defineComponent } from 'vue';
import { DEBOUNCE_WAIT_DURATION } from '@/globals/constants';
import apiEvents from '@/stores/api/events';
import apiBookings, { BookingEntity } from '@/stores/api/bookings';
import Button from '@/themes/default/components/Button';
import MaterialsSelector, {
    BookableEntity,
    hasQuantitiesChanged,
    getEmbeddedMaterialsQuantities,
} from '@/themes/default/components/MaterialsSelector';

import type { DebouncedMethod } from 'lodash';
import type { PropType } from 'vue';
import type { EventDetails } from '@/stores/api/events';
import type { Bookable, SelectedMaterial } from '@/themes/default/components/MaterialsSelector';

type Props = {
    /** L'événement en cours d'édition. */
    event: EventDetails,
};

type InstanceProperties = {
    debouncedSave: DebouncedMethod<typeof EventEditStepMaterials, 'save'> | undefined,
};

type Data = {
    isSaving: boolean,
    materials: SelectedMaterial[],
};

/** Étape 4 de l'edition d'un événement : Sélection du matériel. */
const EventEditStepMaterials = defineComponent({
    name: 'EventEditStepMaterials',
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
    setup: (): InstanceProperties => ({
        debouncedSave: undefined,
    }),
    data(): Data {
        const { materials } = this.event;

        return {
            isSaving: false,
            materials: getEmbeddedMaterialsQuantities(materials),
        };
    },
    computed: {
        isTechniciansEnabled(): boolean {
            return config.features.technicians;
        },

        booking(): Bookable {
            return {
                entity: BookableEntity.EVENT,
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

        handleChange(materials: SelectedMaterial[]) {
            this.materials = materials;

            const savedMaterials = getEmbeddedMaterialsQuantities(this.event.materials);
            const hasChanged = hasQuantitiesChanged(savedMaterials, materials);
            this.$emit(hasChanged ? 'dataChange' : 'dataReset');

            if (hasChanged) {
                this.debouncedSave!();
            }
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
            this.saveAndGoToStep(this.isTechniciansEnabled ? 3 : 2);
        },

        handleNextClick() {
            if (this.isSaving) {
                return;
            }
            this.saveAndGoToStep(this.event.is_billable ? 5 : 6);
        },

        // ------------------------------------------------------
        // -
        // -    Méthodes internes
        // -
        // ------------------------------------------------------

        async saveAndGoToStep(nextStep: number) {
            try {
                await this.save(true);
            } catch {
                // - On annule le changement de page s'il y a
                //   une erreur au moment de la sauvegarde.
                return;
            }
            this.$emit('goToStep', nextStep);
        },

        async save(shouldRethrow: boolean = false) {
            const { __, isSaving, event: { id } } = this;
            if (isSaving) {
                return;
            }

            this.isSaving = true;
            this.$emit('loading');

            const materials = this.materials.filter(
                ({ quantity }: SelectedMaterial) => quantity > 0,
            );

            try {
                const updatedEvent = await apiBookings.updateMaterials(BookingEntity.EVENT, id, materials);
                this.$emit('updateEvent', updatedEvent);
            } catch (error) {
                this.$toasted.error(__('global.errors.unexpected-while-saving'));

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
                    key = `page.steps.materials.${key}`;
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
            materials,
            handleChange,
            handlePrevClick,
            handleNextClick,
            handleGlobalChange,
        } = this;

        return (
            <div class="EventEditStepMaterials">
                <MaterialsSelector
                    class="EventEditStepMaterials__selector"
                    bookable={booking}
                    defaultValues={materials}
                    onMaterialResynced={handleGlobalChange}
                    onChange={handleChange}
                />
                <section class="EventEditStepMaterials__actions">
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

export default EventEditStepMaterials;
