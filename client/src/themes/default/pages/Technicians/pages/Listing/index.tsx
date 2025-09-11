import './index.scss';
import pick from 'lodash/pick';
import isEqual from 'lodash/isEqual';
import throttle from 'lodash/throttle';
import { HttpCode, RequestError } from '@/globals/requester';
import isTruthy from '@/utils/isTruthy';
import mergeDifference from '@/utils/mergeDifference';
import { defineComponent } from 'vue';
import apiTechnicians from '@/stores/api/technicians';
import { TechniciansViewMode } from '@/stores/api/users';
import { DEBOUNCE_WAIT_DURATION } from '@/globals/constants';
import Fragment from '@/components/Fragment';
import Page from '@/themes/default/components/Page';
import CriticalError from '@/themes/default/components/CriticalError';
import Button from '@/themes/default/components/Button';
import Dropdown from '@/themes/default/components/Dropdown';
import ViewModeSwitch from '../../components/ViewModeSwitch';
import formatAddress from '@/utils/formatAddress';
import { confirm } from '@/utils/alert';
import FiltersPanel from './components/Filters';
import {
    ServerTable,
    getLegacySavedSearch,
} from '@/themes/default/components/Table';
import {
    persistFilters,
    getPersistedFilters,
    clearPersistedFilters,
    getFiltersFromRoute,
    convertFiltersToRouteQuery,
} from './_utils';

import type { DebouncedMethod } from 'lodash';
import type { ComponentRef, CreateElement } from 'vue';
import type { PaginationParams, SortableParams } from '@/stores/api/@types';
import type { Filters } from './components/Filters';
import type { Technician } from '@/stores/api/technicians';
import type { Columns } from '@/themes/default/components/Table/Server';
import type { Session } from '@/stores/api/session';
import type { Role } from '@/stores/api/roles';

type InstanceProperties = {
    refreshTableDebounced: (
        | DebouncedMethod<typeof TechniciansListing, 'refreshTable'>
        | undefined
    ),
};

type Data = {
    filters: Filters,
    isLoading: boolean,
    hasCriticalError: boolean,
    shouldDisplayTrashed: boolean,
    isTrashDisplayed: boolean,
};

