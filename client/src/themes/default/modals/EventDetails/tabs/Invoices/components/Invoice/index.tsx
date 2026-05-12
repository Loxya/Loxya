import './index.scss';
import { defineComponent } from 'vue';
import InvoiceType from '@/utils/invoicing/invoice-type';
import { Group } from '@/stores/api/groups';
import formatAmount from '@/utils/formatAmount';
import Icon from '@/themes/default/components/Icon';
import Button from '@/themes/default/components/Button';
import StatusBadge from '@/themes/default/components/BadgeStatus/Invoice';

// - Modales
import InvoiceDetailsModal from '@/themes/default/modals/InvoiceDetails';
import EstimateDetailsModal from '@/themes/default/modals/EstimateDetails';

import type { PropType } from 'vue';
import type { Invoice, InvoiceDetails } from '@/stores/api/invoices';

type Props = {
    /** La facture à afficher. */
    invoice: Invoice,

    /**
     * Fonction appelée lorsque la facture a été supprimée.
     *
     * @param id - L'identifiant de la facture supprimée.
     */
    onDeleted?(id: Invoice['id']): void,

    /**
     * Fonction appelée lorsque la facture a été mise à jour.
     *
     * @param invoice - La facture mise à jour.
     */
    onUpdated?(invoice: InvoiceDetails): void,

    /**
     * Fonction appelée lorsqu'un rechargement complet
     * des données est nécessaire.
     */
    onRefetchNeeded?(): void,
};

type Data = {
    isDeleting: boolean,
};

/** Une facture d'événement dans l'onglet des factures. */
const EventDetailsInvoice = defineComponent({
    name: 'EventDetailsInvoice',
    props: {
        invoice: {
            type: Object as PropType<Required<Props>['invoice']>,
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
        type(): InvoiceType {
            if (this.invoice.is_prepayment) {
                return this.invoice.is_credit_note
                    ? InvoiceType.PREPAYMENT_CREDIT_NOTE
                    : InvoiceType.PREPAYMENT_INVOICE;
            }
            if (this.invoice.is_credit_note) {
                return InvoiceType.CREDIT_NOTE;
            }
            return InvoiceType.INVOICE;
        },

        hasTaxes(): boolean {
            return (
                this.invoice.global_tax_regime === null &&
                (this.invoice.total_taxes ?? []).length > 0
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
            const { invoice: { id }, isTeamMember } = this;

            let isDeleted: boolean = false;
            let shouldRefetch: boolean = false;
            let updatedInvoice: InvoiceDetails | null = null;
            let nextOpen = null as { kind: 'estimate' | 'invoice', id: number } | null;

            await this.$modal.show(InvoiceDetailsModal, {
                id,
                onUpdated: (updated: InvoiceDetails) => {
                    updatedInvoice = updated;
                },
                onDeleted: () => { isDeleted = true; },
                onCreditNoteCreated: () => { shouldRefetch = true; },
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
            } else if (updatedInvoice !== null) {
                this.$emit('updated', updatedInvoice);
            }
        },

        // ------------------------------------------------------
        // -
        // -    Méthodes internes
        // -
        // ------------------------------------------------------

        __(key: string, params?: Record<string, number | string>, count?: number): string {
            key = !key.startsWith('global.')
                ? `modal.event-details.invoices.item.${key}`
                : key.replace(/^global\./, '');

            return this.$t(key, params, count);
        },
    },
    render() {
        const {
            __,
            invoice,
            type,
            hasTaxes,
            isDeleting,
            handleShowDetails,
        } = this;
        const {
            url,
            date,
            number,
            currency,
            is_credit_note: isCreditNote,
            total_without_taxes: totalWithoutTaxes,
            created_at: createdAt,
        } = invoice;

        return (
            <div class="EventDetailsInvoice">
                <Icon
                    name={(() => {
                        switch (type) {
                            case InvoiceType.PREPAYMENT_CREDIT_NOTE:
                            case InvoiceType.CREDIT_NOTE: {
                                return 'file-alt';
                            }
                            case InvoiceType.PREPAYMENT_INVOICE: {
                                return 'file-invoice-dollar';
                            }
                            default: {
                                return 'file-invoice';
                            }
                        }
                    })()}
                    class="EventDetailsInvoice__icon"
                />
                <div class="EventDetailsInvoice__heading">
                    <span class="EventDetailsInvoice__heading__name">
                        {(
                            number !== undefined
                                ? __(`title.${type}`, { number })
                                : __(`title.draft.${type}`, {
                                    date: createdAt.format('L'),
                                    hour: createdAt.format('HH:mm'),
                                })
                        )}
                    </span>
                    <span class="EventDetailsInvoice__heading__total">
                        {(
                            isCreditNote
                                ? formatAmount(totalWithoutTaxes.neg(), currency)
                                : formatAmount(totalWithoutTaxes, currency)
                        )}
                        {hasTaxes && ` ${__('global.excl-tax')}`}
                    </span>
                </div>
                <div class="EventDetailsInvoice__date">
                    {date !== undefined ? date.format('L') : (
                        <span class="EventDetailsInvoice__date__empty">
                            {'\u2014'}
                        </span>
                    )}
                </div>
                <div class="EventDetailsInvoice__status">
                    <StatusBadge invoice={invoice} />
                </div>
                <div class="EventDetailsInvoice__actions">
                    <Button
                        icon="download"
                        disabled={isDeleting}
                        to={url.pdf}
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

export default EventDetailsInvoice;
