import TaxRegime from '@/utils/invoicing/tax-regime';

import type {
    BillingData,
    ExtraBillingData,
    BillingLineTaxData,
    MaterialBillingData,
} from '@/stores/api/bookings';
import type {
    RawBillingData,
    RawExtraBillingData,
    RawMaterialBillingData,
} from '../_types';

const hasBillingChanged = (before: RawBillingData | BillingData, after: BillingData): boolean => {
    // - Si les remises globales ne sont pas identiques, il y a changement.
    if (!before.global_discount_rate.equals(after.global_discount_rate)) {
        return true;
    }

    // - Vérification du matériel.
    const hasChangedMaterials = (
        before.materials.length !== after.materials.length ||
        after.materials.some(
            (afterMaterial: MaterialBillingData) => {
                const beforeMaterial = before.materials.find(
                    (_beforeMaterial: RawMaterialBillingData | MaterialBillingData) => (
                        _beforeMaterial.id === afterMaterial.id
                    ),
                );
                if (beforeMaterial === undefined) {
                    return true;
                }

                const hasBaseDataChanged = (
                    !beforeMaterial.discount_rate.equals(afterMaterial.discount_rate) ||
                    !beforeMaterial.unit_price.equals(afterMaterial.unit_price) ||
                    beforeMaterial.tax_regime !== afterMaterial.tax_regime ||
                    beforeMaterial.tax_exemption_code !== afterMaterial.tax_exemption_code ||
                    beforeMaterial.tax_id !== afterMaterial.tax_id
                );
                if (hasBaseDataChanged) {
                    return true;
                }

                // - Composantes de taxes
                if (afterMaterial.tax_regime === TaxRegime.STANDARD) {
                    if (
                        (!('taxes' in beforeMaterial) && 'taxes' in afterMaterial) ||
                        ('taxes' in beforeMaterial && !('taxes' in afterMaterial))
                    ) {
                        return true;
                    }

                    const taxesBefore = beforeMaterial.taxes ?? [];
                    const taxesAfter = afterMaterial.taxes ?? [];
                    if (taxesBefore.length !== taxesAfter.length) {
                        return true;
                    }

                    const hasTaxesChanged = taxesAfter.some(
                        (afterTax: BillingLineTaxData) => {
                            const beforeTax = taxesBefore.find(
                                (_beforeTax: BillingLineTaxData) => (
                                    _beforeTax.name === afterTax.name &&
                                    _beforeTax.value.equals(afterTax.value)
                                ),
                            );
                            return beforeTax === undefined;
                        },
                    );
                    if (hasTaxesChanged) {
                        return true;
                    }
                }

                return false;
            },
        )
    );
    if (hasChangedMaterials) {
        return true;
    }

    // - Vérification des extras.
    const hasChangedExtras = (
        before.extras.length !== after.extras.length ||
        after.extras.some(
            (afterExtra: ExtraBillingData) => {
                const beforeExtra = before.extras.find(
                    (_beforeExtra: RawExtraBillingData | ExtraBillingData) => (
                        _beforeExtra.uuid === afterExtra.uuid
                    ),
                );
                if (beforeExtra === undefined) {
                    return true;
                }

                // - Données de base.
                const hasBaseDataChanged = (
                    beforeExtra.description !== afterExtra.description ||
                    beforeExtra.quantity !== afterExtra.quantity ||
                    beforeExtra.is_service !== afterExtra.is_service ||
                    !beforeExtra.discount_rate.equals(afterExtra.discount_rate) ||
                    beforeExtra.tax_regime !== afterExtra.tax_regime ||
                    beforeExtra.tax_exemption_code !== afterExtra.tax_exemption_code ||
                    beforeExtra.tax_id !== afterExtra.tax_id
                );
                if (hasBaseDataChanged) {
                    return true;
                }

                // - Prix unitaire.
                if (
                    (beforeExtra.unit_price === null && afterExtra.unit_price !== null) ||
                    (beforeExtra.unit_price !== null && afterExtra.unit_price === null) ||
                    (
                        beforeExtra.unit_price !== null && afterExtra.unit_price !== null &&
                        !beforeExtra.unit_price.equals(afterExtra.unit_price)
                    )
                ) {
                    return true;
                }

                // - Composantes de taxes
                if (afterExtra.tax_regime === TaxRegime.STANDARD) {
                    if (
                        (!('taxes' in beforeExtra) && 'taxes' in afterExtra) ||
                        ('taxes' in beforeExtra && !('taxes' in afterExtra))
                    ) {
                        return true;
                    }

                    const taxesBefore = beforeExtra.taxes ?? [];
                    const taxesAfter = afterExtra.taxes ?? [];
                    if (taxesBefore.length !== taxesAfter.length) {
                        return true;
                    }

                    const hasTaxesChanged = taxesAfter.some(
                        (afterTax: BillingLineTaxData) => {
                            const beforeTax = taxesBefore.find(
                                (_beforeTax: BillingLineTaxData) => (
                                    _beforeTax.name === afterTax.name &&
                                    _beforeTax.value.equals(afterTax.value)
                                ),
                            );
                            return beforeTax === undefined;
                        },
                    );
                    if (hasTaxesChanged) {
                        return true;
                    }
                }

                return false;
            },
        )
    );
    if (hasChangedExtras) {
        return true;
    }

    return false;
};

export default hasBillingChanged;
