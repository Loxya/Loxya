import { z } from '@/utils/validation';
import requester from '@/globals/requester';

import type { SchemaInfer } from '@/utils/validation';

// ------------------------------------------------------
// -
// -    Schema / Enums
// -
// ------------------------------------------------------

const DegressiveRateTierSchema = z.strictObject({
    from_day: z.number().int().positive(),
    is_rate: z.boolean(),
    value: z.decimal(),
});

export const DegressiveRateSchema = z.strictObject({
    id: z.number(),
    name: z.string(),
    is_used: z.boolean(),
    tiers: z.lazy(() => DegressiveRateTierSchema.array()),
});

// ------------------------------------------------------
// -
// -    Types
// -
// ------------------------------------------------------

export type DegressiveRate = SchemaInfer<typeof DegressiveRateSchema>;

export type DegressiveRateTier = SchemaInfer<typeof DegressiveRateTierSchema>;

//
// - Edition
//

export type DegressiveRateTierEdit = {
    from_day: number | string | null,
    is_rate: boolean | null,
    value: string | null,
};

export type DegressiveRateEdit = {
    name: string | null,
    tiers: DegressiveRateTierEdit[],
};

// ------------------------------------------------------
// -
// -    Fonctions
// -
// ------------------------------------------------------

const all = async (): Promise<DegressiveRate[]> => {
    const response = await requester.get('/degressive-rates');
    return DegressiveRateSchema.array().parse(response);
};

const create = async (data: DegressiveRateEdit): Promise<DegressiveRate> => {
    const response = await requester.post('/degressive-rates', data);
    return DegressiveRateSchema.parse(response);
};

const update = async (id: DegressiveRate['id'], data: DegressiveRateEdit): Promise<DegressiveRate> => {
    const response = await requester.put(`/degressive-rates/${id}`, data);
    return DegressiveRateSchema.parse(response);
};

const remove = async (id: DegressiveRate['id']): Promise<void> => {
    await requester.delete(`/degressive-rates/${id}`);
};

export default { all, create, update, remove };
