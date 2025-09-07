import './index.scss';
import omit from 'lodash/omit';
import isEqual from 'lodash/isEqual';
import { z } from '@/utils/validation';
import isTruthy from '@/utils/isTruthy';
import { defineComponent } from 'vue';
import SwitchToggle from '@/themes/default/components/SwitchToggle';
import SearchPanel from '@/themes/default/components/SearchPanel';

import type { Options } from '@/utils/formatOptions';
import type { PropType } from 'vue';
import type { SchemaInfer } from '@/utils/validation';
import type { Category } from '@/stores/api/categories';
import type { ParkSummary } from '@/stores/api/parks';
import type { FilterDefinition } from '@/themes/default/components/SearchPanel';

export enum TokenType {
    PARK = 'park',
    CATEGORY = 'category',
}

export const FiltersSchema = z.strictObject({
    search: z.string().array(),
    withMissingMaterial: z.boolean(),
    [TokenType.PARK]: z.number().nullable(),
    [TokenType.CATEGORY]: z.number().nullable(),
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

/** Filtres de la page calendrier. */
const ScheduleCalendarFilters = defineComponent({
    name: 'ScheduleCalendarFilters',
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
        parksOptions(): Options<ParkSummary> {
            return this.$store.getters['parks/options'];
        },

        categoriesOptions(): Options<Category> {
            return this.$store.getters['categories/options'];
        },

        withParkFilter(): boolean {
            return (
                this.values[TokenType.PARK] !== null ||
                this.parksOptions.length > 1
            );
        },

        coreValues(): Omit<Filters, 'withMissingMaterial'> {
            return omit(this.values, ['withMissingMaterial']);
        },

        definitions(): FilterDefinition[] {
            const {
                $t: __,
                withParkFilter,
                parksOptions,
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
            ].filter(isTruthy);
        },
    },
    created() {
        this.$store.dispatch('parks/fetch');
        this.$store.dispatch('categories/fetch');
    },
    methods: {
        // ------------------------------------------------------
        // -
        // -    Handlers
        // -
        // ------------------------------------------------------

        handleSearchChange(newFilters: Filters) {
            const normalizedNewFilters: Filters = { ...this.values, ...newFilters };
            if (!(TokenType.PARK in normalizedNewFilters) || !this.withParkFilter) {
                normalizedNewFilters[TokenType.PARK] = null;
            }

            if (!isEqual(this.values, normalizedNewFilters)) {
                this.$emit('change', normalizedNewFilters);
            }
        },

        handleWithMissingMaterialChange(withMissingMaterial: boolean) {
            this.$emit('change', { ...this.values, withMissingMaterial });
        },

        handleSearchSubmit() {
            this.$emit('submit');
        },
    },
    render() {
        const {
            $t: __,
            values,
            coreValues,
            definitions,
            handleSearchChange,
            handleSearchSubmit,
            handleWithMissingMaterialChange,
        } = this;

        return (
            <div class="ScheduleCalendarFilters">
                <SearchPanel
                    class="ScheduleCalendarFilters__search"
                    values={coreValues}
                    definitions={definitions}
                    onChange={handleSearchChange}
                    onSubmit={handleSearchSubmit}
                />
                <div class="ScheduleCalendarFilters__with-missing-materials">
                    <span class="ScheduleCalendarFilters__with-missing-materials__label">
                        {__('page.schedule.calendar.event-with-missing-material-only')}
                    </span>
                    <SwitchToggle
                        value={values.withMissingMaterial}
                        onInput={handleWithMissingMaterialChange}
                        class="ScheduleCalendarFilters__with-missing-materials__input"
                    />
                </div>
            </div>
        );
    },
});

export default ScheduleCalendarFilters;
