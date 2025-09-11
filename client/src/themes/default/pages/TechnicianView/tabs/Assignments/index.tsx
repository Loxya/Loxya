import './index.scss';
import Day from '@/utils/day';
import config from '@/globals/config';
import Period, { PeriodReadableFormat } from '@/utils/period';
import DateTime from '@/utils/datetime';
import truncate from 'lodash/truncate';
import parseInteger from '@/utils/parseInteger';
import { defineComponent, markRaw } from 'vue';
import apiTechnicians from '@/stores/api/technicians';
import showModal from '@/utils/showModal';
import EventDetails, { TabIndex as EventDetailsTab } from '@/themes/default/modals/EventDetails';
import CriticalError from '@/themes/default/components/CriticalError';
import Loading from '@/themes/default/components/Loading';
import EmptyMessage from '@/themes/default/components/EmptyMessage';
import Timeline from '@/themes/default/components/Timeline';
import Item from './components/Item';
import ItemGroupEvent from './components/ItemGroupEvent';
import ItemGroupRole from './components/ItemGroupRole';

import type { ComponentRef, PropType, Raw } from 'vue';
import type Color from '@/utils/color';
import type { Technician, TechnicianEvent } from '@/stores/api/technicians';
import type { TimelineClickEvent, TimelineItem } from '@/themes/default/components/Timeline';
import type { AssignmentGroupEvent, AssignmentGroupRole } from './_types';
import type { Role } from '@/stores/api/roles';

export enum AssignmentListDisplayMode {
    DEFAULT = 'default',
    BY_EVENT = 'by-event',
    BY_POSITION = 'by-position',
}

export const EMPTY_ROLE_ID = '__NONE__';

type Props = {
    /** Le technicien dont on veut voir le planning. */
    technician: Technician,

    /** Le mode d'affichage de la liste (groupée par événement, par poste ou non groupée). */
    displayMode: AssignmentListDisplayMode,
};

type InstanceProperties = {
    nowTimer: ReturnType<typeof setInterval> | undefined,
    cancelOngoingFetch: (() => void) | undefined,
};

type Data = {
    assignments: TechnicianEvent[],
    defaultShownPeriod: Raw<Period>,
    hasCriticalError: boolean,
    isFetched: boolean,
    now: Raw<DateTime>,
};

/**
 * Interval de temps minimum affiché dans la timeline.
 * (Il ne sera pas possible d'augmenter le zoom au delà de cette limite)
 */
const MIN_ZOOM = DateTime.duration(1, 'hour');

/**
 * Interval de temps maximum affiché dans la timeline.
 * (Il ne sera pas possible de dé-zoomer au delà de cette limite)
 */
const MAX_ZOOM = DateTime.duration(config.maxFetchPeriod, 'days');

