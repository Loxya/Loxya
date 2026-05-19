import './index.scss';
import invariant from 'invariant';
import { defineComponent } from 'vue';
import { Group } from '@/stores/api/groups';
import Fragment from '@/components/Fragment';
import Icon from '@/themes/default/components/Icon';
import Button from '@/themes/default/components/Button';
import Alert from '@/themes/default/components/Alert';
import Invoice from './components/Invoice';

// - Modales
import CreateInvoiceModal from './modals/CreateInvoiceModal';
import InvoiceDetailsModal from '@/themes/default/modals/InvoiceDetails';
import EstimateDetailsModal from '@/themes/default/modals/EstimateDetails';

import type { PropType } from 'vue';
import type { Location } from 'vue-router';
import type { Beneficiary } from '@/stores/api/beneficiaries';
import type { Invoice as InvoiceType, InvoiceDetails } from '@/stores/api/invoices';
import type { EventDetails } from '@/stores/api/events';

type Props = {
    /** L'événement dont on souhaite gérer les factures. */
    event: EventDetails<true>,

    /**
     * Fonction appelée lorsqu'une facture a été créée.
     *
     * @param invoice - La facture nouvellement créé.
     */
    onCreated?(invoice: InvoiceDetails): void,

    /**
     * Fonction appelée lorsqu'une facture a été mise à jour.
     *
     * @param invoice - La facture mise à jour.
     */
    onUpdated?(invoice: InvoiceDetails): void,

    /**
     * Fonction appelée lorsqu'une facture a été supprimée.
     *
     * @param id - Identifiant de la facture supprimée.
     */
    onDeleted?(id: InvoiceType['id']): void,

    /**
     * Fonction appelée lorsqu'un rechargement complet
     * des données est nécessaire.
     */
    onRefetchNeeded?(): void,
};

