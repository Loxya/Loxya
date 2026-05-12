import { z } from '@/utils/validation';
import requester from '@/globals/requester';
import { withPaginationEnvelope } from './@schema';

import type { Raw } from 'vue';
import type Country from '@/utils/country';
import type { SchemaInfer } from '@/utils/validation';
import type { PaginatedData, ListingParams } from './@types';

// ------------------------------------------------------
// -
// -    Schema / Enums
// -
// ------------------------------------------------------

export const CompanySchema = z.strictObject({
    id: z.number(),
    legal_name: z.string(),
    is_public_entity: z.boolean(),
    registration_id: z.string().nullable(),
    vat_number: z.string().nullable(),
    invoice_identifier: z.string().nullable(),
    service_code: z.string().nullable(),
    phone: z.phone().nullable(),
    street: z.string().nullable(),
    additional_street: z.string().nullable(),
    postal_code: z.string().nullable(),
    administrative_area: z.string().nullable(),
    locality: z.string().nullable(),
    country: z.country(),
    address: z.string().nullable(),
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
    legal_name: string | null,
    is_public_entity: boolean,
    registration_id: string | null,
    vat_number: string | null,
    invoice_identifier: string | null,
    service_code: string | null,
    phone: string | null,
    street: string | null,
    additional_street: string | null,
    postal_code: string | null,
    administrative_area: string | null,
    locality: string | null,
    country: Raw<Country>,
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
