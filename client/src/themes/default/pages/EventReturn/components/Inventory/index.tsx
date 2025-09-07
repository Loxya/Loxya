import './index.scss';
import { defineComponent, markRaw } from 'vue';
import DateTime from '@/utils/datetime';
import Button from '@/themes/default/components/Button';
import IconMessage from '@/themes/default/components/IconMessage';
import Inventory, {
    DisplayGroup,
    InventoryLock,
    InventoryErrorsSchema,
} from '@/themes/default/components/Inventory';

import type { PropType, Raw } from 'vue';
import type { EventDetails, EventMaterial } from '@/stores/api/events';
import type {
    AwaitedMaterial,
    InventoryData as CoreInventoryData,
    InventoryMaterial as CoreInventoryMaterial,
    InventoryMaterialData as CoreInventoryMaterialData,
    InventoryMaterialError,
} from '@/themes/default/components/Inventory';

type InventoryData = CoreInventoryData<true, true>;
type InventoryMaterial = CoreInventoryMaterial<true, true>;
type InventoryMaterialData = CoreInventoryMaterialData<true, true>;

type Props = {
    /** L'événement dont on veut faire l'inventaire de retour. */
    event: EventDetails,

    /** L'inventaire déjà réalisé (le cas échéant) pour l'événement. */
    inventory: InventoryData,

    /** L'affichage par groupe à utiliser. */
    displayGroup: DisplayGroup,

    /** Indique si l'inventaire de retour peut-être "terminée" ou non. */
    canTerminate: boolean,

    /** Les éventuelles erreurs de l'inventaire (par matériel). */
    errors?: InventoryMaterialError[] | null,

    /**
     * Fonction appelée lorsque l'inventaire d'un des matériels a changé.
     *
     * @param id - Identifiant du matériel concerné.
     * @param inventory - Données d'inventaire mises à jour pour ce matériel.
     */
    onChange?(id: AwaitedMaterial['id'], inventory: InventoryMaterialData): void,

    /**
     * Fonction appelée lorsque l'utilisateur demande la
     * remise en brouillon de l'inventaire.
     */
    onRequestCancel?(): void,
};

type InstanceProperties = {
    nowTimer: ReturnType<typeof setInterval> | undefined,
};

type Data = {
    now: Raw<DateTime>,
};

