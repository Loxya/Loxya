import './index.scss';
import invariant from 'invariant';
import stringIncludes from '@/utils/stringIncludes';
import { defineComponent } from 'vue';
import { UNCATEGORIZED } from '@/stores/api/materials';
import { groupByCategories } from './_utils';
import { InventoryLock, InventoryErrorsSchema } from './_types';
import StateMessage, { State } from '@/themes/default/components/StateMessage';
import SearchPanel from '@/themes/default/components/MaterialsFilters';
import Item from './components/Item';

import type { PropType } from 'vue';
import type { Tag } from '@/stores/api/tags';
import type { Filters } from '@/themes/default/components/MaterialsFilters';
import type {
    AwaitedMaterial,
    AwaitedMaterialGroup,
    InventoryData,
    InventoryMaterial,
    InventoryMaterialData,
    InventoryMaterialError,
} from './_types';

export enum DisplayGroup {
    /** Tri par catégories. */
    CATEGORIES = 'categories',

    // /** Tri par parcs. */
    // PARKS = 'parks',

    /** Pas de tri. */
    NONE = 'none',
}

type FilterResolver<T extends keyof Filters> = (
    (material: AwaitedMaterial, filter: NonNullable<Filters[T]>) => boolean
);

type Props = {
    /**
     * Le matériel attendu dans l'inventaire.
     *
     * @see {@link AwaitedMaterial} pour plus d'informations.
     */
    materials: AwaitedMaterial[],

    /**
     * L'inventaire déjà réalisé (le cas échéant).
     *
     * Le matériel dont il est fait l'inventaire dans cette prop. doit
     * impérativement exister dans la prop. `materials` (idem pour ses unités).
     *
     * @see {@link InventoryData} pour plus d'informations.
     */
    inventory: InventoryData,

    /** L'affichage par groupe à utiliser. */
    displayGroup?: DisplayGroup,

    /**
     * Permet de "verrouiller" l'inventaire (= Lecture seule).
     *
     * @default false
     */
    locked?: boolean | InventoryLock[],

    /**
     * Permet d'activer ou non le mode "strict".
     *
     * Si activé, il ne sera pas possible de spécifier une plus grande
     * quantité qu'attendue pour chaque matériel inventorié.
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
     * Ceci peut-être utile pour permettre à l'utilisateur d'ajouter des
     * remarques sur l'état, la condition, etc. d'un matériel.
     *
     * Note: Cette prop. n'impacte que l'activation ou non de la fonctionnalité
     * des commentaires sur l'inventaire (= l'affichage de ceux-ci), elle
     * n'implique pas que les commentaires sont autorisés en écriture.
     * Pour ceci veuillez utiliser voir la prop. `locked`.
     *
     * @default false
     */
    withComments?: boolean,

    /**
     * Une liste d'erreurs pour certains matériels (si nécessaire).
     *
     * Doit contenir un tableau d'objets au format suivant:
     * - `id`: L'identifiant du matériel (existant dans la prop `materials` donc).
     * - `message`: Un - éventuel - message d'erreur associé.
     */
    errors?: InventoryMaterialError[],

    /**
     * Fonction appelée lorsque l'inventaire d'un matériel change.
     *
     * @param materialId - L'identifiant du matériel pour lequel l'inventaire a changé.
     * @param inventory - La nouvelle valeur de l'inventaire du matériel.
     */
    onChange?(newValue: AwaitedMaterial['id'], materialInventory: InventoryMaterialData): void,
};

type Data = {
    filters: Filters,
};

