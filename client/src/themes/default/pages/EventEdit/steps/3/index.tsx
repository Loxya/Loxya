import './index.scss';
import isEqual from 'lodash/isEqual';
import Period, { PeriodReadableFormat } from '@/utils/period';
import DateTime from '@/utils/datetime';
import { confirm } from '@/utils/alert';
import showModal from '@/utils/showModal';
import apiEvents from '@/stores/api/events';
import mergeDifference from '@/utils/mergeDifference';
import apiTechnicians from '@/stores/api/technicians';
import { defineComponent } from 'vue';
import stringIncludes from '@/utils/stringIncludes';
import { ApiErrorCode } from '@/stores/api/@codes';
import { RequestError } from '@/globals/requester';
import CriticalError from '@/themes/default/components/CriticalError';
import Loading from '@/themes/default/components/Loading';
import Timeline from '@/themes/default/components/Timeline';
import StateMessage, { State } from '@/themes/default/components/StateMessage';
import { MIN_TECHNICIAN_ASSIGNMENT_DURATION } from '@/globals/constants';
import FiltersPanel from './components/Filters';
import Button from '@/themes/default/components/Button';

// - Modales
import AssignmentCreation from './modals/AssignmentCreation';
import AssignmentEdition from './modals/AssignmentEdition';

import type { Role } from '@/stores/api/roles';
import type { Filters } from './components/Filters';
import type { PropType } from 'vue';
import type { TechnicianWithEvents, TechnicianEvent } from '@/stores/api/technicians';
import type {
    EventDetails,
    EventTechnician,
    EventAssignmentEdit,
} from '@/stores/api/events';
import type {
    TimelineItem,
    TimelineGroup,
    TimelineClickEvent,
    TimelineItemIdentifier,
    TimelineConfirmCallback,
} from '@/themes/default/components/Timeline';

type Props = {
    /** L'événement en cours d'édition. */
    event: EventDetails,
};

type Data = {
    technicians: TechnicianWithEvents[],
    isFetched: boolean,
    isLoading: boolean,
    hasCriticalError: boolean,
    filters: Filters,
};

/**
 * Intervalle de temps minimum affiché dans la timeline.
 * (Il ne sera pas possible d'augmenter le zoom au delà de cette limite)
 */
const MIN_ZOOM = DateTime.duration(1, 'hour');

