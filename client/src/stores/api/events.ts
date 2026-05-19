import { z } from '@/utils/validation';
import requester from '@/globals/requester';
import TaxRegime from '@/utils/invoicing/tax-regime';
import VatExemptionCode from '@/utils/invoicing/vat-exemption-code';
import { UserSchema } from './users';
import { MaterialWithContextExcerptSchema } from './materials';
import { DocumentSchema } from './documents';
import { TechnicianSchema } from './technicians';
import { RoleSchema } from './roles';
import { withCountedEnvelope } from './@schema';
import { EstimateDetailsSchema, EstimateSchema } from './estimates';
import { InvoiceDetailsSchema, InvoiceSchema } from './invoices';
import {
    BeneficiarySchema,
} from './beneficiaries';

import type { Raw } from 'vue';
import type Day from '@/utils/day';
import type Color from '@/utils/color';
import type Period from '@/utils/period';
import type DateTime from '@/utils/datetime';
import type { ZodRawShape } from 'zod';
import type { CountedData } from './@types';
import type { SchemaInfer } from '@/utils/validation';
import type { User } from './users';
import type { Document } from './documents';
import type { EstimateDetails } from './estimates';
import type { InvoiceDetails } from './invoices';
import type { Material } from './materials';
import type { Technician } from './technicians';
import type { Role } from './roles';
import type { Beneficiary } from './beneficiaries';
import type { RequestConfig } from '@/globals/requester';

// ------------------------------------------------------
// -
// -    Schema / Enums
// -
// ------------------------------------------------------

//
// - Schemas secondaires
//

export const EventPositionSchema = z.strictObject({
    id: z.number(), // - Id du rôle.
    name: z.string(),
    is_mandatory: z.boolean(),
    is_assigned: z.boolean().nullable(),
});

export const EventTechnicianSchema = z.strictObject({
    id: z.number(),
    event_id: z.number(),
    technician_id: z.number(),
    period: z.period(),
    role: z.lazy(() => RoleSchema).nullable(),
    technician: z.lazy(() => TechnicianSchema),
});

const EventLineTaxSchema = z.strictObject({
    name: z.string().optional(),
    value: z.decimal(),
});

