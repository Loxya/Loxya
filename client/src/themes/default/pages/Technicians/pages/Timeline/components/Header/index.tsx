import './index.scss';
import Day from '@/utils/day';
import { defineComponent, markRaw } from 'vue';
import { TechniciansViewMode } from '@/stores/api/users';
import Button from '@/themes/default/components/Button';
import Dropdown from '@/themes/default/components/Dropdown';
import DatePicker from '@/themes/default/components/DatePicker';
import ViewModeSwitch from '../../../../components/ViewModeSwitch';
import FiltersPanel, { FiltersSchema } from '../Filters';

import type { Filters } from '../Filters';
import type { PropType, Raw } from 'vue';

type Props = {
    /** La date sur laquelle le planning des techniciens est actuellement centré. */
    centerDate: Day | null,

    /** Filtres actuels du calendrier. */
    filters: Filters,

    /** Le planning ou la page sont t'ils en cours de chargement ? */
    isLoading?: boolean,

    /**
     * Fonction appelée lorsque l'utilisateur demande
     * l'actualisation des données.
     */
    onRefresh?(): void,

    /**
     * Fonction appelée lorsque les filtres ont changés.
     *
     * @param filters - Les nouveaux filtres du calendrier.
     */
    onFiltersChange?(filters: Filters): void,

    /**
     * Fonction appelée lorsque la date de référence (= "centrale") a changé.
     *
     * @param date - La nouvelle date "centrale".
     */
    onChangeCenterDate?(date: Raw<Day>): void,
};

/** Header de la page de planning des techniciens. */
const TechniciansPlanningHeader = defineComponent({
    name: 'TechniciansPlanningHeader',
    props: {
        centerDate: {
            type: Object as PropType<Required<Props>['centerDate']>,
            default: null,
            validator: (value: unknown) => (
                value === null || value instanceof Day
            ),
        },
        filters: {
            type: Object as PropType<Required<Props>['filters']>,
            required: true,
            validator: (value: unknown) => (
                FiltersSchema.safeParse(value).success
            ),
        },
        isLoading: {
            type: Boolean as PropType<Required<Props>['isLoading']>,
            default: false,
        },
        // eslint-disable-next-line vue/no-unused-properties
        onRefresh: {
            type: Function as PropType<Props['onRefresh']>,
            default: undefined,
        },
        // eslint-disable-next-line vue/no-unused-properties
        onFiltersChange: {
            type: Function as PropType<Props['onFiltersChange']>,
            default: undefined,
        },
        // eslint-disable-next-line vue/no-unused-properties
        onChangeCenterDate: {
            type: Function as PropType<Props['onChangeCenterDate']>,
            default: undefined,
        },
    },
    emits: [
        'refresh',
        'filtersChange',
        'changeCenterDate',
    ],
    computed: {
        isToday(): boolean {
            if (this.centerDate === null) {
                return false;
            }
            return Day.today().isSame(this.centerDate);
        },
    },
    methods: {
        // ------------------------------------------------------
        // -
        // -    Handlers
        // -
        // ------------------------------------------------------

        handleRefresh() {
            this.$emit('refresh');
        },

        handleChangeCenterDate(newDate: Day | null) {
            this.$emit('changeCenterDate', markRaw(newDate ?? Day.today()));
        },

        handleSetTodayDate() {
            this.$emit('changeCenterDate', markRaw(Day.today()));
        },

        handleFiltersChange(newFilters: Filters) {
            this.$emit('filtersChange', newFilters);
        },

        // ------------------------------------------------------
        // -
        // -    Méthodes internes
        // -
        // ------------------------------------------------------

        __(key: string, params?: Record<string, number | string>, count?: number): string {
            if (!key.startsWith('global.')) {
                if (!key.startsWith('page.')) {
                    key = `page.sub-pages.timeline.${key}`;
                }
                key = key.replace(/^page\./, 'page.technicians.');
            } else {
                key = key.replace(/^global\./, '');
            }
            return this.$t(key, params, count);
        },
    },
    render() {
        const {
            __,
            centerDate,
            filters,
            isToday,
            isLoading,
            handleRefresh,
            handleSetTodayDate,
            handleChangeCenterDate,
            handleFiltersChange,
        } = this;

        return (
            <div class="TechniciansPlanningHeader">
                <div class="ScheduleCalendarHeader__main">
                    <div class="TechniciansPlanningHeader__main__filters">
                        <DatePicker
                            type="date"
                            value={centerDate}
                            onInput={handleChangeCenterDate}
                            class="TechniciansPlanningHeader__main__filters__center-date"
                            withSnippets
                        />
                        <Button
                            type="transparent"
                            icon="compress-arrows-alt"
                            class="TechniciansPlanningHeader__main__filters__button"
                            onClick={handleSetTodayDate}
                            disabled={isToday}
                            collapsible
                        >
                            {__('global.center-on-today')}
                        </Button>
                        <Button
                            type="transparent"
                            icon="sync-alt"
                            class="TechniciansPlanningHeader__main__filters__button"
                            onClick={handleRefresh}
                            disabled={isLoading}
                            collapsible
                        >
                            {__('global.action-refresh')}
                        </Button>
                    </div>
                    <div class="TechniciansPlanningHeader__main__actions">
                        <ViewModeSwitch mode={TechniciansViewMode.TIMELINE} />
                        <Button
                            type="add"
                            icon="user-plus"
                            to={{ name: 'add-technician' }}
                            collapsible
                        >
                            {__('page.action-add')}
                        </Button>
                        <Dropdown>
                            <Button icon="tools" to={{ name: 'roles' }}>
                                {__('page.manage-roles')}
                            </Button>
                        </Dropdown>
                    </div>
                </div>
                <FiltersPanel
                    values={filters}
                    onChange={handleFiltersChange}
                />
            </div>
        );
    },
});

export default TechniciansPlanningHeader;