/** Onglet de la liste des assignations du technicien. */
const TechnicianViewAssignments = defineComponent({
    name: 'TechnicianViewAssignments',
    props: {
        technician: {
            type: Object as PropType<Props['technician']>,
            required: true,
        },
        displayMode: {
            type: String as PropType<Props['displayMode']>,
            required: false,
            default: AssignmentListDisplayMode.DEFAULT,
        },
    },
    setup: (): InstanceProperties => ({
        nowTimer: undefined,
        cancelOngoingFetch: undefined,
    }),
    data: (): Data => ({
        assignments: [],
        defaultShownPeriod: markRaw(new Period(
            Day.today().subDay(7),
            Day.today().addDay(7),
            true,
        )),
        hasCriticalError: false,
        isFetched: false,
        now: markRaw(DateTime.now()),
    }),
    computed: {
        timelineAssignments(): TimelineItem[] {
            const { $t: __, now } = this;

            return this.assignments.map((assignment: TechnicianEvent): TimelineItem => {
                const { event } = assignment;
                const { is_confirmed: isConfirmed } = event;
                const isPast = assignment.period.isBefore(now);

                const color: Color | null = event.color ?? null;

                // - Si la date de fin est minuit du jour suivant, on la met à la seconde précédente
                //   pour éviter que le slot apparaisse dans le jour suivant sur le calendrier.
                const period = new Period(
                    (assignment.period as Period<false>).start,
                    (
                        (assignment.period as Period<false>).end.isStartOfDay()
                            ? (assignment.period as Period<false>).end.subSecond()
                            : (assignment.period as Period<false>).end
                    ),
                );

                const eventInfos = (event.location ?? '').length > 0
                    ? `${truncate(event.title, { length: 25 })} (${truncate(event.location!, { length: 15 })})`
                    : truncate(event.title, { length: 45 });

                const formattedPeriod = assignment.period.toReadable(__, PeriodReadableFormat.MINIMALIST);
                const assignmentInfos = assignment.role
                    ? `${formattedPeriod}: ${assignment.role.name}`
                    : formattedPeriod;

                return {
                    id: assignment.id,
                    summary: `${eventInfos}\n${assignmentInfos}`,
                    period,
                    color: color?.toHexString() ?? null,
                    className: ['TechnicianViewAssignments__item', {
                        'TechnicianViewAssignments__item--past': isPast,
                        'TechnicianViewAssignments__item--not-confirmed': !isConfirmed,
                    }],
                };
            });
        },

        pastCount(): number {
            const { assignments } = this;
            return assignments
                .filter(({ period }: TechnicianEvent) => period.end.isBefore(this.now))
                .length;
        },

        futureCount(): number {
            const { assignments } = this;
            return assignments
                .filter(({ period }: TechnicianEvent) => period.start.isAfter(this.now))
                .length;
        },

        sortedAssignments(): TechnicianEvent[] {
            const { assignments } = this;
            return [...assignments].sort((a1: TechnicianEvent, a2: TechnicianEvent) => (
                a2.period.start.compare(a1.period.start as DateTime)
            ));
        },

        groupedByEvent(): AssignmentGroupEvent[] {
            const groupedByEvent = new Map<TechnicianEvent['event_id'], AssignmentGroupEvent>();
            this.assignments.forEach((assignment: TechnicianEvent) => {
                const { event_id: eventId, event } = assignment;
                if (!groupedByEvent.has(eventId)) {
                    groupedByEvent.set(eventId, { event, assignments: [] });
                }
                groupedByEvent.get(eventId)?.assignments.push(assignment);
            });

            return Array.from(groupedByEvent.values())
                .sort((a1: AssignmentGroupEvent, a2: AssignmentGroupEvent) => (
                    a2.event.mobilization_period.start.compare(a1.event.mobilization_period.start as DateTime)
                ));
        },

        groupedByRole(): AssignmentGroupRole[] {
            const groupedByRole = new Map<Role['id'] | null, AssignmentGroupRole>();
            this.assignments.forEach((assignment: TechnicianEvent) => {
                const { role } = assignment;
                const roleId = role?.id ?? null;
                if (!groupedByRole.has(roleId)) {
                    groupedByRole.set(roleId, { role, assignments: [] });
                }
                groupedByRole.get(roleId)?.assignments.push(assignment);
            });

            return Array.from(groupedByRole.values());
        },
    },
    mounted() {
        this.fetchData();

        // - Actualise le timestamp courant toutes les 60 secondes.
        this.nowTimer = setInterval(() => { this.now = markRaw(DateTime.now()); }, 60_000);
    },
    beforeDestroy() {
        if (this.nowTimer) {
            clearInterval(this.nowTimer);
        }
    },
    methods: {
        // ------------------------------------------------------
        // -
        // -    Handlers
        // -
        // ------------------------------------------------------

        handleClickItem(assignmentId: TechnicianEvent['id']) {
            // - Récupération de l'assignation liée.
            const assignment = this.assignments.find(({ id }: TechnicianEvent) => (
                id === assignmentId
            ));
            if (assignment === undefined) {
                return;
            }

            const $timeline = this.$refs.timeline as ComponentRef<typeof Timeline>;
            $timeline?.moveTo(assignment.period.start);
        },

        handleClickOpenItem(assignmentId: TechnicianEvent['id']) {
            const assignment = this.assignments.find(({ id }: TechnicianEvent) => (
                id === assignmentId
            ));
            if (!assignment) {
                return;
            }
            this.showEventModal(assignment.event_id);
        },

        handleClickOpenEvent(eventId: TechnicianEvent['event_id']) {
            this.showEventModal(eventId);
        },

        handleDoubleClickTimelineItem(payload: TimelineClickEvent) {
            // - Si c'est un double-clic sur une partie vide (= sans booking) du calendrier...
            //   => On ne pas va plus loin.
            const identifier = payload.item?.id ?? null;
            if (identifier === null) {
                return;
            }

            const assignmentId = parseInteger(identifier);
            if (assignmentId === null) {
                return;
            }

            const assignment = this.assignments.find(({ id }: TechnicianEvent) => (
                id === assignmentId
            ));
            if (!assignment) {
                return;
            }

            this.showEventModal(assignment.event_id);
        },

        handleClickTimelineItem(payload: TimelineClickEvent) {
            const identifier = payload.item?.id ?? null;
            if (identifier === null) {
                return;
            }

            const assignment = this.assignments.find(({ id }: TechnicianEvent) => (
                id === identifier
            ));
            if (!assignment) {
                return;
            }

            const itemId = this.displayMode === AssignmentListDisplayMode.BY_EVENT
                ? assignment.event_id
                : assignment.id;

            const $item = this.$refs[`items[${itemId}]`] as ComponentRef<typeof HTMLElement>;
            $item?.scrollIntoView();
        },

        // ------------------------------------------------------
        // -
        // -    Méthodes internes
        // -
        // ------------------------------------------------------

        async fetchData() {
            const { id } = this.technician;

            try {
                this.assignments = await apiTechnicians.assignments(id);
                this.isFetched = true;
            } catch (error) {
                // eslint-disable-next-line no-console
                console.error(`Error occurred while retrieving technician assignments:`, error);
                this.hasCriticalError = true;
            }
        },

        async showEventModal(id: TechnicianEvent['event_id']) {
            await showModal(this.$modal, EventDetails, {
                id,
                defaultTabIndex: EventDetailsTab.TECHNICIANS,
                onClose: () => { this.fetchData(); },
            });
        },

        __(key: string, params?: Record<string, number | string>, count?: number): string {
            key = !key.startsWith('global.')
                ? `page.technician-view.assignments.${key}`
                : key.replace(/^global\./, '');

            return this.$t(key, params, count);
        },
    },
    render() {
        const {
            __,
            isFetched,
            hasCriticalError,
            displayMode,
            sortedAssignments,
            groupedByEvent,
            groupedByRole,
            defaultShownPeriod,
            timelineAssignments,
            handleClickItem,
            handleClickOpenItem,
            handleClickOpenEvent,
            handleClickTimelineItem,
            handleDoubleClickTimelineItem,
        } = this;

        if (hasCriticalError || !isFetched) {
            return (
                <div class="TechnicianViewAssignments">
                    {hasCriticalError ? <CriticalError /> : <Loading />}
                </div>
            );
        }

        if (groupedByEvent.length === 0) {
            return (
                <div class="TechnicianViewAssignments">
                    <EmptyMessage message={__('nothing-to-show')} />
                </div>
            );
        }

        const renderStat = (): JSX.Element => {
            if (displayMode === AssignmentListDisplayMode.BY_EVENT) {
                return (
                    <h3 class="TechnicianViewAssignments__stat">
                        {__('total-events-assignments', {
                            count: sortedAssignments.length,
                            eventsCount: groupedByEvent.length,
                        })}
                    </h3>
                );
            }

            if (displayMode === AssignmentListDisplayMode.BY_POSITION) {
                return (
                    <h3 class="TechnicianViewAssignments__stat">
                        {__('total-positions-assignments', {
                            count: sortedAssignments.length,
                            positionsCount: groupedByRole.length,
                        })}
                    </h3>
                );
            }

            const { pastCount, futureCount } = this;
            const totalCount = pastCount + futureCount;

            return (
                <h3 class="TechnicianViewAssignments__stat">
                    {pastCount > 0 && (
                        <span class="TechnicianViewAssignments__stat__item">
                            {__('past-assignments-count', { count: pastCount }, pastCount)}
                        </span>
                    )}
                    {futureCount > 0 && (
                        <span class="TechnicianViewAssignments__stat__item">
                            {__('future-assignments-count', { count: futureCount }, futureCount)}
                        </span>
                    )}
                    {(pastCount > 0 && futureCount > 0) && (
                        <span class="TechnicianViewAssignments__stat__item">
                            {__('total-assignments', { count: totalCount }, totalCount)}
                        </span>
                    )}
                </h3>
            );
        };

        const renderList = (): JSX.Element[] => {
            if (displayMode === AssignmentListDisplayMode.BY_EVENT) {
                return groupedByEvent.map((eventGroup: AssignmentGroupEvent) => (
                    <ItemGroupEvent
                        ref={`items[${eventGroup.event.id}]`}
                        key={eventGroup.event.id}
                        data={eventGroup}
                        onClick={handleClickItem}
                        onOpenEventClick={handleClickOpenEvent}
                    />
                ));
            }

            if (displayMode === AssignmentListDisplayMode.BY_POSITION) {
                return groupedByRole.map((roleGroup: AssignmentGroupRole) => (
                    <ItemGroupRole
                        ref={`items[${roleGroup.role?.id ?? EMPTY_ROLE_ID}]`}
                        key={roleGroup.role?.id ?? EMPTY_ROLE_ID}
                        data={roleGroup}
                        onClick={handleClickItem}
                        onOpenClick={handleClickOpenItem}
                    />
                ));
            }

            return sortedAssignments.map((assignment: TechnicianEvent) => (
                <Item
                    ref={`items[${assignment.id}]`}
                    key={assignment.id}
                    assignment={assignment}
                    onClick={handleClickItem}
                    onOpenClick={handleClickOpenItem}
                />
            ));
        };

        return (
            <div class="TechnicianViewAssignments">
                <ul class="TechnicianViewAssignments__listing">
                    {renderStat()}
                    {renderList()}
                </ul>
                <div class="TechnicianViewAssignments__timeline">
                    <Timeline
                        ref="timeline"
                        class="TechnicianViewAssignments__timeline__element"
                        defaultPeriod={defaultShownPeriod}
                        zoomMin={MIN_ZOOM}
                        zoomMax={MAX_ZOOM}
                        items={timelineAssignments}
                        onClick={handleClickTimelineItem}
                        onDoubleClick={handleDoubleClickTimelineItem}
                    />
                </div>
            </div>
        );
    },
});

export default TechnicianViewAssignments;