const EventTaxSchema = z.union([
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

const EventGlobalDiscountBreakdownSchema = z.strictObject({
    base: z.decimal(),
    value: z.decimal(),
    total: z.decimal(),
    tax: z.union([
        // - Régime standard.
        z.strictObject({
            type: z.literal(TaxRegime.STANDARD),
            name: z.string().optional(),
            value: z.decimal(),
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
        }),
    ]),
});

//
// -- Event material schemas / factory
//

const EventMaterialBaseSchema = z.strictObject({
    id: z.number(), // - Id du matériel.
    name: z.string(),
    reference: z.string(),
    category_id: z.number().nullable(),
    material: z.lazy(() => MaterialWithContextExcerptSchema),
    quantity: z.number().positive(),
    quantity_departed: z.number().nonnegative().nullable(),
    quantity_returned: z.number().nonnegative().nullable(),
    quantity_returned_broken: z.number().nonnegative().nullable(),
    departure_comment: z.string().nullable(),
    unit_replacement_price: z.decimal().nullable(),
    total_replacement_price: z.decimal().nullable(),
});

const createEventMaterialSchemaFactory = <T extends ZodRawShape>(augmentation: T) => (
    <InnerT extends ZodRawShape>(innerAugmentation: InnerT) => (
        EventMaterialBaseSchema
            .extend<T>(augmentation)
            .extend<InnerT>(innerAugmentation)
    )
);

const createMaterialNotBillableSchema = createEventMaterialSchemaFactory({});
const createMaterialBillableSchema = createEventMaterialSchemaFactory({
    unit_price: z.decimal(),
    degressive_rate: z.decimal(),
    unit_price_period: z.decimal(),
    total_without_discount: z.decimal(),
    discount_rate: z.decimal(),
    total_discount: z.decimal(),
    total_without_taxes: z.decimal(),
    tax_regime: z.nativeEnum(TaxRegime).nullable(),
    tax_exemption_code: z.nativeEnum(VatExemptionCode).nullable(),
    tax_id: z.number().nullable(),
    taxes: z.lazy(() => EventLineTaxSchema.array()).nullable(),
});

// - Matériel d'événement de base.
export const EventMaterialNotBillableSchema = createMaterialNotBillableSchema({});
export const EventMaterialBillableSchema = createMaterialBillableSchema({});
export const EventMaterialSchema = z.union([
    EventMaterialNotBillableSchema,
    EventMaterialBillableSchema,
]);

// - Matériel d'événement avec quantité manquante.
const EventMaterialNotBillableWithQuantityMissingSchema = createMaterialNotBillableSchema({
    quantity_missing: z.number().nonnegative(),
});
const EventMaterialBillableWithQuantityMissingSchema = createMaterialBillableSchema({
    quantity_missing: z.number().nonnegative(),
});
const EventMaterialWithQuantityMissingSchema = z.union([
    EventMaterialBillableWithQuantityMissingSchema,
    EventMaterialNotBillableWithQuantityMissingSchema,
]);

//
// -- Event extra schemas / factories
//

export const EventExtraSchema = z.strictObject({
    uuid: z.string().uuid(),
    is_service: z.boolean(),
    description: z.string(),
    quantity: z.number().positive(),
    unit_price: z.decimal(),
    total_without_discount: z.decimal(),
    discount_rate: z.decimal(),
    total_discount: z.decimal(),
    total_without_taxes: z.decimal(),
    tax_regime: z.nativeEnum(TaxRegime).nullable(),
    tax_exemption_code: z.nativeEnum(VatExemptionCode).nullable(),
    tax_id: z.number().nullable(),
    taxes: z.lazy(() => EventLineTaxSchema.array()).nullable(),
});

//
// - Schemas principaux
//

export const EventSummarySchema = z.strictObject({
    id: z.number(),
    title: z.string(),
    mobilization_period: z.period(),
    operation_period: z.period(),
    location: z.string().nullable(),
});

export const EventSchema = EventSummarySchema.extend({
    reference: z.string().nullable(),
    description: z.string().nullable(),
    color: z.color().nullable(),
    beneficiaries: z.lazy(() => BeneficiarySchema.array()),
    is_confirmed: z.boolean(),
    is_billable: z.boolean(),
    is_archived: z.boolean(),
    is_departure_inventory_done: z.boolean(),
    is_return_inventory_done: z.boolean(),
    return_inventory_datetime: z.datetime().nullable(),
    materials_count: z.number().nonnegative(),
    has_materials: z.boolean(),
    note: z.string().nullable().optional(),
    created_at: z.datetime(),
    updated_at: z.datetime().nullable(),
});

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const createEventDetailsSchema = <T extends ZodRawShape>(augmentation: T) => (
    EventSchema
        .omit({
            is_billable: true,
            is_archived: true,
            is_departure_inventory_done: true,
            is_return_inventory_done: true,
            return_inventory_datetime: true,
        })
        .extend({
            total_replacement: z.decimal(),
            total_weight: z.decimal(),
            currency: z.currency(),
            has_deleted_materials: z.boolean(),
            technicians: z.lazy(() => EventTechnicianSchema.array()),
            positions: z.lazy(() => EventPositionSchema.array()),
            manager: z.lazy(() => UserSchema).nullable(),
            author: z.lazy(() => UserSchema).nullable(),
            note: z.string().nullable().optional(),
        })
        .extend<T>(augmentation)
        .extend(
            {
                is_departure_inventory_done: z.literal(true),
                departure_inventory_datetime: z.datetime().nullable(),
                departure_inventory_author: z.lazy(() => UserSchema).nullable(),
            },
            {
                is_departure_inventory_done: z.literal(false),
                departure_inventory_datetime: z.null(),
                departure_inventory_author: z.null(),
            },
        )
        .extend(
            {
                is_return_inventory_done: z.literal(true),
                is_return_inventory_started: z.literal(true),
                return_inventory_datetime: z.datetime().nullable(),
                return_inventory_author: z.lazy(() => UserSchema).nullable(),
            },
            {
                is_return_inventory_done: z.literal(false),
                is_return_inventory_started: z.boolean(),
                return_inventory_datetime: z.null(),
                return_inventory_author: z.null(),
            },
        )
        .extend(
            {
                is_archived: z.literal(true),
                has_missing_materials: z.null(),
                has_not_returned_materials: z.null(),
                has_unassigned_mandatory_positions: z.null(),
            },
            {
                is_archived: z.literal(false),
                has_missing_materials: z.boolean().nullable(),
                has_not_returned_materials: z.boolean().nullable(),
                has_unassigned_mandatory_positions: z.boolean().nullable(),
            },
        )
        .extend(
            {
                is_billable: z.literal(true),
                materials: z.lazy(() => EventMaterialBillableSchema.array()),
                extras: z.lazy(() => EventExtraSchema.array()),
                estimates: z.lazy(() => EstimateSchema.array()).optional(),
                invoices: z.lazy(() => InvoiceSchema.array()).optional(),
                total_without_global_discount: z.decimal(),
                global_discount_rate: z.decimal(),
                global_discount_breakdown: z.lazy(() => EventGlobalDiscountBreakdownSchema.array()),
                total_global_discount: z.decimal(),
                total_without_taxes: z.decimal(),
                global_tax_regime: z.nativeEnum(TaxRegime).nullable(),
                global_tax_exemption_code: z.nativeEnum(VatExemptionCode).nullable(),
                global_tax_exemption_reason: z.string().nullable(),
                total_taxes: z.lazy(() => EventTaxSchema.array()).nullable(),
                total_with_taxes: z.decimal(),
            },
            {
                is_billable: z.literal(false),
                materials: z.lazy(() => EventMaterialNotBillableSchema.array()),
            },
        )
);

export const EventDetailsSchema = createEventDetailsSchema({});

// ------------------------------------------------------
// -
// -    Types
// -
// ------------------------------------------------------

//
// - Main Types
//

type NarrowEvent<Schema, IsBillable extends boolean> =
    IsBillable extends true
        ? Extract<Schema, { is_billable: true }>
        : Extract<Schema, { is_billable: false }>;

export type Event = SchemaInfer<typeof EventSchema>;

export type EventDetails<IsBillable extends boolean = boolean> =
    NarrowEvent<SchemaInfer<typeof EventDetailsSchema>, IsBillable>;

export type EventSummary = SchemaInfer<typeof EventSummarySchema>;

//
// - Secondary Types
//

export type EventMaterial<IsBillable extends boolean = boolean> =
    IsBillable extends true
        ? SchemaInfer<typeof EventMaterialBillableSchema>
        : SchemaInfer<typeof EventMaterialNotBillableSchema>;

export type EventMaterialWithQuantityMissing = SchemaInfer<typeof EventMaterialWithQuantityMissingSchema>;

export type EventExtra = SchemaInfer<typeof EventExtraSchema>;

export type EventTechnician = SchemaInfer<typeof EventTechnicianSchema>;

export type EventPosition = SchemaInfer<typeof EventPositionSchema>;

export type EventLineTax = SchemaInfer<typeof EventLineTaxSchema>;
export type EventTax = SchemaInfer<typeof EventTaxSchema>;

//
// - Edition
//

export type EventEdit = {
    title: string,
    operation_period: Raw<Period> | null,
    mobilization_period: Raw<Period> | null,
    location: string | null,
    description: string | null,
    color: Raw<Color> | null,
    is_billable: boolean,
    is_confirmed: boolean,
    beneficiaries?: Array<Beneficiary['id']>,
    manager_id?: User['id'] | null,
    note?: string | null,
};

type EventDuplicatePayload = {
    operation_period: Raw<Period> | null,
    mobilization_period: Raw<Period> | null,
    keepBillingData?: boolean,
};

type EventReturnInventoryMaterial = {
    id: Material['id'],
    actual: number,
    broken: number,
};
type EventReturnInventory = EventReturnInventoryMaterial[];

type EventDepartureInventoryMaterial = {
    id: Material['id'],
    actual: number,
    comment?: string | null,
};
type EventDepartureInventory = EventDepartureInventoryMaterial[];

export type EventAssignmentEdit = Nullable<{
    period: Raw<Period>,
    role_id: Role['id'] | null,
    technician_id: Technician['id'],
}>;

export type EventPositionEdit = Nullable<{
    id: Role['id'],
    is_mandatory: boolean,
}>;

export type EventInvoiceCreate = {
    lang?: string,
    due_date?: Raw<Day> | null,
    order_number?: string | null,
    special_mentions?: string | null,
};

export type EventEstimateCreate = {
    lang?: string,
    due_date?: Raw<Day> | null,
    special_mentions?: string | null,
};

//
// - Récupération
//

type GetAllParams = {
    search?: string | string[],
    exclude?: number | undefined,
    onlySelectable?: boolean,
};

// ------------------------------------------------------
// -
// -    Fonctions
// -
// ------------------------------------------------------

const all = async (params: GetAllParams = {}): Promise<CountedData<EventSummary[]>> => {
    const response = await requester.get('/events', { params });
    return withCountedEnvelope(EventSummarySchema).parse(response);
};

const one = async (id: Event['id']): Promise<EventDetails> => {
    const response = await requester.get(`/events/${id}`);
    return EventDetailsSchema.parse(response);
};

const missingMaterials = async (id: Event['id']): Promise<EventMaterialWithQuantityMissing[]> => {
    const response = await requester.get(`/events/${id}/missing-materials`);
    return EventMaterialWithQuantityMissingSchema.array().parse(response);
};

const setConfirmed = async (id: Event['id'], isConfirmed: boolean): Promise<EventDetails> => {
    const response = await requester.put(`/events/${id}`, { is_confirmed: isConfirmed });
    return EventDetailsSchema.parse(response);
};

const archive = async (id: Event['id']): Promise<EventDetails> => {
    const response = await requester.put(`/events/${id}/archive`);
    return EventDetailsSchema.parse(response);
};

const unarchive = async (id: Event['id']): Promise<EventDetails> => {
    const response = await requester.put(`/events/${id}/unarchive`);
    return EventDetailsSchema.parse(response);
};

const updateDepartureInventory = async (id: Event['id'], inventory: EventDepartureInventory): Promise<EventDetails> => {
    const response = await requester.put(`/events/${id}/departure`, inventory);
    return EventDetailsSchema.parse(response);
};

const finishDepartureInventory = async (id: Event['id'], inventory: EventDepartureInventory): Promise<EventDetails> => {
    const response = await requester.put(`/events/${id}/departure/finish`, inventory);
    return EventDetailsSchema.parse(response);
};

const cancelDepartureInventory = async (id: Event['id']): Promise<EventDetails> => {
    const response = await requester.delete(`/events/${id}/departure`);
    return EventDetailsSchema.parse(response);
};

const updateReturnInventory = async (id: Event['id'], inventory: EventReturnInventory): Promise<EventDetails> => {
    const response = await requester.put(`/events/${id}/return`, inventory);
    return EventDetailsSchema.parse(response);
};

const finishReturnInventory = async (id: Event['id'], date?: DateTime, inventory?: EventReturnInventory): Promise<EventDetails> => {
    const response = await requester.put(`/events/${id}/return/finish`, { date, inventory });
    return EventDetailsSchema.parse(response);
};

const cancelReturnInventory = async (id: Event['id']): Promise<EventDetails> => {
    const response = await requester.delete(`/events/${id}/return`);
    return EventDetailsSchema.parse(response);
};

const createInvoice = async (id: Event['id'], data: EventInvoiceCreate = {}): Promise<InvoiceDetails> => {
    const response = await requester.post(`/events/${id}/invoices`, data);
    return InvoiceDetailsSchema.parse(response);
};

const createEstimate = async (id: Event['id'], data: EventEstimateCreate = {}): Promise<EstimateDetails> => {
    const response = await requester.post(`/events/${id}/estimates`, data);
    return EstimateDetailsSchema.parse(response);
};

const create = async (data: EventEdit): Promise<EventDetails> => {
    const response = await requester.post(`/events`, data);
    return EventDetailsSchema.parse(response);
};

const update = async (id: Event['id'], data: Partial<EventEdit>): Promise<EventDetails> => {
    const response = await requester.put(`/events/${id}`, data);
    return EventDetailsSchema.parse(response);
};

const updateNote = async (id: Event['id'], note: Event['note']): Promise<EventDetails> => {
    const response = await requester.put(`/events/${id}/note`, { note });
    return EventDetailsSchema.parse(response);
};

const createAssignment = async (id: Event['id'], data: EventAssignmentEdit): Promise<EventTechnician> => {
    const response = await requester.post(`/events/${id}/assignments`, data);
    return EventTechnicianSchema.parse(response);
};

const updateAssignment = async (id: Event['id'], assignmentId: EventTechnician['id'], data: EventAssignmentEdit): Promise<EventTechnician> => {
    const response = await requester.put(`/events/${id}/assignments/${assignmentId}`, data);
    return EventTechnicianSchema.parse(response);
};

const deleteAssignment = async (id: Event['id'], assignmentId: EventTechnician['id']): Promise<void> => {
    await requester.delete(`/events/${id}/assignments/${assignmentId}`);
};

const createPosition = async (id: Event['id'], data: EventPositionEdit): Promise<EventPosition> => {
    const response = await requester.post(`/events/${id}/positions`, data);
    return EventPositionSchema.parse(response);
};

const deletePosition = async (id: Event['id'], positionId: EventPosition['id']): Promise<void> => {
    await requester.delete(`/events/${id}/positions/${positionId}`);
};

const duplicate = async (id: Event['id'], data: EventDuplicatePayload): Promise<EventDetails> => {
    const response = await requester.post(`/events/${id}/duplicate`, data);
    return EventDetailsSchema.parse(response);
};

const remove = async (id: Event['id']): Promise<void> => {
    await requester.delete(`/events/${id}`);
};

const documents = async (id: Event['id']): Promise<Document[]> => {
    const response = await requester.get(`/events/${id}/documents`);
    return DocumentSchema.array().parse(response);
};

const attachDocument = async (id: Event['id'], file: File, options: RequestConfig = {}): Promise<Document> => {
    const formData = new FormData(); formData.append('file', file);
    const response = await requester.post(`/events/${id}/documents`, formData, options);
    return DocumentSchema.parse(response);
};

export default {
    all,
    one,
    missingMaterials,
    setConfirmed,
    archive,
    unarchive,
    updateDepartureInventory,
    finishDepartureInventory,
    cancelDepartureInventory,
    updateReturnInventory,
    finishReturnInventory,
    cancelReturnInventory,
    createInvoice,
    createEstimate,
    duplicate,
    create,
    update,
    updateNote,
    createAssignment,
    updateAssignment,
    deleteAssignment,
    createPosition,
    deletePosition,
    remove,
    documents,
    attachDocument,
};
