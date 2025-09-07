import './index.scss';
import { defineComponent } from 'vue';
import Decimal from 'decimal.js';
import formatAmount from '@/utils/formatAmount';
import { DateTimeReadableFormat } from '@/utils/datetime';
import EmptyMessage from '@/themes/default/components/EmptyMessage';
import { ClientTable } from '@/themes/default/components/Table';
import Button from '@/themes/default/components/Button';
import Fragment from '@/components/Fragment';

import type { CreateElement, PropType } from 'vue';
import type Currency from '@/utils/currency';
import type { Invoice } from '@/stores/api/invoices';
import type { Columns } from '@/themes/default/components/Table/Client';

type Props = {
    /** Liste de factures. */
    invoices: Invoice[],
};

type CurrencyTotal = { currency: Currency, total: Decimal };
type CurrencyTotals = Map<Currency['code'], CurrencyTotal>;

/** Affiche une liste de factures. */
const BeneficiaryViewBillingInvoices = defineComponent({
    name: 'BeneficiaryViewBillingInvoices',
    props: {
        invoices: {
            type: Array as PropType<Props['invoices']>,
            required: true,
        },
    },
    computed: {
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

                    total.total = total.total.add(invoice.total_without_taxes);
                    totals.set(invoice.currency.code, total);

                    return totals;
                },
                new Map(),
            );
        },

        columns(): Columns<Invoice> {
            const { $t: __ } = this;

            return [
                {
                    key: 'date',
                    title: __('date'),
                    class: [
                        'BeneficiaryViewBillingInvoices__col',
                        'BeneficiaryViewBillingInvoices__col--date',
                    ],
                    sortable: (ascending: boolean) => (
                        (a: Invoice, b: Invoice): number => {
                            const result = a.date.compare(b.date);
                            return ascending ? result : -result;
                        }
                    ),
                    render: (h: CreateElement, invoice: Invoice) => (
                        invoice.date.toReadable(DateTimeReadableFormat.LONG)
                    ),
                },
                {
                    key: 'number',
                    title: __('number'),
                    sortable: true,
                    class: [
                        'BeneficiaryViewBillingInvoices__col',
                        'BeneficiaryViewBillingInvoices__col--number',
                    ],
                },
                {
                    key: 'amount',
                    title: __('total-amount'),
                    class: [
                        'BeneficiaryViewBillingInvoices__col',
                        'BeneficiaryViewBillingInvoices__col--amount',
                    ],
                    sortable: (ascending: boolean) => (
                        (a: Invoice, b: Invoice): number => {
                            const result = a.total_without_taxes.cmp(b.total_without_taxes);
                            return ascending ? result : -result;
                        }
                    ),
                    render: (h: CreateElement, invoice: Invoice) => (
                        formatAmount(invoice.total_without_taxes, invoice.currency)
                    ),
                },
                {
                    key: 'actions',
                    class: [
                        'BeneficiaryViewBillingInvoices__col',
                        'BeneficiaryViewBillingInvoices__col--actions',
                    ],
                    render: (h: CreateElement, { url }: Invoice) => (
                        <Button icon="download" to={url} download />
                    ),
                },
            ];
        },
    },
    render() {
        const { $t: __, isEmpty, invoices, columns, totals } = this;

        const renderContent = (): JSX.Element => {
            if (isEmpty) {
                return (
                    <EmptyMessage
                        message={__('page.beneficiary-view.billing.no-invoices')}
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
                />
            );
        };

        return (
            <div class="BeneficiaryViewBillingInvoices">
                <div class="BeneficiaryViewBillingInvoices__header">
                    <h3 class="BeneficiaryViewBillingInvoices__title">
                        {__('page.beneficiary-view.billing.invoices-title')}
                    </h3>
                    {!isEmpty && (
                        <Fragment>
                            <div class="BeneficiaryViewBillingInvoices__count">
                                {__('page.beneficiary-view.billing.invoices-count', { count: invoices.length }, invoices.length)}
                            </div>
                            <div class="BeneficiaryViewBillingInvoices__total">
                                {__('page.beneficiary-view.billing.invoices-total-excl-tax', {
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
                {renderContent()}
            </div>
        );
    },
});

export default BeneficiaryViewBillingInvoices;
