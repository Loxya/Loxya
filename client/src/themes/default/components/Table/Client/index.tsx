import '../index.scss';
import get from 'lodash/get';
import warning from 'warning';
import clone from 'lodash/cloneDeep';
import { defineComponent } from 'vue';
import config from '@/globals/config';
import generateUniqueId from 'lodash/uniqueId';
import Table from '../@components/Table';
import { Variant } from '../@constants';
import { storeState, getStoredState } from '../@utils';

// - Modales
import ColumnsSelector from '@/themes/default/modals/ColumnsSelector';

import type { ComponentRef, CreateElement, PropType } from 'vue';
import type { Column, Columns, ColumnSorter } from './_types';
import type {
    Datum,
    Identifier,
    OrderBy,
    RawColumn,
    RawColumns,
    RawOrderBy,
    EmptyMessage,
    RenderFunction,
} from '../@types';

export type Props<
    K extends string = 'id',
    D extends Datum<K> = Datum<K>,
    Cs extends Columns<D, K> = Columns<D, K>,
> = {
    /**
     * Nom unique du tableau.
     *
     * Si cette prop. est passée, l'état du tableau sera persisté pour que
     * l'utilisateur puisse le récupérer dans le même état la prochaine fois.
     * (on parle ici des colonnes affichées, du tri, etc.)
     */
    name?: string | undefined,

    /**
     * Les colonnes du tableau.
     *
     * Cette prop. doit contenir un tableau d'objets, chaque objet
     * représentant une colonne avec les informations permettant
     * d'afficher son header, de formater son contenu, etc.
     *
     * Voir {@see {@link Columns}} pour le format des données des colonnes.
     */
    columns: Cs,

    /** Les données du tableau. */
    data: D[],

    /**
     * Le nom de la clé contenant l'identifiant unique de chaque
     * ligne dans le jeu de données.
     *
     * @default 'id'
     */
    uniqueKey?: K,

    /**
     * Variante de la présentation du tableau.
     *
     * Voir {@link Variant}
     */
    variant?: Variant | `${Variant}`,

    /**
     * Une fonction permettant de rendre la ligne de détails pour une ligne du tableau.
     *
     * Si cette prop. est spécifiée, le tableau sera réputé contenir des lignes de détails.
     */
    details?: RenderFunction<D, K>,

    /**
     * Les identifiants des lignes pour lesquelles le détails doit être ouvert
     * lorsque le tableau propose une ligne de détails pour certaines lignes du tableau.
     */
    openDetails?: Identifier[],

    /**
     * Permet d'activer ou de désactiver la pagination.
     *
     * @default true
     */
    paginated?: boolean,

    /**
     * Le header du tableau doit-il rester visible lors du scroll ?
     *
     * @default false
     */
    sticky?: boolean,

    /**
     * Permet d'activer ou de désactiver le réordonnancement des lignes du tableau.
     *
     * @default false
     */
    orderable?: boolean,

    /**
     * Le tableau doit-il être sans ligne d'en tête ?
     *
     * @default false
     */
    headless?: boolean,

    /**
     * L'ordre dans lequel le tableau doit être triée initialement.
     *
     * Peut contenir:
     * - Soit un object avec la colonne et le sens dans lequel cette
     *   colonne doit être triée ({@see {@link OrderBy}}).
     * - Soit le nom de la colonne qui sera triée de façon ascendante.
     *
     * Si cette prop. n'est pas passée, le tableau conservera son tri initial.
     */
    defaultOrderBy?: OrderBy<D, Cs, K> | OrderBy<D, Cs, K>['column'],

    /**
     * Classe(s) qui seront ajoutées aux lignes du tableau.
     *
     * Différents formats sont acceptés:
     * - Les formats acceptés par défaut par Vue pour les classes.
     * - Une fonction a qui le jeu de données de chaque ligne sera passé
     *   et qui devra renvoyer des classes dans les formats acceptés par
     *   Vue (cf. ci-dessus).
     */
    rowClass?: JSX.NodeClass | ((row: D) => JSX.NodeClass),

    /**
     * Permet de customiser le contenu affiché lorsque le tableau est vide.
     *
     * Accepte soit une chaîne (= texte du message), soit un objet
     * {@link EmptyMessage} pour customiser la variante / l'action.
     */
    emptyMessage?: string | EmptyMessage,

    /**
     * La page de départ, lorsque le tableau est affiché.
     *
     * @default 1
     */
    initialPage?: number,

    /**
     * Le nombre maximum d'enregistrements par page, pour
     * surcharger la valeur par défaut de la configuration.
     *
     * @default {config.defaultPaginationLimit}
     */
    perPage?: number,

    /**
     * Fonction appelée lorsque l'utilisateur a cliqué sur une ligne.
     *
     * @param datum - Données de la ligne cliquée.
     */
    onRowClick?(datum: D): void,

    /**
     * Fonction appelée lorsque l'utilisateur a réordonné une ligne.
     *
     * @param datum - Données de la ligne déplacée.
     * @param newIndex - Nouvel index de la ligne.
     */
    onRowDrag?(datum: D, newIndex: number): void,
};

