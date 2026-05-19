import { z } from '@/utils/validation';
import requester from '@/globals/requester';
import { UserSchema } from './users';
import { CompanySchema } from './companies';
import { EstimateSchema } from './estimates';
import { InvoiceSchema } from './invoices';
import { BookingExcerptSchema } from './bookings';
import {
    withPaginationEnvelope,
} from './@schema';

import type { Raw } from 'vue';
import type { SchemaInfer } from '@/utils/validation';
import type Country from '@/utils/country';
import type DateTime from '@/utils/datetime';
import type { Estimate } from './estimates';
import type { Invoice } from './invoices';
import type { BookingExcerpt } from './bookings';
import type {
    Direction,
    ListingParams,
    PaginatedData,
    PaginationParams,
} from './@types';

// ------------------------------------------------------
// -
// -    Schema / Enums
// -
// ------------------------------------------------------

export const BeneficiarySummarySchema = z.strictObject({
    id: z.number(),
    first_name: z.string(),
    last_name: z.string(),
    full_name: z.string(),
    reference: z.string().nullable(),
    company: z.lazy(() => CompanySchema).nullable(),
    email: z.email().nullable(),
});

export const BeneficiarySchema = BeneficiarySummarySchema.extend({
    user_id: z.number().nullable(),
    phone: z.phone().nullable(),
    company_id: z.number().nullable(),
    street: z.string().nullable(),
    additional_street: z.string().nullable(),
    postal_code: z.string().nullable(),
    administrative_area: z.string().nullable(),
    locality: z.string().nullable(),
    country: z.country(),
    address: z.string().nullable(),
    is_invoiceable: z.boolean(),
    is_deleted: z.boolean(),
    language: z.string().nullable(),
    note: z.string().nullable(),
});

export const BeneficiaryDetailsSchema = BeneficiarySchema.extend({
    user: z.lazy(() => UserSchema).nullable(),
    stats: z.strictObject({
        borrowings: z.number().nonnegative(),
    }),
});

// ------------------------------------------------------
// -
// -    Types
// -
// ------------------------------------------------------

export type Beneficiary = SchemaInfer<typeof BeneficiarySchema>;

export type BeneficiarySummary = SchemaInfer<typeof BeneficiarySummarySchema>;

export type BeneficiaryDetails = SchemaInfer<typeof BeneficiaryDetailsSchema>;

//
// - Edition
//

export type BeneficiaryEdit = {
    first_name: string,
    last_name: string,
    reference: string | null,
    email: string | null,
    phone: string | null,
    company_id: number | null,
    street: string | null,
    additional_street: string | null,
    postal_code: string | null,
    administrative_area: string | null,
    locality: string | null,
    country: Raw<Country>,
    user_id?: number,
    pseudo?: string,
    password?: string,
    note: string | null,
};

//
// - Récupération
//

type GetAllParams = ListingParams & {
    /**
     * Permet de ne récupérer que les bénéficiaires dans la "corbeille".
     *
     * @default false
     */
    deleted?: boolean,
};

type GetBookingsParams = PaginationParams & {
    /**
     * Date à partir de laquelle on veut la liste des bookings.
     * Inclura aussi les bookings qui ont commencés avant mais se terminent après cette date.
     *
     * @default undefined
     */
    after?: DateTime,

    /**
     * Le sens dans lequel on veut récupérer les bookings :
     * - `Direction.ASC`: Du plus ancien au plus récent.
     * - `Direction.DESC`: Du plus récent au plus ancien.
     *
     * @default Direction.DESC
     */
    direction?: Direction,
};

// ------------------------------------------------------
// -
// -    Fonctions
// -
// ------------------------------------------------------

const all = async (params: GetAllParams = {}): Promise<PaginatedData<Beneficiary[]>> => {
    const response = await requester.get('/beneficiaries', { params });
    return withPaginationEnvelope(BeneficiarySchema).parse(response);
};

const one = async (id: Beneficiary['id']): Promise<BeneficiaryDetails> => {
    const response = await requester.get(`/beneficiaries/${id}`);
    return BeneficiaryDetailsSchema.parse(response);
};

const create = async (data: BeneficiaryEdit): Promise<BeneficiaryDetails> => {
    const response = await requester.post('/beneficiaries', data);
    return BeneficiaryDetailsSchema.parse(response);
};

const update = async (id: Beneficiary['id'], data: BeneficiaryEdit): Promise<BeneficiaryDetails> => {
    const response = await requester.put(`/beneficiaries/${id}`, data);
    return BeneficiaryDetailsSchema.parse(response);
};

const restore = async (id: Beneficiary['id']): Promise<BeneficiaryDetails> => {
    const response = await requester.put(`/beneficiaries/restore/${id}`);
    return BeneficiaryDetailsSchema.parse(response);
};

const remove = async (id: Beneficiary['id']): Promise<void> => {
    await requester.delete(`/beneficiaries/${id}`);
};

const bookings = async (id: Beneficiary['id'], params: GetBookingsParams = {}): Promise<PaginatedData<BookingExcerpt[]>> => {
    const response = await requester.get(`/beneficiaries/${id}/bookings`, { params });
    return withPaginationEnvelope(BookingExcerptSchema).parse(response);
};

const estimates = async (id: Beneficiary['id']): Promise<Estimate[]> => {
    const response = await requester.get(`/beneficiaries/${id}/estimates`);
    return EstimateSchema.array().parse(response);
};

const invoices = async (id: Beneficiary['id']): Promise<Invoice[]> => {
    const response = await requester.get(`/beneficiaries/${id}/invoices`);
    return InvoiceSchema.array().parse(response);
};

export default {
    all,
    one,
    create,
    update,
    restore,
    remove,
    bookings,
    estimates,
    invoices,
};
