import { z } from '@/utils/validation';
import deepFreeze from 'deep-freeze-strict';
import BillingMode from './@enums/billing-mode';
import ReturnPolicy from './@enums/return-policy';
import { CountrySchema } from '@/stores/api/countries/schemas';

import type { SchemaInput, SchemaInfer } from '@/utils/validation';

const GlobalConfigSchema = z.strictObject({
    baseUrl: z.string(),
    isSslEnabled: z.boolean(),
    version: z.string(),
    returnPolicy: z.nativeEnum(ReturnPolicy),
    billingMode: z.nativeEnum(BillingMode),
    defaultLang: z.string(),
    api: z.strictObject({
        url: z.string(),
        headers: z.record(z.string(), z.string()),
    }),
    auth: z.strictObject({
        cookie: z.string(),
        timeout: z.number().nullable(),
    }),
    features: z.strictObject({
        technicians: z.boolean(),
    }),
    currency: z.currency(),
    organization: z.strictObject({
        name: z.string().nullable(),
        country: z.lazy(() => CountrySchema).nullable(),
    }),
    defaultPaginationLimit: z.number(),
    maxConcurrentFetches: z.number(),
    maxFileUploadSize: z.number(),
    maxFetchPeriod: z.number(),
    authorizedFileTypes: z.string().array(),
    authorizedImageTypes: z.string().array(),
    colorSwatches: z.string().array().nullable(),
});

//
// - Types.
//

export type RawGlobalConfig = SchemaInput<typeof GlobalConfigSchema>;
export type GlobalConfig = SchemaInfer<typeof GlobalConfigSchema>;

//
// - Constants
//

export {
    BillingMode,
    ReturnPolicy,
};

//
// - Default config.
//

let baseUrl = 'http://loxya.test';
if (window.__SERVER_CONFIG__?.baseUrl !== undefined) {
    baseUrl = window.__SERVER_CONFIG__.baseUrl;
}

let isSslEnabled: boolean;
if (window.__SERVER_CONFIG__?.isSslEnabled !== undefined) {
    isSslEnabled = window.__SERVER_CONFIG__.isSslEnabled;
} else {
    try {
        isSslEnabled = (
            baseUrl !== '' &&
            (new URL(baseUrl)).protocol === 'https:'
        );
    } catch {
        isSslEnabled = false;
    }
}

const defaultConfig: RawGlobalConfig = {
    baseUrl,
    isSslEnabled,
    version: '__DEV__',
    api: {
        url: `${baseUrl}/api`,
        headers: { Accept: 'application/json' },
    },
    defaultLang: 'fr',
    currency: 'EUR',
    auth: {
        cookie: 'Authorization',
        timeout: 12, // - En heures (ou `null` pour un cookie de session).
    },
    features: {
        technicians: true,
    },
    organization: {
        name: null,
        country: null,
    },
    defaultPaginationLimit: 100,
    maxConcurrentFetches: 2,
    billingMode: BillingMode.PARTIAL,
    returnPolicy: ReturnPolicy.AUTO,
    maxFileUploadSize: 25 * 1024 * 1024,
    maxFetchPeriod: 3 * 30,
    colorSwatches: null,
    authorizedFileTypes: [
        'application/pdf',
        'application/zip',
        'application/x-rar-compressed',
        'application/gzip',
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/svg+xml',
        'text/plain',
        'text/csv',
        'text/xml',
        'application/vnd.oasis.opendocument.spreadsheet',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.oasis.opendocument.text',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
    authorizedImageTypes: [
        'image/jpeg',
        'image/png',
        'image/webp',
    ],
};

//
// - Final config.
//

const globalConfig = GlobalConfigSchema.parse(window.__SERVER_CONFIG__ ?? defaultConfig);

export default deepFreeze(globalConfig);
