import Draggable from 'vuedraggable';
import { defineComponent, inject } from 'vue';
import Loading from '@/themes/default/components/Loading';
import EmptyMessageDisplay, { EmptyMessageVariant } from '@/themes/default/components/EmptyMessage';
import TableRow from './TableRow';
import { PageKey, LimitKey } from '../@constants';

import type { SetRequired } from 'type-fest';
import type { MoveEvent } from 'vuedraggable';
import type { Injected, PropType, CreateElement } from 'vue';
import type {
    Datum,
    Identifier,
    RawColumns,
    EmptyMessage,
    RenderFunction,
} from '../@types';

type Props<
    K extends string = 'id',
    D extends Datum<K> = Datum<K>,
    Cs extends RawColumns<D, K> = RawColumns<D, K>,
> = {
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

    /**
     * Les données du tableau.
     *
     * Si la valeur est `undefined`, les données seront réputées
     * être en cours de récupération, le tableau affichera donc un
     * état "chargement en cours".
     */
    data: D[] | undefined,

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
     * Permet d'activer ou de désactiver le réordonnancement des lignes du tableau.
     *
     * @default false
     */
    orderable?: boolean,

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
    page: Injected<typeof PageKey>,
    limit: Injected<typeof LimitKey>,
};

const TableBody = defineComponent({
    name: 'TableBody',
    props: {
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
        details: {
            type: Function as PropType<Props['details']>,
            default: undefined,
        },
        openDetails: {
            type: Array as PropType<Required<Props>['openDetails']>,
            default: () => [],
        },
        orderable: {
            type: Boolean as PropType<Required<Props>['orderable']>,
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
        page: inject(PageKey)!,
        limit: inject(LimitKey)!,
    }),
    computed: {
        isFetching(): boolean {
            return this.data === undefined;
        },

        isEmpty(): boolean {
            return (this.data ?? []).length === 0;
        },

        normalizedEmptyMessage(): SetRequired<EmptyMessage, 'variant'> {
            const normalized: EmptyMessage | undefined = (
                typeof this.emptyMessage === 'string'
                    ? { text: this.emptyMessage }
                    : (this.emptyMessage ?? {})
            );

            const variant = normalized?.variant ?? EmptyMessageVariant.EMPTY;
            return { ...normalized, variant };
        },

        fullColspan(): number {
            return this.columns.length;
        },

        initialIndex(): number {
            return (this.page - 1) * this.limit;
        },

        hasDetails(): boolean {
            return this.details !== undefined;
        },
    },
    methods: {
        handleRowClick(rawDatum: Datum) {
            // - Solution best effort si on pas a pas l'identifiant dans le jeu de données ...
            if (rawDatum[this.uniqueKey] === undefined) {
                this.$emit('rowClick', rawDatum);
                return;
            }

            const id = rawDatum[this.uniqueKey];
            const datum = this.data?.find((_datum: Datum) => _datum[this.uniqueKey] === id);
            if (datum === undefined) {
                return;
            }
            this.$emit('rowClick', datum);
        },

        handleRowDrag(rawDatum: Datum, newIndex: number) {
            if (!this.orderable) {
                return;
            }

            // - Solution best effort si on pas a pas l'identifiant dans le jeu de données ...
            if (rawDatum[this.uniqueKey] === undefined) {
                this.$emit('rowDrag', rawDatum, newIndex);
                return;
            }

            const id = rawDatum[this.uniqueKey];
            const datum = this.data?.find((_datum: Datum) => _datum[this.uniqueKey] === id);
            if (datum === undefined) {
                return;
            }
            this.$emit('rowDrag', datum, newIndex);
        },
    },
    render(h: CreateElement) {
        const {
            data,
            details,
            uniqueKey,
            openDetails,
            columns,
            rowClass,
            orderable,
            isEmpty,
            isFetching,
            normalizedEmptyMessage: emptyMessage,
            hasDetails,
            initialIndex,
            handleRowClick,
            handleRowDrag,
        } = this;

        if (isFetching || isEmpty) {
            return (
                <tbody class="Table__body">
                    <tr>
                        <td class="Table__status" colspan={this.fullColspan}>
                            <div class="Table__status__content">
                                {(() => {
                                    if (isFetching) {
                                        return <Loading />;
                                    }

                                    return (
                                        <EmptyMessageDisplay
                                            message={emptyMessage.text}
                                            variant={emptyMessage.variant}
                                            action={emptyMessage.action}
                                        />
                                    );
                                })()}
                            </div>
                        </td>
                    </tr>
                </tbody>
            );
        }

        const rows: JSX.Element[] = [];
        const rowsData: Array<{ primary: boolean, datum: Datum }> = [];
        (data ?? []).forEach((datum: Datum, rawIndex: number) => {
            const index = initialIndex + rawIndex + 1;
            const id = datum[uniqueKey];

            rows.push((
                <TableRow
                    key={`${id ?? rawIndex}--primary`}
                    datum={datum}
                    index={index}
                    rawClass={rowClass}
                    columns={columns}
                    onClick={() => {
                        handleRowClick(datum);
                    }}
                />
            ));
            rowsData.push({ primary: true, datum });

            if (hasDetails && id !== undefined && openDetails.includes(id)) {
                rows.push(
                    <tr key={`${id ?? rawIndex}--details`}>
                        <td class="Table__details" colspan={this.fullColspan}>
                            {details!(h, datum, index)}
                        </td>
                    </tr>,
                );
                rowsData.push({ primary: false, datum });
            }
        });

        if (!orderable) {
            return (
                <tbody class="Table__body">
                    {rows}
                </tbody>
            );
        }

        return (
            <Draggable
                tag="tbody"
                class="Table__body"
                direction="vertical"
                draggable=".Table__row"
                filter=".Table__details-row"
                value={data!}
                move={(event: MoveEvent<Datum>) => {
                    const { index } = event.draggedContext;
                    return rowsData[index]?.primary ?? false;
                }}
                onEnd={(event: { oldIndex: number, newIndex: number }) => {
                    const item = rowsData[event.oldIndex];
                    if (
                        !item?.primary ||
                        event.oldIndex === event.newIndex
                    ) {
                        return;
                    }

                    const newIndex = rowsData
                        .slice(0, event.newIndex)
                        .filter((_item) => _item.primary).length;

                    handleRowDrag(item.datum, newIndex);
                }}
            >
                {rows}
            </Draggable>
        );
    },
});

export default TableBody;
