import { z } from '@/utils/validation';
import requester from '@/globals/requester';
import { withPaginationEnvelope } from './@schema';
import { BeneficiarySchema, BeneficiarySummarySchema } from './beneficiaries';
import { EstimateExcerptSchema } from './estimates';
import BillingFormat from './@enums/billing-format';
import TaxRegime from '@/utils/invoicing/tax-regime';
import PaymentMethod from '@/utils/invoicing/payment-method';
import VatExemptionCode from '@/utils/invoicing/vat-exemption-code';

import type { Raw } from 'vue';
import type { Tax } from './taxes';
import type Day from '@/utils/day';
import type Decimal from 'decimal.js';
import type { ZodRawShape } from 'zod';
import type { SchemaInfer } from '@/utils/validation';
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

/** Statuts des factures. */
export enum InvoiceStatus {
    /** La facture est un brouillon, en attente de finalisation. */
    DRAFT = 'draft',

    /**
     * La facture brouillon est obsolète.
     * (sa date d'échéance fixe est dépassée)
     */
    OBSOLETE = 'obsolete',

    /** La facture n'a pas encore été envoyée. */
    PENDING = 'pending',

    /** La facture a été envoyée. */
    SENT = 'sent',

    /** Le paiement de la facture est en retard. */
    OVERDUE = 'overdue',

    /** La facture a été partiellement payée. */
    PARTIALLY_PAID = 'partially-paid',

    /** La facture a été payée. */
    PAID = 'paid',

    /** La facture a été annulée par un avoir. */
    CANCELLED = 'cancelled',
}

//
// - Schemas secondaires
//

const LegacyInvoiceTaxSchema = z.strictObject({
    name: z.string(),
    is_rate: z.boolean(),
    value: z.decimal(),
    total: z.decimal(),
});

