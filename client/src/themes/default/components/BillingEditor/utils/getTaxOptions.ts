import TaxRegime from '@/utils/invoicing/tax-regime';
import getReadableTaxData from './getReadableTaxData';

import type { Tax as LiveTax } from '@/stores/api/taxes';
import type { Options as SelectOptions } from '@/themes/default/components/Select';
import type VatExemptionCode from '@/utils/invoicing/vat-exemption-code';
import type { Buyer, LineTax, LineTaxDetail } from '../_types';
import type { I18nTranslate } from 'vuex-i18n';
import type Country from '@/utils/country';

// ------------------------------------------------------
// -
// -    Types
// -
// ------------------------------------------------------

type Context = {
    buyer: Buyer | null,
    sellerCountry: Country,
    normalTaxes: LiveTax[],
    translator: I18nTranslate,
};

export type TaxOption = (
    // - Taxe standard (e.g. T.V.A. 20%)
    | {
        regime: TaxRegime.STANDARD,
        taxId: LiveTax['id'],
    }

    // - Régime sans exemption déterminée.
    //   (si exempté : Ouvre la modale de sélection)
    | { regime: Exclude<TaxRegime, TaxRegime.STANDARD> }

    // - Régime avec exemption déterminée.
    //   (le `null` ici est explicite, on a choisi le "sans motif")
    | {
        regime: Exclude<TaxRegime, TaxRegime.STANDARD | TaxRegime.ZERO_RATED>,
        exemptionCode: VatExemptionCode | null,
    }
);

export type TaxRegimeOptionsBundle = {
    /** Les options disponibles. */
    options: SelectOptions<TaxOption>,

    /** La sélection actuelle. */
    selected: TaxOption | null,
};

// ------------------------------------------------------
// -
// -    Fonctions internes
// -
// ------------------------------------------------------

