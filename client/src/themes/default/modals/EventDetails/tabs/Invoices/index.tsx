import './index.scss';
import invariant from 'invariant';
import { confirm } from '@/utils/alert';
import { defineComponent } from 'vue';
import apiEvents from '@/stores/api/events';
import { Group } from '@/stores/api/groups';
import Fragment from '@/components/Fragment';
import Icon from '@/themes/default/components/Icon';
import Button from '@/themes/default/components/Button';
import Link from '@/themes/default/components/Link';
import Invoice, { InvoiceLayout } from './components/Invoice';

import type { PropType } from 'vue';
import type { EventDetails } from '@/stores/api/events';
import type { Invoice as InvoiceType } from '@/stores/api/invoices';

type Props = {
    /** L'événement dont on souhaite gérer les factures. */
    event: EventDetails<true>,

    /**
     * Fonction appelée lorsqu'une facture a été créée.
     *
     * @param invoice - La facture nouvellement créé.
     */
    onCreated?(invoice: InvoiceType): void,
};

type Data = {
    isCreating: boolean,
};

/** L'onglet "Factures" de la modale de détails d'un événement. */
const EventDetailsInvoices = defineComponent({
    name: 'EventDetailsInvoices',
    props: {
        event: {
            type: Object as PropType<Required<Props>['event']>,
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
    },
    emits: ['created'],
    data: (): Data => ({
        isCreating: false,
    }),
    computed: {
        isBillable(): boolean {
            return (
                this.event.is_billable &&
                this.event.materials.length > 0
            );
        },

        invoice(): InvoiceType | null {
            return [...(this.event.invoices ?? [])].shift() ?? null;
        },

        hasInvoice(): boolean {
            return this.invoice !== null;
        },

        previousInvoices(): InvoiceType[] {
            return (this.event.invoices ?? []).slice(1);
        },

        hasBeneficiary(): boolean {
            return this.event.beneficiaries.length > 0;
        },

        userCanEdit(): boolean {
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
            if (this.isCreating) {
                return;
            }
            const { __, event: { id } } = this;

            // - Confirmation.
            const isConfirmed = await confirm(__('confirm-create'));
            if (!isConfirmed) {
                return;
            }
            this.isCreating = true;

            try {
                const invoice = await apiEvents.createInvoice(id);

                this.$emit('created', invoice);
                this.$toasted.success(__('invoice-created'));
            } catch {
                this.$toasted.error(__('error-while-generating'));
            } finally {
                this.isCreating = false;
            }
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
            invoice,
            previousInvoices,
            isCreating,
            isBillable,
            hasInvoice,
            userCanEdit,
            hasBeneficiary,
            handleCreate,
        } = this;

        if (!isBillable) {
            return null;
        }

        const renderContent = (): JSX.Element => {
            if (!hasInvoice) {
                if (!hasBeneficiary) {
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
                    <div class="EventDetailsInvoices__no-invoice">
                        <p class="EventDetailsInvoices__no-invoice__text">
                            {__('no-invoice-help')}
                        </p>
                        <p class="EventDetailsInvoices__no-invoice__text">
                            {
                                userCanEdit
                                    ? __('create-invoice-help')
                                    : __('contact-someone-to-create-invoice')
                            }
                        </p>
                        {userCanEdit && (
                            <Button type="add" loading={isCreating} onClick={handleCreate}>
                                {__('create-invoice')}
                            </Button>
                        )}
                    </div>
                );
            }

            return (
                <Fragment>
                    <div class="EventDetailsInvoices__current-invoice">
                        <Invoice invoice={invoice!} />
                    </div>
                    {(hasBeneficiary && userCanEdit) && (
                        <div class="EventDetailsInvoices__regenerate">
                            <p class="EventDetailsInvoices__regenerate__text">
                                {__('regenerate-help')}
                            </p>
                            <Link
                                icon="sync"
                                class="EventDetailsInvoices__regenerate__link"
                                onClick={handleCreate}
                            >
                                {__('create-new-invoice')}
                            </Link>
                        </div>
                    )}
                    {previousInvoices.length > 0 && (
                        <div class="EventDetailsInvoices__previous-invoices">
                            <h3 class="EventDetailsInvoices__previous-invoices__title">
                                {__('previous-invoices')}
                            </h3>
                            <ul class="EventDetailsInvoices__previous-invoices__list">
                                {previousInvoices.map((previousInvoice: InvoiceType) => (
                                    <li
                                        key={previousInvoice.id}
                                        class="EventDetailsInvoices__previous-invoices__list__item"
                                    >
                                        <Invoice
                                            invoice={previousInvoice}
                                            layout={InvoiceLayout.HORIZONTAL}
                                            outdated
                                        />
                                    </li>
                                ))}
                            </ul>
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
