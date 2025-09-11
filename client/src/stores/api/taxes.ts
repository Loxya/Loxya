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
    is_rate: z.boolean(),
    value: z.decimal(),
});

export const TaxSchema = z
    .strictObject({
        id: z.number(),
        name: z.string(),
        is_used: z.boolean(),
    })
    .strip() // TODO: À enlever lorsqu'on pourra garder les objets stricts avec les intersections.
    .and(z.discriminatedUnion('is_group', [
        z.object({ // TODO: `strictObject` lorsque ce sera possible.
            is_group: z.literal(true),
            components: z.lazy(() => TaxComponentSchema.array()),
        }),
        z.object({ // TODO: `strictObject` lorsque ce sera possible.
            is_group: z.literal(false),
            is_rate: z.boolean(),
            value: z.decimal(),
        }),
    ]));

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
    is_rate: boolean | null,
    value: string | null,
};

export type TaxEdit = {
    name: string | null,
    is_group: boolean,
    is_rate: boolean | null,
    value: string | null,
    components: TaxComponentEdit[],
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
