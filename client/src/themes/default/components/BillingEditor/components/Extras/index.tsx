import './index.scss';
import pick from 'lodash/pick';
import Decimal from 'decimal.js';
import config from '@/globals/config';
import isTruthy from '@/utils/isTruthy';
import { defineComponent, inject, markRaw } from 'vue';
import TaxRegime from '@/utils/invoicing/tax-regime';
import ProductType from '@/utils/invoicing/product-type';
import InputQuantity from '@/themes/default/components/InputQuantity';
import EmptyMessage from '@/themes/default/components/EmptyMessage';
import Dropdown from '@/themes/default/components/Dropdown';
import Button from '@/themes/default/components/Button';
import Select from '@/themes/default/components/Select';
import Input from '@/themes/default/components/Input';
import formatAmount from '@/utils/formatAmount';
import getTaxOptionsFactory from '../../utils/getTaxOptions';
import { IsCompactKey, IsStandaloneKey } from '../../_constants';

// - Modales
import SelectExemptionCodeModal from '../../modals/SelectExemptionCode';

import type Country from '@/utils/country';
import type Currency from '@/utils/currency';
import type { Injected, PropType } from 'vue';
import type { Tax as LiveTax } from '@/stores/api/taxes';
import type { BillingLineTaxData } from '@/stores/api/bookings';
import type { TaxOption } from '../../utils/getTaxOptions';
import type {
    BillingExtra,
    Buyer,
    LineTax,
    LineTaxDetail,
    RawExtraBillingData,
} from '../../_types';

type Column = {
    key: string,
    title?: string,
    render(
        extra: BillingExtra,
        errors: Record<string, any> | undefined,
    ): JSX.Element | null,
};

type Props = {
    /** Les extras dont on veut éditer la facturation. */
    extras: BillingExtra[],

    /** Les données bruts en cours d'edition. */
    data: RawExtraBillingData[],

    /** L'acheteur concerné par la facturation. */
    buyer: Buyer | null,

    /** La devise à utiliser pour les prix. */
    currency: Currency,

    /** L'affichage doit-il prendre en charge des taxes ? */
    hasTaxes: boolean,

    /** Les éventuelles erreurs de validation liées aux extras. */
    errors?: Record<number, any> | string[],

    /**
     * Fonction appelée lorsque l'utilisateur demande à ajouter
     * une ligne d'extra.
     */
    onAdd?(): void,

    /**
     * Fonction appelée lorsque l'utilisateur demande à supprimer
     * une ligne d'extra.
     *
     * @param extraUuid - L'identifiant de l'extra à supprimer.
     */
    onRemove?(extraUuid: RawExtraBillingData['uuid']): void,

    /**
     * Fonction appelée lorsque les données d'une ligne extra changent.
     *
     * @param updatedExtra - Les données de la ligne, mises à jour.
     */
    onChange?(updatedExtra: RawExtraBillingData): void,

    /**
     * Fonction appelée lorsque l'utilisateur demande la
     * resynchronisation des données d'une ligne d'extra.
     *
     * @param extraUuid - L'identifiant de l'extra à resynchroniser.
     */
    onRequestResync?(extraUuid: RawExtraBillingData['uuid']): void,
};

type InstanceProperties = {
    isCompact: Injected<typeof IsCompactKey>,
    isStandalone: Injected<typeof IsStandaloneKey>,
};

