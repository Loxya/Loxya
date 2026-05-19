import { defineComponent } from 'vue';
import TableHeading from './TableHeading';

import type { PropType } from 'vue';
import type { RawColumn, RawColumns } from '../@types';

type Props = {
    /** Les colonnes du tableau. */
    columns: RawColumns,

    /**
     * Fonction appelée lorsque l'utilisateur demande
     * à trier le tableau via une colonne (ou à inverser
     * le sens de tri si déjà trié via cette colonne)
     *
     * @param column - L'identifiant de la colonne sur laquelle
     *                 le tri doit-être opéré ou inversé.
     */
    onOrderBy?(column: RawColumn['key']): void,
};

/** L'entête du tableau. */
const TableHead = defineComponent({
    name: 'TableHead',
    props: {
        columns: {
            type: Array as PropType<Props['columns']>,
            required: true,
        },
        // eslint-disable-next-line vue/no-unused-properties
        onOrderBy: {
            type: Function as PropType<Props['onOrderBy']>,
            default: undefined,
        },
    },
    emits: ['orderBy'],
    methods: {
        // ------------------------------------------------------
        // -
        // -    Handlers
        // -
        // ------------------------------------------------------

        handleOrderBy(columnKey: RawColumn['key']) {
            this.$emit('orderBy', columnKey);
        },
    },
    render() {
        const { columns, handleOrderBy } = this;

        return (
            <thead class="Table__head">
                <tr class="Table__head__row">
                    {columns.map((column: RawColumn) => (
                        <TableHeading
                            key={column.key}
                            column={column}
                            onOrderBy={() => {
                                handleOrderBy(column.key);
                            }}
                        />
                    ))}
                </tr>
            </thead>
        );
    },
});

export default TableHead;
