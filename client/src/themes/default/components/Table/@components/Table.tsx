import { computed, defineComponent } from 'vue';
import Pagination from '@/themes/default/components/Pagination';
import TableHead from './TableHead';
import TableBody from './TableBody';
import { Variant, PageKey, LimitKey, OrderByKey } from '../@constants';

import type { PropType } from 'vue';
import type {
    Datum,
    Identifier,
    RawColumn,
    RawColumns,
    RawOrderBy,
    EmptyMessage,
    RenderFunction,
} from '../@types';

type Props<
    K extends string = 'id',
    D extends Datum<K> = Datum<K>,
    Cs extends RawColumns<D, K> = RawColumns<D, K>,
> = {
    /** Le numéro de la page actuellement affichée. */
    page: number,

    /** La limite du nombre d'éléments par page. */
    limit: number,

    /** Le nombre d'éléments au total. */
    count: number,

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
     * Le nom de la clé contenant l'identifiant unique de chaque
     * ligne dans le jeu de données.
     */
    uniqueKey: K,

    /** L'ordre dans lequel le tableau est trié. */
    orderBy: RawOrderBy<D, Cs, K> | null,

    /**
     * Les données du tableau.
     *
     * Si la valeur est `undefined`, les données seront réputées
     * être en cours de récupération, le tableau affichera donc un
     * état "chargement en cours".
     */
    data: D[] | undefined,

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
     * Le header du tableau doit-il rester visible lors du scroll ?
     *
     * @default false
     */
    sticky?: boolean,

    /**
     * Permet d'activer ou de désactiver la pagination.
     *
     * @default true
     */
    paginated?: boolean,

    /**
     * Les lignes du tableau doivent-elles être cliquables ?
     *
     * @default false
     */
    clickable?: boolean,

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
     * Fonction appelée lorsque l'utilisateur demande
     * à trier le tableau via une colonne (ou à inverser
     * le sens de tri si déjà trié via cette colonne)
     *
     * @param column - L'identifiant de la colonne sur laquelle
     *                 le tri doit-être opéré ou inversé.
     */
    onOrderBy?(columnKey: RawColumn['key']): void,

    /**
     * Fonction appelée lorsque l'utilisateur a demandé
     * l'affichage d'une nouvelle page.
     *
     * @param newPage - Le numéro de la nouvelle page à afficher.
     */
    onPaginate?(newPage: number): void,

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

/** Un tableau. */
const Table = defineComponent({
    name: 'Table',
    provide(this: any) {
        return {
            [PageKey as symbol]: computed(() => this.page),
            [LimitKey as symbol]: computed(() => this.limit),
            [OrderByKey as symbol]: computed(() => this.orderBy),
        };
    },
    props: {
        page: {
            type: Number as PropType<Props['page']>,
            required: true,
            validator: (value: number) => value > 0,
        },
        limit: {
            type: Number as PropType<Props['limit']>,
            required: true,
            validator: (value: number) => value > 0,
        },
        count: {
            type: Number as PropType<Props['count']>,
            required: true,
            validator: (value: number) => value >= 0,
        },
        columns: {
            type: Array as PropType<Props['columns']>,
            required: true,
        },
        uniqueKey: {
            type: String as PropType<Props['uniqueKey']>,
            required: true,
        },
        data: {
            // TODO [vue@>3]: Mettre `[Array, undefined]` en Vue 3.
            // @see https://github.com/vuejs/core/issues/3948#issuecomment-860466204
            type: null as unknown as PropType<Props['data']>,
            required: true,
            validator: (value: unknown): boolean => (
                value === undefined || Array.isArray(value)
            ),
        },
        orderBy: {
            // TODO [vue@>3]: Mettre `[Object, null]` en Vue 3.
            // @see https://github.com/vuejs/core/issues/3948#issuecomment-860466204
            type: null as unknown as PropType<Props['orderBy']>,
            required: true,
            validator: (value: unknown): boolean => (
                value === null || typeof value === 'object'
            ),
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
        paginated: {
            type: Boolean as PropType<Required<Props>['paginated']>,
            default: true,
        },
        clickable: {
            type: Boolean as PropType<Required<Props>['clickable']>,
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
        // eslint-disable-next-line vue/no-unused-properties
        onOrderBy: {
            type: Function as PropType<Props['onOrderBy']>,
            default: undefined,
        },
        // eslint-disable-next-line vue/no-unused-properties
        onPaginate: {
            type: Function as PropType<Props['onPaginate']>,
            default: undefined,
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
    emits: ['rowClick', 'rowDrag', 'orderBy', 'paginate'],
    computed: {
        isEmpty(): boolean {
            return (this.data ?? []).length === 0;
        },

        showHead(): boolean {
            if (this.headless) {
                return false;
            }
            return !this.isEmpty;
        },

        hasMultiplePages(): boolean {
            if (this.isEmpty || this.count <= 0) {
                return false;
            }
            return Math.ceil(this.count / Math.max(this.limit, 1)) > 1;
        },
    },
    methods: {
        // ------------------------------------------------------
        // -
        // -    Handlers
        // -
        // ------------------------------------------------------

        handleRowClick(datum: Datum) {
            if (!this.clickable) {
                return;
            }
            this.$emit('rowClick', datum);
        },

        handleRowDrag(datum: Datum, newIndex: number) {
            if (!this.orderable) {
                return;
            }
            this.$emit('rowDrag', datum, newIndex);
        },

        handleOrderBy(columnKey: RawColumn['key']) {
            const column = this.columns.find(
                (_column: RawColumn) => _column.key === columnKey,
            );
            if (column === undefined || !column.sortable) {
                return;
            }
            this.$emit('orderBy', columnKey);
        },

        handlePaginate(newPage: number) {
            this.$emit('paginate', newPage);
        },
    },
    render() {
        const {
            data,
            page,
            limit,
            count,
            details,
            variant,
            clickable,
            hasMultiplePages,
            isEmpty,
            sticky,
            showHead,
            paginated,
            orderable,
            columns,
            rowClass,
            emptyMessage,
            uniqueKey,
            openDetails,
            handleOrderBy,
            handleRowClick,
            handleRowDrag,
            handlePaginate,
        } = this;

        const className = ['Table', `Table--${variant}`, {
            'Table--paginated': hasMultiplePages,
            'Table--empty': isEmpty,
            'Table--headless': !showHead,
            'Table--clickable': clickable,
            'Table--sticky': sticky,
        }];

        return (
            <div class={className}>
                <div class="Table__wrapper">
                    <table class="Table__table">
                        {showHead && (
                            <TableHead
                                columns={columns}
                                onOrderBy={handleOrderBy}
                            />
                        )}
                        <TableBody
                            columns={columns}
                            uniqueKey={uniqueKey}
                            data={data}
                            details={details}
                            openDetails={openDetails}
                            rowClass={rowClass}
                            orderable={orderable}
                            emptyMessage={emptyMessage}
                            onRowClick={handleRowClick}
                            onRowDrag={handleRowDrag}
                        />
                    </table>
                </div>
                {(paginated && !isEmpty) && (
                    <div class="Table__pagination">
                        <Pagination
                            totalItems={count}
                            currentPage={page}
                            perPage={limit}
                            onChange={handlePaginate}
                        />
                    </div>
                )}
            </div>
        );
    },
});

export default Table;
