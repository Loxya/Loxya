import './index.scss';
import { defineComponent } from 'vue';
import formatAmount from '@/utils/formatAmount';
import Icon from '@/themes/default/components/Icon';
import Button from '@/themes/default/components/Button';

import type { PropType } from 'vue';
import type { Invoice } from '@/stores/api/invoices';

export enum InvoiceLayout {
    VERTICAL = 'vertical',
    HORIZONTAL = 'horizontal',
}

type Props = {
    /** La facture à afficher. */
    invoice: Invoice,

    /**
     * Le layout à utiliser pour l'affichage.
     *
     * @see {@link InvoiceLayout}
     */
    layout?: InvoiceLayout,

    /**
     * La facture est-elle obsolète ?
     *
     * Par exemple si une nouvelle facture pour la même
     * "cible" a été régénérée depuis.
     */
    outdated?: boolean,
};

/** Une facture d'événement dans l'onglet des factures. */
const EventDetailsInvoice = defineComponent({
    name: 'EventDetailsInvoice',
    props: {
        invoice: {
            type: Object as PropType<Required<Props>['invoice']>,
            required: true,
        },
        layout: {
            type: String as PropType<Required<Props>['layout']>,
            default: InvoiceLayout.VERTICAL,
            validator: (value: string) => (
                (Object.values(InvoiceLayout) as string[]).includes(value)
            ),
        },
        outdated: {
            type: Boolean as PropType<Required<Props>['outdated']>,
            default: false,
        },
    },
    computed: {
        isCreditNote(): boolean {
            const { total_with_taxes: totalWithTaxes } = this.invoice;
            return totalWithTaxes.isNegative();
        },

        hasTaxes(): boolean {
            const { total_taxes: totalTaxes } = this.invoice;
            return totalTaxes.length > 0;
        },
    },
    methods: {
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
        const { __, layout, isCreditNote, outdated, invoice, hasTaxes } = this;
        const isVerticalLayout = layout === InvoiceLayout.VERTICAL;
        const {
            url,
            date,
            number,
            currency,
            total_without_taxes: totalWithoutTaxes,
        } = invoice;

        const className = [
            'EventDetailsInvoice',
            `EventDetailsInvoice--${layout}`,
            { 'EventDetailsInvoice--outdated': outdated },
        ];

        const title = __(
            `title.${isCreditNote ? 'credit-note' : 'invoice'}`,
            { number, date: date.toReadable() },
        );

        return (
            <div class={className}>
                <div class="EventDetailsInvoice__main">
                    <div class="EventDetailsInvoice__icon">
                        <Icon name="file-invoice-dollar" />
                    </div>
                    <div class="EventDetailsInvoice__text">
                        {title}<br />
                        {
                            hasTaxes
                                ? __('global.with-amount-of-excl-tax', { amount: formatAmount(totalWithoutTaxes, currency) })
                                : __('global.with-amount-of', { amount: formatAmount(totalWithoutTaxes, currency) })
                        }
                    </div>
                </div>
                <div class="EventDetailsInvoice__actions">
                    <Button
                        icon="download"
                        type={outdated ? 'secondary' : 'primary'}
                        class="EventDetailsInvoice__download"
                        to={url}
                        download
                    >
                        {(
                            isVerticalLayout
                                ? __(`download.${isCreditNote ? 'credit-note' : 'invoice'}`)
                                : __('global.download')
                        )}
                    </Button>
                </div>
            </div>
        );
    },
});

export default EventDetailsInvoice;
