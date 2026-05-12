import './index.scss';
import Decimal from 'decimal.js';
import config from '@/globals/config';
import { confirm } from '@/utils/alert';
import { defineComponent, markRaw } from 'vue';
import { RequestError } from '@/globals/requester';
import { ApiErrorCode } from '@/stores/api/@codes';
import formatAmount from '@/utils/formatAmount';
import apiEstimates from '@/stores/api/estimates';
import SwitchHero from '@/themes/default/components/SwitchHero';
import FormField from '@/themes/default/components/FormField';
import { VerticalFormKey } from '@/themes/default/components/@constants';
import Button from '@/themes/default/components/Button';

import type Day from '@/utils/day';
import type { PropType, Raw } from 'vue';
import type { Simplify } from 'type-fest';
import type { Settings } from '@/stores/api/settings';
import type { InvoiceDetails } from '@/stores/api/invoices';
import type { Options } from '@/themes/default/components/Select';
import type { Choices } from '@/themes/default/components/SwitchHero';
import type { EstimateDetails, EstimateInvoiceCreate } from '@/stores/api/estimates';

type Props = {
    /** Le devis pour lequel on souhaite créer une facture. */
    estimate: EstimateDetails,

    /**
     * Fonction appelée à la fermeture de la modale.
     *
     * @param invoice - La facture créée si l'utilisateur a
     *                  été au bout de la création.
     */
    onClose?(invoice?: InvoiceDetails): void,
};

/** Type de facture liée au devis. */
enum InvoiceType {
    /** Facture d'acompte. */
    PREPAYMENT = 'prepayment',

    /** Facture de solde (ou facture directe si aucun acompte précédent). */
    BALANCE = 'balance',
}

type EditData = Simplify<(
    & Omit<Required<EstimateInvoiceCreate>, 'amount'>
    & { amount: Raw<Decimal> | null }
)>;

type Data = {
    type: InvoiceType,
    data: EditData,
    percentage: Raw<Decimal> | null,
    isSaving: boolean,
    validationErrors: Record<string, string> | null,
};

