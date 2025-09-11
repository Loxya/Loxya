import { z } from '@/utils/validation';
import requester from '@/globals/requester';

import type { SchemaInfer } from '@/utils/validation';

// ------------------------------------------------------
// -
// -    Schema / Enums
// -
// ------------------------------------------------------

export const TagSchema = z.strictObject({
    id: z.number(),
    name: z.string(),
});

// ------------------------------------------------------
// -
// -    Types
// -
// ------------------------------------------------------

export type Tag = SchemaInfer<typeof TagSchema>;

//
// - Edition
//

export type TagEdit = {
    name: string,
};

//
// - Récupération
//

type GetAllParams = { deleted?: boolean };

// ------------------------------------------------------
// -
// -    Fonctions
// -
// ------------------------------------------------------

const all = async (params: GetAllParams = {}): Promise<Tag[]> => {
    const response = await requester.get('/tags', { params });
    return TagSchema.array().parse(response);
};

const create = async (data: TagEdit): Promise<Tag> => {
    const response = await requester.post('/tags', data);
    return TagSchema.parse(response);
};

const update = async (id: Tag['id'], data: TagEdit): Promise<Tag> => {
    const response = await requester.put(`/tags/${id}`, data);
    return TagSchema.parse(response);
};

const restore = async (id: Tag['id']): Promise<Tag> => {
    const response = await requester.put(`/tags/restore/${id}`);
    return TagSchema.parse(response);
};

const remove = async (id: Tag['id']): Promise<void> => {
    await requester.delete(`/tags/${id}`);
};

export default { all, create, update, restore, remove };
