import './index.scss';
import omit from 'lodash/omit';
import pick from 'lodash/pick';
import Decimal from 'decimal.js';
import { defineComponent, markRaw } from 'vue';
import { ClientTable, Variant as TableVariant } from '@/themes/default/components/Table';
import QuantityInput from '@/themes/default/components/QuantityInput';
import EmptyMessage from '@/themes/default/components/EmptyMessage';
import Dropdown from '@/themes/default/components/Dropdown';
import Button from '@/themes/default/components/Button';
import Select from '@/themes/default/components/Select';
import Input from '@/themes/default/components/Input';
import formatAmount from '@/utils/formatAmount';

import type { CreateElement, PropType } from 'vue';
import type Currency from '@/utils/currency';
import type { ExtraBillingTaxData } from '@/stores/api/bookings';
import type { Columns } from '@/themes/default/components/Table/Client';
import type { BillingExtra, RawExtraBillingData, Tax } from '../../_types';
import type { Options } from '@/utils/formatOptions';
import type { Tax as CoreTax } from '@/stores/api/taxes';

type Props = {
    /** Les extras dont on veut éditer la facturation. */
    extras: BillingExtra[],

    /** Les données bruts en cours d'edition. */
    data: RawExtraBillingData[],

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
     * @param extraId - L'identifiant interne de l'extra à supprimer.
     */
    onRemove?(extraId: RawExtraBillingData['_id']): void,

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
     * @param extraId - L'identifiant interne de l'extra à resynchroniser.
     */
    onRequestResync?(extraId: RawExtraBillingData['_id']): void,
};

