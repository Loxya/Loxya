import './index.scss';
import pick from 'lodash/pick';
import Period from '@/utils/period';
import isEqual from 'lodash/isEqual';
import throttle from 'lodash/throttle';
import DateTime from '@/utils/datetime';
import { HttpCode, RequestError } from '@/globals/requester';
import mergeDifference from '@/utils/mergeDifference';
import { defineComponent, markRaw } from 'vue';
import config, { BillingMode } from '@/globals/config';
import { DEBOUNCE_WAIT_DURATION } from '@/globals/constants';
import { confirm } from '@/utils/alert';
import isTruthy from '@/utils/isTruthy';
import formatAmount from '@/utils/formatAmount';
import showModal from '@/utils/showModal';
import apiMaterials from '@/stores/api/materials';
import MaterialPopover from '@/themes/default/components/Popover/Material';
import Fragment from '@/components/Fragment';
import Dropdown from '@/themes/default/components/Dropdown';
import Page from '@/themes/default/components/Page';
import CriticalError from '@/themes/default/components/CriticalError';
import { ServerTable, getLegacySavedSearch } from '@/themes/default/components/Table';
import Button from '@/themes/default/components/Button';
import Icon from '@/themes/default/components/Icon';
import TagsList from '@/themes/default/components/TagsList';
import { Group } from '@/stores/api/groups';
import Quantities from './components/Quantities';
import FiltersPanel, { FiltersSchema } from './components/Filters';
import {
    convertFiltersToRouteQuery,
    getFiltersFromRoute,
} from './_utils';
import {
    persistFilters,
    getPersistedFilters,
    clearPersistedFilters,
} from '@/utils/filtersPersister';

// - Modales
import AssignTags from '@/themes/default/modals/AssignTags';

import type { DebouncedMethod } from 'lodash';
import type { Filters } from './components/Filters';
import type { ComponentRef, CreateElement, Raw } from 'vue';
import type { PaginationParams, SortableParams } from '@/stores/api/@types';
import type { Columns } from '@/themes/default/components/Table/Server';
import type { MaterialWithAvailability as Material } from '@/stores/api/materials';
import type { Session } from '@/stores/api/session';
import type { Tag } from '@/stores/api/tags';

type InstanceProperties = {
    nowTimer: ReturnType<typeof setInterval> | undefined,
    refreshTableDebounced: (
        | DebouncedMethod<typeof Materials, 'refreshTable'>
        | undefined
    ),
};

type Data = {
    filters: Filters,
    isLoading: boolean,
    hasMaterial: boolean,
    hasCriticalError: boolean,
    shouldDisplayTrashed: boolean,
    isTrashDisplayed: boolean,
    quantitiesPeriodRaw: Raw<Period> | null,
    now: Raw<DateTime>,
};

/** La clé utilisé pour la persistence des filtres de la page. */
const FILTERS_PERSISTENCE_KEY = 'Materials--filters';

