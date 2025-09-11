import './index.scss';
import Decimal from 'decimal.js';
import uniqueId from 'lodash/uniqueId';
import showModal from '@/utils/showModal';
import { defineComponent, markRaw } from 'vue';
import hasBillingChanged from './utils/hasBillingChanged';
import getEmbeddedBilling, { getEmbeddedExtraBilling, getEmbeddedMaterialBilling } from './utils/getEmbeddedBilling';
import formatAmount from '@/utils/formatAmount';
import sortTaxes from './utils/sortTaxes';
import getMaterialsDataFactory from './utils/getMaterialsData';
import getExtrasDataFactory from './utils/getExtrasData';
import Input from '@/themes/default/components/Input';
import Fragment from '@/components/Fragment';
import Materials from './components/Materials';
import Extras from './components/Extras';
import {
    convertBookingToRawBillingData,
    convertFromRawBillingData,
} from './utils/convertRawBillingData';

// - Modales
import ResyncExtraData from './modals/ResyncExtraData';
import ResyncMaterialData from './modals/ResyncMaterialData';

import type Currency from '@/utils/currency';
import type { PropType } from 'vue';
import type { Tax as CoreTax } from '@/stores/api/taxes';
import type {
    BillingData,
    Booking,
    BookingExtra,
    BookingMaterial,
    ExtraBillingData,
    MaterialBillingData,
} from '@/stores/api/bookings';
import type {
    Tax,
    TotalTax,
    BillingExtra,
    BillingMaterial,
    RawBillingData,
    RawExtraBillingData,
    RawMaterialBillingData,
} from './_types';

type Props = {
    /** Le booking dont on veut éditer la facturation. */
    booking: Booking<true>,

    /**
     * Les éventuelles erreurs de validation liées à l'éditeur.
     *
     * Attention, cette prop. doit conserver la même identité tant que le jeu d'erreurs
     * n'a pas changé. Lors d'un changement d'identité (= nouvel objet), l'objet est
     * réputé contenir les erreurs actualisées. Ceci est important car des erreurs
     * peuvent être remontées pour des lignes additionnelles qui sont ensuite supprimées.
     * Dans ce cas, ce component maintient en interne une copie du jeu d'erreurs en
     * supprimant les indexes qui ne font plus partie du jeu de données pour éviter que
     * les erreurs ne soient transmises à une future ligne portant le même indexe.
     */
    errors?: Record<string, any>,

    /**
     * Fonction appelée lorsque les données de facturation changent.
     *
     * @param values - Les nouvelles données de facturation.
     */
    onChange?(values: BillingData): void,

    /**
     * Fonction appelée lorsque les données d'un matériel ont été resynchronisées.
     *
     * @param updatedMaterial - Le matériel dont les données ont été resynchronisées.
     */
    onMaterialResynced?(updatedMaterial: BookingMaterial<true>): void,

    /**
     * Fonction appelée lorsque les données d'une ligne extra ont été resynchronisées.
     *
     * @param updatedExtra - La ligne extra dont les données ont été resynchronisées.
     */
    onExtraResynced?(updatedExtra: BookingExtra): void,
};

type Data = {
    data: RawBillingData,
    syncErrors: Record<string, any> | undefined,
};

const getExtraDefaults = (): RawExtraBillingData => ({
    _id: uniqueId(),
    id: null,
    description: null,
    quantity: 1,
    unit_price: null,
    tax_id: null,
});

