import './index.scss';
import { defineComponent } from 'vue';
import Decimal from 'decimal.js';
import config from '@/globals/config';
import formatAmount from '@/utils/formatAmount';
import apiBookings from '@/stores/api/bookings';
import Fragment from '@/components/Fragment';
import Button from '@/themes/default/components/Button';
import StateMessage, { State } from '@/themes/default/components/StateMessage';
import getReadableTaxData from '../../utils/getReadableTaxData';

import type { PropType } from 'vue';
import type Country from '@/utils/country';
import type { Booking } from '@/stores/api/bookings';
import type { BillingMaterial, LineTaxDetail } from '../../_types';

type Props = {
    /** Le booking (événement, réservation ou demande de réservation). */
    booking: Booking,

    /** Matériel dont on veut resynchroniser les données. */
    material: BillingMaterial,

    /**
     * Fonction appelée lorsque l'utilisateur souhaite fermer la fenêtre modale.
     *
     * @param updatedMaterial - La ligne de matériel mise à jour.
     *                          (uniquement si l'utilisateur n'a pas fermé la modale sans modifier)
     */
    onClose?(updatedMaterial?: BillingMaterial): void,
};

const RESYNCHRONIZABLE_FIELDS = [
    'name',
    'reference',
    'unit_price',
    'unit_replacement_price',
    'degressive_rate',
    'taxes',
] as const;

type ResynchronizableField = (typeof RESYNCHRONIZABLE_FIELDS)[number];

type Data = {
    isSaving: boolean,
    selection: ResynchronizableField[],
};

/**
 * Fenêtre modale permettant la resynchronisation
 * des données d'un matériel de la facturation.
 */
