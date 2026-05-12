import TaxRegime from '@/utils/invoicing/tax-regime';

import type Country from '@/utils/country';
import type { I18nTranslate } from 'vuex-i18n';
import type { LineTax, LineTaxDetail } from '../_types';

// ------------------------------------------------------
// -
// -    Types
// -
// ------------------------------------------------------

type Context = {
    sellerCountry: Country,
    translator: I18nTranslate,
};

type ReadableTaxData = {
    value: string,
    details?: string,
};

export const getReadableTaxData = (tax: LineTaxDetail, context: Context): ReadableTaxData => {
    const { translator: __, sellerCountry } = context;
    const isSimpleVatSystem = !!sellerCountry.hasSimpleVatSystem;

    const value = (() => {
        switch (tax.regime) {
            case TaxRegime.STANDARD: {
                if (tax.taxes === null || tax.taxes.length === 0) {
                    return {
                        value: __('tax-state.none.label'),
                        details: __('tax-state.none.details'),
                    };
                }

                return tax.taxes
                    .map((_tax: LineTax) => (
                        !isSimpleVatSystem && _tax.name !== undefined
                            ? `${_tax.name} (${_tax.value.toString()}%)`
                            : `${_tax.value.toString()}%`
                    ))
                    .join(' +\u00A0');
            }
            case TaxRegime.ZERO_RATED: {
                return '0%';
            }
            case TaxRegime.REVERSE_CHARGE: {
                return __('tax-state.reverse-charge');
            }
            case TaxRegime.REVERSE_CHARGE_SUPPLY: {
                return __('tax-state.reverse-charge-supply');
            }
            case TaxRegime.EXPORT: {
                return __('tax-state.export');
            }
            case TaxRegime.EXEMPTED: {
                return {
                    value: __('tax-state.exempted.label.default'),
                    details: (
                        tax.exemptionCode === null
                            ? __('tax-state.exempted.reason.none')
                            : __(`global.vat-exemptions.${tax.exemptionCode}.excerpt`)
                    ),
                };
            }
            case TaxRegime.OUT_OF_SCOPE: {
                return __('tax-state.out-of-scope');
            }
            default: {
                throw new Error(`Unsupported regime \`${(tax as any).regime}\`.`);
            }
        }
    })();
    return typeof value === 'string' ? { value } : value;
};

export default getReadableTaxData;