const InvoiceTaxSchema = z.union([
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

const InvoicePaymentTaxSchema = z.strictObject({
    rate: z.decimal(),
    amount: z.decimal(),
});

const InvoicePaymentSchema = z.strictObject({
    id: z.number(),
    date: z.datetime(),
    method: z.nativeEnum(PaymentMethod).nullable(),
    amount: z.decimal(),
    taxes_breakdown: z.lazy(() => InvoicePaymentTaxSchema.array()).nullable(),
    reference: z.string().nullable(),
});

//
// - Schemas principaux
//

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const createInvoiceSchemaFactory = <T extends ZodRawShape>(augmentation: T) => {
    const schema = z
        .strictObject({
            id: z.number(),
            number: z.string().optional(),
            status: z.nativeEnum(InvoiceStatus),
            date: z.datetime().optional(),
            url: z.strictObject({
                pdf: z.string(),
                ubl: z.string().nullable(),
            }),
            total_without_taxes: z.decimal(),
            global_tax_regime: z.nativeEnum(TaxRegime).nullable(),
            global_tax_exemption_code: z.nativeEnum(VatExemptionCode).nullable(),
            global_tax_exemption_reason: z.string().nullable(),
            total_with_taxes: z.decimal(),
            currency: z.currency(),
            is_prepayment: z.boolean(),
            is_credit_note: z.boolean(),
            is_cancelled: z.boolean(),
            is_overdue: z.boolean(),
            created_at: z.datetime(),
        })
        .extend<T>(augmentation);

    return z.union([
        schema.extend({
            format: z.union([
                z.literal(BillingFormat.V1),
                z.literal(BillingFormat.V2),
            ]),
            total_taxes: z.lazy(() => LegacyInvoiceTaxSchema.array()),
        }),
        schema.extend({
            format: z.literal(BillingFormat.V3),
            total_taxes: z.lazy(() => InvoiceTaxSchema.array()).nullable(),
        }),
    ]);
};

export const InvoiceExcerptSchema = createInvoiceSchemaFactory({});

export const InvoiceSchema = createInvoiceSchemaFactory({
    order_number: z.string().nullable(),
    due_date: z.day().nullable(),
    due_delay: z.number().int().nullable(),
    buyer: z.lazy(() => BeneficiarySummarySchema),
    is_electronic: z.boolean(),
    lang: z.string(),
    parent_estimate: z.lazy(() => EstimateExcerptSchema).nullable(),
    parent_invoice: z.lazy(() => InvoiceExcerptSchema).nullable(),
    child_invoice: z.lazy(() => InvoiceExcerptSchema).nullable(),
});

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const createInvoiceDetailsSchemaFactory = () => {
    const baseDetailsSchema = {
        order_number: z.string().nullable(),
        due_date: z.day().nullable(),
        due_delay: z.number().int().nullable(),
        buyer: z.lazy(() => BeneficiarySchema),
        is_electronic: z.boolean(),
        lang: z.string(),
        payments: z.lazy(() => InvoicePaymentSchema.array()),
        parent_estimate: z.lazy(() => EstimateExcerptSchema).nullable(),
        parent_invoice: z.lazy(() => InvoiceExcerptSchema).nullable(),
        child_invoice: z.lazy(() => InvoiceExcerptSchema).nullable(),
    };

    return z.union([
        createInvoiceSchemaFactory({
            ...baseDetailsSchema,
            is_prepayment_final: z.literal(true),
            prepayment_invoices: z.lazy(() => InvoiceExcerptSchema.array()),
        }),
        createInvoiceSchemaFactory({
            ...baseDetailsSchema,
            is_prepayment_final: z.literal(false),
        }),
    ]);
};

export const InvoiceDetailsSchema = createInvoiceDetailsSchemaFactory();

// ------------------------------------------------------
// -
// -    Types
// -
// ------------------------------------------------------

export type InvoiceExcerpt = SchemaInfer<typeof InvoiceExcerptSchema>;

export type Invoice = SchemaInfer<typeof InvoiceSchema>;

export type InvoiceDetails = SchemaInfer<typeof InvoiceDetailsSchema>;

export type InvoiceTax = SchemaInfer<typeof InvoiceTaxSchema>;
export type InvoicePayment = SchemaInfer<typeof InvoicePaymentSchema>;

//
// - Récupération
//

export type Filters = Nullable<{
    search?: string | string[],
    date?: Day | { operator: string, value: Day },
    dueDate?: Day | { operator: string, value: Day },
    status?: InvoiceStatus | InvoiceStatus[],
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

export type InvoiceCreateLine = {
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

export type InvoiceCreate = {
    buyer_id: number,
    lang?: string,
    due_date?: Raw<Day> | null,
    order_number?: string | null,
    lines: InvoiceCreateLine[],
    global_discount_rate: Raw<Decimal>,
    special_mentions?: string | null,
};

export type InvoicePaymentCreate = Nullable<{
    amount: string | Raw<Decimal>,
    method?: PaymentMethod | null,
    reference?: string | null,
}>;

// ------------------------------------------------------
// -
// -    Fonctions
// -
// ------------------------------------------------------

const all = async (params: GetAllParams = {}): Promise<PaginatedData<Invoice[]>> => {
    const response = await requester.get('/invoices', { params });
    return withPaginationEnvelope(InvoiceSchema).parse(response);
};

const one = async (id: Invoice['id']): Promise<InvoiceDetails> => {
    const response = await requester.get(`/invoices/${id}`);
    return InvoiceDetailsSchema.parse(response);
};

const create = async (data: InvoiceCreate): Promise<InvoiceDetails> => {
    const response = await requester.post('/invoices', data);
    return InvoiceDetailsSchema.parse(response);
};

const finalize = async (id: Invoice['id']): Promise<InvoiceDetails> => {
    const response = await requester.put(`/invoices/${id}/finalize`);
    return InvoiceDetailsSchema.parse(response);
};

const createCreditNote = async (id: Invoice['id']): Promise<InvoiceDetails> => {
    const response = await requester.post(`/invoices/${id}/credit-note`);
    return InvoiceDetailsSchema.parse(response);
};

const updateStatus = async (id: Invoice['id'], status: InvoiceStatus): Promise<InvoiceDetails> => {
    const response = await requester.put(`/invoices/${id}/status`, { status });
    return InvoiceDetailsSchema.parse(response);
};

const addPayment = async (id: Invoice['id'], data: InvoicePaymentCreate): Promise<InvoicePayment> => {
    const response = await requester.post(`/invoices/${id}/payments`, data);
    return InvoicePaymentSchema.parse(response);
};

const remove = async (id: Invoice['id']): Promise<void> => {
    await requester.delete(`/invoices/${id}`);
};

export default {
    all,
    one,
    create,
    finalize,
    createCreditNote,
    updateStatus,
    addPayment,
    remove,
};
