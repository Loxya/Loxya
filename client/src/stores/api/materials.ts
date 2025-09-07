import requester from '@/globals/requester';
import { z } from '@/utils/validation';
import { omit } from 'lodash';
import { TagSchema } from './tags';
import { DocumentSchema } from './documents';
import { PropertyWithValueSchema } from './properties';
import { BookingSummarySchema, createBookingSummarySchema } from './bookings';
import { withPaginationEnvelope } from './@schema';

import type { Raw } from 'vue';
import type Period from '@/utils/period';
import type { ProgressCallback, RequestConfig } from '@/globals/requester';
import type { PaginatedData, SortableParams, PaginationParams } from './@types';
import type { Park } from './parks';
import type { Category } from './categories';
import type { Event } from './events';
import type { SubCategory } from './subcategories';
import type { Property, PropertyWithValue } from './properties';
import type { Tag } from './tags';
import type { Document } from './documents';
import type { SchemaInfer } from '@/utils/validation';
import type { ZodRawShape } from 'zod';
import type { Simplify } from 'type-fest';
import type { DegressiveRate } from './degressive-rates';
import type { Tax } from './taxes';

// ------------------------------------------------------
// -
// -    Schema / Enums
// -
// ------------------------------------------------------

/** Représente le matériel non catégorisés. */
export const UNCATEGORIZED = 'uncategorized';

//
// - Schemas secondaires
//

const MaterialBaseSchema = z.strictObject({
    id: z.number(),
    name: z.string(),
    reference: z.string(),
    park_id: z.number(),
    picture: z.string().nullable(),
    description: z.string().nullable(),
    category_id: z.number().nullable(),
    sub_category_id: z.number().nullable(),
    rental_price: z.decimal().nullable().optional(),
    degressive_rate_id: z.number().nullable().optional(),
    tax_id: z.number().nullable().optional(),
    replacement_price: z.decimal().nullable(),
    stock_quantity: z.number().nullable().transform(
        (value: number | null): number => value ?? 0,
    ),
    out_of_order_quantity: z.number().nullable().transform(
        (value: number | null): number => value ?? 0,
    ),
    is_hidden_on_bill: z.boolean().optional(),
    is_discountable: z.boolean().optional(),
    properties: z.lazy(() => PropertyWithValueSchema.array()),
    tags: z.lazy(() => TagSchema.array()),
    note: z.string().nullable(),
    created_at: z.datetime(),
    updated_at: z.datetime().nullable(),
});

const createMaterialSchemaFactory = <T extends ZodRawShape>(augmentation: T) => (
    <InnerT extends ZodRawShape>(innerAugmentation: InnerT) => (
        MaterialBaseSchema
            .extend<T>(augmentation)
            .extend<InnerT>(innerAugmentation)
    )
);

export const createMaterialSchema = createMaterialSchemaFactory({});

export const createMaterialDetailsSchema = createMaterialSchemaFactory(
    {
        available_quantity: z.number(),
        departure_inventory_todo: z.lazy(() => BookingSummarySchema).nullable(),
        return_inventory_todo: z.lazy(() => BookingSummarySchema).nullable(),
    },
);

export const createMaterialWithAvailabilitySchema = createMaterialSchemaFactory(
    {
        available_quantity: z.number(),
        is_deleted: z.boolean(),
    },
);

export const createMaterialWithContextExcerptSchema = createMaterialSchemaFactory(
    {
        degressive_rate: z.decimal().nullable().optional(),
        rental_price_period: z.decimal().nullable().optional(),
        is_deleted: z.boolean(),
    },
);

export const createMaterialWithContextSchema = createMaterialSchemaFactory(
    {
        degressive_rate: z.decimal().nullable().optional(),
        rental_price_period: z.decimal().nullable().optional(),
        available_quantity: z.number(),
        is_deleted: z.boolean(),
    },
);

export const MaterialBookingSummarySchema = z.lazy(() => (
    createBookingSummarySchema({
        pivot: z.strictObject({
            quantity: z.number().positive(),
        }),
    })
));

//
// - Schemas principaux
//

export const MaterialSchema = createMaterialSchema({});

export const MaterialDetailsSchema = createMaterialDetailsSchema({});

export const MaterialWithAvailabilitySchema = createMaterialWithAvailabilitySchema({});
export const MaterialWithContextExcerptSchema = createMaterialWithContextExcerptSchema({});
export const MaterialWithContextSchema = createMaterialWithContextSchema({});

export const MaterialPublicSchema = (() => {
    const baseSchema = MaterialBaseSchema.extend({
        degressive_rate: z.decimal(),
        rental_price_period: z.decimal().nullable(),
        available_quantity: z.number(),
    });

    return baseSchema.pick({
        id: true,
        name: true,
        description: true,
        picture: true,
        degressive_rate: true,
        available_quantity: true,
        rental_price: true,
        rental_price_period: true,
    });
})();

// ------------------------------------------------------
// -
// -    Types
// -
// ------------------------------------------------------

export type Material = SchemaInfer<typeof MaterialSchema>;

export type MaterialDetails = SchemaInfer<typeof MaterialDetailsSchema>;

export type MaterialWithAvailability = SchemaInfer<typeof MaterialWithAvailabilitySchema>;

export type MaterialWithContext = SchemaInfer<typeof MaterialWithContextSchema>;

