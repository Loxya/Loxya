import './index.scss';
import Decimal from 'decimal.js';
import config from '@/globals/config';
import { defineComponent } from 'vue';
import { RequestError } from '@/globals/requester';
import { ApiErrorCode } from '@/stores/api/@codes';
import apiInvoices from '@/stores/api/invoices';
import formatAmount from '@/utils/formatAmount';
import PaymentMethod from '@/utils/invoicing/payment-method';
import Button from '@/themes/default/components/Button';
import FormField from '@/themes/default/components/FormField';
import { VerticalFormKey } from '@/themes/default/components/@constants';
import { computeTaxesBreakdown } from './_utils';

import type { PropType } from 'vue';
import type Currency from '@/utils/currency';
import type { PaymentTaxBreakdownLine } from './_utils';
import type { Options } from '@/themes/default/components/Select';
import type {
    InvoiceDetails,
    InvoicePayment,
    InvoicePaymentCreate,
} from '@/stores/api/invoices';

type Props = {
    /** La facture pour laquelle on souhaite ajouter un paiement. */
    invoice: InvoiceDetails,

    /**
     * Fonction appelée à la fermeture de la modale.
     *
     * @param payment - Le paiement créé si l'utilisateur a
     *                  été au bout de la création.
     */
    onClose?(payment?: InvoicePayment): void,
};

type EditData = (
    & Omit<Required<InvoicePaymentCreate>, 'amount'>
    & { amount: string | null }
);

type Data = {
    data: EditData,
    isSaving: boolean,
    validationErrors: Record<string, string> | null,
};

