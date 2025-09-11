import { z } from '@/utils/validation';
import requester from '@/globals/requester';
import { CategorySchema } from './categories';
import { CustomFieldType } from './@types';

import type { Category } from './categories';
import type { SchemaInfer } from '@/utils/validation';

// ------------------------------------------------------
// -
// -    Schema / Enums
// -
// ------------------------------------------------------

/** Entité concernée par la propriété. */
export enum PropertyEntity {
    /** Caractéristique spéciale liée au matériel. */
    MATERIAL = 'material',
}

const PropertyBaseSchema = z.strictObject({
    id: z.number(),
    name: z.string(),
    entities: z.array(z.nativeEnum(PropertyEntity)),
});

// NOTE: Pour le moment, pas moyen de faire ça mieux en gardant l'objet `strict`.
// @see https://github.com/colinhacks/zod/discussions/3011#discussioncomment-7718731
export const PropertySchema = z.discriminatedUnion('type', [
    PropertyBaseSchema.extend({
        type: z.literal(CustomFieldType.STRING),
        max_length: z.number().nullable(),
    }),
    PropertyBaseSchema.extend({
        type: z.enum([CustomFieldType.INTEGER, CustomFieldType.FLOAT]),
        unit: z.string().nullable(),
        is_totalisable: z.boolean().nullable().transform(
            (value: boolean | null) => value ?? false,
        ),
    }),
    PropertyBaseSchema.extend({
        type: z.literal(CustomFieldType.PERIOD),
        full_days: z.boolean().nullable(),
    }),
    PropertyBaseSchema.extend({
        type: z.literal(CustomFieldType.LIST),
        options: z.string().array(),
    }),
    PropertyBaseSchema.extend({
        type: z.enum([
            CustomFieldType.TEXT,
            CustomFieldType.BOOLEAN,
            CustomFieldType.DATE,
        ]),
    }),
]);

// NOTE: Pour le moment, pas moyen de faire ça mieux en gardant l'objet `strict`.
// @see https://github.com/colinhacks/zod/discussions/3011#discussioncomment-7718731
export const PropertyWithValueSchema = z.discriminatedUnion('type', [
    PropertyBaseSchema.extend({
        type: z.literal(CustomFieldType.STRING),
        max_length: z.number().nullable(),
        value: z.string().nullable(),
    }),
    PropertyBaseSchema.extend({
        type: z.literal(CustomFieldType.TEXT),
        value: z.string().nullable(),
    }),
    PropertyBaseSchema.extend({
        type: z.enum([CustomFieldType.INTEGER, CustomFieldType.FLOAT]),
        unit: z.string().nullable(),
        is_totalisable: z.boolean().nullable().transform(
            (value: boolean | null) => value ?? false,
        ),
        value: z.number().nullable(),
    }),
    PropertyBaseSchema.extend({
        type: z.literal(CustomFieldType.PERIOD),
        full_days: z.boolean().nullable(),
        value: z.period().nullable(),
    }),
    PropertyBaseSchema.extend({
        type: z.literal(CustomFieldType.LIST),
        options: z.string().array(),
        value: z.string().nullable(),
    }),
    PropertyBaseSchema.extend({
        type: z.literal(CustomFieldType.BOOLEAN),
        value: z.boolean().nullable(),
    }),
    PropertyBaseSchema.extend({
        type: z.literal(CustomFieldType.DATE),
        value: z.day().nullable(),
    }),
]);

// NOTE: Pour le moment, pas moyen de faire ça mieux en gardant l'objet `strict`.
// @see https://github.com/colinhacks/zod/discussions/3011#discussioncomment-7718731
export const PropertyDetailsSchema = (() => {
    const baseSchema = PropertyBaseSchema.extend({
        categories: z.lazy(() => CategorySchema.array()),
    });

    return z.discriminatedUnion('type', [
        baseSchema.extend({
            type: z.literal(CustomFieldType.STRING),
            max_length: z.number().nullable(),
        }),
        baseSchema.extend({
            type: z.enum([CustomFieldType.INTEGER, CustomFieldType.FLOAT]),
            unit: z.string().nullable(),
            is_totalisable: z.boolean().nullable().transform(
                (value: boolean | null) => value ?? false,
            ),
        }),
        baseSchema.extend({
            type: z.literal(CustomFieldType.PERIOD),
            full_days: z.boolean().nullable(),
        }),
        baseSchema.extend({
            type: z.literal(CustomFieldType.LIST),
            options: z.string().array(),
        }),
        baseSchema.extend({
            type: z.enum([
                CustomFieldType.TEXT,
                CustomFieldType.BOOLEAN,
                CustomFieldType.DATE,
            ]),
        }),
    ]);
})();

// ------------------------------------------------------
// -
// -    Types
// -
// ------------------------------------------------------

export type Property = SchemaInfer<typeof PropertySchema>;

export type PropertyWithValue = SchemaInfer<typeof PropertyWithValueSchema>;

export type PropertyDetails = SchemaInfer<typeof PropertyDetailsSchema>;

//
// - Edition
//

export type PropertyCreate = {
    name: string | null,
    entities: PropertyEntity[],
    type: CustomFieldType | null,
    unit?: string | null,
    max_length?: string | number | null,
    options?: string[] | null,
    full_days?: boolean | null,
    is_totalisable?: boolean,
    categories: Array<Category['id']>,
};

export type PropertyEdit = Omit<PropertyCreate, 'type'>;

// ------------------------------------------------------
// -
// -    Fonctions
// -
// ------------------------------------------------------

const all = async (categoryId?: Category['id'] | 'none', entity?: PropertyEntity): Promise<PropertyDetails[]> => {
    const params = {
        ...(categoryId !== undefined ? { category: categoryId } : {}),
        ...(entity !== undefined) ? { entity } : {},
    };
    const response = await requester.get('/properties', { params });
    return PropertyDetailsSchema.array().parse(response);
};

const one = async (id: Property['id']): Promise<PropertyDetails> => {
    const response = await requester.get(`/properties/${id}`);
    return PropertyDetailsSchema.parse(response);
};

const create = async (data: PropertyCreate): Promise<PropertyDetails> => {
    const response = await requester.post('/properties', data);
    return PropertyDetailsSchema.parse(response);
};

const update = async (id: Property['id'], data: PropertyEdit): Promise<PropertyDetails> => {
    const response = await requester.put(`/properties/${id}`, data);
    return PropertyDetailsSchema.parse(response);
};

const remove = async (id: Property['id']): Promise<void> => {
    await requester.delete(`/properties/${id}`);
};

export default { all, one, create, update, remove };
