import './index.scss';
import { RequestError, HttpCode } from '@/globals/requester';
import DateTime, { DateTimeRoundingMethod } from '@/utils/datetime';
import { defineComponent, markRaw } from 'vue';
import parseInteger from '@/utils/parseInteger';
import { ApiErrorCode } from '@/stores/api/@codes';
import apiEvents from '@/stores/api/events';
import { BookingEntity } from '@/stores/api/bookings';
import { confirm } from '@/utils/alert';
import showModal from '@/utils/showModal';
import UpdateBookingMaterials from '@/themes/default/modals/UpdateBookingMaterials';
import Page from '@/themes/default/components/Page';
import Loading from '@/themes/default/components/Loading';
import CriticalError, { ErrorType } from '@/themes/default/components/CriticalError';
import Unavailable, { UnavailabilityReason } from './components/Unavailable';
import Inventory, { InventoryErrorsSchema, DisplayGroup } from './components/Inventory';
import Header from './components/Header';
import Footer from './components/Footer';

import type Period from '@/utils/period';
import type { ComponentRef, Raw } from 'vue';
import type {
    EventDetails,
    EventMaterial,
} from '@/stores/api/events';
import type {
    InventoryData,
    InventoryMaterial,
    InventoryMaterialData,
    InventoryMaterialError,
} from './components/Inventory';

type InstanceProperties = {
    nowTimer: ReturnType<typeof setInterval> | undefined,
};

type Data = (
    & {
        id: EventDetails['id'],
        inventoryRaw: InventoryData,
        displayGroup: DisplayGroup,
        criticalError: ErrorType | null,
        isDirtyRaw: boolean,
        isSaving: boolean,
        isCancelling: boolean,
        inventoryErrors: InventoryMaterialError[] | null,
        now: Raw<DateTime>,
    }
    & (
        | { isFetched: false, event: null }
        | { isFetched: true, event: EventDetails }
    )
);

