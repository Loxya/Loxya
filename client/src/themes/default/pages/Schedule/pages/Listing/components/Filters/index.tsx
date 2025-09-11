import { z } from '@/utils/validation';
import Period from '@/utils/period';
import isTruthy from '@/utils/isTruthy';
import isEqualWith from 'lodash/isEqualWith';
import { defineComponent } from 'vue';
import { UNCATEGORIZED } from '@/stores/api/materials';
import SearchPanel, { FilterKind } from '@/themes/default/components/SearchPanel';

import type { PropType } from 'vue';
import type { SchemaInfer } from '@/utils/validation';
import type { Options as DataOptions } from '@/utils/formatOptions';
import type { Category } from '@/stores/api/categories';
import type { ParkSummary } from '@/stores/api/parks';
import type { FilterDefinition, TokenOptions } from '@/themes/default/components/SearchPanel';

enum TokenType {
    PARK = 'park',
    PERIOD = 'period',
    CATEGORY = 'category',
    STATES = 'states',
}

export enum StateFilter {
    /** Les bookings se terminant aujourd'hui. */
    ENDING_TODAY = 'endingToday',

    /** Les bookings avec un inventaire à faire. */
    RETURN_INVENTORY_TODO = 'returnInventoryTodo',

    /** Les bookings archivés. */
    ARCHIVED = 'archived',

    /** Les bookings non confirmés. */
    NOT_CONFIRMED = 'notConfirmed',
}

export const FiltersSchema = z.strictObject({
    search: z.string().array(),
    [TokenType.PERIOD]: z.period().nullable(),
    [TokenType.PARK]: z.number().nullable(),
    [TokenType.CATEGORY]: z.union([z.number(), z.literal(UNCATEGORIZED)]).nullable(),
    [TokenType.STATES]: z.nativeEnum(StateFilter).array(),
});

export type Filters = SchemaInfer<typeof FiltersSchema>;

type Props = {
    /** Les valeurs actuelles des filtres. */
    values: Filters,

    /**
     * Fonction appelée lorsque les filtres ont changés.
     *
     * @param newFilters - Les nouveaux filtres.
     */
    onChange?(newFilters: Filters): void,

    /**
     * Fonction appelée lorsque l'utilisateur a soumis
     * les changements dans les filtres.
     */
    onSubmit?(): void,
};

/** Filtres de la liste des bookings. */
const ScheduleListingFilters = defineComponent({
    name: 'ScheduleListingFilters',
    props: {
        values: {
            type: Object as PropType<Required<Props>['values']>,
            required: true,
            validator: (value: unknown) => (
                FiltersSchema.safeParse(value).success
            ),
        },
        // eslint-disable-next-line vue/no-unused-properties
        onChange: {
            type: Function as PropType<Props['onChange']>,
            default: undefined,
        },
        // eslint-disable-next-line vue/no-unused-properties
        onSubmit: {
            type: Function as PropType<Props['onSubmit']>,
            default: undefined,
        },
    },
    emits: ['change', 'submit'],
    computed: {
        parksOptions(): DataOptions<ParkSummary> {
            return this.$store.getters['parks/options'];
        },

        categoriesOptions(): DataOptions<Category> {
            const { $t: __ } = this;

            // - On garde le tableau à vide le temps d'avoir récupéré les options pour
            //   éviter que le component `<Search />` pense qu'on a toutes les valeurs
            //   possibles et supprime les valeurs absentes.
            if (!this.$store.state.categories.isFetched) {
                return [];
            }

            return [
                { value: UNCATEGORIZED, label: __('not-categorized') },
                ...this.$store.getters['categories/options'],
            ];
        },

        statesOptions(): TokenOptions<StateFilter> {
            const { $t: __ } = this;

            return [
                {
                    value: StateFilter.ENDING_TODAY,
                    label: __('page.schedule.listing.states.ending-today'),
                },
                {
                    value: StateFilter.RETURN_INVENTORY_TODO,
                    label: __('page.schedule.listing.states.return-inventory-todo'),
                },
                {
                    value: StateFilter.NOT_CONFIRMED,
                    label: __('page.schedule.listing.states.not-confirmed'),
                },
                {
                    value: StateFilter.ARCHIVED,
                    label: __('page.schedule.listing.states.archived'),
                },
            ];
        },

        withParkFilter(): boolean {
            return (
                this.values[TokenType.PARK] !== null ||
                this.parksOptions.length > 1
            );
        },

        definitions(): FilterDefinition[] {
            const {
                $t: __,
                withParkFilter,
                parksOptions,
                statesOptions,
                categoriesOptions,
            } = this;

            return [
                withParkFilter && {
                    type: TokenType.PARK,
                    icon: 'industry',
                    title: __('park'),
                    placeholder: __('all-parks'),
                    options: parksOptions,
                },
                {
                    type: TokenType.CATEGORY,
                    icon: 'sitemap',
                    title: __('category'),
                    placeholder: __('all-categories'),
                    options: categoriesOptions,
                },
                {
                    type: TokenType.PERIOD,
                    icon: 'calendar-alt',
                    title: __('period'),
                    placeholder: __('all-periods'),
                    kind: FilterKind.PERIOD,
                },
                {
                    type: TokenType.STATES,
                    icon: 'toggle-on',
                    title: __('state'),
                    placeholder: __('all-states'),
                    options: statesOptions,
                    multiSelect: true,
                },
            ].filter(isTruthy) as FilterDefinition[];
        },
    },
    mounted() {
        this.$store.dispatch('parks/fetch');
        this.$store.dispatch('categories/fetch');
    },
    methods: {
        // ------------------------------------------------------
        // -
        // -    Handlers
        // -
        // ------------------------------------------------------

        handleChange(newFilters: Filters) {
            const normalizedNewFilters: Filters = { ...newFilters };
            if (!(TokenType.PARK in normalizedNewFilters) || !this.withParkFilter) {
                normalizedNewFilters[TokenType.PARK] = null;
            }

            const comparator = (a: unknown, b: unknown): boolean | undefined => {
                if (a instanceof Period && b instanceof Period) {
                    return a.isSame(b);
                }
                return undefined;
            };
            if (!isEqualWith(this.values, normalizedNewFilters, comparator)) {
                this.$emit('change', normalizedNewFilters);
            }
        },

        handleSubmit() {
            this.$emit('submit');
        },
    },
    render() {
        const {
            values,
            definitions,
            handleChange,
            handleSubmit,
        } = this;

        return (
            <SearchPanel
                values={values}
                definitions={definitions}
                onChange={handleChange}
                onSubmit={handleSubmit}
            />
        );
    },
});

export default ScheduleListingFilters;
