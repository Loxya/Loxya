import './index.scss';
import { defineComponent } from 'vue';
import Fragment from '@/components/Fragment';
import config, { BillingMode } from '@/globals/config';
import formatAmount from '@/utils/formatAmount';
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

        categoryName(): string {
            const { $t: __, material } = this;
            const { category_id: categoryId } = material;
            const categoryNameGetter = this.$store.getters['categories/categoryName'];
            return categoryNameGetter(categoryId) ?? __('not-categorized');
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
            return this.$store.getters['parks/getName'](parkId);
        },

        taxName(): string | null {
            const { tax_id: taxId } = this.material;
            return this.$store.getters['taxes/getName'](taxId);
        },

        degressiveRateName(): string | null {
            const { degressive_rate_id: degressiveRateId } = this.material;
            return this.$store.getters['degressiveRates/getName'](degressiveRateId);
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

        hasPricingData(): boolean {
            return (
                this.rentalPrice !== null ||
                this.replacementPrice !== null
            );
        },
    },
    mounted() {
        this.$store.dispatch('parks/fetch');
        this.$store.dispatch('taxes/fetch');
        this.$store.dispatch('degressiveRates/fetch');
    },
    render() {
        const {
            $t: __,
            categoryName,
            subCategoryName,
            isBillingEnabled,
            hasPricingData,
            rentalPrice,
            replacementPrice,
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
            properties,
            picture,
            note,
            tags,
        } = material;

        return (
            <div class="MaterialViewInfos">
                <div class="MaterialViewInfos__main">
                    <h2 class="MaterialViewInfos__reference">
                        {__('ref-ref', { reference })}
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
                    <h3>{__('quantities')}</h3>
                    <ul>
                        <li class="MaterialViewInfos__stock-quantity">
                            {__('stock-items-count', { count: stockQuantity || 0 })}
                        </li>
                        {outOfOrderQuantity > 0 && (
                            <li class="MaterialViewInfos__out-of-order">
                                {__('out-of-order-items-count', { count: outOfOrderQuantity })}
                            </li>
                        )}
                        <li
                            class={['MaterialViewInfos__available-quantity', {
                                'MaterialViewInfos__available-quantity--warning': availableQuantity < stockQuantity,
                            }]}
                        >
                            {__('available-items-count', { count: availableQuantity }, availableQuantity)}
                        </li>
                    </ul>
                    {isBillingEnabled && (
                        <div class="MaterialViewInfos__billing">
                            {hasPricingData && (
                                <Fragment>
                                    <h3>{__('prices')}</h3>
                                    {rentalPrice !== null && (
                                        <dl class="MaterialViewInfos__info MaterialViewInfos__info--highlight">
                                            <dt class="MaterialViewInfos__info__label">
                                                {__('label-colon', { label: __('rental-price') })}
                                            </dt>
                                            <dd class="MaterialViewInfos__info__value">
                                                {__('value-per-day', { value: rentalPrice })}
                                            </dd>
                                        </dl>
                                    )}
                                    {replacementPrice !== null && (
                                        <dl class="MaterialViewInfos__info">
                                            <dt class="MaterialViewInfos__info__label">
                                                {__('label-colon', { label: __('replacement-price') })}
                                            </dt>
                                            <dd class="MaterialViewInfos__info__value">
                                                {replacementPrice}
                                            </dd>
                                        </dl>
                                    )}
                                </Fragment>
                            )}
                            <h3>{__('billing')}</h3>
                            <dl class="MaterialViewInfos__info">
                                <dt class="MaterialViewInfos__info__label">
                                    {__('label-colon', { label: __('page.material-view.infos.tax') })}
                                </dt>
                                <dd class="MaterialViewInfos__info__value">
                                    {taxName ?? __('page.material-view.infos.no-tax')}
                                </dd>
                            </dl>
                            <dl class="MaterialViewInfos__info">
                                <dt class="MaterialViewInfos__info__label">
                                    {__('label-colon', { label: __('page.material-view.infos.degressive-rate') })}
                                </dt>
                                <dd class="MaterialViewInfos__info__value">
                                    {degressiveRateName ?? __('page.material-view.infos.no-degressive-rate')}
                                </dd>
                            </dl>
                            {isHiddenOnBill && (
                                <p>{__('material-not-displayed-on-invoice')}</p>
                            )}
                            {isDiscountable && (
                                <p>{__('material-is-discountable')}</p>
                            )}
                        </div>
                    )}
                    {properties.length > 0 && (
                        <div class="MaterialViewInfos__properties">
                            <h3>{__('properties')}</h3>
                            <dl class="MaterialViewInfos__properties__list">
                                {properties.map((property: PropertyWithValue) => (
                                    <div key={property.id} class="MaterialViewInfos__properties__item">
                                        <dt class="MaterialViewInfos__properties__item__name">
                                            {__('label-colon', { label: property.name })}
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
                            <h3>{__('notes')}</h3>
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
                                title={__('page.material-view.infos.click-to-open-image')}
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
                                {__('category')}: <strong>{categoryName}</strong>
                            </p>
                            {!!subCategoryName && (
                                <p class="MaterialViewInfos__extra__item">
                                    {__('sub-category')}: <strong>{subCategoryName}</strong>
                                </p>
                            )}
                        </div>
                        {hasMultipleParks && (
                            <div class="MaterialViewInfos__extra MaterialViewInfos__extra--park">
                                <p class="MaterialViewInfos__extra__item">
                                    {__('page.material-view.infos.park-name', { name: parkName })}
                                </p>
                            </div>
                        )}
                        {!!(tags && tags.length > 0) && <TagsList tags={tags} />}
                        <div class="MaterialViewInfos__extra MaterialViewInfos__extra--dates">
                            <p class="MaterialViewInfos__extra__item">
                                {__('created-at', { date: material.created_at.toReadable() })}
                            </p>
                            {!!material.updated_at && (
                                <p class="MaterialViewInfos__extra__item">
                                    {__('updated-at', { date: material.updated_at.toReadable() })}
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
