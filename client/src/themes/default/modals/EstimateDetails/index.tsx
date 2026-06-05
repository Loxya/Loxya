import './index.scss';
import Decimal from 'decimal.js';
import DateTime from '@/utils/datetime';
import { confirm } from '@/utils/alert';
import { Group } from '@/stores/api/groups';
import { defineComponent, markRaw } from 'vue';
import formatAmount from '@/utils/formatAmount';
import TaxRegime from '@/utils/invoicing/tax-regime';
import BillingFormat from '@/stores/api/@enums/billing-format';
import apiEstimates, { EstimateStatus } from '@/stores/api/estimates';
import CriticalError from '@/themes/default/components/CriticalError';
import StatusBadge from '@/themes/default/components/BadgeStatus/Estimate';
import InvoiceStatusBadge from '@/themes/default/components/BadgeStatus/Invoice';
import BadgeSelect, { Type as BadgeType } from '@/themes/default/components/BadgeSelect';
import Dropdown from '@/themes/default/components/Dropdown';
import Loading from '@/themes/default/components/Loading';
import Button from '@/themes/default/components/Button';
import Pdf from '@/themes/default/components/Pdf';

// - Modales
import CreateInvoiceModal from './modals/CreateInvoice';

import type { ComponentRef, PropType, Raw } from 'vue';
import type { InvoiceExcerpt, InvoiceDetails } from '@/stores/api/invoices';
import type { EstimateDetails, EstimateTax } from '@/stores/api/estimates';
import type { Options } from '@/themes/default/components/BadgeSelect';

