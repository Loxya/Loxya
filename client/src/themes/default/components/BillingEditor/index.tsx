import './index.scss';
import Decimal from 'decimal.js';
import cloneDeep from 'lodash/cloneDeep';
import config from '@/globals/config';
import { v4 as createUuid } from 'uuid';
import { computed, defineComponent, markRaw } from 'vue';
import formatAmount from '@/utils/formatAmount';
import TaxRegime from '@/utils/invoicing/tax-regime';
import hasBillingChanged from './utils/hasBillingChanged';
import LegalEntityType from '@/stores/api/@enums/legal-entity-type';
import getMaterialsDataFactory from './utils/getMaterialsData';
import getExtrasDataFactory from './utils/getExtrasData';
import Input from '@/themes/default/components/Input';
import Materials from './components/Materials';
import Extras from './components/Extras';
import {
    IsCompactKey,
    IsStandaloneKey,
    STANDALONE_ENTITY,
} from './_constants';
import getEmbeddedBilling, {
    getEmbeddedExtraBilling,
    getEmbeddedMaterialBilling,
} from './utils/getEmbeddedBilling';

// - Modales
import ResyncExtraData from './modals/ResyncExtraData';
import ResyncMaterialData from './modals/ResyncMaterialData';

import type { PropType } from 'vue';
import type Currency from '@/utils/currency';
import type { Tax as CoreTax } from '@/stores/api/taxes';
import type VatExemptionCode from '@/utils/invoicing/vat-exemption-code';
import type {
    BillingData,
    Booking,
    BookingExtra,
    BookingMaterial,
    ExtraBillingData,
    MaterialBillingData,
} from '@/stores/api/bookings';
import type {
    Buyer,
    LineTax,
    TotalTax,
    DiscountData,
    BillingContext,
    StandaloneContext,
    BillingExtra,
    BillingMaterial,
    RawBillingData,
    RawExtraBillingData,
    RawMaterialBillingData,
    DiscountTaxSpecial,
    TotalTaxStandard,
    TotalTaxSpecial,
} from './_types';

type Props = {
    /**
     * Le contexte de facturation.
     *
     * Il peut s'agir d'un booking ou d'un contexte
     * autonome (mode "from scratch" sans matériel).
     */
    context: BillingContext,

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
     * Mode d'affichage compact.
     *
     * Dans ce mode d'affichage, les lignes de facturation sont affichés sous
     * forme de "carte" et non plus comme elles apparaîtront dans le devis ou
     * facture. Ceci afin de gagner en place dans un environnement compact.
     *
     * Si cette prop est omise (ou vaut `undefined`), le mode est déterminé
     * automatiquement en fonction de la largeur du conteneur. Pour forcer
     * l'un ou l'autre des modes, passer explicitement `true` ou `false`.
     */
    compact?: boolean,

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
    autoCompact: boolean,
};

type InstanceProperties = {
    resizeObserver: ResizeObserver | undefined,
};

// - Largeur (en pixels) en dessous de laquelle l'éditeur passe automatiquement
//   en mode compact lorsque la prop `compact` n'est pas explicitement définie.
const COMPACT_THRESHOLD = 1225;

const getExtraDefaults = (): RawExtraBillingData => ({
    uuid: createUuid(),
    is_service: true,
    description: null,
    quantity: 1,
    unit_price: null,
    discount_rate: markRaw(new Decimal(0)),
    tax_regime: undefined,
    tax_exemption_code: undefined,
    tax_id: undefined,
    taxes: undefined,
});

