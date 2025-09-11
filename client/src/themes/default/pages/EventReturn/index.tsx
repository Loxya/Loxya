import './index.scss';
import DateTime from '@/utils/datetime';
import parseInteger from '@/utils/parseInteger';
import { defineComponent, markRaw } from 'vue';
import { RequestError, HttpCode } from '@/globals/requester';
import { ApiErrorCode } from '@/stores/api/@codes';
import { ReturnInventoryMode } from '@/stores/api/settings';
import apiEvents from '@/stores/api/events';
import showModal from '@/utils/showModal';
import { confirm } from '@/utils/alert';
import Page from '@/themes/default/components/Page';
import Loading from '@/themes/default/components/Loading';
import CriticalError, { ErrorType } from '@/themes/default/components/CriticalError';
import Unavailable, { UnavailabilityReason } from './components/Unavailable';
import Inventory, { InventoryErrorsSchema, DisplayGroup } from './components/Inventory';
import Header from './components/Header';
import Footer from './components/Footer';

// - Modales
import FinishPrompt from './modals/FinishPrompt';

import type { ComponentRef, Raw } from 'vue';
import type { Settings } from '@/stores/api/settings';
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
        inventory: InventoryData,
        displayGroup: DisplayGroup,
        criticalError: ErrorType | null,
        isSaved: boolean,
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

