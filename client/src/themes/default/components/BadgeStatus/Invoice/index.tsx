import { defineComponent } from 'vue';
import { InvoiceStatus } from '@/stores/api/invoices';
import Badge, { Type as BadgeType, Size } from '@/themes/default/components/Badge';

import type { PropType } from 'vue';
import type { InvoiceExcerpt } from '@/stores/api/invoices';

type Props = {
    /** La facture dont on veut afficher le statut. */
    invoice: InvoiceExcerpt,

    /** La taille du badge. */
    size?: Size | `${Size}`,
};

/** Un badge représentant le statut d'une facture. */
const BadgeStatusInvoice = defineComponent({
    name: 'BadgeStatusInvoice',
    props: {
        invoice: {
            type: Object as PropType<Props['invoice']>,
            required: true,
        },
        size: {
            type: String as PropType<Required<Props>['size']>,
            default: Size.NORMAL,
        },
    },
    render() {
        const { $t: __, size, invoice } = this;

        return (
            <Badge
                size={size}
                label={(() => {
                    if (invoice.is_credit_note) {
                        return __(`credit-note-status.${invoice.status}`);
                    }

                    if (
                        invoice.status === InvoiceStatus.PAID &&
                        invoice.total_with_taxes.isNegative()
                    ) {
                        return __('invoice-status.refunded');
                    }

                    return __(`invoice-status.${invoice.status}`);
                })()}
                type={(() => {
                    if (invoice.status === InvoiceStatus.PARTIALLY_PAID) {
                        return invoice.is_overdue
                            ? BadgeType.DANGER
                            : BadgeType.WARNING;
                    }

                    const statusBadgeType = {
                        [InvoiceStatus.DRAFT]: BadgeType.DEFAULT,
                        [InvoiceStatus.OBSOLETE]: BadgeType.DANGER,
                        [InvoiceStatus.PENDING]: BadgeType.WARNING,
                        [InvoiceStatus.SENT]: BadgeType.INFO,
                        [InvoiceStatus.OVERDUE]: BadgeType.DANGER,
                        [InvoiceStatus.PAID]: BadgeType.SUCCESS,
                        [InvoiceStatus.CANCELLED]: BadgeType.DANGER,
                    } as const;
                    return statusBadgeType[invoice.status];
                })()}
            />
        );
    },
});

export { Size };
export default BadgeStatusInvoice;