/** La liste des lignes extras dans l'éditeur de facture. */
const InvoiceEditorExtras = defineComponent({
    name: 'InvoiceEditorExtras',
    props: {
        extras: {
            type: Array as PropType<Props['extras']>,
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
    computed: {
        allTaxes(): CoreTax[] {
            return this.$store.state.taxes.list;
        },

        taxesOptions(): Options<CoreTax> {
            return this.$store.getters['taxes/options'];
        },

        columns(): Columns<BillingExtra> {
            const {
                __,
                data,
                errors,
                hasTaxes,
                currency,
                taxesOptions,
                handleChangeTax,
                handleRemoveExtra,
                handleResyncData,
                handleChangeQuantity,
                handleInputUnitPrice,
                handleChangeUnitPrice,
                handleChangeDescription,
            } = this;

            return [
                {
                    key: 'name',
                    title: __('columns.name'),
                    class: [
                        'InvoiceEditorExtras__item__cell',
                        'InvoiceEditorExtras__item__cell--name',
                    ],
                    render: (h: CreateElement, extra: BillingExtra) => {
                        const index = data.findIndex((_datum: RawExtraBillingData) => (
                            _datum._id === extra._id
                        ));

                        const validationError = index !== -1
                            ? errors?.[index]?.description
                            : undefined;

                        return (
                            <Input
                                type="text"
                                value={extra.description}
                                invalid={!!validationError}
                                onInput={(newValue: string) => {
                                    handleChangeDescription(extra._id, newValue);
                                }}
                            />
                        );
                    },
                },
                {
                    key: 'unit-price',
                    title: __('columns.unit-price'),
                    class: [
                        'InvoiceEditorExtras__item__cell',
                        'InvoiceEditorExtras__item__cell--unit-price',
                    ],
                    render: (h: CreateElement, extra: BillingExtra) => {
                        const index = data.findIndex((_datum: RawExtraBillingData) => (
                            _datum._id === extra._id
                        ));

                        const validationError = index !== -1
                            ? errors?.[index]?.unit_price
                            : undefined;

                        return (
                            <Input
                                type="number"
                                value={extra.unit_price?.toString() ?? null}
                                invalid={!!validationError}
                                addon={currency.symbol}
                                step={0.01}
                                onInput={(newValue: string) => {
                                    handleInputUnitPrice(extra._id, newValue);
                                }}
                                onChange={(newValue: string) => {
                                    handleChangeUnitPrice(extra._id, newValue);
                                }}
                            />
                        );
                    },
                },
                {
                    key: 'quantity',
                    title: __('columns.quantity'),
                    class: [
                        'InvoiceEditorExtras__item__cell',
                        'InvoiceEditorExtras__item__cell--quantity',
                    ],
                    render: (h: CreateElement, extra: BillingExtra) => (
                        <QuantityInput
                            value={extra.quantity}
                            limit={{ min: 1, max: 65_000 }}
                            onChange={(newValue: number) => {
                                handleChangeQuantity(extra._id, newValue);
                            }}
                        />
                    ),
                },
                {
                    key: 'taxes',
                    title: __('columns.taxes'),
                    class: [
                        'InvoiceEditorExtras__item__cell',
                        'InvoiceEditorExtras__item__cell--taxes',
                    ],
                    render: (h: CreateElement, extra: BillingExtra) => {
                        // - Si on a pas de taxe sélectionnée et qu'on a un reliquat de détails
                        //   de taxes, c'est que la taxe a été supprimée entres temps.
                        if (
                            extra.tax_id === null &&
                            extra.taxes.base.length === 0 &&
                            extra.taxes.current.length > 0
                        ) {
                            const readableTax = extra.taxes.current
                                .map((tax: Tax<Decimal>) => {
                                    const taxValue = tax.is_rate
                                        ? `${tax.value.toString()}%`
                                        : formatAmount(tax.value, currency);

                                    return `${tax.name} (${taxValue})`;
                                })
                                .join(' + ');

                            return (
                                <span class="InvoiceEditorExtras__item__obsolete-tax">
                                    <span class="InvoiceEditorExtras__item__obsolete-tax__title">
                                        {__('obsolete-tax')}
                                    </span>
                                    <span class="InvoiceEditorExtras__item__obsolete-tax__details">
                                        {readableTax}
                                    </span>
                                </span>
                            );
                        }

                        return (
                            <span
                                class={[
                                    'InvoiceEditorExtras__item__tax',
                                    {
                                        'InvoiceEditorExtras__item__tax--unsynced': (
                                            extra.taxes.isUnsynced
                                        ),
                                    },
                                ]}
                            >
                                <Select
                                    value={extra.tax_id}
                                    options={taxesOptions}
                                    placeholder={__('tax-free')}
                                    class="InvoiceEditorExtras__item__tax__input"
                                    onChange={(newValue: CoreTax['id'] | null) => {
                                        handleChangeTax(extra._id, newValue);
                                    }}
                                />
                            </span>
                        );
                    },
                },
                {
                    key: 'total-without-taxes',
                    title: hasTaxes
                        ? __('columns.total-without-taxes')
                        : __('columns.total'),
                    class: [
                        'InvoiceEditorExtras__item__cell',
                        'InvoiceEditorExtras__item__cell--total-without-taxes',
                    ],
                    render: (h: CreateElement, extra: BillingExtra) => (
                        formatAmount(extra.total_without_taxes, currency)
                    ),
                },
                {
                    key: 'actions',
                    class: [
                        'InvoiceEditorExtras__item__cell',
                        'InvoiceEditorExtras__item__cell--actions',
                    ],
                    render: (h: CreateElement, extra: BillingExtra) => (
                        <Dropdown>
                            {extra.is_resyncable && (
                                <Button
                                    icon="sync-alt"
                                    onClick={() => { handleResyncData(extra._id); }}
                                >
                                    {__('actions.resync-data')}
                                </Button>
                            )}
                            <Button
                                type="delete"
                                onClick={() => { handleRemoveExtra(extra._id); }}
                            >
                                {__('actions.remove-line')}
                            </Button>
                        </Dropdown>
                    ),
                },
            ];
        },
    },
    mounted() {
        this.$store.dispatch('taxes/fetch');
    },
    methods: {
        // ------------------------------------------------------
        // -
        // -    Handlers
        // -
        // ------------------------------------------------------

        handleChangeDescription(id: BillingExtra['_id'], value: string) {
            const datum = this.data.find((_datum: RawExtraBillingData) => _datum._id === id);
            if (datum === undefined) {
                return;
            }
            this.$emit('change', { ...datum, description: value });
        },

        handleInputUnitPrice(id: BillingExtra['_id'], rawValue: string) {
            // - Si l'entrée n'est pas (encore) un nombre valide, on ne fait rien.
            //   (l'événement `onChange` se chargera de remettre le champ en ordre
            //    si jamais le blur est atteint sans correction de l'entrée)
            if (!/^-?\d+(?:\.\d+)?$/.test(rawValue)) {
                return;
            }

            const datum = this.data.find((_datum: RawExtraBillingData) => _datum._id === id);
            if (datum === undefined) {
                return;
            }

            const value = markRaw(
                Decimal.min(Decimal.max(rawValue, -1_000_000_000_000 + 1), 1_000_000_000_000 - 1)
                    .toDecimalPlaces(2, Decimal.ROUND_DOWN),
            );

            this.$emit('change', { ...datum, unit_price: value });
        },

        handleChangeUnitPrice(id: BillingExtra['_id'], rawValue: string) {
            rawValue = rawValue.trim().replaceAll(',', '.');
            rawValue = rawValue.endsWith('.') ? `${rawValue}0` : rawValue;
            if (!/^-?\d+(?:\.\d+)?$/.test(rawValue)) {
                rawValue = '0';
            }

            const datum = this.data.find((_datum: RawExtraBillingData) => _datum._id === id);
            if (datum === undefined) {
                return;
            }

            const value = markRaw(
                Decimal.min(Decimal.max(rawValue, -1_000_000_000_000 + 1), 1_000_000_000_000 - 1)
                    .toDecimalPlaces(2, Decimal.ROUND_DOWN),
            );

            this.$emit('change', { ...datum, unit_price: value });
        },

        handleChangeQuantity(id: BillingExtra['_id'], newValue: number) {
            const datum = this.data.find((_datum: RawExtraBillingData) => _datum._id === id);
            if (datum === undefined) {
                return;
            }

            const value = Math.min(65_000, Math.max(newValue, 1));
            this.$emit('change', { ...datum, quantity: value });
        },

        handleChangeTax(id: BillingExtra['_id'], newValue: CoreTax['id'] | null) {
            const datum = this.data.find((_datum: RawExtraBillingData) => _datum._id === id);
            if (datum === undefined) {
                return;
            }

            if (newValue === null) {
                this.$emit('change', { ...omit(datum, ['taxes']), tax_id: null });
                return;
            }

            const tax: CoreTax | undefined = this.allTaxes.find(
                ({ id: _id }: CoreTax) => _id === newValue,
            );
            if (tax === undefined) {
                return;
            }

            const taxes: ExtraBillingTaxData[] = !tax.is_group
                ? [pick(tax, ['name', 'is_rate', 'value'])]
                : tax.components;

            this.$emit('change', { ...datum, tax_id: newValue, taxes });
        },

        handleResyncData(id: BillingExtra['_id']) {
            const extra = this.extras.find((_extra: BillingExtra) => _extra._id === id);
            if (!extra || !extra.is_resyncable) {
                return;
            }
            this.$emit('requestResync', extra._id);
        },

        handleAddExtraLine() {
            this.$emit('add');
        },

        handleRemoveExtra(id: RawExtraBillingData['_id']) {
            this.$emit('remove', id);
        },

        // ------------------------------------------------------
        // -
        // -    Méthodes internes
        // -
        // ------------------------------------------------------

        __(key: string, params?: Record<string, number | string>, count?: number): string {
            key = !key.startsWith('global.')
                ? `components.InvoiceEditor.lists.extras.${key}`
                : key.replace(/^global\./, '');

            return this.$t(key, params, count);
        },
    },
    render() {
        const { __, extras, columns, handleAddExtraLine } = this;

        if (extras.length <= 0) {
            return (
                <div class="InvoiceEditorExtras InvoiceEditorExtras--empty">
                    <EmptyMessage
                        size="small"
                        message={__('empty')}
                        action={{
                            type: 'add',
                            label: __('actions.add-line'),
                            onClick: handleAddExtraLine,
                        }}
                    />
                </div>
            );
        }

        return (
            <div class="InvoiceEditorExtras">
                <ClientTable
                    uniqueKey="key"
                    variant={TableVariant.LIGHT}
                    resizable={false}
                    paginated={false}
                    columns={columns}
                    data={extras}
                />
                <Button
                    type="add"
                    onClick={handleAddExtraLine}
                    class="InvoiceEditorExtras__add-button"
                >
                    {__('actions.add-line')}
                </Button>
            </div>
        );
    },
});

export default InvoiceEditorExtras;
