import './index.scss';
import isEqual from 'lodash/isEqual';
import throttle from 'lodash/throttle';
import { HttpCode, RequestError } from '@/globals/requester';
import isTruthy from '@/utils/isTruthy';
import apiParks from '@/stores/api/parks';
import config from '@/globals/config';
import { confirm } from '@/utils/alert';
import mergeDifference from '@/utils/mergeDifference';
import { defineComponent } from 'vue';
import { DEBOUNCE_WAIT_DURATION } from '@/globals/constants';
import Page from '@/themes/default/components/Page';
import Fragment from '@/components/Fragment';
import CriticalError from '@/themes/default/components/CriticalError';
import Dropdown from '@/themes/default/components/Dropdown';
import Button from '@/themes/default/components/Button';
import Link from '@/themes/default/components/Link';
import ItemsCount from './components/ItemsCount';
import TotalAmount from './components/TotalAmount';
import FiltersPanel, { FiltersSchema } from './components/Filters';
import { ServerTable } from '@/themes/default/components/Table';
import { EmptyMessageVariant } from '@/themes/default/components/EmptyMessage';
import {
    persistFilters,
    getPersistedFilters,
    clearPersistedFilters,
} from '@/utils/filtersPersister';

import type { CreateElement } from 'vue';
import type { DebouncedMethod } from 'lodash';
import type { Filters } from './components/Filters';
import type { Park } from '@/stores/api/parks';
import type { Session } from '@/stores/api/session';
import type { Column, ServerTableRef } from '@/themes/default/components/Table/Server';
import type { PaginationParams, SortableParams } from '@/stores/api/@types';
import type { EmptyMessage } from '@/themes/default/components/Table/@types';

type Data = {
    filters: Filters,
    appliedFilters: Filters,
    isLoading: boolean,
    isFetched: boolean,
    isEmpty: boolean,
    hasCriticalError: boolean,
    shouldDisplayTrashed: boolean,
    isTrashDisplayed: boolean,
};

type InstanceProperties = {
    refreshTableDebounced: (
        | DebouncedMethod<typeof Parks, 'refreshTable'>
        | undefined
    ),
};

/** La clé utilisé pour la persistence des filtres de la page. */
const FILTERS_PERSISTENCE_KEY = 'Parks--filters';