/** Éditeur de facture d'un booking. */
const BillingEditor = defineComponent({
    name: 'BillingEditor',
    provide(this: any) {
        return {
            [IsCompactKey as symbol]: computed(() => this.isCompact),
            [IsStandaloneKey as symbol]: computed(() => this.isStandalone),
        };
    },
    props: {
        context: {
            type: Object as PropType<Props['context']>,
            required: true,
            validator: (value: BillingContext): boolean => (
                value.entity === STANDALONE_ENTITY ||
                value.is_billable
            ),
        },
        errors: {
            type: Object as PropType<Props['errors']>,
            default: undefined,
        },
        compact: {
            type: Boolean as PropType<Props['compact']>,
            default: undefined,
        },
        // eslint-disable-next-line vue/no-unused-properties
        onChange: {
            type: Function as PropType<Props['onChange']>,
            default: undefined,
        },
        // eslint-disable-next-line vue/no-unused-properties
        onMaterialResynced: {
            type: Function as PropType<Props['onMaterialResynced']>,
            default: undefined,
        },
        // eslint-disable-next-line vue/no-unused-properties
        onExtraResynced: {
            type: Function as PropType<Props['onExtraResynced']>,
            default: undefined,
        },
    },
    emits: [
        'change',
        'materialResynced',
        'extraResynced',
    ],
    setup: (): InstanceProperties => ({
        resizeObserver: undefined,
    }),
    data(): Data {
        const data: RawBillingData = (() => {
            const { context } = this;

            if (context.entity !== STANDALONE_ENTITY) {
                return getEmbeddedBilling(context);
            }

            return {
                materials: [],
                extras: [...context.lines],
                global_discount_rate: context.global_discount_rate,
            };
        })();

        return {
            data,
            autoCompact: false,
            syncErrors: (
                this.errors !== undefined
                    ? cloneDeep(this.errors)
                    : undefined
            ),
        };
    },
    computed: {
        isStandalone(): boolean {
            return this.context.entity === STANDALONE_ENTITY;
        },

        booking(): Booking<true> | undefined {
            return this.context.entity !== STANDALONE_ENTITY
                ? this.context
                : undefined;
        },

        isCompact(): boolean {
            return this.compact ?? this.autoCompact;
        },

        isSimpleVatSystem(): boolean {
            const { country } = config.organization;
            return !!country.hasSimpleVatSystem;
        },

        isVatExempted(): boolean {
            return config.organization.isVatExempted;
        },

        allTaxes(): CoreTax[] {
            if (this.isVatExempted) {
                return [];
            }
            return this.$store.state.taxes.list;
        },

        defaultTaxId(): CoreTax['id'] | null {
            if (this.isVatExempted) {
                return null;
            }
            return this.$store.state.settings.billing.defaultTax;
        },

        effectiveCurrency(): Currency {
            return this.context.currency;
        },

        effectiveBuyer(): Buyer | null {
            const beneficiary = (() => {
                if (this.context.entity === STANDALONE_ENTITY) {
                    return this.context.buyer;
                }

                const booking = this.context;
                return [...booking.beneficiaries].shift() ?? null;
            })();
            if (beneficiary === null) {
                return null;
            }

            return beneficiary.company !== null
                ? { type: LegalEntityType.COMPANY, data: beneficiary.company }
                : { type: LegalEntityType.INDIVIDUAL, data: beneficiary };
        },

        materials(): BillingMaterial[] {
            if (this.booking === undefined) {
                return [];
            }
            const getMaterialsData = getMaterialsDataFactory(this.allTaxes);
            return getMaterialsData(this.booking, this.data.materials, this.effectiveBuyer);
        },

        extras(): BillingExtra[] {
            const getExtrasData = getExtrasDataFactory(this.allTaxes, this.defaultTaxId);
            return getExtrasData(this.booking, this.data.extras, this.effectiveBuyer);
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

        globalDiscountBreakdown(): DiscountData[] {
            // - Lorsqu'il y a un seul régime de taxe globale ...
            if (this.globalTaxRegime !== null) {
                const base = this.totalWithoutGlobalDiscount;
                if (base.lessThanOrEqualTo(0) || this.globalDiscountRate.isZero()) {
                    return [];
                }

                const value = base
                    .times(this.globalDiscountRate.dividedBy(100).toDecimalPlaces(6))
                    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

                const total = base
                    .minus(value)
                    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

                return [{
                    base,
                    value,
                    total,
                    tax: {
                        type: this.globalTaxRegime,
                        reason: this.globalTaxExemptionCode !== null
                            ? [this.globalTaxExemptionCode]
                            : [],
                    },
                }];
            }

            // - Sinon, on récupère le breakdown par taxe.
            return this.getGlobalDiscountBreakdown()!;
        },

        totalGlobalDiscount(): Decimal {
            if (this.globalDiscountBreakdown.length === 0) {
                return new Decimal(0).toDecimalPlaces(2);
            }

            return this.globalDiscountBreakdown
                .reduce(
                    (total: Decimal, item: DiscountData) => (
                        total.plus(item.value)
                    ),
                    new Decimal(0),
                )
                .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
        },

        totalWithoutTaxes(): Decimal {
            return this.totalWithoutGlobalDiscount
                .minus(this.totalGlobalDiscount)
                .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
        },

        globalTaxRegime(): TaxRegime.EXEMPTED | TaxRegime.OUT_OF_SCOPE | null {
            if (!this.isVatExempted) {
                return null;
            }

            // - Si aucune raison d'exonération n'est renseignée, on considère
            //   que l'organisation est hors champ de T.V.A.
            const hasExemptionReason = (
                config.organization.vatExemptionCode !== null ||
                config.organization.vatExemptionReason !== null
            );
            return hasExemptionReason
                ? TaxRegime.EXEMPTED
                : TaxRegime.OUT_OF_SCOPE;
        },

        globalTaxExemptionCode(): VatExemptionCode | null {
            if (!this.isVatExempted) {
                return null;
            }
            return config.organization.vatExemptionCode;
        },

        globalTaxExemptionReason(): string | null {
            if (!this.isVatExempted) {
                return null;
            }
            return config.organization.vatExemptionReason;
        },

        totalTaxesBreakdown(): TotalTax[] | null {
            if (this.isVatExempted || this.globalTaxRegime !== null) {
                return null;
            }

            const discountBreakdown = this.getGlobalDiscountBreakdownRaw()!;
            const rawTaxes = [this.materials, this.extras].flat().reduce(
                (currentTaxes, line: BillingMaterial | BillingExtra) => {
                    const taxRegime = line.tax_regime.current!;
                    const taxes = line.taxes.current ?? [];

                    // - Exemptions "explicites" ou la ligne n'a pas de taxe définie
                    //   avec un régime standard, si c'est le cas, elle est exemptée sans motif.
                    if (taxRegime !== TaxRegime.STANDARD || taxes.length === 0) {
                        const regime = taxRegime === TaxRegime.STANDARD
                            ? TaxRegime.EXEMPTED
                            : taxRegime;

                        if (currentTaxes.has(regime)) {
                            return currentTaxes;
                        }

                        const discountData = discountBreakdown.get(regime);
                        if (discountData === undefined) {
                            throw new Error('Unexpected missing discount entry for a billing line.');
                        }

                        return currentTaxes.set(regime, {
                            type: discountData.tax.type as Exclude<TaxRegime, TaxRegime.STANDARD>,
                            reason: (discountData.tax as DiscountTaxSpecial).reason,
                            base: discountData.total,
                        });
                    }

                    // - Taxes normales.
                    taxes.forEach((tax: LineTax) => {
                        const identifier = JSON.stringify([
                            taxRegime,
                            tax.name ?? null,
                            tax.value.toFixed(3),
                        ]);
                        if (currentTaxes.has(identifier)) {
                            return;
                        }

                        const discountData = discountBreakdown.get(identifier);
                        if (discountData === undefined) {
                            throw new Error('Unexpected missing discount entry for a billing line.');
                        }

                        currentTaxes.set(identifier, {
                            ...tax,
                            type: taxRegime,
                            base: discountData.total,
                        });
                    });

                    return currentTaxes;
                },
                new Map<string, Omit<TotalTaxStandard, 'total'> | TotalTaxSpecial>(),
            );

            return [...rawTaxes.values()]
                .map((rawTax): TotalTax => {
                    if (rawTax.type !== TaxRegime.STANDARD) {
                        return rawTax;
                    }

                    const total = rawTax.base
                        .times(rawTax.value.dividedBy(100).toDecimalPlaces(5))
                        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

                    return { ...rawTax, total };
                })
                .sort((a, b) => {
                    const aIsExemption = a.type !== TaxRegime.STANDARD;
                    const bIsExemption = b.type !== TaxRegime.STANDARD;

                    if (aIsExemption || bIsExemption) {
                        if (aIsExemption !== bIsExemption) {
                            return aIsExemption ? 1 : -1;
                        }
                        return a.type < b.type ? -1 : (a.type > b.type ? 1 : 0);
                    }

                    const result = (a.name ?? '').localeCompare(b.name ?? '');
                    return result !== 0 ? result : b.value.comparedTo(a.value);
                });
        },

        totalTaxes(): Decimal {
            if (this.isVatExempted || this.globalTaxRegime !== null) {
                return new Decimal(0);
            }

            return this.totalTaxesBreakdown!.reduce(
                (total: Decimal, tax: TotalTax) => {
                    if (tax.type !== TaxRegime.STANDARD) {
                        return total;
                    }
                    return total.plus(tax.total);
                },
                new Decimal(0),
            );
        },

        totalWithTaxes(): Decimal {
            return (this.totalTaxesBreakdown ?? [])
                .reduce(
                    (currentTotal: Decimal, tax: TotalTax) => (
                        tax.type === TaxRegime.STANDARD
                            ? currentTotal.plus(tax.total)
                            : currentTotal
                    ),
                    this.totalWithoutTaxes,
                )
                .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
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
            const { data: rawData } = this;

            const materials: MaterialBillingData[] = rawData.materials.map(
                (material: RawMaterialBillingData) => {
                    const data = this.materials.find((_material) => _material.id === material.id)!;
                    return {
                        ...material,
                        unit_price: data.unit_price.current,
                        tax_regime: data.tax_regime.current,
                        tax_exemption_code: data.tax_exemption_code.current,
                        tax_id: data.tax_id.current,
                        taxes: data.taxes.current,
                    };
                },
            );

            const extras: ExtraBillingData[] = rawData.extras.map(
                (extra: RawExtraBillingData) => {
                    const data = this.extras.find((_extra) => _extra.uuid === extra.uuid)!;
                    return {
                        ...extra,
                        tax_regime: data.tax_regime.current,
                        tax_exemption_code: data.tax_exemption_code.current,
                        tax_id: data.tax_id.current,
                        taxes: data.taxes.current,
                    };
                },
            );

            return { ...rawData, materials, extras };
        },
    },
    watch: {
        context() {
            const oldData = this.data;
            const newData: BillingData = (() => {
                const { context } = this;

                if (context.entity !== STANDALONE_ENTITY) {
                    return getEmbeddedBilling(context);
                }

                return {
                    materials: [],
                    extras: [...context.lines],
                    global_discount_rate: context.global_discount_rate,
                };
            })();
            if (!hasBillingChanged(this.values, newData)) {
                return;
            }

            const materials = newData.materials.map(
                (material: MaterialBillingData) => {
                    const comparator = (_material: RawMaterialBillingData): boolean => _material.id === material.id;
                    return oldData.materials.find(comparator) ?? material;
                },
            );

            const extras = (() => {
                const savedUuids = new Set();
                return [
                    ...newData.extras.map(
                        (extra: ExtraBillingData): RawExtraBillingData => {
                            savedUuids.add(extra.uuid);

                            const comparator = (_extra: RawExtraBillingData): boolean => _extra.uuid === extra.uuid;
                            return oldData.extras.find(comparator) ?? extra;
                        },
                    ),
                    ...oldData.extras.filter((_extra) => !savedUuids.has(_extra.uuid)),
                ];
            })();

            this.$set(this.data, 'materials', materials);
            this.$set(this.data, 'extras', extras);
            this.$set(this.data, 'global_discount_rate', newData.global_discount_rate);
            this.$emit('change', this.values);
        },

        errors() {
            this.syncErrors = this.errors !== undefined
                ? cloneDeep(this.errors)
                : undefined;
        },
    },
    created() {
        if (!this.isVatExempted) {
            this.$store.dispatch('taxes/fetch');
        }
    },
    mounted() {
        this.registerCompactObserver();
    },
    beforeDestroy() {
        this.resizeObserver?.disconnect();
        this.resizeObserver = undefined;
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
            if (!material || !material.is_resyncable || this.booking === undefined) {
                return;
            }

            const updatedMaterial: BookingMaterial<true> | undefined = (
                await this.$modal.show(ResyncMaterialData, {
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
                    _extra.uuid === updatedExtra.uuid
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

        async handleResyncExtra(uuid: BillingExtra['uuid']) {
            const extra = this.extras.find((_extra: BillingExtra) => _extra.uuid === uuid);
            if (!extra || !extra.is_resyncable) {
                return;
            }

            const wasPersisted = extra.is_persisted;
            const result: BookingExtra | RawExtraBillingData | undefined = (
                await this.$modal.show(ResyncExtraData, {
                    booking: this.booking,
                    extra,
                })
            );
            if (result === undefined) {
                return;
            }

            const index = this.data.extras.findIndex(
                (_extra: RawExtraBillingData) => (
                    _extra.uuid === result.uuid
                ),
            );

            // - Pour un extra non persisté, le rollback est effectué localement.
            if (!wasPersisted) {
                if (index !== -1) {
                    this.$set(this.data.extras, index, result as RawExtraBillingData);
                }
                this.$emit('change', this.values);

            // - Pour un extra persisté, le résultat est renvoyé par l'API.
            } else {
                const updatedExtra = result as BookingExtra;
                if (index !== -1) {
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

        handleRemoveExtraLine(uuid: RawExtraBillingData['uuid']) {
            // - Si l'extra n'existe pas, on ne va pas plus loin, sinon on la récupère.
            const extraIndex = this.data.extras.findIndex(
                (_extra: RawExtraBillingData) => _extra.uuid === uuid,
            );
            if (extraIndex === -1) {
                return;
            }

            // - On supprime l'erreur de validation liée à la ligne si elle existe,
            //   et on décale les clés suivantes pour rester alignés avec les indexes.
            const errorsKey = this.isStandalone ? 'lines' : 'extras';
            const lineErrors = this.syncErrors?.[errorsKey];
            if (lineErrors !== undefined) {
                this.$set(this.syncErrors!, errorsKey, (() => {
                    const reindexed: Record<number, any> = {};
                    Object.entries(lineErrors).forEach(([rawKey, error]: [string, any]) => {
                        const errorIndex = Number(rawKey);
                        if (errorIndex === extraIndex) {
                            return;
                        }
                        reindexed[errorIndex > extraIndex ? errorIndex - 1 : errorIndex] = error;
                    });
                    return reindexed;
                })());
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

            if (this.totalWithoutGlobalDiscount.isZero()) {
                this.data.global_discount_rate = markRaw(new Decimal(0));
                this.$emit('change', this.values);
                return;
            }

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

            if (this.totalWithoutGlobalDiscount.isZero()) {
                this.data.global_discount_rate = markRaw(new Decimal(0));
                this.$emit('change', this.values);
                return;
            }

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

        registerCompactObserver() {
            const $el = this.$el as HTMLElement | undefined;
            if ($el === undefined) {
                return;
            }

            const update = (): void => {
                this.autoCompact = $el.clientWidth < COMPACT_THRESHOLD;
            };
            update();

            this.resizeObserver = new ResizeObserver(() => {
                requestAnimationFrame(update);
            });
            this.resizeObserver.observe($el);
        },

        getGlobalDiscountBreakdown(): DiscountData[] | null {
            return this._getGlobalDiscountBreakdown(false) as DiscountData[] | null;
        },

        getGlobalDiscountBreakdownRaw(): Map<string, DiscountData> | null {
            return this._getGlobalDiscountBreakdown(true) as Map<string, DiscountData> | null;
        },

        _getGlobalDiscountBreakdown(raw: boolean): DiscountData[] | Map<string, DiscountData> | null {
            if (this.isVatExempted || this.globalTaxRegime !== null) {
                return null;
            }

            // - S'il n'y a pas de remise globale, on s'arrête là.
            if (!raw && this.globalDiscountRate.isZero()) {
                return [];
            }
            const globalDiscountRate = this.globalDiscountRate.dividedBy(100)
                .toDecimalPlaces(6);

            const groups = new Map<string, Omit<DiscountData, 'value' | 'total'>>();
            const lines = [this.materials, this.extras].flat();
            lines.forEach((line: BillingMaterial | BillingExtra) => {
                // - Pas de remise sur une ligne négative.
                if (!raw && line.total_without_taxes.lessThanOrEqualTo(0)) {
                    return;
                }

                //
                // -- Discount breakdown
                //

                const taxRegime = line.tax_regime.current!;
                const taxes = (line.taxes.current ?? []).toSorted(
                    (a: LineTax, b: LineTax) => a.value.comparedTo(b.value),
                );

                // - Exemptions "explicites" ou la ligne n'a pas de taxe à taux définie
                //   avec un régime standard, si c'est le cas, la remise globale s'applique
                //   sur une exemption.
                if (taxRegime !== TaxRegime.STANDARD || taxes.length === 0) {
                    const [regime, exemptionCode] = taxRegime !== TaxRegime.STANDARD
                        ? [taxRegime, line.tax_exemption_code.current]
                        : [TaxRegime.EXEMPTED, null];

                    if (!groups.has(regime)) {
                        groups.set(regime, {
                            base: new Decimal(0),
                            tax: {
                                type: regime as Exclude<TaxRegime, TaxRegime.STANDARD>,
                                reason: [],
                            },
                        });
                    }
                    const group = groups.get(regime)!;

                    // - Ajoute la raison à la liste des raison d'exemption pour ce régime.
                    const groupTax = group.tax as DiscountTaxSpecial;
                    if (exemptionCode !== null && !groupTax.reason.includes(exemptionCode)) {
                        groupTax.reason.push(exemptionCode);
                    }

                    // - Met à jour la base.
                    group.base = group.base.plus(line.total_without_taxes);

                    return;
                }

                const taxesCount = taxes.length;
                const distributedBase = line.total_without_taxes
                    .dividedBy(taxesCount)
                    .toDecimalPlaces(8, Decimal.ROUND_DOWN);

                let allocatedBase = new Decimal(0);
                taxes.forEach((tax: LineTax, index: number) => {
                    const isLast = index === taxesCount - 1;

                    const identifier = JSON.stringify([
                        taxRegime,
                        tax.name ?? null,
                        tax.value.toFixed(3),
                    ]);
                    if (!groups.has(identifier)) {
                        groups.set(identifier, {
                            base: new Decimal(0),
                            tax: {
                                ...tax,
                                type: taxRegime,
                            },
                        });
                    }
                    const group = groups.get(identifier)!;

                    // - Met à jour la base.
                    group.base = group.base.plus(distributedBase);
                    allocatedBase = allocatedBase.plus(distributedBase);

                    // - Reliquat ajouté au groupe du plus gros taux (qui est le dernier vu le tri plus haut).
                    if (isLast) {
                        const baseRemainder = line.total_without_taxes.minus(allocatedBase);
                        group.base = group.base.plus(baseRemainder);
                    }
                });
            });

            const result = new Map<string, DiscountData>((
                [...groups.entries()]
                    .map(([key, group]): [string, DiscountData] => {
                        const base = group.base.toDecimalPlaces(2);

                        const value = Decimal.max(group.base, 0)
                            .times(globalDiscountRate)
                            .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

                        const total = base
                            .minus(value)
                            .toDecimalPlaces(2);

                        return [key, {
                            base,
                            value,
                            total,
                            tax: group.tax,
                        }];
                    })
                    .sort(([, a], [, b]) => (
                        b.value.comparedTo(a.value)
                    ))
            ));

            return raw ? result : [...result.values()];
        },

        __(key: string, params?: Record<string, number | string>, count?: number): string {
            key = !key.startsWith('global.')
                ? `components.BillingEditor.${key}`
                : key.replace(/^global\./, '');

            return this.$t(key, params, count);
        },
    },
    render() {
        const {
            __,
            data,
            effectiveBuyer: buyer,
            effectiveCurrency: currency,
            syncErrors: errors,
            extras,
            materials,
            isCompact,
            isStandalone,
            isVatExempted,
            isSimpleVatSystem,
            globalTaxRegime,
            totalTaxes,
            totalTaxesBreakdown,
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

        const classNames = ['BillingEditor', {
            'BillingEditor--with-extras': extras.length > 0,
            'BillingEditor--standalone': isStandalone,
            'BillingEditor--compact': isCompact,
        }];

        return (
            <div class={classNames}>
                <div class="BillingEditor__lists">
                    {!isStandalone && (
                        <div class="BillingEditor__lists__item BillingEditor__lists__item--materials">
                            <h2 class="BillingEditor__lists__item__title">{__('lists.materials.title')}</h2>
                            <div class="BillingEditor__lists__item__content">
                                <Materials
                                    buyer={buyer}
                                    materials={materials}
                                    data={data.materials}
                                    errors={errors?.materials}
                                    currency={currency}
                                    hasTaxes={!isVatExempted}
                                    onChange={handleChangeMaterial}
                                    onRequestResync={handleResyncMaterial}
                                />
                            </div>
                        </div>
                    )}
                    <div class="BillingEditor__lists__item BillingEditor__lists__item--extras">
                        {!isStandalone && (
                            <h2 class="BillingEditor__lists__item__title">{__('lists.extras.title')}</h2>
                        )}
                        <div class="BillingEditor__lists__item__content">
                            <Extras
                                buyer={buyer}
                                extras={extras}
                                data={data.extras}
                                errors={(
                                    isStandalone
                                        ? errors?.lines
                                        : errors?.extras
                                )}
                                currency={currency}
                                hasTaxes={!isVatExempted}
                                onAdd={handleAddExtraLine}
                                onRemove={handleRemoveExtraLine}
                                onChange={handleChangeExtra}
                                onRequestResync={handleResyncExtra}
                            />
                        </div>
                    </div>
                </div>
                <div class="BillingEditor__totals">
                    <dl class="BillingEditor__totals__item BillingEditor__totals__item--grand-total">
                        <dt class="BillingEditor__totals__item__label">
                            {__('subtotal')}
                        </dt>
                        <dd class="BillingEditor__totals__item__value">
                            {formatAmount(totalWithoutGlobalDiscount, currency)}
                        </dd>
                    </dl>
                    <dl class="BillingEditor__totals__item">
                        <dt class="BillingEditor__totals__item__label">
                            {__('discount-rate')}
                        </dt>
                        <dd class="BillingEditor__totals__item__value BillingEditor__totals__item__value--editable">
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
                                class="BillingEditor__global-discount"
                            />
                        </dd>
                    </dl>
                    <dl class="BillingEditor__totals__item BillingEditor__totals__item--grand-total">
                        <dt class="BillingEditor__totals__item__label">
                            {!isVatExempted ? __('total-without-taxes') : __('total')}
                        </dt>
                        <dd class="BillingEditor__totals__item__value BillingEditor__totals__item__value--editable">
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
                                class="BillingEditor__total-without-taxes"
                            />
                        </dd>
                    </dl>
                    {(() => {
                        if (isVatExempted || globalTaxRegime !== null) {
                            return null;
                        }

                        if (isSimpleVatSystem) {
                            return (
                                <div class="BillingEditor__totals__item">
                                    <div class="BillingEditor__totals__item__label">
                                        {__('total-vat')}
                                    </div>
                                    <div class="BillingEditor__totals__item__value">
                                        {formatAmount(totalTaxes, currency)}
                                    </div>
                                </div>
                            );
                        }

                        return totalTaxesBreakdown!.map((tax: TotalTax, index: number) => {
                            if (tax.type !== TaxRegime.STANDARD || tax.total.isZero()) {
                                return null;
                            }

                            return (
                                <div key={index} class="BillingEditor__totals__item">
                                    <div class="BillingEditor__totals__item__label">
                                        {`${tax.name ?? __('tax')} (${tax.value.toString()}%)`}
                                    </div>
                                    <div class="BillingEditor__totals__item__value">
                                        {formatAmount(tax.total, currency)}
                                    </div>
                                </div>
                            );
                        });
                    })()}
                    {!isVatExempted && (
                        <dl class="BillingEditor__totals__item BillingEditor__totals__item--grand-total">
                            <dt class="BillingEditor__totals__item__label">
                                {__('total-with-taxes')}
                            </dt>
                            <dd class="BillingEditor__totals__item__value">
                                {formatAmount(totalWithTaxes, currency)}
                            </dd>
                        </dl>
                    )}
                </div>
            </div>
        );
    },
});

export type { BillingContext, StandaloneContext, BillingData };

export { default as getEmbeddedBilling } from './utils/getEmbeddedBilling';
export { default as hasBillingChanged } from './utils/hasBillingChanged';

export default BillingEditor;
