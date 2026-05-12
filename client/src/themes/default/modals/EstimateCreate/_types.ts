import type { Beneficiary } from '@/stores/api/beneficiaries';
import type { ExtraBillingData } from '@/stores/api/bookings';
import type { EstimateCreate } from '@/stores/api/estimates';

export type EditData = (
    & Omit<Required<EstimateCreate>, 'buyer_id' | 'lines'>
    & {
        /** L'acheteur sélectionné. */
        buyer: Beneficiary | null,

        /** Les lignes du devis. */
        lines: ExtraBillingData[],
    }
);
