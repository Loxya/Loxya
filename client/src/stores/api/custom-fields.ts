import { z } from '@/utils/validation';
import { CustomFieldType } from './@types';

import type { SchemaInfer } from '@/utils/validation';

// ------------------------------------------------------
// -
// -    Schema / Enums
// -
// ------------------------------------------------------

export const CustomFieldWithValueSchema = (() => {
    const baseSchema = z.strictObject({
        name: z.string(),
    });

    return z.discriminatedUnion('type', [
        baseSchema.extend({
            type: z.literal(CustomFieldType.STRING),
            max_length: z.number().nullable(),
            value: z.string().nullable(),
        }),
        baseSchema.extend({
            type: z.literal(CustomFieldType.TEXT),
            value: z.string().nullable(),
        }),
        baseSchema.extend({
            type: z.enum([CustomFieldType.INTEGER, CustomFieldType.FLOAT]),
            unit: z.string().nullable(),
            value: z.number().nullable(),
        }),
        baseSchema.extend({
            type: z.literal(CustomFieldType.PERIOD),
            full_days: z.boolean().nullable(),
            value: z.period().nullable(),
        }),
        baseSchema.extend({
            type: z.literal(CustomFieldType.LIST),
            options: z.string().array(),
            value: z.string().nullable(),
        }),
        baseSchema.extend({
            type: z.literal(CustomFieldType.BOOLEAN),
            value: z.boolean().nullable(),
        }),
        baseSchema.extend({
            type: z.literal(CustomFieldType.DATE),
            value: z.day().nullable(),
        }),
    ]);
})();

// ------------------------------------------------------
// -
// -    Types
// -
// ------------------------------------------------------

export type CustomFieldWithValue = SchemaInfer<typeof CustomFieldWithValueSchema>;
