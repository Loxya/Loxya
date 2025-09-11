import './index.scss';
import { defineComponent, markRaw } from 'vue';
import DateTime from '@/utils/datetime';
import Button from '@/themes/default/components/Button';
import Inventory, {
    DisplayGroup,
    InventoryLock,
    InventoryErrorsSchema,
} from '@/themes/default/components/Inventory';

import type { PropType, Raw } from 'vue';
import type {
    EventDetails,
    EventMaterial,
} from '@/stores/api/events';
import type {
    AwaitedMaterial,
    InventoryData as CoreInventoryData,
    InventoryMaterial as CoreInventoryMaterial,
    InventoryMaterialData as CoreInventoryMaterialData,
    InventoryMaterialError,
} from '@/themes/default/components/Inventory';

type InventoryData = CoreInventoryData<false, true>;
type InventoryMaterial = CoreInventoryMaterial<false, true>;
type InventoryMaterialData = CoreInventoryMaterialData<false, true>;

type Props = {
    /** L'événement dont on veut faire l'inventaire de départ. */
    event: EventDetails,

    /** L'inventaire déjà réalisé (le cas échéant) pour l'événement. */
    inventory: InventoryData,

    /** L'affichage par groupe à utiliser. */
    displayGroup: DisplayGroup,

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

/** L'inventaire de matériel de la page d'inventaire de départ d'événement. */
const EventDepartureInventory = defineComponent({
    name: 'EventDepartureInventory',
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
        awaitedMaterials(): Array<AwaitedMaterial<false>> {
            return this.event.materials.map(
                (eventMaterial: EventMaterial): AwaitedMaterial<false> => {
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
                    };
                },
            );
        },

        isComplete(): boolean {
            return this.awaitedMaterials.every((material: AwaitedMaterial) => {
                const materialInventory = this.inventory.find(({ id }: InventoryMaterial) => material.id === id);
                return materialInventory ? materialInventory.actual === material.awaitedQuantity : false;
            });
        },

        isMaterialEditable(): boolean {
            const { event } = this;

            return (
                // - Un événement archivé n'est pas modifiable.
                !event.is_archived &&

                // - Un événement ne peut être modifié que si son inventaire de retour
                //   n'a pas été effectué (sans quoi celui-ci n'aurait plus aucun sens,
                //   d'autant que le stock global a pu être impacté suite à cet inventaire).
                !event.is_return_inventory_done
            );
        },

        isDone(): boolean {
            return !!this.event.is_departure_inventory_done;
        },

        isCancellable(): boolean {
            const { event } = this;

            // - Si l'inventaire de départ n'est pas fait ou bien que l'événement est archivé ou si
            //   l'inventaire de retour est effectué, on ne permet pas d'annuler l'inventaire de départ.
            if (!this.isDone || event.is_archived || event.is_return_inventory_done) {
                return false;
            }

            // - On ne permet d'annuler l'inventaire de départ que si l'événement n'a pas encore commencé.
            return event.operation_period.start.isAfter(this.now);
        },

        globalStatus(): string | null {
            const { __, event, isDone } = this;

            if (!isDone) {
                return null;
            }

            const author = event.departure_inventory_author !== null
                ? event.departure_inventory_author.full_name
                : null;

            let relativeDate = null;
            if (event.departure_inventory_datetime !== null) {
                const inventoryDatetime = event.departure_inventory_datetime;
                relativeDate = inventoryDatetime.isAfter(this.now)
                    ? inventoryDatetime.from(inventoryDatetime.add(1, 'milliseconds'))
                    : inventoryDatetime.from(this.now);
            }

            if (author !== null && relativeDate !== null) {
                return __('status.with-author-date', { author, relativeDate });
            }

            if (author !== null) {
                return __('status.with-author', { author });
            }

            if (relativeDate !== null) {
                return __('status.with-date', { relativeDate });
            }

            return __('status.simple');
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
                ? `page.event-departure.${key}`
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
            isDone,
            isComplete,
            isCancellable,
            handleChange,
            handleCancel,
        } = this;

        return (
            <div class="EventDepartureInventory">
                {isDone && (
                    <div class="EventDepartureInventory__summary">
                        <div class="EventDepartureInventory__summary__message">
                            <p class="EventDepartureInventory__summary__message__text">
                                {globalStatus}
                            </p>
                            {isCancellable && (
                                <Button size="small" type="warning" onClick={handleCancel}>
                                    {__('put-back-on-hold')}
                                </Button>
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
                    locked={isDone || [InventoryLock.STATE]}
                    withComments
                    strict
                />
                {(!isDone && isComplete) && (
                    <div class="EventDepartureInventory__complete">
                        {__('complete-inventory-help')}
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
export default EventDepartureInventory;
