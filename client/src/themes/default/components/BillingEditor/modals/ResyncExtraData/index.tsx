import './index.scss';
import config from '@/globals/config';
import { defineComponent } from 'vue';
import apiBookings from '@/stores/api/bookings';
import Fragment from '@/components/Fragment';
import Button from '@/themes/default/components/Button';
import StateMessage, { State } from '@/themes/default/components/StateMessage';
import getReadableTaxData from '../../utils/getReadableTaxData';

import type { PropType } from 'vue';
import type Country from '@/utils/country';
import type { Booking } from '@/stores/api/bookings';
import type { BillingExtra, LineTaxDetail, RawExtraBillingData } from '../../_types';

type Props = {
    /**
     * L'éventuel booking lié (événement, réservation ou demande de réservation).
     *
     * En mode autonome (sans booking), seul le rollback local est possible.
     */
    booking?: Booking,

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
const BillingEditorResyncExtraDataModal = defineComponent({
    name: 'BillingEditorResyncExtraDataModal',
    modal: {
        width: 600,
        dismissible: false,
    },
    props: {
        booking: {
            type: Object as PropType<Props['booking']>,
            default: undefined,
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
        sellerCountry(): Country {
            return config.organization.country;
        },

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
                // - Pour un extra non persisté, on resynchronise localement
                //   en supprimant les surcharges des champs sélectionnés.
                if (!extra.is_persisted || booking === undefined) {
                    const updatedRawData: RawExtraBillingData = (() => {
                        const data = {
                            uuid: extra.uuid,
                            is_service: extra.is_service,
                            description: extra.description,
                            quantity: extra.quantity,
                            unit_price: extra.unit_price,
                            discount_rate: extra.discount_rate,
                        };

                        // - Si les taxes ne doivent pas être re-synchronisées.
                        if (!selection.includes('taxes')) {
                            Object.assign(data, {
                                tax_regime: extra.tax_regime.current,
                                tax_exemption_code: extra.tax_exemption_code.current,
                                tax_id: extra.tax_id.current,
                                taxes: extra.taxes.current,
                            });
                        }

                        return data;
                    })();

                    this.$toasted.success(__('selected-data-resynchronized'));
                    this.$emit('close', updatedRawData);
                    return;
                }

                const updatedExtra = await apiBookings.resynchronizeExtra(booking.entity, booking.id, extra.uuid, selection);
                this.$toasted.success(__('selected-data-resynchronized'));
                this.$emit('close', updatedExtra);
            } catch {
                this.isSaving = false;
                this.$toasted.error(__('global.errors.unexpected-while-saving'));
            }
        },

        __c(key: string, params?: Record<string, number | string>, count?: number): string {
            key = !key.startsWith('global.')
                ? `components.BillingEditor.${key}`
                : key.replace(/^global\./, '');

            return this.$t(key, params, count);
        },

        __(key: string, params?: Record<string, number | string>, count?: number): string {
            if (!key.startsWith('global.')) {
                key = !key.startsWith('component.')
                    ? `modals.resync-extra-data.${key}`
                    : key.replace(/^component\./, '');
            }
            return this.__c(key, params, count);
        },
    },
    render() {
        const {
            __,
            __c,
            extra,
            selection,
            sellerCountry,
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

            const renderTaxValue = (tax: LineTaxDetail): JSX.Node => {
                const readable = getReadableTaxData(tax, { sellerCountry, translator: __c });
                return readable.details === undefined ? readable.value : (
                    <span class="BillingEditorResyncMaterialDataModal__list__item__value">
                        <span class="BillingEditorResyncMaterialDataModal__list__item__value__label">
                            {readable.value}
                        </span>
                        <span class="BillingEditorResyncMaterialDataModal__list__item__value__details">
                            {readable.details}
                        </span>
                    </span>
                );
            };

            return (
                <Fragment>
                    <div class="BillingEditorResyncExtraDataModal__body">
                        <form class="BillingEditorResyncExtraDataModal__form" onSubmit={handleSubmit}>
                            <table class="BillingEditorResyncExtraDataModal__list">
                                {RESYNCHRONIZABLE_FIELDS.map((field: ResynchronizableField) => {
                                    const unsyncedDatum = field !== 'taxes' ? extra[field] : null;

                                    // - Pour le champ `taxes`, on considère l'ensemble des
                                    //   champs liés à la taxe (régime, code, id, composantes).
                                    const isUnsynced = field !== 'taxes' ? (unsyncedDatum! as any).isUnsynced : (
                                        extra.tax_regime.isUnsynced ||
                                        extra.tax_exemption_code.isUnsynced ||
                                        extra.tax_id.isUnsynced ||
                                        extra.taxes.isUnsynced
                                    );

                                    const isResyncable = field !== 'taxes' ? (unsyncedDatum! as any).isResyncable : (
                                        extra.tax_regime.isResyncable ||
                                        extra.tax_exemption_code.isResyncable ||
                                        extra.tax_id.isResyncable ||
                                        extra.taxes.isResyncable
                                    );

                                    if (!isUnsynced || !isResyncable) {
                                        return null;
                                    }
                                    const isSelected = selection.includes(field);

                                    const renderCurrentValue = (): JSX.Node => (
                                        renderTaxValue({
                                            regime: extra.tax_regime.current!,
                                            exemptionCode: extra.tax_exemption_code.current,
                                            taxId: extra.tax_id.current,
                                            taxes: extra.taxes.current,
                                        })
                                    );

                                    const renderBaseValue = (): JSX.Node => (
                                        renderTaxValue({
                                            regime: extra.tax_regime.base!,
                                            exemptionCode: extra.tax_exemption_code.base,
                                            taxId: extra.tax_id.base,
                                            taxes: extra.taxes.base,
                                        })
                                    );

                                    return (
                                        <tr
                                            key={field}
                                            onClick={() => { handleRowClick(field); }}
                                            class={[
                                                'BillingEditorResyncExtraDataModal__list__item',
                                                { 'BillingEditorResyncExtraDataModal__list__item--selected': isSelected },
                                            ]}
                                        >
                                            <td
                                                class={[
                                                    'BillingEditorResyncExtraDataModal__list__item__col',
                                                    'BillingEditorResyncExtraDataModal__list__item__col--checkbox',
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
                                                    'BillingEditorResyncExtraDataModal__list__item__col',
                                                    'BillingEditorResyncExtraDataModal__list__item__col--name',
                                                ]}
                                            >
                                                {__(`fields.${field}`)}
                                            </td>
                                            <td
                                                class={[
                                                    'BillingEditorResyncExtraDataModal__list__item__col',
                                                    'BillingEditorResyncExtraDataModal__list__item__col--current-value',
                                                ]}
                                            >
                                                {renderCurrentValue()}
                                            </td>
                                            <td
                                                class={[
                                                    'BillingEditorResyncExtraDataModal__list__item__col',
                                                    'BillingEditorResyncExtraDataModal__list__item__col--revert-value',
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
                    <div class="BillingEditorResyncExtraDataModal__footer">
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
            <div class="BillingEditorResyncExtraDataModal">
                <div class="BillingEditorResyncExtraDataModal__header">
                    <h2 class="BillingEditorResyncExtraDataModal__header__title">
                        {__('title', { name: extra.description! })}
                    </h2>
                    <Button
                        type="close"
                        class="BillingEditorResyncExtraDataModal__header__close-button"
                        onClick={handleClose}
                    />
                </div>
                {renderContent()}
            </div>
        );
    },
});

export default BillingEditorResyncExtraDataModal;
