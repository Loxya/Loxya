import isEqual from 'lodash/isEqual';
import { z } from '@/utils/validation';
import isTruthy from '@/utils/isTruthy';
import { defineComponent } from 'vue';
import { UNCATEGORIZED } from '@/stores/api/materials';
import formatOptions from '@/utils/formatOptions';
import SearchPanel from '@/themes/default/components/SearchPanel';

import type { PropType } from 'vue';
import type { SchemaInfer } from '@/utils/validation';
import type { Tag } from '@/stores/api/tags';
import type { ParkSummary } from '@/stores/api/parks';
import type { Options } from '@/utils/formatOptions';
import type { SubCategory } from '@/stores/api/subcategories';
import type { Category, CategoryDetails } from '@/stores/api/categories';
import type { FilterDefinition } from '@/themes/default/components/SearchPanel';

export enum TokenType {
    PARK = 'park',
    CATEGORY = 'category',
    SUB_CATEGORY = 'subCategory',
    TAGS = 'tags',
}

export const FiltersSchema = z.strictObject({
    search: z.string().array(),
    [TokenType.PARK]: z.number().nullable(),
    [TokenType.CATEGORY]: z.union([z.number(), z.literal(UNCATEGORIZED)]).nullable(),
    [TokenType.SUB_CATEGORY]: z.number().nullable(),
    [TokenType.TAGS]: z.number().array(),
});

export type Filters = SchemaInfer<typeof FiltersSchema>;

type Props = {
    /** Les valeurs actuelles des filtres. */
    values: Filters,

    /**
     * Fonction appelée lorsque les filtres ont changés.
     *
     * @param newFilters - Les nouveaux filtres.
     */
    onChange?(newFilters: Filters): void,

    /**
     * Fonction appelée lorsque l'utilisateur a soumis
     * les changements dans les filtres.
     */
    onSubmit?(): void,
};

/** Filtres d'une liste de matériel. */
const MaterialsFilters = defineComponent({
    name: 'MaterialsFilters',
    props: {
        values: {
            type: Object as PropType<Required<Props>['values']>,
            required: true,
            validator: (value: unknown) => (
                FiltersSchema.safeParse(value).success
            ),
        },
        // eslint-disable-next-line vue/no-unused-properties
        onChange: {
            type: Function as PropType<Props['onChange']>,
            default: undefined,
        },
        // eslint-disable-next-line vue/no-unused-properties
        onSubmit: {
            type: Function as PropType<Props['onSubmit']>,
            default: undefined,
        },
    },
    emits: ['change', 'submit'],
    computed: {
        parksOptions(): Options<ParkSummary> {
            return this.$store.getters['parks/options'];
        },

        tagsOptions(): Options<Tag> {
            return this.$store.getters['tags/options'];
        },

        categoriesOptions(): Options<Category> {
            const { $t: __ } = this;

            // - On garde le tableau à vide le temps d'avoir récupéré les options pour
            //   éviter que le component `<Search />` pense qu'on a toutes les valeurs
            //   possibles et supprime les valeurs absentes.
            if (!this.$store.state.categories.isFetched) {
                return [];
            }

            return [
                { value: UNCATEGORIZED, label: __('not-categorized') },
                ...this.$store.getters['categories/options'],
            ];
        },

        subCategoriesOptions(): Options<SubCategory> {
            const { [TokenType.CATEGORY]: categoryId } = this.values;
            if (categoryId === undefined || categoryId === UNCATEGORIZED) {
                return [];
            }

            const category = (this.$store.state.categories.list as CategoryDetails[]).find(
                (_category: CategoryDetails) => _category.id === categoryId,
            );
            if (!category) {
                return [];
            }

            return formatOptions(category.sub_categories);
        },

        withParkFilter(): boolean {
            return (
                this.values[TokenType.PARK] !== null ||
                this.parksOptions.length > 1
            );
        },

        isSubCategoriesDisabled(): boolean {
            return (
                this.values[TokenType.CATEGORY] === null ||
                this.values[TokenType.CATEGORY] === UNCATEGORIZED
            );
        },

        definitions(): FilterDefinition[] {
            const {
                $t: __,
                withParkFilter,
                isSubCategoriesDisabled,
                parksOptions,
                tagsOptions,
                categoriesOptions,
                subCategoriesOptions,
            } = this;

            return [
                withParkFilter && {
                    type: TokenType.PARK,
                    icon: 'industry',
                    title: __('park'),
                    placeholder: __('all-parks'),
                    options: parksOptions,
                },
                {
                    type: TokenType.CATEGORY,
                    icon: 'sitemap',
                    title: __('category'),
                    placeholder: __('all-categories'),
                    options: categoriesOptions,
                },
                {
                    type: TokenType.SUB_CATEGORY,
                    icon: 'sitemap',
                    title: __('sub-category'),
                    disabled: isSubCategoriesDisabled,
                    placeholder: __('all-sub-categories'),
                    options: subCategoriesOptions,
                },
                {
                    type: TokenType.TAGS,
                    icon: 'tags',
                    title: __('tags'),
                    options: tagsOptions,
                    placeholder: __('all-tags'),
                    multiSelect: true,
                },
            ].filter(isTruthy);
        },
    },
    created() {
        this.$store.dispatch('tags/fetch');
        this.$store.dispatch('parks/fetch');
        this.$store.dispatch('categories/fetch');
    },
    methods: {
        // ------------------------------------------------------
        // -
        // -    Handlers
        // -
        // ------------------------------------------------------

        handleChange(newFilters: Filters) {
            const normalizedNewFilters: Filters = { ...newFilters };
            if (!(TokenType.PARK in normalizedNewFilters) || !this.withParkFilter) {
                normalizedNewFilters[TokenType.PARK] = null;
            }
            if (
                newFilters[TokenType.CATEGORY] === null &&
                newFilters[TokenType.SUB_CATEGORY] !== null
            ) {
                normalizedNewFilters[TokenType.SUB_CATEGORY] = null;
            }

            if (!isEqual(this.values, normalizedNewFilters)) {
                this.$emit('change', normalizedNewFilters);
            }
        },

        handleSubmit() {
            this.$emit('submit');
        },
    },
    render() {
        const {
            values,
            definitions,
            handleChange,
            handleSubmit,
        } = this;

        return (
            <SearchPanel
                values={values}
                definitions={definitions}
                onChange={handleChange}
                onSubmit={handleSubmit}
            />
        );
    },
});

export default MaterialsFilters;
