declare module 'vue2-datepicker' {
    import type { RawComponent } from 'vue';

    export type Translations = {
        days?: string[],
        months?: string[],
        yearFormat: string,
        monthFormat: string,
        monthBeforeYear: boolean,
        formatLocale: {
            months: string[],
            monthsShort: string[],
            weekdays: string[],
            weekdaysShort: string[],
            weekdaysMin: string[],
            firstDayOfWeek: number,
            firstWeekContainsDate: number,
            meridiem(h: number, _: number, isLowercase: boolean): boolean,
            meridiemParse: RegExp,
            isPM(input: string): boolean,
        },
    };

    export type Shortcuts = {
        text: string,
        onClick(): any,
    };

    export type TimePickerValue = {
        value: number,
        text: string,
    };

    export type TimePickerOptions = {
        start: string,
        step: string,
        end: string,
        format: string,
    };

    export type Formatter = {
        stringify(date: Date | null | undefined, format: string): string,
        parse(value: string | null | undefined, format: string): Date | null,
        getWeek?(value: Date, options: { firstDayOfWeek?: number, firstWeekContainsDate?: number }): number,
    };

    export type DatePickerEmit = (value: Date | [Date, Date] | null | [null, null]) => void;
    export type DatePickerSlotParams = { emit: DatePickerEmit };

    const Datepicker: RawComponent<{
        type?: 'date' | 'datetime' | 'year' | 'month' | 'time' | 'week',
        range?: boolean,
        format?: string,
        formatter?: Formatter,
        valueType?: 'date' | 'timestamp' | 'format' | string,
        defaultValue?: Date,
        value?: (
            | Date
            | string
            | number
            | null
            | [
                Date | string | number | null,
                Date | string | number | null,
            ]
        ),
        lang?: Translations,
        placeholder?: string,
        editable?: boolean,
        clearable?: boolean,
        readonly?: boolean | 'start' | 'end',
        confirm?: boolean,
        confirmText?: string,
        multiple?: boolean,
        disabled?: boolean,
        appendToBody?: boolean,
        calculatePosition?($popup: HTMLElement, $field: HTMLElement): (void | (() => void)),
        disabledDate?(date: Date, currentValue: 0 | 1 | [Date?, Date?]): boolean,
        disabledTime?(date: Date, side: 0 | 1): boolean,
        inline?: boolean,
        inputClass?: string,
        inputAttr?(): Record<string, any>,
        open?: boolean,
        defaultPanel?: 'year' | 'month',
        popupStyle?(): Record<string, any>,
        popupClass?: string,
        shortcuts?: Shortcuts[],
        titleFormat?: string,
        partialUpdate?: boolean,
        rangeSeparator?: string,
        showWeekNumber?: boolean,
        showTimePanel?: boolean,
        hourStep?: number,
        minuteStep?: number,
        secondStep?: number,
        hourOptions?: number[],
        minuteOptions?: number[],
        secondOptions?: number[],
        showHour?: boolean,
        showMinute?: boolean,
        showSecond?: boolean,
        use12h?: boolean,
        showTimeHeader?: boolean,
        timeTitleFormat?: string,
        timePickerOptions?: (
            | TimePickerOptions
            | ((selectedDate: Date, side: 'start' | 'end') => TimePickerOptionValue[])
        ),
        prefixClass?: string,
        scrollDuration?: number,
        onInput?(newValue: string | null | [start: string | null, end: string | null]): void,
        onClose?(): void,
    }>;

    export default Datepicker;
}

declare module 'vue2-datepicker/locale/es/fr' {
    import type { Translations } from 'vue2-datepicker';

    const translations: Translations;
    export default translations;
}
declare module 'vue2-datepicker/locale/es/en' {
    import type { Translations } from 'vue2-datepicker';

    const translations: Translations;
    export default translations;
}
