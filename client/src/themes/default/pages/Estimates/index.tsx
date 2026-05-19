import './index.scss';
import isEqual from 'lodash/isEqual';
import config from '@/globals/config';
import { defineComponent } from 'vue';
import throttle from 'lodash/throttle';
import isTruthy from '@/utils/isTruthy';
import { Group } from '@/stores/api/groups';
import Fragment from '@/components/Fragment';
import formatAmount from '@/utils/formatAmount';
import { DayReadableFormat } from '@/utils/day';
import apiEstimates from '@/stores/api/estimates';
import mergeDifference from '@/utils/mergeDifference';
import { DEBOUNCE_WAIT_DURATION } from '@/globals/constants';
import { HttpCode, RequestError } from '@/globals/requester';
import Page from '@/themes/default/components/Page';
import Button from '@/themes/default/components/Button';
import Dropdown from '@/themes/default/components/Dropdown';
import { ServerTable } from '@/themes/default/components/Table';
import CriticalError from '@/themes/default/components/CriticalError';
import StatusBadge from '@/themes/default/components/BadgeStatus/Estimate';
import { EmptyMessageVariant } from '@/themes/default/components/EmptyMessage';
import FiltersPanel, { FiltersSchema } from './components/Filters';
import { hasChangedFilters } from './_utils';
import {
    persistFilters,
    getPersistedFilters,
    clearPersistedFilters,
} from '@/utils/filtersPersister';

// - Modales
import InvoiceDetailsModal from '@/themes/default/modals/InvoiceDetails';
import EstimateDetailsModal from '@/themes/default/modals/EstimateDetails';
import EstimateCreateModal from '@/themes/default/modals/EstimateCreate';

import type { CreateElement } from 'vue';
import type { DebouncedMethod } from 'lodash';
import type { Filters } from './components/Filters';
import type { Session } from '@/stores/api/session';
import type { Estimate } from '@/stores/api/estimates';
import type { PaginationParams, SortableParams } from '@/stores/api/@types';
import type { Columns, ServerTableRef } from '@/themes/default/components/Table/Server';
import type { EmptyMessage } from '@/themes/default/components/Table/@types';

type Data = {
    filters: Filters,
    appliedFilters: Filters,
    isLoading: boolean,
    isFetched: boolean,
    isEmpty: boolean,
    hasCriticalError: boolean,
};

type InstanceProperties = {
    refreshTableDebounced: (
        | DebouncedMethod<typeof Estimates, 'refreshTable'>
        | undefined
    ),
};

/** La clé utilisé pour la persistence des filtres de la page. */
const FILTERS_PERSISTENCE_KEY = 'Estimates--filters';

