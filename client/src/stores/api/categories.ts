import { z } from '@/utils/validation';
import requester from '@/globals/requester';
import { SubCategorySchema } from './subcategories';

import type { SchemaInfer } from '@/utils/validation';

// ------------------------------------------------------
// -
// -    Schema / Enums
// -
// ------------------------------------------------------

export const CategorySchema = z.object({
    id: z.number(),
    name: z.string(),
});

export const CategoryDetailsSchema = CategorySchema.extend({
    sub_categories: z.lazy(() => SubCategorySchema.array()),
});

// ------------------------------------------------------
// -
// -    Types
// -
// ------------------------------------------------------

export type Category = SchemaInfer<typeof CategorySchema>;

export type CategoryDetails = SchemaInfer<typeof CategoryDetailsSchema>;

//
// - Edition
//

export type CategoryEdit = {
    name: string,
};

// ------------------------------------------------------
// -
// -    Fonctions
// -
// ------------------------------------------------------

const all = async (): Promise<CategoryDetails[]> => {
    const response = await requester.get('/categories');
    return CategoryDetailsSchema.array().parse(response);
};

const create = async (data: CategoryEdit): Promise<CategoryDetails> => {
    const response = await requester.post('/categories', data);
    return CategoryDetailsSchema.parse(response);
};

const update = async (id: Category['id'], data: Partial<CategoryEdit>): Promise<CategoryDetails> => {
    const response = await requester.put(`/categories/${id}`, data);
    return CategoryDetailsSchema.parse(response);
};

const remove = async (id: Category['id']): Promise<void> => {
    await requester.delete(`/categories/${id}`);
};

export default { all, create, update, remove };
