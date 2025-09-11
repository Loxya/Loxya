import type { BillingData, ExtraBillingData, ExtraBillingTaxData, MaterialBillingData } from '@/stores/api/bookings';

const hasBillingChanged = (before: BillingData, after: BillingData): boolean => {
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
                    (_beforeMaterial: MaterialBillingData) => (
                        _beforeMaterial.id === afterMaterial.id
                    ),
                );
                if (beforeMaterial === undefined) {
                    return true;
                }

                return (
                    !beforeMaterial.discount_rate.equals(afterMaterial.discount_rate) ||
                    !beforeMaterial.unit_price.equals(afterMaterial.unit_price)
                );
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
            (afterExtra: ExtraBillingData, index: number) => {
                let beforeExtra: ExtraBillingData | undefined;
                if (afterExtra.id === null) {
                    beforeExtra = before.extras.at(index);

                    // - Si l'extra a cette position est persisté, il y a eu changement.
                    if (beforeExtra?.id !== null) {
                        return true;
                    }
                } else {
                    beforeExtra = before.extras.find(
                        (_beforeExtra: ExtraBillingData) => (
                            _beforeExtra.id === afterExtra.id!
                        ),
                    );
                }
                if (beforeExtra === undefined) {
                    return true;
                }

                // - Données de base.
                const hasBaseDataChanged = (
                    beforeExtra.description !== afterExtra.description ||
                    beforeExtra.quantity !== afterExtra.quantity ||
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

                // - Taxes
                if (
                    (!('taxes' in beforeExtra) && 'taxes' in afterExtra) ||
                    ('taxes' in beforeExtra && !('taxes' in afterExtra))
                ) {
                    return true;
                }

                if ('taxes' in beforeExtra && 'taxes' in afterExtra) {
                    if (beforeExtra.taxes!.length !== afterExtra.taxes!.length) {
                        return true;
                    }

                    const hasTaxesChanged = afterExtra.taxes!.some(
                        (afterTax: ExtraBillingTaxData) => {
                            const beforeTax = beforeExtra.taxes!.find(
                                (_beforeTax: ExtraBillingTaxData) => (
                                    _beforeTax.name === afterTax.name &&
                                    _beforeTax.is_rate === afterTax.is_rate &&
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
