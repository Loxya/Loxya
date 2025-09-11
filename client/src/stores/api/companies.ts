import { z } from '@/utils/validation';
import requester from '@/globals/requester';
import { withPaginationEnvelope } from './@schema';
import { CountrySchema } from './countries';

import type { SchemaInfer } from '@/utils/validation';
import type { Country } from './countries';
import type { PaginatedData, ListingParams } from './@types';

// ------------------------------------------------------
// -
// -    Schema / Enums
// -
// ------------------------------------------------------

export const CompanySchema = z.strictObject({
    id: z.number(),
    legal_name: z.string(),
    registration_id: z.string().nullable(),
    phone: z.string().nullable(),
    street: z.string().nullable(),
    postal_code: z.string().nullable(),
    locality: z.string().nullable(),
    country_id: z.number().nullable(),
    country: z.lazy(() => CountrySchema).nullable(),
    full_address: z.string().nullable(),
    note: z.string().nullable(),
});

// ------------------------------------------------------
// -
// -    Types
// -
// ------------------------------------------------------

export type Company = SchemaInfer<typeof CompanySchema>;

//
// - Edition
//

export type CompanyEdit = {
    legal_name: string,
    registration_id: string | null,
    phone: string | null,
    street: string | null,
    postal_code: string | null,
    locality: string | null,
    country_id: Country['id'] | null,
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

const all = async (params: GetAllParams = {}): Promise<PaginatedData<Company[]>> => {
    const response = await requester.get('/companies', { params });
    return withPaginationEnvelope(CompanySchema).parse(response);
};

const one = async (id: Company['id']): Promise<Company> => {
    const response = await requester.get(`/companies/${id}`);
    return CompanySchema.parse(response);
};

const create = async (data: CompanyEdit): Promise<Company> => {
    const response = await requester.post('/companies', data);
    return CompanySchema.parse(response);
};

const update = async (id: Company['id'], data: CompanyEdit): Promise<Company> => {
    const response = await requester.put(`/companies/${id}`, data);
    return CompanySchema.parse(response);
};

export default { all, one, create, update };