/** Modale d'ajout de paiement / remboursement pour une facture. */
const AddPaymentModal = defineComponent({
    name: 'AddPaymentModal',
    modal: {
        width: 520,
        dismissible: false,
    },
    provide: {
        [VerticalFormKey as symbol]: true,
    },
    props: {
        invoice: {
            type: Object as PropType<Props['invoice']>,
            required: true,
        },
        // eslint-disable-next-line vue/no-unused-properties
        onClose: {
            type: Function as PropType<Props['onClose']>,
            default: undefined,
        },
    },
    emits: ['close'],
    data(): Data {
        const { invoice } = this;
        const remaining = (() => {
            const totalPaid = invoice.payments.reduce(
                (total: Decimal, payment: InvoicePayment) => (
                    total.plus(payment.amount)
                ),
                new Decimal(0),
            );
            return Decimal.max(0, invoice.total_with_taxes.abs().minus(totalPaid));
        })();

        return {
            data: {
                amount: (
                    remaining.greaterThan(0)
                        ? remaining.toString()
                        : null
                ),
                method: null,
                reference: null,
            },
            isSaving: false,
            validationErrors: null,
        };
    },
    computed: {
        isRefundContext(): boolean {
            const { invoice } = this;

            return (
                invoice.is_credit_note ||
                invoice.total_with_taxes.isNegative()
            );
        },

        isSimpleVatSystem(): boolean {
            return !!config.organization.country.hasSimpleVatSystem;
        },

        currency(): Currency {
            return this.invoice.currency;
        },

        methodOptions(): Options<PaymentMethod> {
            const { __ } = this;

            return Object
                .values(PaymentMethod)
                .map((value: PaymentMethod) => {
                    const label = __(`global.payment-methods.${value}`);
                    return { label, value };
                });
        },

        totalPaid(): Decimal {
            return this.invoice.payments.reduce(
                (total: Decimal, payment: InvoicePayment) => (
                    total.plus(payment.amount)
                ),
                new Decimal(0),
            );
        },

        remainingAmount(): Decimal {
            const { invoice, totalPaid } = this;
            const remaining = invoice.total_with_taxes.abs().minus(totalPaid);
            return Decimal.max(0, remaining);
        },

        currentAmount(): Decimal | null {
            let rawValue = (this.data.amount ?? '');
            rawValue = rawValue.trim().replaceAll(',', '.');
            rawValue = rawValue.endsWith('.') ? `${rawValue}0` : rawValue;

            if (rawValue === '' || rawValue === '-' || !/^-?\d+(?:\.\d+)?$/.test(rawValue)) {
                return null;
            }

            const value = new Decimal(rawValue);
            return value.isZero() ? null : value;
        },

        taxesBreakdown(): PaymentTaxBreakdownLine[] | null {
            if (this.currentAmount === null) {
                return null;
            }
            return computeTaxesBreakdown(this.invoice, this.currentAmount);
        },
    },
    methods: {
        // ------------------------------------------------------
        // -
        // -    Handlers
        // -
        // ------------------------------------------------------

        handleSubmit(e: SubmitEvent) {
            e?.preventDefault();

            this.save();
        },

        handleSave() {
            this.save();
        },

        handleClose() {
            this.$emit('close', undefined);
        },

        handleInputAmount(rawValue: string) {
            let value: string;
            value = rawValue.trim().replaceAll(',', '.');
            value = value.endsWith('.') ? `${value}0` : value;

            const isValidNumber = /^-?\d+(?:\.\d+)?$/.test(value);
            if (value !== '' && value !== '-' && !isValidNumber) {
                this.data.amount = null;
                return;
            }

            // - Si l'entrée n'est pas (encore) un nombre valide, on ne fait rien.
            //   (l'événement `onChange` se chargera de remettre le champ en ordre
            //    si jamais le blur est atteint sans correction de l'entrée)
            if (!isValidNumber) {
                this.data.amount = rawValue;
                return;
            }

            const min = this.totalPaid.neg();
            const max = this.remainingAmount;

            const normalizedValue = new Decimal(value);
            const boundedValue = Decimal.min(Decimal.max(normalizedValue, min), max)
                .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
                .toString();

            this.data.amount = !normalizedValue.equals(boundedValue)
                ? boundedValue
                : rawValue;
        },

        handleChangeAmount(rawValue: string) {
            rawValue = rawValue.trim().replaceAll(',', '.');
            rawValue = rawValue.endsWith('.') ? `${rawValue}0` : rawValue;

            if (rawValue === '' || rawValue === '-' || !/^-?\d+(?:\.\d+)?$/.test(rawValue)) {
                this.data.amount = null;
                return;
            }

            const min = this.totalPaid.neg();
            const max = this.remainingAmount;

            this.data.amount = Decimal.min(Decimal.max(rawValue, min), max)
                .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
                .toString();
        },

        // ------------------------------------------------------
        // -
        // -    Méthodes internes
        // -
        // ------------------------------------------------------

        async save() {
            if (this.isSaving) {
                return;
            }
            this.isSaving = true;
            const { __, __k, invoice, data } = this;

            try {
                const payment = await apiInvoices.addPayment(invoice.id, data);

                this.validationErrors = null;
                this.$toasted.success(__k('created'));
                this.$emit('close', payment);
            } catch (error) {
                this.isSaving = false;

                if (error instanceof RequestError && error.code === ApiErrorCode.VALIDATION_FAILED) {
                    this.validationErrors = { ...error.details };
                    return;
                }

                // eslint-disable-next-line no-console
                console.error(`Error occurred while saving the payment`, error);
                this.$toasted.error(__('global.errors.unexpected-while-saving'));
            }
        },

        __(key: string, params?: Record<string, number | string>, count?: number): string {
            key = !key.startsWith('global.')
                ? `modal.invoice-details.modals.add-payment.${key}`
                : key.replace(/^global\./, '');

            return this.$t(key, params, count);
        },

        __k(key: string, params?: Record<string, number | string>, count?: number): string {
            const kind = this.isRefundContext ? 'refund' : 'payment';
            return this.__(`${key}.${kind}`, params, count);
        },

        __s(key: string, params?: Record<string, number | string>, count?: number): string {
            const systemSuffix = this.isSimpleVatSystem ? 'simple' : 'default';
            return this.__(`${key}.${systemSuffix}`, params, count);
        },
    },
    render() {
        const {
            __,
            __k,
            __s,
            data,
            invoice,
            currency,
            isSaving,
            methodOptions,
            taxesBreakdown,
            validationErrors,
            handleSave,
            handleClose,
            handleSubmit,
            handleInputAmount,
            handleChangeAmount,
        } = this;

        return (
            <div class="AddPaymentModal">
                <header class="AddPaymentModal__header">
                    <h2 class="AddPaymentModal__header__title">
                        {__k('title', { number: invoice.number! })}
                    </h2>
                    <Button
                        type="close"
                        class="AddPaymentModal__header__close-button"
                        onClick={handleClose}
                    />
                </header>
                <div class="AddPaymentModal__body">
                    <form class="AddPaymentModal__form" onSubmit={handleSubmit}>
                        <div class="AddPaymentModal__amount">
                            <FormField
                                type="text"
                                label={__('fields.amount')}
                                class="AddPaymentModal__amount__value"
                                value={data.amount}
                                addon={currency.symbol}
                                error={validationErrors?.amount}
                                onInput={handleInputAmount}
                                onChange={handleChangeAmount}
                                required
                            />
                            {taxesBreakdown !== null && taxesBreakdown.length > 0 && (
                                <section class="AddPaymentModal__amount__taxes-breakdown">
                                    <div class="AddPaymentModal__amount__taxes-breakdown__title">
                                        {__s('taxes-breakdown.title')}
                                    </div>
                                    <ul class="AddPaymentModal__amount__taxes-breakdown__list">
                                        {taxesBreakdown.map((line: PaymentTaxBreakdownLine) => (
                                            <li
                                                key={line.rate.toString()}
                                                class="AddPaymentModal__amount__taxes-breakdown__list__item"
                                            >
                                                <span class="AddPaymentModal__amount__taxes-breakdown__list__item__label">
                                                    {__('taxes-breakdown.line', { rate: line.rate.toString() })}
                                                </span>
                                                <span class="AddPaymentModal__amount__taxes-breakdown__list__item__amount">
                                                    {formatAmount(line.amount, currency)}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                </section>
                            )}
                        </div>
                        <FormField
                            type="select"
                            label={__('fields.method')}
                            value={data.method}
                            options={methodOptions}
                            error={validationErrors?.method}
                            onChange={(value: PaymentMethod | null) => {
                                data.method = value;
                            }}
                        />
                        <FormField
                            label={__('fields.reference.label')}
                            placeholder={__('fields.reference.placeholder')}
                            value={data.reference}
                            error={validationErrors?.reference}
                            onInput={(value: string) => {
                                data.reference = value;
                            }}
                        />
                    </form>
                </div>
                <div class="AddPaymentModal__footer">
                    <Button type="primary" onClick={handleSave} loading={isSaving}>
                        {isSaving ? __('global.saving') : __k(`action`)}
                    </Button>
                    <Button onClick={handleClose}>
                        {__('global.cancel')}
                    </Button>
                </div>
            </div>
        );
    },
});

export default AddPaymentModal;
