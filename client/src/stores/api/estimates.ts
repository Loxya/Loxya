import { z } from '@/utils/validation';
import requester from '@/globals/requester';
import TaxRegime from '@/utils/invoicing/tax-regime';
import BillingFormat from './@enums/billing-format';
import VatExemptionCode from '@/utils/invoicing/vat-exemption-code';
import { withPaginationEnvelope } from './@schema';
import { BeneficiarySchema, BeneficiarySummarySchema } from './beneficiaries';
import { InvoiceDetailsSchema, InvoiceExcerptSchema } from './invoices';

import type { Raw } from 'vue';
import type { Tax } from './taxes';
import type Day from '@/utils/day';
import type Decimal from 'decimal.js';
import type { ZodRawShape } from 'zod';
import type { SchemaInfer } from '@/utils/validation';
import type { InvoiceDetails } from './invoices';
import type {
    PaginatedData,
    SortableParams,
    PaginationParams,
} from './@types';

// ------------------------------------------------------
// -
// -    Schema / Enums
// -
// ------------------------------------------------------

/** Statuts des devis. */
export enum EstimateStatus {
    /** Le devis est un brouillon, en attente de finalisation. */
    DRAFT = 'draft',

    /**
     * Le devis brouillon est obsolète.
     * (sa date d'échéance fixe est dépassée)
     */
    OBSOLETE = 'obsolete',

    /** Le devis n'a pas encore été envoyé. */
    PENDING = 'pending',

    /** Le devis a été envoyé. */
    SENT = 'sent',

    /** Le devis a été accepté. */
    ACCEPTED = 'accepted',

    /** Le devis a été partiellement facturé (au moins un acompte). */
    PARTIALLY_INVOICED = 'partially-invoiced',

    /** Le devis a été entièrement facturé. */
    INVOICED = 'invoiced',

    /** Le devis a été refusé. */
    REJECTED = 'rejected',

    /** Le devis est expiré. */
    EXPIRED = 'expired',
}

const LegacyEstimateTaxSchema = z.strictObject({
    name: z.string(),
    is_rate: z.boolean(),
    value: z.decimal(),
    total: z.decimal(),
});

const EstimateTaxSchema = z.union([
    // - Régime standard.
    z.strictObject({
        type: z.literal(TaxRegime.STANDARD),
        name: z.string().optional(),
        value: z.decimal(),
        base: z.decimal(),
        total: z.decimal(),
    }),
    // - Exemption / régime non-standard.
    z.strictObject({
        type: z.union([
            z.literal(TaxRegime.EXEMPTED),
            z.literal(TaxRegime.EXPORT),
            z.literal(TaxRegime.OUT_OF_SCOPE),
            z.literal(TaxRegime.REVERSE_CHARGE),
            z.literal(TaxRegime.REVERSE_CHARGE_SUPPLY),
        ]),
        reason: z.string().array(),
        base: z.decimal(),
    }),
]);

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const createEstimateSchemaFactory = <T extends ZodRawShape>(augmentation: T) => {
    const schema = z
        .strictObject({
            id: z.number(),
            status: z.nativeEnum(EstimateStatus),
            date: z.datetime().optional(),
            url: z.string(),
            has_final_invoice: z.boolean(),
            total_without_taxes: z.decimal(),
            global_tax_regime: z.nativeEnum(TaxRegime).nullable(),
            global_tax_exemption_code: z.nativeEnum(VatExemptionCode).nullable(),
            global_tax_exemption_reason: z.string().nullable(),
            total_with_taxes: z.decimal(),
            currency: z.currency(),
            created_at: z.datetime(),
        })
        .extend<T>(augmentation);

    return z.union([
        schema.extend({
            format: z.union([
                z.literal(BillingFormat.V1),
                z.literal(BillingFormat.V2),
            ]),
            total_taxes: z.lazy(() => LegacyEstimateTaxSchema.array()),
        }),
        schema.extend({
            format: z.literal(BillingFormat.V3),
            number: z.string().optional(),
            total_taxes: z.lazy(() => EstimateTaxSchema.array()).nullable(),
        }),
    ]);
};

