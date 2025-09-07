import './index.scss';
import invariant from 'invariant';
import config from '@/globals/config';
import { defineComponent } from 'vue';
import showModal from '@/utils/showModal';
import isMaterialResyncable from './utils/isMaterialResyncable';
import apiMaterials from '@/stores/api/materials';
import CriticalError from '@/themes/default/components/CriticalError';
import Loading from '@/themes/default/components/Loading';
import Button from '@/themes/default/components/Button';
import Dropdown from '@/themes/default/components/Dropdown';
import FiltersPanel from './components/Filters';
import List from './components/List';
import store from './store';

// - Modales
import ImportFromEvent from './modals/ImportFromEvent';
import ResyncMaterialData from './modals/ResyncMaterialData';

import type { PropType } from 'vue';
import type { MaterialWithAvailability, MaterialWithContext } from '@/stores/api/materials';
import type {
    EventDetails,
    EventMaterial,
} from '@/stores/api/events';
import type {
    Bookable,
    SelectedMaterial,
    EmbeddedMaterial,
    SourceMaterial,
    SourceMaterialOverrides,
    Filters,
} from './_types';

type Props = {
    /**
     * La sélection de matériel initiale.
     *
     * /!\ Attention, cette prop. ne peut pas être utilisée pour "controller" le component.
     * Celui-ci maintient son propre "state". Vous pouvez récupérer l'état courant
     * via l'API publique `[Ref].values` ou en écoutant l'événement `onChange`.
     */
    defaultValues?: SelectedMaterial[],

    /**
     * Le bookable ({@see {@link Bookable}}) dans lequel le matériel va être ajouté.
     *
     * Si spécifié, le comportement du component changera comme suit:
     * - Si la valeur de `withBilling` est non spécifiée, c'est la valeur du
     *   champ `is_billable` du bookable qui sera utilisée.
     * - Si la devise du bookable ne correspond pas à la devise courante de l'application,
     *   il ne sera possible que de modifier les quantités du matériel déjà existant,
     *   il ne sera pas possible d'importer depuis des modèles, ni de resynchroniser
     *   les prix (vu que la devise n'est plus la même).
     *
     * NOTE: À noter que les matériels déjà contenu dans cette prop. ne seront pas
     * directement utilisés. C'est à dire que si vous passez un bookable sans
     * passer `defaultValues`, il n'y aura pas de matériel pré-sélectionné.
     */
    bookable?: Bookable,

    /**
     * Doit-on afficher les informations liées à la facturation ?
     *
     * Si non spécifié et qu'un `bookable` est passé, c'est la valeur de
     * son champ `is_billable` qui sera utilisée, sinon `false`.
     */
    withBilling?: boolean,

    /**
     * Fonction appelée lorsque le sélecteur de matériel est prêt.
     * (Déclenché lorsque la récupération du matériel est terminée notamment)
     */
    onReady?(): void,

    /**
     * Fonction appelée lorsque la sélection de matériel a changé.
     *
     * @param materials - La nouvelle sélection de matériel.
     */
    onChange?(materials: SelectedMaterial[]): void,

    /**
     * Fonction appelée lorsque les données d'un matériel ont été resynchronisées.
     *
     * @param updatedMaterial - Les données du matériel qui a été resynchronisé.
     */
    onMaterialResynced?(updatedMaterial: EmbeddedMaterial): void,
};

type Data = {
    isInitialized: boolean,
    isFetched: boolean,
    hasCriticalError: boolean,
    filters: Filters,
    rawMaterials: (
        | MaterialWithAvailability[]
        | MaterialWithContext[]
    ),
};

type InstanceProperties = {
    unsubscribeStore: (() => void) | undefined,
    fetchInterval: ReturnType<typeof setInterval> | undefined,
};

/**
 * Représente l'état des filtres quand ils sont vides.
 *
 * @param onlySelected - Dois-t'on afficher uniquement le matériel sélectionné ?
 *
 * @returns Les filtres "vides".
 */
const getEmptyFilters = (onlySelected: boolean): Filters => ({
    search: [],
    onlySelected,
    park: null,
    category: null,
    subCategory: null,
    tags: [],
});

