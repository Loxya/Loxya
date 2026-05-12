import get from 'lodash/get';
import { defineComponent } from 'vue';

import type { PropType, CreateElement } from 'vue';
import type { Datum, RawColumn } from '../@types';

type Props<
    K extends string = 'id',
    D extends Datum<K> = Datum<K>,
> = {
    /** L'index de la ligne. */
    rowIndex: number,

    /** La colonne dont on veut afficher l'entête. */
    column: RawColumn,

    /** Les données de la ligne. */
    datum: D,
};

/** Une cellule de tableau. */
const TableCell = defineComponent({
    name: 'TableCell',
    props: {
        rowIndex: {
            type: Number as PropType<Props['rowIndex']>,
            required: true,
        },
        column: {
            type: Object as PropType<Props['column']>,
            required: true,
        },
        datum: {
            type: Object as PropType<Props['datum']>,
            required: true,
        },
    },
    render(h: CreateElement) {
        const { rowIndex, datum, column } = this;

        const className = [column.class, 'Table__cell', {
            'Table__cell--actions': column.key === 'actions',
        }];

        const content: JSX.Node = (() => {
            if (typeof column.render !== 'undefined') {
                return column.render(h, datum, rowIndex);
            }

            const rawValue = get(datum, column.key, undefined);
            return typeof rawValue === 'string' || typeof rawValue === 'number'
                ? rawValue
                : null;
        })();

        return (
            <td class={className}>
                {content}
            </td>
        );
    },
});

export default TableCell;