/** Éditeur de facture d'un booking. */
const InvoiceEditor = defineComponent({
    name: 'InvoiceEditor',
    props: {
        booking: {
            type: Object as PropType<Props['booking']>,
            required: true,
            validator: (booking: Booking): boolean => (
                booking.is_billable
            ),
        },
        errors: {
            type: Object as PropType<Props['errors']>,
            default: undefined,
        },
        // eslint-disable-next-line vue/no-unused-properties
        onChange: {
            type: Function as PropType<Props['onChange']>,
            default: undefined,
        },
        // eslint-disable-next-line vue/no-unused-properties
        onMaterialResynced: {
            type: Function as PropType<Props['onChange']>,
            default: undefined,
        },
        // eslint-disable-next-line vue/no-unused-properties
        onExtraResynced: {
            type: Function as PropType<Props['onChange']>,
            default: undefined,
        },
    },
    emits: [
        'change',
        'materialResynced',
        'extraResynced',
    ],
    data(): Data {
        return {
            data: convertBookingToRawBillingData(this.booking),
            syncErrors: this.errors,
        };
    },
    computed: {
        allTaxes(): CoreTax[] {
            return this.$store.state.taxes.list;
        },

        currency(): Currency {
            return this.booking.currency;
        },

        materials(): BillingMaterial[] {
            const getMaterialsData = getMaterialsDataFactory(this.allTaxes);
            return getMaterialsData(this.booking, this.data.materials);
        },

        extras(): BillingExtra[] {
            const getExtrasData = getExtrasDataFactory(this.allTaxes);
            return getExtrasData(this.booking, this.data.extras);
        },

        totalWithoutGlobalDiscount(): Decimal {
            const { materials, extras } = this;

            return [materials, extras].flat()
                .reduce(
                    (currentTotal: Decimal, line: BillingMaterial | BillingExtra) => (
                        currentTotal.plus(line.total_without_taxes)
                    ),
                    new Decimal(0),
                )
                .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
        },

        globalDiscountRate(): Decimal {
            return this.data.global_discount_rate;
        },

        totalGlobalDiscount(): Decimal {
            const { globalDiscountRate } = this;

            if (globalDiscountRate.lessThanOrEqualTo(0)) {
                return new Decimal(0).toDecimalPlaces(2);
            }

            return this.totalWithoutGlobalDiscount
                .times(globalDiscountRate.dividedBy(100).toDecimalPlaces(6))
                .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
        },

        totalWithoutTaxes(): Decimal {
            return this.totalWithoutGlobalDiscount
                .minus(this.totalGlobalDiscount)
                .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
        },

        totalTaxes(): TotalTax[] {
            const { materials, extras } = this;

            const rawTaxes = [materials, extras].flat().reduce(
                (currentTaxes: Map<string, TotalTax>, line: BillingMaterial | BillingExtra) => {
                    line.taxes.current.forEach((tax: Tax<Decimal>) => {
                        const identifier = JSON.stringify([tax.name, tax.is_rate, tax.value]);
                        if (!currentTaxes.has(identifier)) {
                            currentTaxes.set(identifier, { ...tax, total: new Decimal(0) });
                        }

                        const currentTax = currentTaxes.get(identifier)!;
                        currentTax.total = currentTax.total.plus(
                            !tax.is_rate
                                ? tax.value.times(line.quantity)
                                : line.total_without_taxes.times(
                                    tax.value.dividedBy(100).toDecimalPlaces(5),
                                ),
                        );
                    });

                    return currentTaxes;
                },
                new Map(),
            );

            const taxes: TotalTax[] = [];
            Array.from(rawTaxes.values()).forEach((rawTax: TotalTax) => {
                let total = rawTax.total.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

                if (rawTax.is_rate) {
                    const totalGlobalDiscount = total
                        .times(this.globalDiscountRate.dividedBy(100).toDecimalPlaces(6))
                        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

                    total = total
                        .minus(totalGlobalDiscount)
                        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
                }

                if (total.isZero()) {
                    return;
                }

                taxes.push({ ...rawTax, total });
            });

            return sortTaxes(taxes);
        },

        totalWithTaxes(): Decimal {
            return this.totalTaxes
                .reduce(
                    (currentTotal: Decimal, tax: TotalTax) => (
                        currentTotal.plus(tax.total)
                    ),
                    this.totalWithoutTaxes,
                )
                .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
        },

        hasTaxes(): boolean {
            return this.totalTaxes.length > 0;
        },

        // ------------------------------------------------------
        // -
        // -    API Publique
        // -
        // ------------------------------------------------------

        /**
         * Retourne les données actuelles pour la facturation.
         *
         * @returns Les données actuelles pour la facturation.
         */
        values(): BillingData {
            return convertFromRawBillingData(this.data);
        },
    },
    watch: {
        booking() {
            const oldData = this.data;
            const newData = getEmbeddedBilling(this.booking);

            if (!hasBillingChanged(oldData, newData)) {
                return;
            }

            const materials = newData.materials.map(
                (material: MaterialBillingData) => {
                    const comparator = (_material: RawMaterialBillingData): boolean => _material.id === material.id;
                    return oldData.materials.find(comparator) ?? material;
                },
            );

            const extras = newData.extras
                .map((extra: ExtraBillingData) => {
                    const comparator = (_extra: RawExtraBillingData): boolean => _extra.id === extra.id;
                    return extra.id === null ? extra : oldData.extras.find(comparator) ?? extra;
                })
                .concat(oldData.extras.filter(
                    (extra: RawExtraBillingData) => (
                        extra.id === null
                    ),
                ));

            this.$set(this.data, 'materials', materials);
            this.$set(this.data, 'extras', extras);
            this.$emit('change', this.values);
        },

        errors() {
            this.syncErrors = this.errors;
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

        handleChangeMaterial(updatedMaterial: RawMaterialBillingData) {
            const index = this.data.materials.findIndex(
                (_material: RawMaterialBillingData) => (
                    _material.id === updatedMaterial.id
                ),
            );
            if (index === -1) {
                // eslint-disable-next-line no-console
                console.warn('Material not found for update:', updatedMaterial);
                return;
            }

            this.$set(this.data.materials, index, updatedMaterial);
            this.$emit('change', this.values);
        },

        async handleResyncMaterial(id: BillingMaterial['id']) {
            const material = this.materials.find((_material: BillingMaterial) => _material.id === id);
            if (!material || !material.is_resyncable) {
                return;
            }

            const updatedMaterial: BookingMaterial<true> | undefined = (
                await showModal(this.$modal, ResyncMaterialData, {
                    booking: this.booking,
                    material,
                })
            );
            if (updatedMaterial !== undefined) {
                const index = this.data.materials.findIndex(
                    (_material: RawMaterialBillingData) => (
                        _material.id === updatedMaterial.id
                    ),
                );
                if (index !== -1) {
                    // - On met à jour nos données relatives au matériel.
                    const updatedBillingData = getEmbeddedMaterialBilling(updatedMaterial);
                    this.$set(this.data.materials, index, updatedBillingData);
                }

                this.$emit('materialResynced', updatedMaterial);
            }
        },

        handleChangeExtra(updatedExtra: RawExtraBillingData) {
            const index = this.data.extras.findIndex(
                (_extra: RawExtraBillingData) => (
                    _extra._id === updatedExtra._id
                ),
            );
            if (index === -1) {
                // eslint-disable-next-line no-console
                console.warn('Extra not found for update:', updatedExtra);
                return;
            }

            this.$set(this.data.extras, index, updatedExtra);
            this.$emit('change', this.values);
        },

        async handleResyncExtra(id: BillingExtra['_id']) {
            const extra = this.extras.find((_extra: BillingExtra) => _extra._id === id);
            if (!extra || !extra.is_resyncable) {
                return;
            }

            const updatedExtra: BookingExtra | undefined = (
                await showModal(this.$modal, ResyncExtraData, {
                    booking: this.booking,
                    extra,
                })
            );
            if (updatedExtra !== undefined) {
                const index = this.data.extras.findIndex(
                    (_extra: RawExtraBillingData) => (
                        _extra.id === updatedExtra.id
                    ),
                );
                if (index !== -1) {
                    // - On met à jour nos données relatives à la ligne additionnelle.
                    const updatedBillingData = getEmbeddedExtraBilling(updatedExtra);
                    this.$set(this.data.extras, index, updatedBillingData);
                }

                this.$emit('extraResynced', updatedExtra);
            }
        },

        handleAddExtraLine() {
            this.data.extras.push(getExtraDefaults());
            this.$emit('change', this.values);
        },

        handleRemoveExtraLine(id: RawExtraBillingData['_id']) {
            // - Si l'extra n'existe pas, on ne va pas plus loin, sinon on la récupère.
            const extraIndex = this.data.extras.findIndex(
                (_extra: RawExtraBillingData) => _extra._id === id,
            );
            if (extraIndex === -1) {
                return;
            }

            // - On supprime l'erreur de validation liée à la ligne si elle existe,
            //   pour éviter qu'elle ne soit transférée à une autre ligne.
            if (this.syncErrors?.extras !== undefined) {
                this.$delete(this.syncErrors?.extras, extraIndex);
            }

            // - On supprime l'extra.
            this.data.extras.splice(extraIndex, 1);
            this.$emit('change', this.values);
        },

        handleInputGlobalDiscountRate(rawValue: string) {
            // - Si l'entrée n'est pas (encore) un nombre valide, on ne fait rien.
            //   (l'événement `onChange` se chargera de remettre le champ en ordre
            //    si jamais le blur est atteint sans correction de l'entrée)
            if (!/^\d+(?:\.\d+)?$/.test(rawValue)) {
                return;
            }
            const value = markRaw(Decimal.max(Decimal.min(rawValue, 100), 0));

            this.data.global_discount_rate = value;
            this.$emit('change', this.values);
        },

        handleChangeGlobalDiscountRate(rawValue: string) {
            rawValue = rawValue.trim().replaceAll(',', '.');
            rawValue = rawValue.endsWith('.') ? `${rawValue}0` : rawValue;
            if (!/^\d+(?:\.\d+)?$/.test(rawValue)) {
                rawValue = '0';
            }
            const value = markRaw(Decimal.max(Decimal.min(rawValue, 100), 0));

            this.data.global_discount_rate = value;
            this.$emit('change', this.values);
        },

        handleInputTotalWithoutTaxes(rawValue: string) {
            // - Si l'entrée n'est pas (encore) un nombre valide, on ne fait rien.
            //   (l'événement `onChange` se chargera de remettre le champ en ordre
            //    si jamais le blur est atteint sans correction de l'entrée)
            if (!/^\d+(?:\.\d+)?$/.test(rawValue)) {
                return;
            }
            const value = Decimal.max(Decimal.min(rawValue, this.totalWithoutGlobalDiscount), 0);

            const discountAmount = this.totalWithoutGlobalDiscount.minus(value);
            const discountRate = discountAmount.times(100)
                .dividedBy(this.totalWithoutGlobalDiscount)
                .toDecimalPlaces(4, Decimal.ROUND_HALF_UP);

            this.data.global_discount_rate = markRaw(Decimal.max(Decimal.min(discountRate, 100), 0));
            this.$emit('change', this.values);
        },

        handleChangeTotalWithoutTaxes(rawValue: string) {
            rawValue = rawValue.trim().replaceAll(',', '.');
            rawValue = rawValue.endsWith('.') ? `${rawValue}0` : rawValue;
            if (!/^\d+(?:\.\d+)?$/.test(rawValue)) {
                rawValue = this.totalWithoutGlobalDiscount.toString();
            }
            const value = Decimal.max(Decimal.min(rawValue, this.totalWithoutGlobalDiscount), 0);

            const discountAmount = this.totalWithoutGlobalDiscount.minus(value);
            const discountRate = discountAmount.times(100)
                .dividedBy(this.totalWithoutGlobalDiscount)
                .toDecimalPlaces(4, Decimal.ROUND_HALF_UP);

            this.data.global_discount_rate = markRaw(Decimal.max(Decimal.min(discountRate, 100), 0));
            this.$emit('change', this.values);
        },

        // ------------------------------------------------------
        // -
        // -    Méthodes internes
        // -
        // ------------------------------------------------------

        __(key: string, params?: Record<string, number | string>, count?: number): string {
            key = !key.startsWith('global.')
                ? `components.InvoiceEditor.${key}`
                : key.replace(/^global\./, '');

            return this.$t(key, params, count);
        },
    },
    render() {
        const {
            __,
            data,
            syncErrors: errors,
            extras,
            materials,
            currency,
            hasTaxes,
            totalTaxes,
            totalWithoutGlobalDiscount,
            globalDiscountRate,
            totalWithoutTaxes,
            totalWithTaxes,
            handleChangeMaterial,
            handleResyncMaterial,
            handleChangeExtra,
            handleResyncExtra,
            handleAddExtraLine,
            handleRemoveExtraLine,
            handleInputGlobalDiscountRate,
            handleChangeGlobalDiscountRate,
            handleInputTotalWithoutTaxes,
            handleChangeTotalWithoutTaxes,
        } = this;

        const classNames = ['InvoiceEditor', {
            'InvoiceEditor--with-extras': extras.length > 0,
        }];

        return (
            <div class={classNames}>
                <div class="InvoiceEditor__lists">
                    <div class="InvoiceEditor__lists__item InvoiceEditor__lists__item--materials">
                        <h2 class="InvoiceEditor__lists__item__title">{__('lists.materials.title')}</h2>
                        <div class="InvoiceEditor__lists__item__content">
                            <Materials
                                materials={materials}
                                data={data.materials}
                                errors={errors?.materials}
                                currency={currency}
                                hasTaxes={hasTaxes}
                                onChange={handleChangeMaterial}
                                onRequestResync={handleResyncMaterial}
                            />
                        </div>
                    </div>
                    <div class="InvoiceEditor__lists__item InvoiceEditor__lists__item--extras">
                        <h2 class="InvoiceEditor__lists__item__title">{__('lists.extras.title')}</h2>
                        <div class="InvoiceEditor__lists__item__content">
                            <Extras
                                extras={extras}
                                data={data.extras}
                                errors={errors?.extras}
                                currency={currency}
                                hasTaxes={hasTaxes}
                                onAdd={handleAddExtraLine}
                                onRemove={handleRemoveExtraLine}
                                onChange={handleChangeExtra}
                                onRequestResync={handleResyncExtra}
                            />
                        </div>
                    </div>
                </div>
                <div class="InvoiceEditor__totals">
                    <dl class="InvoiceEditor__totals__item InvoiceEditor__totals__item--grand-total">
                        <dt class="InvoiceEditor__totals__item__label">
                            {__('subtotal')}
                        </dt>
                        <dd class="InvoiceEditor__totals__item__value">
                            {formatAmount(totalWithoutGlobalDiscount, currency)}
                        </dd>
                    </dl>
                    <dl class="InvoiceEditor__totals__item">
                        <dt class="InvoiceEditor__totals__item__label">
                            {__('discount-rate')}
                        </dt>
                        <dd class="InvoiceEditor__totals__item__value InvoiceEditor__totals__item__value--editable">
                            <Input
                                type="number"
                                value={globalDiscountRate.toString()}
                                step={0.0001}
                                min={0}
                                max={100}
                                onInput={handleInputGlobalDiscountRate}
                                onChange={handleChangeGlobalDiscountRate}
                                addon="%"
                                align="right"
                                class="InvoiceEditor__global-discount"
                            />
                        </dd>
                    </dl>
                    <dl class="InvoiceEditor__totals__item InvoiceEditor__totals__item--grand-total">
                        <dt class="InvoiceEditor__totals__item__label">
                            {hasTaxes ? __('total-without-taxes') : __('total')}
                        </dt>
                        <dd class="InvoiceEditor__totals__item__value InvoiceEditor__totals__item__value--editable">
                            <Input
                                type="number"
                                value={totalWithoutTaxes.toString()}
                                step={0.01}
                                min={0}
                                max={totalWithoutGlobalDiscount.toNumber()}
                                onInput={handleInputTotalWithoutTaxes}
                                onChange={handleChangeTotalWithoutTaxes}
                                addon={currency.symbol}
                                align="right"
                                class="InvoiceEditor__total-without-taxes"
                            />
                        </dd>
                    </dl>
                    {hasTaxes && (
                        <Fragment>
                            {totalTaxes.map((tax: TotalTax, index: number) => {
                                const taxValue = tax.is_rate
                                    ? ` (${tax.value.toString()}%)`
                                    : null;

                                return (
                                    <dl key={index} class="InvoiceEditor__totals__item">
                                        <dt class="InvoiceEditor__totals__item__label">
                                            {tax.name}{taxValue}
                                        </dt>
                                        <dd class="InvoiceEditor__totals__item__value">
                                            {formatAmount(tax.total, currency)}
                                        </dd>
                                    </dl>
                                );
                            })}
                        </Fragment>
                    )}
                    {hasTaxes && (
                        <dl class="InvoiceEditor__totals__item InvoiceEditor__totals__item--grand-total">
                            <dt class="InvoiceEditor__totals__item__label">
                                {__('total-with-taxes')}
                            </dt>
                            <dd class="InvoiceEditor__totals__item__value">
                                {formatAmount(totalWithTaxes, currency)}
                            </dd>
                        </dl>
                    )}
                </div>
            </div>
        );
    },
});

export type { BillingData };

export { default as getEmbeddedBilling } from './utils/getEmbeddedBilling';
export { default as hasBillingChanged } from './utils/hasBillingChanged';

export default InvoiceEditor;
