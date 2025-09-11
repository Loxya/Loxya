import './index.scss';
import { defineComponent } from 'vue';
import Icon from '@/themes/default/components/Icon';

/** Légende de la page de calendrier. */
const ScheduleCalendarCaption = defineComponent({
    name: 'ScheduleCalendarCaption',
    render() {
        const { $t: __ } = this;

        return (
            <div class="ScheduleCalendarCaption">
                <div class="ScheduleCalendarCaption__group">
                    <h4 class="ScheduleCalendarCaption__title">{__('page.schedule.calendar.caption.title')}</h4>
                    <div class="timeline-event timeline-event--past timeline-event--archived">
                        <Icon name="archive" />
                        {__('page.schedule.calendar.caption.archived')}
                    </div>
                </div>
                <div class="ScheduleCalendarCaption__group">
                    <div class="timeline-event timeline-event--past">
                        <Icon name="check" />
                        {__('page.schedule.calendar.caption.past-and-ok')}
                    </div>
                    <div class="timeline-event timeline-event--past timeline-event--with-warning">
                        <Icon name="exclamation-triangle" />
                        {__('page.schedule.calendar.caption.past-material-not-returned')}
                    </div>
                </div>
                <div class="ScheduleCalendarCaption__group">
                    <div class="timeline-event timeline-event--past timeline-event--no-return-inventory">
                        <Icon name="clock" />
                        {__('page.schedule.calendar.caption.past-no-inventory')}
                    </div>
                    <div class="timeline-event timeline-event--past timeline-event--not-confirmed">
                        <Icon name="question" />
                        {__('page.schedule.calendar.caption.past-not-confirmed')}
                    </div>
                </div>
                <div class="ScheduleCalendarCaption__group">
                    <div class="timeline-event timeline-event--in-progress">
                        <Icon name="check" />
                        {__('page.schedule.calendar.caption.current-confirmed')}
                    </div>
                    <div class="timeline-event timeline-event--in-progress timeline-event--not-confirmed">
                        <Icon name="question" />
                        {__('page.schedule.calendar.caption.current-not-confirmed')}
                    </div>
                </div>
                <div class="ScheduleCalendarCaption__group">
                    <div class="timeline-event">
                        <Icon name="check" />
                        {__('page.schedule.calendar.caption.future-confirmed')}
                    </div>
                    <div class="timeline-event timeline-event--not-confirmed">
                        <Icon name="question" />
                        {__('page.schedule.calendar.caption.future-not-confirmed')}
                    </div>
                </div>
            </div>
        );
    },
});

export default ScheduleCalendarCaption;
