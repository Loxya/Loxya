import createEntityStore from '@/utils/createEntityStore';
import apiCategories from '@/stores/api/categories';

import type { RootState } from '.';
import type { EntityState } from '@/utils/createEntityStore';
import type { Category, CategoryDetails } from '@/stores/api/categories';
import type { SubCategory } from '@/stores/api/subcategories';

export type State = EntityState<CategoryDetails>;

export default createEntityStore<CategoryDetails, RootState>(
    () => apiCategories.all(),
    {
        category: (state: State) => (
            (id: Category['id']): CategoryDetails | undefined => (
                state.list.find((_category) => _category.id === id)
            )
        ),

        categoryName: (state: State) => (
            (id: Category['id']): string | null => (
                state.list.find((_category) => _category.id === id)?.name ?? null
            )
        ),

        subCategoryName: (state: State) => (
            (subCategoryId: SubCategory['id']): string | null => {
                let name: string | null = null;
                state.list.forEach((category: CategoryDetails) => {
                    if (name === null) {
                        const subCategory = category.sub_categories.find(
                            (_subCategory: SubCategory) => (
                                _subCategory.id === subCategoryId
                            ),
                        );
                        name = subCategory?.name ?? null;
                    }
                });
                return name;
            }
        ),
    },
);
