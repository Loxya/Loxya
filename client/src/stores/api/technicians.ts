import { z } from '@/utils/validation';
import requester from '@/globals/requester';
import { CountrySchema } from './countries';
import { DocumentSchema } from './documents';
import { EventSchema } from './events';
import { UserSchema } from './users';
import { RoleSchema } from './roles';
import { withPaginationEnvelope } from './@schema';

import type { Raw } from 'vue';
import type Period from '@/utils/period';
import type { Event } from './events';
import type { SchemaInfer } from '@/utils/validation';
import type { RequestConfig } from '@/globals/requester';
import type { PaginatedData, SortableParams, PaginationParams } from './@types';
import type { Document } from './documents';
import type { Role } from './roles';

// ------------------------------------------------------
// -
// -    Schema / Enums
// -
// ------------------------------------------------------

//
// - Schemas secondaires
//

export const TechnicianEventSchema = z.strictObject({
    id: z.number(),
    event_id: z.number(),
    technician_id: z.number(),
    period: z.period(),
    role: z.lazy(() => RoleSchema).nullable(),
    event: z.lazy(() => EventSchema),
});

//
// - Schemas principaux
//

export const TechnicianSchema = z.strictObject({
    id: z.number(),
    user_id: z.number().nullable(),
    first_name: z.string(),
    last_name: z.string(),
    full_name: z.string(),
    nickname: z.string().nullable(),
    // TODO [zod@>3.22.4]: Remettre `email()`.
    email: z.string().nullable(),
    phone: z.string().nullable(),
    street: z.string().nullable(),
    postal_code: z.string().nullable(),
    locality: z.string().nullable(),
    country_id: z.number().nullable(),
    country: z.lazy(() => CountrySchema).nullable(),
    full_address: z.string().nullable(),
    roles: z.lazy(() => RoleSchema.array()),
    note: z.string().nullable(),
});

export const TechnicianDetailsSchema = TechnicianSchema.extend({
    user: z.lazy(() => UserSchema).nullable(),
});

export const TechnicianWithEventsSchema = TechnicianSchema.extend({
    events: TechnicianEventSchema.array(),
});

// ------------------------------------------------------
// -
// -    Types
// -
// ------------------------------------------------------

export type Technician = SchemaInfer<typeof TechnicianSchema>;

export type TechnicianDetails = SchemaInfer<typeof TechnicianDetailsSchema>;

export type TechnicianEvent = SchemaInfer<typeof TechnicianEventSchema>;
export type TechnicianWithEvents = SchemaInfer<typeof TechnicianWithEventsSchema>;

//
// - Edition
//

export type TechnicianEdit = {
    first_name: string,
    last_name: string,
    nickname: string | null,
    email: string | null,
    phone: string | null,
    street: string | null,
    postal_code: string | null,
    locality: string | null,
    country_id: number | null,
    user_id?: number,
    note: string | null,
    roles: Array<Role['id']>,
};

//
// - Récupération
//

export type Filters = Nullable<{
    search?: string | string[],
    availabilityPeriod?: Raw<Period>,
    role?: Role['id'],
}>;

type GetAllParams = (
    & Filters
    & SortableParams
    & PaginationParams
    & { deleted?: boolean }
);

type GetAllWhileEventParams = {
    role?: Role['id'],
};

type GetAllWithAssignmentsParams = {
    period: Period,
    paginated: false,
};
type GetAllWithAssignmentsPaginatedParams = (
    & Omit<GetAllWithAssignmentsParams, 'paginated'>
    & { paginated?: true }
    & PaginationParams
);

// ------------------------------------------------------
// -
// -    Fonctions
// -
// ------------------------------------------------------

const all = async ({ availabilityPeriod, ...otherParams }: GetAllParams = {}): Promise<PaginatedData<Technician[]>> => {
    const params: Record<string, unknown> = Object.assign(otherParams, {
        ...availabilityPeriod?.toQueryParams('availabilityPeriod'),
    });
    const response = await requester.get('/technicians', { params });
    return withPaginationEnvelope(TechnicianSchema).parse(response);
};

const allWhileEvent = async (eventId: Event['id'], params?: GetAllWhileEventParams): Promise<TechnicianWithEvents[]> => {
    const response = await requester.get(`/technicians/while-event/${eventId}`, { params });
    return TechnicianWithEventsSchema.array().parse(response);
};

async function allWithAssignments(params: GetAllWithAssignmentsParams): Promise<TechnicianWithEvents[]>;
async function allWithAssignments(params: GetAllWithAssignmentsPaginatedParams): Promise<PaginatedData<TechnicianWithEvents[]>>;
async function allWithAssignments({ period, ...params }: GetAllWithAssignmentsParams | GetAllWithAssignmentsPaginatedParams): Promise<unknown> {
    const normalizedParams = { paginated: true, ...params, ...period?.toQueryParams('period') };
    const response = await requester.get('/technicians/with-assignments', { params: normalizedParams });

    return normalizedParams.paginated
        ? withPaginationEnvelope(TechnicianWithEventsSchema).parse(response)
        : TechnicianWithEventsSchema.array().parse(response);
}

const one = async (id: Technician['id']): Promise<TechnicianDetails> => {
    const response = await requester.get(`/technicians/${id}`);
    return TechnicianDetailsSchema.parse(response);
};

const create = async (data: TechnicianEdit): Promise<TechnicianDetails> => {
    const response = await requester.post('/technicians', data);
    return TechnicianDetailsSchema.parse(response);
};

const update = async (id: Technician['id'], data: TechnicianEdit): Promise<TechnicianDetails> => {
    const response = await requester.put(`/technicians/${id}`, data);
    return TechnicianDetailsSchema.parse(response);
};

const restore = async (id: Technician['id']): Promise<TechnicianDetails> => {
    const response = await requester.put(`/technicians/restore/${id}`);
    return TechnicianDetailsSchema.parse(response);
};

const remove = async (id: Technician['id']): Promise<void> => {
    await requester.delete(`/technicians/${id}`);
};

const assignments = async (id: Technician['id']): Promise<TechnicianEvent[]> => {
    const response = await requester.get(`/technicians/${id}/events`);
    return TechnicianEventSchema.array().parse(response);
};

const documents = async (id: Technician['id']): Promise<Document[]> => {
    const response = await requester.get(`/technicians/${id}/documents`);
    return DocumentSchema.array().parse(response);
};

const attachDocument = async (id: Technician['id'], file: File, options: RequestConfig = {}): Promise<Document> => {
    const formData = new FormData(); formData.append('file', file);
    const response = await requester.post(`/technicians/${id}/documents`, formData, options);
    return DocumentSchema.parse(response);
};

export default {
    all,
    allWhileEvent,
    allWithAssignments,
    one,
    create,
    update,
    remove,
    restore,
    assignments,
    documents,
    attachDocument,
};
