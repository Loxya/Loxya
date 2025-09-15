import { z } from '@/utils/validation';
import requester from '@/globals/requester';
import { CountrySchema } from './countries';

import type { Raw } from 'vue';
import type { ProgressCallback } from '@/globals/requester';
import type { SchemaInfer } from '@/utils/validation';

// ------------------------------------------------------
// -
// -    Schema / Enums
// -
// ------------------------------------------------------

export const BillingCompanySchema = z.strictObject({
    id: z.number(),
    name: z.string(),
    logo: z.string().nullable(),
    street: z.string(),
    postal_code: z.string(),
    locality: z.string(),
    country_id: z.number(),
    country: z.lazy(() => CountrySchema),
    full_address: z.string(),
    phone: z.string().nullable(),
    email: z.string().email().nullable(),
    website: z.string().url().nullable(),
    vat_number: z.string().nullable(),
    code1_label: z.string().nullable(),
    code1_value: z.string().nullable(),
    code2_label: z.string().nullable(),
    code2_value: z.string().nullable(),
});

// ------------------------------------------------------
// -
// -    Types
// -
// ------------------------------------------------------

export type BillingCompany = SchemaInfer<typeof BillingCompanySchema>;

//
// - Edition
//

export type BillingCompanyEdit = {
    name: string,
    logo?: Raw<File> | null,
    street: string,
    postal_code: string,
    locality: string,
    country_id: number | null,
    phone: string | null,
    email: string | null,
    website: string | null,
    vat_number: string | null,
    code1_label: string | null,
    code1_value: string | null,
    code2_label: string | null,
    code2_value: string | null,
};

// ------------------------------------------------------
// -
// -    Fonctions
// -
// ------------------------------------------------------

const all = async (): Promise<BillingCompany[]> => {
    const response = await requester.get('/billing-companies');
    return BillingCompanySchema.array().parse(response);
};

const one = async (id: BillingCompany['id']): Promise<BillingCompany> => {
    const response = await requester.get(`/billing-companies/${id}`);
    return BillingCompanySchema.parse(response);
};

const create = async (data: BillingCompanyEdit, onProgress?: ProgressCallback): Promise<BillingCompany> => {
    const response = await requester.post('/billing-companies', data, {
        ...(onProgress ? { onProgress } : {}),
    });
    return BillingCompanySchema.parse(response);
};

const update = async (id: BillingCompany['id'], data: BillingCompanyEdit, onProgress?: ProgressCallback): Promise<BillingCompany> => {
    const response = await requester.put(`/billing-companies/${id}`, data, {
        ...(onProgress ? { onProgress } : {}),
    });
    return BillingCompanySchema.parse(response);
};

const remove = async (id: BillingCompany['id']): Promise<void> => {
    await requester.delete(`/billing-companies/${id}`);
};

export default { all, one, create, update, remove };