export type MaterialPublic = SchemaInfer<typeof MaterialPublicSchema>;

//
// - Secondary types.
//

export type MaterialBookingSummary = SchemaInfer<typeof MaterialBookingSummarySchema>;

//
// - Edition
//

type MaterialEditProperty = {
    id: Property['id'],
    value: PropertyWithValue['value'],
};

export type MaterialEdit = {
    name: string | null,
    picture?: Raw<File> | null,
    reference: string | null,
    description: string | null,
    park_id: Park['id'] | null,
    category_id: Category['id'] | null,
    sub_category_id: SubCategory['id'] | null,
    rental_price: string | null,
    degressive_rate_id: DegressiveRate['id'] | null,
    tax_id: Tax['id'] | null,
    stock_quantity: string | number | null,
    out_of_order_quantity: string | number | null,
    replacement_price: string | null,
    is_hidden_on_bill: boolean,
    is_discountable: boolean,
    note: string | null,
    tags?: Array<Tag['id']>,
    properties?: MaterialEditProperty[],
};

//
// - Récupération
//

export type BaseFilters = Nullable<{
    search?: string | string[],
    category?: Category['id'],
    subCategory?: SubCategory['id'],
}>;

export type Filters = Simplify<(
    & Omit<BaseFilters, 'category'>
    & Nullable<{
        quantitiesPeriod?: Raw<Period>,
        category?: Category['id'] | typeof UNCATEGORIZED,
        park?: Park['id'],
        tags?: Array<Tag['id']>,
    }>
)>;

type GetAllParamsBase = Filters & SortableParams & { withDeleted?: boolean, onlyDeleted?: boolean };
type GetAllParamsPaginated = GetAllParamsBase & PaginationParams & { paginated?: true };
type GetAllParamsRaw = GetAllParamsBase & { paginated: false };

export type GetBookingsParams = (
    & PaginationParams
    & { period?: Period }
    & Pick<SortableParams, 'ascending'>
);

// ------------------------------------------------------
// -
// -    Fonctions
// -
// ------------------------------------------------------

async function all(params: GetAllParamsRaw): Promise<MaterialWithAvailability[]>;
async function all(params?: GetAllParamsPaginated): Promise<PaginatedData<MaterialWithAvailability[]>>;
async function all({ quantitiesPeriod, ...otherParams }: GetAllParamsPaginated | GetAllParamsRaw = {}): Promise<unknown> {
    const normalizedParams = {
        paginated: true,
        ...otherParams,
        ...quantitiesPeriod?.toQueryParams('quantitiesPeriod'),
    };

    const response = await requester.get('/materials', {
        params: normalizedParams,
    });

    const schema = normalizedParams.paginated
        ? withPaginationEnvelope(MaterialWithAvailabilitySchema)
        : MaterialWithAvailabilitySchema.array();

    return schema.parse(response);
}

const allWhileEvent = async (eventId: Event['id']): Promise<MaterialWithContext[]> => {
    const response = await requester.get(`/materials/while-event/${eventId}`);
    return MaterialWithContextSchema.array().parse(response);
};

const one = async (id: Material['id']): Promise<MaterialDetails> => {
    const response = await requester.get(`/materials/${id}`);
    return MaterialDetailsSchema.parse(response);
};

const create = async (data: MaterialEdit, onProgress?: ProgressCallback): Promise<MaterialDetails> => {
    const response = await requester.post('/materials', data, {
        ...(onProgress ? { onProgress } : {}),
    });
    return MaterialDetailsSchema.parse(response);
};

const update = async (id: Material['id'], data: Partial<MaterialEdit>, onProgress?: ProgressCallback): Promise<MaterialDetails> => {
    const response = await requester.put(`/materials/${id}`, data, {
        ...(onProgress ? { onProgress } : {}),
    });
    return MaterialDetailsSchema.parse(response);
};

const restore = async (id: Material['id']): Promise<MaterialDetails> => {
    const response = await requester.put(`/materials/${id}/restore`);
    return MaterialDetailsSchema.parse(response);
};

const remove = async (id: Material['id']): Promise<void> => {
    await requester.delete(`/materials/${id}`);
};

const bookings = async (
    id: Material['id'],
    params: GetBookingsParams = {},
    signal?: AbortSignal,
): Promise<PaginatedData<MaterialBookingSummary[]>> => {
    const normalizedParams = {
        ...omit(params, ['period']),
        ...params?.period?.toQueryParams('period'),
    };
    const config: RequestConfig = {
        params: normalizedParams,
        ...(signal !== undefined ? { signal } : {}),
    };
    const response = await requester.get(`/materials/${id}/bookings`, config);
    return withPaginationEnvelope(MaterialBookingSummarySchema).parse(response);
};

const documents = async (id: Material['id']): Promise<Document[]> => {
    const response = await requester.get(`/materials/${id}/documents`);
    return DocumentSchema.array().parse(response);
};

const attachDocument = async (id: Material['id'], file: File, options: RequestConfig = {}): Promise<Document> => {
    const formData = new FormData(); formData.append('file', file);
    const response = await requester.post(`/materials/${id}/documents`, formData, options);
    return DocumentSchema.parse(response);
};

export default {
    all,
    allWhileEvent,
    one,
    create,
    update,
    restore,
    remove,
    bookings,
    documents,
    attachDocument,
};
