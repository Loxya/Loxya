import { defineComponent } from 'vue';
import Material from './Material';

import type { PropType } from 'vue';
import type {
    InventoryLock,
    AwaitedMaterial,
    InventoryMaterialData,
} from '../../_types';

type Props = {
    /**
     * Un des matériels attendus dans l'inventaire.
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
     * @param id - Identifiant du matériel dont l'inventaire a changé.
     * @param newInventory - Le nouvel inventaire du matériel.
     */
    onChange?(id: AwaitedMaterial['id'], newInventory: InventoryMaterialData): void,
};

/** Un matériel dans l'inventaire de matériel. */
const InventoryItem = defineComponent({
    name: 'InventoryItem',
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
        id(): AwaitedMaterial['id'] {
            return this.material.id;
        },
    },
    methods: {
        // ------------------------------------------------------
        // -
        // -    Handlers
        // -
        // ------------------------------------------------------

        handleChange(inventory: InventoryMaterialData) {
            if (this.locked === true) {
                return;
            }
            this.$emit('change', this.id, inventory);
        },

        // ------------------------------------------------------
        // -
        // -    API Publique
        // -
        // ------------------------------------------------------

        /**
         * Fait défiler la page de manière à faire apparaître l'élément d'inventaire.
         *
         * @param behavior - Détermine la manière d'atteindre l'élément:
         *                   - `smooth`: Le defilement sera progressif, avec animation (défaut).
         *                   - `instant`: La defilement sera instantanée.
         *                   - `auto`: L'animation de defilement sera déterminée via la
         *                             propriété CSS `scroll-behavior`.
         */
        scrollIntoView(behavior: ScrollBehavior = 'smooth') {
            const $container = this.$refs.container as HTMLElement | undefined;
            $container?.scrollIntoView({ behavior, block: 'center' });
        },
    },
    render() {
        const {
            inventory,
            material,
            error,
            locked,
            strict,
            withComments,
            withBrokenCount,
            handleChange,
        } = this;

        return (
            <div class="InventoryItem" ref="container">
                <Material
                    material={material}
                    inventory={inventory}
                    error={error}
                    strict={strict}
                    locked={locked}
                    withBrokenCount={withBrokenCount}
                    withComments={withComments}
                    onChange={handleChange}
                />
            </div>
        );
    },
});

export default InventoryItem;
