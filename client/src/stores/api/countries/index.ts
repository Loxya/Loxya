import requester from '@/globals/requester';
import { CountrySchema } from './schemas';

import type { SchemaInfer } from '@/utils/validation';

// ------------------------------------------------------
// -
// -    Schema / Enums
// -
// ------------------------------------------------------

export { CountrySchema };

// ------------------------------------------------------
// -
// -    Types
// -
// ------------------------------------------------------

export type Country = SchemaInfer<typeof CountrySchema>;

// ------------------------------------------------------
// -
// -    Fonctions
// -
// ------------------------------------------------------

const all = async (): Promise<Country[]> => {
    const response = await requester.get('/countries');
    return CountrySchema.array().parse(response);
};

export default { all };
