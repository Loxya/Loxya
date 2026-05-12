import './index.scss';
import pick from 'lodash/pick';
import Decimal from 'decimal.js';
import config from '@/globals/config';
import { confirm } from '@/utils/alert';
import isTruthy from '@/utils/isTruthy';
import { defineComponent, inject, markRaw } from 'vue';
import TaxRegime from '@/utils/invoicing/tax-regime';
import Dropdown from '@/themes/default/components/Dropdown';
import Select from '@/themes/default/components/Select';
import Button from '@/themes/default/components/Button';
import Input from '@/themes/default/components/Input';
import getTaxOptionsFactory from '../../utils/getTaxOptions';
import formatAmount from '@/utils/formatAmount';
import formatNumber from '@/utils/formatNumber';
import { IsCompactKey } from '../../_constants';

// - Modales
import SelectExemptionCodeModal from '../../modals/SelectExemptionCode';

import type Country from '@/utils/country';
import type Currency from '@/utils/currency';
import type { Injected, PropType } from 'vue';
import type { Tax as LiveTax } from '@/stores/api/taxes';
import type { BillingLineTaxData } from '@/stores/api/bookings';
import type { TaxOption } from '../../utils/getTaxOptions';
import type {
    BillingMaterial,
    Buyer,
    LineTax,
    LineTaxDetail,
    RawMaterialBillingData,
} from '../../_types';

type Column = {
    key: string,
    title?: string,
    render(
        material: BillingMaterial,
        errors: Record<string, any> | undefined,
    ): JSX.Element | null,
};

type Props = {
    /** Les matériels dont on veut éditer la facturation. */
    materials: BillingMaterial[],

    /** Les données bruts en cours d'edition. */
    data: RawMaterialBillingData[],

    /** L'acheteur concerné par la facturation. */
    buyer: Buyer | null,

    /** La devise à utiliser pour les prix. */
    currency: Currency,

    /** L'affichage doit-il prendre en charge des taxes ? */
    hasTaxes: boolean,

    /** Les éventuelles erreurs de validation liées aux matériels. */
    errors?: Record<number, any> | string[],

    /**
     * Fonction appelée lorsque les données de facturation
     * changent pour un matériel.
     *
     * @param updatedMaterial - Les données de facturation du matériel, mises à jour.
     */
    onChange?(updatedMaterial: RawMaterialBillingData): void,

    /**
     * Fonction appelée lorsque l'utilisateur demande la
     * resynchronisation des données d'un matériel.
     *
     * @param materialId - L'identifiant du matériel à resynchroniser.
     */
    onRequestResync?(materialId: BillingMaterial['id']): void,
};

type InstanceProperties = {
    isCompact: Injected<typeof IsCompactKey>,
};

