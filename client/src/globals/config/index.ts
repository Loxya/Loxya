import deepFreeze from 'deep-freeze-strict';
import {
    BillingMode,
    ReturnPolicy,
    WeightUnit,
} from './@enums';
import ConfigSchema from './@schema';

import type { RawGlobalConfig, GlobalConfig } from './@types';

//
// - Types.
//

export type {
    RawGlobalConfig,
    GlobalConfig,
};

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
    mainCountry: 'FR',
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
    maxFileUploadSize: 25 * 1024 * 1024, // = 25 Mo.
    maxFetchPeriod: 3 * 30, // = 3 mois.
    measurementUnits: {
        materials: {
            weight: WeightUnit.KILOGRAM,
        },
    },
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
};

//
// - Final config.
//

const globalConfig = ConfigSchema.parse(window.__SERVER_CONFIG__ ?? defaultConfig);

export default deepFreeze(globalConfig);