/** Modale de création d'une facture à partir d'un devis. */
const EstimateCreateInvoiceModal = defineComponent({
    name: 'EstimateCreateInvoiceModal',
    modal: {
        width: 600,
        dismissible: false,
    },
    provide: {
        [VerticalFormKey as symbol]: true,
    },
    props: {
        estimate: {
            type: Object as PropType<Props['estimate']>,
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
        const { estimate } = this;
        const settings = this.$store.state.settings as Settings;

        const data: EditData = {
            amount: null,
            lang: estimate.lang,
            due_date: null,
            order_number: null,
            special_mentions: settings.invoices?.specialMentions ?? null,
        };

        return {
            data,
            percentage: null,
            type: InvoiceType.BALANCE,
            isSaving: false,
            validationErrors: null,
        };
    },
    computed: {
        isBuyerPublicEntity(): boolean {
            const { buyer } = this.estimate;
            if (buyer.company === null) {
                return false;
            }
            return buyer.company?.is_public_entity ?? false;
        },

        remainingAmount(): Decimal {
            const { estimate } = this;
            const billedTotal = estimate.related_invoices.reduce(
                (carry: Decimal, invoice) => (
                    invoice.is_credit_note
                        ? carry.minus(invoice.total_with_taxes)
                        : carry.plus(invoice.total_with_taxes)
                ),
                new Decimal(0),
            );
            return estimate.total_with_taxes.minus(billedTotal);
        },

        canCreatePrepayment(): boolean {
            const { estimate, remainingAmount, isBuyerPublicEntity } = this;

            // - On ne peut pas créer de facture d'acompte pour une entité publique.
            if (isBuyerPublicEntity) {
                return false;
            }

            // - Pas d'acompte pour un devis à zéro ou négatif.
            if (estimate.total_with_taxes.lessThanOrEqualTo(0)) {
                return false;
            }

            // - Pas d'acompte pour un devis qui a déjà eu une facture "finale" (annulée ou non).
            if (estimate.has_final_invoice) {
                return false;
            }

            // - Pas d'acompte s'il ne reste rien à facturer.
            return remainingAmount.greaterThan(0);
        },

        hasPrepayments(): boolean {
            return this.estimate.related_invoices.some(
                (invoice) => invoice.is_prepayment,
            );
        },

        maxPrepaymentPercentage(): Decimal {
            const { estimate, remainingAmount } = this;

            const total = estimate.total_with_taxes;
            if (total.isZero()) {
                return new Decimal(100);
            }

            const percentage = remainingAmount.dividedBy(total).times(100)
                .toDecimalPlaces(4, Decimal.ROUND_DOWN);

            return Decimal.min(percentage, 100);
        },

        amount(): Decimal | null {
            if (this.type !== InvoiceType.PREPAYMENT) {
                return null;
            }
            return this.data.amount ?? new Decimal(0);
        },

        typeChoices(): Choices | null {
            if (!this.canCreatePrepayment) {
                return null;
            }

            const { __, estimate, hasPrepayments, remainingAmount } = this;
            return [
                {
                    value: InvoiceType.PREPAYMENT,
                    icon: 'hand-holding-usd',
                    title: __('type-choice.prepayment.title'),
                    description: __('type-choice.prepayment.description'),
                },
                {
                    value: InvoiceType.BALANCE,
                    icon: 'file-invoice-dollar',
                    title: (
                        !hasPrepayments
                            ? __('type-choice.direct.title')
                            : __('type-choice.balance.title')
                    ),
                    description: (
                        !hasPrepayments
                            ? __('type-choice.direct.description')
                            : __('type-choice.balance.description', {
                                amount: formatAmount(remainingAmount, estimate.currency),
                            })
                    ),
                },
            ];
        },

        langOptions(): Options<'fr' | 'en'> {
            const { __ } = this;
            return [
                { label: __('fields.lang.options.fr'), value: 'fr' },
                { label: __('fields.lang.options.en'), value: 'en' },
            ];
        },
    },
    watch: {
        type(newType: InvoiceType) {
            this.data.amount = newType === InvoiceType.PREPAYMENT
                ? markRaw(this.remainingAmount)
                : null;

            this.percentage = newType === InvoiceType.PREPAYMENT
                ? this.maxPrepaymentPercentage
                : null;
        },
    },
    methods: {
        // ------------------------------------------------------
        // -
        // -    Handlers
        // -
        // ------------------------------------------------------

        handleSubmit(e: Event) {
            e?.preventDefault();

            this.save();
        },

        handleClose() {
            this.$emit('close', undefined);
        },

        handleInputAmount(rawValue: string) {
            if (this.type !== InvoiceType.PREPAYMENT) {
                return;
            }

            // - Si la valeur n'est pas (encore) un nombre valide, on ne fait rien.
            //   (l'événement `onChange` se chargera de remettre le champ en ordre
            //    si jamais le blur est atteint sans correction de l'entrée)
            if (!/^\d+(?:\.\d+)?$/.test(rawValue)) {
                return;
            }

            const amount = new Decimal(rawValue)
                .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

            this.data.amount = markRaw(
                Decimal.min(Decimal.max(amount, 0), this.remainingAmount),
            );

            const total = this.estimate.total_with_taxes;
            this.percentage = total.isZero()
                ? markRaw(new Decimal(0))
                : markRaw(
                    amount
                        .dividedBy(total).times(100)
                        .toDecimalPlaces(4, Decimal.ROUND_DOWN),
                );
        },

        handleChangeAmount(rawValue: string) {
            if (this.type !== InvoiceType.PREPAYMENT) {
                return;
            }

            rawValue = rawValue.trim().replaceAll(',', '.');
            rawValue = rawValue.endsWith('.') ? `${rawValue}0` : rawValue;
            if (!/^\d+(?:\.\d+)?$/.test(rawValue)) {
                rawValue = '0';
            }

            const amount = new Decimal(rawValue)
                .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

            this.data.amount = markRaw(
                Decimal.min(Decimal.max(amount, 0), this.remainingAmount),
            );

            const total = this.estimate.total_with_taxes;
            this.percentage = total.isZero()
                ? markRaw(new Decimal(0))
                : markRaw(
                    amount
                        .dividedBy(total).times(100)
                        .toDecimalPlaces(4, Decimal.ROUND_DOWN),
                );
        },

        handleInputPercentage(rawValue: string) {
            if (this.type !== InvoiceType.PREPAYMENT) {
                return;
            }

            // - Si la valeur n'est pas (encore) un nombre valide, on ne fait rien.
            //   (l'événement `onChange` se chargera de remettre le champ en ordre
            //    si jamais le blur est atteint sans correction de l'entrée)
            if (!/^\d+(?:\.\d+)?$/.test(rawValue)) {
                return;
            }

            const percentage = Decimal.min(
                Decimal.max(new Decimal(rawValue), 0),
                this.maxPrepaymentPercentage,
            );
            const amount = this.estimate.total_with_taxes
                .times(percentage)
                .dividedBy(100)
                .toDecimalPlaces(2);

            this.data.amount = markRaw(
                Decimal.min(Decimal.max(amount, 0), this.remainingAmount),
            );
        },

        handleChangePercentage(rawValue: string) {
            if (this.type !== InvoiceType.PREPAYMENT) {
                return;
            }

            rawValue = rawValue.trim().replaceAll(',', '.');
            rawValue = rawValue.endsWith('.') ? `${rawValue}0` : rawValue;
            if (!/^\d+(?:\.\d+)?$/.test(rawValue)) {
                rawValue = '0';
            }

            const percentage = Decimal.min(
                Decimal.max(new Decimal(rawValue), 0),
                this.maxPrepaymentPercentage,
            );
            this.percentage = markRaw(percentage);

            const amount = this.estimate.total_with_taxes
                .times(percentage)
                .dividedBy(100)
                .toDecimalPlaces(2);

            this.data.amount = markRaw(
                Decimal.min(Decimal.max(amount, 0), this.remainingAmount),
            );
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
            const { __, estimate, type, data: rawData, remainingAmount } = this;

            const data: EstimateInvoiceCreate = (() => {
                let amount: Raw<Decimal> | undefined;
                if (type === InvoiceType.PREPAYMENT) {
                    // - Si le montant est plus grand ou égal au reste à facturer,
                    //   on génère une facture de solde plutôt qu'un acompte.
                    amount = !rawData.amount?.greaterThanOrEqualTo(remainingAmount)
                        ? new Decimal(rawData.amount ?? 0)
                        : undefined;
                }

                return {
                    amount,
                    lang: rawData.lang,
                    due_date: rawData.due_date,
                    order_number: rawData.order_number,
                    special_mentions: rawData.special_mentions,
                };
            })();

            // - Les factures issues d'un devis (acompte comme solde) sont créées
            //   directement finalisées : le devis a déjà servi de "brouillon".
            //   On en informe l'utilisateur et on lui demande confirmation avant de continuer.
            const isPrepayment = data.amount !== undefined;
            const isConfirmed = await confirm({
                type: 'warning',
                text: (
                    isPrepayment
                        ? __('confirm-no-draft.prepayment')
                        : __('confirm-no-draft.balance')
                ),
            });
            if (!isConfirmed) {
                return;
            }
            this.isSaving = true;

            try {
                const invoice = await apiEstimates.createInvoice(estimate.id, data);

                this.$toasted.success(__('created'));
                this.$emit('close', invoice);
            } catch (error) {
                this.isSaving = false;

                if (error instanceof RequestError && error.code === ApiErrorCode.VALIDATION_FAILED) {
                    this.validationErrors = { ...error.details };
                    return;
                }

                // eslint-disable-next-line no-console
                console.error(`Error occurred while creating the invoice`, error);
                this.$toasted.error(__('global.errors.unexpected-while-creating'));
            }
        },

        __(key: string, params?: Record<string, number | string>, count?: number): string {
            key = !key.startsWith('global.')
                ? `modal.estimate-details.modals.create-invoice.${key}`
                : key.replace(/^global\./, '');

            return this.$t(key, params, count);
        },
    },
    render() {
        const { paymentTermDays } = config.invoices;
        const { currency } = this.estimate;
        const {
            __,
            type,
            data,
            typeChoices,
            percentage,
            amount,
            langOptions,
            remainingAmount,
            maxPrepaymentPercentage,
            estimate,
            isSaving,
            canCreatePrepayment,
            validationErrors,
            handleSubmit,
            handleClose,
            handleInputAmount,
            handleChangeAmount,
            handleInputPercentage,
            handleChangePercentage,
        } = this;

        return (
            <div class="EstimateCreateInvoiceModal">
                <header class="EstimateCreateInvoiceModal__header">
                    <h2 class="EstimateCreateInvoiceModal__header__title">
                        {((): string => {
                            if (!('number' in estimate) || estimate.number === undefined) {
                                const displayDate = estimate.date ?? estimate.created_at;
                                return __('title.without-number', {
                                    date: displayDate.format('L'),
                                    hour: displayDate.format('HH:mm'),
                                });
                            }
                            return __('title.with-number', { number: estimate.number });
                        })()}
                    </h2>
                    <Button
                        type="close"
                        class="EstimateCreateInvoiceModal__header__close-button"
                        onClick={handleClose}
                    />
                </header>
                <div class="EstimateCreateInvoiceModal__body">
                    <form class="EstimateCreateInvoiceModal__form" onSubmit={handleSubmit}>
                        {(canCreatePrepayment && typeChoices !== null) && (
                            <SwitchHero
                                size="large"
                                class="EstimateCreateInvoiceModal__type"
                                choices={typeChoices}
                                value={type}
                                onChange={(value: InvoiceType) => {
                                    this.type = value;
                                }}
                            />
                        )}
                        {type === InvoiceType.PREPAYMENT && (
                            <div class="EstimateCreateInvoiceModal__prepayment">
                                <FormField
                                    class="EstimateCreateInvoiceModal__prepayment__percentage"
                                    type="number"
                                    label={__('fields.percentage.label')}
                                    help={__('fields.percentage.help', {
                                        max: maxPrepaymentPercentage.toNumber(),
                                    })}
                                    value={percentage!.toNumber()}
                                    step={0.0001}
                                    min={0.01}
                                    max={maxPrepaymentPercentage.toNumber()}
                                    addon="%"
                                    onInput={handleInputPercentage}
                                    onChange={handleChangePercentage}
                                />
                                <FormField
                                    class="EstimateCreateInvoiceModal__prepayment__amount"
                                    type="number"
                                    label={__('fields.amount.label')}
                                    help={__('fields.amount.help', {
                                        max: formatAmount(remainingAmount, currency),
                                    })}
                                    value={amount!.toNumber()}
                                    step={0.01}
                                    min={0.01}
                                    max={remainingAmount.toNumber()}
                                    error={validationErrors?.amount}
                                    addon={currency.symbol}
                                    onInput={handleInputAmount}
                                    onChange={handleChangeAmount}
                                />
                            </div>
                        )}
                        <FormField
                            label={__('fields.order-number')}
                            value={data.order_number}
                            error={validationErrors?.order_number}
                            onInput={(value: string) => {
                                data.order_number = value;
                            }}
                        />
                        <FormField
                            type="select"
                            label={__('fields.lang.label')}
                            value={data.lang}
                            options={langOptions}
                            error={validationErrors?.lang}
                            placeholder={false}
                            onChange={(value: string) => {
                                data.lang = value;
                            }}
                            required
                        />
                        <FormField
                            type="date"
                            label={__('fields.due-date.label')}
                            value={data.due_date}
                            placeholder={(
                                paymentTermDays <= 0
                                    ? __('fields.due-date.placeholder.immediately')
                                    : __(
                                        'fields.due-date.placeholder.with-delay',
                                        { days: paymentTermDays },
                                        paymentTermDays,
                                    )
                            )}
                            minDate="now"
                            error={validationErrors?.due_date}
                            onInput={(value: Day | null) => {
                                data.due_date = value;
                            }}
                            clearable
                        />
                        <FormField
                            type="textarea"
                            label={__('fields.special-mentions')}
                            value={data.special_mentions}
                            error={validationErrors?.special_mentions}
                            rows={3}
                            onInput={(value: string) => {
                                data.special_mentions = value;
                            }}
                        />
                    </form>
                </div>
                <div class="EstimateCreateInvoiceModal__footer">
                    <Button type="primary" onClick={handleSubmit} loading={isSaving}>
                        {isSaving ? __('global.saving') : __('action')}
                    </Button>
                    <Button onClick={handleClose}>
                        {__('global.cancel')}
                    </Button>
                </div>
            </div>
        );
    },
});

export default EstimateCreateInvoiceModal;
