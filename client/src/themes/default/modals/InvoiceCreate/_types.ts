import type { Beneficiary } from '@/stores/api/beneficiaries';
import type { ExtraBillingData } from '@/stores/api/bookings';
import type { InvoiceCreate } from '@/stores/api/invoices';

export type EditData = (
    & Omit<Required<InvoiceCreate>, 'buyer_id' | 'lines'>
    & {
        /** L'acheteur sélectionné. */
        buyer: Beneficiary | null,

        /** Les lignes de la facture. */
        lines: ExtraBillingData[],
    }
);