type Props = {
    /** Identifiant du devis dont on veut afficher les détails. */
    id: EstimateDetails['id'],

    /**
     * Fonction appelée lorsque le devis liée à l'id passé a été mis à jour.
     *
     * @param estimate - Le devis, mis à jour.
     */
    onUpdated?(estimate: EstimateDetails): void,

    /**
     * Fonction appelée lorsqu'une nouvelle facture a
     * été créée depuis ce devis.
     *
     * @param invoice - La facture créée.
     */
    onInvoiceCreated?(invoice: InvoiceDetails): void,

    /**
     * Fonction appelée lorsqu'on souhaite ouvrir une autre entité.
     *
     * @param kind - L'entité à ouvrir.
     * @param id - L'identifiant de l'entité à ouvrir.
     */
    onRequestOpen?(kind: 'estimate' | 'invoice', id: number): void,

    /**
     * Fonction appelée lorsqu'il y a eu des changements.
     *
     * Cet événement est levé pour toute mise à jour,
     * suppression ou création de facture liées.
     */
    onChange?(): void,

    /**
     * Fonction appelée lorsque le devis a été supprimé.
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
    estimate: EstimateDetails | null,
    newStatus: EstimateStatus | null,
    hasCriticalError: boolean,
    isFetched: boolean,
    isDeleting: boolean,
    isFinalizing: boolean,
    isPreviewReady: boolean,
};

/** Modale de détails d'un devis. */
const EstimateDetailsModal = defineComponent({
    name: 'EstimateDetailsModal',
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
        onRequestOpen: {
            type: Function as PropType<Props['onRequestOpen']>,
            default: undefined,
        },
        onInvoiceCreated: {
            type: Function as PropType<Props['onInvoiceCreated']>,
            default: undefined,
        },
        onChange: {
            type: Function as PropType<Props['onChange']>,
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
        estimate: null,
        newStatus: null,
        isFetched: false,
        isDeleting: false,
        isFinalizing: false,
        isPreviewReady: false,
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

        isInvoiced(): boolean {
            if (this.estimate === null) {
                return false;
            }
            return this.estimate.related_invoices.length > 0;
        },

        isDraft(): boolean {
            if (!this.isFetched || this.estimate === null) {
                return false;
            }
            return this.estimate.status === EstimateStatus.DRAFT;
        },

        isObsolete(): boolean {
            if (!this.isFetched || this.estimate === null) {
                return false;
            }
            return this.estimate.status === EstimateStatus.OBSOLETE;
        },

        isDeletable(): boolean {
            if (this.estimate === null || !this.isTeamMember) {
                return false;
            }
            return !this.isInvoiced;
        },

        canFinalize(): boolean {
            // - Un brouillon devenu obsolète (date de validité
            //   fixe dépassée) ne peut plus être finalisé.
            return this.isTeamMember && this.isDraft && !this.isObsolete;
        },

        isOverdue(): boolean {
            if (!this.isFetched || this.estimate === null) {
                return false;
            }
            const { due_date: dueDate, due_delay: dueDelay, date } = this.estimate;

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
            if (!this.isFetched || this.estimate === null || !this.isTeamMember) {
                return false;
            }

            // - Sur un brouillon, le statut n'est pas modifiable manuellement :
            //   Le passage à "en attente" se fait uniquement via la finalisation.
            if (this.isDraft || this.isObsolete) {
                return false;
            }

            const fixedStatuses = [
                EstimateStatus.PARTIALLY_INVOICED,
                EstimateStatus.INVOICED,
            ];
            return !fixedStatuses.includes(this.estimate.status);
        },

        status(): EstimateStatus | null {
            if (!this.isStatusEditable) {
                return this.estimate?.status ?? null;
            }

            if (this.newStatus !== null) {
                const isPending = [EstimateStatus.PENDING, EstimateStatus.SENT].includes(this.newStatus);
                if (isPending && this.isOverdue) {
                    return EstimateStatus.EXPIRED;
                }
                return this.newStatus;
            }
            return this.estimate?.status ?? null;
        },

        remainingAmount(): Decimal | null {
            if (!this.isFetched || this.estimate === null) {
                return null;
            }

            const billedTotal = this.estimate.related_invoices.reduce(
                (carry: Decimal, invoice: InvoiceExcerpt) => (
                    invoice.is_credit_note
                        ? carry.minus(invoice.total_with_taxes)
                        : carry.plus(invoice.total_with_taxes)
                ),
                new Decimal(0),
            );
            return this.estimate.total_with_taxes.minus(billedTotal);
        },

        showRemainingAmount(): boolean {
            if (!this.isFetched || this.estimate === null) {
                return false;
            }

            // - S'il y a une facture finale, on n'affiche pas
            //   le montant restant à facturer.
            if (this.estimate.has_final_invoice) {
                return false;
            }

            const { remainingAmount } = this;
            return remainingAmount !== null && !remainingAmount.isZero();
        },

        hasActiveInvoices(): boolean {
            if (!this.isFetched || this.estimate === null) {
                return false;
            }

            return this.estimate.related_invoices.some(
                (invoice: InvoiceExcerpt) => (
                    !invoice.is_credit_note &&
                    !invoice.is_cancelled
                ),
            );
        },

        canCreateInvoice(): boolean {
            if (!this.isFetched || this.estimate === null || !this.isTeamMember) {
                return false;
            }
            const { status, estimate, remainingAmount, hasActiveInvoices } = this;
            const { buyer } = estimate;

            // - Pas de facture à partir d'un brouillon.
            if (this.isDraft || this.isObsolete) {
                return false;
            }

            // - Pas de facture sur un devis "legacy".
            if ([BillingFormat.V1, BillingFormat.V2].includes(estimate.format)) {
                return false;
            }

            // - Pas de facture pour un devis rejeté.
            if (status === EstimateStatus.REJECTED) {
                return false;
            }

            // - Pas de facture si le bénéficiaire n'est pas facturable.
            if (buyer.is_deleted || !buyer.is_invoiceable) {
                return false;
            }

            // - S'il n'y a plus rien à facturer, on ne peut pas lier le devis.
            return (
                estimate.total_with_taxes.isZero()
                    ? (remainingAmount!.isZero() && !hasActiveInvoices)
                    : (
                        estimate.total_with_taxes.isPositive()
                            ? remainingAmount!.greaterThan(0)
                            : remainingAmount!.lessThan(0)
                    )
            );
        },

        totalTaxes(): Decimal | null {
            if (!this.isFetched || this.estimate === null) {
                return null;
            }

            const { estimate } = this;
            if (estimate.format === BillingFormat.V1 || estimate.format === BillingFormat.V2) {
                return estimate.total_taxes.reduce(
                    (acc, tax) => acc.plus(tax.total),
                    new Decimal(0),
                );
            }

            const { global_tax_regime: globalTaxRegime, total_taxes: totalTaxes } = (
                estimate as Exclude<EstimateDetails, { format: BillingFormat.V1 | BillingFormat.V2 }>
            );

            if (globalTaxRegime !== null) {
                return new Decimal(0);
            }

            return totalTaxes!.reduce(
                (total: Decimal, tax: EstimateTax) => {
                    if (tax.type !== TaxRegime.STANDARD) {
                        return total;
                    }
                    return total.plus(tax.total);
                },
                new Decimal(0),
            );
        },

        showDetailedTotals(): boolean {
            if (!this.isFetched || this.estimate === null) {
                return false;
            }

            return (
                this.estimate.global_tax_regime === null &&
                (this.estimate.total_taxes ?? []).length > 0
            );
        },

        statusOptions(): Options<EstimateStatus> {
            const { __, isInvoiced, isOverdue } = this;

            return [
                {
                    label: __('global.estimate-status.pending'),
                    value: EstimateStatus.PENDING,
                    type: BadgeType.WARNING,
                    selectable: !isInvoiced && !isOverdue,
                },
                {
                    label: __('global.estimate-status.sent'),
                    value: EstimateStatus.SENT,
                    type: BadgeType.INFO,
                    selectable: !isInvoiced && !isOverdue,
                },
                {
                    label: __('global.estimate-status.accepted'),
                    value: EstimateStatus.ACCEPTED,
                    type: BadgeType.SUCCESS,
                    selectable: !isInvoiced,
                },
                {
                    label: __('global.estimate-status.partially-invoiced'),
                    value: EstimateStatus.PARTIALLY_INVOICED,
                    type: BadgeType.INFO,
                    selectable: false,
                },
                {
                    label: __('global.estimate-status.invoiced'),
                    value: EstimateStatus.INVOICED,
                    type: BadgeType.SUCCESS,
                    selectable: false,
                },
                {
                    label: __('global.estimate-status.expired'),
                    value: EstimateStatus.EXPIRED,
                    type: BadgeType.DANGER,
                    selectable: false,
                },
                {
                    label: __('global.estimate-status.rejected'),
                    value: EstimateStatus.REJECTED,
                    type: BadgeType.DANGER,
                    selectable: !isInvoiced,
                },
            ];
        },

        canOpenModal(): boolean {
            const { onRequestOpen } = this.$props;
            return this.isTeamMember && onRequestOpen !== undefined;
        },

        relatedInvoices(): InvoiceExcerpt[] {
            if (!this.isFetched || this.estimate === null) {
                return [];
            }

            return [...this.estimate.related_invoices].sort(
                (a: InvoiceExcerpt, b: InvoiceExcerpt) => {
                    if (a.date !== undefined || b.date !== undefined) {
                        if (a.date === undefined || b.date === undefined) {
                            return (a.date === undefined ? 1 : -1);
                        }

                        const dateComparison = a.date.compare(b.date);
                        if (dateComparison !== 0) {
                            return dateComparison;
                        }
                    }
                    return a.id - b.id;
                },
            );
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

        async handleStatusChange(newStatus: EstimateStatus) {
            const { __, estimate, isStatusEditable, isSaving } = this;
            if (estimate === null || !isStatusEditable || isSaving) {
                return;
            }
            this.newStatus = newStatus;

            try {
                this.estimate = await apiEstimates.updateStatus(estimate.id, newStatus);

                const { onUpdated, onChange } = this.$props;
                onUpdated?.(this.estimate);
                onChange?.();
            } catch {
                this.$toasted.error(__('global.errors.unexpected-while-saving'));
            } finally {
                this.newStatus = null;
            }
        },

        async handleFinalize() {
            const { __, estimate, canFinalize, isFinalizing } = this;
            if (estimate === null || !canFinalize || isFinalizing) {
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
                this.estimate = await apiEstimates.finalize(estimate.id);

                // - On actualise la preview.
                const $preview = this.$refs.preview as ComponentRef<typeof Pdf>;
                $preview?.refresh();

                const { onUpdated, onChange } = this.$props;
                onUpdated?.(this.estimate);
                onChange?.();
            } catch {
                this.$toasted.error(__('global.errors.unexpected-while-saving'));
            } finally {
                this.isFinalizing = false;
            }
        },

        handlePreviewReady() {
            this.isPreviewReady = true;
        },

        async handleCreateInvoice() {
            const { estimate } = this;
            if (estimate === null) {
                return;
            }

            const invoice = await this.$modal.show(CreateInvoiceModal, { estimate });
            if (invoice === undefined) {
                return;
            }

            // - Rafraîchit le devis courant.
            await this.fetchData();

            const {
                onChange,
                onRequestOpen,
                onInvoiceCreated,
            } = this.$props;

            onInvoiceCreated?.(invoice);
            onChange?.();

            // - Délègue l'ouverture de la facture créée au parent.
            if (this.canOpenModal && onRequestOpen !== undefined) {
                onRequestOpen('invoice', invoice.id);
                this.$emit('close');
            }
        },

        handleShowRelatedInvoice(invoiceId: InvoiceExcerpt['id']) {
            const { onRequestOpen } = this.$props;
            if (!this.canOpenModal || onRequestOpen === undefined) {
                return;
            }

            onRequestOpen('invoice', invoiceId);
            this.$emit('close');
        },

        async handleDelete() {
            const { __, estimate, isDeletable, isDeleting } = this;
            if (estimate === null || !isDeletable || isDeleting) {
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
                await apiEstimates.remove(estimate.id);

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

        handleClose() {
            this.$emit('close');
        },

        // ------------------------------------------------------
        // -
        // -    Méthodes internes
        // -
        // ------------------------------------------------------

        async fetchData() {
            try {
                this.estimate = await apiEstimates.one(this.id);
                this.isFetched = true;
            } catch (error) {
                // eslint-disable-next-line no-console
                console.error(`Error occurred while retrieving estimate details:`, error);
                this.hasCriticalError = true;
            }
        },

        __(key: string, params?: Record<string, number | string>, count?: number): string {
            key = !key.startsWith('global.')
                ? `modal.estimate-details.${key}`
                : key.replace(/^global\./, '');

            return this.$t(key, params, count);
        },
    },
    render() {
        const {
            __,
            status,
            estimate,
            totalTaxes,
            isDraft,
            isSaving,
            isFetched,
            isObsolete,
            isDeleting,
            isFinalizing,
            isPreviewReady,
            isTeamMember,
            isDeletable,
            canFinalize,
            canOpenModal,
            canCreateInvoice,
            showRemainingAmount,
            showDetailedTotals,
            remainingAmount,
            statusOptions,
            relatedInvoices,
            isStatusEditable,
            hasCriticalError,
            handleClose,
            handleDelete,
            handleFinalize,
            handlePreviewReady,
            handleStatusChange,
            handleCreateInvoice,
            handleShowRelatedInvoice,
        } = this;

        if (hasCriticalError || !isFetched || !estimate) {
            return (
                <div class="EstimateDetails EstimateDetails--not-ready">
                    <div class="EstimateDetails__body">
                        {(
                            !hasCriticalError
                                ? <Loading class="EstimateDetails__loading" />
                                : <CriticalError />
                        )}
                    </div>
                    <aside class="EstimateDetails__sidebar">
                        <header class="EstimateDetails__header">
                            <Button
                                icon="times"
                                onClick={handleClose}
                                class="EstimateDetails__header__close-button"
                            />
                        </header>
                    </aside>
                </div>
            );
        }

        const { buyer } = estimate;
        const buyerName = buyer.company
            ? buyer.company.legal_name
            : buyer.full_name;

        const renderMoreActions = (): JSX.Element | null => {
            const actions = [];

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

        return (
            <div class="EstimateDetails">
                <div class="EstimateDetails__body">
                    <div class="EstimateDetails__body__preview">
                        <div class="EstimateDetails__body__preview__content">
                            {((): JSX.Element | null => {
                                if (!isPreviewReady) {
                                    return null;
                                }

                                const label: string | null = (() => {
                                    if (estimate.status === EstimateStatus.DRAFT) {
                                        return __('global.estimate-status.draft');
                                    }
                                    if (estimate.status === EstimateStatus.OBSOLETE) {
                                        return __('global.estimate-status.obsolete');
                                    }
                                    if (estimate.status === EstimateStatus.EXPIRED) {
                                        return __('global.estimate-status.expired');
                                    }
                                    if (estimate.status === EstimateStatus.REJECTED) {
                                        return __('global.estimate-status.rejected');
                                    }
                                    if (estimate.status === EstimateStatus.INVOICED) {
                                        return __('global.estimate-status.invoiced');
                                    }
                                    return null;
                                })();
                                if (label === null) {
                                    return null;
                                }

                                const _classNames = [
                                    'EstimateDetails__body__preview__ribbon',
                                    `EstimateDetails__body__preview__ribbon--${estimate.status}`,
                                ];

                                return (
                                    <div class={_classNames}>
                                        <span class="EstimateDetails__body__preview__ribbon__label">
                                            <span class="EstimateDetails__body__preview__ribbon__label__text">
                                                {label}
                                            </span>
                                        </span>
                                    </div>
                                );
                            })()}
                            <Pdf
                                ref="preview"
                                src={estimate.url}
                                onReady={handlePreviewReady}
                            />
                        </div>
                    </div>
                </div>
                <aside class="EstimateDetails__sidebar">
                    <header class="EstimateDetails__header">
                        <h2 class="EstimateDetails__header__title">
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
                            icon="times"
                            onClick={handleClose}
                            class="EstimateDetails__header__close-button"
                        />
                    </header>
                    <div class="EstimateDetails__sub-header">
                        <div class="EstimateDetails__amount">
                            <span class="EstimateDetails__amount__total">
                                {formatAmount(estimate.total_with_taxes, estimate.currency)}
                            </span>
                            {showDetailedTotals && (
                                <span class="EstimateDetails__amount__taxes">
                                    {__('global.including-taxes', {
                                        amount: formatAmount(totalTaxes!, estimate.currency),
                                    })}
                                </span>
                            )}
                        </div>
                        <div class="EstimateDetails__status">
                            {(() => {
                                if (!isStatusEditable) {
                                    return (
                                        <StatusBadge
                                            size="large"
                                            estimate={estimate}
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
                    <div class="EstimateDetails__sidebar__body">
                        <div class="EstimateDetails__infos">
                            <div class="EstimateDetails__info">
                                <span class="EstimateDetails__info__label">
                                    {__('global.client')}
                                </span>
                                <div class="EstimateDetails__info__value EstimateDetails__client">
                                    <span class="EstimateDetails__client__name">
                                        {buyerName}
                                    </span>
                                </div>
                            </div>
                            <div class="EstimateDetails__info-row">
                                {(!isDraft && !isObsolete) && (
                                    <div class="EstimateDetails__info">
                                        <span class="EstimateDetails__info__label">
                                            {__('issue-date')}
                                        </span>
                                        <span class="EstimateDetails__info__value">
                                            {estimate.date!.format('LL')}
                                        </span>
                                    </div>
                                )}
                                <div class="EstimateDetails__info">
                                    <span class="EstimateDetails__info__label">
                                        {(
                                            estimate.due_date !== null || estimate.due_delay === null
                                                ? __('expiry-date.fixed')
                                                : __('expiry-date.delay')
                                        )}
                                    </span>
                                    <span class="EstimateDetails__info__value">
                                        {estimate.due_date?.format('LL') ?? (
                                            estimate.due_delay !== null
                                                ? __('validity', { days: estimate.due_delay }, estimate.due_delay)
                                                : (
                                                    <span class="EstimateDetails__info__value__empty">
                                                        {__('global.not-specified')}
                                                    </span>
                                                )
                                        )}
                                    </span>
                                </div>
                            </div>
                        </div>
                        {relatedInvoices.length > 0 && (
                            <section class="EstimateDetails__related-invoices">
                                <h3 class="EstimateDetails__related-invoices__title">
                                    {__('related-invoices.title')}
                                </h3>
                                <ul class="EstimateDetails__related-invoices__list">
                                    {relatedInvoices.map((invoice: InvoiceExcerpt) => (
                                        <li
                                            key={invoice.id}
                                            role={canOpenModal ? 'button' : undefined}
                                            class={[
                                                'EstimateDetails__related-invoices__item',
                                                { 'EstimateDetails__related-invoices__item--clickable': canOpenModal },
                                            ]}
                                            onClick={(
                                                canOpenModal
                                                    ? () => { handleShowRelatedInvoice(invoice.id); }
                                                    : () => {}
                                            )}
                                        >
                                            <div class="EstimateDetails__related-invoices__item__info">
                                                <span class="EstimateDetails__related-invoices__item__number">
                                                    {((): string => {
                                                        const _type = invoice.is_credit_note ? 'credit-note' : 'invoice';
                                                        if (invoice.number === undefined) {
                                                            return __(`related-invoices.item.label.draft.${_type}`, {
                                                                date: invoice.created_at.format('L'),
                                                                hour: invoice.created_at.format('HH:mm'),
                                                            });
                                                        }
                                                        return __(`related-invoices.item.label.${_type}`, {
                                                            number: invoice.number,
                                                        });
                                                    })()}
                                                </span>
                                                <span class="EstimateDetails__related-invoices__item__amount">
                                                    {(
                                                        invoice.is_credit_note
                                                            ? formatAmount(invoice.total_with_taxes.neg(), invoice.currency)
                                                            : formatAmount(invoice.total_with_taxes, invoice.currency)
                                                    )}
                                                </span>
                                            </div>
                                            <InvoiceStatusBadge invoice={invoice} />
                                        </li>
                                    ))}
                                </ul>
                                {showRemainingAmount && (
                                    <div class="EstimateDetails__related-invoices__remaining">
                                        <span class="EstimateDetails__related-invoices__remaining__label">
                                            {__('related-invoices.remaining')}
                                        </span>
                                        <span class="EstimateDetails__related-invoices__remaining__value">
                                            {formatAmount(remainingAmount!, estimate.currency)}
                                        </span>
                                    </div>
                                )}
                            </section>
                        )}
                        <div class="EstimateDetails__actions">
                            {canCreateInvoice && (
                                <div class="EstimateDetails__actions__line">
                                    <Button
                                        type="secondary"
                                        icon="file-invoice-dollar"
                                        onClick={handleCreateInvoice}
                                        class="EstimateDetails__actions__button"
                                    >
                                        {__('actions.create-invoice')}
                                    </Button>
                                </div>
                            )}
                            <div class="EstimateDetails__actions__main">
                                {((): JSX.Element => {
                                    if (isDraft && canFinalize) {
                                        return (
                                            <Button
                                                type="primary"
                                                icon="check"
                                                loading={isFinalizing}
                                                onClick={handleFinalize}
                                                class="EstimateDetails__actions__main__button"
                                            >
                                                {__('actions.finalize')}
                                            </Button>
                                        );
                                    }

                                    const isOutdated = [
                                        EstimateStatus.EXPIRED,
                                        EstimateStatus.REJECTED,
                                        EstimateStatus.OBSOLETE,
                                    ].includes(status!);
                                    return (
                                        <Button
                                            type={!isOutdated ? 'primary' : 'secondary'}
                                            icon="download"
                                            class="EstimateDetails__actions__main__button"
                                            to={estimate.url}
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

export default EstimateDetailsModal;