export const EstimateExcerptSchema = createEstimateSchemaFactory({});

export const EstimateSchema = createEstimateSchemaFactory({
    due_date: z.day().nullable(),
    due_delay: z.number().int().nullable(),
    buyer: z.lazy(() => BeneficiarySummarySchema),
    lang: z.string(),
    related_invoices: z.lazy(() => InvoiceExcerptSchema.array()),
});

export const EstimateDetailsSchema = createEstimateSchemaFactory({
    due_date: z.day().nullable(),
    due_delay: z.number().int().nullable(),
    buyer: z.lazy(() => BeneficiarySchema),
    lang: z.string(),
    related_invoices: z.lazy(() => InvoiceExcerptSchema.array()),
});

// ------------------------------------------------------
// -
// -    Types
// -
// ------------------------------------------------------

export type EstimateExcerpt = SchemaInfer<typeof EstimateExcerptSchema>;

export type Estimate = SchemaInfer<typeof EstimateSchema>;

export type EstimateDetails = SchemaInfer<typeof EstimateDetailsSchema>;

export type EstimateTax = SchemaInfer<typeof EstimateTaxSchema>;

//
// - Création de facture
//

export type EstimateInvoiceCreate = {
    amount?: Raw<Decimal>,
    lang?: string,
    due_date?: Raw<Day> | null,
    order_number?: string | null,
    special_mentions?: string | null,
};

//
// - Récupération
//

export type Filters = Nullable<{
    search?: string | string[],
    date?: Day | { operator: string, value: Day },
    dueDate?: Day | { operator: string, value: Day },
    status?: EstimateStatus | EstimateStatus[],
    amount?: number | { operator: string, value: number },
}>;

type GetAllParams = (
    & Filters
    & SortableParams
    & PaginationParams
);

//
// - Création
//

export type EstimateCreateLine = {
    uuid: string,
    is_service: boolean,
    description: string | null,
    quantity: number,
    unit_price: Raw<Decimal> | null,
    discount_rate: Raw<Decimal>,
    tax_regime: TaxRegime | null,
    tax_exemption_code: VatExemptionCode | null,
    tax_id: Tax['id'] | null,
};

export type EstimateCreate = {
    buyer_id: number,
    lang?: string,
    due_date?: Raw<Day> | null,
    lines: EstimateCreateLine[],
    global_discount_rate: Raw<Decimal>,
    special_mentions?: string | null,
};

// ------------------------------------------------------
// -
// -    Fonctions
// -
// ------------------------------------------------------

const all = async (params: GetAllParams = {}): Promise<PaginatedData<Estimate[]>> => {
    const response = await requester.get('/estimates', { params });
    return withPaginationEnvelope(EstimateSchema).parse(response);
};

const one = async (id: Estimate['id']): Promise<EstimateDetails> => {
    const response = await requester.get(`/estimates/${id}`);
    return EstimateDetailsSchema.parse(response);
};

const create = async (data: EstimateCreate): Promise<EstimateDetails> => {
    const response = await requester.post('/estimates', data);
    return EstimateDetailsSchema.parse(response);
};

const finalize = async (id: Estimate['id']): Promise<EstimateDetails> => {
    const response = await requester.put(`/estimates/${id}/finalize`);
    return EstimateDetailsSchema.parse(response);
};

const updateStatus = async (id: Estimate['id'], status: EstimateStatus): Promise<EstimateDetails> => {
    const response = await requester.put(`/estimates/${id}/status`, { status });
    return EstimateDetailsSchema.parse(response);
};

const createInvoice = async (id: Estimate['id'], data: EstimateInvoiceCreate = {}): Promise<InvoiceDetails> => {
    const response = await requester.post(`/estimates/${id}/invoices`, data);
    return InvoiceDetailsSchema.parse(response);
};

const remove = async (id: Estimate['id']): Promise<void> => {
    await requester.delete(`/estimates/${id}`);
};

export default {
    all,
    one,
    updateStatus,
    finalize,
    create,
    createInvoice,
    remove,
};
