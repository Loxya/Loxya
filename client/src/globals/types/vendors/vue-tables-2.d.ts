declare module 'vue-tables-2-premium' {
    import type { MoveEvent } from 'vuedraggable';
    import type { CreateElement, VNode, VNodeClass } from 'vue';
    import type { PaginationParams } from '@/stores/api/@types';

    //
    // - Common types
    //

    type ColumnVisibility = (
        | `${'min' | 'not' | 'max'}_mobile`
        | `${'min' | 'not' | 'max'}_mobileP`
        | `${'min' | 'not' | 'max'}_mobileL`
        | `${'min' | 'not' | 'max'}_tablet`
        | `${'min' | 'not' | 'max'}_tabletP`
        | `${'min' | 'not' | 'max'}_tabletL`
        | `${'min' | 'not' | 'max'}_desktop`
        | `${'min' | 'not' | 'max'}_desktopLarge`
        | `${'min' | 'not' | 'max'}_desktopHuge`
    );

    type ColumnsVisibility = Record<string, ColumnVisibility>;

    type TemplateRenderFunction<Datum = any> = (
        (h: CreateElement, row: Datum, index: number) => JSX.Node
    );

    type RowClickEventPayload<Datum = any> = { row: Datum, event: PointerEvent, index: number };
    type RowDragEventPayload<Datum = any> = { row: Datum, event: MoveEvent, newIndex: number };

    type BaseTableOptions<Datum> = {
        uniqueKey?: string,
        headings?: Record<string, string>,
        initialPage?: number,
        perPage?: number,
        orderBy?: { column: string, ascending: boolean },
        sortable?: string[],
        filterable?: boolean | string[],
        multiSorting?: Record<string, Array<{ column: string, matchDir: boolean }>>,
        filterByColumn?: boolean,
        resizableColumns?: boolean | string[],
        columnsDropdown?: boolean,
        preserveState?: boolean,
        saveState?: boolean,
        saveSearch?: boolean,
        visibleColumns?: string[],
        hiddenColumns?: string[],
        columnsDisplay?: ColumnsVisibility,
        columnsClasses?: Record<string, string>,
        templates?: Record<string, TemplateRenderFunction<Datum>>,
        rowClassCallback?(row: Datum): VNodeClass,
        stickyHeader?: boolean,
        pagination?: {
            chunk?: number,
            dropdown?: boolean,
            edge?: boolean,
            show?: boolean,
            virtual?: boolean,
        },
    };

    interface BaseTableInstance<Datum> {
        name: string;
        columns: string[];
        data: Datum[];
        filtersCount: number;
        openChildRows: number[];
        selectedRows: number[] | undefined;
        setPage(page: number): void;
        setLimit(recordsPerPage: number): void;
        setOrder(column: string, isAscending: boolean): void;
        setFilter(query: string | Record<string, string>): void;
        resetQuery(): void;
        refresh(): void;
        toggleChildRow(id: number): void;
        getOpenChildRows(limitToRows: number[] | null): VNode[];
        setCustomFilters(params: Record<string, unknown>): void;
        setVisibleColumns(columns: string[]): void;
        resetCustomFilters(): void;
        setLoadingState(): void;
        $refs: {
            table: BaseTableInstance<Datum>,
        };
    }

    export type TableRow<T> = {
        row: T,
        column: string,
        index: number,
    };

    //
    // - Client component specific types
    //

    export type ClientCustomFilter<Datum> = {
        name: string,
        callback(item: Datum, identifier: number | string | boolean): boolean,
    };

    /**
     * Fonction personnalisée de tri de colonne.
     *
     * Cette fonction, à qui la direction de tri souhaité est passé (via `ascending`),
     * doit renvoyer une autre fonction qui s'occupera de comparer deux éléments de
     * la colonne et devra renvoyé si le premier élément (`a`) arrive avant (= `-1`) ou
     * après (= `1`) le deuxième (`b`) (ou s'ils sont égaux (= `0`)).
     *
     * Si non spécifié, le tri consistera en une simple comparaison des valeurs
     * (e.g si ascendant: `a > b ? 1 : -1`) en ayant au préalable mis les chaînes
     * de caractères en minuscules (si ce sont des chaînes qui sont comparés).
     *
     * @param ascending - Spécifie si le tri doit être effectué de manière
     *                    ascendante ou descendante.
     */
    export type ColumnSorter<Datum = any> = (ascending: boolean) => (
        (a: Datum, b: Datum) => number
    );

    /**
     * Fonction personnalisée de recherche de colonne.
     *
     * Cette fonction doit retourner un booléen en fonction de si oui ou non la colonne
     * est satisfaisante pour la recherche passée en paramètre (`query`).
     *
     * Si non spécifié, une fonction de recherche "universelle" sera utilisée.
     *
     * @param row - Les données de la ligne en question.
     * @param query - La recherche actuelle.
     */
    export type ColumnSearcher<Datum = any> = (row: Datum, query: string) => boolean;

    export type ClientTableOptions<Datum = any, Filters = any> = BaseTableOptions<Datum> & {
        orderable?: boolean,
        initFilters?: Filters,
        customSorting?: Record<string, ColumnSorter<Datum>>,
        filterAlgorithm?: Record<string, ColumnSearcher<Datum>>,
        customFilters?: Array<ClientCustomFilter<Datum>>,
    };

    export interface ClientTableInstance<Datum = any> extends BaseTableInstance<Datum> {
        filteredData: Datum[];
        allFilteredData: Datum[];
    }

    //
    // - Server component specific types
    //

    export type RequestFunction<Data = any> = (pagination: PaginationParams) => (
        Promise<{ data: Data } | undefined>
    );

    export type ServerTableOptions<Datum = any> = BaseTableOptions<Datum> & {
        customFilters?: string[],
        requestFunction?: RequestFunction<Datum[]>,
    };

    export interface ServerTableInstance<Datum = any> extends BaseTableInstance<Datum> {
        setRequestParams(params: Record<string, unknown>): void;
        getData(): Datum[];
        getQueryParams(): Record<string, unknown>;
    }
}
