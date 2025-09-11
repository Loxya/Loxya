import { z } from '@/utils/validation';
import requester from '@/globals/requester';

import type { Category } from './categories';
import type { SchemaInfer } from '@/utils/validation';

// ------------------------------------------------------
// -
// -    Schema / Enums
// -
// ------------------------------------------------------

export const SubCategorySchema = z.object({
    id: z.number(),
    name: z.string(),
    category_id: z.number(),
});

// ------------------------------------------------------
// -
// -    Types
// -
// ------------------------------------------------------

export type SubCategory = SchemaInfer<typeof SubCategorySchema>;

//
// - Edition
//

export type SubCategoryCreate = {
    name: string,
    category_id: Category['id'],
};

export type SubCategoryEdit = Omit<SubCategoryCreate, 'category_id'>;

// ------------------------------------------------------
// -
// -    Fonctions
// -
// ------------------------------------------------------

const create = async (data: SubCategoryCreate): Promise<SubCategory> => {
    const response = await requester.post('/subcategories', data);
    return SubCategorySchema.parse(response);
};

const update = async (id: SubCategory['id'], data: SubCategoryEdit): Promise<SubCategory> => {
    const response = await requester.put(`/subcategories/${id}`, data);
    return SubCategorySchema.parse(response);
};

const remove = async (id: SubCategory['id']): Promise<void> => {
    await requester.delete(`/subcategories/${id}`);
};

export default { create, update, remove };