/** Page d'inventaire de retour d'un événement. */
const EventReturn = defineComponent({
    name: 'EventReturn',
    setup: (): InstanceProperties => ({
        nowTimer: undefined,
    }),
    data(): Data {
        return {
            id: parseInteger(this.$route.params.id)!,
            event: null,
            inventory: [],
            displayGroup: DisplayGroup.CATEGORIES,
            isFetched: false,
            isSaved: false,
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

        mode(): Settings['returnInventory']['mode'] {
            return this.$store.state.settings.returnInventory.mode;
        },

        isInventoryPeriodOpen(): boolean {
            if (!this.event) {
                return false;
            }

            // NOTE: C'est la date de début de réservation qui fait foi pour permettre
            //       le retour, pas la date de début de mobilisation.
            //       (sans quoi on pourrait faire le retour d'une réservation avant même
            //       qu'il ait réellement commencée, ce qui n'a pas de sens).
            const { operation_period: operationPeriod } = this.event;
            return operationPeriod.isBeforeOrDuring(this.now);
        },

        hasMaterials(): boolean {
            if (!this.event) {
                return false;
            }
            return this.event.materials.length > 0;
        },

        hasBroken(): boolean {
            return this.inventory.some(
                ({ broken }: InventoryMaterial) => broken > 0,
            );
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
            return !!this.event.is_return_inventory_done;
        },

        isViewable(): boolean {
            if (!this.event || this.isArchived) {
                return false;
            }

            // - Si l'inventaire n'est pas encore disponible ou que l'événement ne contient
            //   pas de matériel, pas d'inventaire possible.
            if (!this.isInventoryPeriodOpen || !this.hasMaterials) {
                return false;
            }

            // - Si l'inventaire est déjà effectué, il est visualisable, sinon
            //   l'événement ne doit pas contenir de pénurie.
            return this.isDone || !this.hasMaterialShortage;
        },

        isEditable(): boolean {
            // - L'inventaire doit-être visualisable et ne pas être déjà terminé.
            return this.isViewable && !this.isDone;
        },

        isComplete(): boolean {
            if (!this.event) {
                return false;
            }

            const { event, inventory } = this;
            return event.materials.every(({ id: materialId, quantity }: EventMaterial) => {
                const quantities = inventory.find(({ id }: InventoryMaterial) => id === materialId);
                return quantities ? quantities.actual === quantity : false;
            });
        },

        isCancellable(): boolean {
            const { event, hasBroken } = this;

            // - Si l'inventaire n'est pas fait, il n'y a rien à annuler.
            if (!event || !this.isDone) {
                return false;
            }

            // - Si l'événement est archivé, on ne permet pas d'annuler l'inventaire.
            if (event.is_archived) {
                return false;
            }

            // - S'il n'y a pas de matériel cassé, on permet l'annulation de
            //   l'inventaire quelque soit le moment ou il a été terminé.
            //   Sinon, l'inventaire est annulable pendant 1 semaine après
            //   l'avoir marqué comme terminé.
            return (
                !hasBroken ||
                (
                    event.return_inventory_datetime
                        ?.isAfter(this.now.subWeek()) ?? false
                )
            );
        },

        canTerminate(): boolean {
            return this.event !== null && this.isEditable;
        },
    },
    mounted() {
        this.fetchData();

        // - Actualise le timestamp courant toutes les minutes.
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

            const index = this.inventory.findIndex(({ id: _id }: InventoryMaterial) => id === _id);
            if (index < 0) {
                return;
            }
            this.$set(this.inventory, index, { id, ...materialInventory });
            this.isSaved = false;
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
            if (!this.canTerminate) {
                return;
            }

            const hasBroken = this.inventory.some(
                ({ broken }: InventoryMaterial) => broken > 0,
            );

            const returnDate: DateTime | null | undefined = (
                await showModal(this.$modal, FinishPrompt, {
                    event: this.event,
                    hasBroken,
                })
            );

            // - Si l'action est annulée dans la modale, on ne fait rien.
            if (returnDate === undefined) {
                return;
            }

            await this.save(returnDate ?? true);
        },

        async handleCancel() {
            if (!this.isCancellable || this.isCancelling) {
                return;
            }
            this.isCancelling = true;
            const { __, event, hasBroken } = this;

            const isConfirmed = await confirm({
                type: 'danger',
                title: __('confirm-rollback-title'),
                text: hasBroken
                    ? __('confirm-rollback-with-broken-text')
                    : __('confirm-rollback-text'),
            });
            if (!isConfirmed) {
                this.isCancelling = false;
                return;
            }

            try {
                const updatedEvent = await apiEvents.cancelReturnInventory(event!.id);
                this.setEvent(updatedEvent);
            } catch {
                this.$toasted.error(__('global.errors.unexpected'));
            } finally {
                this.isCancelling = false;
            }
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

        async save(finish: boolean | DateTime = false) {
            if (this.isSaving) {
                return;
            }
            this.isSaving = true;
            const { __, inventory } = this;

            const doRequest = (): Promise<EventDetails> => {
                const shouldFinish = finish !== false;
                if (!shouldFinish) {
                    return apiEvents.updateReturnInventory(this.id, inventory);
                }

                const finishDate = finish !== true ? finish : undefined;
                return apiEvents.finishReturnInventory(this.id, finishDate, inventory);
            };

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
                console.error(`Error occurred while saving the event #${this.id} return inventory`, error);
                this.$toasted.error(__('global.errors.unexpected-while-saving'));
            } finally {
                this.isSaving = false;
            }
        },

        setEvent(event: EventDetails) {
            this.event = event;

            const { is_return_inventory_started: isReturnInventoryStarted } = event;
            this.isSaved = isReturnInventoryStarted;

            const getActualQuantity = (eventMaterial: EventMaterial): number => (
                (!isReturnInventoryStarted && this.mode === ReturnInventoryMode.START_FULL)
                    ? eventMaterial.quantity
                    : eventMaterial.quantity_returned ?? 0
            );

            this.inventory = event.materials.map(
                (eventMaterial: EventMaterial): InventoryMaterial => ({
                    id: eventMaterial.id,
                    actual: getActualQuantity(eventMaterial),
                    broken: eventMaterial.quantity_returned_broken ?? 0,
                }),
            );
        },

        __(key: string, params?: Record<string, number | string>, count?: number): string {
            key = !key.startsWith('global.')
                ? `page.event-return.${key}`
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
            isDone,
            isSaving,
            isArchived,
            isEditable,
            isViewable,
            canTerminate,
            hasMaterials,
            hasMaterialShortage,
            isInventoryPeriodOpen,
            handleSave,
            handleCancel,
            handleTerminate,
            handleChangeInventory,
            handleChangeDisplayGroup,
        } = this;

        if (criticalError || !isFetched) {
            return (
                <Page name="event-return" title={pageTitle} centered>
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
                    />
                );
            }
            if (!hasMaterials) {
                return (
                    <Unavailable
                        event={event}
                        reason={UnavailabilityReason.NO_MATERIALS}
                    />
                );
            }
            if (!isDone && hasMaterialShortage) {
                return (
                    <Unavailable
                        event={event}
                        reason={UnavailabilityReason.MATERIAL_SHORTAGE}
                    />
                );
            }

            return (
                <Inventory
                    event={event}
                    inventory={inventory}
                    errors={inventoryErrors}
                    displayGroup={displayGroup}
                    canTerminate={canTerminate}
                    onChange={handleChangeInventory}
                    onRequestCancel={handleCancel}
                />
            );
        };

        return (
            <Page
                ref="page"
                name="event-return"
                title={pageTitle}
                hasValidationError={!!inventoryErrors}
            >
                <div class="EventReturn">
                    <Header
                        class="EventReturn__header"
                        event={event}
                        displayGroup={displayGroup}
                        showDisplayGroupSelector={isViewable}
                        onDisplayGroupChange={handleChangeDisplayGroup}
                    />
                    <div class="EventReturn__body">
                        {renderContent()}
                    </div>
                    {isEditable && (
                        <Footer
                            class="EventReturn__footer"
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

export default EventReturn;
