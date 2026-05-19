import './index.scss';
import Decimal from 'decimal.js';
import { defineComponent } from 'vue';
import config from '@/globals/config';
import isTruthy from '@/utils/isTruthy';
import formatAmount from '@/utils/formatAmount';
import { DayReadableFormat } from '@/utils/day';
import { InvoiceStatus } from '@/stores/api/invoices';
import Button from '@/themes/default/components/Button';
import apiBeneficiaries from '@/stores/api/beneficiaries';
import Loading from '@/themes/default/components/Loading';
import { ClientTable } from '@/themes/default/components/Table';
import StatusBadge from '@/themes/default/components/BadgeStatus/Invoice';
import EmptyMessage from '@/themes/default/components/EmptyMessage';
import Fragment from '@/components/Fragment';

// - Modales
import InvoiceDetailsModal from '@/themes/default/modals/InvoiceDetails';
import EstimateDetailsModal from '@/themes/default/modals/EstimateDetails';

import type Currency from '@/utils/currency';
import type { CreateElement, PropType } from 'vue';
import type { Invoice } from '@/stores/api/invoices';
import type { BeneficiaryDetails } from '@/stores/api/beneficiaries';
import type { Columns } from '@/themes/default/components/Table/Client';

type Props = {
    /** Le bénéficiaire dont on veut afficher les factures. */
    beneficiary: BeneficiaryDetails,

    /**
     * Fonction appelée lorsqu'un rechargement complet
     * des données est nécessaire.
     */
    onRefetchNeeded?(): void,
};

type Data = {
    invoices: Invoice[],
    isFetched: boolean,
    hasCriticalError: boolean,
};

type CurrencyTotal = { currency: Currency, total: Decimal };
type CurrencyTotals = Map<Currency['code'], CurrencyTotal>;

