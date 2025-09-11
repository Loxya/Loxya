import { z } from '@/utils/validation';
import requester from '@/globals/requester';

import type { SchemaInfer } from '@/utils/validation';

// ------------------------------------------------------
// -
// -    Schema / Enums
// -
// ------------------------------------------------------

export const RoleSchema = z.strictObject({
    id: z.number(),
    name: z.string(),
    is_used: z.boolean(),
});

// ------------------------------------------------------
// -
// -    Types
// -
// ------------------------------------------------------

export type Role = SchemaInfer<typeof RoleSchema>;

//
// - Edition
//

export type RoleCreate = {
    name: string,
};

export type RoleEdit = RoleCreate;

// ------------------------------------------------------
// -
// -    Fonctions
// -
// ------------------------------------------------------

const all = async (): Promise<Role[]> => {
    const response = await requester.get('/roles');
    return RoleSchema.array().parse(response);
};

const create = async (data: RoleCreate): Promise<Role> => {
    const response = await requester.post('/roles', data);
    return RoleSchema.parse(response);
};

const update = async (id: Role['id'], data: RoleEdit): Promise<Role> => {
    const response = await requester.put(`/roles/${id}`, data);
    return RoleSchema.parse(response);
};

const remove = async (id: Role['id']): Promise<void> => {
    await requester.delete(`/roles/${id}`);
};

export default { all, create, update, remove };
