import { z } from '@/utils/validation';

import type { ZodTypeAny } from 'zod';

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const withPaginationEnvelope = <T extends ZodTypeAny>(dataSchema: T) => (
    z.object({
        data: dataSchema.array(),
        pagination: z.object({
            perPage: z.number().positive(),
            currentPage: z.number().nonnegative(),
            total: z.object({
                items: z.number().nonnegative(),
                pages: z.number().nonnegative(),
            }),
        }),
    })
);

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const withCountedEnvelope = <T extends ZodTypeAny>(dataSchema: T) => (
    z.object({
        data: dataSchema.array(),
        count: z.number().nonnegative(),
    })
);