type InstanceProperties = {
    uniqueId: string | undefined,
};

type Data = {
    page: number,
    limit: number,
    orderBy: RawOrderBy | null,
    columnsDisplay: Record<string, boolean>,
};

/**
 * Un tableau dont les données sont passés à l'initialisation.
 *
 * Si vous avez besoin de récupérer les données de manière asynchrone,
 * utilisez plutôt `<ServerTable />`.
 */
const ClientTable = defineComponent({
    name: 'ClientTable',
    props: {
        name: {
            type: String as PropType<Props['name']>,
            default: undefined,
        },
        columns: {
            type: Array as PropType<Props['columns']>,
            required: true,
        },
        uniqueKey: {
            type: String as PropType<Required<Props>['uniqueKey']>,
            default: 'id',
        },
        data: {
            type: Array as PropType<Props['data']>,
            required: true,
        },
        variant: {
            type: String as PropType<Required<Props>['variant']>,
            default: Variant.DEFAULT,
            validator: (value: unknown) => (
                typeof value === 'string' &&
                Object.values(Variant).includes(value as any)
            ),
        },
        details: {
            type: Function as PropType<Props['details']>,
            default: undefined,
        },
        openDetails: {
            type: Array as PropType<Required<Props>['openDetails']>,
            default: () => [],
        },
        paginated: {
            type: Boolean as PropType<Required<Props>['paginated']>,
            default: true,
        },
        sticky: {
            type: Boolean as PropType<Required<Props>['sticky']>,
            default: false,
        },
        orderable: {
            type: Boolean as PropType<Required<Props>['orderable']>,
            default: false,
        },
        headless: {
            type: Boolean as PropType<Required<Props>['headless']>,
            default: false,
        },
        defaultOrderBy: {
            type: [Object, String] as PropType<Props['defaultOrderBy']>,
            default: undefined,
        },
        rowClass: {
            type: [
                String,
                Number,
                Array,
                Boolean,
                Object,
                Function,
            ] as PropType<Props['rowClass']>,
            default: undefined,
        },
        emptyMessage: {
            type: [String, Object] as PropType<Props['emptyMessage']>,
            default: undefined,
        },
        initialPage: {
            type: Number as PropType<Required<Props>['initialPage']>,
            default: 1,
            validator: (value: number) => value > 0,
        },
        perPage: {
            type: Number as PropType<Required<Props>['perPage']>,
            default: () => config.defaultPaginationLimit,
            validator: (value: number) => value > 0,
        },
        // eslint-disable-next-line vue/no-unused-properties
        onRowClick: {
            type: Function as PropType<Props['onRowClick']>,
            default: undefined,
        },
        // eslint-disable-next-line vue/no-unused-properties
        onRowDrag: {
            type: Function as PropType<Props['onRowDrag']>,
            default: undefined,
        },
    },
    emits: ['rowClick', 'rowDrag'],
    setup: (): InstanceProperties => ({
        uniqueId: undefined,
    }),
    data(): Data {
        const storedState = this.name !== undefined
            ? getStoredState(this.name)
            : null;

        const limit = this.paginated ? Math.max(1, this.perPage) : Infinity;
        const totalPages = this.paginated ? Math.ceil(this.data.length / limit) : 1;
        const page = this.paginated ? Math.max(1, Math.min(this.initialPage, totalPages)) : 1;

        return {
            page,
            limit,
            columnsDisplay: storedState?.columns ?? {},
            orderBy: storedState?.orderBy ?? (() => {
                if (this.defaultOrderBy !== undefined) {
                    const columnKey = typeof this.defaultOrderBy !== 'string'
                        ? this.defaultOrderBy.column
                        : this.defaultOrderBy;

                    const ascending = typeof this.defaultOrderBy !== 'string'
                        ? (this.defaultOrderBy.ascending ?? null)
                        : null;

                    const column = this.columns.find(
                        (_column: Column) => _column.key === columnKey,
                    );

                    return {
                        column: columnKey,
                        ascending: ascending ?? !column?.defaultSortDesc,
                    };
                }
                return null;
            })(),
        };
    },
    computed: {
        displayedColumns(): string[] {
            return this.columns
                .filter((column: Column) => {
                    const defaultVisible = !(column.defaultHidden ?? false);
                    return this.columnsDisplay[column.key] ?? defaultVisible;
                })
                .map((column: Column) => column.key);
        },

        normalizedColumns(): RawColumns {
            const { displayedColumns } = this;

            return this.columns.reduce(
                (acc: RawColumns, column: Column) => {
                    if (!displayedColumns.includes(column.key)) {
                        return acc;
                    }

                    const rawRender = column.render;
                    const render = rawRender === undefined ? undefined : (
                        (h: CreateElement, row: any, index: number): JSX.Node => {
                            const renderedColumn = rawRender(h, row, index);

                            return column.key === 'actions'
                                ? <div class="Table__cell__actions">{renderedColumn}</div>
                                : renderedColumn;
                        }
                    );

                    return acc.concat({
                        key: column.key,
                        title: column.title,
                        sortable: !!column.sortable,
                        class: column.class,
                        render,
                    });
                },
                [],
            );
        },

        columnsSorting(): Map<Column['key'], ColumnSorter> {
            return this.columns
                .filter(({ sortable }: Column) => !!sortable)
                .reduce(
                    (acc: Map<Column['key'], ColumnSorter>, column: Column) => {
                        const columnSorter = typeof column.sortable === 'function'
                            ? column.sortable
                            : undefined;

                        if (columnSorter !== undefined) {
                            acc.set(column.key, columnSorter);
                        }
                        return acc;
                    },
                    new Map<Column['key'], ColumnSorter>(),
                );
        },

        count(): number {
            return this.data.length;
        },

        sortedData(): any[] {
            let data = clone(this.data);

            if (this.orderBy !== null) {
                const { column, ascending } = this.orderBy;

                const sorter = this.columnsSorting.get(column)?.(ascending) ?? (
                    (a: unknown, b: unknown) => {
                        let aVal = get(a, column, '');
                        let bVal = get(b, column, '');

                        const dir = ascending ? 1 : -1;
                        if (typeof aVal === 'string') {
                            aVal = aVal.toLowerCase();
                        }
                        if (typeof bVal === 'string') {
                            bVal = bVal.toLowerCase();
                        }
                        return aVal > bVal ? dir : -dir;
                    }
                );
                data = data.toSorted(sorter);
            }

            const offset = (this.page - 1) * this.limit;
            return data.splice(offset, this.limit);
        },

        hasRowClickListener(): boolean {
            return Boolean(this.$listeners.rowClick);
        },

        shouldPersistState(): boolean {
            return this.name !== undefined;
        },

        totalPages(): number {
            if (!this.paginated) {
                return 1;
            }
            return Math.ceil(this.count / this.limit);
        },
    },
    watch: {
        orderBy: {
            deep: true,
            immediate: true,
            handler() {
                if (this.shouldPersistState) {
                    storeState(this.name!, {
                        orderBy: this.orderBy,
                        columns: this.columnsDisplay,
                    });
                }
            },
        },
        columnsDisplay: {
            deep: true,
            immediate: true,
            handler() {
                if (this.shouldPersistState) {
                    storeState(this.name!, {
                        orderBy: this.orderBy,
                        columns: this.columnsDisplay,
                    });
                }
            },
        },
        data() {
            if (this.page > this.totalPages) {
                this.page = Math.max(1, this.totalPages);
            }
        },
        paginated(newPaginated: boolean) {
            this.limit = newPaginated ? Math.max(1, this.perPage) : Infinity;
            this.page = newPaginated ? Math.max(1, Math.min(this.initialPage, this.totalPages)) : 1;
        },
    },
    created() {
        const { $options } = this;

        warning(
            !this.orderable || !this.paginated,
            `Enabling both the \`orderable\` and \`paginated\` props at the same
            time will cause issues, as the user won't be able to reorder lines
            beyond the current paginated page.`,
        );

        this.uniqueId = generateUniqueId(`${$options.name!}-`);

        // - Binding
        this.handleChangeVisibleColumns = this.handleChangeVisibleColumns.bind(this);
    },
    methods: {
        // ------------------------------------------------------
        // -
        // -    Handlers
        // -
        // ------------------------------------------------------

        handleRowClick(datum: Datum): void {
            this.$emit('rowClick', datum);
        },

        handleRowDrag(datum: Datum, newIndex: number): void {
            if (!this.orderable) {
                return;
            }
            this.$emit('rowDrag', datum, newIndex);
        },

        handleOrderBy(columnKey: RawColumn['key']) {
            const column = this.columns.find(
                (_column: Column) => _column.key === columnKey,
            );
            if (column === undefined || !column.sortable) {
                return;
            }

            this.page = 1;

            const defaultAscending = !column?.defaultSortDesc;
            if (this.orderBy === null) {
                this.orderBy = {
                    column: column.key,
                    ascending: defaultAscending,
                };
                return;
            }

            this.orderBy.ascending = column.key === this.orderBy.column
                ? !this.orderBy.ascending
                : defaultAscending;

            this.orderBy.column = column.key;
        },

        handleChangeVisibleColumns(newVisibleColumns: string[]): void {
            this.columns.forEach((column: Column) => {
                const visible = newVisibleColumns.includes(column.key);
                this.$set(this.columnsDisplay, column.key, visible);
            });
        },

        handlePaginate(newPage: number) {
            this.setPage(newPage);
        },

        // ------------------------------------------------------
        // -
        // -    API Publique
        // -
        // ------------------------------------------------------

        /**
         * Permet de changer la page courante du tableau (dans le cas ou celui-ci est paginé).
         *
         * @param number - Le numéro de la page à afficher.
         */
        setPage(number: number): void {
            if (!this.paginated && number !== 1) {
                throw new Error('Cannot set page of an unpaginated table.');
            }

            let page = Math.max(1, number);
            if (this.totalPages > 0 && page > this.totalPages) {
                page = this.totalPages;
            }

            this.page = page;
        },

        /**
         * Permet de changer l'ordre des résultats du tableau.
         *
         * @param column - La colonne via laquelle il faut ordonner les résultats.
         * @param ascending - Faut-il ordonner dans l'ordre ascendant ou descendant ?
         */
        setOrder(column: string, ascending: boolean) {
            this.orderBy = { column, ascending };
        },

        /**
         * Permet de changer le nombre de résultats par page du tableau
         * (dans le cas ou celui-ci est paginé).
         *
         * @param number - La nouvelle limite de résultats.
         */
        setLimit(number: number) {
            if (!this.paginated && number !== Infinity) {
                throw new Error('Cannot set limit of an unpaginated table.');
            }

            this.limit = Math.max(1, number);
            this.page = 1;
        },

        /**
         * Permet d'afficher le sélecteur de colonnes du tableau.
         */
        async showColumnsSelector(): Promise<void> {
            const { columns, displayedColumns, handleChangeVisibleColumns } = this;

            const newVisibleColumns: string[] | undefined = (
                await this.$modal.show(ColumnsSelector, {
                    columns,
                    defaultSelected: displayedColumns,
                    onChange: handleChangeVisibleColumns,
                })
            );

            // - Si l'action est annulé dans la modale, on ne change rien.
            if (newVisibleColumns === undefined) {
                return;
            }

            handleChangeVisibleColumns(newVisibleColumns);
        },
    },
    render() {
        const {
            name,
            page,
            limit,
            count,
            sortedData,
            uniqueId,
            variant,
            sticky,
            headless,
            orderBy,
            details,
            openDetails,
            uniqueKey,
            rowClass,
            emptyMessage,
            orderable,
            paginated,
            normalizedColumns: columns,
            hasRowClickListener,
            handleRowDrag,
            handleRowClick,
            handleOrderBy,
            handlePaginate,
        } = this;

        return (
            <Table
                key={name ?? uniqueId!}
                page={page}
                limit={limit}
                count={count}
                uniqueKey={uniqueKey}
                variant={variant}
                sticky={sticky}
                headless={headless}
                orderBy={orderBy}
                clickable={hasRowClickListener}
                orderable={orderable}
                paginated={paginated}
                columns={columns}
                data={sortedData}
                details={details}
                openDetails={openDetails}
                rowClass={rowClass}
                emptyMessage={emptyMessage}
                onOrderBy={handleOrderBy}
                onRowClick={handleRowClick}
                onRowDrag={handleRowDrag}
                onPaginate={handlePaginate}
            />
        );
    },
});

//
// - Exports
//

export { Variant };
export type { Columns, Column };

type ClientTableGeneric = <
    D extends Datum<K>,
    Cs extends Columns<D, K>,
    K extends string = 'id',
>(props: Props<K, D, Cs>) => JSX.Element;

export type ClientTableRef = ComponentRef<typeof ClientTable>;
export default ClientTable as any as ClientTableGeneric;
