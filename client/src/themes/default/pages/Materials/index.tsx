import './index.scss';
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
import apiMaterials from '@/stores/api/materials';
import MaterialPopover from '@/themes/default/components/Popover/Material';
import Fragment from '@/components/Fragment';
import Dropdown from '@/themes/default/components/Dropdown';
import Page from '@/themes/default/components/Page';
import CriticalError from '@/themes/default/components/CriticalError';
import { ServerTable } from '@/themes/default/components/Table';
import Button from '@/themes/default/components/Button';
import Icon from '@/themes/default/components/Icon';
import TagsList from '@/themes/default/components/TagsList';
import { Group } from '@/stores/api/groups';
import { EmptyMessageVariant } from '@/themes/default/components/EmptyMessage';
import { ScreenSize, getScreenSize, observeScreenSize } from '@/utils/screenSize';
import Quantities from './components/Quantities';
import FiltersPanel, { FiltersSchema } from './components/Filters';
import { getFiltersFromRoute } from './_utils';
import {
    persistFilters,
    getPersistedFilters,
    clearPersistedFilters,
} from '@/utils/filtersPersister';

// - Modales
import AssignTags from '@/themes/default/modals/AssignTags';

import type { DebouncedMethod } from 'lodash';
import type { CreateElement, Raw } from 'vue';
import type { SerializedPeriod } from '@/utils/period';
import type { Filters } from './components/Filters';
import type { PaginationParams, SortableParams } from '@/stores/api/@types';
import type { Columns, ServerTableRef } from '@/themes/default/components/Table/Server';
import type { MaterialWithAvailability as Material } from '@/stores/api/materials';
import type { Session } from '@/stores/api/session';
import type { Tag } from '@/stores/api/tags';
import type { EmptyMessage } from '@/themes/default/components/Table/@types';

type InstanceProperties = {
    nowTimer: ReturnType<typeof setInterval> | undefined,
    cancelScreenSizeObserver: (() => void) | undefined,
    refreshTableDebounced: (
        | DebouncedMethod<typeof Materials, 'refreshTable'>
        | undefined
    ),
};