/** L'onglet "Factures" de la modale de détails d'un événement. */
const EventDetailsInvoices = defineComponent({
    name: 'EventDetailsInvoices',
    props: {
        event: {
            type: Object as PropType<Props['event']>,
            required: true,
            validator: (event: EventDetails) => (
                event.is_billable &&
                event.materials.length > 0
            ),
        },
        // eslint-disable-next-line vue/no-unused-properties
        onCreated: {
            type: Function as PropType<Props['onCreated']>,
            default: undefined,
        },
        // eslint-disable-next-line vue/no-unused-properties
        onUpdated: {
            type: Function as PropType<Props['onUpdated']>,
            default: undefined,
        },
        // eslint-disable-next-line vue/no-unused-properties
        onDeleted: {
            type: Function as PropType<Props['onDeleted']>,
            default: undefined,
        },
        // eslint-disable-next-line vue/no-unused-properties
        onRefetchNeeded: {
            type: Function as PropType<Props['onRefetchNeeded']>,
            default: undefined,
        },
    },
    emits: [
        'created',
        'updated',
        'deleted',
        'refetchNeeded',
    ],
    computed: {
        isBillable(): boolean {
            return (
                this.event.is_billable &&
                this.event.materials.length > 0
            );
        },

        invoices(): InvoiceType[] {
            return this.event.invoices ?? [];
        },

        hasInvoice(): boolean {
            return this.invoices.length > 0;
        },

        mainBeneficiary(): Beneficiary | null {
            return [...this.event.beneficiaries].shift() ?? null;
        },

        hasBilledMaterials(): boolean {
            const { materials } = this.event;
            return materials.some((material) => (
                !material.unit_price.isZero() ||
                !material.total_without_taxes.isZero() ||
                !(material.material.is_hidden_on_bill ?? false)
            ));
        },

        hasBilledLines(): boolean {
            const { extras } = this.event;
            return this.hasBilledMaterials || extras.length > 0;
        },

        isCreationAvailable(): boolean {
            return (
                this.mainBeneficiary !== null &&
                this.mainBeneficiary.is_invoiceable &&
                this.hasBilledLines
            );
        },

        userCanCreate(): boolean {
            return this.$store.getters['auth/is']([
                Group.ADMINISTRATION,
                Group.SUPERVISION,
                Group.OPERATION,
            ]);
        },
    },
    created() {
        invariant(
            this.isBillable,
            `A non billable event has been passed to <EventDetailsInvoices />`,
        );
    },
    methods: {
        // ------------------------------------------------------
        // -
        // -    Handlers
        // -
        // ------------------------------------------------------

        async handleCreate() {
            const invoice = await this.$modal.show(CreateInvoiceModal, {
                event: this.event,
            });
            if (invoice === undefined) {
                return;
            }
            this.$emit('created', invoice);

            let isDeleted: boolean = false;
            let shouldRefetch: boolean = false;
            let updatedInvoice: InvoiceDetails | null = null;
            let nextOpen = null as { kind: 'estimate' | 'invoice', id: number } | null;

            await this.$modal.show(InvoiceDetailsModal, {
                id: invoice.id,
                onUpdated: (updated: InvoiceDetails) => {
                    updatedInvoice = updated;
                },
                onDeleted: () => { isDeleted = true; },
                onCreditNoteCreated: () => { shouldRefetch = true; },
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
                this.$emit('refetchNeeded');
            } else if (isDeleted) {
                this.$emit('deleted', invoice.id);
            } else if (updatedInvoice !== null) {
                this.$emit('updated', updatedInvoice);
            }
        },

        handleUpdated(invoice: InvoiceType) {
            this.$emit('updated', invoice);
        },

        handleDeleted(id: InvoiceType['id']) {
            this.$emit('deleted', id);
        },

        handleRefetchNeeded() {
            this.$emit('refetchNeeded');
        },

        // ------------------------------------------------------
        // -
        // -    Méthodes internes
        // -
        // ------------------------------------------------------

        __(key: string, params?: Record<string, number | string>, count?: number): string {
            key = !key.startsWith('global.')
                ? `modal.event-details.invoices.${key}`
                : key.replace(/^global\./, '');

            return this.$t(key, params, count);
        },
    },
    render() {
        const {
            __,
            event,
            invoices,
            isBillable,
            hasInvoice,
            hasBilledLines,
            isCreationAvailable,
            mainBeneficiary,
            userCanCreate,
            handleCreate,
            handleUpdated,
            handleDeleted,
            handleRefetchNeeded,
        } = this;

        if (!isBillable) {
            return null;
        }

        const renderWarningIfAny = (): JSX.Element | null => {
            if (!userCanCreate) {
                return null;
            }

            // - S'il n'y a pas de lignes de facture...
            if (!hasBilledLines) {
                return (
                    <Alert
                        type="warning"
                        action={{
                            label: __('warnings.empty.action'),
                            target: {
                                name: 'edit-event',
                                params: { id: event.id.toString() },
                            },
                        }}
                        class="EventDetailsInvoices__warning"
                    >
                        {__('warnings.empty.message')}
                    </Alert>
                );
            }

            // - Si le bénéficiaire n'est pas complet...
            if (mainBeneficiary !== null && !mainBeneficiary.is_invoiceable) {
                const beneficiaryName = mainBeneficiary.company !== null
                    ? mainBeneficiary.company.legal_name
                    : mainBeneficiary.full_name;

                const beneficiaryLocation: Location = mainBeneficiary.company !== null
                    ? { name: 'edit-company', params: { id: mainBeneficiary.company.id.toString() } }
                    : { name: 'edit-beneficiary', params: { id: mainBeneficiary.id.toString() } };

                const messageKey = hasInvoice
                    ? 'warnings.beneficiary-not-invoiceable.message.with-invoices'
                    : 'warnings.beneficiary-not-invoiceable.message.without-invoices';

                return (
                    <Alert
                        type="warning"
                        action={{
                            label: __('warnings.beneficiary-not-invoiceable.action'),
                            target: beneficiaryLocation,
                        }}
                        class="EventDetailsInvoices__warning"
                    >
                        {__(messageKey, { name: beneficiaryName })}
                    </Alert>
                );
            }

            return null;
        };

        const renderContent = (): JSX.Element => {
            if (!hasInvoice) {
                if (mainBeneficiary === null) {
                    return (
                        <div class="EventDetailsInvoices__not-billable">
                            <h3 class="EventDetailsInvoices__not-billable__title">
                                <Icon name="exclamation-triangle" /> {__('global.missing-beneficiary')}
                            </h3>
                            <p class="EventDetailsInvoices__not-billable__text">
                                {__('no-beneficiary-billable-help')}
                            </p>
                        </div>
                    );
                }

                return (
                    <Fragment>
                        {renderWarningIfAny()}
                        <div class="EventDetailsInvoices__no-invoice">
                            <p class="EventDetailsInvoices__no-invoice__text">
                                {__('no-invoice-help')}
                            </p>
                            {isCreationAvailable && (
                                <Fragment>
                                    <p class="EventDetailsInvoices__no-invoice__text">
                                        {
                                            userCanCreate
                                                ? __('actions.create.help')
                                                : __('contact-someone-to-create-invoice')
                                        }
                                    </p>
                                    {userCanCreate && (
                                        <Button type="add" onClick={handleCreate}>
                                            {__('actions.create.label')}
                                        </Button>
                                    )}
                                </Fragment>
                            )}
                        </div>
                    </Fragment>
                );
            }

            return (
                <Fragment>
                    {renderWarningIfAny()}
                    <ul class="EventDetailsInvoices__list">
                        {invoices.map((invoiceItem: InvoiceType) => (
                            <li key={invoiceItem.id} class="EventDetailsInvoices__list__item">
                                <Invoice
                                    invoice={invoiceItem}
                                    onUpdated={handleUpdated}
                                    onDeleted={handleDeleted}
                                    onRefetchNeeded={handleRefetchNeeded}
                                />
                            </li>
                        ))}
                    </ul>
                    {(isCreationAvailable && userCanCreate) && (
                        <div class="EventDetailsInvoices__create-new">
                            <p class="EventDetailsInvoices__create-new__text">
                                {__('actions.create-new.help')}
                            </p>
                            <Button
                                type="add"
                                class="EventDetailsInvoices__create-new__button"
                                onClick={handleCreate}
                            >
                                {__('actions.create-new.label')}
                            </Button>
                        </div>
                    )}
                </Fragment>
            );
        };

        return (
            <section class="EventDetailsInvoices">
                {renderContent()}
            </section>
        );
    },
});

export default EventDetailsInvoices;
