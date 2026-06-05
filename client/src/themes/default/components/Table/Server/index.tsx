import '../index.scss';
import { defineComponent } from 'vue';
import config from '@/globals/config';
import generateUniqueId from 'lodash/uniqueId';
import Table from '../@components/Table';
import { getStoredState, storeState } from '../@utils';
import { Variant } from '../@constants';

// - Modales
import ColumnsSelector from '@/themes/default/modals/ColumnsSelector';

import type { ComponentRef, CreateElement, PropType } from 'vue';
import type { Column, Columns, RequestFunction } from './_types';
import type { PaginationParams, SortableParams } from '@/stores/api/@types';
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

    /**
     * Le nom de la clé contenant l'identifiant unique de chaque
     * ligne dans le jeu de données.
     *
     * @default 'id'
     */
    uniqueKey?: K,

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
     * La fonction permettant de récupérer le jeu de données.
     */
    fetcher: RequestFunction<D, K>,

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
     * Variante de la présentation du tableau.
     *
     * Voir {@link Variant}
     */
    variant?: Variant | `${Variant}`,

    /**
     * Le header du tableau doit-il rester visible lors du scroll ?
     *
     * @default false
     */
    sticky?: boolean,

    /**
     * Le tableau doit-il être sans ligne d'en tête ?
     *
     * @default false
     */
    headless?: boolean,

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
     * Fonction appelée lorsqu'une ligne du tableau est cliquée.
     *
     * @param datum - Les données de la ligne cliquée.
     */
    onRowClick?(datum: D): void,
};

type InstanceProperties = {
    uniqueId: string | undefined,
};

type Data<D extends Datum = Datum> = {
    count: number,
    page: number,
    limit: number,
    data: D[] | undefined,
    orderBy: RawOrderBy | null,
    columnsDisplay: Record<string, boolean>,
};

/**
 * Un tableau dont les données sont récupérées depuis
 * une source de données distante.
 *
 * Si vous avez déjà toutes les données en votre possession à
 * l'initialisation du tableau, utilisez plutôt `<ClientTable />`.
 */
const ServerTable = defineComponent({
    name: 'ServerTable',
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
        fetcher: {
            type: Function as PropType<Props['fetcher']>,
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
        sticky: {
            type: Boolean as PropType<Required<Props>['sticky']>,
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
    },
    emits: ['rowClick'],
    setup: (): InstanceProperties => ({
        uniqueId: undefined,
    }),
    data(): Data {
        const storedState = this.name !== undefined
            ? getStoredState(this.name)
            : null;

        return {
            count: 0,
            data: undefined,
            page: Math.max(1, this.initialPage),
            limit: Math.max(1, this.perPage),
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
                        sticky: !!column.sticky,
                        class: column.class,
                        render,
                    });
                },
                [],
            );
        },

        hasRowClickListener(): boolean {
            return Boolean(this.$listeners.rowClick);
        },

        shouldPersistState(): boolean {
            return this.name !== undefined;
        },

        totalPages(): number {
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
    },
    created() {
        const { $options } = this;

        this.uniqueId = generateUniqueId(`${$options.name!}-`);

        // - Binding
        this.handleChangeVisibleColumns = this.handleChangeVisibleColumns.bind(this);

        // - Initial fetch.
        this.fetchData();
    },
    methods: {
        // ------------------------------------------------------
        // -
        // -    Handlers
        // -
        // ------------------------------------------------------

        handleRowClick(datum: Datum) {
            this.$emit('rowClick', datum);
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
            } else {
                this.orderBy.ascending = column.key === this.orderBy.column
                    ? !this.orderBy.ascending
                    : defaultAscending;

                this.orderBy.column = column.key;
            }

            this.fetchData();
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
        // -    Méthodes internes
        // -
        // ------------------------------------------------------

        async fetchData() {
            // - Si la liste précédente était vide, on invalide la donnée pour
            //   forcer l'affichage du loader pendant le refetch pour éviter un
            //   flash d'état "empty" potentiellement incohérent.
            if (this.data !== undefined && this.data.length === 0) {
                this.data = undefined;
            }

            const payload: PaginationParams & SortableParams = {
                page: this.page,
                limit: this.limit,
            };
            if (this.orderBy !== null) {
                payload.orderBy = this.orderBy.column;
                payload.ascending = this.orderBy.ascending;
            }

            const response = await this.fetcher(payload);
            const { data, pagination } = response ?? { data: undefined };

            this.data = data;
            this.count = pagination?.total.items ?? 0;
        },

        // ------------------------------------------------------
        // -
        // -    API Publique
        // -
        // ------------------------------------------------------

        /**
         * Permet de changer la page courante du tableau.
         *
         * @param number - Le numéro de la page à afficher.
         */
        setPage(number: number): void {
            let page = Math.max(1, number);

            if (this.totalPages > 0 && page > this.totalPages) {
                page = this.totalPages;
            }

            this.page = page;
            this.fetchData();
        },

        /**
         * Permet de changer l'ordre des résultats du tableau.
         *
         * @param column - La colonne via laquelle il faut ordonner les résultats.
         * @param ascending - Faut-il ordonner dans l'ordre ascendant ou descendant ?
         */
        setOrder(column: string, ascending: boolean) {
            this.orderBy = { column, ascending };
            this.fetchData();
        },

        /**
         * Permet de changer le nombre de résultats par page du tableau.
         *
         * @param number - La nouvelle limite de résultats.
         */
        setLimit(number: number) {
            this.limit = Math.max(1, number);
            this.page = 1;
            this.fetchData();
        },

        /**
         * Permet d'actualiser les données du tableau via une requête serveur.
         *
         * @param pageOnly - Dois-t'on uniquement rafraîchir la page ?
         */
        refresh(pageOnly: boolean = false): void {
            if (!pageOnly) {
                this.page = 1;
            }
            this.fetchData();
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
            data,
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
            normalizedColumns: columns,
            hasRowClickListener,
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
                clickable={hasRowClickListener}
                orderBy={orderBy}
                columns={columns}
                data={data}
                details={details}
                openDetails={openDetails}
                rowClass={rowClass}
                emptyMessage={emptyMessage}
                onOrderBy={handleOrderBy}
                onRowClick={handleRowClick}
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

type ServerTableGeneric = <
    D extends Datum<K>,
    Cs extends Columns<D, K>,
    K extends string = 'id',
>(props: Props<K, D, Cs>) => JSX.Element;

export type ServerTableRef = ComponentRef<typeof ServerTable>;
export default ServerTable as any as ServerTableGeneric;