type Data = {
    filters: Filters,
    appliedFilters: Filters,
    isMobile: boolean,
    isLoading: boolean,
    isFetched: boolean,
    isEmpty: boolean,
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
        nowTimer: undefined,
        refreshTableDebounced: undefined,
        cancelScreenSizeObserver: undefined,
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
        let quantitiesPeriodRaw: Raw<Period> | null = null;

        // - Filtres sauvegardés.
        const session = this.$store.state.auth.user as Session;
        if (!session.disable_search_persistence) {
            if (urlFilters === undefined) {
                const savedFilters = getPersistedFilters(FILTERS_PERSISTENCE_KEY, FiltersSchema);
                if (savedFilters !== null) {
                    const { quantitiesPeriod: savedQuantitiesPeriodRaw, ...savedFilterFields } = savedFilters;
                    Object.assign(filters, savedFilterFields);

                    if (savedQuantitiesPeriodRaw !== undefined) {
                        const savedQuantitiesPeriod = Period.tryFrom(savedQuantitiesPeriodRaw);
                        if (savedQuantitiesPeriod !== null) {
                            quantitiesPeriodRaw = markRaw(savedQuantitiesPeriod);
                        }
                    }
                }
            }

            // NOTE: Le local storage est mis à jour via un `watch` de `filters`.
        } else {
            clearPersistedFilters(FILTERS_PERSISTENCE_KEY);
        }

        return {
            filters,
            appliedFilters: { ...filters },
            isMobile: getScreenSize() === ScreenSize.MOBILE,
            isLoading: false,
            isFetched: false,
            isEmpty: false,
            hasCriticalError: false,
            isTrashDisplayed: false,
            shouldDisplayTrashed: false,
            quantitiesPeriodRaw,
            now: markRaw(DateTime.now()),
        };
    },
    computed: {
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

        hasActiveFilters(): boolean {
            const { appliedFilters } = this;
            return (
                appliedFilters.search.length > 0 ||
                appliedFilters.park !== null ||
                appliedFilters.category !== null ||
                appliedFilters.subCategory !== null ||
                appliedFilters.tags.length > 0
            );
        },

        hasContent(): boolean {
            if (this.isTrashDisplayed) {
                return true;
            }

            return (
                this.isFetched &&
                (!this.isEmpty || this.hasActiveFilters)
            );
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
                    defaultHidden: true,
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
                            <span class="Materials__item__name">
                                <span class="Materials__item__name__name">
                                    {material.name}
                                </span>
                                <span class="Materials__item__name__reference">
                                    {__('ref-ref', { reference: material.reference })}
                                </span>
                            </span>
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
            this.refreshTable(true);
        },

        filters: {
            handler(_: Filters, prevFilters: Filters | undefined) {
                if (prevFilters !== undefined) {
                    this.refreshTableDebounced!();
                }
                this.persistState();
            },
            deep: true,
            immediate: true,
        },

        quantitiesPeriodRaw() {
            this.persistState();
        },
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

        // - Suit la taille du viewport pour adapter l'affichage.
        this.cancelScreenSizeObserver = observeScreenSize(this.handleScreenSizeChange);

        // - On redirige vers l'url canonique si on avait des filtres dans l'URL.
        if (Object.keys(this.$route?.query ?? {}).length > 0) {
            this.$router.replace({ query: {} });
        }
    },
    beforeDestroy() {
        this.refreshTableDebounced?.cancel();

        if (this.nowTimer) {
            clearInterval(this.nowTimer);
        }

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

                this.$modal.show(AssignTags, {
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

            const $table = this.$refs.table as ServerTableRef;
            $table?.showColumnsSelector();
        },

        // ------------------------------------------------------
        // -
        // -    Méthodes internes
        // -
        // ------------------------------------------------------

        async fetch(pagination: PaginationParams & SortableParams) {
            this.isLoading = true;

            const { quantitiesPeriod, filters: rawFilters } = this;
            this.appliedFilters = { ...rawFilters };

            const filters = { ...rawFilters, quantitiesPeriod };

            try {
                const data = await apiMaterials.all({
                    paginated: true,
                    ...pagination,
                    ...filters,
                    onlyDeleted: this.shouldDisplayTrashed,
                });

                this.isFetched = true;
                this.isTrashDisplayed = this.shouldDisplayTrashed;
                this.isEmpty = data.pagination.total.items <= 0;
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

        refreshTable(pageOnly: boolean = false) {
            this.refreshTableDebounced?.cancel();

            (this.$refs.table as ServerTableRef)?.refresh(pageOnly);
        },

        persistState() {
            const session = this.$store.state.auth.user as Session;
            if (session.disable_search_persistence) {
                return;
            }

            const persistedQuantitiesPeriod: SerializedPeriod | undefined = (
                this.quantitiesPeriodRaw !== null
                    ? this.quantitiesPeriodRaw.toSerialized()
                    : undefined
            );

            persistFilters(FILTERS_PERSISTENCE_KEY, {
                ...this.filters,
                quantitiesPeriod: persistedQuantitiesPeriod,
            });
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
            hasContent,
            isMobile,
            isLoading,
            filters,
            columns,
            isTrashDisplayed,
            quantitiesPeriod,
            hasActiveFilters,
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
                            columns={columns}
                            fetcher={fetch}
                        />
                    </div>
                </Page>
            );
        }

        const actions = [
            <Button type="primary" to={{ name: 'add-material' }} icon="plus" collapsible>
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
                        {(isAdmin && hasContent) && (
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
                {(hasContent && !isMobile) && (
                    <Button icon="table" onClick={handleConfigureColumns}>
                        {__('configure-columns')}
                    </Button>
                )}
                <Button icon="trash" onClick={handleToggleShowTrashed}>
                    {__('open-trash-bin')}
                </Button>
            </Dropdown>,
        ].filter(isTruthy);

        // - Message à afficher lorsque le tableau est vide.
        const emptyMessage: EmptyMessage = (
            hasActiveFilters
                ? { variant: EmptyMessageVariant.NO_RESULTS }
                : {
                    text: __('page.materials.empty'),
                    action: {
                        type: 'primary',
                        icon: 'plus',
                        label: __('page.materials.action-add'),
                        target: { name: 'add-material' },
                    },
                }
        );

        return (
            <Page
                name="materials"
                title={title}
                actions={actions}
                loading={isLoading}
                scopedSlots={{
                    headerContent: (): JSX.Node => {
                        if (!hasContent) {
                            return null;
                        }
                        return (
                            <FiltersPanel
                                values={filters}
                                quantitiesPeriodValue={quantitiesPeriod}
                                onSubmit={handleFiltersSubmit}
                                onFiltersChange={handleFiltersChange}
                                onQuantitiesPeriodChange={handleQuantitiesPeriodChange}
                            />
                        );
                    },
                }}
            >
                <div class="Materials">
                    <ServerTable
                        ref="table"
                        key="default"
                        name={$options.name}
                        columns={columns}
                        fetcher={fetch}
                        emptyMessage={emptyMessage}
                        onRowClick={handleRowClick}
                        sticky
                    />
                </div>
            </Page>
        );
    },
});

export default Materials;
