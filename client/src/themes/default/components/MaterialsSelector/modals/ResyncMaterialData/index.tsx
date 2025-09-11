import './index.scss';
import formatAmount from '@/utils/formatAmount';
import { defineComponent } from 'vue';
import getUnsyncedData from '../../utils/getUnsyncedData';
import apiBookings, { BookingEntity } from '@/stores/api/bookings';
import isMaterialResyncable from '../../utils/isMaterialResyncable';
import Fragment from '@/components/Fragment';
import Button from '@/themes/default/components/Button';
import StateMessage, { State } from '@/themes/default/components/StateMessage';

import type Decimal from 'decimal.js';
import type { MaterialResynchronizableField } from '@/stores/api/bookings';
import type { PropType } from 'vue';
import type { Bookable, EmbeddedMaterial, SourceMaterial } from '../../_types';
import type { UnsyncedData, UnsyncedDataValue } from '../../utils/getUnsyncedData';

type Props = {
    /** Le bookable ({@see {@link Bookable}}). */
    bookable: Bookable,

    /** Matériel dont on veut resynchroniser les données. */
    material: SourceMaterial,

    /** Doit-on afficher les informations liées à la facturation ? */
    withBilling: boolean,
};

type Data = {
    isSaving: boolean,
    selection: MaterialResynchronizableField[],
};

/**
 * Fenêtre modale permettant la resynchronisation
 * des données d'un matériel.
 */
const ResyncMaterialDataModal = defineComponent({
    name: 'ResyncMaterialDataModal',
    modal: {
        width: 600,
        draggable: true,
        clickToClose: false,
    },
    props: {
        bookable: {
            type: Object as PropType<Props['bookable']>,
            required: true,
        },
        material: {
            type: Object as PropType<Props['material']>,
            required: true,
        },
        withBilling: {
            type: Boolean as PropType<Required<Props>['withBilling']>,
            default: false,
        },
    },
    emits: ['close'],
    data: (): Data => ({
        isSaving: false,
        selection: [],
    }),
    computed: {
        unsyncedData(): UnsyncedData {
            const { material, withBilling } = this;
            return getUnsyncedData(material, withBilling);
        },

        isAlreadySync(): boolean {
            const { unsyncedData } = this;

            return !Object.values(unsyncedData).some(
                (datum: UnsyncedDataValue<unknown>) => datum.isUnsynced,
            );
        },

        isResyncable(): boolean {
            const { material, isAlreadySync, withBilling } = this;
            return !isAlreadySync && isMaterialResyncable(material, withBilling);
        },

        hasSelected(): boolean {
            if (!this.isResyncable || this.isAlreadySync) {
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

        handleCheckbox(e: InputEvent, field: keyof UnsyncedData) {
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

        handleRowClick(field: keyof UnsyncedData) {
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

            const { __, bookable, material, selection } = this;
            this.isSaving = true;

            try {
                const updatedMaterial: EmbeddedMaterial = await apiBookings.resynchronizeMaterial(
                    BookingEntity.EVENT,
                    bookable.id,
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

        __(key: string, params?: Record<string, number | string>, count?: number): string {
            key = !key.startsWith('global.')
                ? `components.MaterialsSelector.modals.resync-material-data.${key}`
                : key.replace(/^global\./, '');

            return this.$t(key, params, count);
        },
    },
    render() {
        const {
            __,
            selection,
            unsyncedData,
            hasSelected,
            isSaving,
            isResyncable,
            isAlreadySync,
            withBilling,
            handleClose,
            handleSubmit,
            handleRowClick,
            handleCheckbox,
        } = this;

        const renderContent = (): JSX.Element => {
            if (isAlreadySync || !isResyncable) {
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
                    <div class="ResyncMaterialDataModal__body">
                        <form class="ResyncMaterialDataModal__form" onSubmit={handleSubmit}>
                            <table class="ResyncMaterialDataModal__list">
                                {(Object.entries(unsyncedData) as any).map(
                                    <T extends keyof UnsyncedData>([field, unsyncedDatum]: [T, UnsyncedData[T]]) => {
                                        if (undefined === unsyncedDatum || !unsyncedDatum.isUnsynced || !unsyncedDatum.isResyncable) {
                                            return null;
                                        }

                                        if (!withBilling && ['unit_price', 'degressive_rate'].includes(field)) {
                                            return null;
                                        }

                                        const isSelected = selection.includes(field);

                                        const currentValue: string = field !== 'unit_price'
                                            ? (unsyncedDatum.current as Decimal | string).toString()
                                            : formatAmount(
                                                (unsyncedDatum as Required<UnsyncedData>['unit_price']).current.price,
                                                (unsyncedDatum as Required<UnsyncedData>['unit_price']).current.currency,
                                            );

                                        const baseValue: string = field !== 'unit_price'
                                            ? (unsyncedDatum.base as Decimal | string).toString()
                                            : formatAmount(
                                                (unsyncedDatum as Required<UnsyncedData>['unit_price']).base.price,
                                                (unsyncedDatum as Required<UnsyncedData>['unit_price']).base.currency,
                                            );

                                        return (
                                            <tr
                                                key={field}
                                                onClick={() => { handleRowClick(field); }}
                                                class={[
                                                    'ResyncMaterialDataModal__list__item',
                                                    { 'ResyncMaterialDataModal__list__item--selected': isSelected },
                                                ]}
                                            >
                                                <td
                                                    class={[
                                                        'ResyncMaterialDataModal__list__item__col',
                                                        'ResyncMaterialDataModal__list__item__col--checkbox',
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
                                                        'ResyncMaterialDataModal__list__item__col',
                                                        'ResyncMaterialDataModal__list__item__col--name',
                                                    ]}
                                                >
                                                    {__(`fields.${field}`)}
                                                </td>
                                                <td
                                                    class={[
                                                        'ResyncMaterialDataModal__list__item__col',
                                                        'ResyncMaterialDataModal__list__item__col--current-value',
                                                    ]}
                                                >
                                                    {currentValue}
                                                </td>
                                                <td
                                                    class={[
                                                        'ResyncMaterialDataModal__list__item__col',
                                                        'ResyncMaterialDataModal__list__item__col--revert-value',
                                                    ]}
                                                >
                                                    {baseValue}
                                                </td>
                                            </tr>
                                        );
                                    },
                                )}
                            </table>
                        </form>
                    </div>
                    <div class="ResyncMaterialDataModal__footer">
                        <Button
                            type="primary"
                            loading={isSaving}
                            disabled={!hasSelected}
                            onClick={handleSubmit}
                        >
                            {__('resynchronize-data')}
                        </Button>
                    </div>
                </Fragment>
            );
        };

        return (
            <div class="ResyncMaterialDataModal">
                <div class="ResyncMaterialDataModal__header">
                    <h2 class="ResyncMaterialDataModal__header__title">
                        {__('title', { name: unsyncedData.name.current })}
                    </h2>
                    <Button
                        type="close"
                        class="ResyncMaterialDataModal__header__close-button"
                        onClick={handleClose}
                    />
                </div>
                {renderContent()}
            </div>
        );
    },
});

export default ResyncMaterialDataModal;
