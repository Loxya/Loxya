import './index.scss';
import Decimal from 'decimal.js';
import isTruthy from '@/utils/isTruthy';
import stringIncludes from '@/utils/stringIncludes';
import { defineComponent } from 'vue';
import Fragment from '@/components/Fragment';
import formatAmount from '@/utils/formatAmount';
import { ScreenSize, getScreenSize, observeScreenSize } from '@/utils/screenSize';
import { UNCATEGORIZED } from '@/stores/api/materials';
import { ClientTable } from '@/themes/default/components/Table';
import StateMessage, { State } from '@/themes/default/components/StateMessage';
import MaterialPopover from '@/themes/default/components/Popover/Material';
import Dropdown from '@/themes/default/components/Dropdown';
import Button from '@/themes/default/components/Button';
import Icon from '@/themes/default/components/Icon';
import Availability from './Availability';
import Quantity from './Quantity';
import getRentalPriceData from '../../utils/getRentalPriceData';
import isMaterialResyncable from '../../utils/isMaterialResyncable';
import store from '../../store';

import type { Tag } from '@/stores/api/tags';
import type { PropType, CreateElement } from 'vue';
import type { RentalPrice } from '../../utils/getRentalPriceData';
import type { ClientTableRef, Columns } from '@/themes/default/components/Table/Client';
import type { SourceMaterial, Filters } from '../../_types';

type FilterPredicate = (material: SourceMaterial) => boolean;
type FilterResolver<T extends keyof Filters> = (
    (filter: NonNullable<Filters[T]>) => FilterPredicate
);

type Props = {
    /** La liste de tout le matériel avec les quantités disponibles. */
    materials: SourceMaterial[],

    /** Les filtres utilisés pour éventuellement filtrer le matériel. */
    filters?: Filters,

    /** Doit-on afficher les informations liées à la facturation ? */
    withBilling: boolean,

    /** Doit-on permettre la resynchronisation ? */
    withResync: boolean,

    /**
     * Est-ce que le mode "modification uniquement" est activé ?
     *
     * Lorsqu'activé, il n'est plus possible d'ajouter du matériel.
     */
    isEditOnly: boolean,

    /**
     * Fonction appelée lorsque l'utilisateur demande à
     * resynchroniser les données d'un matériel.
     *
     * @param id - Identifiant du matériel à resynchroniser.
     */
    onRequestResyncMaterialData?(id: SourceMaterial['id']): void,

    /**
     * Fonction appelée lorsque l'utilisateur demande à
     * afficher tout le matériel.
     *
     * Utile par exemple pour pouvoir ajouter du matériel qui n'est
     * pas encore dans la liste.
     */
    onRequestShowAllMaterials?(): void,
};

type InstanceProperties = {
    cancelScreenSizeObserver: (() => void) | undefined,
};

type Data = {
    isMobile: boolean,
};

