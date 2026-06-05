import './index.scss';
import Decimal from 'decimal.js';
import DateTime from '@/utils/datetime';
import { confirm } from '@/utils/alert';
import { Group } from '@/stores/api/groups';
import { defineComponent, markRaw } from 'vue';
import formatAmount from '@/utils/formatAmount';
import TaxRegime from '@/utils/invoicing/tax-regime';
import BillingFormat from '@/stores/api/@enums/billing-format';
import apiInvoices, { InvoiceStatus } from '@/stores/api/invoices';
import CriticalError from '@/themes/default/components/CriticalError';
import StatusBadge from '@/themes/default/components/BadgeStatus/Invoice';
import EstimateStatusBadge from '@/themes/default/components/BadgeStatus/Estimate';
import BadgeSelect, { Type as BadgeType } from '@/themes/default/components/BadgeSelect';
import ButtonDropdown from '@/themes/default/components/ButtonDropdown';
import Dropdown from '@/themes/default/components/Dropdown';
import Loading from '@/themes/default/components/Loading';
import Button from '@/themes/default/components/Button';
import Pdf from '@/themes/default/components/Pdf';

// - Modales
import AddPaymentModal from './modals/AddPayment';

import type { ComponentRef, PropType, Raw } from 'vue';
import type { EstimateExcerpt } from '@/stores/api/estimates';
import type { Options } from '@/themes/default/components/BadgeSelect';
import type {
    InvoiceTax,
    InvoiceExcerpt,
    InvoiceDetails,
    InvoicePayment,
} from '@/stores/api/invoices';

type Props = {
    /** Identifiant de la facture dont on veut afficher les détails. */
    id: InvoiceDetails['id'],

    /**
     * Fonction appelée lorsque la facture liée
     * à l'id passé a été mis à jour.
     *
     * @param invoice - La facture, mis à jour.
     */
    onUpdated?(invoice: InvoiceDetails): void,

    /**
     * Fonction appelée lorsqu'un avoir a été créé depuis cette facture.
     *
     * @param creditNote - L'avoir créé.
     */
    onCreditNoteCreated?(creditNote: InvoiceDetails): void,

    /**
     * Fonction appelée lorsqu'il y a eu des changements.
     *
     * Cet événement est levé pour toute mise à jour,
     * suppression ou création de facture liées.
     */
    onChange?(): void,

    /**
     * Fonction appelée lorsqu'on souhaite ouvrir une autre entité.
     *
     * @param kind - L'entité à ouvrir.
     * @param id - L'identifiant de l'entité à ouvrir.
     */
    onRequestOpen?(kind: 'estimate' | 'invoice', id: number): void,

    /**
     * Fonction appelée lorsque la facture a été supprimée.
     */
    onDeleted?(): void,

    /** Fonction appelée lorsque la modale est fermée. */
    onClose?(): void,
};

type InstanceProperties = {
    nowTimer: ReturnType<typeof setInterval> | undefined,
};

type Data = {
    now: Raw<DateTime>,
    invoice: InvoiceDetails | null,
    newStatus: InvoiceStatus | null,
    hasCriticalError: boolean,
    isFetched: boolean,
    isDeleting: boolean,
    isPreviewReady: boolean,
    isFinalizing: boolean,
};

