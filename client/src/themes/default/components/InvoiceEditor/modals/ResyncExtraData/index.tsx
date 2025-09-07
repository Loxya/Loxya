import './index.scss';
import formatAmount from '@/utils/formatAmount';
import { defineComponent } from 'vue';
import apiBookings from '@/stores/api/bookings';
import Fragment from '@/components/Fragment';
import Button from '@/themes/default/components/Button';
import StateMessage, { State } from '@/themes/default/components/StateMessage';

import type Decimal from 'decimal.js';
import type { PropType } from 'vue';
import type { Booking } from '@/stores/api/bookings';
import type { BillingExtra, PriceDetails, Tax } from '../../_types';

type Props = {
    /** Le booking (événement, réservation ou demande de réservation). */
    booking: Booking,

    /** Ligne additionnelle dont on veut resynchroniser les données. */
    extra: BillingExtra,

    /**
     * Fonction appelée lorsque l'utilisateur souhaite fermer la fenêtre modale.
     *
     * @param updatedExtra - La ligne additionnelle de facturation mise à jour.
     *                       (uniquement si l'utilisateur n'a pas fermé la modale sans modifier)
     */
    onClose?(updatedExtra?: BillingExtra): void,
};

const RESYNCHRONIZABLE_FIELDS = [
    'taxes',
] as const;

type ResynchronizableField = (typeof RESYNCHRONIZABLE_FIELDS)[number];

type Data = {
    isSaving: boolean,
    selection: ResynchronizableField[],
};

/**
 * Fenêtre modale permettant la resynchronisation
 * des données d'une ligne additionnelle de la facturation.
 */