/** L'inventaire de matériel de la page d'inventaire de retour d'événement. */
const EventReturnInventory = defineComponent({
    name: 'EventReturnInventory',
    props: {
        event: {
            type: Object as PropType<Required<Props>['event']>,
            required: true,
        },
        inventory: {
            type: Array as PropType<Required<Props>['inventory']>,
            required: true,
        },
        displayGroup: {
            type: String as PropType<Required<Props>['displayGroup']>,
            required: true,
            validator: (displayGroup: unknown): boolean => (
                typeof displayGroup === 'string' &&
                (Object.values(DisplayGroup) as string[]).includes(displayGroup)
            ),
        },
        canTerminate: {
            type: Boolean as PropType<Props['canTerminate']>,
            required: true,
        },
        errors: {
            type: Array as PropType<Required<Props>['errors']>,
            default: null,
        },
        // eslint-disable-next-line vue/no-unused-properties
        onChange: {
            type: Function as PropType<Props['onChange']>,
            default: undefined,
        },
        // eslint-disable-next-line vue/no-unused-properties
        onRequestCancel: {
            type: Function as PropType<Props['onRequestCancel']>,
            default: undefined,
        },
    },
    emits: ['change', 'requestCancel'],
    setup: (): InstanceProperties => ({
        nowTimer: undefined,
    }),
    data: (): Data => ({
        now: markRaw(DateTime.now()),
    }),
    computed: {
        awaitedMaterials(): AwaitedMaterial[] {
            const { isDepartureInventoryDone } = this;

            return this.event.materials.map(
                (eventMaterial: EventMaterial) => {
                    const { id, name, reference, quantity, material } = eventMaterial;

                    return {
                        id,
                        name,
                        reference,
                        category_id: material.category_id,
                        sub_category_id: material.sub_category_id,
                        tags: material.tags,
                        park_id: material.park_id,
                        awaitedQuantity: quantity,
                        comment: isDepartureInventoryDone
                            ? (eventMaterial.departure_comment ?? null)
                            : null,
                    };
                },
            );
        },

        isAllReturned(): boolean {
            return this.awaitedMaterials.every((material: AwaitedMaterial) => {
                const materialInventory = this.inventory.find(({ id }: InventoryMaterial) => material.id === id);
                return materialInventory ? materialInventory.actual === material.awaitedQuantity : false;
            });
        },

        isDone(): boolean {
            return !!this.event.is_return_inventory_done;
        },

        isDepartureInventoryDone(): boolean {
            return !!this.event.is_departure_inventory_done;
        },

        hasBroken(): boolean {
            return this.inventory.some(
                ({ broken }: InventoryMaterial) => broken > 0,
            );
        },

        hasStarted(): boolean {
            return !!this.event.is_return_inventory_started;
        },

        isCancellable(): boolean {
            const { event, hasBroken } = this;

            // - Si l'inventaire de retour n'est pas fait ou bien que l'événement est
            //   archivé, on ne permet pas d'annuler l'inventaire.
            if (!this.isDone || event.is_archived) {
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

        globalStatus(): string | null {
            const { __, event, isDone } = this;

            if (!isDone) {
                return null;
            }

            const author = event.return_inventory_author !== null
                ? event.return_inventory_author.full_name
                : null;

            let relativeDate = null;
            if (event.return_inventory_datetime !== null) {
                const inventoryDatetime = event.return_inventory_datetime;
                relativeDate = inventoryDatetime.isAfter(this.now)
                    ? inventoryDatetime.from(inventoryDatetime.add(1, 'milliseconds'))
                    : inventoryDatetime.from(this.now);
            }

            if (author !== null && relativeDate !== null) {
                return __('statuses.done.with-author-date', { author, relativeDate });
            }

            if (author !== null) {
                return __('statuses.done.with-author', { author });
            }

            if (relativeDate !== null) {
                return __('statuses.done.with-date', { relativeDate });
            }

            return __('statuses.done.simple');
        },
    },
    mounted() {
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

        handleChange(id: AwaitedMaterial['id'], materialInventory: InventoryMaterialData) {
            this.$emit('change', id, materialInventory);
        },

        handleCancel() {
            if (!this.isCancellable) {
                return;
            }
            this.$emit('requestCancel');
        },

        // ------------------------------------------------------
        // -
        // -    Méthodes internes
        // -
        // ------------------------------------------------------

        __(key: string, params?: Record<string, number | string>, count?: number): string {
            key = !key.startsWith('global.')
                ? `page.event-return.${key}`
                : key.replace(/^global\./, '');

            return this.$t(key, params, count);
        },
    },
    render() {
        const {
            __,
            globalStatus,
            inventory,
            displayGroup,
            awaitedMaterials,
            errors,
            hasBroken,
            hasStarted,
            isDone,
            isAllReturned,
            isCancellable,
            canTerminate,
            handleChange,
            handleCancel,
        } = this;

        return (
            <div class="EventReturnInventory">
                {isDone && (
                    <div class="EventReturnInventory__summary">
                        <div class="EventReturnInventory__summary__introduction">
                            <div class="EventReturnInventory__summary__introduction__message">
                                <p class="EventReturnInventory__summary__introduction__message__text">
                                    {globalStatus}
                                </p>
                                {isCancellable && (
                                    <Button size="small" type="warning" onClick={handleCancel}>
                                        {(
                                            hasBroken
                                                ? __('put-back-on-hold-and-restore-stock')
                                                : __('put-back-on-hold')
                                        )}
                                    </Button>
                                )}
                            </div>
                        </div>
                        <div class="EventReturnInventory__summary__statuses">
                            {isAllReturned && (
                                <IconMessage
                                    name="check"
                                    message={__('statuses.all-material-returned')}
                                    class={[
                                        'EventReturnInventory__summary__statuses__item',
                                        'EventReturnInventory__summary__statuses__item--all-returned',
                                    ]}
                                />
                            )}
                            {!isAllReturned && (
                                <IconMessage
                                    name="exclamation-triangle"
                                    message={__('statuses.some-material-is-missing')}
                                    class={[
                                        'EventReturnInventory__summary__statuses__item',
                                        'EventReturnInventory__summary__statuses__item--missing',
                                    ]}
                                />
                            )}
                            {hasBroken && (
                                <IconMessage
                                    name="exclamation-triangle"
                                    message={__('statuses.some-material-came-back-broken')}
                                    class={[
                                        'EventReturnInventory__summary__statuses__item',
                                        'EventReturnInventory__summary__statuses__item--has-broken',
                                    ]}
                                />
                            )}
                        </div>
                    </div>
                )}
                <Inventory
                    inventory={inventory}
                    materials={awaitedMaterials}
                    displayGroup={displayGroup}
                    errors={errors ?? undefined}
                    onChange={handleChange}
                    locked={isDone || [
                        InventoryLock.STATE,
                        InventoryLock.COMMENT,
                    ]}
                    withBrokenCount
                    withComments
                    strict
                />
                {(!isDone && hasStarted && isAllReturned) && (
                    <div class="EventReturnInventory__complete">
                        {!canTerminate && __('alerts.all-material-returned-draft')}
                        {canTerminate && __('alerts.all-material-returned')}
                    </div>
                )}
            </div>
        );
    },
});

export type {
    InventoryData,
    InventoryMaterial,
    InventoryMaterialData,
    InventoryMaterialError,
};

export { DisplayGroup, InventoryErrorsSchema };
export default EventReturnInventory;