/** La liste des lignes extras dans l'éditeur de facture. */
const BillingEditorExtras = defineComponent({
    name: 'BillingEditorExtras',
    props: {
        extras: {
            type: Array as PropType<Props['extras']>,
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
        onAdd: {
            type: Function as PropType<Props['onAdd']>,
            default: undefined,
        },
        // eslint-disable-next-line vue/no-unused-properties
        onRemove: {
            type: Function as PropType<Props['onRemove']>,
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
        'add',
        'remove',
        'change',
        'requestResync',
    ],
    setup: (): InstanceProperties => ({
        isCompact: inject(IsCompactKey)!,
        isStandalone: inject(IsStandaloneKey)!,
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
                handleRemoveExtra,
                handleResyncData,
                handleInputDiscount,
                handleChangeDiscount,
                handleChangeQuantity,
                handleInputUnitPrice,
                handleChangeIsService,
                handleChangeUnitPrice,
                handleChangeDescription,
            } = this;

            const entries = [
                {
                    key: 'name',
                    title: __('columns.name'),
                    render: (extra: BillingExtra, errors: Record<string, any> | undefined) => (
                        <Input
                            type="text"
                            value={extra.description}
                            invalid={!!errors?.description}
                            onInput={(newValue: string) => {
                                handleChangeDescription(extra.uuid, newValue);
                            }}
                        />
                    ),
                },
                {
                    key: 'type',
                    title: __('columns.type'),
                    render: (extra: BillingExtra, errors: Record<string, any> | undefined) => {
                        const isAllowance = extra.unit_price?.isNegative() ?? false;
                        if (isAllowance) {
                            return (
                                <span
                                    class={[
                                        'BillingEditorExtras__item__type',
                                        'BillingEditorExtras__item__type--static',
                                    ]}
                                >
                                    {__('type.allowance')}
                                </span>
                            );
                        }

                        return (
                            <Select
                                value={extra.is_service ? ProductType.SERVICE : ProductType.GOOD}
                                options={[
                                    { value: ProductType.SERVICE, label: __('type.service') },
                                    { value: ProductType.GOOD, label: __('type.good') },
                                ]}
                                placeholder={false}
                                invalid={!!errors?.is_service}
                                class="BillingEditorExtras__item__type"
                                onChange={(newValue: ProductType) => {
                                    const isService = newValue === ProductType.SERVICE;
                                    handleChangeIsService(extra.uuid, isService);
                                }}
                            />
                        );
                    },
                },
                {
                    key: 'unit-price',
                    title: __('columns.unit-price'),
                    render: (extra: BillingExtra, errors: Record<string, any> | undefined) => (
                        <Input
                            type="text"
                            value={extra.unit_price?.toString() ?? null}
                            invalid={!!errors?.unit_price}
                            addon={currency.symbol}
                            onInput={(newValue: string) => {
                                handleInputUnitPrice(extra.uuid, newValue);
                            }}
                            onChange={(newValue: string) => {
                                handleChangeUnitPrice(extra.uuid, newValue);
                            }}
                        />
                    ),
                },
                {
                    key: 'quantity',
                    title: __('columns.quantity'),
                    render: (extra: BillingExtra) => (
                        <InputQuantity
                            value={extra.quantity}
                            limit={{ min: 1, max: 65_000 }}
                            onChange={(newValue: number) => {
                                handleChangeQuantity(extra.uuid, newValue);
                            }}
                        />
                    ),
                },
                isTaxesEnabled && {
                    key: 'taxes',
                    title: (
                        isSimpleVatSystem
                            ? __('columns.taxes.simple')
                            : __('columns.taxes.default')
                    ),
                    render: (extra: BillingExtra) => {
                        const tax: LineTaxDetail = {
                            regime: extra.tax_regime.current!,
                            exemptionCode: extra.tax_exemption_code.current,
                            taxId: extra.tax_id.current,
                            taxes: extra.taxes.current,
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
                                <span class="BillingEditorExtras__item__obsolete-tax">
                                    <span class="BillingEditorExtras__item__obsolete-tax__title">
                                        {__('obsolete-tax')}
                                    </span>
                                    <span class="BillingEditorExtras__item__obsolete-tax__details">
                                        {readableTax}
                                    </span>
                                </span>
                            );
                        }

                        const context = { buyer, sellerCountry, normalTaxes, translator: __c };
                        const { options, selected } = getTaxOptionsFactory(context)(extra.is_service, tax);

                        const isUnsynced = (
                            extra.tax_regime.isUnsynced ||
                            extra.tax_exemption_code.isUnsynced ||
                            extra.tax_id.isUnsynced ||
                            extra.taxes.isUnsynced
                        );
                        return (
                            <span
                                class={[
                                    'BillingEditorExtras__item__tax',
                                    { 'BillingEditorExtras__item__tax--unsynced': isUnsynced },
                                ]}
                            >
                                <Select
                                    value={selected}
                                    options={options}
                                    placeholder={__('component.tax-state.none.inline')}
                                    class="BillingEditorExtras__item__tax__input"
                                    onChange={(newValue: TaxOption | null) => {
                                        handleChangeTax(extra.uuid, newValue);
                                    }}
                                />
                            </span>
                        );
                    },
                },
                {
                    key: 'discount',
                    title: __('columns.discount'),
                    render: (extra: BillingExtra, errors: Record<string, any> | undefined) => {
                        const isAllowance = extra.unit_price?.isNegative() ?? false;
                        return (
                            <div class="BillingEditorExtras__item__discount">
                                <Input
                                    type="text"
                                    value={extra.discount_rate.toString()}
                                    invalid={!!errors?.discount_rate}
                                    disabled={isAllowance}
                                    addon="%"
                                    class="BillingEditorExtras__item__discount__input"
                                    onInput={(newValue: string) => {
                                        handleInputDiscount(extra.uuid, newValue);
                                    }}
                                    onChange={(newValue: string) => {
                                        handleChangeDiscount(extra.uuid, newValue);
                                    }}
                                />
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
                    render: (extra: BillingExtra) => (
                        <span class="BillingEditorExtras__item__total-without-taxes">
                            {formatAmount(extra.total_without_taxes, currency)}
                        </span>
                    ),
                },
                {
                    key: 'actions',
                    render: (extra: BillingExtra) => (
                        <Dropdown>
                            {extra.is_resyncable && (
                                <Button
                                    icon="sync-alt"
                                    onClick={() => { handleResyncData(extra.uuid); }}
                                >
                                    {__('actions.resync-data')}
                                </Button>
                            )}
                            <Button
                                type="delete"
                                onClick={() => { handleRemoveExtra(extra.uuid); }}
                            >
                                {__('actions.remove-line')}
                            </Button>
                        </Dropdown>
                    ),
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

        handleChangeDescription(uuid: BillingExtra['uuid'], value: string) {
            const datum = this.data.find((_datum: RawExtraBillingData) => _datum.uuid === uuid);
            if (datum === undefined) {
                return;
            }
            this.$emit('change', { ...datum, description: value });
        },

        handleChangeIsService(uuid: BillingExtra['uuid'], newValue: boolean) {
            const datum = this.data.find((_datum: RawExtraBillingData) => _datum.uuid === uuid);
            if (datum === undefined) {
                return;
            }
            this.$emit('change', { ...datum, is_service: newValue });
        },

        handleInputUnitPrice(uuid: BillingExtra['uuid'], rawValue: string) {
            // - Si l'entrée n'est pas (encore) un nombre valide, on ne fait rien.
            //   (l'événement `onChange` se chargera de remettre le champ en ordre
            //    si jamais le blur est atteint sans correction de l'entrée)
            if (!/^-?\d+(?:\.\d+)?$/.test(rawValue)) {
                return;
            }

            const datum = this.data.find((_datum: RawExtraBillingData) => _datum.uuid === uuid);
            if (datum === undefined) {
                return;
            }

            const value = markRaw(
                Decimal.min(Decimal.max(rawValue, -1_000_000_000_000 + 1), 1_000_000_000_000 - 1)
                    .toDecimalPlaces(2, Decimal.ROUND_DOWN),
            );

            const updates: Partial<RawExtraBillingData> = { unit_price: value };

            // - Les déductions (extras avec prix négatif) sont forcément des services sans remise.
            if (value.isNegative()) {
                updates.is_service = true;
                updates.discount_rate = markRaw(new Decimal(0));
            }

            this.$emit('change', { ...datum, ...updates });
        },

        handleChangeUnitPrice(uuid: BillingExtra['uuid'], rawValue: string) {
            rawValue = rawValue.trim().replaceAll(',', '.');
            rawValue = rawValue.endsWith('.') ? `${rawValue}0` : rawValue;
            if (!/^-?\d+(?:\.\d+)?$/.test(rawValue)) {
                rawValue = '0';
            }

            const datum = this.data.find((_datum: RawExtraBillingData) => _datum.uuid === uuid);
            if (datum === undefined) {
                return;
            }

            const value = markRaw(
                Decimal.min(Decimal.max(rawValue, -1_000_000_000_000 + 1), 1_000_000_000_000 - 1)
                    .toDecimalPlaces(2, Decimal.ROUND_DOWN),
            );

            const updates: Partial<RawExtraBillingData> = { unit_price: value };

            // - Les déductions (extras avec prix négatif) sont forcément des services sans remise.
            if (value.isNegative()) {
                updates.is_service = true;
                updates.discount_rate = markRaw(new Decimal(0));
            }

            this.$emit('change', { ...datum, ...updates });
        },

        handleChangeQuantity(uuid: BillingExtra['uuid'], newValue: number) {
            const datum = this.data.find((_datum: RawExtraBillingData) => _datum.uuid === uuid);
            if (datum === undefined) {
                return;
            }

            const value = Math.min(65_000, Math.max(newValue, 1));
            this.$emit('change', { ...datum, quantity: value });
        },

        async handleChangeTax(uuid: BillingExtra['uuid'], selection: TaxOption | null) {
            if (!this.isTaxesEnabled) {
                return;
            }

            const datum = this.data.find((_datum) => _datum.uuid === uuid);
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
                        const freshDatum = this.data.find((_datum) => _datum.uuid === uuid);
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

        handleInputDiscount(uuid: BillingExtra['uuid'], rawValue: string) {
            // - Si l'entrée n'est pas (encore) un nombre valide, on ne fait rien.
            //   (l'événement `onChange` se chargera de remettre le champ en ordre
            //    si jamais le blur est atteint sans correction de l'entrée)
            if (!/^\d+(?:\.\d+)?$/.test(rawValue)) {
                return;
            }

            const datum = this.data.find((_datum: RawExtraBillingData) => _datum.uuid === uuid);
            if (datum === undefined) {
                return;
            }

            const value = markRaw(
                Decimal.min(Decimal.max(rawValue, 0), 100)
                    .toDecimalPlaces(4, Decimal.ROUND_DOWN),
            );

            this.$emit('change', { ...datum, discount_rate: value });
        },

        handleChangeDiscount(uuid: BillingExtra['uuid'], rawValue: string) {
            rawValue = rawValue.trim().replaceAll(',', '.');
            rawValue = rawValue.endsWith('.') ? `${rawValue}0` : rawValue;
            if (!/^\d+(?:\.\d+)?$/.test(rawValue)) {
                rawValue = '0';
            }

            const datum = this.data.find((_datum: RawExtraBillingData) => _datum.uuid === uuid);
            if (datum === undefined) {
                return;
            }

            const value = markRaw(
                Decimal.min(Decimal.max(rawValue, 0), 100)
                    .toDecimalPlaces(4, Decimal.ROUND_HALF_UP),
            );

            this.$emit('change', { ...datum, discount_rate: value });
        },

        handleResyncData(uuid: BillingExtra['uuid']) {
            const extra = this.extras.find((_extra: BillingExtra) => _extra.uuid === uuid);
            if (!extra || !extra.is_resyncable) {
                return;
            }
            this.$emit('requestResync', extra.uuid);
        },

        handleAddExtraLine() {
            this.$emit('add');
        },

        handleRemoveExtra(uuid: RawExtraBillingData['uuid']) {
            this.$emit('remove', uuid);
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
                    ? `lists.extras.${key}`
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
            extras,
            columns,
            isCompact,
            isStandalone,
            isTaxesEnabled,
            handleAddExtraLine,
        } = this;

        if (extras.length <= 0) {
            return (
                <div class="BillingEditorExtras BillingEditorExtras--empty">
                    <EmptyMessage
                        size="small"
                        message={(
                            this.isStandalone
                                ? __('empty.standalone')
                                : __('empty.default')
                        )}
                        action={{
                            type: 'add',
                            label: __('actions.add-line'),
                            onClick: handleAddExtraLine,
                        }}
                    />
                </div>
            );
        }

        const classNames = ['BillingEditorExtras', {
            'BillingEditorExtras--compact': isCompact,
            'BillingEditorExtras--no-taxes': !isTaxesEnabled,
        }];

        return (
            <div class={classNames}>
                <div class="BillingEditorExtras__header">
                    {[...columns.values()].map((column: Column) => (
                        <div
                            key={column.key}
                            class={[
                                'BillingEditorExtras__header__cell',
                                `BillingEditorExtras__header__cell--${column.key}`,
                            ]}
                        >
                            {column.title}
                        </div>
                    ))}
                </div>
                <div class="BillingEditorExtras__items">
                    {extras.map((extra: BillingExtra, index: number) => {
                        const hasDescription = (extra.description ?? '').trim().length > 0;
                        const dataIndex = data.findIndex((_datum: RawExtraBillingData) => (
                            _datum.uuid === extra.uuid
                        ));

                        const errors = dataIndex !== -1
                            ? (allErrors as Record<number, any> | undefined)?.[dataIndex]
                            : undefined;

                        const renderedActions = columns.get('actions')?.render(extra, errors) ?? null;

                        return (
                            <div key={extra.uuid} class="BillingEditorExtras__item">
                                <header class="BillingEditorExtras__item__legend">
                                    {isStandalone && (
                                        <span class="BillingEditorExtras__item__legend__index">
                                            #{index + 1}
                                        </span>
                                    )}
                                    {hasDescription && (
                                        <span class="BillingEditorExtras__item__legend__title">
                                            {extra.description}
                                        </span>
                                    )}
                                    {(!hasDescription && !isStandalone) && (
                                        <span
                                            class={[
                                                'BillingEditorExtras__item__legend__title',
                                                'BillingEditorExtras__item__legend__title--default',
                                            ]}
                                        >
                                            {__('default-title', { index: index + 1 })}
                                        </span>
                                    )}
                                    <div class="BillingEditorExtras__item__legend__actions">
                                        {renderedActions}
                                    </div>
                                </header>
                                {[...columns.values()].map((column: Column) => {
                                    if (column.key === 'actions') {
                                        return (
                                            <div
                                                key={column.key}
                                                class="BillingEditorExtras__item__actions"
                                            >
                                                {renderedActions}
                                            </div>
                                        );
                                    }

                                    return (
                                        <div
                                            key={column.key}
                                            class={[
                                                'BillingEditorExtras__item__field',
                                                `BillingEditorExtras__item__field--${column.key}`,
                                            ]}
                                        >
                                            <span class="BillingEditorExtras__item__field__label">
                                                {column.title}
                                            </span>
                                            <div class="BillingEditorExtras__item__field__value">
                                                {column.render(extra, errors)}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })}
                </div>
                <Button
                    type="add"
                    onClick={handleAddExtraLine}
                    class="BillingEditorExtras__add-button"
                >
                    {__('actions.add-line')}
                </Button>
            </div>
        );
    },
});

export default BillingEditorExtras;
