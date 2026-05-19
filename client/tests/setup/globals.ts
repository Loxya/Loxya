import {
    BillingMode,
    ReturnPolicy,
    WeightUnit,
} from '@/globals/config/@enums';

global.__SERVER_CONFIG__ = {
    baseUrl: 'http://loxya.test',
    isSslEnabled: false,
    version: '__DEV__',
    mainCountry: 'FR',
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
        isVatExempted: false,
        vatExemptionCode: null,
        vatExemptionReason: null,
        country: 'FR',
    },
    estimates: {
        validityDays: 15,
    },
    invoices: {
        paymentTermDays: 15,
    },
    defaultPaginationLimit: 100,
    maxConcurrentFetches: 2,
    billingMode: BillingMode.PARTIAL,
    returnPolicy: ReturnPolicy.AUTO,
    maxFileUploadSize: 25 * 1024 * 1024,
    maxFetchPeriod: 3 * 30,
    colorSwatches: null,
    allowedFileTypes: [
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
    allowedImageTypes: [
        'image/jpeg',
        'image/png',
        'image/webp',
    ],
    measurementUnits: {
        materials: {
            weight: WeightUnit.KILOGRAM,
        },
    },
};