/** Page de listing du matériel. */
const Materials = defineComponent({
    name: 'Materials',
    setup: (): InstanceProperties => ({
        refreshTableDebounced: undefined,
        nowTimer: undefined,
    }),
    data(): Data {
        const urlFilters = getFiltersFromRoute(this.$route);

        const filters: Filters = {
            search: [],
            park: null,
            category: null,
            subCategory: null,
            tags: [],
            ...urlFilters,
        };

        // - Filtres sauvegardés.
        const session = this.$store.state.auth.user as Session;
        if (!session.disable_search_persistence) {
            if (urlFilters === undefined) {
                const savedFilters = getPersistedFilters(FILTERS_PERSISTENCE_KEY, FiltersSchema);
                if (savedFilters !== null) {
                    Object.assign(filters, savedFilters);
                } else {
                    // - Ancienne sauvegarde éventuelle, dans le component `<Table />`.
                    const savedSearchLegacy = this.$options.name
                        ? getLegacySavedSearch(this.$options.name)
                        : null;

                    if (savedSearchLegacy !== null) {
                        Object.assign(filters, { search: [savedSearchLegacy] });
                    }
                }
            }

            // NOTE: Le local storage est mis à jour via un `watch` de `filters`.
        } else {
            clearPersistedFilters(FILTERS_PERSISTENCE_KEY);
        }

        return {
            isLoading: false,
            hasCriticalError: false,
            hasMaterial: false,
            isTrashDisplayed: false,
            shouldDisplayTrashed: false,
            quantitiesPeriodRaw: null,
            now: markRaw(DateTime.now()),
            filters,
        };
    },
    computed: {
        shouldPersistSearch(): boolean {
            const session = this.$store.state.auth.user as Session;
            return !session.disable_search_persistence;
        },

        title(): string {
            const { $t: __, isTrashDisplayed } = this;

            return isTrashDisplayed
                ? __('page.materials.title-trash')
                : __('page.materials.title');
        },

        isAdmin(): boolean {
            return this.$store.getters['auth/is'](Group.ADMINISTRATION);
        },

        isSupervisor(): boolean {
            return this.$store.getters['auth/is'](Group.SUPERVISION);
        },

        quantitiesPeriod(): Period {
            if (this.quantitiesPeriodRaw === null) {
                const currentHour = this.now.startOfHour();
                return new Period(currentHour, currentHour.addHour());
            }
            return this.quantitiesPeriodRaw;
        },

        columns(): Columns<Material> {
            const isBillingEnabled = config.billingMode !== BillingMode.NONE;
            const {
                $t: __,
                $store: store,
                handleSetTags,
                isTrashDisplayed,
                handleRestoreItemClick,
                handleDeleteItemClick,
            } = this;

            return [
                {
                    key: 'reference',
                    title: __('reference'),
                    class: 'Materials__cell Materials__cell--ref',
                    sortable: true,
                    render: (h: CreateElement, material: Material) => (
                        <MaterialPopover material={material}>
                            {material.reference}
                        </MaterialPopover>
                    ),
                },
                {
                    key: 'name',
                    title: __('name'),
                    class: 'Materials__cell Materials__cell--name',
                    sortable: true,
                    render: (h: CreateElement, material: Material) => (
                        <MaterialPopover material={material}>
                            {material.name}
                        </MaterialPopover>
                    ),
                },
                {
                    key: 'description',
                    title: __('description'),
                    class: 'Materials__cell Materials__cell--description',
                    sortable: true,
                    defaultHidden: true,
                    render: (h: CreateElement, { description }: Material) => (
                        (description ?? '').length > 0 ? description : (
                            <span class="Materials__cell__empty">
                                {__('not-specified')}
                            </span>
                        )
                    ),
                },
                !isTrashDisplayed && {
                    key: 'park',
                    title: __('park'),
                    class: 'Materials__cell Materials__cell--park',
                    defaultHidden: true,
                    render(h: CreateElement, { park_id: parkId }: Material) {
                        const parkName = store.getters['parks/getName'](parkId);
                        return parkName ?? '--';
                    },
                },
                !isTrashDisplayed && {
                    key: 'category',
                    title: __('category'),
                    class: 'Materials__cell Materials__cell--category',
                    render(h: CreateElement, { category_id: categoryId, sub_category_id: subCategoryId }: Material) {
                        const categoryName = store.getters['categories/categoryName'](categoryId);
                        if (!categoryName) {
                            return (
                                <span class="Materials__cell__empty">
                                    {__('not-categorized')}
                                </span>
                            );
                        }

                        const subCategoryName = subCategoryId
                            ? store.getters['categories/subCategoryName'](subCategoryId)
                            : null;

                        return (
                            <Fragment>
                                <Icon name="folder-open" />&nbsp;{categoryName}
                                {!!subCategoryName && (
                                    <div class="Materials__sub-category">
                                        <Icon name="arrow-right" />&nbsp;{subCategoryName}
                                    </div>
                                )}
                            </Fragment>
                        );
                    },
                },
                !!(!isTrashDisplayed && isBillingEnabled) && {
                    key: 'rental_price',
                    title: __('rent-price'),
                    class: 'Materials__cell Materials__cell--rental-price',
                    sortable: true,
                    render: (h: CreateElement, material: Material) => (
                        formatAmount(material.rental_price ?? 0)
                    ),
                },
                !isTrashDisplayed && {
                    key: 'replacement_price',
                    title: __('repl-price'),
                    class: 'Materials__cell Materials__cell--replacement-price',
                    sortable: true,
                    defaultHidden: true,
                    render: (h: CreateElement, { replacement_price: replacementPrice }: Material) => (
                        replacementPrice !== null
                            ? formatAmount(replacementPrice)
                            : (
                                <span class="Materials__cell__empty">
                                    {__('not-specified')}
                                </span>
                            )
                    ),
                },
                !isTrashDisplayed && {
                    key: 'stock_quantity',
                    title: __('page.materials.available-qty-total-qty'),
                    class: 'Materials__cell Materials__cell--quantity',
                    sortable: true,
                    render: (h: CreateElement, material: Material) => (
                        <Quantities
                            material={material}
                        />
                    ),
                },
                !isTrashDisplayed && {
                    key: 'out_of_order_quantity',
                    title: __('out-of-order-qty'),
                    class: 'Materials__cell Materials__cell--quantity-broken',
                    sortable: true,
                    defaultHidden: true,
                    render(h: CreateElement, material: Material) {
                        const quantityBroken = material.out_of_order_quantity;
                        const className = ['Materials__quantity-broken', {
                            'Materials__quantity-broken--exists': quantityBroken > 0,
                        }];

                        return (
                            <span class={className}>
                                {quantityBroken}
                            </span>
                        );
                    },
                },
                !isTrashDisplayed && {
                    key: 'tags',
                    title: __('tags'),
                    class: 'Materials__cell Materials__cell--tags',
                    render: (h: CreateElement, material: Material) => (
                        <div
                            class="Materials__tags-list"
                            role="button"
                            onClick={handleSetTags(material)}
                        >
                            <TagsList tags={material.tags} />
                            {(material.tags.length === 0 && !isTrashDisplayed) && (
                                <span class="Materials__add-tags">
                                    {__('add-tags')}
                                </span>
                            )}
                        </div>
                    ),
                },
                {
                    key: 'actions',
                    class: 'Materials__cell Materials__cell--actions',
                    render(h: CreateElement, { id }: Material) {
                        if (isTrashDisplayed) {
                            return (
                                <Fragment>
                                    <Button
                                        type="restore"
                                        onClick={(e: MouseEvent) => {
                                            handleRestoreItemClick(e, id);
                                        }}
                                    />
                                    <Button
                                        type="delete"
                                        onClick={(e: MouseEvent) => {
                                            handleDeleteItemClick(e, id);
                                        }}
                                    />
                                </Fragment>
                            );
                        }

                        return (
                            <Fragment>
                                <Button
                                    icon="eye"
                                    to={{
                                        name: 'view-material',
                                        params: { id: id.toString() },
                                    }}
                                />
                                <Dropdown>
                                    <Button
                                        type="edit"
                                        to={{
                                            name: 'edit-material',
                                            params: { id: id.toString() },
                                        }}
                                    >
                                        {__('action-edit')}
                                    </Button>
                                    <Button
                                        type="trash"
                                        onClick={(e: MouseEvent) => {
                                            handleDeleteItemClick(e, id);
                                        }}
                                    >
                                        {__('action-delete')}
                                    </Button>
                                </Dropdown>
                            </Fragment>
                        );
                    },
                },
            ].filter(isTruthy);
        },
    },
    watch: {
        quantitiesPeriod() {
            this.refreshTable();
        },

        filters: {
            handler(newFilters: Filters, prevFilters: Filters | undefined) {
                if (prevFilters !== undefined) {
                    this.refreshTableDebounced!();
                }

                // - Persistance dans le local storage.
                if (this.shouldPersistSearch) {
                    persistFilters(FILTERS_PERSISTENCE_KEY, newFilters);
                }

                // - Mise à jour de l'URL.
                const prevRouteQuery = this.$route?.query ?? {};
                const newRouteQuery = convertFiltersToRouteQuery(newFilters);
                if (!isEqual(prevRouteQuery, newRouteQuery)) {
                    this.$router.replace({ query: newRouteQuery });
                }
            },
            deep: true,
            immediate: true,
        },

        // $route(newRoute: Route) {
        //     // TODO: Si les filtres récupérés depuis l'url sont différents de ceux dans le state
        //     //       => On reset les filtres en fonction des nouveaux (ou du local storage si vide) => Comme au boot normal.
        // },
    },
    created() {
        this.$store.dispatch('parks/fetch');
        this.$store.dispatch('categories/fetch');

        // - Binding.
        this.fetch = this.fetch.bind(this);

        // - Debounce.
        this.refreshTableDebounced = throttle(
            this.refreshTable.bind(this),
            DEBOUNCE_WAIT_DURATION.asMilliseconds(),
            { leading: false },
        );
    },
    mounted() {
        // - Actualise le timestamp courant toutes les minutes.
        this.nowTimer = setInterval(() => { this.now = markRaw(DateTime.now()); }, 60_000);
    },
    beforeDestroy() {
        this.refreshTableDebounced?.cancel();

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

        handleFiltersChange(newFilters: Filters) {
            // - Recherche textuelle.
            const newSearch = mergeDifference(this.filters.search, newFilters.search);
            if (!isEqual(this.filters.search, newSearch)) {
                this.filters.search = newSearch;
            }

            // - Parc.
            if (this.filters.park !== newFilters.park) {
                this.filters.park = newFilters.park;
            }

            // - Catégorie.
            if (this.filters.category !== newFilters.category) {
                this.filters.category = newFilters.category;
            }

            // - Sous-catégorie.
            if (newFilters.category !== null) {
                if (this.filters.subCategory !== newFilters.subCategory) {
                    this.filters.subCategory = newFilters.subCategory;
                }
            } else if (this.filters.subCategory !== null) {
                this.filters.subCategory = null;
            }

            // - Tags
            const newTags = mergeDifference(this.filters.tags, newFilters.tags);
            if (!isEqual(this.filters.tags, newTags)) {
                this.filters.tags = newTags;
            }
        },

        handleQuantitiesPeriodChange(newPeriod: Raw<Period>) {
            this.quantitiesPeriodRaw = newPeriod;

            // Note: Pas de refresh car sera refresh par le watch automatiquement.
        },

        handleFiltersSubmit() {
            this.refreshTable();
        },

        async handleDeleteItemClick(e: MouseEvent, id: Material['id']) {
            e.stopPropagation();

            const { $t: __ } = this;
            const isSoft = !this.isTrashDisplayed;

            const isConfirmed = await confirm({
                type: 'danger',
                text: isSoft
                    ? __('page.materials.confirm-delete')
                    : __('page.materials.confirm-permanently-delete'),
                confirmButtonText: isSoft
                    ? __('yes-trash')
                    : __('yes-permanently-delete'),
            });
            if (!isConfirmed) {
                return;
            }

            this.isLoading = true;
            try {
                await apiMaterials.remove(id);

                this.$toasted.success(__('page.materials.deleted'));
                this.refreshTable();
            } catch {
                this.$toasted.error(__('errors.unexpected-while-deleting'));
            } finally {
                this.isLoading = false;
            }
        },

        async handleRestoreItemClick(e: MouseEvent, id: Material['id']) {
            e.stopPropagation();
            const { $t: __ } = this;

            const isConfirmed = await confirm({
                text: __('page.materials.confirm-restore'),
                confirmButtonText: __('yes-restore'),
            });
            if (!isConfirmed) {
                return;
            }

            this.isLoading = true;
            try {
                await apiMaterials.restore(id);

                this.$toasted.success(__('page.materials.restored'));
                this.refreshTable();
            } catch {
                this.$toasted.error(__('errors.unexpected-while-restoring'));
            } finally {
                this.isLoading = false;
            }
        },

        handleSetTags({ id, name, tags }: Material) {
            return (e: MouseEvent) => {
                e.stopPropagation();

                if (this.isTrashDisplayed) {
                    return;
                }

                showModal(this.$modal, AssignTags, {
                    name,
                    defaultTags: tags,
                    persister: (newTags: Array<Tag['id']>) => (
                        apiMaterials.update(id, { tags: newTags })
                    ),
                    onClose: () => {
                        this.refreshTable();
                    },
                });
            };
        },

        handleRowClick({ id }: Material) {
            this.$router.push({
                name: 'view-material',
                params: { id: id.toString() },
            });
        },

        handleToggleShowTrashed() {
            this.shouldDisplayTrashed = !this.shouldDisplayTrashed;
            this.refreshTable();
        },

        handleConfigureColumns() {
            if (this.isTrashDisplayed) {
                return;
            }

            const $table = this.$refs.table as ComponentRef<typeof ServerTable>;
            $table?.showColumnsSelector();
        },

        // ------------------------------------------------------
        // -
        // -    Méthodes internes
        // -
        // ------------------------------------------------------

        async fetch(pagination: PaginationParams & SortableParams) {
            pagination = pick(pagination, ['page', 'limit', 'ascending', 'orderBy']);
            this.isLoading = true;

            const { quantitiesPeriod, filters: rawFilters } = this;
            const filters = { ...rawFilters, quantitiesPeriod };

            try {
                const data = await apiMaterials.all({
                    paginated: true,
                    ...pagination,
                    ...filters,
                    onlyDeleted: this.shouldDisplayTrashed,
                });
                this.isTrashDisplayed = this.shouldDisplayTrashed;
                this.hasMaterial = data.pagination.total.items > 0;
                return data;
            } catch (error) {
                if (error instanceof RequestError && error.httpCode === HttpCode.RangeNotSatisfiable) {
                    this.refreshTable();
                    return undefined;
                }

                // eslint-disable-next-line no-console
                console.error(`Error occurred while retrieving materials:`, error);
                this.hasCriticalError = true;
            } finally {
                this.isLoading = false;
            }

            return undefined;
        },

        refreshTable() {
            this.refreshTableDebounced?.cancel();

            (this.$refs.table as ComponentRef<typeof ServerTable>)?.refresh();
        },
    },
    render() {
        const {
            $t: __,
            fetch,
            title,
            $options,
            hasCriticalError,
            isAdmin,
            isSupervisor,
            hasMaterial,
            isLoading,
            filters,
            columns,
            isTrashDisplayed,
            quantitiesPeriod,
            handleFiltersChange,
            handleQuantitiesPeriodChange,
            handleFiltersSubmit,
            handleConfigureColumns,
            handleToggleShowTrashed,
            handleRowClick,
        } = this;

        if (hasCriticalError) {
            return (
                <Page name="materials" title={__('page.materials.title')} centered>
                    <CriticalError />
                </Page>
            );
        }

        if (isTrashDisplayed) {
            return (
                <Page
                    name="materials"
                    title={title}
                    loading={isLoading}
                    actions={[
                        <Button onClick={handleToggleShowTrashed} icon="eye" type="primary">
                            {__('display-not-deleted-items')}
                        </Button>,
                    ]}
                >
                    <div class="Materials Materials--trashed">
                        <ServerTable
                            ref="table"
                            key="trash"
                            rowClass="Materials__row"
                            columns={columns}
                            fetcher={fetch}
                        />
                    </div>
                </Page>
            );
        }

        const actions = [
            <Button type="add" to={{ name: 'add-material' }} icon="plus" collapsible>
                {__('page.materials.action-add')}
            </Button>,
            <Dropdown>
                {(isAdmin || isSupervisor) && (
                    <Fragment>
                        <Button
                            icon="cog"
                            to={{ name: 'properties' }}
                        >
                            {__('page.materials.manage-properties')}
                        </Button>
                        {(isAdmin && hasMaterial) && (
                            <Fragment>
                                <Button
                                    icon="print"
                                    to={`${config.baseUrl}/materials/print`}
                                    download
                                >
                                    {__('page.materials.print-complete-list')}
                                </Button>
                            </Fragment>
                        )}
                    </Fragment>
                )}
                <Button icon="table" onClick={handleConfigureColumns}>
                    {__('configure-columns')}
                </Button>
                <Button icon="trash" onClick={handleToggleShowTrashed}>
                    {__('open-trash-bin')}
                </Button>
            </Dropdown>,
        ].filter(isTruthy);

        return (
            <Page
                name="materials"
                title={title}
                actions={actions}
                loading={isLoading}
                scopedSlots={{
                    headerContent: (): JSX.Node => (
                        <FiltersPanel
                            values={filters}
                            quantitiesPeriodValue={quantitiesPeriod}
                            onSubmit={handleFiltersSubmit}
                            onFiltersChange={handleFiltersChange}
                            onQuantitiesPeriodChange={handleQuantitiesPeriodChange}
                        />
                    ),
                }}
            >
                <div class="Materials">
                    <ServerTable
                        ref="table"
                        key="default"
                        name={$options.name}
                        rowClass="Materials__row"
                        columns={columns}
                        fetcher={fetch}
                        onRowClick={handleRowClick}
                    />
                </div>
            </Page>
        );
    },
});

export default Materials;