/** Page de listing des devis. */
const Estimates = defineComponent({
    name: 'Estimates',
    setup: (): InstanceProperties => ({
        refreshTableDebounced: undefined,
    }),
    data(): Data {
        const filters: Filters = {
            search: [],
            status: [],
            date: null,
            dueDate: null,
            amount: null,
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
        };
    },
    computed: {
        isTaxesEnabled(): boolean {
            return !config.organization.isVatExempted;
        },

        userCanCreate(): boolean {
            return this.$store.getters['auth/is']([
                Group.ADMINISTRATION,
                Group.SUPERVISION,
                Group.OPERATION,
            ]);
        },

        shouldPersistSearch(): boolean {
            const session = this.$store.state.auth.user as Session;
            return !session.disable_search_persistence;
        },

        hasActiveFilters(): boolean {
            const { appliedFilters } = this;
            return (
                appliedFilters.search.length > 0 ||
                appliedFilters.status.length > 0 ||
                appliedFilters.date !== null ||
                appliedFilters.dueDate !== null ||
                appliedFilters.amount !== null
            );
        },

        hasContent(): boolean {
            return (
                this.isFetched &&
                (!this.isEmpty || this.hasActiveFilters)
            );
        },

        columns(): Columns<Estimate> {
            const { __, isTaxesEnabled, handleShowDetails } = this;

            return [
                {
                    key: 'number',
                    title: __('columns.number'),
                    class: [
                        'Estimates__table__cell',
                        'Estimates__table__cell--number',
                    ],
                    hideable: false,
                    sortable: true,
                    defaultSortDesc: true,
                    render: (h: CreateElement, estimate: Estimate) => {
                        if (!('number' in estimate) || estimate.number === undefined) {
                            return (
                                <span class="Invoices__table__cell__empty">
                                    {'\u2014'}
                                </span>
                            );
                        }
                        return estimate.number;
                    },
                },
                {
                    key: 'date',
                    title: __('columns.issue-date'),
                    class: [
                        'Estimates__table__cell',
                        'Estimates__table__cell--issue-date',
                    ],
                    sortable: true,
                    defaultSortDesc: true,
                    render: (h: CreateElement, estimate: Estimate) => {
                        if (estimate.date === undefined) {
                            return (
                                <span class="Estimates__table__cell__empty">
                                    {'\u2014'}
                                </span>
                            );
                        }
                        const day = estimate.date.toDay();
                        return day.toReadable(DayReadableFormat.MEDIUM);
                    },
                },
                {
                    key: 'due_date',
                    title: __('columns.due-date'),
                    class: [
                        'Estimates__table__cell',
                        'Estimates__table__cell--due-date',
                    ],
                    sortable: true,
                    defaultSortDesc: true,
                    render: (h: CreateElement, estimate: Estimate) => {
                        if (estimate.due_date !== null) {
                            return estimate.due_date.toReadable(DayReadableFormat.MEDIUM);
                        }
                        if (estimate.due_delay !== null && estimate.date !== undefined) {
                            const effectiveDueDate = estimate.date.toDay().addDay(estimate.due_delay);
                            return effectiveDueDate.toReadable(DayReadableFormat.MEDIUM);
                        }
                        return (
                            <span class="Estimates__table__cell__empty">
                                {'\u2014'}
                            </span>
                        );
                    },
                },
                {
                    key: 'buyer',
                    title: __('columns.buyer'),
                    class: [
                        'Estimates__table__cell',
                        'Estimates__table__cell--buyer',
                    ],
                    render: (h: CreateElement, { buyer }: Estimate) => (
                        <span class="Estimates__buyer">
                            <span class="Estimates__buyer__primary">
                                <span class="Estimates__buyer__name">
                                    {(
                                        buyer.company
                                            ? buyer.company.legal_name
                                            : buyer.full_name
                                    )}
                                </span>
                            </span>
                            {buyer.company !== null && (
                                <span class="Estimates__buyer__contact">
                                    {__('global.contact-name', { name: buyer.full_name })}
                                </span>
                            )}
                        </span>
                    ),
                },
                {
                    key: 'total_without_taxes',
                    title: __('columns.total-without-taxes'),
                    class: [
                        'Estimates__table__cell',
                        'Estimates__table__cell--total-without-taxes',
                    ],
                    sortable: true,
                    render: (h: CreateElement, estimate: Estimate) => (
                        formatAmount(estimate.total_without_taxes, estimate.currency)
                    ),
                },
                isTaxesEnabled && {
                    key: 'total_with_taxes',
                    title: __('columns.total-with-taxes'),
                    class: [
                        'Estimates__table__cell',
                        'Estimates__table__cell--total-with-taxes',
                    ],
                    sortable: true,
                    render: (h: CreateElement, estimate: Estimate) => (
                        formatAmount(estimate.total_with_taxes, estimate.currency)
                    ),
                },
                {
                    key: 'status',
                    title: __('columns.status'),
                    class: [
                        'Estimates__table__cell',
                        'Estimates__table__cell--status',
                    ],
                    sortable: true,
                    render: (h: CreateElement, estimate: Estimate) => (
                        <StatusBadge estimate={estimate} />
                    ),
                },
                {
                    key: 'actions',
                    class: [
                        'Estimates__table__cell',
                        'Estimates__table__cell--actions',
                    ],
                    render: (h: CreateElement, estimate: Estimate) => (
                        <Fragment>
                            <Button
                                icon="eye"
                                onClick={(e: Event) => {
                                    e.stopPropagation();

                                    handleShowDetails(estimate);
                                }}
                            />
                            <Button
                                icon="download"
                                to={estimate.url}
                                download
                            />
                        </Fragment>
                    ),
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

        async handleShowDetails(estimate: Estimate) {
            await this.openDetails('estimate', estimate.id);
        },

        async handleCreate() {
            if (!this.userCanCreate) {
                return;
            }

            const newEstimate = await this.$modal.show(EstimateCreateModal);
            if (newEstimate === undefined) {
                return;
            }

            // - On actualise le tableau suite à la création.
            this.refreshTable();

            await this.openDetails('estimate', newEstimate.id);
        },

        handleConfigureColumns() {
            const $table = this.$refs.table as ServerTableRef;
            $table?.showColumnsSelector();
        },

        handleFiltersChange(newFilters: Filters) {
            // - Recherche textuelle.
            const newSearch = mergeDifference(this.filters.search, newFilters.search);
            if (!isEqual(this.filters.search, newSearch)) {
                this.filters.search = newSearch;
            }

            // - Statut.
            const newStatuses = mergeDifference(this.filters.status, newFilters.status);
            if (!isEqual(this.filters.status, newStatuses)) {
                this.filters.status = newStatuses;
            }

            // - Date d'émission.
            if (hasChangedFilters(this.filters.date, newFilters.date)) {
                this.filters.date = newFilters.date;
            }

            // - Date d'échéance.
            if (hasChangedFilters(this.filters.dueDate, newFilters.dueDate)) {
                this.filters.dueDate = newFilters.dueDate;
            }

            // - Montant HT.
            if (hasChangedFilters(this.filters.amount, newFilters.amount)) {
                this.filters.amount = newFilters.amount;
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
                const data = await apiEstimates.all({
                    ...pagination,
                    ...filters,
                });

                this.isFetched = true;
                this.isEmpty = data.pagination.total.items <= 0;

                return data;
            } catch (error) {
                if (error instanceof RequestError && error.httpCode === HttpCode.RangeNotSatisfiable) {
                    this.refreshTable();
                    return undefined;
                }

                // eslint-disable-next-line no-console
                console.error('Error while retrieving estimates:', error);
                this.hasCriticalError = true;
            } finally {
                this.isLoading = false;
            }

            return undefined;
        },

        async openDetails(kind: 'estimate' | 'invoice', id: number) {
            let shouldRefetch = false;
            let nextOpen: { kind: 'estimate' | 'invoice', id: number } | null = { kind, id };

            while (nextOpen !== null) {
                const current = nextOpen;
                nextOpen = null;

                /* eslint-disable @typescript-eslint/no-loop-func, no-await-in-loop */
                if (current.kind === 'estimate') {
                    await this.$modal.show(EstimateDetailsModal, {
                        id: current.id,
                        onChange: () => { shouldRefetch = true; },
                        onRequestOpen: (newKind, newId): void => {
                            nextOpen = { kind: newKind, id: newId };
                        },
                    });
                } else {
                    await this.$modal.show(InvoiceDetailsModal, {
                        id: current.id,
                        onChange: () => { shouldRefetch = true; },
                        onRequestOpen: (newKind, newId): void => {
                            nextOpen = { kind: newKind, id: newId };
                        },
                    });
                }
                /* eslint-enable @typescript-eslint/no-loop-func, no-await-in-loop */
            }

            if (shouldRefetch) {
                this.refreshTable();
            }
        },

        refreshTable() {
            this.refreshTableDebounced?.cancel();

            (this.$refs.table as ServerTableRef)?.refresh();
        },

        __(key: string, params?: Record<string, number | string>, count?: number): string {
            key = !key.startsWith('global.')
                ? `page.estimates.${key}`
                : key.replace(/^global\./, '');

            return this.$t(key, params, count);
        },
    },
    render() {
        const {
            __,
            fetch,
            columns,
            filters,
            $options,
            isLoading,
            hasContent,
            hasCriticalError,
            hasActiveFilters,
            userCanCreate,
            handleCreate,
            handleShowDetails,
            handleFiltersChange,
            handleFiltersSubmit,
            handleConfigureColumns,
        } = this;

        if (hasCriticalError) {
            return (
                <Page name="estimates" title={__('title')} centered>
                    <CriticalError />
                </Page>
            );
        }

        // - Message à afficher lorsque le tableau est vide.
        const emptyMessage: EmptyMessage = (
            hasActiveFilters
                ? { variant: EmptyMessageVariant.NO_RESULTS }
                : {
                    text: __('empty'),
                    action: !userCanCreate ? undefined : {
                        type: 'primary',
                        icon: 'plus',
                        label: __('action'),
                        onClick: handleCreate,
                    },
                }
        );

        // - Actions de la page.
        const actions = [
            userCanCreate && (
                <Button type="primary" icon="plus" onClick={handleCreate}>
                    {__('action')}
                </Button>
            ),
            hasContent && (
                <Dropdown>
                    <Button icon="table" onClick={handleConfigureColumns}>
                        {__('global.configure-columns')}
                    </Button>
                </Dropdown>
            ),
        ].filter(isTruthy);

        return (
            <Page
                name="estimates"
                title={__('title')}
                loading={isLoading}
                actions={actions}
                scopedSlots={{
                    headerContent: (): JSX.Node => {
                        if (!hasContent) {
                            return null;
                        }
                        return (
                            <FiltersPanel
                                values={filters}
                                onChange={handleFiltersChange}
                                onSubmit={handleFiltersSubmit}
                            />
                        );
                    },
                }}
            >
                <div class="Estimates">
                    <ServerTable
                        ref="table"
                        name={$options.name}
                        class="Estimates__table"
                        columns={columns}
                        fetcher={fetch}
                        defaultOrderBy={{
                            column: 'date',
                            ascending: false,
                        }}
                        emptyMessage={emptyMessage}
                        onRowClick={handleShowDetails}
                        sticky
                    />
                </div>
            </Page>
        );
    },
});

export default Estimates;
