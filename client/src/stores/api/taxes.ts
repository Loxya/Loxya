import { z } from '@/utils/validation';
import requester from '@/globals/requester';

import type { SchemaInfer } from '@/utils/validation';

// ------------------------------------------------------
// -
// -    Schema / Enums
// -
// ------------------------------------------------------

const TaxComponentSchema = z.strictObject({
    name: z.string(),
    value: z.decimal(),
});

const BaseTaxSchema = z.strictObject({
    id: z.number(),
    is_used: z.boolean(),
});

export const TaxSchema = z.discriminatedUnion('is_group', [
    BaseTaxSchema.extend({
        name: z.string(),
        is_group: z.literal(true),
        components: z.lazy(() => TaxComponentSchema.array()),
    }),
    BaseTaxSchema.extend({
        name: z.string().optional(),
        is_group: z.literal(false),
        value: z.decimal(),
    }),
]);

// ------------------------------------------------------
// -
// -    Types
// -
// ------------------------------------------------------

export type Tax = SchemaInfer<typeof TaxSchema>;

export type TaxComponent = SchemaInfer<typeof TaxComponentSchema>;

//
// - Edition
//

export type TaxComponentEdit = {
    name: string | null,
    value: string | null,
};

export type TaxEdit = {
    name: string | null,
    is_group: boolean,
    value: string | null,
    components?: TaxComponentEdit[],
};

// ------------------------------------------------------
// -
// -    Fonctions
// -
// ------------------------------------------------------

const all = async (): Promise<Tax[]> => {
    const response = await requester.get('/taxes');
    return TaxSchema.array().parse(response);
};

const create = async (data: TaxEdit): Promise<Tax> => {
    const response = await requester.post('/taxes', data);
    return TaxSchema.parse(response);
};

const update = async (id: Tax['id'], data: TaxEdit): Promise<Tax> => {
    const response = await requester.put(`/taxes/${id}`, data);
    return TaxSchema.parse(response);
};

const remove = async (id: Tax['id']): Promise<void> => {
    await requester.delete(`/taxes/${id}`);
};

export default { all, create, update, remove };