/** Affiche une liste de factures. */
const BeneficiaryViewBillingInvoices = defineComponent({
    name: 'BeneficiaryViewBillingInvoices',
    props: {
        beneficiary: {
            type: Object as PropType<Props['beneficiary']>,
            required: true,
        },
        // eslint-disable-next-line vue/no-unused-properties
        onRefetchNeeded: {
            type: Function as PropType<Props['onRefetchNeeded']>,
            default: undefined,
        },
    },
    emits: ['refetchNeeded'],
    data: (): Data => ({
        invoices: [],
        isFetched: false,
        hasCriticalError: false,
    }),
    computed: {
        isTaxesEnabled(): boolean {
            return !config.organization.isVatExempted;
        },

        isEmpty(): boolean {
            return this.invoices.length === 0;
        },

        totals(): CurrencyTotals {
            const { invoices } = this;

            return invoices.reduce(
                (totals: CurrencyTotals, invoice: Invoice): CurrencyTotals => {
                    const total = totals.get(invoice.currency.code) ?? {
                        currency: invoice.currency,
                        total: new Decimal(0),
                    };

                    total.total = (
                        invoice.is_credit_note
                            ? total.total.minus(invoice.total_without_taxes)
                            : total.total.plus(invoice.total_without_taxes)
                    );
                    totals.set(invoice.currency.code, total);

                    return totals;
                },
                new Map(),
            );
        },

        columns(): Columns<Invoice> {
            const { __, isTaxesEnabled, handleShowDetails } = this;

            return [
                {
                    key: 'number',
                    title: __('columns.number'),
                    sortable: true,
                    defaultSortDesc: true,
                    class: [
                        'BeneficiaryViewBillingInvoices__cell',
                        'BeneficiaryViewBillingInvoices__cell--number',
                    ],
                    render: (h: CreateElement, invoice: Invoice) => {
                        if (invoice.number === undefined) {
                            return (
                                <span class="BeneficiaryViewBillingInvoices__cell__empty">
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
                        'BeneficiaryViewBillingInvoices__cell',
                        'BeneficiaryViewBillingInvoices__cell--date',
                    ],
                    defaultSortDesc: true,
                    sortable: (ascending: boolean) => (
                        (a: Invoice, b: Invoice): number => {
                            const direction = ascending ? 1 : -1;

                            if (a.date !== undefined || b.date !== undefined) {
                                if (a.date === undefined || b.date === undefined) {
                                    return (a.date === undefined ? 1 : -1) * direction;
                                }

                                const dateComparison = a.date.compare(b.date) * direction;
                                if (dateComparison !== 0) {
                                    return dateComparison;
                                }
                            }

                            // - Sinon on utilise les identifiants.
                            return (a.id - b.id) * direction;
                        }
                    ),
                    render: (h: CreateElement, invoice: Invoice) => {
                        if (invoice.date === undefined) {
                            return (
                                <span class="BeneficiaryViewBillingInvoices__cell__empty">
                                    {'\u2014'}
                                </span>
                            );
                        }
                        const day = invoice.date.toDay();
                        return day.toReadable(DayReadableFormat.MEDIUM);
                    },
                },
                {
                    key: 'total_without_taxes',
                    title: __('columns.total-without-taxes'),
                    class: [
                        'BeneficiaryViewBillingInvoices__cell',
                        'BeneficiaryViewBillingInvoices__cell--total-without-taxes',
                    ],
                    sortable: (ascending: boolean) => (
                        (a: Invoice, b: Invoice): number => {
                            const aTotal = a.is_credit_note
                                ? a.total_without_taxes.neg()
                                : a.total_without_taxes;

                            const bTotal = a.is_credit_note
                                ? b.total_without_taxes.neg()
                                : b.total_without_taxes;

                            const result = aTotal.cmp(bTotal);
                            return ascending ? result : -result;
                        }
                    ),
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
                        'BeneficiaryViewBillingInvoices__cell',
                        'BeneficiaryViewBillingInvoices__cell--total-with-taxes',
                    ],
                    sortable: (ascending: boolean) => (
                        (a: Invoice, b: Invoice): number => {
                            const aTotal = a.is_credit_note
                                ? a.total_with_taxes.neg()
                                : a.total_with_taxes;

                            const bTotal = a.is_credit_note
                                ? b.total_with_taxes.neg()
                                : b.total_with_taxes;

                            const result = aTotal.cmp(bTotal);
                            return ascending ? result : -result;
                        }
                    ),
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
                        'BeneficiaryViewBillingInvoices__cell',
                        'BeneficiaryViewBillingInvoices__cell--status',
                    ],
                    sortable: (ascending: boolean) => (
                        (a: Invoice, b: Invoice): number => {
                            const direction = ascending ? 1 : -1;

                            // - On tente avec les statuts.
                            const orderedStatuses = [
                                InvoiceStatus.DRAFT,
                                InvoiceStatus.OVERDUE,
                                InvoiceStatus.PENDING,
                                InvoiceStatus.SENT,
                                InvoiceStatus.PARTIALLY_PAID,
                                InvoiceStatus.PAID,
                                InvoiceStatus.OBSOLETE,
                                InvoiceStatus.CANCELLED,
                            ];

                            // - Une facture partiellement payée en retard est traitée
                            //   comme "en retard" pour le tri (prioritaire sur "partiellement payée").
                            const getEffectiveStatus = (invoice: Invoice): InvoiceStatus => (
                                invoice.status === InvoiceStatus.PARTIALLY_PAID && invoice.is_overdue
                                    ? InvoiceStatus.OVERDUE
                                    : invoice.status
                            );
                            const aStatusIndex = orderedStatuses.indexOf(getEffectiveStatus(a));
                            const bStatusIndex = orderedStatuses.indexOf(getEffectiveStatus(b));
                            const statusComparison = (aStatusIndex - bStatusIndex) * direction;
                            if (statusComparison !== 0) {
                                return statusComparison;
                            }

                            // - S'ils sont équivalents on tente avec les dates.
                            if (a.date !== undefined || b.date !== undefined) {
                                if (a.date === undefined || b.date === undefined) {
                                    return (a.date === undefined ? 1 : -1) * direction;
                                }

                                const dateComparison = a.date.compare(b.date) * direction;
                                if (dateComparison !== 0) {
                                    return dateComparison;
                                }
                            }

                            // - Sinon on utilise les identifiants.
                            return (a.id - b.id) * direction;
                        }
                    ),
                    render: (h: CreateElement, invoice: Invoice) => (
                        <StatusBadge invoice={invoice} />
                    ),
                },
                {
                    key: 'actions',
                    class: [
                        'BeneficiaryViewBillingInvoices__cell',
                        'BeneficiaryViewBillingInvoices__cell--actions',
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
        hasCriticalError(hasCriticalError: boolean) {
            if (hasCriticalError) {
                throw new Error('Critical error occurred.');
            }
        },
    },
    mounted() {
        this.fetchData();
    },
    methods: {
        // ------------------------------------------------------
        // -
        // -    Handlers
        // -
        // ------------------------------------------------------

        async handleShowDetails(invoice: Invoice) {
            let shouldRefetch = false;
            let nextOpen = null as { kind: 'estimate' | 'invoice', id: number } | null;

            await this.$modal.show(InvoiceDetailsModal, {
                id: invoice.id,
                onChange: () => { shouldRefetch = true; },
                onRequestOpen: (kind, id): void => {
                    nextOpen = { kind, id };
                },
            });

            while (nextOpen !== null) {
                const current = nextOpen;
                nextOpen = null;

                /* eslint-disable @typescript-eslint/no-loop-func, no-await-in-loop */
                if (current.kind === 'estimate') {
                    await this.$modal.show(EstimateDetailsModal, {
                        id: current.id,
                        onChange: () => { shouldRefetch = true; },
                        onRequestOpen: (kind, id): void => {
                            nextOpen = { kind, id };
                        },
                    });
                } else {
                    await this.$modal.show(InvoiceDetailsModal, {
                        id: current.id,
                        onChange: () => { shouldRefetch = true; },
                        onRequestOpen: (kind, id): void => {
                            nextOpen = { kind, id };
                        },
                    });
                }
                /* eslint-enable @typescript-eslint/no-loop-func, no-await-in-loop */
            }

            if (shouldRefetch) {
                this.fetchData();
                this.$emit('refetchNeeded');
            }
        },

        // ------------------------------------------------------
        // -
        // -    Méthodes internes
        // -
        // ------------------------------------------------------

        async fetchData() {
            const { beneficiary } = this;

            try {
                this.invoices = await apiBeneficiaries.invoices(beneficiary.id);
                this.isFetched = true;
            } catch {
                this.hasCriticalError = true;
            }
        },

        __(key: string, params?: Record<string, number | string>, count?: number): string {
            if (!key.startsWith('global.')) {
                if (!key.startsWith('page.')) {
                    key = `page.billing.invoices.${key}`;
                }
                key = key.replace(/^page\./, 'page.beneficiary-view.');
            } else {
                key = key.replace(/^global\./, '');
            }
            return this.$t(key, params, count);
        },

        // ------------------------------------------------------
        // -
        // -    API Publique
        // -
        // ------------------------------------------------------

        /**
         * Permet d'actualiser les données.
         */
        async refresh() {
            await this.fetchData();
        },
    },
    render() {
        const {
            __,
            isFetched,
            isEmpty,
            invoices,
            columns,
            totals,
            handleShowDetails,
        } = this;

        const renderContent = (): JSX.Element => {
            if (!isFetched) {
                return <Loading />;
            }

            if (isEmpty) {
                return (
                    <EmptyMessage
                        message={__('empty')}
                        size="small"
                    />
                );
            }

            return (
                <ClientTable
                    columns={columns}
                    data={invoices}
                    defaultOrderBy={{
                        column: 'date',
                        ascending: false,
                    }}
                    onRowClick={handleShowDetails}
                    sticky
                />
            );
        };

        const className = ['BeneficiaryViewBillingInvoices', {
            'BeneficiaryViewBillingInvoices--loading': !isFetched,
            'BeneficiaryViewBillingInvoices--empty': isEmpty,
        }];

        return (
            <div class={className}>
                <div class="BeneficiaryViewBillingInvoices__header">
                    <h3 class="BeneficiaryViewBillingInvoices__header__title">
                        {__('title')}
                    </h3>
                    {(isFetched && !isEmpty) && (
                        <Fragment>
                            <div class="BeneficiaryViewBillingInvoices__header__count">
                                {__('count', { count: invoices.length }, invoices.length)}
                            </div>
                            <div class="BeneficiaryViewBillingInvoices__header__total">
                                {__('global.total-without-taxes-value', {
                                    amount: ((): string => {
                                        if (totals.size === 0) {
                                            return formatAmount(0);
                                        }

                                        return [...totals.values()]
                                            .map(({ currency, total }: CurrencyTotal) => (
                                                formatAmount(total, currency)
                                            ))
                                            .join(' + ');
                                    })(),
                                })}
                            </div>
                        </Fragment>
                    )}
                </div>
                <div class="BeneficiaryViewBillingInvoices__body">
                    {renderContent()}
                </div>
            </div>
        );
    },
});

export default BeneficiaryViewBillingInvoices;
