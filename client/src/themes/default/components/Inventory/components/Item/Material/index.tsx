import './index.scss';
import showModal from '@/utils/showModal';
import { defineComponent } from 'vue';
import QuantityInput from '@/themes/default/components/QuantityInput';
import Dropdown from '@/themes/default/components/Dropdown';
import Button from '@/themes/default/components/Button';
import { normalizeComment } from '../../../_utils';
import { InventoryLock } from '../../../_types';

// - Modales
import CommentEdition from '../../../modals/CommentEdition';

import type { PropType } from 'vue';
import type {
    AwaitedMaterial,
    InventoryMaterialData,
} from '../../../_types';

type Props = {
    /**
     * Le matériel dont on veut faire l'inventaire.
     *
     * @see {@link AwaitedMaterial} pour plus d'informations.
     */
    material: AwaitedMaterial,

    /**
     * L'inventaire actuel du matériel.
     *
     * @see {@link InventoryMaterialData} pour plus d'informations.
     */
    inventory: InventoryMaterialData,

    /**
     * L'inventaire est-il verrouillé (= Lecture seule).
     *
     * @default false
     */
    locked?: boolean | InventoryLock[],

    /**
     * Permet d'activer ou non le mode "strict".
     *
     * Si activé, il ne sera pas possible de spécifier une plus
     * grande quantité qu'attendue.
     *
     * @default false
     */
    strict?: boolean,

    /**
     * Doit-on inventorier les quantités cassés ?
     *
     * @default false
     */
    withBrokenCount?: boolean,

    /**
     * Les commentaires sont-ils activés sur cet inventaire ?
     *
     * @default false
     */
    withComments?: boolean,

    /**
     * Un éventuel message d'erreur à afficher pour le
     * matériel dans l'inventaire.
     */
    error?: string,

    /**
     * Fonction appelée lorsque l'inventaire du matériel change.
     *
     * @param newInventory - Le nouvel inventaire du matériel.
     */
    onChange?(newInventory: InventoryMaterialData): void,
};

