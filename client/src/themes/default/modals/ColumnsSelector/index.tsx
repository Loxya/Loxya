import './index.scss';
import upperFirst from 'lodash/upperFirst';
import { defineComponent } from 'vue';
import SwitchToggle from '@/themes/default/components/SwitchToggle';
import Button from '@/themes/default/components/Button';

import type { PropType } from 'vue';
import type { Column } from '@/themes/default/components/Table';

type Props = {
    /** Les colonnes, telles que passées au component `<Table />`. */
    columns: Column[],

    /** Liste des colonnes sélectionnées par défaut. */
    defaultSelected?: Array<Column['key']>,

    /**
     * Fonction appelée lorsque la liste des colonnes visible à changé.
     *
     * @param columns - Les colonnes sélectionnées.
     */
    onChange?(columns: Array<Column['key']>): void,
};

type Data = {
    values: Array<Column['key']>,
};

/** Modale permettant de sélectionner des colonnes (de tableau notamment). */
const ColumnsSelector = defineComponent({
    name: 'ColumnsSelector',
    modal: {
        width: 280,
    },
    props: {
        columns: {
            type: Array as PropType<Props['columns']>,
            required: true,
        },
        defaultSelected: {
            type: Array as PropType<Required<Props>['defaultSelected']>,
            default: () => [],
        },
        onChange: {
            type: Function as PropType<Props['onChange']>,
            default: undefined,
        },
    },
    emits: ['close'],
    data(): Data {
        return {
            values: [...this.defaultSelected],
        };
    },
    methods: {
        // ------------------------------------------------------
        // -
        // -    Handlers
        // -
        // ------------------------------------------------------

        handleColumnChange(key: Column['key'], isNowVisible: boolean) {
            const column = this.columns.find((_column: Column) => _column.key === key);
            if (column === undefined || !this.isHideable(column)) {
                return;
            }

            const index = this.values.indexOf(column.key);
            if ((index === -1 && !isNowVisible) || (index !== -1 && isNowVisible)) {
                return;
            }

            if (isNowVisible) {
                this.values.push(column.key);
            } else {
                this.values.splice(index, 1);
            }

            const { onChange } = this.$props;
            if (onChange) {
                onChange([...this.values]);
            }
        },

        handleClose() {
            this.$emit('close', [...this.values]);
        },

        // ------------------------------------------------------
        // -
        // -    Méthodes internes
        // -
        // ------------------------------------------------------

        getColumnLabel(column: Column): string {
            const { __ } = this;

            if ((column.label ?? column.title) !== undefined) {
                return (column.label ?? column.title)!;
            }

            if (column.key === 'actions') {
                return __('column-actions');
            }

            // eslint-disable-next-line no-console
            console.warn(
                `Missing column label / title for column with key \`${column.key}\`, ` +
                'used the key as "better than nothing" solution.',
            );
            return upperFirst(column.key);
        },

        isHideable(column: Column): boolean {
            return column.hideable ?? !['name', 'actions'].includes(column.key);
        },

        __(key: string, params?: Record<string, number | string>, count?: number): string {
            key = !key.startsWith('global.')
                ? `modal.columns-selector.${key}`
                : key.replace(/^global\./, '');

            return this.$t(key, params, count);
        },
    },
    render() {
        const {
            __,
            columns,
            values,
            isHideable,
            getColumnLabel,
            handleColumnChange,
            handleClose,
        } = this;

        return (
            <div class="ColumnsSelector">
                <header class="ColumnsSelector__header">
                    <h2 class="ColumnsSelector__header__title">{__('title')}</h2>
                    <Button
                        type="close"
                        class="ColumnsSelector__header__close-button"
                        onClick={handleClose}
                    />
                </header>
                <div class="ColumnsSelector__body">
                    <ul class="ColumnsSelector__list">
                        {columns.map((column: Column) => {
                            const hideable = isHideable(column);
                            const selected = values.includes(column.key);

                            return (
                                <li
                                    key={column.key}
                                    class={['ColumnsSelector__list__item', {
                                        'ColumnsSelector__list__item--not-selected': !selected,
                                        'ColumnsSelector__list__item--readonly': !hideable,
                                    }]}
                                >
                                    <SwitchToggle
                                        class="ColumnsSelector__list__item__switch"
                                        value={selected}
                                        disabled={!hideable}
                                        onChange={(isVisible: boolean) => {
                                            handleColumnChange(column.key, isVisible);
                                        }}
                                        hideLabels
                                    />
                                    <span class="ColumnsSelector__list__item__label">
                                        {getColumnLabel(column)}
                                    </span>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            </div>
        );
    },
});

export default ColumnsSelector;