/** Sélecteur de matériels. */
const MaterialsSelector = defineComponent({
    name: 'MaterialsSelector',
    props: {
        bookable: {
            type: Object as PropType<Props['bookable']>,
            default: undefined,
        },
        defaultValues: {
            type: Array as PropType<Required<Props>['defaultValues']>,
            default: () => [],
        },
        withBilling: {
            type: Boolean as PropType<Props['withBilling']>,
            default: undefined,
        },
        // eslint-disable-next-line vue/no-unused-properties
        onReady: {
            type: Function as PropType<Props['onReady']>,
            default: undefined,
        },
        // eslint-disable-next-line vue/no-unused-properties
        onChange: {
            type: Function as PropType<Props['onChange']>,
            default: undefined,
        },
        // eslint-disable-next-line vue/no-unused-properties
        onMaterialResynced: {
            type: Function as PropType<Props['onMaterialResynced']>,
            default: undefined,
        },
    },
    emits: [
        'ready',
        'change',
        'materialResynced',
    ],
    setup: (): InstanceProperties => ({
        unsubscribeStore: undefined,
        fetchInterval: undefined,
    }),
    data(): Data {
        return {
            isInitialized: false,
            isFetched: false,
            hasCriticalError: false,
            filters: getEmptyFilters(false),
            rawMaterials: [],
        };
    },
    computed: {
        materials(): SourceMaterial[] {
            const { bookable, withBillingFinal: withBilling } = this;

            return this.rawMaterials.map(
                (material: MaterialWithAvailability | MaterialWithContext) => {
                    const overrides: SourceMaterialOverrides | null = (() => {
                        if (bookable === undefined) {
                            return null;
                        }

                        if (!bookable.is_billable || !withBilling) {
                            const bookingMaterial = bookable.materials.find(
                                ({ id }: EmbeddedMaterial) => (id === material.id),
                            );
                            return bookingMaterial === undefined ? null : {
                                name: bookingMaterial.name,
                                reference: bookingMaterial.reference,
                                replacement_price: bookingMaterial.unit_replacement_price,
                                currency: bookable.currency,
                            };
                        }

                        const bookingMaterial = bookable.materials.find(
                            ({ id }: EmbeddedMaterial) => (id === material.id),
                        );
                        return bookingMaterial === undefined ? null : {
                            name: bookingMaterial.name,
                            reference: bookingMaterial.reference,
                            rental_price: bookingMaterial.unit_price,
                            degressive_rate: bookingMaterial.degressive_rate,
                            rental_price_period: bookingMaterial.unit_price_period,
                            replacement_price: bookingMaterial.unit_replacement_price,
                            currency: bookable.currency,
                        };
                    })();

                    return { ...material, overrides };
                },
            );
        },

        withBillingFinal(): boolean {
            if (this.withBilling !== undefined) {
                return this.withBilling;
            }
            return this.bookable?.is_billable ?? false;
        },

        hasSelectedMaterials(): boolean {
            return !store.getters.isEmpty;
        },

        isEditOnly(): boolean {
            if (this.bookable === undefined) {
                return false;
            }

            // - Si la devise du bookable n'est pas la même que la devise courante, on bloque
            //   en édition only (comprendre: uniquement la modification des quantités de
            //   l'existant) car le matériel tiers est dans une autre devise et les deux ne
            //   peuvent pas être réconciliés, pour cela il faudrait prendre en charge la
            //   conversion.
            return !config.currency.isSame(this.bookable.currency);
        },

        // ------------------------------------------------------
        // -
        // -    API Publique
        // -
        // ------------------------------------------------------

        /**
         * Retourne les quantités actuellement sélectionnées.
         *
         * @returns Les quantités actuellement sélectionnées.
         */
        values(): SelectedMaterial[] {
            return store.getters.export();
        },
    },
    mounted() {
        this.$store.dispatch('parks/fetch');

        this.init();
    },
    beforeDestroy() {
        this.unsubscribeStore?.();

        if (this.fetchInterval) {
            clearInterval(this.fetchInterval);
        }
    },
    methods: {
        // ------------------------------------------------------
        // -
        // -    Handlers
        // -
        // ------------------------------------------------------

        handleChange() {
            if (store.getters.isEmpty && !this.isEditOnly) {
                this.filters = { ...this.filters, onlySelected: false };
            }
            this.$emit('change', store.getters.export());
        },

        handleFiltersChange(filters: Filters) {
            this.filters = filters;
        },

        async handleEventImport() {
            if (this.isEditOnly) {
                return;
            }

            const withBilling = this.withBillingFinal;
            const event: EventDetails | undefined = (
                await showModal(this.$modal, ImportFromEvent, {
                    materials: this.materials,
                    bookable: this.bookable,
                    withBilling,
                })
            );
            if (event) {
                this.importFromEvent(event);
            }
        },

        async handleResyncMaterialData(materialId: SourceMaterial['id']) {
            const material = this.materials.find(({ id }: SourceMaterial) => id === materialId);
            if (!material || !isMaterialResyncable(material, this.withBillingFinal)) {
                return;
            }

            const withBilling = this.withBillingFinal;
            const updatedMaterial: EmbeddedMaterial | undefined = (
                await showModal(this.$modal, ResyncMaterialData, {
                    bookable: this.bookable,
                    withBilling,
                    material,
                })
            );
            if (updatedMaterial !== undefined) {
                this.$emit('materialResynced', updatedMaterial);
            }
        },

        handleShowAllMaterials() {
            if (!this.filters.onlySelected || this.isEditOnly) {
                return;
            }
            this.filters = { ...this.filters, onlySelected: false };
        },

        // ------------------------------------------------------
        // -
        // -    Méthodes internes
        // -
        // ------------------------------------------------------

        init() {
            invariant(!this.isInitialized, 'Already initialized.');

            // - On initialise le store avec les données initiales.
            store.commit('init', this.defaultValues);

            // - Si du matériel est déjà sélectionné à l'initialisation ...
            //   => On passe en mode "Sélectionné uniquement".
            const showOnlySelected = this.isEditOnly || !store.getters.isEmpty;
            this.filters = { ...this.filters, onlySelected: showOnlySelected };

            // - Observe les changements du store et appelle le handler adéquate.
            this.unsubscribeStore = store.subscribe(() => { this.handleChange(); });

            // - Actualise la liste du matériel toutes les 30 secondes.
            this.fetchInterval = setInterval(this.fetchMaterials.bind(this), 30_000);
            this.fetchMaterials();

            this.isInitialized = true;
        },

        async fetchMaterials() {
            const { bookable } = this;

            try {
                this.rawMaterials = await (() => {
                    if (bookable === undefined) {
                        return apiMaterials.all({ withDeleted: true, paginated: false });
                    }

                    return apiMaterials.allWhileEvent(bookable.id);
                })();

                this.isFetched = true;
                this.$emit('ready');
            } catch {
                if (!this.isFetched) {
                    this.hasCriticalError = true;

                    // - On ne tente pas de refetch si on est en erreur critique...
                    if (this.fetchInterval) {
                        clearInterval(this.fetchInterval);
                    }
                }
            }
        },

        async importFromEvent(event: EventDetails) {
            if (this.isEditOnly) {
                return;
            }

            // - On reset les filtres sans quoi l'utilisateur ne pourra
            //   potentiellement pas voir ce qu'il vient d'importer.
            this.filters = getEmptyFilters(true);

            event.materials.forEach((eventMaterial: EventMaterial) => {
                const { id, quantity } = eventMaterial;

                const material = this.materials.find(({ id: _id }: SourceMaterial) => _id === id);
                if (!material || material.is_deleted || quantity <= 0) {
                    return;
                }

                //
                // - Liste globale.
                //

                const globalQuantity = Math.max(0, quantity);

                //
                // - Ajustement des quantités.
                //

                // - Ajuste la quantité de la liste globale.
                if (globalQuantity > 0) {
                    store.commit('setQuantity', { material, quantity: globalQuantity });
                }
            });
        },

        __(key: string, params?: Record<string, number | string>, count?: number): string {
            key = !key.startsWith('global.')
                ? `components.MaterialsSelector.${key}`
                : key.replace(/^global\./, '');

            return this.$t(key, params, count);
        },
    },
    render() {
        const {
            __,
            filters,
            isInitialized,
            isEditOnly,
            isFetched,
            materials,
            hasCriticalError,
            hasSelectedMaterials,
            withBillingFinal: withBilling,
            handleFiltersChange,
            handleEventImport,
            handleShowAllMaterials,
            handleResyncMaterialData,
        } = this;

        // - On affiche le filtre permettant de n'afficher que le matériel
        //   sélectionné que s'il y a effectivement du matériel sélectionné.
        //   (ou que le filtre est encore sur "activé" et qu'il n'y a plus
        //   de matériel sélectionné) et qu'on est pas en "edit only".
        const showSelectedOnlyFilter = !isEditOnly && (
            hasSelectedMaterials || filters.onlySelected
        );

        if (hasCriticalError || !isInitialized || !isFetched) {
            return (
                <div class="MaterialsSelector MaterialsSelector--not-ready">
                    {hasCriticalError ? <CriticalError /> : <Loading />}
                </div>
            );
        }

        const renderImportActions = (): JSX.Element => (
            <Dropdown label={__('add-materials-from.dropdown.title')}>
                <Button
                    type="add"
                    class="Dropdown__item"
                    onClick={handleEventImport}
                    disabled={isEditOnly}
                >
                    {__('add-materials-from.an-event')}
                </Button>
            </Dropdown>
        );

        return (
            <div class="MaterialsSelector">
                <header class="MaterialsSelector__header">
                    <div class="MaterialsSelector__header__filters">
                        <FiltersPanel
                            values={filters}
                            withSelectedOnlyFilter={showSelectedOnlyFilter}
                            onChange={handleFiltersChange}
                        />
                    </div>
                    <div class="MaterialsSelector__header__actions">
                        {renderImportActions()}
                    </div>
                </header>
                <div class="MaterialsSelector__main">
                    <List
                        ref="list"
                        filters={filters}
                        materials={materials}
                        withBilling={withBilling}
                        isEditOnly={isEditOnly}
                        onRequestResyncMaterialData={handleResyncMaterialData}
                        onRequestShowAllMaterials={handleShowAllMaterials}
                    />
                </div>
            </div>
        );
    },
});

export type { Bookable, SelectedMaterial };

export { BookableEntity } from './_types';
export { default as getEmbeddedMaterialsQuantities } from './utils/getEmbeddedMaterialsQuantities';
export { default as hasQuantitiesChanged } from './utils/hasQuantitiesChanged';

export default MaterialsSelector;
