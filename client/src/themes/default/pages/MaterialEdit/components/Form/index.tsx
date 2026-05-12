import './index.scss';
import pick from 'lodash/pick';
import Decimal from 'decimal.js';
import cloneDeep from 'lodash/cloneDeep';
import { defineComponent } from 'vue';
import config, { BillingMode } from '@/globals/config';
import apiProperties, { PropertyEntity } from '@/stores/api/properties';
import formatOptions from '@/utils/formatOptions';
import parseInteger from '@/utils/parseInteger';
import SelectCountry from '@/themes/default/components/SelectCountry';
import Fieldset from '@/themes/default/components/Fieldset';
import FormField from '@/themes/default/components/FormField';
import { VerticalFormKey } from '@/themes/default/components/@constants';
import Button from '@/themes/default/components/Button';
import Fragment from '@/components/Fragment';
import PropertyField from './PropertyField';

import type { ComponentRef, PropType } from 'vue';
import type { Settings } from '@/stores/api/settings';
import type { Options } from '@/utils/formatOptions';
import type Country from '@/utils/country';
import type { Category, CategoryDetails } from '@/stores/api/categories';
import type { ParkSummary } from '@/stores/api/parks';
import type { Tax } from '@/stores/api/taxes';
import type { SubCategory } from '@/stores/api/subcategories';
import type { DegressiveRate } from '@/stores/api/degressive-rates';
import type {
    Property,
    PropertyDetails,
    PropertyWithValue,
} from '@/stores/api/properties';
import type {
    MaterialDetails as Material,
    MaterialEdit as MaterialEditCore,
} from '@/stores/api/materials';

type Props = {
    /** Les données déjà sauvegardées du matériel (s'il existait déjà). */
    savedData?: Material | null,

    /** Permet d'indiquer que la sauvegarde est en cours. */
    isSaving?: boolean,

    /** Liste des erreurs de validation éventuelles. */
    errors?: Record<string, string> | null,

    /**
     * Fonction appelée lorsque l'utilisateur soumet les changements.
     *
     * @param data - Les données soumises.
     */
    onSubmit?(data: MaterialEditCore): void,

    /**
     * Fonction appelée lorsque l'utilisateur manifeste
     * son souhait d'annuler l'edition.
     */
    onCancel?(): void,
};

type MaterialEdit = (
    & Omit<MaterialEditCore, 'properties'>
    & { properties: Record<Property['id'], PropertyWithValue['value']> }
);

type Data = {
    data: MaterialEdit,
    criticalError: Error | null,
    allProperties: PropertyDetails[],
};

const getDefaults = (
    savedData: Material | null,
    settings: Settings,
): MaterialEdit => {
    const isTaxesEnabled = !config.organization.isVatExempted;
    const isBillingEnabled = config.billingMode !== BillingMode.NONE;

    const BASE_DEFAULTS = {
        name: null,
        reference: null,
        description: null,
        park_id: null,
        category_id: null,
        sub_category_id: null,
        rental_price: null,
        degressive_rate_id: !isBillingEnabled ? null : (
            settings?.billing.defaultDegressiveRate ?? null
        ),
        tax_id: !isBillingEnabled || !isTaxesEnabled ? null : (
            settings?.billing.defaultTax ?? null
        ),
        replacement_price: null,
        weight: null,
        origin_country: null,
        stock_quantity: 1,
        out_of_order_quantity: 0,
        is_hidden_on_bill: false,
        is_discountable: true,
        note: null,
        properties: [],
    };

    return {
        ...BASE_DEFAULTS,
        ...pick(savedData ?? {}, Object.keys(BASE_DEFAULTS)),
        rental_price: savedData?.rental_price?.toString() ?? null,
        replacement_price: savedData?.replacement_price?.toString() ?? null,
        weight: savedData?.weight?.toString() ?? null,
        origin_country: savedData?.origin_country ?? null,
        properties: Object.fromEntries((savedData?.properties ?? []).map(
            ({ id, value }: PropertyWithValue) => [id, value],
        )),
    };
};

