import './index.scss';
import clsx from 'clsx';
import Color from '@/utils/color';
import DateTime from '@/utils/datetime';
import { getLocale } from '@/globals/lang';
import { defineComponent, markRaw } from 'vue';
import styleObjectToString from 'style-object-to-css-string';
import { CalendarView } from 'vue-simple-calendar';
import Button from '../Button';

import type Period from '@/utils/period';
import type { ClassValue } from 'clsx';
import type { RawColor } from '@/utils/color';
import type { PropType, Raw } from 'vue';
import type { CalendarItem as CalendarItemCore } from 'vue-simple-calendar';

export type CalendarItem = {
    id: string | number,
    summary: string,
    period: Period,
    color?: Color | RawColor | null,
    className?: ClassValue,
    style?: AnyLiteralObject,
};

type Props = {
    /** Les événements à afficher sur le calendrier. */
    items: CalendarItem[],

    /**
     * Fonction appelée lorsque l'élément du calendrier a été cliqué.
     *
     * @param id - Identifiant de l'élément cliqué.
     */
    onClickItem?(id: CalendarItem['id']): void,

    /**
     * Fonction appelée lorsque l'élément du calendrier a été double-cliqué.
     *
     * @param id - Identifiant de l'élément double-cliqué.
     */
    onDoubleClickItem?(id: CalendarItem['id']): void,
};

type InstanceProperties = {
    doubleClickTimeoutId: ReturnType<typeof setTimeout> | undefined,
    previouslyClickedItemId: number | string | undefined,
};

type Data = {
    displayedDate: Raw<DateTime>,
};

/** Un calendrier mensuel. */
const MonthCalendar = defineComponent({
    name: 'MonthCalendar',
    props: {
        items: {
            type: Array as PropType<Props['items']>,
            required: true,
        },
        // eslint-disable-next-line vue/no-unused-properties
        onClickItem: {
            type: Function as PropType<Props['onClickItem']>,
            default: undefined,
        },
        // eslint-disable-next-line vue/no-unused-properties
        onDoubleClickItem: {
            type: Function as PropType<Props['onDoubleClickItem']>,
            default: undefined,
        },
    },
    emits: ['clickItem', 'doubleClickItem'],
    setup: (): InstanceProperties => ({
        doubleClickTimeoutId: undefined,
        previouslyClickedItemId: undefined,
    }),
    data: (): Data => ({
        displayedDate: markRaw(DateTime.now()),
    }),
    computed: {
        firstDayOfWeek(): number {
            return DateTime.localeData().firstDayOfWeek();
        },

        formattedItems(): CalendarItemCore[] {
            return (this.items ?? []).map((rawItem: CalendarItem): CalendarItemCore => {
                const {
                    summary,
                    period: inputPeriod,
                    style: rawStyle = {},
                    color: rawColor = null,
                    className: rawClassName = [],
                    ...item
                } = rawItem;

                const period = inputPeriod.setFullDays(false);
                const style = typeof rawStyle === 'object' ? { ...rawStyle } : {};
                const className = ['MonthCalendar__item'];

                if (rawColor !== null && rawColor !== undefined) {
                    const color = new Color(rawColor);

                    if (!('--month-calendar-item-color' in style)) {
                        style['--month-calendar-item-color'] = color.toHexString();
                    }

                    const colorType = color.isDark() ? 'dark' : 'light';
                    className.push(
                        `MonthCalendar__item--with-custom-color`,
                        `MonthCalendar__item--with-${colorType}-color`,
                    );
                }

                return {
                    ...item,
                    title: summary,
                    startDate: period.start.toDate(),
                    endDate: period.end.toDate(),
                    style: styleObjectToString(style),
                    classes: clsx(className, rawClassName),
                };
            });
        },
    },
    beforeDestroy() {
        if (this.doubleClickTimeoutId) {
            clearTimeout(this.doubleClickTimeoutId);
        }
    },
    methods: {
        handlePrevMonthClick() {
            this.displayedDate = markRaw(this.displayedDate.sub(1, 'month'));
        },

        handleNextMonthClick() {
            this.displayedDate = markRaw(this.displayedDate.add(1, 'month'));
        },

        handleClickItem({ originalItem: { id } }: { originalItem: CalendarItemCore }) {
            this.$emit('clickItem', id);

            if (
                this.previouslyClickedItemId !== undefined &&
                this.previouslyClickedItemId === id
            ) {
                this.previouslyClickedItemId = undefined;
                this.$emit('doubleClickItem', id);
            }

            this.previouslyClickedItemId = id;
            this.doubleClickTimeoutId = setTimeout(
                () => { this.previouslyClickedItemId = undefined; },
                300,
            );
        },
    },
    render() {
        const {
            $t: __,
            firstDayOfWeek,
            displayedDate,
            formattedItems,
            handlePrevMonthClick,
            handleNextMonthClick,
            handleClickItem,
        } = this;

        return (
            <div class="MonthCalendar">
                <header class="MonthCalendar__header">
                    <Button
                        type="secondary"
                        icon="arrow-left"
                        tooltip={__('previous-month')}
                        onClick={handlePrevMonthClick}
                    />
                    <span class="MonthCalendar__header__current-month">
                        {displayedDate.format('MMMM YYYY')}
                    </span>
                    <Button
                        type="secondary"
                        icon="arrow-right"
                        tooltip={__('next-month')}
                        onClick={handleNextMonthClick}
                    />
                    <h4 class="MonthCalendar__header__count">
                        {__('events-count-total', { count: formattedItems.length }, formattedItems.length)}
                    </h4>
                </header>
                <CalendarView
                    class="MonthCalendar__body"
                    displayPeriodUom="month"
                    showDate={displayedDate.toDate()}
                    startingDayOfWeek={firstDayOfWeek}
                    weekdayNameFormat="short"
                    items={formattedItems}
                    itemContentHeight="53px"
                    itemBorderHeight="0px"
                    locale={getLocale()}
                    // Note: Le camelCase (`onClickItem`) ne fonctionne pas.
                    onClick-item={handleClickItem}
                    doEmitItemMouseEvents
                />
            </div>
        );
    },
});

export default MonthCalendar;
