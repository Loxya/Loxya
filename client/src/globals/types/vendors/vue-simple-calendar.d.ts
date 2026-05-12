declare module 'vue-simple-calendar' {
    import type { RawComponent } from 'vue';
    import type { Simplify } from 'type-fest';

    export type CalendarItem = {
        id: string | number,
        startDate: Date | string,
        endDate?: Date | string,
        title: string,
        classes?: string,
        style?: string,
    };

    export type NormalizedCalendarItem = Simplify<(
        & Omit<CalendarItem, 'startDate' | 'endDate' | 'classes'>
        & {
            originalItem: CalendarItem,
            startDate: Date,
            endDate: Date,
            classes: string[],
        }
    )>;

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

        /**
         * Fonction appelée lorsqu'une date est cliquée.
         *
         * @param date - La date cliquée.
         * @param items - Les éléments du calendrier à cette date.
         * @param event - L'événement d'origine.
         */
        onClickDate?(date: Date, items: NormalizedCalendarItem[], event: Event): void,

        /**
         * Fonction appelée lorsqu'un élément est cliqué.
         *
         * @param item - L'élément cliqué.
         * @param event - L'événement d'origine.
         */
        onClickItem?(item: NormalizedCalendarItem, event: Event): void,
    }>;
}
