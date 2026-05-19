import { z } from '@/utils/validation';
import { withPaginationEnvelope } from './@schema';
import requester from '@/globals/requester';

import type { SchemaInfer } from '@/utils/validation';
import type { PaginatedData, ListingParams } from './@types';

// ------------------------------------------------------
// -
// -    Schema / Enums
// -
// ------------------------------------------------------

export const PersonSchema = z.strictObject({
    id: z.number(),
    user_id: z.number().nullable(),
    first_name: z.string(),
    last_name: z.string(),
    full_name: z.string(),
    email: z.email().nullable(),
    phone: z.phone().nullable(),
    street: z.string().nullable(),
    additional_street: z.string().nullable(),
    postal_code: z.string().nullable(),
    administrative_area: z.string().nullable(),
    locality: z.string().nullable(),
    country: z.country(),
    address: z.string().nullable(),
});

// ------------------------------------------------------
// -
// -    Types
// -
// ------------------------------------------------------

export type Person = SchemaInfer<typeof PersonSchema>;

// ------------------------------------------------------
// -
// -    Fonctions
// -
// ------------------------------------------------------

const all = async (params: ListingParams = {}): Promise<PaginatedData<Person[]>> => {
    const response = await requester.get('/persons', { params });
    return withPaginationEnvelope(PersonSchema).parse(response);
};

export default { all };
