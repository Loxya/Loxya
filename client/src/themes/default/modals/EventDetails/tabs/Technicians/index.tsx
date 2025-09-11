import './index.scss';
import DateTime from '@/utils/datetime';
import { PeriodReadableFormat } from '@/utils/period';
import { defineComponent } from 'vue';
import EmptyMessage from '@/themes/default/components/EmptyMessage';
import Timeline from '@/themes/default/components/Timeline';
import formatEventTechniciansList from '@/utils/formatEventTechniciansList';

import type Period from '@/utils/period';
import type { PropType } from 'vue';
import type { EventDetails, EventTechnician } from '@/stores/api/events';
import type { TechnicianWithPeriods } from '@/utils/formatEventTechniciansList';
import type { TimelineItem, TimelineGroup } from '@/themes/default/components/Timeline';

type Props = {
    /** L'événement dont on souhaite afficher l'onglet des techniciens. */
    event: EventDetails,
};

/** Onglet "Techniciens" de la fenêtre d'un événement. */
const EventDetailsTechnicians = defineComponent({
    name: 'EventDetailsTechnicians',
    props: {
        event: {
            type: Object as PropType<Required<Props>['event']>,
            required: true,
        },
    },
    computed: {
        assignationPeriod(): Period<false> {
            return this.event.mobilization_period
                .merge(this.event.operation_period)
                .setFullDays(false);
        },

        hasAssignments(): boolean {
            return this.event.technicians.length > 0;
        },

        groups(): TimelineGroup[] {
            const techniciansList = formatEventTechniciansList(this.event.technicians);
            return techniciansList.map(({ id, name }: TechnicianWithPeriods) => ({ id, name }));
        },

        events(): TimelineItem[] {
            const { $t: __, event } = this;

            const eventInfos = (event.location ?? '').length > 0
                ? `${event.title} (${event.location!})`
                : event.title;

            return (event.technicians ?? []).map((assignment: EventTechnician) => {
                const formattedPeriod = assignment.period.toReadable(__, PeriodReadableFormat.MINIMALIST);
                const assignmentInfos = assignment.role !== null
                    ? `${formattedPeriod}: ${assignment.role.name}`
                    : formattedPeriod;

                return {
                    id: assignment.id,
                    summary: assignmentInfos,
                    tooltip: `${eventInfos}\n${assignmentInfos}`,
                    period: assignment.period,
                    group: assignment.technician.id,
                    type: 'range',
                };
            });
        },
    },
    render() {
        const { hasAssignments, events, groups, assignationPeriod } = this;

        if (!hasAssignments) {
            return (
                <div class="EventDetailsTechnicians">
                    <EmptyMessage size="small" />
                </div>
            );
        }

        return (
            <div class="EventDetailsTechnicians">
                <Timeline
                    class="EventDetailsTechnicians__timeline"
                    period={assignationPeriod}
                    zoomMin={DateTime.duration(1, 'hour')}
                    items={events}
                    groups={groups}
                    hideCurrentTime
                />
            </div>
        );
    },
});

export default EventDetailsTechnicians;