/** Modale de détails d'une facture. */
const InvoiceDetailsModal = defineComponent({
    name: 'InvoiceDetailsModal',
    modal: {
        width: '100%',
        height: '100%',
    },
    props: {
        id: {
            type: Number as PropType<Required<Props>['id']>,
            required: true,
        },
        onUpdated: {
            type: Function as PropType<Props['onUpdated']>,
            default: undefined,
        },
        onCreditNoteCreated: {
            type: Function as PropType<Props['onCreditNoteCreated']>,
            default: undefined,
        },
        onChange: {
            type: Function as PropType<Props['onChange']>,
            default: undefined,
        },
        onRequestOpen: {
            type: Function as PropType<Props['onRequestOpen']>,
            default: undefined,
        },
        onDeleted: {
            type: Function as PropType<Props['onDeleted']>,
            default: undefined,
        },
        onClose: {
            type: Function as PropType<Props['onClose']>,
            default: undefined,
        },
    },
    emits: ['close'],
    setup: (): InstanceProperties => ({
        nowTimer: undefined,
    }),
    data: (): Data => ({
        invoice: null,
        newStatus: null,
        isFetched: false,
        isDeleting: false,
        isPreviewReady: false,
        isFinalizing: false,
        hasCriticalError: false,
        now: markRaw(DateTime.now()),
    }),
    computed: {
        isTeamMember(): boolean {
            return this.$store.getters['auth/is']([
                Group.ADMINISTRATION,
                Group.SUPERVISION,
                Group.OPERATION,
            ]);
        },

        isSaving(): boolean {
            return this.newStatus !== null;
        },

        isCreditNote(): boolean {
            if (!this.isFetched || this.invoice === null) {
                return false;
            }
            return this.invoice.is_credit_note;
        },

        isDraft(): boolean {
            if (!this.isFetched || this.invoice === null) {
                return false;
            }
            return this.invoice.status === InvoiceStatus.DRAFT;
        },

        isObsolete(): boolean {
            if (!this.isFetched || this.invoice === null) {
                return false;
            }
            return this.invoice.status === InvoiceStatus.OBSOLETE;
        },

        isDeletable(): boolean {
            if (this.invoice === null || !this.isTeamMember) {
                return false;
            }
            return this.isDraft || this.isObsolete;
        },

        canFinalize(): boolean {
            // - Un brouillon devenu obsolète (date d'échéance fixe dépassée)
            //   ne peut plus être finalisé.
            return this.isTeamMember && this.isDraft && !this.isObsolete;
        },

        isOverdue(): boolean {
            if (!this.isFetched || this.invoice === null) {
                return false;
            }
            const { due_date: dueDate, due_delay: dueDelay, date } = this.invoice;

            const today = this.now.toDay();
            if (dueDate !== null) {
                return dueDate.isBefore(today);
            }

            if (dueDelay !== null && date !== undefined) {
                const expiryDate = date.toDay().addDay(dueDelay);
                return expiryDate.isBefore(today);
            }

            return false;
        },

        isStatusEditable(): boolean {
            if (!this.isFetched || this.invoice === null || !this.isTeamMember) {
                return false;
            }

            // - Sur un brouillon, le statut n'est pas modifiable manuellement :
            //   Le passage à "en attente" se fait uniquement via la finalisation.
            if (this.isDraft || this.isObsolete) {
                return false;
            }

            const fixedStatuses = [
                InvoiceStatus.CANCELLED,
                InvoiceStatus.PAID,
            ];
            return !fixedStatuses.includes(this.invoice.status);
        },

        isRefundContext(): boolean {
            if (!this.isFetched || this.invoice === null) {
                return false;
            }
            const { invoice } = this;

            return (
                invoice.is_credit_note ||
                invoice.total_with_taxes.isNegative()
            );
        },

        status(): InvoiceStatus | null {
            if (!this.isStatusEditable) {
                return this.invoice?.status ?? null;
            }

            if (this.newStatus !== null) {
                if (this.newStatus === InvoiceStatus.SENT && this.isOverdue) {
                    return InvoiceStatus.OVERDUE;
                }
                return this.newStatus;
            }
            return this.invoice?.status ?? null;
        },

        totalTaxes(): Decimal | null {
            if (!this.isFetched || this.invoice === null) {
                return null;
            }

            const { invoice } = this;
            if (invoice.format === BillingFormat.V1 || invoice.format === BillingFormat.V2) {
                return invoice.total_taxes.reduce(
                    (acc, tax) => acc.plus(tax.total),
                    new Decimal(0),
                );
            }

            const { global_tax_regime: globalTaxRegime, total_taxes: totalTaxes } = (
                invoice as Exclude<InvoiceDetails, { format: BillingFormat.V1 | BillingFormat.V2 }>
            );

            if (globalTaxRegime !== null) {
                return new Decimal(0);
            }

            return totalTaxes!.reduce(
                (total: Decimal, tax: InvoiceTax) => {
                    if (tax.type !== TaxRegime.STANDARD) {
                        return total;
                    }
                    return total.plus(tax.total);
                },
                new Decimal(0),
            );
        },

        showDetailedTotals(): boolean {
            if (!this.isFetched || this.invoice === null) {
                return false;
            }

            return (
                this.invoice.global_tax_regime === null &&
                (this.invoice.total_taxes ?? []).length > 0
            );
        },

        parentEstimate(): EstimateExcerpt | null {
            if (!this.isFetched || this.invoice === null) {
                return null;
            }
            return this.invoice.parent_estimate;
        },

        parentInvoice(): InvoiceExcerpt | null {
            if (!this.isFetched || this.invoice === null) {
                return null;
            }
            return this.invoice.parent_invoice;
        },

        childInvoice(): InvoiceExcerpt | null {
            if (!this.isFetched || this.invoice === null) {
                return null;
            }
            return this.invoice.child_invoice;
        },

        prepaymentInvoices(): InvoiceExcerpt[] {
            if (!this.isFetched || this.invoice === null) {
                return [];
            }

            return this.invoice.is_prepayment_final
                ? this.invoice.prepayment_invoices
                : [];
        },

        statusOptions(): Options<InvoiceStatus> {
            const hasPayments = (this.invoice?.payments.length ?? 0) > 0;
            const {
                __,
                invoice,
                status,
                isCreditNote,
                isRefundContext,
                canRecordPayments,
            } = this;
            const ___ = (_status: string): string => (
                isCreditNote
                    ? __(`global.credit-note-status.${_status}`)
                    : __(`global.invoice-status.${_status}`)
            );

            return [
                {
                    label: ___('pending'),
                    value: InvoiceStatus.PENDING,
                    type: BadgeType.WARNING,
                    selectable: !hasPayments,
                },
                {
                    label: ___('sent'),
                    value: InvoiceStatus.SENT,
                    type: BadgeType.INFO,
                    selectable: !hasPayments && (
                        status !== InvoiceStatus.OVERDUE
                    ),
                },
                {
                    label: ___('overdue'),
                    value: InvoiceStatus.OVERDUE,
                    type: BadgeType.DANGER,
                    selectable: false,
                },
                {
                    label: ___('partially-paid'),
                    value: InvoiceStatus.PARTIALLY_PAID,
                    type: (
                        invoice?.is_overdue
                            ? BadgeType.DANGER
                            : BadgeType.WARNING
                    ),
                    selectable: false,
                },
                {
                    label: (
                        isRefundContext && !isCreditNote
                            ? ___('refunded')
                            : ___('paid')
                    ),
                    value: InvoiceStatus.PAID,
                    type: BadgeType.SUCCESS,
                    selectable: canRecordPayments,
                },
                {
                    label: ___('cancelled'),
                    value: InvoiceStatus.CANCELLED,
                    type: BadgeType.DANGER,
                    selectable: false,
                },
            ];
        },

        canCreateCreditNote(): boolean {
            if (!this.isFetched || this.invoice === null || !this.isTeamMember) {
                return false;
            }
            const { invoice } = this;
            const { buyer } = invoice;

            // - Pas d'avoir sur un brouillon.
            if (this.isDraft || this.isObsolete) {
                return false;
            }

            // - Pas d'avoir sur une facture "legacy".
            if ([BillingFormat.V1, BillingFormat.V2].includes(invoice.format)) {
                return false;
            }

            // - Pas d'avoir pour une facture déjà annulée.
            if (invoice.is_cancelled) {
                return false;
            }

            // - Pas d'avoir si la facture est déjà un avoir ou est négative.
            if (invoice.is_credit_note || invoice.total_with_taxes.isNegative()) {
                return false;
            }

            // - Pas d'avoir si le bénéficiaire n'est pas facturable.
            if (buyer.is_deleted || !buyer.is_invoiceable) {
                return false;
            }

            // - On ne peut pas créer un avoir d'une facture d'acompte
            //   pour lequel le devis a eu une facture finale.
            return (
                !invoice.is_prepayment ||
                !invoice.parent_estimate?.has_final_invoice
            );
        },

        canOpenModal(): boolean {
            const { onRequestOpen } = this.$props;
            return this.isTeamMember && onRequestOpen !== undefined;
        },

        totalPaid(): Decimal {
            if (!this.isFetched || this.invoice === null) {
                return new Decimal(0);
            }

            const { payments } = this.invoice;
            if (payments.length <= 0) {
                return new Decimal(0);
            }

            return payments.reduce(
                (total: Decimal, payment: InvoicePayment) => (
                    total.plus(payment.amount)
                ),
                new Decimal(0),
            );
        },

        remainingAmount(): Decimal {
            if (!this.isFetched || this.invoice === null) {
                return new Decimal(0);
            }
            const { invoice, totalPaid } = this;

            const remaining = invoice.total_with_taxes.abs().minus(totalPaid);
            return Decimal.max(0, remaining);
        },

        cancelledPaymentIds(): Set<InvoicePayment['id']> {
            const cancelled = new Set<InvoicePayment['id']>();
            if (!this.isFetched || this.invoice === null) {
                return cancelled;
            }

            // - Chaque paiement négatif est associé au premier paiement positif
            //   de même montant qui le précède et qui n'a pas déjà été lié,
            //   marquant ce dernier comme annulé.
            const sorted = [...this.invoice.payments].sort(
                (a: InvoicePayment, b: InvoicePayment) => {
                    if (a.date.isBefore(b.date)) {
                        return -1;
                    }
                    if (a.date.isAfter(b.date)) {
                        return 1;
                    }
                    return a.id - b.id;
                },
            );

            const activePayments: InvoicePayment[] = [];
            sorted.forEach((payment: InvoicePayment) => {
                if (!payment.amount.isNegative()) {
                    if (!payment.amount.isZero()) {
                        activePayments.push(payment);
                    }
                    return;
                }

                const targetAmount = payment.amount.neg();
                const targetIndex = activePayments.findIndex(
                    (activePayment: InvoicePayment) => (
                        activePayment.amount.equals(targetAmount)
                    ),
                );
                if (targetIndex !== -1) {
                    cancelled.add(activePayments[targetIndex].id);
                    activePayments.splice(targetIndex, 1);
                }
            });

            return cancelled;
        },

        canRecordPayments(): boolean {
            if (!this.isFetched || this.invoice === null || !this.isTeamMember) {
                return false;
            }
            const { invoice } = this;

            // - Pas de paiement sur un brouillon.
            if (this.isDraft || this.isObsolete) {
                return false;
            }

            // - Pas de paiement sur les factures "legacy".
            if (invoice.format === BillingFormat.V1 || invoice.format === BillingFormat.V2) {
                return false;
            }

            // - Pas de paiement sur une facture annulée.
            if (invoice.is_cancelled) {
                return false;
            }

            // - Seules les factures envoyées acceptent des paiements.
            const allowedStatuses: InvoiceStatus[] = [
                InvoiceStatus.SENT,
                InvoiceStatus.OVERDUE,
                InvoiceStatus.PARTIALLY_PAID,
            ];
            return allowedStatuses.includes(invoice.status);
        },

        canCancelPayments(): boolean {
            if (!this.isFetched || this.invoice === null || !this.isTeamMember) {
                return false;
            }
            const { invoice } = this;

            // - Pas d'annulation sur les factures "legacy".
            if (invoice.format === BillingFormat.V1 || invoice.format === BillingFormat.V2) {
                return false;
            }

            // - Pas d'annulation sur une facture annulée.
            if (invoice.is_cancelled) {
                return false;
            }

            // - Contrairement à l'enregistrement, on autorise l'annulation
            //   d'un paiement même lorsque la facture est entièrement payée.
            const allowedStatuses: InvoiceStatus[] = [
                InvoiceStatus.SENT,
                InvoiceStatus.OVERDUE,
                InvoiceStatus.PARTIALLY_PAID,
                InvoiceStatus.PAID,
            ];
            return allowedStatuses.includes(invoice.status);
        },
    },
    watch: {
        isStatusEditable(isStatusEditable: boolean) {
            if (!isStatusEditable) {
                this.newStatus = null;
            }
        },
    },
    mounted() {
        // - Actualise le timestamp courant toutes les minutes.
        this.nowTimer = setInterval(() => { this.now = markRaw(DateTime.now()); }, 60_000);

        this.fetchData();
    },
    beforeDestroy() {
        if (this.nowTimer) {
            clearInterval(this.nowTimer);
        }
    },
    methods: {
        // ------------------------------------------------------
        // -
        // -    Handlers
        // -
        // ------------------------------------------------------

        async handleStatusChange(newStatus: InvoiceStatus) {
            const { __, invoice, isStatusEditable, isSaving } = this;
            if (invoice === null || !isStatusEditable || isSaving) {
                return;
            }

            // - Le statut "payée" / "remboursée" étant dérivé automatiquement
            //   des paiements, sélectionner cette option enregistre directement
            //   un paiement (ou remboursement) couvrant le reliquat.
            if (newStatus === InvoiceStatus.PAID) {
                await this.handleSettlePayment();
                return;
            }

            this.newStatus = newStatus;

            try {
                this.invoice = await apiInvoices.updateStatus(invoice.id, newStatus);

                const { onUpdated, onChange } = this.$props;
                onUpdated?.(this.invoice);
                onChange?.();
            } catch (error) {
                // eslint-disable-next-line no-console
                console.error(`Error occurred while updating an invoice status`, error);
                this.$toasted.error(__('global.errors.unexpected-while-saving'));
            } finally {
                this.newStatus = null;
            }
        },

        async handleFinalize() {
            const { __, invoice, canFinalize, isFinalizing } = this;
            if (invoice === null || !canFinalize || isFinalizing) {
                return;
            }

            const isConfirmed = await confirm({
                type: 'warning',
                text: __('confirm-finalize'),
                confirmButtonText: __('actions.finalize'),
            });
            if (!isConfirmed) {
                return;
            }

            this.isFinalizing = true;
            try {
                this.invoice = await apiInvoices.finalize(invoice.id);

                // - On actualise la preview.
                const $preview = this.$refs.preview as ComponentRef<typeof Pdf>;
                $preview?.refresh();

                const { onUpdated, onChange } = this.$props;
                onUpdated?.(this.invoice);
                onChange?.();
            } catch {
                this.$toasted.error(__('global.errors.unexpected-while-saving'));
            } finally {
                this.isFinalizing = false;
            }
        },

        async handleSettlePayment() {
            if (this.invoice === null || !this.canRecordPayments) {
                return;
            }

            const { __, invoice, remainingAmount, isRefundContext } = this;
            const ___ = (key: string, params?: Record<string, number | string>): string => (
                isRefundContext ? __(`refunds.${key}`, params) : __(`payments.${key}`, params)
            );

            const isConfirmed = await confirm({
                type: 'warning',
                text: ___('settle.confirm', {
                    amount: formatAmount(remainingAmount, invoice.currency),
                }),
                confirmButtonText: ___('settle.label'),
            });
            if (!isConfirmed) {
                return;
            }

            this.newStatus = InvoiceStatus.PAID;

            try {
                await apiInvoices.addPayment(invoice.id, {
                    amount: remainingAmount,
                });

                // - Actualise la facture courante.
                await this.fetchData();

                const { onUpdated, onChange } = this.$props;
                onUpdated?.(this.invoice);
                onChange?.();
            } catch (error) {
                // eslint-disable-next-line no-console
                console.error(`Error occurred while saving a payment`, error);
                this.$toasted.error(___('settle.error'));
            } finally {
                this.newStatus = null;
            }
        },

        async handleCreateCreditNote() {
            if (!this.canCreateCreditNote) {
                return;
            }

            const { __ } = this;
            const isConfirmed = await confirm({
                type: 'warning',
                text: __('confirm-create-credit-note'),
            });
            if (!isConfirmed) {
                return;
            }

            try {
                const creditNote = await apiInvoices.createCreditNote(this.invoice!.id);

                // - Actualise la facture courante.
                await this.fetchData();

                const {
                    onChange,
                    onRequestOpen,
                    onCreditNoteCreated,
                } = this.$props;

                onCreditNoteCreated?.(creditNote);
                onChange?.();

                // - Délègue l'ouverture de l'avoir créé au parent.
                if (this.canOpenModal && onRequestOpen !== undefined) {
                    onRequestOpen('invoice', creditNote.id);
                    this.$emit('close');
                }
            } catch (error) {
                // eslint-disable-next-line no-console
                console.error(`Error occurred while saving the credit note`, error);
                this.$toasted.error(__('global.errors.unexpected-while-saving'));
            }
        },

        handleShowParentEstimate() {
            const { parentEstimate } = this;
            if (parentEstimate === null || !this.canOpenModal) {
                return;
            }

            const { onRequestOpen } = this.$props;
            if (onRequestOpen === undefined) {
                return;
            }

            onRequestOpen('estimate', parentEstimate.id);
            this.$emit('close');
        },

        handleShowParentInvoice() {
            const { parentInvoice } = this;
            if (parentInvoice === null || !this.canOpenModal) {
                return;
            }

            const { onRequestOpen } = this.$props;
            if (onRequestOpen === undefined) {
                return;
            }

            onRequestOpen('invoice', parentInvoice.id);
            this.$emit('close');
        },

        handleShowChildInvoice() {
            const { childInvoice } = this;
            if (childInvoice === null || !this.canOpenModal) {
                return;
            }

            const { onRequestOpen } = this.$props;
            if (onRequestOpen === undefined) {
                return;
            }

            onRequestOpen('invoice', childInvoice.id);
            this.$emit('close');
        },

        handleShowPrepaymentInvoice(id: InvoiceExcerpt['id']) {
            if (!this.canOpenModal) {
                return;
            }

            const { onRequestOpen } = this.$props;
            if (onRequestOpen === undefined) {
                return;
            }

            onRequestOpen('invoice', id);
            this.$emit('close');
        },

        async handleDelete() {
            const { __, invoice, isDeletable, isDeleting } = this;
            if (invoice === null || !isDeletable || isDeleting) {
                return;
            }

            const isConfirmed = await confirm({
                type: 'danger',
                text: __('confirm-delete'),
                confirmButtonText: __('global.yes-delete'),
            });
            if (!isConfirmed) {
                return;
            }

            this.isDeleting = true;
            try {
                await apiInvoices.remove(invoice.id);

                this.$toasted.success(__('deleted'));

                const { onDeleted, onChange } = this.$props;
                onDeleted?.();
                onChange?.();

                this.$emit('close');
            } catch {
                this.$toasted.error(__('global.errors.unexpected-while-deleting'));
            } finally {
                this.isDeleting = false;
            }
        },

        handlePreviewReady() {
            this.isPreviewReady = true;
        },

        handleClose() {
            this.$emit('close');
        },

        async handleAddPayment() {
            if (this.invoice === null || !this.canRecordPayments) {
                return;
            }

            const payment = await this.$modal.show(AddPaymentModal, {
                invoice: this.invoice,
            });
            if (payment === undefined) {
                return;
            }

            // - Actualise la facture courante.
            await this.fetchData();

            const { onUpdated, onChange } = this.$props;
            onUpdated?.(this.invoice);
            onChange?.();
        },

        async handleCancelPayment(id: InvoicePayment['id']) {
            if (this.invoice === null || !this.canCancelPayments) {
                return;
            }

            const payment = this.invoice.payments.find(
                (_payment: InvoicePayment) => _payment.id === id,
            );
            if (payment === undefined || !this.canCancelPayment(payment)) {
                return;
            }

            const { __, isRefundContext } = this;
            const ___ = (key: string, params?: Record<string, number | string>): string => (
                isRefundContext ? __(`refunds.${key}`, params) : __(`payments.${key}`, params)
            );

            const isConfirmed = await confirm({
                type: 'warning',
                text: ___('cancel.confirm'),
                confirmButtonText: ___('cancel.label'),
            });
            if (!isConfirmed) {
                return;
            }

            try {
                await apiInvoices.addPayment(this.invoice.id, {
                    amount: payment.amount.neg(),
                });

                // - Actualise la facture courante.
                await this.fetchData();

                const { onUpdated, onChange } = this.$props;
                onUpdated?.(this.invoice);
                onChange?.();
            } catch (error) {
                // eslint-disable-next-line no-console
                console.error(`Error occurred while cancelling a payment`, error);
                this.$toasted.error(___('cancel.error'));
            }
        },

        // ------------------------------------------------------
        // -
        // -    Méthodes internes
        // -
        // ------------------------------------------------------

        canCancelPayment(payment: InvoicePayment): boolean {
            if (!this.canCancelPayments) {
                return false;
            }

            // - Une annulation de paiement (= montant négatif) ne peut
            //   pas elle-même être annulée.
            if (payment.amount.isNegative() || payment.amount.isZero()) {
                return false;
            }

            // - Un paiement déjà liés à une annulation existante ne
            //   peut pas être annulé une seconde fois.
            if (this.cancelledPaymentIds.has(payment.id)) {
                return false;
            }

            // - On ne peut pas annuler un paiement dont le montant excède
            //   ce qui reste à annuler (cas où le paiement a été partiellement
            //   annulé par une annulation manuelle d'un autre montant).
            return this.totalPaid.greaterThanOrEqualTo(payment.amount);
        },

        async fetchData() {
            try {
                this.invoice = await apiInvoices.one(this.id);
                this.isFetched = true;
            } catch (error) {
                // eslint-disable-next-line no-console
                console.error(`Error occurred while retrieving invoice details:`, error);
                this.hasCriticalError = true;
            }
        },

        __(key: string, params?: Record<string, number | string>, count?: number): string {
            key = !key.startsWith('global.')
                ? `modal.invoice-details.${key}`
                : key.replace(/^global\./, '');

            return this.$t(key, params, count);
        },
    },
    render() {
        const {
            __,
            status,
            invoice,
            parentEstimate,
            parentInvoice,
            childInvoice,
            prepaymentInvoices,
            totalTaxes,
            totalPaid,
            isSaving,
            isDraft,
            isFetched,
            isDeleting,
            isObsolete,
            isDeletable,
            isFinalizing,
            isCreditNote,
            isTeamMember,
            canOpenModal,
            canFinalize,
            canCreateCreditNote,
            canRecordPayments,
            canCancelPayment,
            isRefundContext,
            showDetailedTotals,
            remainingAmount,
            statusOptions,
            isStatusEditable,
            isPreviewReady,
            hasCriticalError,
            handleClose,
            handleDelete,
            handleAddPayment,
            handleFinalize,
            handlePreviewReady,
            handleStatusChange,
            handleCancelPayment,
            handleCreateCreditNote,
            handleShowChildInvoice,
            handleShowParentInvoice,
            handleShowParentEstimate,
            handleShowPrepaymentInvoice,
        } = this;

        if (hasCriticalError || !isFetched || !invoice) {
            return (
                <div class="InvoiceDetails InvoiceDetails--not-ready">
                    <div class="InvoiceDetails__body">
                        {(
                            !hasCriticalError
                                ? <Loading class="InvoiceDetails__loading" />
                                : <CriticalError />
                        )}
                    </div>
                    <aside class="InvoiceDetails__sidebar">
                        <header class="InvoiceDetails__header">
                            <Button
                                icon="times"
                                onClick={handleClose}
                                class="InvoiceDetails__header__close-button"
                            />
                        </header>
                    </aside>
                </div>
            );
        }

        const { buyer } = invoice;
        const buyerName = buyer.company
            ? buyer.company.legal_name
            : buyer.full_name;

        const renderMoreActions = (): JSX.Element | null => {
            const actions = [];

            if (canCreateCreditNote) {
                actions.push(
                    <Button
                        type="danger"
                        onClick={handleCreateCreditNote}
                    >
                        {__('actions.create-credit-note')}
                    </Button>,
                );
            }

            if (isDeletable) {
                actions.push(
                    <Button
                        type="delete"
                        icon="trash-alt"
                        loading={isDeleting}
                        onClick={handleDelete}
                    >
                        {__('actions.delete')}
                    </Button>,
                );
            }

            return actions.length > 0
                ? <Dropdown>{actions}</Dropdown>
                : null;
        };

        const renderPayments = (): JSX.Element | null => {
            const { payments } = invoice;
            if (!canRecordPayments && payments.length <= 0) {
                return null;
            }

            const ___ = (key: string, params?: Record<string, number | string>): string => (
                isRefundContext ? __(`refunds.${key}`, params) : __(`payments.${key}`, params)
            );

            return (
                <section class="InvoiceDetails__payments">
                    <div class="InvoiceDetails__payments__header">
                        <h3 class="InvoiceDetails__payments__header__title">
                            {___('title')}
                        </h3>
                        {canRecordPayments && (
                            <Button
                                type="primary"
                                icon="plus"
                                size="small"
                                onClick={handleAddPayment}
                            >
                                {___('add')}
                            </Button>
                        )}
                    </div>
                    {(() => {
                        if (payments.length <= 0) {
                            return (
                                <p class="InvoiceDetails__payments__empty">
                                    {___('empty')}
                                </p>
                            );
                        }

                        return (
                            <ul class="InvoiceDetails__payments__list">
                                {payments.map((payment: InvoicePayment) => (
                                    <li class="InvoiceDetails__payments__item" key={payment.id}>
                                        <div class="InvoiceDetails__payments__item__primary">
                                            <span class="InvoiceDetails__payments__item__amount">
                                                {formatAmount(payment.amount, invoice.currency)}
                                            </span>
                                            <span class="InvoiceDetails__payments__item__details">
                                                <span class="InvoiceDetails__payments__item__date">
                                                    {payment.date.toReadable()}
                                                </span>
                                                {(payment.method !== null || payment.reference !== null) && (
                                                    <ul class="InvoiceDetails__payments__item__meta">
                                                        {payment.method !== null && (
                                                            <li class="InvoiceDetails__payments__item__meta__part">
                                                                {__(`global.payment-methods.${payment.method}`)}
                                                            </li>
                                                        )}
                                                        {payment.reference !== null && (
                                                            <li class="InvoiceDetails__payments__item__meta__part">
                                                                {payment.reference}
                                                            </li>
                                                        )}
                                                    </ul>
                                                )}
                                            </span>
                                        </div>
                                        {canCancelPayment(payment) && (
                                            <Dropdown icon="ellipsis-v" type="transparent">
                                                <Button
                                                    icon="ban"
                                                    type="danger"
                                                    onClick={() => { handleCancelPayment(payment.id); }}
                                                >
                                                    {___('cancel.label')}
                                                </Button>
                                            </Dropdown>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        );
                    })()}
                    <div class="InvoiceDetails__payments__summary">
                        <div class="InvoiceDetails__payments__summary__line">
                            <span class="InvoiceDetails__payments__summary__line__label">
                                {___('total')}
                            </span>
                            <span class="InvoiceDetails__payments__summary__line__value">
                                {formatAmount(totalPaid, invoice.currency)}
                            </span>
                        </div>
                        <div class="InvoiceDetails__payments__summary__line">
                            <span class="InvoiceDetails__payments__summary__line__label">
                                {___('remaining')}
                            </span>
                            <span class="InvoiceDetails__payments__summary__line__value">
                                {formatAmount(remainingAmount, invoice.currency)}
                            </span>
                        </div>
                    </div>
                </section>
            );
        };

        return (
            <div class="InvoiceDetails">
                <div class="InvoiceDetails__body">
                    <div class="InvoiceDetails__body__preview">
                        <div class="InvoiceDetails__body__preview__content">
                            {((): JSX.Element | null => {
                                if (!isPreviewReady) {
                                    return null;
                                }

                                const ___ = (_status: string): string => (
                                    isCreditNote
                                        ? __(`global.credit-note-status.${_status}`)
                                        : __(`global.invoice-status.${_status}`)
                                );

                                const label: string | null = (() => {
                                    if (invoice.status === InvoiceStatus.DRAFT) {
                                        return ___('draft');
                                    }
                                    if (invoice.status === InvoiceStatus.OBSOLETE) {
                                        return ___('obsolete');
                                    }
                                    if (invoice.status === InvoiceStatus.CANCELLED) {
                                        return ___('cancelled');
                                    }
                                    if (invoice.status === InvoiceStatus.PAID) {
                                        return isRefundContext && !isCreditNote
                                            ? ___('refunded')
                                            : ___('paid');
                                    }
                                    return null;
                                })();
                                if (label === null) {
                                    return null;
                                }

                                const _classNames = [
                                    'InvoiceDetails__body__preview__ribbon',
                                    `InvoiceDetails__body__preview__ribbon--${invoice.status}`,
                                ];

                                return (
                                    <div class={_classNames}>
                                        <span class="InvoiceDetails__body__preview__ribbon__label">
                                            <span class="InvoiceDetails__body__preview__ribbon__label__text">
                                                {label}
                                            </span>
                                        </span>
                                    </div>
                                );
                            })()}
                            <Pdf
                                ref="preview"
                                src={invoice.url.pdf}
                                onReady={handlePreviewReady}
                            />
                        </div>
                    </div>
                </div>
                <aside class="InvoiceDetails__sidebar">
                    <header class="InvoiceDetails__header">
                        <h2 class="InvoiceDetails__header__title">
                            {((): string => {
                                const _type = isCreditNote ? 'credit-note' : 'invoice';
                                if (invoice.number === undefined) {
                                    return __(`title.draft.${_type}`, {
                                        date: invoice.created_at.format('L'),
                                        hour: invoice.created_at.format('HH:mm'),
                                    });
                                }
                                return __(`title.${_type}`, { number: invoice.number });
                            })()}
                        </h2>
                        <Button
                            icon="times"
                            onClick={handleClose}
                            class="InvoiceDetails__header__close-button"
                        />
                    </header>
                    <div class="InvoiceDetails__sub-header">
                        <div class="InvoiceDetails__amount">
                            <span class="InvoiceDetails__amount__total">
                                {(
                                    isCreditNote
                                        ? formatAmount(invoice.total_with_taxes.neg(), invoice.currency)
                                        : formatAmount(invoice.total_with_taxes, invoice.currency)
                                )}
                            </span>
                            {showDetailedTotals && (
                                <span class="InvoiceDetails__amount__taxes">
                                    {__('global.including-taxes', {
                                        amount: (
                                            isCreditNote
                                                ? formatAmount(totalTaxes!.neg(), invoice.currency)
                                                : formatAmount(totalTaxes!, invoice.currency)
                                        ),
                                    })}
                                </span>
                            )}
                        </div>
                        <div class="InvoiceDetails__status">
                            {(() => {
                                if (!isStatusEditable) {
                                    return (
                                        <StatusBadge
                                            size="large"
                                            invoice={invoice}
                                        />
                                    );
                                }

                                return (
                                    <BadgeSelect
                                        options={statusOptions}
                                        value={status!}
                                        disabled={isSaving}
                                        readonly={!isTeamMember}
                                        onChange={handleStatusChange}
                                    />
                                );
                            })()}
                        </div>
                    </div>
                    <div class="InvoiceDetails__sidebar__body">
                        <div class="InvoiceDetails__infos">
                            <div class="InvoiceDetails__info">
                                <span class="InvoiceDetails__info__label">
                                    {__('global.client')}
                                </span>
                                <div class="InvoiceDetails__info__value InvoiceDetails__client">
                                    <span class="InvoiceDetails__client__name">
                                        {buyerName}
                                    </span>
                                </div>
                            </div>
                            {(!isDraft || !isCreditNote) && (
                                <div class="InvoiceDetails__info-row">
                                    {(!isDraft && !isObsolete) && (
                                        <div class="InvoiceDetails__info">
                                            <span class="InvoiceDetails__info__label">
                                                {__('issue-date')}
                                            </span>
                                            <span class="InvoiceDetails__info__value">
                                                {invoice.date!.format('LL')}
                                            </span>
                                        </div>
                                    )}
                                    {!isCreditNote && (
                                        <div class="InvoiceDetails__info">
                                            <span class="InvoiceDetails__info__label">
                                                {(
                                                    invoice.due_date !== null || invoice.due_delay === null
                                                        ? __('expiry-date.fixed')
                                                        : __('expiry-date.delay')
                                                )}
                                            </span>
                                            <span class="InvoiceDetails__info__value">
                                                {invoice.due_date?.format('LL') ?? (
                                                    invoice.due_delay !== null
                                                        ? (
                                                            invoice.due_delay > 0
                                                                ? __('payment-terms.with-delay', { days: invoice.due_delay }, invoice.due_delay)
                                                                : __('payment-terms.immediately')
                                                        )
                                                        : (
                                                            <span class="InvoiceDetails__info__value__empty">
                                                                {__('global.not-specified')}
                                                            </span>
                                                        )
                                                )}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        {parentEstimate !== null && (
                            <section class="InvoiceDetails__parent-estimate">
                                <h3 class="InvoiceDetails__parent-estimate__title">
                                    {__('parent-estimate.title')}
                                </h3>
                                <div
                                    role={canOpenModal ? 'button' : undefined}
                                    class={[
                                        'InvoiceDetails__parent-estimate__content',
                                        { 'InvoiceDetails__parent-estimate__content--clickable': canOpenModal },
                                    ]}
                                    onClick={canOpenModal ? handleShowParentEstimate : () => {}}
                                >
                                    <div class="InvoiceDetails__parent-estimate__content__info">
                                        <span class="InvoiceDetails__parent-estimate__content__number">
                                            {((): string => {
                                                if (!('number' in parentEstimate) || parentEstimate.number === undefined) {
                                                    const displayDate = parentEstimate.date ?? parentEstimate.created_at;
                                                    return __('parent-estimate.label.without-number', {
                                                        date: displayDate.format('L'),
                                                        hour: displayDate.format('HH:mm'),
                                                    });
                                                }
                                                return __('parent-estimate.label.with-number', {
                                                    number: parentEstimate.number,
                                                });
                                            })()}
                                        </span>
                                        <span class="InvoiceDetails__parent-estimate__content__amount">
                                            {formatAmount(parentEstimate.total_with_taxes, parentEstimate.currency)}
                                        </span>
                                    </div>
                                    <EstimateStatusBadge estimate={parentEstimate} />
                                </div>
                            </section>
                        )}
                        {parentInvoice !== null && (
                            <section class="InvoiceDetails__parent-invoice">
                                <h3 class="InvoiceDetails__parent-invoice__title">
                                    {__('parent-invoice.title')}
                                </h3>
                                <div
                                    role={canOpenModal ? 'button' : undefined}
                                    class={[
                                        'InvoiceDetails__parent-invoice__content',
                                        { 'InvoiceDetails__parent-invoice__content--clickable': canOpenModal },
                                    ]}
                                    onClick={canOpenModal ? handleShowParentInvoice : () => {}}
                                >
                                    <div class="InvoiceDetails__parent-invoice__content__info">
                                        <span class="InvoiceDetails__parent-invoice__content__number">
                                            {(
                                                parentInvoice.number === undefined
                                                    ? __('parent-invoice.label.without-number', {
                                                        date: parentInvoice.created_at.format('L'),
                                                        hour: parentInvoice.created_at.format('HH:mm'),
                                                    })
                                                    : __('parent-invoice.label.with-number', {
                                                        number: parentInvoice.number,
                                                    })
                                            )}
                                        </span>
                                        <span class="InvoiceDetails__parent-invoice__content__amount">
                                            {formatAmount(parentInvoice.total_with_taxes, parentInvoice.currency)}
                                        </span>
                                    </div>
                                    <StatusBadge invoice={parentInvoice} />
                                </div>
                            </section>
                        )}
                        {childInvoice !== null && (
                            <section class="InvoiceDetails__child-invoice">
                                <h3 class="InvoiceDetails__child-invoice__title">
                                    {__(`child-invoice.title.${childInvoice.is_credit_note ? 'credit-note' : 'invoice'}`)}
                                </h3>
                                <div
                                    role={canOpenModal ? 'button' : undefined}
                                    class={[
                                        'InvoiceDetails__child-invoice__content',
                                        { 'InvoiceDetails__child-invoice__content--clickable': canOpenModal },
                                    ]}
                                    onClick={canOpenModal ? handleShowChildInvoice : () => {}}
                                >
                                    <div class="InvoiceDetails__child-invoice__content__info">
                                        <span class="InvoiceDetails__child-invoice__content__number">
                                            {((): string => {
                                                const _type = childInvoice.is_credit_note ? 'credit-note' : 'invoice';
                                                if (childInvoice.number === undefined) {
                                                    return __(`child-invoice.label.draft.${_type}`, {
                                                        date: childInvoice.created_at.format('L'),
                                                        hour: childInvoice.created_at.format('HH:mm'),
                                                    });
                                                }
                                                return __(`child-invoice.label.${_type}`, {
                                                    number: childInvoice.number,
                                                });
                                            })()}
                                        </span>
                                        <span class="InvoiceDetails__child-invoice__content__amount">
                                            {(
                                                childInvoice.is_credit_note
                                                    ? formatAmount(childInvoice.total_with_taxes.neg(), childInvoice.currency)
                                                    : formatAmount(childInvoice.total_with_taxes, childInvoice.currency)
                                            )}
                                        </span>
                                    </div>
                                    <StatusBadge invoice={childInvoice} />
                                </div>
                            </section>
                        )}
                        {prepaymentInvoices.length > 0 && (
                            <section class="InvoiceDetails__prepayment-invoices">
                                <h3 class="InvoiceDetails__prepayment-invoices__title">
                                    {__('prepayment-invoices.title')}
                                </h3>
                                <ul class="InvoiceDetails__prepayment-invoices__list">
                                    {prepaymentInvoices.map((prepaymentInvoice: InvoiceExcerpt) => (
                                        <li
                                            key={prepaymentInvoice.id}
                                            role={canOpenModal ? 'button' : undefined}
                                            class={[
                                                'InvoiceDetails__prepayment-invoices__item',
                                                { 'InvoiceDetails__prepayment-invoices__item--clickable': canOpenModal },
                                            ]}
                                            onClick={(
                                                canOpenModal
                                                    ? () => { handleShowPrepaymentInvoice(prepaymentInvoice.id); }
                                                    : () => {}
                                            )}
                                        >
                                            <div class="InvoiceDetails__prepayment-invoices__item__info">
                                                <span class="InvoiceDetails__prepayment-invoices__item__number">
                                                    {((): string => {
                                                        const _type = prepaymentInvoice.is_credit_note ? 'credit-note' : 'invoice';
                                                        if (prepaymentInvoice.number === undefined) {
                                                            return __(`prepayment-invoices.label.draft.${_type}`, {
                                                                date: prepaymentInvoice.created_at.format('L'),
                                                                hour: prepaymentInvoice.created_at.format('HH:mm'),
                                                            });
                                                        }
                                                        return __(`prepayment-invoices.label.${_type}`, {
                                                            number: prepaymentInvoice.number,
                                                        });
                                                    })()}
                                                </span>
                                                <span class="InvoiceDetails__prepayment-invoices__item__amount">
                                                    {(
                                                        prepaymentInvoice.is_credit_note
                                                            ? formatAmount(prepaymentInvoice.total_with_taxes.neg(), prepaymentInvoice.currency)
                                                            : formatAmount(prepaymentInvoice.total_with_taxes, prepaymentInvoice.currency)
                                                    )}
                                                </span>
                                            </div>
                                            <StatusBadge invoice={prepaymentInvoice} />
                                        </li>
                                    ))}
                                </ul>
                            </section>
                        )}
                        {renderPayments()}
                        <div class="InvoiceDetails__actions">
                            <div class="InvoiceDetails__actions__main">
                                {((): JSX.Element => {
                                    if (isDraft && canFinalize) {
                                        return (
                                            <Button
                                                type="primary"
                                                icon="check"
                                                loading={isFinalizing}
                                                onClick={handleFinalize}
                                                class="InvoiceDetails__actions__main__button"
                                            >
                                                {__('actions.finalize')}
                                            </Button>
                                        );
                                    }

                                    const isOutdated = [
                                        InvoiceStatus.OBSOLETE,
                                        InvoiceStatus.CANCELLED,
                                    ].includes(status!);

                                    if (invoice.url.ubl !== null) {
                                        return (
                                            <ButtonDropdown
                                                icon="download"
                                                type={!isOutdated ? 'primary' : 'secondary'}
                                                class="InvoiceDetails__actions__main__button"
                                                label={__('global.download')}
                                                to={invoice.url.pdf}
                                                download
                                                actions={[
                                                    {
                                                        label: __('actions.download-ubl'),
                                                        type: !isOutdated ? 'primary' : 'secondary',
                                                        icon: 'file-code',
                                                        target: invoice.url.ubl,
                                                        download: true,
                                                    },
                                                ]}
                                            />
                                        );
                                    }

                                    return (
                                        <Button
                                            type={!isOutdated ? 'primary' : 'secondary'}
                                            icon="download"
                                            class="InvoiceDetails__actions__main__button"
                                            to={invoice.url.pdf}
                                            download
                                        >
                                            {__('global.download')}
                                        </Button>
                                    );
                                })()}
                                {renderMoreActions()}
                            </div>
                        </div>
                    </div>
                </aside>
            </div>
        );
    },
});

export default InvoiceDetailsModal;
