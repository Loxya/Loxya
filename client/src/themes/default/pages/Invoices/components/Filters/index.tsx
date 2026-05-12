import { defineComponent } from 'vue';
import config from '@/globals/config';
import { z } from '@/utils/validation';
import { InvoiceStatus } from '@/stores/api/invoices';
import SearchPanel, { FilterKind } from '@/themes/default/components/SearchPanel';

import type { PropType } from 'vue';
import type { SchemaInfer } from '@/utils/validation';
import type { FilterDefinition, TokenOptions } from '@/themes/default/components/SearchPanel';

export enum TokenType {
    STATUS = 'status',
    DATE = 'date',
    DUE_DATE = 'dueDate',
    AMOUNT = 'amount',
}

export const FiltersSchema = z.strictObject({
    search: z.string().array(),
    [TokenType.STATUS]: z
        .nativeEnum(InvoiceStatus)
        .array(),
    [TokenType.DATE]: z
        .union([z.day(), z.strictObject({ operator: z.string(), value: z.day() })])
        .nullable(),
    [TokenType.DUE_DATE]: z
        .union([z.day(), z.strictObject({ operator: z.string(), value: z.day() })])
        .nullable(),
    [TokenType.AMOUNT]: z
        .union([z.number(), z.strictObject({ operator: z.string(), value: z.number() })])
        .nullable(),
});

export type Filters = SchemaInfer<typeof FiltersSchema>;

type Props = {
    /** Les valeurs actuelles des filtres. */
    values: Filters,

    /**
     * Fonction appelée lorsque les filtres ont changés.
     *
     * @param newFilters - Les nouveaux filtres.
     */
    onChange?(newFilters: Filters): void,

    /**
     * Fonction appelée lorsque l'utilisateur a soumis
     * les changements dans les filtres.
     */
    onSubmit?(): void,
};

/** Filtres de la page des devis. */
const InvoicesFilters = defineComponent({
    name: 'InvoicesFilters',
    props: {
        values: {
            type: Object as PropType<Required<Props>['values']>,
            required: true,
            validator: (value: unknown) => (
                FiltersSchema.safeParse(value).success
            ),
        },
        // eslint-disable-next-line vue/no-unused-properties
        onChange: {
            type: Function as PropType<Props['onChange']>,
            default: undefined,
        },
        // eslint-disable-next-line vue/no-unused-properties
        onSubmit: {
            type: Function as PropType<Props['onSubmit']>,
            default: undefined,
        },
    },
    emits: ['change', 'submit'],
    computed: {
        statusOptions(): TokenOptions<InvoiceStatus> {
            const { __ } = this;

            return [
                {
                    label: __('global.invoice-status.draft'),
                    value: InvoiceStatus.DRAFT,
                },
                {
                    label: __('global.invoice-status.pending'),
                    value: InvoiceStatus.PENDING,
                },
                {
                    label: __('global.invoice-status.sent'),
                    value: InvoiceStatus.SENT,
                },
                {
                    label: __('global.invoice-status.overdue'),
                    value: InvoiceStatus.OVERDUE,
                },
                {
                    label: __('global.invoice-status.partially-paid'),
                    value: InvoiceStatus.PARTIALLY_PAID,
                },
                {
                    label: __('global.invoice-status.paid'),
                    value: InvoiceStatus.PAID,
                },
                {
                    label: __('global.invoice-status.obsolete'),
                    value: InvoiceStatus.OBSOLETE,
                },
                {
                    label: __('global.invoice-status.cancelled'),
                    value: InvoiceStatus.CANCELLED,
                },
            ];
        },

        definitions(): FilterDefinition[] {
            const { __, statusOptions } = this;

            return [
                {
                    type: TokenType.STATUS,
                    icon: 'question',
                    title: __('status.label'),
                    placeholder: __('status.placeholder'),
                    options: statusOptions,
                    unique: false,
                },
                {
                    type: TokenType.DATE,
                    icon: 'calendar',
                    title: __('issue-date.label'),
                    placeholder: __('issue-date.placeholder'),
                    kind: FilterKind.DATE,
                    operators: [
                        {
                            label: __('issue-date.operators.before.label'),
                            alias: __('issue-date.operators.before.alias'),
                            value: '<',
                        },
                        {
                            label: __('issue-date.operators.exact.label'),
                            alias: __('issue-date.operators.exact.alias'),
                            value: '=',
                        },
                        {
                            label: __('issue-date.operators.after.label'),
                            alias: __('issue-date.operators.after.alias'),
                            value: '>',
                        },
                    ],
                },
                {
                    type: TokenType.DUE_DATE,
                    icon: 'calendar-times',
                    title: __('due-date.label'),
                    placeholder: __('due-date.placeholder'),
                    kind: FilterKind.DATE,
                    operators: [
                        {
                            label: __('due-date.operators.before.label'),
                            alias: __('due-date.operators.before.alias'),
                            value: '<',
                        },
                        {
                            label: __('due-date.operators.exact.label'),
                            alias: __('due-date.operators.exact.alias'),
                            value: '=',
                        },
                        {
                            label: __('due-date.operators.after.label'),
                            alias: __('due-date.operators.after.alias'),
                            value: '>',
                        },
                    ],
                },
                {
                    type: TokenType.AMOUNT,
                    icon: 'money-bill',
                    title: __('amount.label'),
                    placeholder: __('amount.placeholder'),
                    kind: FilterKind.FLOAT,
                    operators: [
                        {
                            label: __('amount.operators.before.label'),
                            alias: __('amount.operators.before.alias'),
                            value: '<',
                        },
                        {
                            label: __('amount.operators.exact.label'),
                            alias: __('amount.operators.exact.alias'),
                            value: '=',
                        },
                        {
                            label: __('amount.operators.after.label'),
                            alias: __('amount.operators.after.alias'),
                            value: '>',
                        },
                    ],
                    render: (value: number): JSX.Node => (
                        (config.currency.symbol ?? '').length > 0
                            ? `${value.toString()}\u00A0${config.currency.symbol}`
                            : value.toString()
                    ),
                },
            ];
        },
    },
    methods: {
        // ------------------------------------------------------
        // -
        // -    Handlers
        // -
        // ------------------------------------------------------

        handleChange(newFilters: Filters) {
            this.$emit('change', newFilters);
        },

        handleSubmit() {
            this.$emit('submit');
        },

        // ------------------------------------------------------
        // -
        // -    Méthodes internes
        // -
        // ------------------------------------------------------

        __(key: string, params?: Record<string, number | string>, count?: number): string {
            if (!key.startsWith('global.')) {
                if (!key.startsWith('page.')) {
                    key = `page.filters.${key}`;
                }
                key = key.replace(/^page\./, 'page.invoices.');
            } else {
                key = key.replace(/^global\./, '');
            }
            return this.$t(key, params, count);
        },
    },
    render() {
        const {
            values,
            definitions,
            handleChange,
            handleSubmit,
        } = this;

        return (
            <SearchPanel
                values={values}
                definitions={definitions}
                onChange={handleChange}
                onSubmit={handleSubmit}
            />
        );
    },
});

export default InvoicesFilters;