/** Étape 3 de l'edition d'un événement: Assignation des techniciens. */
const EventEditStepTechnicians = defineComponent({
    name: 'EventEditStepTechnicians',
    props: {
        event: {
            type: Object as PropType<Props['event']>,
            required: true,
        },
    },
    emits: ['goToStep', 'updateEvent'],
    data: (): Data => ({
        technicians: [],
        isFetched: false,
        isLoading: false,
        hasCriticalError: false,
        filters: {
            search: [],
            role: null,
        },
    }),
    computed: {
        assignationPeriod(): Period<false> {
            return this.event.mobilization_period
                .merge(this.event.operation_period)
                .setFullDays(false);
        },

        filteredTechnicians(): TechnicianWithEvents[] {
            const { technicians, filters } = this;
            const search = filters.search.filter(
                (term: string) => term.trim().length > 1,
            );

            return technicians.filter((technician: TechnicianWithEvents): boolean => {
                // - Recherche textuelle.
                if (search.length > 0) {
                    const isMatching = search.some((term: string) => (
                        stringIncludes(technician.first_name, term) ||
                        stringIncludes(technician.last_name, term) ||
                        stringIncludes(`${technician.first_name} ${technician.last_name}`, term) ||
                        stringIncludes(`${technician.last_name} ${technician.first_name}`, term) ||
                        (
                            technician.nickname !== null &&
                            stringIncludes(technician.nickname, term)
                        ) ||
                        (
                            technician.email !== null &&
                            stringIncludes(technician.email, term)
                        )
                    ));
                    if (!isMatching) {
                        return false;
                    }
                }

                // - Rôle
                if (filters.role !== null) {
                    const hasRole = technician.roles.some(
                        (role: Role) => role.id === filters.role!,
                    );
                    if (!hasRole) {
                        return false;
                    }
                }

                return true;
            });
        },

        hasAssignableTechnicians(): boolean {
            return this.technicians.length > 0;
        },

        hasFilteredTechnicians(): boolean {
            return this.filteredTechnicians.length > 0;
        },

        groups(): TimelineGroup[] {
            return this.filteredTechnicians.map((technician: TechnicianWithEvents) => (
                { id: technician.id, name: technician.full_name }
            ));
        },

        assignments(): TimelineItem[] {
            const { __, event } = this;

            const eventSlots: TimelineItem[] = event.technicians.map((assignment: EventTechnician) => {
                const eventInfos = (event.location ?? '').length > 0
                    ? `${event.title} (${event.location!})`
                    : event.title;

                const formattedPeriod = assignment.period.toReadable(__, PeriodReadableFormat.MINIMALIST);
                const assignmentInfos = assignment.role
                    ? `${formattedPeriod}: ${assignment.role.name}`
                    : formattedPeriod;

                return {
                    id: assignment.id,
                    summary: assignmentInfos,
                    tooltip: `${eventInfos}\n${assignmentInfos}`,
                    period: assignment.period,
                    group: assignment.technician.id,
                    type: 'range',
                    editable: true,
                };
            });

            const otherSlots: TimelineItem[] = this.technicians.flatMap((technician: TechnicianWithEvents) => (
                technician.events.map((assignment: TechnicianEvent) => {
                    const eventInfos = (assignment.event.location ?? '').length > 0
                        ? `${assignment.event.title} (${assignment.event.location!})`
                        : assignment.event.title;

                    const formattedPeriod = assignment.period.toReadable(__, PeriodReadableFormat.MINIMALIST);
                    const assignmentInfos = assignment.role
                        ? `${formattedPeriod}: ${assignment.role.name}`
                        : formattedPeriod;

                    return {
                        id: assignment.id,
                        summary: `${eventInfos}\n${assignmentInfos}`,
                        period: assignment.period,
                        group: technician.id,
                        type: 'background',
                        editable: false,
                    };
                })
            ));

            return [...eventSlots, ...otherSlots];
        },
    },
    mounted() {
        this.fetchAllTechnicians();
    },
    methods: {
        // ------------------------------------------------------
        // -
        // -    Handlers
        // -
        // ------------------------------------------------------

        handleFiltersChange(newFilters: Filters) {
            // - Recherche textuelle.
            const newSearch = mergeDifference(this.filters.search, newFilters.search);
            if (!isEqual(this.filters.search, newSearch)) {
                this.filters.search = newSearch;
            }

            // - Rôle.
            if (this.filters.role !== newFilters.role) {
                this.filters.role = newFilters.role;
            }
        },

        async handleCreateTechnicianAssignment(date: DateTime, technician: TechnicianWithEvents) {
            await showModal(this.$modal, AssignmentCreation, {
                event: this.event,
                technician,
                defaultStartDate: date,
            });

            this.updateEvent();
        },

        async handleUpdateTechnicianAssignment(assignment: EventTechnician) {
            await showModal(this.$modal, AssignmentEdition, {
                event: this.event,
                assignment,
            });

            this.updateEvent();
        },

        handleTimelineDoubleClick(event: TimelineClickEvent) {
            //
            // - Édition d'une assignation
            //

            const assignment: EventTechnician | undefined = (() => {
                if (!event.item) {
                    return undefined;
                }
                return this.event.technicians.find(
                    ({ id }: EventTechnician) => id === event.item!.id,
                );
            })();
            if (assignment !== undefined) {
                this.handleUpdateTechnicianAssignment(assignment);
                return;
            }

            //
            // - Création d'une assignation
            //

            if (!event.group) {
                return;
            }

            const requestedTime = event.snappedTime;
            const technician: TechnicianWithEvents | undefined = this.technicians.find(
                ({ id }: TechnicianWithEvents) => id === event.group,
            );
            if (technician === undefined) {
                return;
            }

            const minCreatablePeriod = new Period(
                requestedTime,
                requestedTime.add(MIN_TECHNICIAN_ASSIGNMENT_DURATION),
            );

            // - On vérifie que la période d'assignation minimale est bien disponible.
            const allAssignments: Array<EventTechnician | TechnicianEvent> = [
                ...technician.events,
                ...this.event.technicians.filter(
                    (_eventTechnician: EventTechnician) => (
                        _eventTechnician.technician.id === technician.id
                    ),
                ),
            ];
            const isRequestedTimeAvailable = !allAssignments.some(
                ({ period }: EventTechnician | TechnicianEvent) => (
                    minCreatablePeriod.overlaps(period)
                ),
            );
            if (!isRequestedTimeAvailable) {
                return;
            }

            this.handleCreateTechnicianAssignment(requestedTime, technician);
        },

        async handleTimelineItemMove(item: TimelineItemIdentifier<EventTechnician['id']>, newPeriod: Period, newGroup: string | null, finish: TimelineConfirmCallback) {
            const { __, event } = this;

            this.isLoading = true;
            try {
                const existingAssignment = this.event.technicians.find(
                    ({ id }: EventTechnician) => id === item.id,
                );
                if (!existingAssignment) {
                    return;
                }

                const data: EventAssignmentEdit = {
                    period: newPeriod,
                    role_id: existingAssignment.role?.id ?? null,
                    technician_id: existingAssignment.technician_id,
                };

                await apiEvents.updateAssignment(event.id, item.id, data);
                this.$toasted.success(__('assignation-saved'));
                this.isLoading = false;
                finish(true);

                this.updateEvent();
            } catch (error) {
                this.isLoading = false;
                finish(false);

                if (
                    error instanceof RequestError &&
                    error.code === ApiErrorCode.VALIDATION_FAILED &&
                    error.details?.period !== undefined
                ) {
                    this.$toasted.error(error.details.period);
                    return;
                }

                // eslint-disable-next-line no-console
                console.error(`Error occurred while saving the company`, error);
                this.$toasted.error(__('errors.unexpected-while-saving'));
            }
        },

        async handleTimelineItemRemove(item: TimelineItemIdentifier<EventTechnician['id']>, finish: TimelineConfirmCallback) {
            const { __, event } = this;

            const isConfirmed = await confirm({
                type: 'danger',
                text: __('technician-item.confirm-permanently-delete'),
                confirmButtonText: __('global.yes-permanently-delete'),
            });
            if (!isConfirmed) {
                finish(false);
                return;
            }

            this.isLoading = true;
            try {
                await apiEvents.deleteAssignment(event.id, item.id);
                this.$toasted.success(__('assignation-removed'));
                this.isLoading = false;
                finish(true);

                this.updateEvent();
            } catch {
                this.$toasted.error(__('global.errors.unexpected-while-deleting'));
                this.isLoading = false;
                finish(false);
            }
        },

        handlePrevClick() {
            this.$emit('goToStep', 2);
        },

        handleNextClick() {
            this.$emit('goToStep', 4);
        },

        // ------------------------------------------------------
        // -
        // -    Méthodes internes
        // -
        // ------------------------------------------------------

        async fetchAllTechnicians() {
            try {
                this.technicians = await apiTechnicians.allWhileEvent(this.event.id);
                this.isFetched = true;
            } catch (error) {
                // eslint-disable-next-line no-console
                console.error(`Error occurred while retrieving technicians:`, error);
                this.hasCriticalError = true;
            }
        },

        async updateEvent() {
            this.isLoading = true;
            try {
                const data = await apiEvents.one(this.event.id);
                this.$emit('updateEvent', data, { save: true });
            } catch {
                this.hasCriticalError = true;
            } finally {
                this.isLoading = false;
            }
        },

        __(key: string, params?: Record<string, number | string>, count?: number): string {
            if (!key.startsWith('global.')) {
                if (!key.startsWith('page.')) {
                    key = `page.steps.technicians.${key}`;
                }
                key = key.replace(/^page\./, 'page.event-edit.');
            } else {
                key = key.replace(/^global\./, '');
            }
            return this.$t(key, params, count);
        },
    },
    render() {
        const {
            __,
            groups,
            filters,
            assignationPeriod,
            assignments,
            isLoading,
            isFetched,
            hasCriticalError,
            hasAssignableTechnicians,
            hasFilteredTechnicians,
            handleNextClick,
            handlePrevClick,
            handleFiltersChange,
            handleTimelineItemMove,
            handleTimelineItemRemove,
            handleTimelineDoubleClick,
        } = this;

        const renderContent = (): JSX.Element => {
            if (hasCriticalError) {
                return <CriticalError />;
            }

            if (!isFetched) {
                return <Loading />;
            }

            if (!hasAssignableTechnicians) {
                return (
                    <div class="EventEditStepTechnicians__no-technician">
                        <p class="EventEditStepTechnicians__no-technician__message">
                            {__('no-technician-pass-this-step')}
                        </p>
                        <Button
                            type="primary"
                            icon={{ name: 'arrow-right', position: 'after' }}
                            onClick={handleNextClick}
                        >
                            {__('page.continue')}
                        </Button>
                    </div>
                );
            }

            if (!hasFilteredTechnicians) {
                return (
                    <StateMessage
                        type={State.NO_RESULT}
                        message={__('no-technician-with-this-search')}
                    />
                );
            }

            return (
                <div class="EventEditStepTechnicians__timeline">
                    <Timeline
                        class="EventEditStepTechnicians__timeline__element"
                        period={assignationPeriod}
                        zoomMin={MIN_ZOOM}
                        items={assignments}
                        groups={groups}
                        onItemMove={handleTimelineItemMove}
                        onItemRemove={handleTimelineItemRemove}
                        onDoubleClick={handleTimelineDoubleClick}
                        snapTime={{ precision: 15, unit: 'minutes' }}
                        hideCurrentTime
                        editable
                    />
                </div>
            );
        };

        return (
            <div class="EventEditStepTechnicians">
                <header class="EventEditStepTechnicians__header">
                    <div class="EventEditStepTechnicians__header__main">
                        <h1 class="EventEditStepTechnicians__title">
                            {__('title')}
                        </h1>
                        {isLoading && <Loading horizontal />}
                        {(!isLoading && hasAssignableTechnicians) && (
                            <div class="EventEditStepTechnicians__header__main__help">
                                {__('help-technicians')}
                            </div>
                        )}
                    </div>
                    <FiltersPanel
                        values={filters}
                        onChange={handleFiltersChange}
                    />
                </header>
                <div class="EventEditStepTechnicians__content">
                    {renderContent()}
                </div>
                <section class="EventEditStepTechnicians__footer">
                    <Button
                        type="default"
                        icon={{ name: 'arrow-left', position: 'before' }}
                        disabled={isLoading}
                        onClick={handlePrevClick}
                    >
                        {__('page.save-and-go-to-prev-step')}
                    </Button>
                    {hasAssignableTechnicians && (
                        <Button
                            type="primary"
                            disabled={isLoading}
                            icon={{ name: 'arrow-right', position: 'after' }}
                            onClick={handleNextClick}
                        >
                            {__('page.save-and-go-to-next-step')}
                        </Button>
                    )}
                </section>
            </div>
        );
    },
});

export default EventEditStepTechnicians;
