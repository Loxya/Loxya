import './index.scss';
import { defineComponent } from 'vue';
import config, { BillingMode } from '@/globals/config';
import formatAmount from '@/utils/formatAmount';
import TagsList from '@/themes/default/components/TagsList';
import formatCustomFieldValue from '@/utils/formatCustomFieldValue';

import type { PropType } from 'vue';
import type { MaterialDetails } from '@/stores/api/materials';
import type { PropertyWithValue } from '@/stores/api/properties';

type Props = {
    /** Le matériel dont on veut afficher les informations. */
    material: MaterialDetails,
};

/** Onglet "informations" de la modale de détails d'un matériel. */
const MaterialDetailsModalInfos = defineComponent({
    name: 'MaterialDetailsModalInfos',
    props: {
        material: {
            type: Object as PropType<Props['material']>,
            required: true,
        },
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

        isRemainingLow(): boolean {
            if (!('available_quantity' in this.material)) {
                return false;
            }
            return this.material.available_quantity < this.material.stock_quantity;
        },

        categoryName(): string | null {
            const { category_id: categoryId } = this.material;
            if (categoryId === null) {
                return null;
            }

            const categoryNameGetter = this.$store.getters['categories/categoryName'];
            return categoryNameGetter(categoryId);
        },

        subCategoryName(): string | null {
            const { sub_category_id: subCategoryId } = this.material;
            if (subCategoryId === null) {
                return null;
            }

            const subCategoryNameGetter = this.$store.getters['categories/subCategoryName'];
            return subCategoryNameGetter(subCategoryId);
        },

        parkName(): string | null {
            const { park_id: parkId } = this.material;
            const parkNameGetter = this.$store.getters['parks/getName'];
            return parkNameGetter(parkId);
        },

        taxName(): string | null {
            if (!this.isBillingEnabled || !this.isTaxesEnabled) {
                return null;
            }

            const { tax_id: taxId } = this.material;
            if (taxId === null || taxId === undefined) {
                return null;
            }

            const taxNameGetter = this.$store.getters['taxes/getName'];
            return taxNameGetter(taxId);
        },

        degressiveRateName(): string | null {
            if (!this.isBillingEnabled) {
                return null;
            }

            const { degressive_rate_id: degressiveRateId } = this.material;
            if (degressiveRateId === null || degressiveRateId === undefined) {
                return null;
            }

            const degressiveNameGetter = this.$store.getters['degressiveRates/getName'];
            return degressiveNameGetter(degressiveRateId);
        },

        rentalPrice(): string | null {
            if (!this.isBillingEnabled) {
                return null;
            }

            const { rental_price: rentalPrice } = this.material;
            return rentalPrice ? formatAmount(rentalPrice) : null;
        },

        replacementPrice(): string | null {
            const { replacement_price: replacementPrice } = this.material;
            return replacementPrice ? formatAmount(replacementPrice) : null;
        },
    },
    mounted() {
        this.$store.dispatch('parks/fetch');

        if (this.isBillingEnabled) {
            this.$store.dispatch('degressiveRates/fetch');

            if (this.isTaxesEnabled) {
                this.$store.dispatch('taxes/fetch');
            }
        }
    },
    methods: {
        // ------------------------------------------------------
        // -
        // -    Méthodes internes
        // -
        // ------------------------------------------------------

        __(key: string, params?: Record<string, number | string>, count?: number): string {
            key = !key.startsWith('global.')
                ? `modal.material-details.informations.${key}`
                : key.replace(/^global\./, '');

            return this.$t(key, params, count);
        },
    },
    render() {
        const {
            __,
            material,
            rentalPrice,
            replacementPrice,
            taxName,
            parkName,
            categoryName,
            subCategoryName,
            degressiveRateName,
            isSimpleVatSystem,
            isBillingEnabled,
            isTaxesEnabled,
            isRemainingLow,
        } = this;
        const {
            picture,
            description,
            stock_quantity: stockQuantity,
            out_of_order_quantity: outOfOrderQuantity,
            is_hidden_on_bill: isHiddenOnBill,
            is_discountable: isDiscountable,
            properties,
            tags,
            note,
        } = material;

        return (
            <div class="MaterialDetailsModalInfos">
                <div
                    class={['MaterialDetailsModalInfos__picture', {
                        'MaterialDetailsModalInfos__picture--placeholder': !picture,
                    }]}
                >
                    {picture && <img src={picture} class="MaterialDetailsModalInfos__picture__image" />}
                </div>
                <div class="MaterialDetailsModalInfos__general-infos">
                    {(description ?? '').length > 0 && (
                        <p class="MaterialDetailsModalInfos__description">
                            {description}
                        </p>
                    )}
                    <dl class="MaterialDetailsModalInfos__infos">
                        <div class="MaterialDetailsModalInfos__infos__item">
                            <dt class="MaterialDetailsModalInfos__infos__item__label">
                                {__('global.label-colon', { label: __('global.category') })}
                            </dt>
                            <dd class="MaterialDetailsModalInfos__infos__item__value">
                                {categoryName ?? (
                                    <span class="MaterialDetailsModalInfos__infos__item__empty">
                                        {__('global.not-specified')}
                                    </span>
                                )}
                            </dd>
                        </div>
                        <div class="MaterialDetailsModalInfos__infos__item">
                            <dt class="MaterialDetailsModalInfos__infos__item__label">
                                {__('global.label-colon', { label: __('global.sub-category') })}
                            </dt>
                            <dd class="MaterialDetailsModalInfos__infos__item__value">
                                {subCategoryName ?? (
                                    <span class="MaterialDetailsModalInfos__infos__item__empty">
                                        {__('global.not-specified')}
                                    </span>
                                )}
                            </dd>
                        </div>
                        <div class="MaterialDetailsModalInfos__infos__item">
                            <dt class="MaterialDetailsModalInfos__infos__item__label">
                                {__('global.label-colon', { label: __('global.park') })}
                            </dt>
                            <dd class="MaterialDetailsModalInfos__infos__item__value">
                                {parkName}
                            </dd>
                        </div>
                        <div class="MaterialDetailsModalInfos__infos__item">
                            <dt class="MaterialDetailsModalInfos__infos__item__label">
                                {__('global.label-colon', { label: __('global.stock-quantity') })}
                            </dt>
                            <dd class="MaterialDetailsModalInfos__infos__item__value">
                                {stockQuantity}
                            </dd>
                        </div>
                        <div
                            class={[
                                'MaterialDetailsModalInfos__infos__item',
                                'MaterialDetailsModalInfos__infos__item--out-of-order-quantity',
                                { 'MaterialDetailsModalInfos__infos__item--danger': outOfOrderQuantity > 0 },
                            ]}
                        >
                            <dt class="MaterialDetailsModalInfos__infos__item__label">
                                {__('global.label-colon', { label: __('global.out-of-order-qty') })}
                            </dt>
                            <dd class="MaterialDetailsModalInfos__infos__item__value">
                                {outOfOrderQuantity}
                            </dd>
                        </div>
                        <div
                            class={[
                                'MaterialDetailsModalInfos__infos__item',
                                'MaterialDetailsModalInfos__infos__item--remaining-quantity',
                                { 'MaterialDetailsModalInfos__infos__item--warning': isRemainingLow },
                            ]}
                        >
                            <dt class="MaterialDetailsModalInfos__infos__item__label">
                                {__('global.label-colon', { label: __('global.remaining-qty-today') })}
                            </dt>
                            <dd class="MaterialDetailsModalInfos__infos__item__value">
                                {(() => {
                                    if (!('available_quantity' in material)) {
                                        return (
                                            <span class="MaterialDetailsModalInfos__infos__item__empty">
                                                {__('global.loading')}
                                            </span>
                                        );
                                    }
                                    return material.available_quantity;
                                })()}
                            </dd>
                        </div>
                        {isBillingEnabled && (
                            <div class="MaterialDetailsModalInfos__infos__billing">
                                <div class="MaterialDetailsModalInfos__infos__item">
                                    <dt class="MaterialDetailsModalInfos__infos__item__label">
                                        {__('global.label-colon', { label: __('global.rental-price') })}
                                    </dt>
                                    <dd class="MaterialDetailsModalInfos__infos__item__value">
                                        {__('global.value-per-day', { value: rentalPrice! })}
                                    </dd>
                                </div>
                                <div class="MaterialDetailsModalInfos__infos__item">
                                    <dt class="MaterialDetailsModalInfos__infos__item__label">
                                        {__('global.hidden-on-invoice')}
                                    </dt>
                                    <dd class="MaterialDetailsModalInfos__infos__item__value">
                                        {isHiddenOnBill ? __('global.yes') : __('global.no')}
                                    </dd>
                                </div>
                                <div class="MaterialDetailsModalInfos__infos__item">
                                    <dt class="MaterialDetailsModalInfos__infos__item__label">
                                        {__('global.discountable')}
                                    </dt>
                                    <dd class="MaterialDetailsModalInfos__infos__item__value">
                                        {isDiscountable ? __('global.yes') : __('global.no')}
                                    </dd>
                                </div>
                                <div class="MaterialDetailsModalInfos__infos__item">
                                    <dt class="MaterialDetailsModalInfos__infos__item__label">
                                        {__('global.label-colon', { label: __('degressive-rate.label') })}
                                    </dt>
                                    <dd class="MaterialDetailsModalInfos__infos__item__value">
                                        {degressiveRateName ?? __('degressive-rate.empty')}
                                    </dd>
                                </div>
                                {isTaxesEnabled && (
                                    <div class="MaterialDetailsModalInfos__infos__item">
                                        <dt class="MaterialDetailsModalInfos__infos__item__label">
                                            {__('global.label-colon', {
                                                label: __(`tax.label.${isSimpleVatSystem ? 'simple' : 'default'}`),
                                            })}
                                        </dt>
                                        <dd class="MaterialDetailsModalInfos__infos__item__value">
                                            {taxName ?? __(`tax.empty.${isSimpleVatSystem ? 'simple' : 'default'}`)}
                                        </dd>
                                    </div>
                                )}
                            </div>
                        )}
                        <div class="MaterialDetailsModalInfos__infos__item">
                            <dt class="MaterialDetailsModalInfos__infos__item__label">
                                {__('global.label-colon', { label: __('global.replacement-price') })}
                            </dt>
                            <dd class="MaterialDetailsModalInfos__infos__item__value">
                                {replacementPrice ?? (
                                    <span class="MaterialDetailsModalInfos__infos__item__empty">
                                        {__('global.not-specified')}
                                    </span>
                                )}
                            </dd>
                        </div>
                        {tags.length > 0 && (
                            <div class="MaterialDetailsModalInfos__infos__item">
                                <dt class="MaterialDetailsModalInfos__infos__item__label">
                                    {__('global.label-colon', { label: __('global.tags') })}
                                </dt>
                                <dd class="MaterialDetailsModalInfos__infos__item__value">
                                    <TagsList tags={tags} />
                                </dd>
                            </div>
                        )}
                        {properties.map((property: PropertyWithValue) => (
                            <div key={property.id} class="MaterialDetailsModalInfos__infos__item">
                                <dt class="MaterialDetailsModalInfos__infos__item__label">
                                    {__('global.label-colon', { label: property.name })}
                                </dt>
                                <dd class="MaterialDetailsModalInfos__infos__item__value">
                                    {formatCustomFieldValue(this.$t, property)}
                                </dd>
                            </div>
                        ))}
                    </dl>
                    {((note ?? '').length > 0) && (
                        <div class="MaterialDetailsModalInfos__notes">
                            <h4 class="MaterialDetailsModalInfos__notes__title">{__('global.notes')}</h4>
                            <div class="MaterialDetailsModalInfos__notes__text">{note}</div>
                        </div>
                    )}
                </div>
            </div>
        );
    },
});

export default MaterialDetailsModalInfos;
