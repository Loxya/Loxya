import { markRaw } from 'vue';
import Decimal from 'decimal.js';

import type {
    Booking,
    BookingExtra,
    BookingMaterial,
    BillingData,
    ExtraBillingData,
    MaterialBillingData,
} from '@/stores/api/bookings';

export const getEmbeddedMaterialBilling = (material: BookingMaterial<true>): MaterialBillingData => ({
    id: material.id,
    unit_price: material.unit_price,
    discount_rate: material.discount_rate,
    tax_regime: material.tax_regime,
    tax_exemption_code: material.tax_exemption_code,
    tax_id: material.tax_id,
    taxes: material.taxes,
});

export const getEmbeddedExtraBilling = (extra: BookingExtra): ExtraBillingData => ({
    uuid: extra.uuid,
    is_service: extra.is_service,
    description: extra.description,
    quantity: extra.quantity,
    unit_price: extra.unit_price,
    discount_rate: extra.discount_rate,
    tax_regime: extra.tax_regime,
    tax_exemption_code: extra.tax_exemption_code,
    tax_id: extra.tax_id,
    taxes: extra.taxes,
});

const getEmbeddedBilling = (booking: Booking<true>): BillingData => {
    // - Global data.
    const globalDiscountRate = booking.global_discount_rate ?? markRaw(new Decimal(0));

    // - Materials
    const materials: MaterialBillingData[] = booking.materials.map(
        (material: BookingMaterial<true>): MaterialBillingData => (
            getEmbeddedMaterialBilling(material)
        ),
    );

    // - Extras
    const extras: ExtraBillingData[] = (booking.extras ?? []).map(
        (extra: BookingExtra): ExtraBillingData => (
            getEmbeddedExtraBilling(extra)
        ),
    );

    return {
        global_discount_rate: globalDiscountRate,
        materials,
        extras,
    };
};

export default getEmbeddedBilling;
