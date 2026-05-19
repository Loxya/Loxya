import './index.scss';
import { defineComponent } from 'vue';
import config from '@/globals/config';
import isTruthy from '@/utils/isTruthy';
import formatAmount from '@/utils/formatAmount';
import { DayReadableFormat } from '@/utils/day';
import { EstimateStatus } from '@/stores/api/estimates';
import apiBeneficiaries from '@/stores/api/beneficiaries';
import Fragment from '@/components/Fragment';
import Button from '@/themes/default/components/Button';
import Loading from '@/themes/default/components/Loading';
import { ClientTable } from '@/themes/default/components/Table';
import EmptyMessage from '@/themes/default/components/EmptyMessage';
import StatusBadge from '@/themes/default/components/BadgeStatus/Estimate';

// - Modales
import InvoiceDetailsModal from '@/themes/default/modals/InvoiceDetails';
import EstimateDetailsModal from '@/themes/default/modals/EstimateDetails';

import type { PropType, CreateElement } from 'vue';
import type { Estimate } from '@/stores/api/estimates';
import type { BeneficiaryDetails } from '@/stores/api/beneficiaries';
import type { Columns } from '@/themes/default/components/Table/Client';

type Props = {
    /** Le bénéficiaire dont on veut afficher les devis. */
    beneficiary: BeneficiaryDetails,

    /**
     * Fonction appelée lorsqu'un rechargement complet
     * des données est nécessaire.
     */
    onRefetchNeeded?(): void,
};

type Data = {
    estimates: Estimate[],
    isFetched: boolean,
    hasCriticalError: boolean,
};

/** Affiche une liste de devis. */
const BeneficiaryViewBillingEstimates = defineComponent({
    name: 'BeneficiaryViewBillingEstimates',
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
        estimates: [],
        isFetched: false,
        hasCriticalError: false,
    }),
    computed: {
        isTaxesEnabled(): boolean {
            return !config.organization.isVatExempted;
        },

        isEmpty(): boolean {
            return this.estimates.length === 0;
        },

        columns(): Columns<Estimate> {
            const { __, isTaxesEnabled, handleShowDetails } = this;

            return [
                {
                    key: 'number',
                    title: __('columns.number'),
                    class: [
                        'BeneficiaryViewBillingEstimates__cell',
                        'BeneficiaryViewBillingEstimates__cell--number',
                    ],
                    hideable: false,
                    sortable: true,
                    defaultSortDesc: true,
                    render: (h: CreateElement, estimate: Estimate) => {
                        if (!('number' in estimate) || estimate.number === undefined) {
                            return (
                                <span class="BeneficiaryViewBillingEstimates__cell__empty">
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
                        'BeneficiaryViewBillingEstimates__cell',
                        'BeneficiaryViewBillingEstimates__cell--issue-date',
                    ],
                    defaultSortDesc: true,
                    sortable: (ascending: boolean) => (
                        (a: Estimate, b: Estimate): number => {
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
                    render: (h: CreateElement, estimate: Estimate) => {
                        if (estimate.date === undefined) {
                            return (
                                <span class="BeneficiaryViewBillingEstimates__cell__empty">
                                    {'\u2014'}
                                </span>
                            );
                        }
                        const day = estimate.date.toDay();
                        return day.toReadable(DayReadableFormat.MEDIUM);
                    },
                },
                {
                    key: 'total_without_taxes',
                    title: __('columns.total-without-taxes'),
                    class: [
                        'BeneficiaryViewBillingEstimates__cell',
                        'BeneficiaryViewBillingEstimates__cell--total-without-taxes',
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
                isTaxesEnabled && {
                    key: 'total_with_taxes',
                    title: __('columns.total-with-taxes'),
                    class: [
                        'BeneficiaryViewBillingEstimates__cell',
                        'BeneficiaryViewBillingEstimates__cell--total-with-taxes',
                    ],
                    sortable: (ascending: boolean) => (
                        (a: Estimate, b: Estimate): number => {
                            const result = a.total_with_taxes.cmp(b.total_with_taxes);
                            return ascending ? result : -result;
                        }
                    ),
                    render: (h: CreateElement, estimate: Estimate) => (
                        formatAmount(estimate.total_with_taxes, estimate.currency)
                    ),
                },
                {
                    key: 'status',
                    title: __('columns.status'),
                    class: [
                        'BeneficiaryViewBillingEstimates__cell',
                        'BeneficiaryViewBillingEstimates__cell--status',
                    ],
                    sortable: (ascending: boolean) => (
                        (a: Estimate, b: Estimate): number => {
                            const direction = ascending ? 1 : -1;

                            // - On tente avec les statuts.
                            const orderedStatuses = [
                                EstimateStatus.DRAFT,
                                EstimateStatus.PENDING,
                                EstimateStatus.SENT,
                                EstimateStatus.ACCEPTED,
                                EstimateStatus.PARTIALLY_INVOICED,
                                EstimateStatus.INVOICED,
                                EstimateStatus.OBSOLETE,
                                EstimateStatus.EXPIRED,
                                EstimateStatus.REJECTED,
                            ];
                            const aStatusIndex = orderedStatuses.indexOf(a.status);
                            const bStatusIndex = orderedStatuses.indexOf(b.status);
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
                    render: (h: CreateElement, estimate: Estimate) => (
                        <StatusBadge estimate={estimate} />
                    ),
                },
                {
                    key: 'actions',
                    class: [
                        'BeneficiaryViewBillingEstimates__cell',
                        'BeneficiaryViewBillingEstimates__cell--actions',
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

        async handleShowDetails(estimate: Estimate) {
            let shouldRefetch = false;
            let nextOpen = null as { kind: 'estimate' | 'invoice', id: number } | null;

            await this.$modal.show(EstimateDetailsModal, {
                id: estimate.id,
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
                this.estimates = await apiBeneficiaries.estimates(beneficiary.id);
                this.isFetched = true;
            } catch {
                this.hasCriticalError = true;
            }
        },

        __(key: string, params?: Record<string, number | string>, count?: number): string {
            if (!key.startsWith('global.')) {
                if (!key.startsWith('page.')) {
                    key = `page.billing.estimates.${key}`;
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
            estimates,
            columns,
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
                    data={estimates}
                    defaultOrderBy={{
                        column: 'date',
                        ascending: false,
                    }}
                    onRowClick={handleShowDetails}
                    sticky
                />
            );
        };

        const className = ['BeneficiaryViewBillingEstimates', {
            'BeneficiaryViewBillingEstimates--loading': !isFetched,
            'BeneficiaryViewBillingEstimates--empty': isEmpty,
        }];

        return (
            <div class={className}>
                <div class="BeneficiaryViewBillingEstimates__header">
                    <h3 class="BeneficiaryViewBillingEstimates__header__title">
                        {__('title')}
                    </h3>
                    {(isFetched && !isEmpty) && (
                        <div class="BeneficiaryViewBillingEstimates__header__count">
                            {__('count', { count: estimates.length }, estimates.length)}
                        </div>
                    )}
                </div>
                <div class="BeneficiaryViewBillingEstimates__body">
                    {renderContent()}
                </div>
            </div>
        );
    },
});

export default BeneficiaryViewBillingEstimates;
