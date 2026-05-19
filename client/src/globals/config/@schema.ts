import { z } from '@/utils/validation';
import VatExemptionCode from '@/utils/invoicing/vat-exemption-code';
import {
    BillingMode,
    ReturnPolicy,
    WeightUnit,
} from './@enums';

export default z.strictObject({
    baseUrl: z.string(),
    isSslEnabled: z.boolean(),
    version: z.string(),
    mainCountry: z.country(),
    returnPolicy: z.nativeEnum(ReturnPolicy),
    billingMode: z.nativeEnum(BillingMode),
    defaultLang: z.string(),
    auth: z.strictObject({
        cookie: z.string(),
        timeout: z.number().nullable(),
    }),
    features: z.strictObject({
        technicians: z.boolean(),
    }),
    estimates: z.strictObject({
        validityDays: z.number().positive(),
    }),
    invoices: z.strictObject({
        paymentTermDays: z.number().nonnegative(),
    }),
    currency: z.currency(),
    organization: z.strictObject({
        name: z.string().nullable(),
        isVatExempted: z.boolean(),
        vatExemptionCode: z.nativeEnum(VatExemptionCode).nullable(),
        vatExemptionReason: z.string().nullable(),
        country: z.country(),
    }),
    defaultPaginationLimit: z.number(),
    maxConcurrentFetches: z.number(),
    maxFileUploadSize: z.number(),
    maxFetchPeriod: z.number(),
    allowedFileTypes: z.string().array(),
    allowedImageTypes: z.string().array(),
    measurementUnits: z.strictObject({
        materials: z.strictObject({
            weight: z.nativeEnum(WeightUnit),
        }),
    }),
    colorSwatches: z.string().array().nullable(),
});
