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
import apiInvoices from '@/stores/api/invoices';
import mergeDifference from '@/utils/mergeDifference';
import { DEBOUNCE_WAIT_DURATION } from '@/globals/constants';
import { HttpCode, RequestError } from '@/globals/requester';
import Page from '@/themes/default/components/Page';
import Button from '@/themes/default/components/Button';
import Dropdown from '@/themes/default/components/Dropdown';
import { ServerTable } from '@/themes/default/components/Table';
import { ScreenSize, getScreenSize, observeScreenSize } from '@/utils/screenSize';
import StatusBadge from '@/themes/default/components/BadgeStatus/Invoice';
import CriticalError from '@/themes/default/components/CriticalError';
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
import InvoiceCreateModal from '@/themes/default/modals/InvoiceCreate';

import type { CreateElement } from 'vue';
import type { DebouncedMethod } from 'lodash';
import type { Filters } from './components/Filters';
import type { Session } from '@/stores/api/session';
import type { Invoice } from '@/stores/api/invoices';
import type { PaginationParams, SortableParams } from '@/stores/api/@types';
import type { Columns, ServerTableRef } from '@/themes/default/components/Table/Server';
import type { EmptyMessage } from '@/themes/default/components/Table/@types';

type Data = {
    filters: Filters,
    appliedFilters: Filters,
    isMobile: boolean,
    isLoading: boolean,
    isFetched: boolean,
    isEmpty: boolean,
    hasCriticalError: boolean,
};

type InstanceProperties = {
    cancelScreenSizeObserver: (() => void) | undefined,
    refreshTableDebounced: (
        | DebouncedMethod<typeof Invoices, 'refreshTable'>
        | undefined
    ),
};

/** La clé utilisé pour la persistence des filtres de la page. */
const FILTERS_PERSISTENCE_KEY = 'Invoices--filters';

