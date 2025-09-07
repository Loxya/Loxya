declare module 'vue-simple-calendar' {
    import type { RawComponent } from 'vue';

    export type CalendarItem = {
        id: string | number,
        startDate: Date | string,
        endDate?: Date | string,
        title: string,
        classes?: string,
        style?: string,
    };

    export const CalendarView: RawComponent<{
        showDate?: Date,
        displayPeriodUom?: 'month' | 'year' | 'week',
        displayPeriodCount?: number,
        startingDayOfWeek?: number,
        displayWeekNumbers?: boolean,
        showTimes?: boolean,
        locale?: string,
        dateClasses?: Record<string, string[]>,
        monthNameFormat?: 'numeric' | '2-digit' | 'long' | 'short' | 'narrow',
        weekdayNameFormat?: 'long' | 'short' | 'narrow',
        timeFormatOptions?: Intl.DateTimeFormatOptions,
        disablePast?: boolean,
        disableFuture?: boolean,
        enableDateSelection?: boolean,
        selectionStart?: Date,
        selectionEnd?: Date,
        items?: CalendarItem[],
        enableDragDrop?: boolean,
        itemTop?: string,
        itemContentHeight?: string,
        itemBorderHeight?: string,
        periodChangedCallback?(newPeriod: any): void,
        currentPeriodLabel?: string,
        currentPeriodLabelIcons?: string,
        doEmitItemMouseEvents?: boolean,
    }>;
}
