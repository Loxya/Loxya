import './index.scss';
import { defineComponent } from 'vue';
import { Group } from '@/stores/api/groups';
import formatAmount from '@/utils/formatAmount';
import Icon from '@/themes/default/components/Icon';
import Button from '@/themes/default/components/Button';
import StatusBadge from '@/themes/default/components/BadgeStatus/Estimate';

// - Modales
import InvoiceDetailsModal from '@/themes/default/modals/InvoiceDetails';
import EstimateDetailsModal from '@/themes/default/modals/EstimateDetails';

import type { PropType } from 'vue';
import type { Estimate, EstimateDetails } from '@/stores/api/estimates';

type Props = {
    /** Le devis à afficher. */
    estimate: Estimate,

    /**
     * Fonction appelée lorsque le devis a été supprimé.
     *
     * @param id - L'identifiant du devis supprimé.
     */
    onDeleted?(id: Estimate['id']): void,

    /**
     * Fonction appelée lorsque le devis a été mis à jour.
     *
     * @param estimate - Le devis mis à jour.
     */
    onUpdated?(estimate: EstimateDetails): void,

    /**
     * Fonction appelée lorsqu'un rechargement complet
     * des données est nécessaire.
     */
    onRefetchNeeded?(): void,
};

type Data = {
    isDeleting: boolean,
};

/** Un devis d'événement dans l'onglet des devis. */
const EventDetailsEstimate = defineComponent({
    name: 'EventDetailsEstimate',
    props: {
        estimate: {
            type: Object as PropType<Props['estimate']>,
            required: true,
        },
        // eslint-disable-next-line vue/no-unused-properties
        onDeleted: {
            type: Function as PropType<Props['onDeleted']>,
            default: undefined,
        },
        // eslint-disable-next-line vue/no-unused-properties
        onUpdated: {
            type: Function as PropType<Props['onUpdated']>,
            default: undefined,
        },
        // eslint-disable-next-line vue/no-unused-properties
        onRefetchNeeded: {
            type: Function as PropType<Props['onRefetchNeeded']>,
            default: undefined,
        },
    },
    emits: ['deleted', 'updated', 'refetchNeeded'],
    data: (): Data => ({
        isDeleting: false,
    }),
    computed: {
        hasTaxes(): boolean {
            return (
                this.estimate.global_tax_regime === null &&
                (this.estimate.total_taxes ?? []).length > 0
            );
        },

        isTeamMember(): boolean {
            return this.$store.getters['auth/is']([
                Group.ADMINISTRATION,
                Group.SUPERVISION,
                Group.OPERATION,
            ]);
        },
    },
    methods: {
        // ------------------------------------------------------
        // -
        // -    Handlers
        // -
        // ------------------------------------------------------

        async handleShowDetails() {
            const { estimate: { id }, isTeamMember } = this;

            let isDeleted: boolean = false;
            let shouldRefetch: boolean = false;
            let updatedEstimate: Estimate | null = null;
            let nextOpen = null as { kind: 'estimate' | 'invoice', id: number } | null;

            await this.$modal.show(EstimateDetailsModal, {
                id,
                onUpdated: (updated: EstimateDetails) => {
                    updatedEstimate = updated;
                },
                onDeleted: () => { isDeleted = true; },
                onInvoiceCreated: () => { shouldRefetch = true; },
                onRequestOpen: isTeamMember
                    ? (kind, _id): void => { nextOpen = { kind, id: _id }; }
                    : undefined,
            });

            while (nextOpen !== null) {
                const current = nextOpen;
                nextOpen = null;

                /* eslint-disable @typescript-eslint/no-loop-func, no-await-in-loop */
                if (current.kind === 'estimate') {
                    await this.$modal.show(EstimateDetailsModal, {
                        id: current.id,
                        onChange: () => { shouldRefetch = true; },
                        onRequestOpen: (kind, _id) => {
                            nextOpen = { kind, id: _id };
                        },
                    });
                } else {
                    await this.$modal.show(InvoiceDetailsModal, {
                        id: current.id,
                        onChange: () => { shouldRefetch = true; },
                        onRequestOpen: (kind, _id) => {
                            nextOpen = { kind, id: _id };
                        },
                    });
                }
                /* eslint-enable @typescript-eslint/no-loop-func, no-await-in-loop */
            }

            if (shouldRefetch) {
                this.$emit('refetchNeeded');
            } else if (isDeleted) {
                this.isDeleting = true;
                this.$emit('deleted', id);
            } else if (updatedEstimate !== null) {
                this.$emit('updated', updatedEstimate);
            }
        },

        // ------------------------------------------------------
        // -
        // -    Méthodes internes
        // -
        // ------------------------------------------------------

        __(key: string, params?: Record<string, number | string>, count?: number): string {
            key = !key.startsWith('global.')
                ? `modal.event-details.estimates.item.${key}`
                : key.replace(/^global\./, '');

            return this.$t(key, params, count);
        },
    },
    render() {
        const {
            __,
            estimate,
            hasTaxes,
            isDeleting,
            handleShowDetails,
        } = this;
        const {
            url,
            date,
            currency,
            total_without_taxes: totalWithoutTaxes,
            created_at: createdAt,
        } = estimate;

        return (
            <div class="EventDetailsEstimate">
                <Icon name="file-signature" class="EventDetailsEstimate__icon" />
                <div class="EventDetailsEstimate__heading">
                    <span class="EventDetailsEstimate__heading__name">
                        {((): string => {
                            if (!('number' in estimate) || estimate.number === undefined) {
                                const displayDate = date ?? createdAt;
                                return __('title.without-number', {
                                    date: displayDate.format('L'),
                                    hour: displayDate.format('HH:mm'),
                                });
                            }
                            return __('title.with-number', { number: estimate.number });
                        })()}
                    </span>
                    <span class="EventDetailsEstimate__heading__total">
                        {formatAmount(totalWithoutTaxes, currency)}
                        {hasTaxes && ` ${__('global.excl-tax')}`}
                    </span>
                </div>
                <div class="EventDetailsEstimate__date">
                    {date !== undefined ? date.format('L') : (
                        <span class="EventDetailsEstimate__date__empty">
                            {'\u2014'}
                        </span>
                    )}
                </div>
                <div class="EventDetailsEstimate__status">
                    <StatusBadge estimate={estimate} />
                </div>
                <div class="EventDetailsEstimate__actions">
                    <Button
                        icon="download"
                        disabled={isDeleting}
                        to={url}
                        download
                    />
                    <Button
                        icon="eye"
                        type="primary"
                        onClick={handleShowDetails}
                        disabled={isDeleting}
                    />
                </div>
            </div>
        );
    },
});

export default EventDetailsEstimate;
