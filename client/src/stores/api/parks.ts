import { z } from '@/utils/validation';
import requester from '@/globals/requester';
import { withPaginationEnvelope } from './@schema';
import { MaterialSchema } from './materials';

import type { Raw } from 'vue';
import type Decimal from 'decimal.js';
import type { Material } from './materials';
import type { SchemaInfer } from '@/utils/validation';
import type { PaginatedData, ListingParams } from './@types';

// ------------------------------------------------------
// -
// -    Schema / Enums
// -
// ------------------------------------------------------

export const ParkSchema = z.strictObject({
    id: z.number(),
    name: z.string(),
    street: z.string().nullable(),
    postal_code: z.string().nullable(),
    locality: z.string().nullable(),
    country_id: z.number().nullable(),
    opening_hours: z.string().nullable(),
    total_items: z.number().nonnegative(),
    total_stock_quantity: z.number().nonnegative(),
    note: z.string().nullable(),
});

export const ParkSummarySchema = ParkSchema.pick({
    id: true,
    name: true,
});

export const ParkDetailsSchema = ParkSchema.extend({
    has_ongoing_booking: z.boolean(),
});

// ------------------------------------------------------
// -
// -    Types
// -
// ------------------------------------------------------

export type Park = SchemaInfer<typeof ParkSchema>;

export type ParkSummary = SchemaInfer<typeof ParkSummarySchema>;

export type ParkDetails = SchemaInfer<typeof ParkDetailsSchema>;

//
// - Edition
//

export type ParkEdit = {
    name: string,
    street: string | null,
    postal_code: string | null,
    locality: string | null,
    country_id: number | null,
    opening_hours: string | null,
    note: string | null,
};

//
// - Récupération
//

type GetAllParams = ListingParams & { deleted?: boolean };

// ------------------------------------------------------
// -
// -    Fonctions
// -
// ------------------------------------------------------

const all = async (params: GetAllParams = {}): Promise<PaginatedData<Park[]>> => {
    const response = (await requester.get('/parks', { params }));
    return withPaginationEnvelope(ParkSchema).parse(response);
};

const list = async (): Promise<ParkSummary[]> => {
    const response = await requester.get('/parks/list');
    return ParkSummarySchema.array().parse(response);
};

const one = async (id: Park['id']): Promise<ParkDetails> => {
    const response = await requester.get(`/parks/${id}`);
    return ParkDetailsSchema.parse(response);
};

const oneTotalAmount = async (id: Park['id']): Promise<Raw<Decimal>> => {
    const response = await requester.get(`/parks/${id}/total-amount`);
    return z.decimal().parse(response);
};

const materials = async (id: Park['id']): Promise<Material[]> => {
    const response = await requester.get(`/parks/${id}/materials`);
    return MaterialSchema.array().parse(response);
};

const create = async (data: ParkEdit): Promise<ParkDetails> => {
    const response = await requester.post('/parks', data);
    return ParkDetailsSchema.parse(response);
};

const update = async (id: Park['id'], data: ParkEdit): Promise<ParkDetails> => {
    const response = await requester.put(`/parks/${id}`, data);
    return ParkDetailsSchema.parse(response);
};

const restore = async (id: Park['id']): Promise<ParkDetails> => {
    const response = await requester.put(`/parks/restore/${id}`);
    return ParkDetailsSchema.parse(response);
};

const remove = async (id: Park['id']): Promise<void> => {
    await requester.delete(`/parks/${id}`);
};

export default {
    all,
    list,
    one,
    oneTotalAmount,
    materials,
    create,
    update,
    restore,
    remove,
};
