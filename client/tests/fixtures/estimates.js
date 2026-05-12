import pick from 'lodash/pick';
import invoices from './invoices';
import beneficiaries from './beneficiaries';
import TaxRegime from '@/utils/invoicing/tax-regime';
import { EstimateStatus } from '@/stores/api/estimates';
import { VatExemptionCodeFr } from '@/utils/invoicing/vat-exemption-code';
import BillingFormat from '@/stores/api/@enums/billing-format';
import { dataFactory } from './@utils';

const data = [
    {
        id: 1,
        format: BillingFormat.V3,
        number: 'D-2021-00001',
        date: '2021-01-30 14:00:00',
        due_date: null,
        due_delay: 30,
        status: EstimateStatus.ACCEPTED,
        url: 'http://loxya.test/estimates/1/pdf',
        buyer: beneficiaries.summary(1),
        has_final_invoice: false,
        total_without_taxes: '886.64',
        global_tax_regime: null,
        global_tax_exemption_code: null,
        global_tax_exemption_reason: null,
        total_taxes: [
            {
                type: TaxRegime.STANDARD,
                value: '20.000',
                base: '882.07',
                total: '176.41',
            },
            {
                type: TaxRegime.STANDARD,
                value: '5.500',
                base: '4.57',
                total: '0.25',
            },
        ],
        total_with_taxes: '1063.30',
        currency: 'EUR',
        lang: 'en',
        related_invoices: [
            () => invoices.excerpt(5),
        ],
        created_at: '2021-01-30 14:00:00',
    },
    {
        id: 2,
        format: BillingFormat.V1,
        date: '2022-06-14 22:48:20',
        due_date: '2022-06-20',
        due_delay: null,
        status: EstimateStatus.SENT,
        url: 'http://loxya.test/estimates/2/pdf',
        buyer: beneficiaries.summary(1),
        has_final_invoice: false,
        total_without_taxes: '550.28',
        global_tax_regime: TaxRegime.EXEMPTED,
        global_tax_exemption_code: VatExemptionCodeFr.VATEX_FR_FRANCHISE,
        global_tax_exemption_reason: null,
        total_taxes: [],
        total_with_taxes: '660.34',
        currency: 'EUR',
        lang: 'fr',
        related_invoices: [],
        created_at: '2022-06-14 22:48:20',
    },
    {
        id: 3,
        format: BillingFormat.V3,
        number: 'D-2026-00002',
        date: '2026-04-15 09:30:00',
        due_date: null,
        due_delay: 30,
        status: EstimateStatus.ACCEPTED,
        url: 'http://loxya.test/estimates/3/pdf',
        buyer: beneficiaries.summary(2),
        has_final_invoice: false,
        total_without_taxes: '-50.00',
        global_tax_regime: null,
        global_tax_exemption_code: null,
        global_tax_exemption_reason: null,
        total_taxes: [
            {
                type: TaxRegime.STANDARD,
                value: '20.000',
                base: '-50.00',
                total: '-10.00',
            },
        ],
        total_with_taxes: '-60.00',
        currency: 'EUR',
        lang: 'fr',
        related_invoices: [],
        created_at: '2026-04-15 09:30:00',
    },
    {
        id: 4,
        format: BillingFormat.V3,
        number: 'D-2026-00003',
        date: '2026-05-10 10:00:00',
        due_date: null,
        due_delay: 30,
        status: EstimateStatus.PENDING,
        url: 'http://loxya.test/estimates/4/pdf',
        buyer: beneficiaries.summary(2),
        has_final_invoice: false,
        total_without_taxes: '0.00',
        global_tax_regime: null,
        global_tax_exemption_code: null,
        global_tax_exemption_reason: null,
        total_taxes: [
            {
                type: TaxRegime.STANDARD,
                value: '20.000',
                base: '0.00',
                total: '0.00',
            },
        ],
        total_with_taxes: '0.00',
        currency: 'EUR',
        lang: 'en',
        related_invoices: [],
        created_at: '2026-05-10 10:00:00',
    },
    {
        id: 5,
        format: BillingFormat.V3,
        number: 'D-2026-00001',
        date: '2026-01-15 09:00:00',
        due_date: null,
        due_delay: 30,
        status: EstimateStatus.ACCEPTED,
        url: 'http://loxya.test/estimates/5/pdf',
        buyer: beneficiaries.summary(2),
        has_final_invoice: false,
        total_without_taxes: '1.44',
        global_tax_regime: null,
        global_tax_exemption_code: null,
        global_tax_exemption_reason: null,
        total_taxes: [
            {
                type: TaxRegime.STANDARD,
                value: '20.000',
                base: '1000.00',
                total: '200.00',
            },
            {
                type: TaxRegime.STANDARD,
                value: '10.000',
                base: '-998.56',
                total: '-99.86',
            },
        ],
        total_with_taxes: '101.58',
        currency: 'EUR',
        lang: 'fr',
        related_invoices: [],
        created_at: '2026-01-15 09:00:00',
    },
];

//
// - Exports
//

/** @type {import('./@utils').FactoryReturnType} */
const asExcerpt = dataFactory(data, (estimate) => (
    pick(estimate, [
        'id',
        'format',
        'status',
        'number',
        'date',
        'url',
        'has_final_invoice',
        'total_without_taxes',
        'global_tax_regime',
        'global_tax_exemption_code',
        'global_tax_exemption_reason',
        'total_taxes',
        'total_with_taxes',
        'currency',
        'created_at',
    ])
));

/** @type {import('./@utils').FactoryReturnType} */
const asDefault = dataFactory(data, (estimate) => ({
    ...estimate,
    related_invoices: estimate.related_invoices.map(
        (lazyInvoice) => lazyInvoice(),
    ),
}));

/** @type {import('./@utils').FactoryReturnType} */
const asDetails = dataFactory(data, (estimate) => ({
    ...estimate,
    buyer: beneficiaries.default(estimate.buyer.id),
    related_invoices: estimate.related_invoices.map(
        (lazyInvoice) => lazyInvoice(),
    ),
}));

export default {
    excerpt: asExcerpt,
    default: asDefault,
    details: asDetails,
};
