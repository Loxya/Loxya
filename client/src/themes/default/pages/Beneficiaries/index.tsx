import './index.scss';
import pick from 'lodash/pick';
import isEqual from 'lodash/isEqual';
import throttle from 'lodash/throttle';
import { HttpCode, RequestError } from '@/globals/requester';
import { defineComponent } from 'vue';
import { DEBOUNCE_WAIT_DURATION } from '@/globals/constants';
import isTruthy from '@/utils/isTruthy';
import Fragment from '@/components/Fragment';
import { confirm } from '@/utils/alert';
import apiBeneficiaries from '@/stores/api/beneficiaries';
import Page from '@/themes/default/components/Page';
import CriticalError from '@/themes/default/components/CriticalError';
import Dropdown from '@/themes/default/components/Dropdown';
import Button from '@/themes/default/components/Button';
import Link from '@/themes/default/components/Link';
import FiltersPanel, { FiltersSchema } from './components/Filters';
import {
    ServerTable,
    getLegacySavedSearch,
} from '@/themes/default/components/Table';
import {
    persistFilters,
    getPersistedFilters,
    clearPersistedFilters,
} from '@/utils/filtersPersister';

import type { DebouncedMethod } from 'lodash';
import type { Filters } from './components/Filters';
import type { ComponentRef, CreateElement } from 'vue';
import type { Beneficiary } from '@/stores/api/beneficiaries';
import type { Columns } from '@/themes/default/components/Table/Server';
import type { PaginationParams, SortableParams } from '@/stores/api/@types';
import type { Session } from '@/stores/api/session';

type Data = {
    filters: Filters,
    isLoading: boolean,
    hasCriticalError: boolean,
    shouldDisplayTrashed: boolean,
    isTrashDisplayed: boolean,
};

type InstanceProperties = {
    refreshTableDebounced: (
        | DebouncedMethod<typeof Beneficiaries, 'refreshTable'>
        | undefined
    ),
};

/** La clé utilisé pour la persistence des filtres de la page. */
const FILTERS_PERSISTENCE_KEY = 'Beneficiaries--filters';