const getTaxOptionsFactory = (context: Context) => {
    const { sellerCountry, buyer, normalTaxes, translator: __ } = context;
    const isSimpleVatSystem = !!sellerCountry.hasSimpleVatSystem;

    return (isService: boolean, currentValue?: LineTaxDetail | null): TaxRegimeOptionsBundle => {
        const availableRegimes = buyer !== null
            ? sellerCountry.getLineAvailableTaxRegimes(buyer, isService)
            : [TaxRegime.STANDARD];

        const allValues: Map<string, TaxOption> = new Map();
        const options = availableRegimes.flatMap((entry): SelectOptions<TaxOption> => {
            const { regime, exemptionCode } = typeof entry === 'string'
                ? { regime: entry, exemptionCode: null }
                : entry;

            // - Régime standard : Une option par taxe.
            if (regime === TaxRegime.STANDARD) {
                return normalTaxes
                    .map((tax: LiveTax) => {
                        const key = `${TaxRegime.STANDARD}:${tax.id}`;
                        if (allValues.has(key)) {
                            return null;
                        }

                        const label = (() => {
                            if (tax.is_group) {
                                return tax.name;
                            }

                            // - Si la valeur actuellement sélectionnée est cette taxe, on
                            //   utilise les données telles qu'elles sont sauvés actuellement.
                            if (
                                currentValue?.regime === TaxRegime.STANDARD &&
                                currentValue.taxId === tax.id
                            ) {
                                const components = currentValue.taxes ?? [];
                                if (components.length === 0) {
                                    return null;
                                }

                                return components
                                    .map((_tax: LineTax) => (
                                        !isSimpleVatSystem && _tax.name !== undefined
                                            ? `${_tax.name} (${_tax.value.toString()}%)`
                                            : `${_tax.value.toString()}%`
                                    ))
                                    .join(' +\u00A0');
                            }

                            return !isSimpleVatSystem && tax.name !== undefined
                                ? `${tax.name} (${tax.value.toString()}%)`
                                : `${tax.value.toString()}%`;
                        })();
                        if (label === null) {
                            return null;
                        }

                        const value: TaxOption = {
                            regime: TaxRegime.STANDARD,
                            taxId: tax.id,
                        };
                        allValues.set(key, value);

                        return { label, value };
                    })
                    .filter((option) => option !== null);
            }

            // - Régime exempté.
            if (regime === TaxRegime.EXEMPTED) {
                // - Option explicite (avec code d'exemption pré-déterminé).
                if (exemptionCode !== null) {
                    const key = `${regime}:${exemptionCode}`;
                    if (allValues.has(key)) {
                        return [];
                    }

                    const value: TaxOption = { regime, exemptionCode };
                    const label = (() => {
                        const readable = getReadableTaxData(value, context);
                        return readable.details !== undefined
                            ? `${readable.value} (${readable.details})`
                            : readable.value;
                    })();

                    allValues.set(key, value);
                    return [{ label, value }];
                }

                const _options: SelectOptions<TaxOption> = [];

                // - Option explicite lorsqu'une exemption est déjà sélectionnée.
                const isCurrentlyExempted = currentValue?.regime === TaxRegime.EXEMPTED;
                if (isCurrentlyExempted) {
                    const currentKey = `${TaxRegime.EXEMPTED}:${currentValue.exemptionCode ?? ''}`;
                    if (!allValues.has(currentKey)) {
                        const label = (() => {
                            const details = currentValue.exemptionCode !== null
                                ? __(`global.vat-exemptions.${currentValue.exemptionCode}.excerpt`)
                                : __('tax-state.exempted.reason.none');

                            return `${__('tax-state.exempted.label.default')} (${details})`;
                        })();
                        const value: TaxOption = {
                            regime: TaxRegime.EXEMPTED,
                            exemptionCode: currentValue.exemptionCode,
                        };

                        allValues.set(currentKey, value);
                        _options.push({ label, value });
                    }
                }

                // - Option simple avec choix de la raison lors de la sélection.
                if (!allValues.has(TaxRegime.EXEMPTED)) {
                    const label = !isCurrentlyExempted
                        ? __('tax-state.exempted.label.default')
                        : __('tax-state.exempted.label.other');

                    const value: TaxOption = { regime: TaxRegime.EXEMPTED };

                    allValues.set(TaxRegime.EXEMPTED, value);
                    _options.push({ label, value });
                }

                return _options;
            }

            // - Taux "zéro".
            if (regime === TaxRegime.ZERO_RATED) {
                const value: TaxOption = { regime };
                allValues.set(regime, value);
                return [{ label: '0%', value }];
            }

            // - Autres régimes.
            const key = `${regime}:${exemptionCode ?? ''}`;
            if (!allValues.has(key)) {
                const label = (() => {
                    const readable = getReadableTaxData({ regime, exemptionCode }, context);
                    return readable.details !== undefined
                        ? `${readable.value} (${readable.details})`
                        : readable.value;
                })();
                const value: TaxOption = { regime, exemptionCode };

                allValues.set(key, value);
                return [{ label, value }];
            }

            return [];
        });

        // - Valeur courante correspondant à la sélection actuelle.
        const selected = (() => {
            if (currentValue !== undefined && currentValue !== null) {
                // - Si c'est une taxe standard, on sélectionne celle-ci uniquement.
                if (currentValue.regime === TaxRegime.STANDARD) {
                    return currentValue.taxId !== null
                        ? (allValues.get(`${TaxRegime.STANDARD}:${currentValue.taxId}`) ?? null)
                        : null;
                }

                // - Si c'est exempté, on sélectionne toujours une valeur explicite.
                if (currentValue.regime === TaxRegime.EXEMPTED) {
                    return allValues.get(`${TaxRegime.EXEMPTED}:${currentValue.exemptionCode ?? ''}`) ?? null;
                }

                // - Taux zéro.
                if (currentValue.regime === TaxRegime.ZERO_RATED) {
                    return allValues.get(TaxRegime.ZERO_RATED) ?? null;
                }

                return allValues.get(`${currentValue.regime}:${currentValue.exemptionCode ?? ''}`) ?? null;
            }
            return null;
        })();

        return { options, selected };
    };
};

export default getTaxOptionsFactory;