/** Page de listing des factures. */
const Invoices = defineComponent({
    name: 'Invoices',
    setup: (): InstanceProperties => ({
        refreshTableDebounced: undefined,
        cancelScreenSizeObserver: undefined,
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
            isMobile: getScreenSize() === ScreenSize.MOBILE,
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

        columns(): Columns<Invoice> {
            const { __, isTaxesEnabled, handleShowDetails } = this;

            return [
                {
                    key: 'number',
                    title: __('columns.number'),
                    class: [
                        'Invoices__table__cell',
                        'Invoices__table__cell--number',
                    ],
                    hideable: false,
                    sortable: true,
                    sticky: true,
                    defaultSortDesc: true,
                    render: (h: CreateElement, invoice: Invoice) => {
                        if (invoice.number === undefined) {
                            return (
                                <span class="Invoices__table__cell__empty">
                                    {'\u2014'}
                                </span>
                            );
                        }
                        return invoice.number;
                    },
                },
                {
                    key: 'date',
                    title: __('columns.issue-date'),
                    class: [
                        'Invoices__table__cell',
                        'Invoices__table__cell--issue-date',
                    ],
                    sortable: true,
                    defaultSortDesc: true,
                    render: (h: CreateElement, invoice: Invoice) => {
                        if (invoice.date === undefined) {
                            return (
                                <span class="Invoices__table__cell__empty">
                                    {'\u2014'}
                                </span>
                            );
                        }
                        const day = invoice.date.toDay();
                        return day.toReadable(DayReadableFormat.MEDIUM);
                    },
                },
                {
                    key: 'due_date',
                    title: __('columns.due-date'),
                    class: [
                        'Invoices__table__cell',
                        'Invoices__table__cell--due-date',
                    ],
                    sortable: true,
                    defaultSortDesc: true,
                    render: (h: CreateElement, invoice: Invoice) => {
                        if (invoice.due_date !== null) {
                            return invoice.due_date.toReadable(DayReadableFormat.MEDIUM);
                        }
                        if (invoice.due_delay !== null && invoice.date !== undefined) {
                            const effectiveDueDate = invoice.date.toDay().addDay(invoice.due_delay);
                            return effectiveDueDate.toReadable(DayReadableFormat.MEDIUM);
                        }
                        return (
                            <span class="Invoices__table__cell__empty">
                                {'\u2014'}
                            </span>
                        );
                    },
                },
                {
                    key: 'buyer',
                    title: __('columns.buyer'),
                    class: [
                        'Invoices__table__cell',
                        'Invoices__table__cell--buyer',
                    ],
                    render: (h: CreateElement, { buyer }: Invoice) => (
                        <span class="Invoices__buyer">
                            <span class="Invoices__buyer__primary">
                                <span class="Invoices__buyer__name">
                                    {(
                                        buyer.company
                                            ? buyer.company.legal_name
                                            : buyer.full_name
                                    )}
                                </span>
                            </span>
                            {buyer.company !== null && (
                                <span class="Invoices__buyer__contact">
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
                        'Invoices__table__cell',
                        'Invoices__table__cell--total-without-taxes',
                    ],
                    sortable: true,
                    render: (h: CreateElement, invoice: Invoice) => (
                        invoice.is_credit_note
                            ? formatAmount(invoice.total_without_taxes.neg(), invoice.currency)
                            : formatAmount(invoice.total_without_taxes, invoice.currency)
                    ),
                },
                isTaxesEnabled && {
                    key: 'total_with_taxes',
                    title: __('columns.total-with-taxes'),
                    class: [
                        'Invoices__table__cell',
                        'Invoices__table__cell--total-with-taxes',
                    ],
                    sortable: true,
                    render: (h: CreateElement, invoice: Invoice) => (
                        invoice.is_credit_note
                            ? formatAmount(invoice.total_with_taxes.neg(), invoice.currency)
                            : formatAmount(invoice.total_with_taxes, invoice.currency)
                    ),
                },
                {
                    key: 'status',
                    title: __('columns.status'),
                    class: [
                        'Invoices__table__cell',
                        'Invoices__table__cell--status',
                    ],
                    sortable: true,
                    render: (h: CreateElement, invoice: Invoice) => (
                        <StatusBadge invoice={invoice} />
                    ),
                },
                {
                    key: 'actions',
                    class: [
                        'Invoices__table__cell',
                        'Invoices__table__cell--actions',
                    ],
                    render: (h: CreateElement, invoice: Invoice) => (
                        <Fragment>
                            <Button
                                icon="eye"
                                onClick={(e: Event) => {
                                    e.stopPropagation();

                                    handleShowDetails(invoice);
                                }}
                            />
                            <Button
                                icon="download"
                                to={invoice.url.pdf}
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

        // - Suit la taille du viewport pour adapter l'affichage.
        this.cancelScreenSizeObserver = observeScreenSize(this.handleScreenSizeChange);
    },
    beforeDestroy() {
        this.refreshTableDebounced?.cancel();

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

        async handleShowDetails(invoice: Invoice) {
            await this.openDetails('invoice', invoice.id);
        },

        async handleCreate() {
            if (!this.userCanCreate) {
                return;
            }

            const newInvoice = await this.$modal.show(InvoiceCreateModal);
            if (newInvoice === undefined) {
                return;
            }

            // - On actualise le tableau suite à la création.
            this.refreshTable();

            await this.openDetails('invoice', newInvoice.id);
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
                const data = await apiInvoices.all({
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
                console.error('Error while retrieving invoices:', error);
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
                ? `page.invoices.${key}`
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
            isMobile,
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
                <Page name="invoices" title={__('title')} centered>
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
                <Button type="primary" icon="plus" onClick={handleCreate} collapsible>
                    {__('action')}
                </Button>
            ),
            (hasContent && !isMobile) && (
                <Dropdown>
                    <Button icon="table" onClick={handleConfigureColumns}>
                        {__('global.configure-columns')}
                    </Button>
                </Dropdown>
            ),
        ].filter(isTruthy);

        return (
            <Page
                name="invoices"
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
                <div class="Invoices">
                    <ServerTable
                        ref="table"
                        name={$options.name}
                        class="Invoices__table"
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

export default Invoices;