/** Page d'inventaire de départ d'un événement. */
const EventDeparture = defineComponent({
    name: 'EventDeparture',
    setup: (): InstanceProperties => ({
        nowTimer: undefined,
    }),
    data(): Data {
        return {
            id: parseInteger(this.$route.params.id)!,
            event: null,
            inventoryRaw: [],
            displayGroup: DisplayGroup.CATEGORIES,
            isFetched: false,
            isDirtyRaw: false,
            isSaving: false,
            isCancelling: false,
            criticalError: null,
            inventoryErrors: null,
            now: markRaw(DateTime.now()),
        };
    },
    computed: {
        pageTitle(): string {
            const { __, isFetched, event } = this;

            return isFetched
                ? __('title', { name: event.title })
                : __('title-simple');
        },

        inventoryPeriodStart(): DateTime | undefined {
            if (!this.event) {
                return undefined;
            }

            // - 30 jours avant le début de mobilisation prévu.
            const { mobilization_period: mobilisationPeriod } = this.event;
            return (mobilisationPeriod as Period<false>).start.subDay(30);
        },

        inventory(): InventoryData {
            if (!this.isDone) {
                return this.inventoryRaw;
            }

            return this.event!.materials.map(
                (eventMaterial: EventMaterial): InventoryMaterial => ({
                    id: eventMaterial.id,
                    actual: eventMaterial.quantity,
                    comment: eventMaterial.departure_comment ?? null,
                }),
            );
        },

        isDirty(): boolean {
            return !this.isDone ? this.isDirtyRaw : false;
        },

        isInventoryPeriodOpen(): boolean {
            if (this.inventoryPeriodStart === undefined) {
                return false;
            }
            return this.inventoryPeriodStart.isSameOrBefore(this.now);
        },

        isInventoryPeriodClosed(): boolean {
            if (!this.event) {
                return true;
            }

            // - Si l'inventaire de retour est fait, la période de réalisation
            //   des inventaires de départ est forcément fermée.
            if (this.event.is_return_inventory_done) {
                return true;
            }

            // NOTE: On laisse un délai de 1 jour après la date de début de mobilisation
            //       pour faire l'inventaire de départ (mais en ne dépassant jamais la date
            //       de fin de mobilisation).
            const { mobilization_period: mobilisationPeriod } = this.event;
            let inventoryPeriodCloseDate = mobilisationPeriod.start.addDay();
            if (inventoryPeriodCloseDate.isAfter(mobilisationPeriod.end as any)) {
                inventoryPeriodCloseDate = mobilisationPeriod.end;
            }

            return inventoryPeriodCloseDate.isBefore(this.now);
        },

        hasMaterials(): boolean {
            if (!this.event) {
                return false;
            }
            return this.event.materials.length > 0;
        },

        hasMaterialShortage(): boolean {
            if (!this.event) {
                return false;
            }
            return this.event.has_missing_materials === true;
        },

        isArchived(): boolean {
            if (!this.event) {
                return false;
            }
            return !!this.event.is_archived;
        },

        isDone(): boolean {
            if (!this.event) {
                return false;
            }
            return !!this.event.is_departure_inventory_done;
        },

        isViewable(): boolean {
            if (!this.event || this.isArchived) {
                return false;
            }

            // - Si l'inventaire n'est pas encore disponible ou que l'événement
            //   ne contient pas de matériel, pas d'inventaire possible.
            if (!this.isInventoryPeriodOpen || !this.hasMaterials) {
                return false;
            }

            // - Sinon, si l'inventaire est effectué, il est visualisable.
            if (this.isDone) {
                return true;
            }

            // - Si l'inventaire n'est pas déjà effectué, la période d'inventaire
            //   doit être encore en cours et la réservation ne doit pas contenir
            //   de pénurie.
            return !this.isInventoryPeriodClosed && !this.hasMaterialShortage;
        },

        isEditable(): boolean {
            // - L'inventaire doit-être visualisable et ne pas être déjà terminé.
            return this.isViewable && !this.isDone;
        },

        isMaterialEditable(): boolean {
            if (!this.event) {
                return false;
            }

            return (
                // - Un événement archivé n'est pas modifiable.
                !this.event.is_archived &&

                // - Un événement ne peut être modifié que si son inventaire de retour
                //   n'a pas été effectué (sans quoi celui-ci n'aurait plus aucun sens,
                //   d'autant que le stock global a pu être impacté suite à cet inventaire).
                !this.event.is_return_inventory_done
            );
        },

        isComplete(): boolean {
            if (!this.event) {
                return false;
            }

            const { event, inventory } = this;
            return event.materials.every((material: EventMaterial) => {
                const quantities = inventory.find(({ id }: InventoryMaterial) => material.id === id);
                return quantities ? quantities.actual === material.quantity : false;
            });
        },

        isCancellable(): boolean {
            const { event } = this;

            // - Si l'inventaire de départ n'est pas fait, il n'y a rien à annuler.
            if (!event || !this.isDone) {
                return false;
            }

            // - Si l'événement est archivé ou si l'inventaire de retour est effectué,
            //   on ne permet pas d'annuler l'inventaire de départ.
            if (event.is_archived || event.is_return_inventory_done) {
                return false;
            }

            // - On ne permet d'annuler l'inventaire de départ que si l'événement n'a pas encore commencé.
            return event.operation_period.start.isAfter(this.now);
        },

        canTerminate(): boolean {
            return this.isEditable && this.isComplete;
        },
    },
    mounted() {
        this.fetchData();

        // - Actualise le timestamp courant toutes les 10 secondes.
        this.nowTimer = setInterval(() => { this.now = markRaw(DateTime.now()); }, 10_000);
    },
    beforeDestroy() {
        if (this.nowTimer) {
            clearInterval(this.nowTimer);
        }
    },
    methods: {
        // ------------------------------------------------------
        // -
        // -    Handlers
        // -
        // ------------------------------------------------------

        handleChangeInventory(id: EventMaterial['id'], materialInventory: InventoryMaterialData) {
            if (!this.isEditable) {
                return;
            }

            const index = this.inventoryRaw.findIndex(({ id: _id }: InventoryMaterial) => id === _id);
            if (index < 0) {
                return;
            }
            this.$set(this.inventoryRaw, index, { id, ...materialInventory });
            this.isDirtyRaw = true;
        },

        handleChangeDisplayGroup(group: DisplayGroup) {
            this.displayGroup = group;
        },

        handleSave() {
            if (!this.isEditable) {
                return;
            }
            this.save();
        },

        async handleTerminate() {
            const { __ } = this;

            if (!this.event || !this.canTerminate) {
                return;
            }

            // - Si l'inventaire de départ est réalisé avant la date de début de mobilisation prévue,
            //   la date de début de mobilisation va être déplacée automatiquement.
            const { mobilization_period: mobilisationPeriod } = this.event;
            const roundedDepartureInventoryDate = DateTime.now().roundMinutes(15, DateTimeRoundingMethod.CEIL);
            const willMoveMobilizationStartDate = (
                roundedDepartureInventoryDate
                    .isBefore((mobilisationPeriod as Period<false>).start)
            );

            const isConfirmed = await confirm({
                title: __('confirm-terminate-title'),
                confirmButtonText: __('global.terminate-inventory'),
                text: willMoveMobilizationStartDate
                    ? __('confirm-terminate-with-mobilization-adjustment-text')
                    : __('confirm-terminate-text'),
            });
            if (!isConfirmed) {
                return;
            }

            await this.save(true);
        },

        async handleCancel() {
            if (!this.isCancellable || this.isCancelling) {
                return;
            }
            this.isCancelling = true;
            const { __, event } = this;
            const {
                id,
                operation_period: operationPeriod,
            } = event!;

            // - Si la période de réalisation de l'inventaire de départ est terminée mais que la date
            //   de début d'opération est dans le futur, on reset la date de début de mobilisation.
            //   (sans quoi l'utilisateur risque de ne plus pouvoir faire l'inventaire de départ
            //   juste après avoir annulé l'ancien)
            const willMoveMobilizationStartDate = (
                this.isInventoryPeriodClosed &&
                operationPeriod.setFullDays(false).start.isAfter(this.now)
            );

            const isConfirmed = await confirm({
                type: 'danger',
                title: __('confirm-rollback-title'),
                text: willMoveMobilizationStartDate
                    ? __('confirm-rollback-with-mobilization-adjustment-text')
                    : __('confirm-rollback-text'),
            });
            if (!isConfirmed) {
                this.isCancelling = false;
                return;
            }

            try {
                const updatedEvent = await apiEvents.cancelDepartureInventory(id);
                this.setEvent(updatedEvent);
            } catch {
                this.$toasted.error(__('global.errors.unexpected'));
            } finally {
                this.isCancelling = false;
            }
        },

        async handleUpdateMaterialClick() {
            if (this.isSaving || !this.isMaterialEditable) {
                return;
            }
            const { __ } = this;

            if (this.isDirty) {
                const isConfirmed = await confirm({
                    title: __('confirm-unsaved-edit-material-title'),
                    confirmButtonText: __('global.confirm'),
                    text: __('confirm-unsaved-edit-material-text'),
                });
                if (!isConfirmed) {
                    return;
                }
            }

            await showModal(this.$modal, UpdateBookingMaterials, {
                defaultBooking: { ...this.event, entity: BookingEntity.EVENT },
            });

            this.fetchData();
        },

        // ------------------------------------------------------
        // -
        // -    Méthodes internes
        // -
        // ------------------------------------------------------

        async fetchData() {
            try {
                this.setEvent(await apiEvents.one(this.id));
                this.isFetched = true;
            } catch (error) {
                if (error instanceof RequestError && error.httpCode === HttpCode.NotFound) {
                    this.criticalError = ErrorType.NOT_FOUND;
                    return;
                }

                // eslint-disable-next-line no-console
                console.error(`Error occurred while retrieving event #${this.id} data`, error);
                this.criticalError = ErrorType.UNKNOWN;
            }
        },

        async save(finish: boolean = false) {
            if (this.isSaving) {
                return;
            }
            this.isSaving = true;
            const { __, inventory } = this;

            const doRequest = (): Promise<EventDetails> => (
                finish
                    ? apiEvents.finishDepartureInventory(this.id, inventory)
                    : apiEvents.updateDepartureInventory(this.id, inventory)
            );

            try {
                this.setEvent(await doRequest());

                this.inventoryErrors = null;
                this.$toasted.success(__('saved'));
            } catch (error) {
                if (error instanceof RequestError && error.code === ApiErrorCode.VALIDATION_FAILED) {
                    const inventoryErrors = InventoryErrorsSchema.safeParse(error.details);
                    if (inventoryErrors.success) {
                        this.inventoryErrors = inventoryErrors.data;
                        (this.$refs.page as ComponentRef<typeof Page>)?.scrollToTop();
                        return;
                    }
                }

                // eslint-disable-next-line no-console
                console.error(`Error occurred while saving the event #${this.id} departure inventory`, error);
                this.$toasted.error(__('global.errors.unexpected-while-saving'));
            } finally {
                this.isSaving = false;
            }
        },

        setEvent(event: EventDetails) {
            this.event = event;

            this.isDirtyRaw = false;
            this.inventoryRaw = event.materials.map(
                (eventMaterial: EventMaterial): InventoryMaterial => ({
                    id: eventMaterial.id,
                    actual: eventMaterial.quantity_departed ?? 0,
                    comment: eventMaterial.departure_comment ?? null,
                }),
            );
        },

        __(key: string, params?: Record<string, number | string>, count?: number): string {
            key = !key.startsWith('global.')
                ? `page.event-departure.${key}`
                : key.replace(/^global\./, '');

            return this.$t(key, params, count);
        },
    },
    render() {
        const {
            event,
            inventory,
            displayGroup,
            pageTitle,
            isFetched,
            criticalError,
            inventoryErrors,
            inventoryPeriodStart,
            isDone,
            isSaving,
            isViewable,
            isEditable,
            isMaterialEditable,
            isArchived,
            canTerminate,
            hasMaterials,
            hasMaterialShortage,
            isInventoryPeriodOpen,
            isInventoryPeriodClosed,
            handleSave,
            handleCancel,
            handleTerminate,
            handleChangeInventory,
            handleChangeDisplayGroup,
            handleUpdateMaterialClick,
        } = this;

        if (criticalError || !isFetched) {
            return (
                <Page name="event-departure" title={pageTitle} centered>
                    {criticalError ? <CriticalError type={criticalError} /> : <Loading />}
                </Page>
            );
        }

        const renderContent = (): JSX.Element => {
            if (isArchived) {
                return (
                    <Unavailable
                        event={event}
                        reason={UnavailabilityReason.ARCHIVED}
                    />
                );
            }
            if (!isInventoryPeriodOpen) {
                return (
                    <Unavailable
                        event={event}
                        reason={UnavailabilityReason.TOO_SOON}
                        variables={{ inventoryPeriodStart }}
                    />
                );
            }
            if (!hasMaterials) {
                return (
                    <Unavailable
                        event={event}
                        reason={UnavailabilityReason.NO_MATERIALS}
                        onUpdateMaterialClick={handleUpdateMaterialClick}
                    />
                );
            }
            if (!isDone && hasMaterialShortage) {
                return (
                    <Unavailable
                        event={event}
                        reason={UnavailabilityReason.MATERIAL_SHORTAGE}
                        onUpdateMaterialClick={handleUpdateMaterialClick}
                    />
                );
            }
            if (!isDone && isInventoryPeriodClosed) {
                return (
                    <Unavailable
                        event={event}
                        reason={UnavailabilityReason.TOO_LATE}
                    />
                );
            }

            return (
                <Inventory
                    event={event}
                    inventory={inventory}
                    errors={inventoryErrors}
                    displayGroup={displayGroup}
                    onChange={handleChangeInventory}
                    onRequestCancel={handleCancel}
                />
            );
        };

        return (
            <Page
                ref="page"
                name="event-departure"
                title={pageTitle}
                hasValidationError={!!inventoryErrors}
            >
                <div class="EventDeparture">
                    <Header
                        class="EventDeparture__header"
                        event={event}
                        displayGroup={displayGroup}
                        showDisplayGroupSelector={isViewable}
                        showMaterialEditAction={isMaterialEditable}
                        onDisplayGroupChange={handleChangeDisplayGroup}
                        onUpdateMaterialClick={handleUpdateMaterialClick}
                    />
                    <div class="EventDeparture__body">
                        {renderContent()}
                    </div>
                    {isEditable && (
                        <Footer
                            class="EventDeparture__footer"
                            event={event}
                            isSaving={isSaving}
                            canTerminate={canTerminate}
                            onSave={handleSave}
                            onTerminate={handleTerminate}
                        />
                    )}
                </div>
            </Page>
        );
    },
});

export default EventDeparture;