const BillingEditorResyncMaterialDataModal = defineComponent({
    name: 'BillingEditorResyncMaterialDataModal',
    modal: {
        width: 600,
        dismissible: false,
    },
    props: {
        booking: {
            type: Object as PropType<Props['booking']>,
            required: true,
        },
        material: {
            type: Object as PropType<Props['material']>,
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
            const { material } = this;
            if (!material.is_resyncable || !material.is_unsynced) {
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

            const { __, booking, material, selection } = this;
            this.isSaving = true;

            try {
                const updatedMaterial = await apiBookings.resynchronizeMaterial(
                    booking.entity,
                    booking.id,
                    material.id,
                    selection,
                );
                this.$toasted.success(__('selected-data-resynchronized'));
                this.$emit('close', updatedMaterial);
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
                    ? `modals.resync-material-data.${key}`
                    : key.replace(/^component\./, '');
            }
            return this.__c(key, params, count);
        },
    },
    render() {
        const {
            __,
            __c,
            booking,
            material,
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
            if (!material.is_unsynced || !material.is_resyncable) {
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
                    <div class="BillingEditorResyncMaterialDataModal__body">
                        <form class="BillingEditorResyncMaterialDataModal__form" onSubmit={handleSubmit}>
                            <table class="BillingEditorResyncMaterialDataModal__list">
                                {RESYNCHRONIZABLE_FIELDS.map((field: ResynchronizableField) => {
                                    const unsyncedDatum = field !== 'taxes' ? material[field] : null;

                                    // - Pour le champ `taxes`, on considère l'ensemble des
                                    //   champs liés à la taxe (régime, code, id, composantes).
                                    const isUnsynced = field !== 'taxes' ? unsyncedDatum!.isUnsynced : (
                                        material.tax_regime.isUnsynced ||
                                        material.tax_exemption_code.isUnsynced ||
                                        material.tax_id.isUnsynced ||
                                        material.taxes.isUnsynced
                                    );

                                    const isResyncable = field !== 'taxes' ? unsyncedDatum!.isResyncable : (
                                        material.tax_regime.isResyncable ||
                                        material.tax_exemption_code.isResyncable ||
                                        material.tax_id.isResyncable ||
                                        material.taxes.isResyncable
                                    );

                                    if (!isUnsynced || !isResyncable) {
                                        return null;
                                    }
                                    const isSelected = selection.includes(field);

                                    const renderCurrentValue = (): JSX.Node => {
                                        if (!['unit_price', 'unit_replacement_price', 'taxes'].includes(field)) {
                                            return unsyncedDatum!.current!.toString();
                                        }

                                        if (field === 'unit_price') {
                                            return formatAmount(
                                                (unsyncedDatum as BillingMaterial['unit_price']).current,
                                                booking.currency,
                                            );
                                        }

                                        if (field === 'unit_replacement_price') {
                                            return formatAmount(
                                                (unsyncedDatum as BillingMaterial['unit_replacement_price']).current ?? new Decimal(0),
                                                booking.currency,
                                            );
                                        }

                                        return renderTaxValue({
                                            regime: material.tax_regime.current!,
                                            exemptionCode: material.tax_exemption_code.current,
                                            taxId: material.tax_id.current,
                                            taxes: material.taxes.current,
                                        });
                                    };

                                    const renderBaseValue = (): JSX.Node => {
                                        if (!['unit_price', 'unit_replacement_price', 'taxes'].includes(field)) {
                                            return (unsyncedDatum!.base as Decimal | string).toString();
                                        }

                                        if (field === 'unit_price') {
                                            return formatAmount(
                                                (unsyncedDatum as BillingMaterial['unit_price']).base.amount,
                                                (unsyncedDatum as BillingMaterial['unit_price']).base.currency,
                                            );
                                        }

                                        if (field === 'unit_replacement_price') {
                                            return formatAmount(
                                                (unsyncedDatum as BillingMaterial['unit_replacement_price']).base ?? new Decimal(0),
                                                booking.currency,
                                            );
                                        }

                                        return renderTaxValue({
                                            regime: material.tax_regime.base!,
                                            exemptionCode: material.tax_exemption_code.base,
                                            taxId: material.tax_id.base,
                                            taxes: material.taxes.base,
                                        });
                                    };

                                    return (
                                        <tr
                                            key={field}
                                            onClick={() => { handleRowClick(field); }}
                                            class={[
                                                'BillingEditorResyncMaterialDataModal__list__item',
                                                { 'BillingEditorResyncMaterialDataModal__list__item--selected': isSelected },
                                            ]}
                                        >
                                            <td
                                                class={[
                                                    'BillingEditorResyncMaterialDataModal__list__item__col',
                                                    'BillingEditorResyncMaterialDataModal__list__item__col--checkbox',
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
                                                    'BillingEditorResyncMaterialDataModal__list__item__col',
                                                    'BillingEditorResyncMaterialDataModal__list__item__col--name',
                                                ]}
                                            >
                                                {__(`fields.${field}`)}
                                            </td>
                                            <td
                                                class={[
                                                    'BillingEditorResyncMaterialDataModal__list__item__col',
                                                    'BillingEditorResyncMaterialDataModal__list__item__col--current-value',
                                                ]}
                                            >
                                                {renderCurrentValue()}
                                            </td>
                                            <td
                                                class={[
                                                    'BillingEditorResyncMaterialDataModal__list__item__col',
                                                    'BillingEditorResyncMaterialDataModal__list__item__col--revert-value',
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
                    <div class="BillingEditorResyncMaterialDataModal__footer">
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
            <div class="BillingEditorResyncMaterialDataModal">
                <div class="BillingEditorResyncMaterialDataModal__header">
                    <h2 class="BillingEditorResyncMaterialDataModal__header__title">
                        {__('title', { name: material.name.current })}
                    </h2>
                    <Button
                        type="close"
                        class="BillingEditorResyncMaterialDataModal__header__close-button"
                        onClick={handleClose}
                    />
                </div>
                {renderContent()}
            </div>
        );
    },
});

export default BillingEditorResyncMaterialDataModal;