/** La liste du matériel dans l'éditeur de facture. */
const BillingEditorMaterials = defineComponent({
    name: 'BillingEditorMaterials',
    props: {
        materials: {
            type: Array as PropType<Props['materials']>,
            required: true,
        },
        data: {
            type: Array as PropType<Props['data']>,
            required: true,
        },
        buyer: {
            type: null as unknown as PropType<Props['buyer']>,
            required: true,
            validator: (value: unknown | null) => (
                value === null || typeof value === 'object'
            ),
        },
        currency: {
            type: Object as PropType<Props['currency']>,
            required: true,
        },
        hasTaxes: {
            type: Boolean as PropType<Props['hasTaxes']>,
            required: true,
        },
        errors: {
            type: [Array, Object] as PropType<Props['errors']>,
            default: undefined,
        },
        // eslint-disable-next-line vue/no-unused-properties
        onChange: {
            type: Function as PropType<Props['onChange']>,
            default: undefined,
        },
        // eslint-disable-next-line vue/no-unused-properties
        onRequestResync: {
            type: Function as PropType<Props['onRequestResync']>,
            default: undefined,
        },
    },
    emits: [
        'change',
        'requestResync',
    ],
    setup: (): InstanceProperties => ({
        isCompact: inject(IsCompactKey)!,
    }),
    computed: {
        sellerCountry(): Country {
            return config.organization.country;
        },

        isSimpleVatSystem(): boolean {
            return !!this.sellerCountry.hasSimpleVatSystem;
        },

        isTaxesEnabled(): boolean {
            if (!this.hasTaxes) {
                return false;
            }
            return !config.organization.isVatExempted;
        },

        normalTaxes(): LiveTax[] {
            if (!this.isTaxesEnabled) {
                return [];
            }
            return this.$store.state.taxes.list;
        },

        columns(): Map<string, Column> {
            const {
                __,
                __c,
                buyer,
                currency,
                normalTaxes,
                sellerCountry,
                isTaxesEnabled,
                isSimpleVatSystem,
                handleChangeTax,
                handleResyncData,
                handleInputPrice,
                handleChangePrice,
                handleInputDiscount,
                handleChangeDiscount,
            } = this;

            const entries = [
                {
                    key: 'name',
                    title: __('columns.name'),
                    render: (material: BillingMaterial) => (
                        <span
                            class={[
                                'BillingEditorMaterials__item__name',
                                { 'BillingEditorMaterials__item__name--hidden': material.will_be_hidden },
                            ]}
                        >
                            <span
                                class={[
                                    'BillingEditorMaterials__item__name__name',
                                    {
                                        'BillingEditorMaterials__item__name__name--unsynced': (
                                            material.name.isUnsynced
                                        ),
                                    },
                                ]}
                            >
                                {material.name.current}
                            </span>
                            <span
                                class={[
                                    'BillingEditorMaterials__item__name__reference',
                                    {
                                        'BillingEditorMaterials__item__name__reference--unsynced': (
                                            material.reference.isUnsynced
                                        ),
                                    },
                                ]}
                            >
                                {__('global.ref-ref', { reference: material.reference.current })}
                            </span>
                        </span>
                    ),
                },
                {
                    key: 'price',
                    title: __('columns.unit-price-period'),
                    render: (material: BillingMaterial, errors: Record<string, any> | undefined) => {
                        const renderValue = (): JSX.Element => (
                            <span
                                class={[
                                    'BillingEditorMaterials__item__price__input',
                                    {
                                        'BillingEditorMaterials__item__price__input--unsynced': (
                                            material.unit_price.isUnsynced
                                        ),
                                    },
                                ]}
                            >
                                <Input
                                    type="text"
                                    value={material.unit_price.current.toString()}
                                    invalid={!!errors?.unit_price}
                                    addon={currency.symbol}
                                    class="BillingEditorMaterials__item__price__input__field"
                                    onInput={(newValue: string) => {
                                        handleInputPrice(material.id, newValue);
                                    }}
                                    onChange={(newValue: string) => {
                                        handleChangePrice(material.id, newValue);
                                    }}
                                />
                            </span>
                        );

                        return (
                            <span class="BillingEditorMaterials__item__price">
                                {renderValue()}
                                <span
                                    class={[
                                        'BillingEditorMaterials__item__price__degressive-rate',
                                        {
                                            'BillingEditorMaterials__item__price__degressive-rate--unsynced': (
                                                material.degressive_rate.isUnsynced
                                            ),
                                        },
                                    ]}
                                >
                                    {formatNumber(material.degressive_rate.current, 2)}
                                </span>
                                <span class="BillingEditorMaterials__item__price__total">
                                    {formatAmount(material.unit_price_period, currency)}
                                </span>
                            </span>
                        );
                    },
                },
                {
                    key: 'quantity',
                    title: __('columns.quantity'),
                    render: (material: BillingMaterial) => (
                        <span class="BillingEditorMaterials__item__quantity">
                            {material.quantity}
                        </span>
                    ),
                },
                isTaxesEnabled && {
                    key: 'taxes',
                    title: (
                        isSimpleVatSystem
                            ? __('columns.taxes.simple')
                            : __('columns.taxes.default')
                    ),
                    render: (material: BillingMaterial) => {
                        const tax: LineTaxDetail = {
                            regime: material.tax_regime.current!,
                            exemptionCode: material.tax_exemption_code.current,
                            taxId: material.tax_id.current,
                            taxes: material.taxes.current,
                        };

                        // - Si on est en régime standard, qu'on a pas de taxe sélectionnée
                        //   et qu'on a un reliquat de détails de taxes, c'est que la taxe
                        //   a été supprimée entres temps.
                        if (
                            tax.regime === TaxRegime.STANDARD &&
                            (tax.taxes ?? []).length > 0 &&
                            tax.taxId === null
                        ) {
                            const readableTax = (tax.taxes ?? [])
                                .map((_tax: LineTax) => (
                                    !isSimpleVatSystem && _tax.name !== undefined
                                        ? `${_tax.name} (${_tax.value.toString()}%)`
                                        : `${_tax.value.toString()}%`
                                ))
                                .join(' +\u00A0');

                            return (
                                <span class="BillingEditorMaterials__item__obsolete-tax">
                                    <span class="BillingEditorMaterials__item__obsolete-tax__title">
                                        {__('obsolete-tax')}
                                    </span>
                                    <span class="BillingEditorMaterials__item__obsolete-tax__details">
                                        {readableTax}
                                    </span>
                                </span>
                            );
                        }

                        const context = { buyer, sellerCountry, normalTaxes, translator: __c };
                        const { options, selected } = getTaxOptionsFactory(context)(true, tax);

                        const isUnsynced = (
                            material.tax_regime.isUnsynced ||
                            material.tax_exemption_code.isUnsynced ||
                            material.tax_id.isUnsynced ||
                            material.taxes.isUnsynced
                        );
                        return (
                            <span
                                class={[
                                    'BillingEditorMaterials__item__tax',
                                    { 'BillingEditorMaterials__item__tax--unsynced': isUnsynced },
                                ]}
                            >
                                <Select
                                    value={selected}
                                    options={options}
                                    placeholder={__('component.tax-state.none.inline')}
                                    class="BillingEditorMaterials__item__tax__input"
                                    onChange={(newValue: TaxOption | null) => {
                                        handleChangeTax(material.id, newValue);
                                    }}
                                />
                            </span>
                        );
                    },
                },
                {
                    key: 'discount',
                    title: __('columns.discount'),
                    render: (material: BillingMaterial, errors: Record<string, any> | undefined) => {
                        if (!material.is_discountable && material.discount_rate.isZero()) {
                            return (
                                <p
                                    class={[
                                        'BillingEditorMaterials__item__discount',
                                        'BillingEditorMaterials__item__discount--not-applicable',
                                    ]}
                                >
                                    {__('discount-not-applicable')}
                                </p>
                            );
                        }

                        const renderValue = (): JSX.Element => (
                            <Input
                                type="text"
                                value={material.discount_rate.toString()}
                                invalid={!!errors?.discount_rate}
                                addon="%"
                                class="BillingEditorMaterials__item__discount__input"
                                onInput={(newValue: string) => {
                                    handleInputDiscount(material.id, newValue);
                                }}
                                onChange={(newValue: string) => {
                                    handleChangeDiscount(material.id, newValue);
                                }}
                            />
                        );

                        return (
                            <div class="BillingEditorMaterials__item__discount">
                                {renderValue()}
                            </div>
                        );
                    },
                },
                {
                    key: 'total',
                    title: (
                        isTaxesEnabled
                            ? __('columns.total-without-taxes')
                            : __('columns.total')
                    ),
                    render: (material: BillingMaterial) => (
                        <span class="BillingEditorMaterials__item__total-without-taxes">
                            {formatAmount(material.total_without_taxes, currency)}
                        </span>
                    ),
                },
                {
                    key: 'actions',
                    render: (material: BillingMaterial) => {
                        if (!material.is_resyncable) {
                            return null;
                        }

                        return (
                            <Dropdown>
                                <Button
                                    icon="sync-alt"
                                    onClick={() => { handleResyncData(material.id); }}
                                >
                                    {__('actions.resync-data')}
                                </Button>
                            </Dropdown>
                        );
                    },
                },
            ].filter(isTruthy);

            return new Map(entries.map((column) => [column.key, column]));
        },
    },
    created() {
        if (this.isTaxesEnabled) {
            this.$store.dispatch('taxes/fetch');
        }
    },
    methods: {
        // ------------------------------------------------------
        // -
        // -    Handlers
        // -
        // ------------------------------------------------------

        handleInputPrice(id: BillingMaterial['id'], rawValue: string) {
            // - Si l'entrée n'est pas (encore) un nombre valide, on ne fait rien.
            //   (l'événement `onChange` se chargera de remettre le champ en ordre
            //    si jamais le blur est atteint sans correction de l'entrée)
            if (!/^\d+(?:\.\d+)?$/.test(rawValue)) {
                return;
            }

            const datum = this.data.find(
                (_datum: RawMaterialBillingData) => _datum.id === id,
            );
            if (datum === undefined) {
                return;
            }

            const value = markRaw(
                Decimal.min(Decimal.max(rawValue, 0), 1_000_000_000_000 - 1)
                    .toDecimalPlaces(2, Decimal.ROUND_DOWN),
            );

            this.$emit('change', { ...datum, unit_price: value });
        },

        handleChangePrice(id: BillingMaterial['id'], rawValue: string) {
            rawValue = rawValue.trim().replaceAll(',', '.');
            rawValue = rawValue.endsWith('.') ? `${rawValue}0` : rawValue;
            if (!/^\d+(?:\.\d+)?$/.test(rawValue)) {
                rawValue = '0';
            }

            const datum = this.data.find((_datum: RawMaterialBillingData) => _datum.id === id);
            if (datum === undefined) {
                return;
            }

            const value = markRaw(
                Decimal.min(Decimal.max(rawValue, 0), 1_000_000_000_000 - 1)
                    .toDecimalPlaces(2, Decimal.ROUND_DOWN),
            );

            this.$emit('change', { ...datum, unit_price: value });
        },

        async handleChangeTax(id: BillingMaterial['id'], selection: TaxOption | null) {
            if (!this.isTaxesEnabled) {
                return;
            }

            const datum = this.data.find((_datum: RawMaterialBillingData) => _datum.id === id);
            if (datum === undefined) {
                return;
            }

            if (selection === null) {
                this.$emit('change', {
                    ...datum,
                    tax_regime: TaxRegime.STANDARD,
                    tax_exemption_code: null,
                    tax_id: null,
                    taxes: null,
                });
                return;
            }

            // - Régime standard.
            if (selection.regime === TaxRegime.STANDARD) {
                const tax: LiveTax | undefined = this.normalTaxes.find(
                    ({ id: _id }: LiveTax) => _id === selection.taxId,
                );
                if (tax === undefined) {
                    return;
                }

                const taxes: BillingLineTaxData[] = tax.is_group ? tax.components : (
                    [pick(tax, this.isSimpleVatSystem ? ['value'] : ['name', 'value'])]
                );

                this.$emit('change', {
                    ...datum,
                    tax_regime: TaxRegime.STANDARD,
                    tax_exemption_code: null,
                    tax_id: selection.taxId,
                    taxes,
                });
                return;
            }

            const exemptionCode = 'exemptionCode' in selection
                ? selection.exemptionCode
                : undefined;

            // - Régime exempté sans code d'exemption : Ouverture de la modale de sélection de la raison.
            if (selection.regime === TaxRegime.EXEMPTED && exemptionCode === undefined) {
                // - Si c'est une première sélection "Exempté", on applique le régime immédiatement.
                if (datum.tax_regime !== TaxRegime.EXEMPTED) {
                    this.$emit('change', {
                        ...datum,
                        tax_regime: TaxRegime.EXEMPTED,
                        tax_exemption_code: null,
                        tax_id: null,
                        taxes: null,
                    });
                }

                // - Choix de la raison d'exemption.
                const hasSelectableCodes = this.sellerCountry
                    .getLineAvailableTaxExemptionCodes(TaxRegime.EXEMPTED)
                    .length > 0;

                if (hasSelectableCodes) {
                    const selectedExemptionCode = await this.$modal.show(
                        SelectExemptionCodeModal,
                        { regime: TaxRegime.EXEMPTED },
                    );
                    if (selectedExemptionCode !== undefined) {
                        const freshDatum = this.data.find((_datum) => _datum.id === id);
                        if (freshDatum !== undefined) {
                            this.$emit('change', {
                                ...freshDatum,
                                tax_regime: TaxRegime.EXEMPTED,
                                tax_exemption_code: selectedExemptionCode,
                                tax_id: null,
                                taxes: null,
                            });
                        }
                    }
                }
                return;
            }

            // - Régime non standard avec ou sans raison d'exemption.
            this.$emit('change', {
                ...datum,
                tax_regime: selection.regime,
                tax_exemption_code: exemptionCode ?? null,
                tax_id: null,
                taxes: null,
            });
        },

        handleInputDiscount(id: BillingMaterial['id'], rawValue: string) {
            // - Si l'entrée n'est pas (encore) un nombre valide, on ne fait rien.
            //   (l'événement `onChange` se chargera de remettre le champ en ordre
            //    si jamais le blur est atteint sans correction de l'entrée)
            if (!/^\d+(?:\.\d+)?$/.test(rawValue)) {
                return;
            }

            const material = this.materials.find((_material: BillingMaterial) => _material.id === id);
            const datum = this.data.find((_datum: RawMaterialBillingData) => _datum.id === id);
            if (material === undefined || datum === undefined) {
                return;
            }

            // - Non remisable et pas de remise existante, on n'autorise pas le changement.
            if (!material.is_discountable && material.discount_rate.isZero()) {
                return;
            }

            const value = markRaw(
                Decimal.min(Decimal.max(rawValue, 0), 100)
                    .toDecimalPlaces(4, Decimal.ROUND_DOWN),
            );

            // - Si le matériel n'est normalement pas remisable, que l'on avait une
            //   remise et que la valeur est mise à zéro, on ne procède pas au
            //   changement dans cet event et on demandera confirmation dans le
            //   `onChange` car il ne sera plus possible de faire marche arrière
            //   une fois repassé en "non remisable".
            if (value.isZero() && !material.is_discountable) {
                return;
            }

            this.$emit('change', { ...datum, discount_rate: value });
        },

        async handleChangeDiscount(id: BillingMaterial['id'], rawValue: string) {
            rawValue = rawValue.trim().replaceAll(',', '.');
            rawValue = rawValue.endsWith('.') ? `${rawValue}0` : rawValue;
            if (!/^\d+(?:\.\d+)?$/.test(rawValue)) {
                rawValue = '0';
            }

            const material = this.materials.find((_material: BillingMaterial) => _material.id === id);
            const datum = this.data.find((_datum: RawMaterialBillingData) => _datum.id === id);
            if (material === undefined || datum === undefined) {
                return;
            }

            // - Non remisable et pas de remise existante, on n'autorise pas le changement.
            if (!material.is_discountable && material.discount_rate.isZero()) {
                return;
            }

            const value = markRaw(
                Decimal.min(Decimal.max(rawValue, 0), 100)
                    .toDecimalPlaces(4, Decimal.ROUND_HALF_UP),
            );

            if (value.isZero() && !material.is_discountable) {
                const { __ } = this;

                const isConfirmed = await confirm({
                    type: 'warning',
                    text: __('not-discountable-reset-warning'),
                });
                if (!isConfirmed) {
                    return;
                }
            }

            this.$emit('change', { ...datum, discount_rate: value });
        },

        async handleResyncData(id: BillingMaterial['id']) {
            const material = this.materials.find((_material: BillingMaterial) => _material.id === id);
            if (!material || !material.is_resyncable) {
                return;
            }
            this.$emit('requestResync', material.id);
        },

        // ------------------------------------------------------
        // -
        // -    Méthodes internes
        // -
        // ------------------------------------------------------

        __c(key: string, params?: Record<string, number | string>, count?: number): string {
            key = !key.startsWith('global.')
                ? `components.BillingEditor.${key}`
                : key.replace(/^global\./, '');

            return this.$t(key, params, count);
        },

        __(key: string, params?: Record<string, number | string>, count?: number): string {
            if (!key.startsWith('global.')) {
                key = !key.startsWith('component.')
                    ? `lists.materials.${key}`
                    : key.replace(/^component\./, '');
            }
            return this.__c(key, params, count);
        },
    },
    render() {
        const {
            __,
            data,
            errors: allErrors,
            materials,
            columns,
            isCompact,
            isTaxesEnabled,
        } = this;

        if (materials.length <= 0) {
            return (
                <div class="BillingEditorMaterials BillingEditorMaterials--empty">
                    <div class="BillingEditorMaterials__empty">
                        <h3 class="BillingEditorMaterials__empty__title">{__('empty.title')}</h3>
                        <p class="BillingEditorMaterials__empty__content">
                            {__('empty.content')}
                        </p>
                    </div>
                </div>
            );
        }

        const classNames = ['BillingEditorMaterials', {
            'BillingEditorMaterials--compact': isCompact,
            'BillingEditorMaterials--no-taxes': !isTaxesEnabled,
        }];

        return (
            <div class={classNames}>
                <div class="BillingEditorMaterials__header">
                    {[...columns.values()].map((column: Column) => (
                        <div
                            key={column.key}
                            class={[
                                'BillingEditorMaterials__header__cell',
                                `BillingEditorMaterials__header__cell--${column.key}`,
                            ]}
                        >
                            {column.title}
                        </div>
                    ))}
                </div>
                <div class="BillingEditorMaterials__items">
                    {materials.map((material: BillingMaterial) => {
                        const dataIndex = data.findIndex((_datum: RawMaterialBillingData) => (
                            _datum.id === material.id
                        ));

                        const errors = dataIndex !== -1
                            ? (allErrors as Record<number, any> | undefined)?.[dataIndex]
                            : undefined;

                        const renderedName = columns.get('name')?.render(material, errors) ?? null;
                        const renderedActions = columns.get('actions')?.render(material, errors) ?? null;

                        return (
                            <div key={material.id} class="BillingEditorMaterials__item">
                                <header class="BillingEditorMaterials__item__legend">
                                    {renderedName}
                                    {renderedActions !== null && (
                                        <div class="BillingEditorMaterials__item__legend__actions">
                                            {renderedActions}
                                        </div>
                                    )}
                                </header>
                                {[...columns.values()].map((column: Column) => {
                                    if (column.key === 'actions') {
                                        return (
                                            <div
                                                key={column.key}
                                                class="BillingEditorMaterials__item__actions"
                                            >
                                                {renderedActions}
                                            </div>
                                        );
                                    }

                                    return (
                                        <div
                                            key={column.key}
                                            class={[
                                                'BillingEditorMaterials__item__field',
                                                `BillingEditorMaterials__item__field--${column.key}`,
                                            ]}
                                        >
                                            <span class="BillingEditorMaterials__item__field__label">
                                                {column.title}
                                            </span>
                                            <div class="BillingEditorMaterials__item__field__value">
                                                {column.render(material, errors)}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    },
});

export default BillingEditorMaterials;