/** L'inventaire d'un materiel. */
const InventoryItemMaterial = defineComponent({
    name: 'InventoryItemMaterial',
    props: {
        material: {
            type: Object as PropType<Props['material']>,
            required: true,
        },
        inventory: {
            type: Object as PropType<Props['inventory']>,
            required: true,
        },
        error: {
            type: String as PropType<Props['error']>,
            default: undefined,
        },
        locked: {
            type: [Boolean, Array] as PropType<Required<Props>['locked']>,
            default: false,
        },
        strict: {
            type: Boolean as PropType<Required<Props>['strict']>,
            default: false,
        },
        withBrokenCount: {
            type: Boolean as PropType<Required<Props>['withBrokenCount']>,
            default: false,
        },
        withComments: {
            type: Boolean as PropType<Required<Props>['withComments']>,
            default: false,
        },
        // eslint-disable-next-line vue/no-unused-properties
        onChange: {
            type: Function as PropType<Props['onChange']>,
            default: undefined,
        },
    },
    emits: ['change'],
    computed: {
        hasMultipleParks(): boolean {
            return this.$store.state.parks.list.length > 1;
        },

        id(): AwaitedMaterial['id'] {
            return this.material.id;
        },

        location(): string | null {
            const { material } = this;
            const { park_id: parkId } = material;

            const parkName: string | null = parkId !== null
                ? (this.$store.getters['parks/getName'](parkId) ?? null)
                : null;

            return parkName;
        },

        //
        // - Awaited
        //

        awaitedQuantity(): number {
            return this.material.awaitedQuantity ?? 0;
        },

        awaitedExternalQuantity(): number {
            return this.awaitedQuantity;
        },

        //
        // - Comment
        //

        isCommentLocked(): boolean {
            if (Array.isArray(this.locked)) {
                return this.locked.includes(InventoryLock.COMMENT);
            }
            return this.locked === true;
        },

        inventoryComment(): string | null | undefined {
            if (!this.withComments) {
                return undefined;
            }

            const { comment } = (this.inventory as InventoryMaterialData<boolean, true>);
            return comment !== undefined ? normalizeComment(comment ?? null) : undefined;
        },

        inheritedComment(): string | null | undefined {
            if (!this.withComments) {
                return undefined;
            }

            // - Si l'inventaire est complètement verrouillé, on ne doit pas
            //   hériter des inventaires précédent étant donné que celui-ci est "clôturé".
            if (this.locked === true) {
                return undefined;
            }

            const { comment } = (this.material as AwaitedMaterial<true>);
            return comment !== undefined ? normalizeComment(comment ?? null) : undefined;
        },

        //
        // - Actual
        //

        actualQuantity(): number {
            const actualQuantity = this.inventory?.actual ?? 0;

            if (this.locked === true) {
                return actualQuantity;
            }

            if (actualQuantity < 0) {
                this.warn('The quantity present is less than zero.');
                return 0;
            }

            if (this.strict && actualQuantity > this.awaitedQuantity) {
                this.warn('The total quantity present is greater than the total quantity expected in strict mode.');
                return this.awaitedQuantity;
            }

            return actualQuantity;
        },

        currentlyAwaitedActualQuantity(): number {
            return this.awaitedQuantity;
        },

        //
        // - Broken
        //

        brokenQuantity(): number {
            if (!this.withBrokenCount) {
                return 0;
            }
            const brokenQuantity = (this.inventory as InventoryMaterialData<true>).broken ?? 0;

            if (this.locked === true) {
                return brokenQuantity;
            }

            if (brokenQuantity < 0) {
                this.warn('The total quantity broken is less than zero.');
                return 0;
            }

            if (brokenQuantity > this.actualQuantity) {
                this.warn('The total quantity broken is greater than the total quantity present.');
                return this.actualQuantity;
            }

            return brokenQuantity;
        },

        currentlyAwaitedBrokenQuantity(): number {
            return this.awaitedQuantity;
        },

        //
        // - Helpers
        //

        isComplete(): boolean {
            return this.actualQuantity >= this.awaitedQuantity;
        },

        isReadOnlyQuantity(): boolean {
            return this.locked === true;
        },

        hasBroken(): boolean {
            return this.brokenQuantity > 0;
        },
    },
    methods: {
        // ------------------------------------------------------
        // -
        // -    Handlers
        // -
        // ------------------------------------------------------

        async handleModifyComment() {
            if (!this.withComments || this.isCommentLocked) {
                return;
            }

            const prevComment = this.inventoryComment ?? null;
            const newComment: string | null | undefined = (
                await showModal(this.$modal, CommentEdition, {
                    material: this.material,
                    defaultValue: prevComment,
                })
            );

            // - Si l'action est annulé dans la modale, on ne change rien.
            if (newComment === undefined) {
                return;
            }

            // - On déclenche un événement avec le nouvel état d'inventaire du matériel.
            const newInventory: InventoryMaterialData<boolean, true> = {
                actual: this.actualQuantity,
                comment: newComment,
            };
            if (this.withBrokenCount) {
                (newInventory as InventoryMaterialData<true, true>).broken = this.brokenQuantity;
            }
            this.$emit('change', newInventory);
        },

        handleActualQuantityChange(actual: number) {
            if (this.isReadOnlyQuantity) {
                return;
            }

            const { strict } = this;

            if (actual < 0) {
                actual = 0;
            }

            if (strict && actual > this.awaitedQuantity) {
                actual = this.awaitedQuantity;
            }

            // - On déclenche un événement avec le nouvel état d'inventaire du matériel.
            const newInventory: InventoryMaterialData = { actual };
            if (this.withBrokenCount) {
                const broken = Math.min(this.brokenQuantity, actual);
                (newInventory as InventoryMaterialData<true>).broken = broken;
            }
            if (this.withComments && !this.isCommentLocked) {
                (newInventory as InventoryMaterialData<boolean, true>).comment = this.inventoryComment ?? null;
            }
            this.$emit('change', newInventory);
        },

        handleBrokenQuantityChange(broken: number) {
            if (this.isReadOnlyQuantity || !this.withBrokenCount) {
                return;
            }

            const { strict } = this;

            if (broken < 0) {
                broken = 0;
            }

            if (strict && broken > this.awaitedQuantity) {
                broken = this.awaitedQuantity;
            }

            // - On déclenche un événement avec le nouvel état d'inventaire du matériel.
            const newInventory: InventoryMaterialData<true> = {
                broken,
                actual: Math.max(this.actualQuantity, broken),
            };
            if (this.withComments && !this.isCommentLocked) {
                (newInventory as InventoryMaterialData<boolean, true>).comment = this.inventoryComment ?? null;
            }
            this.$emit('change', newInventory);
        },

        // ------------------------------------------------------
        // -
        // -    Méthodes internes
        // -
        // ------------------------------------------------------

        warn(message: string) {
            // eslint-disable-next-line no-console
            console.warn(`Unexpected state in material #${this.id} inventory : ${message}`);
        },

        __(key: string, params?: Record<string, number | string>, count?: number): string {
            key = !key.startsWith('global.')
                ? `components.Inventory.${key}`
                : key.replace(/^global\./, '');

            return this.$t(key, params, count);
        },
    },
    render() {
        const {
            __,
            material,
            error,
            locked,
            strict,
            inventoryComment,
            inheritedComment,
            location,
            isComplete,
            isReadOnlyQuantity,
            isCommentLocked,
            hasBroken,
            withComments,
            withBrokenCount,
            awaitedQuantity,
            brokenQuantity,
            actualQuantity,
            handleModifyComment,
            handleActualQuantityChange,
            handleBrokenQuantityChange,
            currentlyAwaitedActualQuantity,
            currentlyAwaitedBrokenQuantity,
        } = this;
        const { reference, name } = material;
        const hasComment = !!(inventoryComment || inheritedComment);
        const hasOwnComment = !!inventoryComment;

        const classNames = ['InventoryItemMaterial', {
            'InventoryItemMaterial--read-only-quantity': isReadOnlyQuantity,
            'InventoryItemMaterial--complete': isComplete && actualQuantity > 0,
            'InventoryItemMaterial--warning': hasBroken,
            'InventoryItemMaterial--error': locked === true && !isComplete,
            'InventoryItemMaterial--with-comment': withComments && hasComment,
        }];

        return (
            <div class={classNames}>
                <div class="InventoryItemMaterial__inventory">
                    <div class="InventoryItemMaterial__inventory__main">
                        <div class="InventoryItemMaterial__title">
                            <span class="InventoryItemMaterial__title__name">{name}</span>
                            <span class="InventoryItemMaterial__title__reference">
                                {__('global.ref-ref', { reference })}
                            </span>
                        </div>
                        {!!location && (
                            <div class="InventoryItemMaterial__location">
                                {location}
                            </div>
                        )}
                        <div class="InventoryItemMaterial__awaited-quantity">
                            {__('global.awaited-qty-dots')}
                            <strong class="InventoryItemMaterial__awaited-quantity__count">
                                {awaitedQuantity}
                            </strong>
                        </div>
                        <div class="InventoryItemMaterial__actual-quantity">
                            {isReadOnlyQuantity ? actualQuantity : (
                                <QuantityInput
                                    value={actualQuantity}
                                    onChange={handleActualQuantityChange}
                                    limit={!strict ? undefined : {
                                        min: 0,
                                        max: currentlyAwaitedActualQuantity,
                                    }}
                                />
                            )}
                        </div>
                        {withBrokenCount && (
                            <div class="InventoryItemMaterial__quantity-broken">
                                {isReadOnlyQuantity ? brokenQuantity : (
                                    <QuantityInput
                                        value={brokenQuantity}
                                        onChange={handleBrokenQuantityChange}
                                        limit={!strict ? undefined : {
                                            min: 0,
                                            max: currentlyAwaitedBrokenQuantity,
                                        }}
                                    />
                                )}
                            </div>
                        )}
                        {locked !== true && (
                            <div class="InventoryItemMaterial__actions">
                                {(withComments && !isCommentLocked) && (
                                    <Dropdown icon="ellipsis-v" type="transparent">
                                        <Button icon="sticky-note:regular" onClick={handleModifyComment}>
                                            {hasOwnComment ? __('global.modify-comment') : __('global.add-comment')}
                                        </Button>
                                    </Dropdown>
                                )}
                            </div>
                        )}
                    </div>
                    {!!error && <p class="InventoryItemMaterial__inventory__error">{error}</p>}
                </div>
                {(withComments && hasComment) && (
                    <div class="InventoryItemMaterial__comment">
                        <p class="InventoryItemMaterial__comment__content">
                            <span class="InventoryItemMaterial__comment__label">
                                {hasOwnComment ? __('comment-label') : __('departure-comment-label')}
                            </span>
                            <span class="InventoryItemMaterial__comment__text">
                                {inventoryComment ?? inheritedComment}
                            </span>
                        </p>
                    </div>
                )}
            </div>
        );
    },
});

export default InventoryItemMaterial;