/** Inventaire de matériel. */
const Inventory = defineComponent({
    name: 'Inventory',
    props: {
        materials: {
            type: Array as PropType<Props['materials']>,
            required: true,
        },
        inventory: {
            type: Array as PropType<Props['inventory']>,
            required: true,
        },
        errors: {
            type: Array as PropType<Required<Props>['errors']>,
            default: () => [],
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
        displayGroup: {
            type: String as PropType<Required<Props>['displayGroup']>,
            default: DisplayGroup.CATEGORIES,
            validator: (displayGroup: unknown): boolean => (
                typeof displayGroup === 'string' &&
                (Object.values(DisplayGroup) as string[]).includes(displayGroup)
            ),
        },
        // eslint-disable-next-line vue/no-unused-properties
        onChange: {
            type: Function as PropType<Props['onChange']>,
            default: undefined,
        },
    },
    emits: ['change'],
    data: (): Data => ({
        filters: {
            search: [],
            park: null,
            category: null,
            subCategory: null,
            tags: [],
        },
    }),
    computed: {
        isStateLocked(): boolean {
            if (Array.isArray(this.locked)) {
                return this.locked.includes(InventoryLock.STATE);
            }
            return this.locked === true;
        },

        isCommentSpecificallyLocked(): boolean {
            return Array.isArray(this.locked)
                ? this.locked.includes(InventoryLock.COMMENT)
                : false;
        },

        filteredMaterials(): AwaitedMaterial[] {
            const { materials, filters } = this;

            const filterResolvers: { [T in keyof Filters]: FilterResolver<T> } = {
                search: ({ name, reference }: AwaitedMaterial, rawTerms: Filters['search']) => {
                    const terms = rawTerms.filter(
                        (term: string) => term.trim().length > 1,
                    );
                    if (terms.length === 0) {
                        return true;
                    }

                    return terms.some((term: string) => (
                        stringIncludes(name, term) ||
                        stringIncludes(reference, term)
                    ));
                },
                park: (material: AwaitedMaterial, parkId: NonNullable<Filters['park']>) => (
                    material.park_id === parkId
                ),
                category: (material: AwaitedMaterial, categoryId: NonNullable<Filters['category']>) => (
                    (material.category_id === null && categoryId === UNCATEGORIZED) ||
                    material.category_id === categoryId
                ),
                subCategory: (material: AwaitedMaterial, subCategoryId: NonNullable<Filters['subCategory']>) => (
                    material.sub_category_id === subCategoryId
                ),
                tags: (material: AwaitedMaterial, tags: Filters['tags']) => (
                    tags.length === 0 || material.tags.some((tag: Tag) => tags.includes(tag.id))
                ),
            };

            return materials.filter((material: AwaitedMaterial): boolean => (
                !(Object.entries(filterResolvers) as Array<[keyof Filters, FilterResolver<keyof Filters>]>).some(
                    <T extends keyof Filters>([field, filterResolver]: [T, FilterResolver<T>]) => (
                        filters[field] ? !filterResolver(material, filters[field]) : false
                    ),
                )
            ));
        },

        isMaterialsEmpty(): boolean {
            return this.materials.length === 0;
        },

        isFilteredEmpty(): boolean {
            return this.filteredMaterials.length === 0;
        },

        list(): AwaitedMaterialGroup[] {
            switch (this.displayGroup) {
                case DisplayGroup.CATEGORIES: {
                    const categories = this.$store.state.categories.list;
                    return groupByCategories(this.filteredMaterials, categories);
                }
                // case DisplayGroup.PARKS: {
                //     const parks = this.$store.state.parks.list;
                //     // return dispatchMaterialInSections(this.filteredMaterials, 'park_id', parks);
                //     return groupByParks(this.filteredMaterials, parks);
                // }
                default: {
                    return [{ id: null, name: null, materials: this.filteredMaterials }];
                }
            }
        },
    },
    mounted() {
        this.$store.dispatch('categories/fetch');
        this.$store.dispatch('parks/fetch');
    },
    methods: {
        // ------------------------------------------------------
        // -
        // -    Handlers
        // -
        // ------------------------------------------------------

        handleChange(materialId: AwaitedMaterial['id'], materialInventory: InventoryMaterialData) {
            if (this.locked === true) {
                return;
            }
            this.$emit('change', materialId, materialInventory);
        },

        handleFiltersChange(filters: Filters) {
            this.filters = filters;
        },

        // ------------------------------------------------------
        // -
        // -    Méthodes internes
        // -
        // ------------------------------------------------------

        getMaterialInventory(materialId: AwaitedMaterial['id']): InventoryMaterialData {
            const material = this.materials.find((_material: AwaitedMaterial) => _material.id === materialId);
            invariant(material, 'The requested material is not part of the inventory.');

            const existingInventory = this.inventory.find(
                ({ id }: InventoryMaterial) => id === materialId,
            );

            const materialInventory: InventoryMaterialData = {
                actual: existingInventory?.actual ?? 0,
            };
            if (this.withComments && !this.isCommentSpecificallyLocked) {
                (materialInventory as InventoryMaterialData<boolean, true>).comment = (
                    (existingInventory as InventoryMaterial<boolean, true> | undefined)?.comment ?? null
                );
            }
            if (this.withBrokenCount) {
                (materialInventory as InventoryMaterialData<true>).broken = (
                    (existingInventory as InventoryMaterial<true> | undefined)?.broken ?? 0
                );
            }

            return materialInventory;
        },

        getMaterialError(materialId: AwaitedMaterial['id']): string | undefined {
            const error = this.errors?.find(({ id }: InventoryMaterialError) => id === materialId);
            return error?.message?.trim() || undefined;
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
            list,
            filters,
            strict,
            locked,
            isMaterialsEmpty,
            isFilteredEmpty,
            withComments,
            withBrokenCount,
            displayGroup,
            getMaterialInventory,
            getMaterialError,
            handleFiltersChange,
            handleChange,
        } = this;

        const isEmpty = (
            // - S'il n'y a pas de matériel à afficher.
            isMaterialsEmpty ||

            // - Ou, s'il n'y a pas de résultats selon les critères de recherche courants.
            isFilteredEmpty
        );
        const renderState = (): JSX.Element | null => {
            if (!isEmpty) {
                return null;
            }

            if (isMaterialsEmpty) {
                return (
                    <StateMessage
                        type={State.EMPTY}
                        size="small"
                        message={__('empty-state.no-materials')}
                    />
                );
            }

            return (
                <StateMessage
                    type={State.NO_RESULT}
                    size="small"
                    message={__('empty-state.no-filters-results')}
                />
            );
        };

        const classNames = ['Inventory', {
            'Inventory--editable': locked !== true,
            'Inventory--empty': isEmpty,
        }];

        return (
            <div class={classNames}>
                <SearchPanel
                    values={filters}
                    onChange={handleFiltersChange}
                />
                <div class="Inventory__content">
                    {renderState()}
                    {list.map(({ id: sectionId, name: sectionName, materials }: AwaitedMaterialGroup) => {
                        const key = sectionId ?? (displayGroup !== DisplayGroup.NONE ? undefined : 'flat');
                        return (
                            <div key={key} class="Inventory__section">
                                <div class="Inventory__section__header">
                                    {displayGroup !== DisplayGroup.NONE && (
                                        <h3 class="Inventory__section__title">
                                            {sectionName ?? __('global.not-categorized')}
                                        </h3>
                                    )}
                                    <div class="Inventory__section__columns">
                                        <span class="Inventory__section__columns__item">
                                            {__('global.actual-qty')}
                                        </span>
                                        {withBrokenCount && (
                                            <span class="Inventory__section__columns__item">
                                                {__('global.out-of-order-qty')}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div class="Inventory__section__items">
                                    {materials.map((material: AwaitedMaterial) => (
                                        <Item
                                            ref={`items[${material.id}]`}
                                            key={material.id}
                                            material={material}
                                            inventory={getMaterialInventory(material.id)}
                                            error={getMaterialError(material.id)}
                                            withBrokenCount={withBrokenCount}
                                            withComments={withComments}
                                            locked={locked}
                                            strict={strict}
                                            onChange={handleChange}
                                        />
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    },
});

export type {
    AwaitedMaterial,
    InventoryData,
    InventoryMaterial,
    InventoryMaterialData,
    InventoryMaterialError,
};

export {
    InventoryLock,
    InventoryErrorsSchema,
};

export default Inventory;