/** Formulaire d'édition d'un matériel. */
const MaterialEditForm = defineComponent({
    name: 'MaterialEditForm',
    provide: {
        [VerticalFormKey as symbol]: true,
    },
    props: {
        savedData: {
            type: Object as PropType<Required<Props>['savedData']>,
            default: null,
        },
        isSaving: {
            type: Boolean as PropType<Required<Props>['isSaving']>,
            default: false,
        },
        errors: {
            type: Object as PropType<Required<Props>['errors']>,
            default: null,
        },
        // eslint-disable-next-line vue/no-unused-properties
        onSubmit: {
            type: Function as PropType<Props['onSubmit']>,
            default: undefined,
        },
        // eslint-disable-next-line vue/no-unused-properties
        onCancel: {
            type: Function as PropType<Props['onCancel']>,
            default: undefined,
        },
    },
    emits: ['submit', 'cancel'],
    data(): Data {
        const settings: Settings = this.$store.state.settings;

        return {
            data: getDefaults(this.savedData, settings),
            criticalError: null,
            allProperties: [],
        };
    },
    computed: {
        isBillingEnabled(): boolean {
            return config.billingMode !== BillingMode.NONE;
        },

        isTaxesEnabled(): boolean {
            return !config.organization.isVatExempted;
        },

        isSimpleVatSystem(): boolean {
            const { country } = config.organization;
            return !!country.hasSimpleVatSystem;
        },

        showSubCategories(): boolean {
            if (!this.data.category_id && this.data.category_id !== 0) {
                return false;
            }
            return this.subCategoriesOptions.length > 0;
        },

        isNew(): boolean {
            return this.savedData === null;
        },

        showParksSelector(): boolean {
            if (this.parksOptions.length !== 1) {
                return true;
            }

            const { park_id: parkId } = this.data;
            if (!parkId && parkId !== 0) {
                return false;
            }

            const firstParkId = [...this.parksOptions].at(0)!.value;
            return parseInteger(firstParkId)! !== parseInteger(parkId)!;
        },

        selectedCategory(): CategoryDetails | null {
            const { category_id: categoryId } = this.data;
            return categoryId || categoryId === 0
                ? this.$store.getters['categories/category'](categoryId)
                : null;
        },

        subCategoriesOptions(): Options<SubCategory> {
            const { selectedCategory } = this;
            if (!selectedCategory) {
                return [];
            }
            return formatOptions(selectedCategory.sub_categories);
        },

        parksOptions(): Options<ParkSummary> {
            return this.$store.getters['parks/options'];
        },

        categoriesOptions(): Options<Category> {
            return this.$store.getters['categories/options'];
        },

        degressiveRatesOptions(): Options<DegressiveRate> {
            if (!this.isBillingEnabled) {
                return [];
            }
            return this.$store.getters['degressiveRates/options'];
        },

        taxesOptions(): Options<Tax> {
            if (!this.isBillingEnabled || !this.isTaxesEnabled) {
                return [];
            }
            return this.$store.getters['taxes/options'];
        },

        currentRentalPrice(): Decimal | null {
            if (!this.isBillingEnabled) {
                return null;
            }

            return this.data.rental_price !== null
                ? new Decimal(this.data.rental_price)
                : null;
        },
    },
    watch: {
        criticalError(error: unknown) {
            if (error === null) {
                return;
            }
            throw error;
        },
    },
    mounted() {
        this.$store.dispatch('parks/fetch');
        this.$store.dispatch('categories/fetch');

        if (this.isBillingEnabled) {
            this.$store.dispatch('degressiveRates/fetch');

            if (this.isTaxesEnabled) {
                this.$store.dispatch('taxes/fetch');
            }
        }

        this.fetchProperties();

        // - Focus sur le champ nom si création.
        if (this.isNew) {
            this.$nextTick(() => {
                const $inputName = this.$refs.inputName as ComponentRef<typeof FormField>;
                $inputName?.focus();
            });
        }
    },
    methods: {
        // ------------------------------------------------------
        // -
        // -    Handlers
        // -
        // ------------------------------------------------------

        handleSubmit(e: SubmitEvent) {
            e?.preventDefault();

            const rawData = cloneDeep(this.data);

            if (this.parksOptions.length === 1) {
                const firstParkId = [...this.parksOptions].at(0)?.value;
                if (firstParkId !== null && firstParkId !== undefined) {
                    rawData.park_id = !rawData.park_id && rawData.park_id !== 0
                        ? parseInteger(firstParkId)
                        : rawData.park_id;
                }
            }

            if (!this.isBillingEnabled) {
                rawData.rental_price = null;
                rawData.degressive_rate_id = null;
                rawData.tax_id = null;
            }

            const data: MaterialEditCore = {
                ...rawData,
                properties: Object.entries(rawData.properties)
                    .map(([id, value]: [string, PropertyWithValue['value']]) => (
                        { id: parseInt(id, 10), value }
                    )),
            };
            this.$emit('submit', data);
        },

        handleCancel() {
            this.$emit('cancel');
        },

        handleCategoryChange() {
            this.data.sub_category_id = null;

            this.fetchProperties();
        },

        handleRentalPriceChange(newValue: string | null) {
            const value = newValue !== '' ? (newValue ?? null) : null;
            this.data.rental_price = value;

            const normalizedValue = value !== null ? new Decimal(value) : null;
            if (normalizedValue?.greaterThan(0) ?? false) {
                this.data.is_hidden_on_bill = false;
            }
        },

        handleChangeMadeInCountry(newMadeInCountry: Country | null) {
            this.data.origin_country = newMadeInCountry;
        },

        handlePropertyChange(id: Property['id'], newValue: PropertyWithValue['value']) {
            this.$set(this.data.properties, id, newValue);
        },

        // ------------------------------------------------------
        // -
        // -    Méthodes internes
        // -
        // ------------------------------------------------------

        async fetchProperties() {
            const categoryId: Category['id'] | 'none' = (
                this.data.category_id || this.data.category_id === 0
                    ? this.data.category_id
                    : null
            ) ?? 'none';

            try {
                this.allProperties = await apiProperties.all(PropertyEntity.MATERIAL, categoryId);

                // - Supprime les données de caractéristique obsolètes dans les données du formulaire.
                Object.keys(this.data.properties).forEach((id: string) => {
                    const stillExists = this.allProperties
                        .some((attr: PropertyDetails) => attr.id === parseInt(id, 10));

                    if (!stillExists) {
                        this.$delete(this.data.properties, id);
                    }
                });
            } catch {
                this.allProperties = [];
                this.criticalError = new Error('Unable to retrieve the list of special properties.');
            }
        },

        __(key: string, params?: Record<string, number | string>, count?: number): string {
            key = !key.startsWith('global.')
                ? `page.material-edit.${key}`
                : key.replace(/^global\./, '');

            return this.$t(key, params, count);
        },
    },
    render() {
        const {
            __,
            data,
            errors,
            isSaving,
            criticalError,
            taxesOptions,
            parksOptions,
            categoriesOptions,
            subCategoriesOptions,
            degressiveRatesOptions,
            showParksSelector,
            showSubCategories,
            isSimpleVatSystem,
            isBillingEnabled,
            isTaxesEnabled,
            allProperties,
            currentRentalPrice,
            handleSubmit,
            handleCancel,
            handleCategoryChange,
            handleRentalPriceChange,
            handleChangeMadeInCountry,
            handlePropertyChange,
        } = this;

        if (criticalError !== null) {
            return null;
        }

        return (
            <form
                class="Form Form--fixed-actions MaterialEditForm"
                onSubmit={handleSubmit}
            >
                <Fieldset>
                    <FormField
                        ref="inputName"
                        label={__('global.name')}
                        v-model={data.name}
                        error={errors?.name}
                        help={__('help-name')}
                        required
                    />
                    <FormField
                        label={__('global.reference')}
                        v-model={data.reference}
                        error={errors?.reference}
                        required
                    />
                    <div
                        class={['MaterialEditForm__category', {
                            'MaterialEditForm__category--with-sub-category': showSubCategories,
                        }]}
                    >
                        <FormField
                            label={__('global.category')}
                            type="select"
                            class="MaterialEditForm__main-category"
                            options={categoriesOptions}
                            v-model={data.category_id}
                            error={errors?.category_id}
                            onChange={handleCategoryChange}
                        />
                        {showSubCategories && (
                            <FormField
                                label={__('global.sub-category')}
                                type="select"
                                class="MaterialEditForm__sub-category"
                                options={subCategoriesOptions}
                                v-model={data.sub_category_id}
                                error={errors?.sub_category_id}
                            />
                        )}
                    </div>
                    <FormField
                        label={__('global.description')}
                        type="textarea"
                        rows={5}
                        v-model={data.description}
                        error={errors?.description}
                    />
                </Fieldset>
                <Fieldset
                    title={__('global.stock-infos')}
                >
                    <div class="MaterialEditForm__park">
                        {showParksSelector && (
                            <FormField
                                label={__('global.park')}
                                type="select"
                                class="MaterialEditForm__park-selector"
                                options={parksOptions}
                                v-model={data.park_id}
                                error={errors?.park_id}
                                placeholder
                                required
                            />
                        )}
                    </div>
                    <div class="MaterialEditForm__quantities">
                        <FormField
                            label={__('global.stock-quantity')}
                            type="number"
                            step={1}
                            class="MaterialEditForm__stock-quantity"
                            v-model={data.stock_quantity}
                            error={errors?.stock_quantity}
                            required
                        />
                        <FormField
                            label={__('global.out-of-order-quantity')}
                            type="number"
                            step={1}
                            class="MaterialEditForm__out-of-order-quantity"
                            v-model={data.out_of_order_quantity}
                            error={errors?.out_of_order_quantity}
                        />
                    </div>
                </Fieldset>
                {isBillingEnabled && (
                    <Fieldset title={__('global.billing-infos')}>
                        <div class="MaterialEditForm__billing">
                            {(() => {
                                const degressiveRateField = (
                                    <FormField
                                        type="select"
                                        label={__('fields.degressive-rate.label')}
                                        placeholder={__('fields.degressive-rate.placeholder')}
                                        class="MaterialEditForm__billing__parameters__item"
                                        options={degressiveRatesOptions}
                                        v-model={data.degressive_rate_id}
                                        error={errors?.degressive_rate_id}
                                    />
                                );

                                return (
                                    <Fragment>
                                        <div class="MaterialEditForm__billing__parameters">
                                            <FormField
                                                label={__('global.rental-price')}
                                                type="number"
                                                class="MaterialEditForm__billing__parameters__item"
                                                addon={__('currency-per-day', {
                                                    currency: config.currency.symbol,
                                                })}
                                                error={errors?.rental_price}
                                                onInput={handleRentalPriceChange}
                                                value={data.rental_price}
                                                required
                                            />
                                            {!isTaxesEnabled && degressiveRateField}
                                        </div>
                                        <div class="MaterialEditForm__billing__switches">
                                            <FormField
                                                label={__('global.discountable')}
                                                type="switch"
                                                class="MaterialEditForm__billing__switches__item"
                                                v-model={data.is_discountable}
                                                error={errors?.is_discountable}
                                            />
                                            <FormField
                                                label={__('global.hidden-on-invoice')}
                                                type="switch"
                                                class="MaterialEditForm__billing__switches__item"
                                                v-model={data.is_hidden_on_bill}
                                                error={errors?.is_hidden_on_bill}
                                                disabled={(
                                                    (currentRentalPrice?.greaterThan(0) ?? false)
                                                        ? __('global.price-must-be-zero')
                                                        : false
                                                )}
                                            />
                                        </div>
                                        {isTaxesEnabled && (
                                            <div class="MaterialEditForm__billing__parameters">
                                                <FormField
                                                    type="select"
                                                    label={__(`fields.tax.label.${isSimpleVatSystem ? 'simple' : 'default'}`)}
                                                    placeholder={__(`fields.tax.placeholder.${isSimpleVatSystem ? 'simple' : 'default'}`)}
                                                    class="MaterialEditForm__billing__parameters__item"
                                                    options={taxesOptions}
                                                    v-model={data.tax_id}
                                                    error={errors?.tax_id}
                                                />
                                                {degressiveRateField}
                                            </div>
                                        )}
                                    </Fragment>
                                );
                            })()}
                        </div>
                    </Fieldset>
                )}
                <Fieldset
                    title={__('global.extra-infos')}
                    help={__('fields-changes-depending-on-category')}
                >
                    <FormField
                        label={__('global.replacement-price')}
                        type="number"
                        addon={config.currency.symbol}
                        class="MaterialEditForm__price"
                        v-model={data.replacement_price}
                        error={errors?.replacement_price}
                    />
                    <FormField
                        label={__('global.weight')}
                        type="number"
                        addon={config.measurementUnits.materials.weight}
                        step={0.001}
                        class="MaterialEditForm__weight"
                        v-model={data.weight}
                        error={errors?.weight}
                    />
                    <FormField
                        type="custom"
                        label={__('global.origin-country')}
                        error={errors?.origin_country}
                    >
                        <SelectCountry
                            placeholder={false}
                            value={data.origin_country}
                            onChange={handleChangeMadeInCountry}
                        />
                    </FormField>
                    {allProperties.map((property: PropertyDetails) => (
                        <PropertyField
                            key={property.id}
                            property={property}
                            value={data.properties[property.id] ?? null}
                            onChange={(value: PropertyWithValue['value']) => {
                                handlePropertyChange(property.id, value);
                            }}
                        />
                    ))}
                    <FormField
                        label={__('global.notes')}
                        type="textarea"
                        v-model={data.note}
                        error={errors?.note}
                    />
                </Fieldset>
                <section class="Form__actions">
                    <Button htmlType="submit" type="primary" icon="save" loading={isSaving}>
                        {isSaving ? __('global.saving') : __('global.save')}
                    </Button>
                    <Button icon="ban" onClick={handleCancel}>
                        {__('global.cancel')}
                    </Button>
                </section>
            </form>
        );
    },
});

export default MaterialEditForm;