/** Liste de matériel d'un événement ou d'une réservation. */
const MaterialsSelectorList = defineComponent({
    name: 'MaterialsSelectorList',
    props: {
        materials: {
            type: Array as PropType<Required<Props>['materials']>,
            required: true,
        },
        filters: {
            type: Object as PropType<Required<Props>['filters']>,
            default: () => ({}),
        },
        withBilling: {
            type: Boolean as PropType<Props['withBilling']>,
            required: true,
        },
        withResync: {
            type: Boolean as PropType<Props['withResync']>,
            required: true,
        },
        isEditOnly: {
            type: Boolean as PropType<Props['isEditOnly']>,
            default: false,
        },
        // eslint-disable-next-line vue/no-unused-properties
        onRequestResyncMaterialData: {
            type: Function as PropType<Props['onRequestResyncMaterialData']>,
            default: undefined,
        },
        // eslint-disable-next-line vue/no-unused-properties
        onRequestShowAllMaterials: {
            type: Function as PropType<Props['onRequestShowAllMaterials']>,
            default: undefined,
        },
    },
    emits: [
        'requestResyncMaterialData',
        'requestShowAllMaterials',
    ],
    setup: (): InstanceProperties => ({
        cancelScreenSizeObserver: undefined,
    }),
    data: (): Data => ({
        isMobile: getScreenSize() === ScreenSize.MOBILE,
    }),
    computed: {
        filteredMaterials(): SourceMaterial[] {
            const { materials, filters } = this;

            const filterResolvers: { [T in keyof Filters]: FilterResolver<T> } = {
                search: (rawTerms: Filters['search']) => {
                    const terms = rawTerms.filter(
                        (term: string) => term.trim().length > 1,
                    );
                    if (terms.length === 0) {
                        return () => true;
                    }

                    return ({ name, reference }: SourceMaterial) => (
                        terms.some((term: string) => (
                            stringIncludes(name, term) ||
                            stringIncludes(reference, term)
                        ))
                    );
                },
                park: (parkId: NonNullable<Filters['park']>) => (
                    (material: SourceMaterial) => (
                        material.park_id === parkId
                    )
                ),
                category: (categoryId: NonNullable<Filters['category']>) => (
                    (material: SourceMaterial) => (
                        (material.category_id === null && categoryId === UNCATEGORIZED) ||
                        material.category_id === categoryId
                    )
                ),
                subCategory: (subCategoryId: NonNullable<Filters['subCategory']>) => (
                    (material: SourceMaterial) => (
                        material.sub_category_id === subCategoryId
                    )
                ),
                tags: (tags: Filters['tags']) => (
                    (material: SourceMaterial) => (
                        tags.length === 0 || material.tags.some((tag: Tag) => tags.includes(tag.id))
                    )
                ),
                onlySelected: (isOnlySelected: Filters['onlySelected']) => (
                    (material: SourceMaterial) => (
                        !isOnlySelected || this.getQuantity(material) > 0
                    )
                ),
            };

            const predicates: FilterPredicate[] = (
                (Object.entries(filters) as Array<[keyof Filters, unknown]>)
                    .filter(([, filterValue]: [keyof Filters, unknown]) => {
                        if (Array.isArray(filterValue)) {
                            return filterValue.length > 0;
                        }
                        return ![undefined, null, ''].includes(filterValue as any);
                    })
                    .map(([key, filterValue]: [keyof Filters, unknown]) => {
                        const resolverFactory = filterResolvers[key];
                        return (resolverFactory as any)(filterValue) as FilterPredicate;
                    })
            );

            return materials.filter((material: SourceMaterial): boolean => {
                // - Si le matériel n'est pas editable et n'est pas déjà inclut dans la liste
                //   du matériel, alors on ne l'affiche pas.
                if (!this.isMaterialEditable(material) && this.getQuantity(material) === 0) {
                    return false;
                }

                // - S'il n'est pas sélectionné et qu'il est supprimé, on ne l'affiche pas.
                const isSelected = this.getQuantity(material) > 0;
                if (!isSelected && material.is_deleted) {
                    return false;
                }

                return predicates.every((predicate: FilterPredicate) => predicate(material));
            });
        },

        isMaterialsEmpty(): boolean {
            if (this.materials.length === 0) {
                return true;
            }

            return !this.materials.some((material: SourceMaterial) => {
                const isSelected: boolean = store.getters.getQuantity(material.id) !== 0;
                return !material.is_deleted || isSelected;
            });
        },

        isSelectionEmpty(): boolean {
            return store.getters.isEmpty;
        },

        isFilteredEmpty(): boolean {
            return this.filteredMaterials.length === 0;
        },

        columns(): Columns<SourceMaterial> {
            const {
                __,
                isMobile,
                getQuantity,
                setQuantity,
                withBilling,
                withResync,
                isMaterialEditable,
                isMaterialDeletable,
                handleResyncMaterialData,
            } = this;

            return [
                {
                    key: 'quantity',
                    class: [
                        'MaterialsSelectorList__col',
                        'MaterialsSelectorList__col--quantity',
                    ],
                    render: (h: CreateElement, material: SourceMaterial) => (
                        getQuantity(material) > 0 ? `${getQuantity(material)}\u00A0×` : null
                    ),
                },
                {
                    key: 'name',
                    class: [
                        'MaterialsSelectorList__col',
                        'MaterialsSelectorList__col--name',
                    ],
                    render: (h: CreateElement, material: SourceMaterial) => {
                        const isNameUnsynced = material.overrides !== null
                            ? material.overrides.name !== material.name
                            : false;

                        const isReferenceUnsynced = material.overrides !== null
                            ? material.overrides.reference !== material.reference
                            : false;

                        const label: JSX.Element = (
                            <span
                                ref={`items[${material.id}]`}
                                class="MaterialsSelectorList__item__name"
                            >
                                <span
                                    class={[
                                        'MaterialsSelectorList__item__name__name',
                                        {
                                            'MaterialsSelectorList__item__name__name--unsynced': (
                                                isNameUnsynced && !material.is_deleted
                                            ),
                                        },
                                    ]}
                                >
                                    {material.overrides !== null ? material.overrides.name : material.name}
                                </span>
                                <span
                                    class={[
                                        'MaterialsSelectorList__item__name__reference',
                                        {
                                            'MaterialsSelectorList__item__name__reference--unsynced': (
                                                isReferenceUnsynced && !material.is_deleted
                                            ),
                                        },
                                    ]}
                                >
                                    {__('global.ref-ref', {
                                        reference: material.overrides !== null
                                            ? material.overrides.reference
                                            : material.reference,
                                    })}
                                </span>
                            </span>
                        );

                        const nameContent = material.is_deleted ? label : (
                            <MaterialPopover material={material}>
                                {label}
                            </MaterialPopover>
                        );

                        // - En mobile, la disponibilité est affichée sous le nom
                        //   (sa colonne dédiée est masquée) pour gagner de la place.
                        if (!isMobile || !isMaterialEditable(material)) {
                            return nameContent;
                        }

                        return (
                            <Fragment>
                                {nameContent}
                                <Availability
                                    material={material}
                                    class="MaterialsSelectorList__item__availability"
                                />
                            </Fragment>
                        );
                    },
                },
                !isMobile && {
                    key: 'availability',
                    class: [
                        'MaterialsSelectorList__col',
                        'MaterialsSelectorList__col--availability',
                    ],
                    render: (h: CreateElement, material: SourceMaterial) => (
                        isMaterialEditable(material)
                            ? (
                                <Availability
                                    material={material}
                                />
                            )
                            : null
                    ),
                },
                withBilling && {
                    key: 'price',
                    class: [
                        'MaterialsSelectorList__col',
                        'MaterialsSelectorList__col--price',
                    ],
                    render: (h: CreateElement, material: SourceMaterial) => {
                        if (!withBilling) {
                            return null;
                        }

                        const rentalPriceData = getRentalPriceData(material);
                        const isUnsynced = !withResync || rentalPriceData.override === null ? false : (
                            !rentalPriceData.override.currency.isSame(rentalPriceData.sync.currency) ||
                            !rentalPriceData.override.rentalPrice.equals(rentalPriceData.sync.rentalPrice)
                        );
                        const rentalPrice = isUnsynced ? rentalPriceData.override! : rentalPriceData.sync;

                        return (
                            <Fragment>
                                <span
                                    class={[
                                        'MaterialsSelectorList__item__price',
                                        {
                                            'MaterialsSelectorList__item__price--unsynced': (
                                                !material.is_deleted && isUnsynced
                                            ),
                                        },
                                    ]}
                                >
                                    <span class="MaterialsSelectorList__item__price__value">
                                        {formatAmount(rentalPrice.rentalPrice, rentalPrice.currency)}
                                    </span>
                                    {rentalPriceData.isPeriodPrice && (
                                        <Icon
                                            name="info-circle"
                                            class="MaterialsSelectorList__item__price__details"
                                            tooltip={((): string => {
                                                const _rentalPrice = rentalPrice as RentalPrice<true>;
                                                const formattedUnitPrice = formatAmount(_rentalPrice.unitPrice, _rentalPrice.currency);
                                                return `${formattedUnitPrice} x ${_rentalPrice.degressiveRate.toString()}`;
                                            })()}
                                        />
                                    )}
                                </span>
                                &nbsp;<Icon name="times" />
                            </Fragment>
                        );
                    },
                },
                {
                    key: 'quantity-input',
                    class: [
                        'MaterialsSelectorList__col',
                        'MaterialsSelectorList__col--quantity-input',
                    ],
                    render: (h: CreateElement, material: SourceMaterial) => (
                        isMaterialEditable(material)
                            ? (
                                <Quantity
                                    material={material}
                                    quantity={getQuantity(material)}
                                    onChange={setQuantity}
                                />
                            )
                            : getQuantity(material)
                    ),
                },
                withBilling && {
                    key: 'amount',
                    class: [
                        'MaterialsSelectorList__col',
                        'MaterialsSelectorList__col--amount',
                    ],
                    render: (h: CreateElement, material: SourceMaterial) => {
                        if (!withBilling) {
                            return null;
                        }

                        const quantity = getQuantity(material);
                        const rentalPriceData = getRentalPriceData(material);

                        const totalPriceSync = rentalPriceData.sync.rentalPrice
                            .times(quantity)
                            .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

                        let totalPriceOverride = null;
                        if (rentalPriceData.override !== null) {
                            totalPriceOverride = rentalPriceData.override.rentalPrice
                                .times(quantity)
                                .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
                        }

                        const isUnsynced = !withResync || totalPriceOverride === null ? false : (
                            !rentalPriceData.override!.currency.isSame(rentalPriceData.sync.currency) ||
                            !totalPriceOverride.equals(totalPriceSync)
                        );

                        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
                        const totalPrice = isUnsynced ? totalPriceOverride! : totalPriceSync;
                        const currency = isUnsynced
                            ? rentalPriceData.override!.currency
                            : rentalPriceData.sync.currency;

                        return (
                            <span
                                class={[
                                    'MaterialsSelectorList__item__total-price',
                                    {
                                        'MaterialsSelectorList__item__total-price--unsynced': (
                                            !material.is_deleted && isUnsynced
                                        ),
                                    },
                                ]}
                            >
                                {formatAmount(totalPrice, currency)}
                            </span>
                        );
                    },
                },
                {
                    key: 'actions',
                    class: [
                        'MaterialsSelectorList__col',
                        'MaterialsSelectorList__col--actions',
                    ],
                    render: (h: CreateElement, material: SourceMaterial) => {
                        const isSelected = getQuantity(material) > 0;
                        const isDeletable = isMaterialDeletable(material);
                        const isResyncable = withResync && isMaterialResyncable(material, withBilling);
                        if (!isMaterialEditable(material) || !isSelected) {
                            return null;
                        }

                        if (!isResyncable && !isDeletable) {
                            return null;
                        }

                        return (
                            <Dropdown>
                                {isResyncable && (
                                    <Button
                                        icon="sync-alt"
                                        onClick={() => { handleResyncMaterialData(material.id); }}
                                    >
                                        {__('actions.resync-material-data')}
                                    </Button>
                                )}
                                {isDeletable && (
                                    <Button
                                        type="delete"
                                        onClick={() => { setQuantity(material, 0); }}
                                    >
                                        {__('actions.remove-material')}
                                    </Button>
                                )}
                            </Dropdown>
                        );
                    },
                },
            ].filter(isTruthy);
        },
    },
    watch: {
        filters() {
            const $table = this.$refs.table as ClientTableRef;
            if ($table === undefined) {
                return;
            }
            $table.setPage(1);
        },
    },
    created() {
        this.cancelScreenSizeObserver = observeScreenSize(this.handleScreenSizeChange);
    },
    beforeDestroy() {
        if (this.cancelScreenSizeObserver) {
            this.cancelScreenSizeObserver();
            this.cancelScreenSizeObserver = undefined;
        }
    },
    methods: {
        // ------------------------------------------------------
        // -
        // -    Handlers
        // -
        // ------------------------------------------------------

        handleScreenSizeChange(size: ScreenSize) {
            this.isMobile = size === ScreenSize.MOBILE;
        },

        handleResyncMaterialData(materialId: SourceMaterial['id']) {
            if (!this.withResync) {
                return;
            }

            const material = this.materials.find(({ id }: SourceMaterial) => id === materialId);
            if (!material || !isMaterialResyncable(material, this.withBilling)) {
                return;
            }

            this.$emit('requestResyncMaterialData', material.id);
        },

        handleShowAllMaterials() {
            if (this.isEditOnly) {
                return;
            }
            this.$emit('requestShowAllMaterials');
        },

        // ------------------------------------------------------
        // -
        // -    API Publique
        // -
        // ------------------------------------------------------

        /**
         * Permet d'incrémenter (quantité +1) un matériel dans la liste.
         *
         * @param materialId - L'id du matériel à incrémenter.
         *
         * @returns `true` si le matériel a pu être incrémenté, `false` sinon.
         */
        incrementMaterial(materialId: SourceMaterial['id']): boolean {
            const material = this.materials.find(({ id }: SourceMaterial) => id === materialId);
            if (!material) {
                return false;
            }

            // - Si le matériel n'est pas déjà sélectionné et qu'on est en
            //   edit only ou qu'il est supprimé, on ne fait rien.
            const isAlreadySelected: boolean = store.getters.getQuantity(material.id) !== 0;
            if (!isAlreadySelected && (this.isEditOnly || material.is_deleted)) {
                return false;
            }

            store.commit('increment', { material });

            // - On place l'affichage sur le matériel qui vient d'être incrémenté.
            const $item = this.$refs[`items[${material.id}]`] as HTMLElement | undefined;
            $item?.scrollIntoView({ block: 'center' });

            return true;
        },

        // ------------------------------------------------------
        // -
        // -    Méthodes internes
        // -
        // ------------------------------------------------------

        getQuantity(material: SourceMaterial): number {
            return store.getters.getQuantity(material.id);
        },

        setQuantity(material: SourceMaterial, quantity: number) {
            store.commit('setQuantity', { material, quantity });
        },

        isMaterialEditable(material: SourceMaterial): boolean {
            // - Si le matériel n'est pas déjà sélectionné et qu'on est en
            //   edit only ou qu'il est supprimé, on empêche son edition.
            const isAlreadySelected: boolean = store.getters.getQuantity(material.id) !== 0;
            if (!isAlreadySelected && (this.isEditOnly || material.is_deleted)) {
                return false;
            }
            return true;
        },

        isMaterialDeletable(material: SourceMaterial): boolean {
            return this.isMaterialEditable(material);
        },

        __(key: string, params?: Record<string, number | string>, count?: number): string {
            key = !key.startsWith('global.')
                ? `components.MaterialsSelector.list.${key}`
                : key.replace(/^global\./, '');

            return this.$t(key, params, count);
        },
    },
    render() {
        const {
            __,
            filters,
            columns,
            isEditOnly,
            isMaterialsEmpty,
            isSelectionEmpty,
            isFilteredEmpty,
            filteredMaterials,
            handleShowAllMaterials,
        } = this;

        const isEmpty = (
            // - S'il n'y a pas de matériel à afficher.
            isMaterialsEmpty ||

            // - Ou, si on est en mode "Sélection uniquement" et qu'il n'y a pas de sélection.
            (isSelectionEmpty && filters.onlySelected) ||

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

            if (isSelectionEmpty && filters.onlySelected) {
                return (
                    <StateMessage
                        type={State.EMPTY}
                        size="small"
                        message={__('empty-state.no-selection')}
                        action={isEditOnly ? undefined : {
                            type: 'primary',
                            label: __('actions.show-all-materials-to-add-some'),
                            onClick: handleShowAllMaterials,
                        }}
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

        const classNames = ['MaterialsSelectorList', {
            'MaterialsSelectorList--empty': isEmpty,
        }];

        return (
            <div class={classNames}>
                {renderState()}
                <div class="MaterialsSelectorList__table">
                    <ClientTable
                        ref="table"
                        variant="light"
                        columns={columns}
                        defaultOrderBy="name"
                        data={filteredMaterials}
                        paginated={!filters.onlySelected}
                        rowClass="MaterialsSelectorList__item"
                        headless
                    />
                </div>
            </div>
        );
    },
});

export default MaterialsSelectorList;
