import './index.scss';
import { defineComponent } from 'vue';
import Fragment from '@/components/Fragment';
import config, { BillingMode } from '@/globals/config';
import formatAmount from '@/utils/formatAmount';
import formatNumber from '@/utils/formatNumber';
import TagsList from '@/themes/default/components/TagsList';
import Link from '@/themes/default/components/Link';
import formatCustomFieldValue from '@/utils/formatCustomFieldValue';
import { UNCATEGORIZED } from '@/stores/api/materials';

import type { PropType } from 'vue';
import type { MaterialDetails } from '@/stores/api/materials';
import type { PropertyWithValue } from '@/stores/api/properties';

type Props = {
    /** Le matériel dont on veut afficher les informations. */
    material: MaterialDetails,
};

/** Onglet "informations" de la page de détails d'un matériel. */
const MaterialViewInfos = defineComponent({
    name: 'MaterialViewInfos',
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

        categoryName(): string {
            const { __, material } = this;
            const { category_id: categoryId } = material;
            const categoryNameGetter = this.$store.getters['categories/categoryName'];
            return categoryNameGetter(categoryId) ?? __('global.not-categorized');
        },

        subCategoryName(): string {
            const { sub_category_id: subCategoryId } = this.material;
            const subCategoryNameGetter = this.$store.getters['categories/subCategoryName'];
            return subCategoryNameGetter(subCategoryId);
        },

        hasMultipleParks(): boolean {
            return this.$store.state.parks.list.length > 1;
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

        hasProperties(): boolean {
            const { material } = this;

            return (
                material.properties.length > 0 ||
                material.weight !== null ||
                material.origin_country !== null
            );
        },

        hasPricingData(): boolean {
            if (!this.isBillingEnabled) {
                return false;
            }

            return (
                this.rentalPrice !== null ||
                this.replacementPrice !== null
            );
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
            if (!key.startsWith('global.')) {
                if (!key.startsWith('page.')) {
                    key = `page.infos.${key}`;
                }
                key = key.replace(/^page\./, 'page.material-view.');
            } else {
                key = key.replace(/^global\./, '');
            }
            return this.$t(key, params, count);
        },
    },
    render() {
        const { weight: weightUnit } = config.measurementUnits.materials;
        const {
            __,
            categoryName,
            subCategoryName,
            isSimpleVatSystem,
            isBillingEnabled,
            isTaxesEnabled,
            hasPricingData,
            rentalPrice,
            replacementPrice,
            hasProperties,
            hasMultipleParks,
            parkName,
            taxName,
            degressiveRateName,
            material,
        } = this;
        const {
            reference,
            name,
            description,
            stock_quantity: stockQuantity,
            out_of_order_quantity: outOfOrderQuantity,
            available_quantity: availableQuantity,
            is_hidden_on_bill: isHiddenOnBill,
            is_discountable: isDiscountable,
            origin_country: originCountry,
            weight,
            properties,
            picture,
            note,
            tags,
        } = material;

        return (
            <div class="MaterialViewInfos">
                <div class="MaterialViewInfos__main">
                    <h2 class="MaterialViewInfos__reference">
                        {__('global.ref-ref', { reference })}
                    </h2>
                    <h3>
                        <Link
                            to={{
                                name: 'materials',
                                query: {
                                    category: material.category_id?.toString() ?? UNCATEGORIZED,
                                },
                            }}
                        >
                            {categoryName}
                        </Link>
                        {!!subCategoryName && (
                            <Fragment>
                                {' / '}
                                <Link
                                    to={{
                                        name: 'materials',
                                        query: {
                                            category: material.category_id?.toString() ?? UNCATEGORIZED,
                                            subCategory: material.sub_category_id?.toString(),
                                        },
                                    }}
                                >
                                    {subCategoryName}
                                </Link>
                            </Fragment>
                        )}
                        {' / '}
                        {name}
                    </h3>
                    <p class="MaterialViewInfos__description">
                        {description}
                    </p>
                    <h3>{__('global.quantities')}</h3>
                    <ul>
                        <li class="MaterialViewInfos__stock-quantity">
                            {__('global.stock-items-count', { count: stockQuantity || 0 })}
                        </li>
                        {outOfOrderQuantity > 0 && (
                            <li class="MaterialViewInfos__out-of-order">
                                {__('global.out-of-order-items-count', { count: outOfOrderQuantity })}
                            </li>
                        )}
                        <li
                            class={['MaterialViewInfos__available-quantity', {
                                'MaterialViewInfos__available-quantity--warning': availableQuantity < stockQuantity,
                            }]}
                        >
                            {__('global.available-items-count', { count: availableQuantity }, availableQuantity)}
                        </li>
                    </ul>
                    {isBillingEnabled && (
                        <div class="MaterialViewInfos__billing">
                            {hasPricingData && (
                                <Fragment>
                                    <h3>{__('global.prices')}</h3>
                                    {rentalPrice !== null && (
                                        <dl class="MaterialViewInfos__info MaterialViewInfos__info--highlight">
                                            <dt class="MaterialViewInfos__info__label">
                                                {__('global.label-colon', { label: __('global.rental-price') })}
                                            </dt>
                                            <dd class="MaterialViewInfos__info__value">
                                                {__('global.value-per-day', { value: rentalPrice })}
                                            </dd>
                                        </dl>
                                    )}
                                    {replacementPrice !== null && (
                                        <dl class="MaterialViewInfos__info">
                                            <dt class="MaterialViewInfos__info__label">
                                                {__('global.label-colon', { label: __('global.replacement-price') })}
                                            </dt>
                                            <dd class="MaterialViewInfos__info__value">
                                                {replacementPrice}
                                            </dd>
                                        </dl>
                                    )}
                                </Fragment>
                            )}
                            <h3>{__('global.billing')}</h3>
                            <dl class="MaterialViewInfos__info">
                                <dt class="MaterialViewInfos__info__label">
                                    {__('global.label-colon', { label: __('degressive-rate.label') })}
                                </dt>
                                <dd class="MaterialViewInfos__info__value">
                                    {degressiveRateName ?? __('degressive-rate.empty')}
                                </dd>
                            </dl>
                            {isTaxesEnabled && (
                                <dl class="MaterialViewInfos__info">
                                    <dt class="MaterialViewInfos__info__label">
                                        {__('global.label-colon', {
                                            label: __(`tax.label.${isSimpleVatSystem ? 'simple' : 'default'}`),
                                        })}
                                    </dt>
                                    <dd class="MaterialViewInfos__info__value">
                                        {taxName ?? __(`tax.empty.${isSimpleVatSystem ? 'simple' : 'default'}`)}
                                    </dd>
                                </dl>
                            )}
                            {isHiddenOnBill && (
                                <p>{__('global.material-not-displayed-on-invoice')}</p>
                            )}
                            {isDiscountable && (
                                <p>{__('global.material-is-discountable')}</p>
                            )}
                        </div>
                    )}
                    {hasProperties && (
                        <div class="MaterialViewInfos__properties">
                            <h3>{__('global.properties')}</h3>
                            <dl class="MaterialViewInfos__properties__list">
                                {weight !== null && (
                                    <div class="MaterialViewInfos__properties__item">
                                        <dt class="MaterialViewInfos__properties__item__name">
                                            {__('global.label-colon', { label: __('global.weight') })}
                                        </dt>
                                        <dd class="MaterialViewInfos__properties__item__value">
                                            {formatNumber(weight)}&nbsp;{weightUnit}
                                        </dd>
                                    </div>
                                )}
                                {originCountry !== null && (
                                    <div class="MaterialViewInfos__properties__item">
                                        <dt class="MaterialViewInfos__properties__item__name">
                                            {__('global.label-colon', { label: __('global.origin-country') })}
                                        </dt>
                                        <dd class="MaterialViewInfos__properties__item__value">
                                            {originCountry.name}
                                        </dd>
                                    </div>
                                )}
                                {properties.map((property: PropertyWithValue) => (
                                    <div key={property.id} class="MaterialViewInfos__properties__item">
                                        <dt class="MaterialViewInfos__properties__item__name">
                                            {__('global.label-colon', { label: property.name })}
                                        </dt>
                                        <dd class="MaterialViewInfos__properties__item__value">
                                            {formatCustomFieldValue(__, property)}
                                        </dd>
                                    </div>
                                ))}
                            </dl>
                        </div>
                    )}
                    {!!note && (
                        <div class="MaterialViewInfos__notes">
                            <h3>{__('global.notes')}</h3>
                            <p class="MaterialViewInfos__notes">{note}</p>
                        </div>
                    )}
                </div>
                <div class="MaterialViewInfos__secondary">
                    {!!picture && (
                        <section class="MaterialViewInfos__picture">
                            <a
                                href={picture}
                                target="blank"
                                title={__('click-to-open-image')}
                                class="MaterialViewInfos__picture__link"
                            >
                                <img
                                    src={picture}
                                    alt={name}
                                    class="MaterialViewInfos__picture__img"
                                />
                            </a>
                        </section>
                    )}
                    <section class="MaterialViewInfos__extras">
                        <div class="MaterialViewInfos__extra MaterialViewInfos__extra--categories">
                            <p class="MaterialViewInfos__extra__item">
                                {__('global.category')}: <strong>{categoryName}</strong>
                            </p>
                            {!!subCategoryName && (
                                <p class="MaterialViewInfos__extra__item">
                                    {__('global.sub-category')}: <strong>{subCategoryName}</strong>
                                </p>
                            )}
                        </div>
                        {(hasMultipleParks && parkName !== null) && (
                            <div class="MaterialViewInfos__extra MaterialViewInfos__extra--park">
                                {(hasMultipleParks && parkName !== null) && (
                                    <p class="MaterialViewInfos__extra__item">
                                        {__('park-name', { name: parkName })}
                                    </p>
                                )}
                            </div>
                        )}
                        {!!(tags && tags.length > 0) && <TagsList tags={tags} />}
                        <div class="MaterialViewInfos__extra MaterialViewInfos__extra--dates">
                            <p class="MaterialViewInfos__extra__item">
                                {__('global.created-at', { date: material.created_at.toReadable() })}
                            </p>
                            {!!material.updated_at && (
                                <p class="MaterialViewInfos__extra__item">
                                    {__('global.updated-at', { date: material.updated_at.toReadable() })}
                                </p>
                            )}
                        </div>
                    </section>
                </div>
            </div>
        );
    },
});

export default MaterialViewInfos;
