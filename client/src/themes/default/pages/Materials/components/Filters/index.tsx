import './index.scss';
import Period from '@/utils/period';
import { defineComponent } from 'vue';
import SearchPanel, { FiltersSchema } from '@/themes/default/components/MaterialsFilters';
import DatePicker from '@/themes/default/components/DatePicker';

import type { PropType, Raw } from 'vue';
import type { Filters } from '@/themes/default/components/MaterialsFilters';

type Props = {
    /** La valeur actuelle des filtres. */
    values: Filters,

    /*
     * La valeur de la période à utiliser pour le
     * calcul des quantités disponibles.
     */
    quantitiesPeriodValue: Period | null,

    /**
     * Fonction appelée lorsque les filtres ont changés.
     *
     * @param newFilters - Les nouveaux filtres.
     */
    onFiltersChange?(newFilters: Filters): void,

    /**
     * Fonction appelée lorsque la valeur de la période à
     * utiliser pour le calcul des quantités disponibles change.
     *
     * @param newPeriod - Les nouveaux filtres.
     */
    onQuantitiesPeriodChange?(newPeriod: Raw<Period> | null): void,

    /**
     * Fonction appelée lorsque l'utilisateur a soumis
     * les changements dans les filtres.
     */
    onSubmit?(): void,
};

type Data = {
    quantitiesPeriodIsFullDays: boolean,
};

/** Filtres de la page de listing du matériel. */
const MaterialsPageFilters = defineComponent({
    name: 'MaterialsPageFilters',
    props: {
        values: {
            type: Object as PropType<Required<Props>['values']>,
            required: true,
            validator: (value: unknown) => (
                FiltersSchema.safeParse(value).success
            ),
        },
        quantitiesPeriodValue: {
            // TODO [vue@>3]: Mettre `[Period, null]` en Vue 3.
            // @see https://github.com/vuejs/core/issues/3948#issuecomment-860466204
            type: null as unknown as PropType<Props['quantitiesPeriodValue']>,
            required: true,
            validator: (value: unknown): boolean => (
                value === null || value instanceof Period
            ),
        },
        // eslint-disable-next-line vue/no-unused-properties
        onFiltersChange: {
            type: Function as PropType<Props['onFiltersChange']>,
            default: undefined,
        },
        // eslint-disable-next-line vue/no-unused-properties
        onQuantitiesPeriodChange: {
            type: Function as PropType<Props['onQuantitiesPeriodChange']>,
            default: undefined,
        },
        // eslint-disable-next-line vue/no-unused-properties
        onSubmit: {
            type: Function as PropType<Props['onSubmit']>,
            default: undefined,
        },
    },
    emits: [
        'filtersChange',
        'quantitiesPeriodChange',
        'submit',
    ],
    data: (): Data => ({
        quantitiesPeriodIsFullDays: false,
    }),
    computed: {
        quantitiesPeriod(): Period | null {
            return this.quantitiesPeriodValue;
        },
    },
    methods: {
        handleCoreFiltersChange(newFilters: Filters) {
            this.$emit('filtersChange', newFilters);
        },

        handleChangeQuantitiesPeriod(newPeriod: Raw<Period> | null, isFullDays: boolean) {
            this.quantitiesPeriodIsFullDays = isFullDays;
            this.$emit('quantitiesPeriodChange', newPeriod);
        },

        handleCoreFiltersSubmit() {
            this.$emit('submit');
        },
    },
    render() {
        const {
            $t: __,
            values,
            quantitiesPeriodValue,
            quantitiesPeriodIsFullDays,
            handleChangeQuantitiesPeriod,
            handleCoreFiltersSubmit,
            handleCoreFiltersChange,
        } = this;

        return (
            <div class="MaterialsPageFilters">
                <SearchPanel
                    class="MaterialsPageFilters__search"
                    values={values}
                    onChange={handleCoreFiltersChange}
                    onSubmit={handleCoreFiltersSubmit}
                />
                <div class="MaterialsPageFilters__quantities-period">
                    <DatePicker
                        type={quantitiesPeriodIsFullDays ? 'date' : 'datetime'}
                        value={quantitiesPeriodValue}
                        onChange={handleChangeQuantitiesPeriod}
                        class="MaterialsPageFilters__quantities-period__input"
                        v-tooltip={{
                            placement: 'top',
                            content: __('page.materials.period-to-display-available-quantities'),
                        }}
                        withFullDaysToggle
                        withSnippets
                        range
                    />
                </div>
            </div>
        );
    },
});

export type { Filters };

export { FiltersSchema };
export default MaterialsPageFilters;