/** Page de listing des parcs de matériel. */
const Parks = defineComponent({
    name: 'Parks',
    setup: (): InstanceProperties => ({
        refreshTableDebounced: undefined,
    }),
    data(): Data {
        const filters: Filters = {
            search: [],
        };

        // - Filtres sauvegardés.
        const session = this.$store.state.auth.user as Session;
        if (!session.disable_search_persistence) {
            const savedFilters = getPersistedFilters(FILTERS_PERSISTENCE_KEY, FiltersSchema);
            if (savedFilters !== null) {
                Object.assign(filters, savedFilters);
            }
        } else {
            clearPersistedFilters(FILTERS_PERSISTENCE_KEY);
        }

        return {
            filters,
            appliedFilters: { ...filters },
            isLoading: false,
            isFetched: false,
            isEmpty: false,
            hasCriticalError: false,
            shouldDisplayTrashed: false,
            isTrashDisplayed: false,
        };
    },
    computed: {
        shouldPersistSearch(): boolean {
            const session = this.$store.state.auth.user as Session;
            return !session.disable_search_persistence;
        },

        hasActiveFilters(): boolean {
            return this.appliedFilters.search.length > 0;
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

        columns(): Array<Column<Park>> {
            const {
                $t: __,
                isTrashDisplayed,
                handleDeleteItemClick,
                handleRestoreItemClick,
            } = this;

            return [
                {
                    key: 'name',
                    title: __('name'),
                    class: 'Parks__cell Parks__cell--name',
                    sortable: true,
                },
                !isTrashDisplayed && {
                    key: 'address',
                    title: __('address'),
                    class: 'Parks__cell Parks__cell--address',
                    render: (h: CreateElement, park: Park) => {
                        if (park.address === null) {
                            return (
                                <div class="Parks__cell__empty">
                                    {__('not-specified')}
                                </div>
                            );
                        }

                        let { address } = park;
                        if (!park.country.isSame(config.mainCountry)) {
                            address += `\n${park.country.name}`;
                        }

                        return address;
                    },
                },
                !isTrashDisplayed && {
                    key: 'opening_hours',
                    title: __('opening-hours'),
                    class: 'Parks__cell Parks__cell--opening-hours',
                    render: (h: CreateElement, { opening_hours: openingHours }: Park) => (
                        openingHours ?? (
                            <span class="Parks__cell__empty">
                                {__('not-specified')}
                            </span>
                        )
                    ),
                },
                !isTrashDisplayed && {
                    key: 'totalItems',
                    title: __('page.parks.total-items'),
                    class: 'Parks__cell Parks__cell--total-items',
                    render: (h: CreateElement, park: Park) => (
                        <ItemsCount park={park} />
                    ),
                },
                !isTrashDisplayed && {
                    key: 'note',
                    title: __('notes'),
                    class: 'Parks__cell Parks__cell--note',
                    defaultHidden: true,
                },
                !isTrashDisplayed && {
                    key: 'totalAmount',
                    title: __('total-value'),
                    class: 'Parks__cell Parks__cell--total-amount',
                    render: (h: CreateElement, park: Park) => (
                        <TotalAmount park={park} />
                    ),
                },
                (!isTrashDisplayed) && {
                    key: 'events',
                    title: __('events'),
                    class: 'Parks__cell Parks__cell--events',
                    render: (h: CreateElement, { id, total_items: itemsCount }: Park) => {
                        if (itemsCount === 0) {
                            return null;
                        }

                        return (
                            <Link
                                to={{
                                    name: 'schedule',
                                    query: { park: id.toString() },
                                }}
                            >
                                {__('page.parks.display-events-for-park')}
                            </Link>
                        );
                    },
                },
                {
                    key: 'actions',
                    class: 'Parks__cell Parks__cell--actions',
                    render(h: CreateElement, { id, total_items: itemsCount }: Park) {
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

                        const hasItems = itemsCount > 0;
                        return (
                            <Fragment>
                                <Dropdown>
                                    <Button
                                        type="edit"
                                        to={{
                                            name: 'edit-park',
                                            params: { id: id.toString() },
                                        }}
                                    >
                                        {__('action-edit')}
                                    </Button>
                                    {hasItems && (
                                        <Fragment>
                                            <Button
                                                icon="clipboard-list"
                                                to={`${config.baseUrl}/materials/print?park=${id}`}
                                                download
                                            >
                                                {__('page.parks.print-materials-of-this-park')}
                                            </Button>
                                        </Fragment>
                                    )}
                                    <Button
                                        type="trash"
                                        onClick={(e: MouseEvent) => {
                                            handleDeleteItemClick(e, id);
                                        }}
                                        disabled={hasItems}
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
        filters: {
            handler() {
                this.refreshTableDebounced!();

                if (this.shouldPersistSearch) {
                    persistFilters(FILTERS_PERSISTENCE_KEY, this.filters);
                }
            },
            deep: true,
        },
    },
    created() {
        // - Binding.
        this.fetch = this.fetch.bind(this);

        // - Debounce.
        this.refreshTableDebounced = throttle(
            this.refreshTable.bind(this),
            DEBOUNCE_WAIT_DURATION.asMilliseconds(),
            { leading: false },
        );
    },
    beforeDestroy() {
        this.refreshTableDebounced?.cancel();
    },
    methods: {
        // ------------------------------------------------------
        // -
        // -    Handlers
        // -
        // ------------------------------------------------------

        async handleDeleteItemClick(e: MouseEvent, id: Park['id']) {
            e.preventDefault();

            const { $t: __ } = this;
            const isSoft = !this.isTrashDisplayed;

            const isConfirmed = await confirm({
                type: 'danger',
                text: isSoft
                    ? __('page.parks.confirm-delete')
                    : __('page.parks.confirm-permanently-delete'),
                confirmButtonText: isSoft
                    ? __('yes-trash')
                    : __('yes-permanently-delete'),
            });
            if (!isConfirmed) {
                return;
            }

            this.isLoading = true;
            try {
                await apiParks.remove(id);
                this.refreshTable();

                this.$store.dispatch('parks/refresh');
            } catch {
                this.$toasted.error(__('errors.unexpected-while-deleting'));
            } finally {
                this.isLoading = false;
            }
        },

        async handleRestoreItemClick(e: MouseEvent, id: Park['id']) {
            e.preventDefault();
            const { $t: __ } = this;

            const isConfirmed = await confirm({
                text: __('page.parks.confirm-restore'),
                confirmButtonText: __('yes-restore'),
            });
            if (!isConfirmed) {
                return;
            }

            this.isLoading = true;
            try {
                await apiParks.restore(id);
                this.refreshTable();

                this.$store.dispatch('parks/refresh');
            } catch {
                this.$toasted.error(__('errors.unexpected-while-restoring'));
            } finally {
                this.isLoading = false;
            }
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

        handleFiltersChange(newFilters: Filters) {
            // - Recherche textuelle.
            const newSearch = mergeDifference(this.filters.search, newFilters.search);
            if (!isEqual(this.filters.search, newSearch)) {
                this.filters.search = newSearch;
            }
        },

        handleFiltersSubmit() {
            this.refreshTable();
        },

        // ------------------------------------------------------
        // -
        // -    Méthodes internes
        // -
        // ------------------------------------------------------

        async fetch(pagination: PaginationParams & SortableParams) {
            this.isLoading = true;

            const filters: Filters = { ...this.filters };
            this.appliedFilters = filters;

            try {
                const data = await apiParks.all({
                    ...pagination,
                    ...filters,
                    deleted: this.shouldDisplayTrashed,
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
                console.error(`Error occurred while retrieving parks:`, error);
            } finally {
                this.isLoading = false;
            }

            return undefined;
        },

        refreshTable() {
            this.refreshTableDebounced?.cancel();

            (this.$refs.table as ServerTableRef)?.refresh();
        },
    },
    render() {
        const {
            $t: __,
            fetch,
            $options,
            filters,
            columns,
            isLoading,
            hasContent,
            isTrashDisplayed,
            hasActiveFilters,
            hasCriticalError,
            handleConfigureColumns,
            handleToggleShowTrashed,
            handleFiltersChange,
            handleFiltersSubmit,
        } = this;

        if (hasCriticalError) {
            return (
                <Page name="parks" title={__('page.parks.title')} centered>
                    <CriticalError />
                </Page>
            );
        }

        // - Titre de la page.
        const title = !isTrashDisplayed
            ? __('page.parks.title')
            : __('page.parks.title-trash');

        // - Message à afficher lorsque le tableau est vide.
        const emptyMessage: EmptyMessage | undefined = (() => {
            if (isTrashDisplayed) {
                return undefined;
            }

            if (hasActiveFilters) {
                return { variant: EmptyMessageVariant.NO_RESULTS };
            }

            return {
                text: __('page.parks.empty'),
                action: {
                    type: 'primary',
                    icon: 'plus',
                    label: __('page.parks.action-add'),
                    target: { name: 'add-park' },
                },
            };
        })();

        // - Actions de la page.
        const actions = !isTrashDisplayed
            ? [
                <Button type="primary" icon="plus" to={{ name: 'add-park' }} collapsible>
                    {__('page.parks.action-add')}
                </Button>,
                <Dropdown>
                    {hasContent && (
                        <Button icon="table" onClick={handleConfigureColumns}>
                            {__('configure-columns')}
                        </Button>
                    )}
                    <Button icon="trash" onClick={handleToggleShowTrashed}>
                        {__('open-trash-bin')}
                    </Button>
                </Dropdown>,
            ]
            : [
                <Button onClick={handleToggleShowTrashed} icon="eye" type="primary">
                    {__('display-not-deleted-items')}
                </Button>,
            ];

        return (
            <Page
                name="parks"
                title={title}
                loading={isLoading}
                actions={actions}
                scopedSlots={(isTrashDisplayed || !hasContent) ? undefined : {
                    headerContent: (): JSX.Node => (
                        <FiltersPanel
                            values={filters}
                            onChange={handleFiltersChange}
                            onSubmit={handleFiltersSubmit}
                        />
                    ),
                }}
            >
                <div class="Parks">
                    <ServerTable
                        ref="table"
                        key={!isTrashDisplayed ? 'default' : 'trash'}
                        name={!isTrashDisplayed ? $options.name : undefined}
                        class="Parks__table"
                        columns={columns}
                        fetcher={fetch}
                        emptyMessage={emptyMessage}
                        sticky
                    />
                </div>
            </Page>
        );
    },
});

export default Parks;
