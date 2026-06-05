import { defineComponent, inject } from 'vue';
import { OrderByKey } from '../@constants';

import type { Injected, PropType } from 'vue';
import type { RawColumn } from '../@types';

type Props = {
    /** La colonne dont on veut afficher l'entête. */
    column: RawColumn,

    /**
     * Fonction appelée lorsque l'utilisateur demande
     * à trier le tableau via la colonne (ou à inverser
     * le sens de tri si déjà trié via la colonne)
     */
    onOrderBy?(): void,
};

type InstanceProperties = {
    orderBy: Injected<typeof OrderByKey>,
};

/** Un entête de colonne de tableau. */
const TableHeading = defineComponent({
    name: 'TableHeading',
    props: {
        column: {
            type: Object as PropType<Props['column']>,
            required: true,
        },
        // eslint-disable-next-line vue/no-unused-properties
        onOrderBy: {
            type: Function as PropType<Props['onOrderBy']>,
            default: undefined,
        },
    },
    emits: ['orderBy'],
    setup: (): InstanceProperties => ({
        orderBy: inject(OrderByKey)!,
    }),
    computed: {
        label(): string | null {
            return this.column.title ?? null;
        },

        sortable(): boolean {
            return this.column.sortable ?? false;
        },

        sorted(): boolean {
            return this.orderBy?.column === this.column.key;
        },
    },
    methods: {
        // ------------------------------------------------------
        // -
        // -    Handlers
        // -
        // ------------------------------------------------------

        handleClick() {
            if (!this.sortable) {
                return;
            }
            this.$emit('orderBy');
        },

        handleKeyPress(e: KeyboardEvent) {
            if (!this.sortable || e.key !== 'Enter') {
                return;
            }
            this.$emit('orderBy');
        },

        // ------------------------------------------------------
        // -
        // -    API Publique
        // -
        // ------------------------------------------------------

        /**
         * Retourne la largeur rendue de l'en-tête.
         *
         * @returns La largeur (en pixels).
         */
        getWidth(): number {
            const $el = this.$el as HTMLElement;
            return $el.getBoundingClientRect().width;
        },

    },
    render() {
        const {
            label,
            column,
            orderBy,
            sortable,
            sorted,
            handleClick,
            handleKeyPress,
        } = this;

        const className = [column.class, 'Table__heading', {
            'Table__heading--actions': column.key === 'actions',
            'Table__heading--sticky': column.sticky,
            'Table__heading--sticky-last': column.stickyLast,
            'Table__heading--sortable': sortable,
            'Table__heading--sorted': sorted,
            'Table__heading--sorted-asc': sorted && orderBy!.ascending,
            'Table__heading--sorted-desc': sorted && !orderBy!.ascending,
        }];

        const style = column.sticky
            ? { left: `${column.stickyOffset ?? 0}px` }
            : undefined;

        return (
            <th
                class={className}
                style={style}
                tabindex={sortable ? 0 : undefined}
                onClick={handleClick}
                onKeypress={handleKeyPress}
            >
                {label}
            </th>
        );
    },
});

export default TableHeading;