const InvoiceEditorResyncMaterialDataModal = defineComponent({
    name: 'InvoiceEditorResyncMaterialDataModal',
    modal: {
        width: 600,
        draggable: true,
        clickToClose: false,
    },
    props: {
        booking: {
            type: Object as PropType<Props['booking']>,
            required: true,
        },
        extra: {
            type: Object as PropType<Props['extra']>,
            required: true,
        },
        // eslint-disable-next-line vue/no-unused-properties
        onClose: {
            type: Function as PropType<Props['onClose']>,
            default: undefined,
        },
    },
    emits: ['close'],
    data: (): Data => ({
        isSaving: false,
        selection: [],
    }),
    computed: {
        hasSelected(): boolean {
            const { extra } = this;
            if (!extra.is_resyncable || !extra.is_unsynced) {
                return false;
            }
            return this.selection.length > 0;
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
            this.$emit('close');
        },

        handleCheckbox(e: InputEvent, field: ResynchronizableField) {
            e.preventDefault();

            const selected = (e.target! as HTMLInputElement).checked;
            if (!selected) {
                const index = this.selection.indexOf(field);
                if (index !== -1) {
                    this.selection.splice(index, 1);
                }
            } else {
                if (this.selection.includes(field)) {
                    return;
                }
                this.selection.push(field);
            }
        },

        handleRowClick(field: ResynchronizableField) {
            if (this.selection.includes(field)) {
                const index = this.selection.indexOf(field);
                this.selection.splice(index, 1);
            } else {
                this.selection.push(field);
            }
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

            const { __, booking, extra, selection } = this;
            this.isSaving = true;

            try {
                const updatedMaterial = await apiBookings.resynchronizeExtra(booking.entity, booking.id, extra.id!, selection);
                this.$toasted.success(__('selected-data-resynchronized'));
                this.$emit('close', updatedMaterial);
            } catch {
                this.isSaving = false;
                this.$toasted.error(__('global.errors.unexpected-while-saving'));
            }
        },

        __(key: string, params?: Record<string, number | string>, count?: number): string {
            key = !key.startsWith('global.')
                ? `components.InvoiceEditor.modals.resync-extra-data.${key}`
                : key.replace(/^global\./, '');

            return this.$t(key, params, count);
        },
    },
    render() {
        const {
            __,
            booking,
            extra,
            selection,
            hasSelected,
            isSaving,
            handleClose,
            handleSubmit,
            handleRowClick,
            handleCheckbox,
        } = this;

        const renderContent = (): JSX.Element => {
            if (!extra.is_unsynced || !extra.is_resyncable) {
                return (
                    <StateMessage
                        size="small"
                        type={State.NOTHING_TO_DO}
                        message={__('nothing-to-resynchronize')}
                    />
                );
            }

            return (
                <Fragment>
                    <div class="InvoiceEditorResyncMaterialDataModal__body">
                        <form class="InvoiceEditorResyncMaterialDataModal__form" onSubmit={handleSubmit}>
                            <table class="InvoiceEditorResyncMaterialDataModal__list">
                                {RESYNCHRONIZABLE_FIELDS.map((field: ResynchronizableField) => {
                                    const unsyncedDatum = extra[field];
                                    if (!unsyncedDatum.isUnsynced || !unsyncedDatum.isResyncable) {
                                        return null;
                                    }
                                    const isSelected = selection.includes(field);

                                    const renderCurrentValue = (): JSX.Element | string | null => {
                                        const taxes = unsyncedDatum.current;

                                        if (taxes.length === 0) {
                                            return (
                                                <span
                                                    class={[
                                                        'InvoiceEditorResyncMaterialDataModal__list__item__value',
                                                        'InvoiceEditorResyncMaterialDataModal__list__item__value--empty',
                                                    ]}
                                                >
                                                    {__('tax-free')}
                                                </span>
                                            );
                                        }

                                        return (
                                            <ul
                                                class={[
                                                    'InvoiceEditorResyncMaterialDataModal__list__item__value',
                                                    'InvoiceEditorResyncMaterialDataModal__list__item__value--list',
                                                ]}
                                            >
                                                {taxes.map((tax: Tax<Decimal>, index: number) => {
                                                    const taxValue = tax.is_rate
                                                        ? `${tax.value.toString()}%`
                                                        : formatAmount(tax.value, booking.currency);

                                                    return <li key={index}>{tax.name} ({taxValue})</li>;
                                                })}
                                            </ul>
                                        );
                                    };

                                    const renderBaseValue = (): JSX.Element | string | null => {
                                        const taxes = unsyncedDatum.base;

                                        if (taxes.length === 0) {
                                            return (
                                                <span
                                                    class={[
                                                        'InvoiceEditorResyncMaterialDataModal__list__item__value',
                                                        'InvoiceEditorResyncMaterialDataModal__list__item__value--empty',
                                                    ]}
                                                >
                                                    {__('tax-free')}
                                                </span>
                                            );
                                        }

                                        return (
                                            <ul
                                                class={[
                                                    'InvoiceEditorResyncMaterialDataModal__list__item__value',
                                                    'InvoiceEditorResyncMaterialDataModal__list__item__value--list',
                                                ]}
                                            >
                                                {taxes.map((tax: Tax<PriceDetails>, index: number) => {
                                                    const taxValue = tax.is_rate
                                                        ? `${tax.value.toString()}%`
                                                        : formatAmount(tax.value.amount, tax.value.currency);

                                                    return <li key={index}>{tax.name} ({taxValue})</li>;
                                                })}
                                            </ul>
                                        );
                                    };

                                    return (
                                        <tr
                                            key={field}
                                            onClick={() => { handleRowClick(field); }}
                                            class={[
                                                'InvoiceEditorResyncMaterialDataModal__list__item',
                                                { 'InvoiceEditorResyncMaterialDataModal__list__item--selected': isSelected },
                                            ]}
                                        >
                                            <td
                                                class={[
                                                    'InvoiceEditorResyncMaterialDataModal__list__item__col',
                                                    'InvoiceEditorResyncMaterialDataModal__list__item__col--checkbox',
                                                ]}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onInput={(e: InputEvent) => {
                                                        handleCheckbox(e, field);
                                                    }}
                                                />
                                            </td>
                                            <td
                                                class={[
                                                    'InvoiceEditorResyncMaterialDataModal__list__item__col',
                                                    'InvoiceEditorResyncMaterialDataModal__list__item__col--name',
                                                ]}
                                            >
                                                {__(`fields.${field}`)}
                                            </td>
                                            <td
                                                class={[
                                                    'InvoiceEditorResyncMaterialDataModal__list__item__col',
                                                    'InvoiceEditorResyncMaterialDataModal__list__item__col--current-value',
                                                ]}
                                            >
                                                {renderCurrentValue()}
                                            </td>
                                            <td
                                                class={[
                                                    'InvoiceEditorResyncMaterialDataModal__list__item__col',
                                                    'InvoiceEditorResyncMaterialDataModal__list__item__col--revert-value',
                                                ]}
                                            >
                                                {renderBaseValue()}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </table>
                        </form>
                    </div>
                    <div class="InvoiceEditorResyncMaterialDataModal__footer">
                        <Button
                            type="primary"
                            onClick={handleSubmit}
                            loading={isSaving}
                            disabled={!hasSelected}
                        >
                            {__('resynchronize-data')}
                        </Button>
                    </div>
                </Fragment>
            );
        };

        return (
            <div class="InvoiceEditorResyncMaterialDataModal">
                <div class="InvoiceEditorResyncMaterialDataModal__header">
                    <h2 class="InvoiceEditorResyncMaterialDataModal__header__title">
                        {__('title', { name: extra.description! })}
                    </h2>
                    <Button
                        type="close"
                        class="InvoiceEditorResyncMaterialDataModal__header__close-button"
                        onClick={handleClose}
                    />
                </div>
                {renderContent()}
            </div>
        );
    },
});

export default InvoiceEditorResyncMaterialDataModal;
