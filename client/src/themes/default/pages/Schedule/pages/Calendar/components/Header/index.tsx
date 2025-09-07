import './index.scss';
import Day from '@/utils/day';
import { Group } from '@/stores/api/groups';
import { BookingsViewMode } from '@/stores/api/users';
import { defineComponent } from 'vue';
import Button from '@/themes/default/components/Button';
import DatePicker from '@/themes/default/components/DatePicker';
import ViewModeSwitch from '../../../../components/ViewModeSwitch';
import FiltersPanel, { FiltersSchema } from '../Filters';

import type { Filters } from '../Filters';
import type { PropType } from 'vue';

type Props = {
    /** La date sur laquelle le calendrier est actuellement centré. */
    centerDate: Day | null,

    /** Filtres actuels du calendrier. */
    filters: Filters,

    /** Le calendrier ou la page sont t'ils en cours de chargement ? */
    isLoading?: boolean,

    /**
     * Fonction appelée lorsque l'utilisateur demande
     * l'actualisation des données.
     */
    onRefresh?(): void,

    /**
     * Fonction appelée lorsque les filtres ont changé.
     *
     * @param filters - Les nouveaux filtres du calendrier.
     */
    onFiltersChange?(filters: Filters): void,

    /**
     * Fonction appelée lorsque la date de référence (= "centrale") a changé.
     *
     * @param date - La nouvelle date "centrale".
     */
    onChangeCenterDate?(date: Day): void,
};

/** Header de la page calendrier. */
const ScheduleCalendarHeader = defineComponent({
    name: 'ScheduleCalendarHeader',
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

        isTeamMember(): boolean {
            return this.$store.getters['auth/is']([
                Group.ADMINISTRATION,
                Group.SUPERVISION,
                Group.OPERATION,
            ]);
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
            this.$emit('changeCenterDate', newDate ?? Day.today());
        },

        handleSetTodayDate() {
            this.$emit('changeCenterDate', Day.today());
        },

        handleFiltersChange(newFilters: Filters) {
            this.$emit('filtersChange', newFilters);
        },
    },
    render() {
        const {
            $t: __,
            centerDate,
            filters,
            isToday,
            isTeamMember,
            isLoading,
            handleRefresh,
            handleSetTodayDate,
            handleChangeCenterDate,
            handleFiltersChange,
        } = this;

        return (
            <div class="ScheduleCalendarHeader">
                <div class="ScheduleCalendarHeader__main">
                    <div class="ScheduleCalendarHeader__main__filters">
                        <DatePicker
                            type="date"
                            value={centerDate}
                            onInput={handleChangeCenterDate}
                            class="ScheduleCalendarHeader__main__filters__center-date"
                            withSnippets
                        />
                        <Button
                            type="transparent"
                            icon="compress-arrows-alt"
                            class="ScheduleCalendarHeader__main__filters__button"
                            onClick={handleSetTodayDate}
                            disabled={isToday}
                            collapsible
                        >
                            {__('center-on-today')}
                        </Button>
                        <Button
                            type="transparent"
                            icon="sync-alt"
                            class="ScheduleCalendarHeader__main__filters__button"
                            onClick={handleRefresh}
                            disabled={isLoading}
                            collapsible
                        >
                            {__('action-refresh')}
                        </Button>
                    </div>
                    <div class="ScheduleCalendarHeader__main__actions">
                        <ViewModeSwitch mode={BookingsViewMode.CALENDAR} />
                        {isTeamMember && (
                            <Button type="add" to={{ name: 'add-event' }} collapsible>
                                {__('page.schedule.calendar.add-event')}
                            </Button>
                        )}
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

export default ScheduleCalendarHeader;
