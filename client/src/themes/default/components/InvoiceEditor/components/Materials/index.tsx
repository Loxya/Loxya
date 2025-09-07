import './index.scss';
import Decimal from 'decimal.js';
import { confirm } from '@/utils/alert';
import { defineComponent, markRaw } from 'vue';
import { ClientTable, Variant as TableVariant } from '@/themes/default/components/Table';
import Dropdown from '@/themes/default/components/Dropdown';
import Button from '@/themes/default/components/Button';
import Input from '@/themes/default/components/Input';
import formatAmount from '@/utils/formatAmount';

import type { CreateElement, PropType } from 'vue';
import type { Columns } from '@/themes/default/components/Table/Client';
import type { BillingMaterial, RawMaterialBillingData } from '../../_types';
import type Currency from '@/utils/currency';

type Props = {
    /** Les matériels dont on veut éditer la facturation. */
    materials: BillingMaterial[],

    /** Les données bruts en cours d'edition. */
    data: RawMaterialBillingData[],

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

/** La liste du matériel dans l'éditeur de facture. */
const InvoiceEditorMaterials = defineComponent({
    name: 'InvoiceEditorMaterials',
    props: {
        materials: {
            type: Array as PropType<Props['materials']>,
            required: true,
        },
        data: {
            type: Array as PropType<Props['data']>,
            required: true,
        },
        hasTaxes: {
            type: Boolean as PropType<Props['hasTaxes']>,
            required: true,
        },
        currency: {
            type: Object as PropType<Props['currency']>,
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
    computed: {
        columns(): Columns<BillingMaterial> {
            const {
                __,
                data,
                errors,
                hasTaxes,
                currency,
                handleResyncData,
                handleInputPrice,
                handleChangePrice,
                handleInputDiscount,
                handleChangeDiscount,
            } = this;

            return [
                {
                    key: 'name',
                    title: __('columns.name'),
                    class: [
                        'InvoiceEditorMaterials__item__cell',
                        'InvoiceEditorMaterials__item__cell--name',
                    ],
                    render: (h: CreateElement, material: BillingMaterial) => (
                        <span class="InvoiceEditorMaterials__item__name">
                            <span
                                class={[
                                    'InvoiceEditorMaterials__item__name__name',
                                    {
                                        'InvoiceEditorMaterials__item__name__name--unsynced': (
                                            material.name.isUnsynced
                                        ),
                                    },
                                ]}
                            >
                                {material.name.current}
                            </span>
                            <span
                                class={[
                                    'InvoiceEditorMaterials__item__name__reference',
                                    {
                                        'InvoiceEditorMaterials__item__name__reference--unsynced': (
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
                    class: [
                        'InvoiceEditorMaterials__item__cell',
                        'InvoiceEditorMaterials__item__cell--price',
                    ],
                    render: (h: CreateElement, material: BillingMaterial) => {
                        const renderValue = (): JSX.Element => {
                            const index = data.findIndex((_datum: RawMaterialBillingData) => (
                                _datum.id === material.id
                            ));

                            const validationError = index !== -1
                                ? errors?.[index]?.unit_price
                                : undefined;

                            return (
                                <span
                                    class={[
                                        'InvoiceEditorMaterials__item__price__input',
                                        {
                                            'InvoiceEditorMaterials__item__price__input--unsynced': (
                                                material.unit_price.isUnsynced
                                            ),
                                        },
                                    ]}
                                >
                                    <Input
                                        type="number"
                                        value={material.unit_price.current.toString()}
                                        invalid={!!validationError}
                                        addon={currency.symbol}
                                        step={0.01}
                                        class="InvoiceEditorMaterials__item__price__input__field"
                                        onInput={(newValue: string) => {
                                            handleInputPrice(material.id, newValue);
                                        }}
                                        onChange={(newValue: string) => {
                                            handleChangePrice(material.id, newValue);
                                        }}
                                    />
                                </span>
                            );
                        };

                        return (
                            <span class="InvoiceEditorMaterials__item__price">
                                {renderValue()}
                                <span
                                    class={[
                                        'InvoiceEditorMaterials__item__price__degressive-rate',
                                        {
                                            'InvoiceEditorMaterials__item__price__degressive-rate--unsynced': (
                                                material.degressive_rate.isUnsynced
                                            ),
                                        },
                                    ]}
                                >
                                    {material.degressive_rate.current.toFixed(2)}
                                </span>
                                <span class="InvoiceEditorMaterials__item__price__total">
                                    {formatAmount(material.unit_price_period, currency)}
                                </span>
                            </span>
                        );
                    },
                },
                {
                    key: 'quantity',
                    title: __('columns.quantity'),
                    class: [
                        'InvoiceEditorMaterials__item__cell',
                        'InvoiceEditorMaterials__item__cell--quantity',
                    ],
                    render: (h: CreateElement, material: BillingMaterial) => (
                        <span class="InvoiceEditorMaterials__item__quantity">
                            {material.quantity}
                        </span>
                    ),
                },
                {
                    key: 'discount-rate',
                    title: __('columns.discount'),
                    class: [
                        'InvoiceEditorMaterials__item__cell',
                        'InvoiceEditorMaterials__item__cell--discount',
                    ],
                    render: (h: CreateElement, material: BillingMaterial) => {
                        if (!material.is_discountable && material.discount_rate.isZero()) {
                            return (
                                <p
                                    class={[
                                        'InvoiceEditorMaterials__item__discount',
                                        'InvoiceEditorMaterials__item__discount--not-applicable',
                                    ]}
                                >
                                    {__('discount-not-applicable')}
                                </p>
                            );
                        }

                        const renderValue = (): JSX.Element => {
                            const index = data.findIndex((_datum: RawMaterialBillingData) => (
                                _datum.id === material.id
                            ));

                            const validationError = index !== -1
                                ? errors?.[index]?.discount_rate
                                : undefined;

                            return (
                                <Input
                                    type="number"
                                    value={material.discount_rate.toString()}
                                    invalid={!!validationError}
                                    addon="%"
                                    class="InvoiceEditorMaterials__item__discount__input"
                                    onInput={(newValue: string) => {
                                        handleInputDiscount(material.id, newValue);
                                    }}
                                    onChange={(newValue: string) => {
                                        handleChangeDiscount(material.id, newValue);
                                    }}
                                />
                            );
                        };

                        return (
                            <div class="InvoiceEditorMaterials__item__discount">
                                {renderValue()}
                            </div>
                        );
                    },
                },
                {
                    key: 'total-without-taxes',
                    title: hasTaxes
                        ? __('columns.total-without-taxes')
                        : __('columns.total'),
                    class: [
                        'InvoiceEditorMaterials__item__cell',
                        'InvoiceEditorMaterials__item__cell--total-without-taxes',
                    ],
                    render: (h: CreateElement, material: BillingMaterial) => (
                        <span class="InvoiceEditorMaterials__item__total-without-taxes">
                            {formatAmount(material.total_without_taxes, currency)}
                        </span>
                    ),
                },
                {
                    key: 'actions',
                    class: [
                        'InvoiceEditorMaterials__item__cell',
                        'InvoiceEditorMaterials__item__cell--actions',
                    ],
                    render: (h: CreateElement, material: BillingMaterial) => {
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
            ];
        },
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

        __(key: string, params?: Record<string, number | string>, count?: number): string {
            key = !key.startsWith('global.')
                ? `components.InvoiceEditor.lists.materials.${key}`
                : key.replace(/^global\./, '');

            return this.$t(key, params, count);
        },
    },
    render() {
        const { __, materials, columns } = this;

        if (materials.length <= 0) {
            return (
                <div class="InvoiceEditorMaterials InvoiceEditorMaterials--empty">
                    <div class="InvoiceEditorMaterials__empty">
                        <h3 class="InvoiceEditorMaterials__empty__title">{__('empty.title')}</h3>
                        <p class="InvoiceEditorMaterials__empty__content">
                            {__('empty.content')}
                        </p>
                    </div>
                </div>
            );
        }

        return (
            <div class="InvoiceEditorMaterials">
                <ClientTable
                    uniqueKey="key"
                    variant={TableVariant.LIGHT}
                    resizable={false}
                    paginated={false}
                    columns={columns}
                    data={materials}
                />
            </div>
        );
    },
});

export default InvoiceEditorMaterials;
