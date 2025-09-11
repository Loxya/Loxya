import countries from '@fixtures/countries';
import BillingMode from '@/globals/config/@enums/billing-mode';
import ReturnPolicy from '@/globals/config/@enums/return-policy';

global.__SERVER_CONFIG__ = {
    baseUrl: 'http://loxya.test',
    isSslEnabled: false,
    version: '__DEV__',
    api: {
        url: `http://loxya.test/api`,
        headers: { Accept: 'application/json' },
    },
    defaultLang: 'fr',
    currency: 'EUR',
    auth: {
        cookie: 'Authorization',
        timeout: 12,
    },
    features: {
        technicians: true,
    },
    organization: {
        name: 'Testing corp.',
        country: countries.default(1),
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
