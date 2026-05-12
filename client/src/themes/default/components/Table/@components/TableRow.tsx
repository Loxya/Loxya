import { defineComponent } from 'vue';
import TableCell from './TableCell';

import type { PropType } from 'vue';
import type { Datum, RawColumns, RawColumn } from '../@types';

type Props<
    K extends string = 'id',
    D extends Datum<K> = Datum<K>,
    Cs extends RawColumns<D, K> = RawColumns<D, K>,
> = {
    /** L'index de la ligne. */
    index: number,

    /** Les données de la ligne. */
    datum: D,

    /**
     * Les colonnes du tableau.
     *
     * Cette prop. doit contenir un tableau d'objets, chaque objet
     * représentant une colonne avec les informations permettant
     * d'afficher son header, de formater son contenu, etc.
     *
     * Voir {@see {@link RawColumns}} pour le format des données des colonnes.
     */
    columns: Cs,

    /**
     * Classe(s) qui seront ajoutées à la ligne du tableau.
     *
     * Différents formats sont acceptés:
     * - Les formats acceptés par défaut par Vue pour les classes.
     * - Une fonction a qui le jeu de données de chaque ligne sera passé
     *   et qui devra renvoyer des classes dans les formats acceptés par
     *   Vue (cf. ci-dessus).
     */
    rawClass?: JSX.NodeClass | ((row: D) => JSX.NodeClass),

    /**
     * Fonction appelée lorsque l'utilisateur a cliqué sur la ligne.
     *
     * @param event - L'événement d'origine.
     */
    onClick?(event: MouseEvent): void,
};

const TableRow = defineComponent({
    name: 'TableRow',
    props: {
        index: {
            type: Number as PropType<Props['index']>,
            required: true,
        },
        datum: {
            type: Object as PropType<Props['datum']>,
            required: true,
        },
        columns: {
            type: Array as PropType<Props['columns']>,
            required: true,
        },
        rawClass: {
            type: [
                String,
                Number,
                Array,
                Boolean,
                Object,
                Function,
            ] as PropType<Props['rawClass']>,
            default: undefined,
        },
        // eslint-disable-next-line vue/no-unused-properties
        onClick: {
            type: Function as PropType<Props['onClick']>,
            default: undefined,
        },
    },
    emits: ['click'],
    computed: {
        inheritedClass(): JSX.NodeClass {
            const { rawClass } = this;

            return typeof rawClass === 'function'
                ? rawClass(this.datum)
                : rawClass;
        },
    },
    methods: {
        handleClick(e: MouseEvent) {
            if (e.type === 'dblclick') {
                return;
            }

            let currentElement: HTMLElement | null = e.target as HTMLElement;
            while (currentElement && currentElement !== document.body) {
                const { nodeName } = currentElement;
                if (['A', 'BUTTON'].includes(nodeName)) {
                    return;
                }
                currentElement = currentElement.parentElement;
            }

            this.$emit('click');
        },
    },
    render() {
        const {
            index,
            datum,
            columns,
            inheritedClass,
            handleClick,
        } = this;

        return (
            <tr
                class={[inheritedClass, 'Table__row']}
                onClick={handleClick}
            >
                {columns.map((column: RawColumn) => (
                    <TableCell
                        key={column.key}
                        rowIndex={index}
                        column={column}
                        datum={datum}
                    />
                ))}
            </tr>
        );
    },
});

export default TableRow;