/* Page de listing des bénéficiaires. */
const Beneficiaries = defineComponent({
    name: 'Beneficiaries',
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
            } else {
                // - Ancienne sauvegarde éventuelle, dans le component `<Table />`.
                const savedSearchLegacy = this.$options.name
                    ? getLegacySavedSearch(this.$options.name)
                    : null;

                if (savedSearchLegacy !== null) {
                    Object.assign(filters, { search: [savedSearchLegacy] });
                }
            }
        } else {
            clearPersistedFilters(FILTERS_PERSISTENCE_KEY);
        }

        return {
            isLoading: false,
            hasCriticalError: false,
            shouldDisplayTrashed: false,
            isTrashDisplayed: false,
            filters,
        };
    },
    computed: {
        shouldPersistSearch(): boolean {
            const session = this.$store.state.auth.user as Session;
            return !session.disable_search_persistence;
        },

        columns(): Columns<Beneficiary> {
            const { $t: __, isTrashDisplayed, handleDeleteItemClick, handleRestoreItemClick } = this;

            return [
                {
                    key: 'full_name',
                    title: `${__('first-name')} / ${__('last-name')}`,
                    class: 'Beneficiaries__cell Beneficiaries__cell--full-name',
                    hideable: false,
                    sortable: true,
                },
                {
                    key: 'reference',
                    title: __('reference'),
                    class: 'Beneficiaries__cell Beneficiaries__cell--reference',
                    sortable: true,
                    defaultHidden: true,
                    render: (h: CreateElement, { reference }: Beneficiary) => (
                        reference ?? (
                            <span class="Beneficiaries__cell__empty">
                                {__('not-specified')}
                            </span>
                        )
                    ),
                },
                {
                    key: 'company',
                    title: __('company'),
                    class: 'Beneficiaries__cell Beneficiaries__cell--company',
                    sortable: true,
                    render: (h: CreateElement, { company }: Beneficiary) => {
                        if (!company) {
                            return (
                                <span class="Beneficiaries__cell__empty">
                                    {__('not-specified')}
                                </span>
                            );
                        }

                        return (
                            <Link
                                to={{
                                    name: 'edit-company',
                                    params: { id: company.id.toString() },
                                }}
                            >
                                <span class="Beneficiaries__company">
                                    <span class="Beneficiaries__company__legal-name">
                                        {company.legal_name}
                                    </span>
                                    {(company.registration_id ?? '').length > 0 && (
                                        <span class="Beneficiaries__company__registration-id">
                                            {company.registration_id}
                                        </span>
                                    )}
                                </span>
                            </Link>
                        );
                    },
                },
                !isTrashDisplayed && {
                    key: 'email',
                    title: __('email'),
                    class: 'Beneficiaries__cell Beneficiaries__cell--email',
                    sortable: true,
                    render: (h: CreateElement, { email }: Beneficiary) => (
                        email !== null
                            ? <a href={`mailto:${email}`}>{email}</a>
                            : (
                                <span class="Beneficiaries__cell__empty">
                                    {__('not-specified')}
                                </span>
                            )
                    ),
                },
                !isTrashDisplayed && {
                    key: 'phone',
                    title: __('phone'),
                    class: 'Beneficiaries__cell Beneficiaries__cell--phone',
                    render: (h: CreateElement, beneficiary: Beneficiary) => {
                        const phones: string[] = [
                            (beneficiary.phone ?? '').length > 0 && (
                                beneficiary.phone!
                            ),
                            (beneficiary.company?.phone ?? '').length > 0 && (
                                beneficiary.company!.phone!
                            ),
                        ].filter(Boolean) as string[];

                        return phones.length > 0
                            ? phones.map((phone: string, index: number) => (
                                <div key={index}>{phone}</div>
                            ))
                            : (
                                <span class="Beneficiaries__cell__empty">
                                    {__('not-specified')}
                                </span>
                            );
                    },
                },
                !isTrashDisplayed && {
                    key: 'address',
                    title: __('address'),
                    defaultHidden: true,
                    class: 'Beneficiaries__cell Beneficiaries__cell--address',
                    render: (h: CreateElement, beneficiary: Beneficiary) => {
                        const address = beneficiary.company?.full_address || beneficiary.full_address || '';
                        return address.length > 0 ? address : (
                            <span class="Beneficiaries__cell__empty">
                                {__('not-specified')}
                            </span>
                        );
                    },
                },
                !isTrashDisplayed && {
                    key: 'note',
                    title: __('notes'),
                    class: 'Beneficiaries__cell Beneficiaries__cell--note',
                    defaultHidden: true,
                    render: (h: CreateElement, beneficiary: Beneficiary) => (
                        beneficiary.company
                            ? beneficiary.company.note
                            : beneficiary.note
                    ),
                },
                {
                    key: 'actions',
                    class: 'Beneficiaries__cell Beneficiaries__cell--actions',
                    render: (h: CreateElement, { id }: Beneficiary) => {
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
                                        name: 'view-beneficiary',
                                        params: { id: id.toString() },
                                    }}
                                />
                                <Dropdown>
                                    <Button
                                        type="edit"
                                        to={{
                                            name: 'edit-beneficiary',
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

        async handleDeleteItemClick(e: MouseEvent, id: Beneficiary['id']) {
            e.stopPropagation();

            const { $t: __ } = this;
            const isSoft = !this.isTrashDisplayed;

            const isConfirmed = await confirm({
                type: 'danger',
                text: isSoft
                    ? __('page.beneficiaries.confirm-delete')
                    : __('page.beneficiaries.confirm-permanently-delete'),
                confirmButtonText: isSoft
                    ? __('yes-trash')
                    : __('yes-permanently-delete'),
            });
            if (!isConfirmed) {
                return;
            }

            this.isLoading = true;
            try {
                await apiBeneficiaries.remove(id);

                this.$toasted.success(__('page.beneficiaries.deleted'));
                this.refreshTable();
            } catch {
                this.$toasted.error(__('errors.unexpected-while-deleting'));
            } finally {
                this.isLoading = false;
            }
        },

        async handleRestoreItemClick(e: MouseEvent, id: Beneficiary['id']) {
            e.stopPropagation();
            const { $t: __ } = this;

            const isConfirmed = await confirm({
                text: __('page.beneficiaries.confirm-restore'),
                confirmButtonText: __('yes-restore'),
            });
            if (!isConfirmed) {
                return;
            }

            this.isLoading = true;
            try {
                await apiBeneficiaries.restore(id);

                this.$toasted.success(__('page.beneficiaries.restored'));
                this.refreshTable();
            } catch {
                this.$toasted.error(__('errors.unexpected-while-restoring'));
            } finally {
                this.isLoading = false;
            }
        },

        handleRowClick({ id }: Beneficiary) {
            this.$router.push({
                name: 'view-beneficiary',
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

        handleFiltersChange(newFilters: Filters) {
            // - Recherche textuelle.
            const newSearch = [...new Set([...this.filters.search, ...newFilters.search])]
                .filter((term: string) => newFilters.search.includes(term));
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
            pagination = pick(pagination, ['page', 'limit', 'ascending', 'orderBy']);
            this.isLoading = true;

            try {
                const data = await apiBeneficiaries.all({
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
                console.error(`Error occurred while retrieving beneficiaries:`, error);
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
            $options,
            filters,
            columns,
            isLoading,
            isTrashDisplayed,
            hasCriticalError,
            handleConfigureColumns,
            handleToggleShowTrashed,
            handleFiltersChange,
            handleFiltersSubmit,
            handleRowClick,
        } = this;

        if (hasCriticalError) {
            return (
                <Page name="beneficiaries" title={__('page.beneficiaries.title')} centered>
                    <CriticalError />
                </Page>
            );
        }

        if (isTrashDisplayed) {
            return (
                <Page
                    name="beneficiaries"
                    title={__('page.beneficiaries.title-trash')}
                    loading={isLoading}
                    actions={[
                        <Button onClick={handleToggleShowTrashed} icon="eye" type="primary">
                            {__('display-not-deleted-items')}
                        </Button>,
                    ]}
                >
                    <div class="Beneficiaries Beneficiaries--trashed">
                        <ServerTable
                            ref="table"
                            key="trash"
                            rowClass="Beneficiaries__row"
                            columns={columns}
                            fetcher={fetch}
                        />
                    </div>
                </Page>
            );
        }

        return (
            <Page
                name="beneficiaries"
                title={__('page.beneficiaries.title')}
                loading={isLoading}
                actions={[
                    <Button
                        type="add"
                        icon="user-plus"
                        to={{ name: 'add-beneficiary' }}
                        collapsible
                    >
                        {__('page.beneficiaries.action-add')}
                    </Button>,
                    <Dropdown>
                        <Button icon="table" onClick={handleConfigureColumns}>
                            {__('configure-columns')}
                        </Button>
                        <Button icon="trash" onClick={handleToggleShowTrashed}>
                            {__('open-trash-bin')}
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
                <div class="Beneficiaries">
                    <ServerTable
                        ref="table"
                        key="default"
                        name={$options.name}
                        class="Beneficiaries__table"
                        rowClass="Beneficiaries__row"
                        columns={columns}
                        fetcher={fetch}
                        onRowClick={handleRowClick}
                    />
                </div>
            </Page>
        );
    },
});

export default Beneficiaries;