/** Page de listing des techniciens. */
const TechniciansListing = defineComponent({
    name: 'TechniciansListing',
    setup: (): InstanceProperties => ({
        refreshTableDebounced: undefined,
    }),
    data(): Data {
        const urlFilters = getFiltersFromRoute(this.$route);

        // - Filtres par défaut.
        const filters: Filters = {
            search: [],
            availabilityPeriod: null,
            role: null,
            ...urlFilters,
        };

        // - Filtres sauvegardés.
        const session = this.$store.state.auth.user as Session;
        if (!session.disable_search_persistence) {
            if (urlFilters === undefined) {
                const savedFilters = getPersistedFilters();
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
            clearPersistedFilters();
        }

        return {
            isLoading: false,
            hasCriticalError: false,
            isTrashDisplayed: false,
            shouldDisplayTrashed: false,
            filters,
        };
    },
    computed: {
        shouldPersistSearch(): boolean {
            const session = this.$store.state.auth.user as Session;
            return !session.disable_search_persistence;
        },

        columns(): Columns<Technician> {
            const {
                __,
                isTrashDisplayed,
                handleRestoreItemClick,
                handleDeleteItemClick,
            } = this;

            return [
                {
                    key: 'full_name',
                    title: `${__('global.first-name')} / ${__('global.last-name')}`,
                    class: [
                        'TechniciansListing__table__cell',
                        'TechniciansListing__table__cell--full-name',
                    ],
                    hideable: false,
                    sortable: true,
                },
                {
                    key: 'nickname',
                    title: __('global.nickname'),
                    class: [
                        'TechniciansListing__table__cell',
                        'TechniciansListing__table__cell--nickname',
                    ],
                    sortable: true,
                    defaultHidden: true,
                    render: (h: CreateElement, { nickname }: Technician) => (
                        nickname ?? (
                            <div class="TechniciansListing__table__cell__empty">
                                {__('global.not-specified')}
                            </div>
                        )
                    ),
                },
                !isTrashDisplayed && {
                    key: 'email',
                    title: __('global.email'),
                    class: [
                        'TechniciansListing__table__cell',
                        'TechniciansListing__table__cell--email',
                    ],
                    sortable: true,
                    render: (h: CreateElement, { email }: Technician) => (
                        email !== null
                            ? <a href={`mailto:${email}`}>{email}</a>
                            : (
                                <div class="TechniciansListing__table__cell__empty">
                                    {__('global.not-specified')}
                                </div>
                            )
                    ),
                },
                !isTrashDisplayed && {
                    key: 'phone',
                    title: __('global.phone'),
                    class: [
                        'TechniciansListing__table__cell',
                        'TechniciansListing__table__cell--phone',
                    ],
                    render: (h: CreateElement, { phone }: Technician) => (
                        phone ?? (
                            <div class="TechniciansListing__table__cell__empty">
                                {__('global.not-specified')}
                            </div>
                        )
                    ),
                },
                !isTrashDisplayed && {
                    key: 'address',
                    title: __('global.address'),
                    class: [
                        'TechniciansListing__table__cell',
                        'TechniciansListing__table__cell--address',
                    ],
                    defaultHidden: true,
                    render: (h: CreateElement, technician: Technician) => {
                        const address = formatAddress(
                            technician.street,
                            technician.postal_code,
                            technician.locality,
                            technician.country,
                        );
                        return address ?? (
                            <div class="TechniciansListing__table__cell__empty">
                                {__('global.not-specified')}
                            </div>
                        );
                    },
                },
                !isTrashDisplayed && {
                    key: 'roles',
                    title: __('page.roles'),
                    class: [
                        'TechniciansListing__table__cell',
                        'TechniciansListing__table__cell--roles',
                    ],
                    defaultHidden: true,
                    render: (h: CreateElement, { roles }: Technician) => {
                        if (roles.length === 0) {
                            return null;
                        }

                        return (
                            <ul class="TechniciansListing__roles">
                                {roles.map((role: Role) => (
                                    <li key={role.id} class="TechniciansListing__roles__item">
                                        {role.name}
                                    </li>
                                ))}
                            </ul>
                        );
                    },
                },
                !isTrashDisplayed && {
                    key: 'note',
                    title: __('global.notes'),
                    class: [
                        'TechniciansListing__table__cell',
                        'TechniciansListing__table__cell--note',
                    ],
                    defaultHidden: true,
                },
                {
                    key: 'actions',
                    class: [
                        'TechniciansListing__table__cell',
                        'TechniciansListing__table__cell--actions',
                    ],
                    render: (h: CreateElement, { id }: Technician) => {
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
                                        name: 'view-technician',
                                        params: { id: id.toString() },
                                        hash: '#infos',
                                    }}
                                />
                                <Button
                                    icon="calendar-alt"
                                    to={{
                                        name: 'view-technician',
                                        params: { id: id.toString() },
                                        hash: '#schedule',
                                    }}
                                />
                                <Dropdown>
                                    <Button
                                        type="edit"
                                        to={{
                                            name: 'edit-technician',
                                            params: { id: id.toString() },
                                        }}
                                    >
                                        {__('global.action-edit')}
                                    </Button>
                                    <Button
                                        type="trash"
                                        onClick={(e: MouseEvent) => {
                                            handleDeleteItemClick(e, id);
                                        }}
                                    >
                                        {__('global.action-delete')}
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
            handler(newFilters: Filters, prevFilters: Filters | undefined) {
                if (prevFilters !== undefined) {
                    this.refreshTableDebounced!();
                }

                // - Persistance dans le local storage.
                if (this.shouldPersistSearch) {
                    persistFilters(newFilters);
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

        handleRowClick({ id }: Technician) {
            this.$router.push({
                name: 'view-technician',
                params: { id: id.toString() },
            });
        },

        async handleDeleteItemClick(e: MouseEvent, id: Technician['id']) {
            e.stopPropagation();

            const { __ } = this;
            const isSoft = !this.isTrashDisplayed;

            const isConfirmed = await confirm({
                type: 'danger',
                text: isSoft
                    ? __('confirm-delete')
                    : __('confirm-permanently-delete'),
                confirmButtonText: isSoft
                    ? __('global.yes-trash')
                    : __('global.yes-permanently-delete'),
            });
            if (!isConfirmed) {
                return;
            }

            this.isLoading = true;
            try {
                await apiTechnicians.remove(id);

                this.$toasted.success(__('deleted'));
                this.refreshTable();
            } catch {
                this.$toasted.error(__('global.errors.unexpected-while-deleting'));
            } finally {
                this.isLoading = false;
            }
        },

        async handleRestoreItemClick(e: MouseEvent, id: Technician['id']) {
            e.stopPropagation();
            const { __ } = this;

            const isConfirmed = await confirm({
                text: __('confirm-restore'),
                confirmButtonText: __('global.yes-restore'),
            });
            if (!isConfirmed) {
                return;
            }

            this.isLoading = true;
            try {
                await apiTechnicians.restore(id);

                this.$toasted.success(__('restored'));
                this.refreshTable();
            } catch {
                this.$toasted.error(__('global.errors.unexpected-while-restoring'));
            } finally {
                this.isLoading = false;
            }
        },

        handleToggleShowTrashed() {
            this.shouldDisplayTrashed = !this.shouldDisplayTrashed;
            this.refreshTable();
        },

        handleFiltersChange(newFilters: Filters) {
            // - Recherche textuelle.
            const newSearch = mergeDifference(this.filters.search, newFilters.search);
            if (!isEqual(this.filters.search, newSearch)) {
                this.filters.search = newSearch;
            }

            // - Période de disponibilité.
            if (
                (this.filters.availabilityPeriod === null && newFilters.availabilityPeriod !== null) ||
                (this.filters.availabilityPeriod !== null && newFilters.availabilityPeriod === null) ||
                (
                    (this.filters.availabilityPeriod !== null && newFilters.availabilityPeriod !== null) &&
                    !this.filters.availabilityPeriod.isSame(newFilters.availabilityPeriod)
                )
            ) {
                this.filters.availabilityPeriod = newFilters.availabilityPeriod;
            }

            // - Rôle.
            if (this.filters.role !== newFilters.role) {
                this.filters.role = newFilters.role;
            }
        },

        handleFiltersSubmit() {
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

            try {
                const data = await apiTechnicians.all({
                    ...pagination,
                    ...this.filters,
                    deleted: this.shouldDisplayTrashed,
                });
                this.isTrashDisplayed = this.shouldDisplayTrashed;
                return data;
            } catch (error) {
                if (error instanceof RequestError && error.httpCode === HttpCode.RangeNotSatisfiable) {
                    this.refreshTable();
                    return undefined;
                }

                // eslint-disable-next-line no-console
                console.error(`Error occurred while retrieving technicians:`, error);
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

        __(key: string, params?: Record<string, number | string>, count?: number): string {
            if (!key.startsWith('global.')) {
                if (!key.startsWith('page.')) {
                    key = `page.sub-pages.listing.${key}`;
                }
                key = key.replace(/^page\./, 'page.technicians.');
            } else {
                key = key.replace(/^global\./, '');
            }
            return this.$t(key, params, count);
        },
    },
    render() {
        const {
            __,
            fetch,
            $options,
            columns,
            filters,
            isLoading,
            isTrashDisplayed,
            hasCriticalError,
            handleRowClick,
            handleFiltersChange,
            handleFiltersSubmit,
            handleConfigureColumns,
            handleToggleShowTrashed,
        } = this;

        if (hasCriticalError) {
            return (
                <Page
                    name="technicians-listing"
                    title={__('title')}
                    centered
                >
                    <CriticalError />
                </Page>
            );
        }

        if (isTrashDisplayed) {
            return (
                <Page
                    name="technicians-listing"
                    title={__('title-trash')}
                    loading={isLoading}
                    actions={[
                        <Button onClick={handleToggleShowTrashed} icon="eye" type="primary">
                            {__('global.display-not-deleted-items')}
                        </Button>,
                    ]}
                >
                    <div class="TechniciansListing TechniciansListing--trashed">
                        <ServerTable
                            ref="table"
                            key="trash"
                            class="TechniciansListing__table"
                            rowClass="TechniciansListing__table__row"
                            columns={columns}
                            fetcher={fetch}
                        />
                    </div>
                </Page>
            );
        }

        return (
            <Page
                name="technicians-listing"
                title={__('title')}
                loading={isLoading}
                actions={[
                    <ViewModeSwitch mode={TechniciansViewMode.LISTING} />,
                    <Button
                        type="add"
                        icon="user-plus"
                        to={{ name: 'add-technician' }}
                        collapsible
                    >
                        {__('page.action-add')}
                    </Button>,
                    <Dropdown>
                        <Button icon="tools" to={{ name: 'roles' }}>
                            {__('page.manage-roles')}
                        </Button>
                        <Button icon="table" onClick={handleConfigureColumns}>
                            {__('global.configure-columns')}
                        </Button>
                        <Button icon="trash" onClick={handleToggleShowTrashed}>
                            {__('global.open-trash-bin')}
                        </Button>
                    </Dropdown>,
                ]}
                scopedSlots={{
                    headerContent: (): JSX.Node => (
                        <FiltersPanel
                            values={filters}
                            onChange={handleFiltersChange}
                            onSubmit={handleFiltersSubmit}
                        />
                    ),
                }}
            >
                <div class="TechniciansListing">
                    <ServerTable
                        ref="table"
                        key="default"
                        name={$options.name}
                        class="TechniciansListing__table"
                        rowClass="TechniciansListing__table__row"
                        columns={columns}
                        fetcher={fetch}
                        onRowClick={handleRowClick}
                    />
                </div>
            </Page>
        );
    },
});

export default TechniciansListing;
