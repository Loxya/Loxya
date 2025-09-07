/* eslint-disable import/prefer-default-export */

import { z } from '@/utils/validation';

export const CountrySchema = z.strictObject({
    id: z.number(),
    name: z.string(),
    code: z.string(),
});
