import './index.scss';
import { defineComponent } from 'vue';
import formatAmount from '@/utils/formatAmount';
import { DateTimeReadableFormat } from '@/utils/datetime';
import EmptyMessage from '@/themes/default/components/EmptyMessage';
import { ClientTable } from '@/themes/default/components/Table';
import Button from '@/themes/default/components/Button';

import type { PropType, CreateElement } from 'vue';
import type { Estimate } from '@/stores/api/estimates';
import type { Columns } from '@/themes/default/components/Table/Client';

type Props = {
    /** Liste de devis. */
    estimates: Estimate[],
};

/** Affiche une liste de devis. */
const BeneficiaryViewBillingEstimates = defineComponent({
    name: 'BeneficiaryViewBillingEstimates',
    props: {
        estimates: {
            type: Array as PropType<Props['estimates']>,
            required: true,
        },
    },
    computed: {
        isEmpty(): boolean {
            return this.estimates.length === 0;
        },

        columns(): Columns<Estimate> {
            const { $t: __ } = this;

            return [
                {
                    key: 'date',
                    title: __('date'),
                    class: [
                        'BeneficiaryViewBillingEstimates__col',
                        'BeneficiaryViewBillingEstimates__col--date',
                    ],
                    sortable: (ascending: boolean) => (
                        (a: Estimate, b: Estimate): number => {
                            const result = a.date.compare(b.date);
                            return ascending ? result : -result;
                        }
                    ),
                    render: (h: CreateElement, estimate: Estimate) => (
                        estimate.date.toReadable(DateTimeReadableFormat.LONG)
                    ),
                },
                {
                    key: 'amount',
                    title: __('total-amount'),
                    class: [
                        'BeneficiaryViewBillingEstimates__col',
                        'BeneficiaryViewBillingEstimates__col--amount',
                    ],
                    sortable: (ascending: boolean) => (
                        (a: Estimate, b: Estimate): number => {
                            const result = a.total_without_taxes.cmp(b.total_without_taxes);
                            return ascending ? result : -result;
                        }
                    ),
                    render: (h: CreateElement, estimate: Estimate) => (
                        formatAmount(estimate.total_without_taxes, estimate.currency)
                    ),
                },
                {
                    key: 'actions',
                    class: [
                        'BeneficiaryViewBillingEstimates__col',
                        'BeneficiaryViewBillingEstimates__col--actions',
                    ],
                    render: (h: CreateElement, { url }: Estimate) => (
                        <Button icon="download" to={url} download />
                    ),
                },
            ];
        },
    },
    render() {
        const { $t: __, isEmpty, estimates, columns } = this;

        const renderContent = (): JSX.Element => {
            if (isEmpty) {
                return (
                    <EmptyMessage
                        message={__('page.beneficiary-view.billing.no-estimates')}
                        size="small"
                    />
                );
            }

            return (
                <ClientTable
                    columns={columns}
                    data={estimates}
                    defaultOrderBy={{
                        column: 'date',
                        ascending: false,
                    }}
                />
            );
        };

        return (
            <div class="BeneficiaryViewBillingEstimates">
                <div class="BeneficiaryViewBillingEstimates__header">
                    <h3 class="BeneficiaryViewBillingEstimates__title">
                        {__('page.beneficiary-view.billing.estimates-title')}
                    </h3>
                    {!isEmpty && (
                        <div class="BeneficiaryViewBillingEstimates__count">
                            {__(
                                'page.beneficiary-view.billing.estimates-count',
                                { count: estimates.length },
                                estimates.length,
                            )}
                        </div>
                    )}
                </div>
                {renderContent()}
            </div>
        );
    },
});

export default BeneficiaryViewBillingEstimates;
