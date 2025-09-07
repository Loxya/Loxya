/* eslint-disable import/order */
import '@loxya/vis-timeline/index.scss';
import './index.scss';
/* eslint-enable import/order */

import clsx from 'clsx';
import moment from 'moment';
import Day from '@/utils/day';
import invariant from 'invariant';
import Color from '@/utils/color';
import Period from '@/utils/period';
import pick from 'lodash/pick';
import throttle from 'lodash/throttle';
import isTruthy from '@/utils/isTruthy';
import { mountVisData } from './_utils';
import { getLocale } from '@/globals/lang';
import styleObjectToString from 'style-object-to-css-string';
import safeJsonParse from '@/utils/safeJsonParse';
import { defineComponent, markRaw } from 'vue';
import { Timeline as TimelineCore } from '@loxya/vis-timeline';
import DateTime, { DateTimeRoundingMethod } from '@/utils/datetime';
import Loading from '@/themes/default/components/Loading';
import { TimelineItemPeriodType } from './_types';
import {
    Variant as IconVariant,
    VARIANT_MAP as ICON_VARIANT_MAP,
} from '@/themes/default/components/Icon';

import type { ClassValue } from 'clsx';
import type { MomentInput } from 'moment';
import type { DebouncedMethod } from 'lodash';
import type { Duration } from '@/utils/datetime';
import type { PropType, Raw } from 'vue';
import type {
    SnapTime,
    TimelineItem,
    TimelineItemIdentifier,
    TimelineGroup,
    TimelineClickEvent,
    TimelineDataChangeEvent,
    TimelineConfirmCallback,
    TimelineGroupAction,
} from './_types';
import type {
    DataSet,
    TimelineItem as TimelineItemCore,
    TimelineGroup as TimelineGroupCore,
    TimelineClickEvent as TimelineClickEventCore,
    TimelineChangeEvent as TimelineChangeEventCore,
    ItemOverEvent,
    RangeChangedEvent,
    TimelineOptions,
    TimelineEventName,
} from '@loxya/vis-timeline';

type Props = {
    /**
     * La période disponible à l'affichage dans la timeline.
     * Si non spécifiée, il n'y aura pas de limite dans la période affichée.
     */
    period?: Period,

    /**
     * La période par défaut à afficher dans la timeline.
     *
     * Si non spécifiée et que `period` est défini, c'est cette période qui sera utilisée,
     * sinon, la période affichée sera dans l'interval entre le premier élément passé à
     * la timeline et le dernier.
     */
    defaultPeriod?: Period,

    /** Les événements à afficher sur la timeline. */
    items: TimelineItem[],

    /** Les éventuels groupes dans lesquels les éléments sont répartis. */
    groups?: TimelineGroup[],

    /**
     * Permet de limiter la précision des heures / minutes / secondes lors
     * du déplacement ou de la création d'un nouvel élément.
     *
     * Par exemple avec `snapTime` à `{ unit: 'minute', precision: 15 }`, il
     * ne sera possible de déplacer les éléments qu'à `:00`, `:15` et `:45`.
     */
    snapTime?: SnapTime,

    /**
     * Les éléments de la timeline peuvent-t'ils être modifiés ?
     *
     * Si `true`, les actions suivantes seront possible:
     * - Modification de la période en déplacement l'élément directement depuis la timeline.
     * - Suppression de l'élément directement depuis la timeline.
     */
    editable?: boolean,

    /**
     * Interval de temps minimum au delà duquel il ne sera plus possible de zoomer.
     *
     * Par exemple, avec `DateTime.duration(1, 'day')`, il ne sera pas possible de  zoomer au
     * delà de 1 journée: Lors d'un zoom max, la timeline affichera donc une journée au minimum.
     */
    zoomMin?: Duration,

    /**
     * Interval de temps maximum au delà duquel il ne sera plus possible de dé-zoomer.
     *
     * Par exemple, avec `DateTime.duration(1, 'day')`, il ne sera pas possible de dé-zoomer au
     * delà de 1 journée: Lors d'un dé-zoom max, la timeline affichera donc une journée au maximum.
     */
    zoomMax?: Duration,

    /** L'indicateur (une ligne verticale) d'heure courante doit-t'il être caché ? */
    hideCurrentTime?: boolean,

    /**
     * Les éléments doivent-ils être empilés ?
     *
     * @default false
     */
    stacked?: boolean,

    /**
     * Fonction appelée lorsque l'utilisateur a cliqué quelque part
     * sur la frise temporelle.
     *
     * @param event - L'événement lié.
     */
    onClick?(event: TimelineClickEvent): void,

    /**
     * Fonction appelée lorsque l'utilisateur a double-cliqué
     * quelque part sur la frise temporelle.
     *
     * @param event - L'événement lié.
     */
    onDoubleClick?(event: TimelineClickEvent): void,

    /**
     * Fonction appelée lorsque la période affichée dans la
     * frise temporelle a changé.
     *
     * @param newPeriod - La nouvelle période affichée.
     */
    onRangeChanged?(newPeriod: Raw<Period>): void,

    /**
     * Fonction appelée lorsque l'utilisateur survole un élément
     * de la frise temporelle.
     *
     * @param identifier - L'identifiant composé de l'élément survolé.
     */
    onItemOver?(identifier: TimelineItemIdentifier): void,

    /**
     * Fonction appelée lorsque l'utilisateur cesse de survoler un
     * élément de la frise temporelle.
     *
     * @param identifier - L'identifiant composé de l'élément qui n'est
     *                     plus survolé.
     */
    onItemOut?(identifier: TimelineItemIdentifier): void,

    /**
     * Fonction appelée lorsqu'un élément de la frise temporelle est déplacé.
     *
     * @param identifier - L'identifiant composé de l'élément déplacé.
     * @param newPeriod - La nouvelle période de l'élément.
     * @param newGroup - L'éventuel nouveau groupe dans lequel l'élément a été déplacé.
     * @param finish - Un callback à appeler pour confirmer, ou non, le déplacement.
     */
    onItemMove?(
        identifier: TimelineItemIdentifier,
        newPeriod: Raw<Period>,
        newGroup: TimelineGroup['id'] | null,
        finish: TimelineConfirmCallback,
    ): void,

    /**
     * Fonction appelée lorsqu'un élément de la frise temporelle est supprimé.
     *
     * @param identifier - L'identifiant composé de l'élément supprimé.
     * @param finish - Un callback à appeler pour confirmer, ou non, la suppression.
     */
    onItemRemove?(
        identifier: TimelineItemIdentifier,
        finish: TimelineConfirmCallback,
    ): void,

    /**
     * Fonction appelée lorsque les données de la frise temporelle changent.
     *
     * @param event - L'événement lié.
     */
    onDataChange?(event: TimelineDataChangeEvent): void,
};

type Data = {
    data: Raw<DataSet> | undefined,
    groupData: Raw<DataSet> | undefined,
    loading: boolean,
    now: Raw<DateTime>,
};

type InstanceProperties = {
    domObserver: MutationObserver | undefined,
    timeline: TimelineCore | undefined,
    nowTimer: ReturnType<typeof setInterval> | undefined,
    handleDoubleClickThrottled: (
        | DebouncedMethod<typeof Timeline, 'handleDoubleClick'>
        | undefined
    ),
};

/**
 * Frise temporelle qui affiche des éléments
 * à la manière d'un diagramme de Gantt.
 */
const Timeline = defineComponent({
    name: 'Timeline',
    props: {
        period: {
            type: Period as PropType<Props['period']>,
            default: undefined,
        },
        defaultPeriod: {
            type: Period as PropType<Props['defaultPeriod']>,
            default: undefined,
        },
        editable: {
            type: Boolean as PropType<Required<Props>['editable']>,
            default: false,
        },
        items: {
            type: Array as PropType<Props['items']>,
            required: true,
        },
        groups: {
            type: Array as PropType<Props['groups']>,
            default: undefined,
        },
        snapTime: {
            type: Object as PropType<Props['snapTime']>,
            default: undefined,
        },
        zoomMin: {
            type: Object as PropType<Required<Props>['zoomMin']>,
            default: DateTime.duration(1, 'hour'),
            validator: (value: unknown) => (
                DateTime.isDuration(value)
            ),
        },
        zoomMax: {
            type: Object as PropType<Props['zoomMax']>,
            default: undefined,
            validator: (value: unknown) => (
                value === undefined ||
                DateTime.isDuration(value)
            ),
        },
        hideCurrentTime: {
            type: Boolean as PropType<Required<Props>['hideCurrentTime']>,
            default: false,
        },
        stacked: {
            type: Boolean as PropType<Required<Props>['stacked']>,
            default: false,
        },
        onClick: {
            type: Function as PropType<Props['onClick']>,
            default: undefined,
        },
        onDoubleClick: {
            type: Function as PropType<Props['onDoubleClick']>,
            default: undefined,
        },
        onRangeChanged: {
            type: Function as PropType<Props['onRangeChanged']>,
            default: undefined,
        },
        onItemOver: {
            type: Function as PropType<Props['onItemOver']>,
            default: undefined,
        },
        onItemOut: {
            type: Function as PropType<Props['onItemOut']>,
            default: undefined,
        },
        onItemMove: {
            type: Function as PropType<Props['onItemMove']>,
            default: undefined,
        },
        onItemRemove: {
            type: Function as PropType<Props['onItemRemove']>,
            default: undefined,
        },
        onDataChange: {
            type: Function as PropType<Props['onDataChange']>,
            default: undefined,
        },
    },
    emits: [
        'click',
        'doubleClick',
        'rangeChanged',
        'itemOver',
        'itemOut',
        'itemMove',
        'itemRemove',
        'dataChange',
    ],
    setup: (): InstanceProperties => ({
        handleDoubleClickThrottled: undefined,
        domObserver: undefined,
        nowTimer: undefined,
        timeline: undefined,
    }),
    data: (): Data => ({
        data: undefined,
        groupData: undefined,
        now: markRaw(DateTime.now()),
        loading: true,
    }),
    computed: {
        fullOptions(): TimelineOptions {
            const { $t: __, editable, hideCurrentTime, zoomMin, zoomMax } = this;
            const period = this.period?.setFullDays(false);

            return {
                zoomMin: zoomMin.asMilliseconds(),
                ...(zoomMax !== undefined ? { zoomMax: zoomMax.asMilliseconds() } : {}),
                ...(period ? { min: period.start.toDate(), max: period.end.toDate() } : {}),
                orientation: 'top',
                xss: {
                    disabled: false,
                    filterOptions: {
                        whiteList: {
                            i: ['class'],
                            strong: ['class'],
                            em: ['class'],
                        },
                    },
                },
                locale: getLocale(),
                locales: {
                    [getLocale()]: {
                        current: __('current'),
                        time: __('time'),
                        deleteSelected: __('deleted-selected'),
                    },
                },
                minHeight: '100%',
                showCurrentTime: !hideCurrentTime,
                groupHeightMode: 'fixed',
                stack: this.stacked,
                stackSubgroups: false,
                tooltip: {
                    followMouse: true,
                    overflowMethod: 'flip',
                    delay: 300,
                },
                tooltipOnItemUpdateTime: {
                    template: (item: any) => {
                        if (item.start && item.end) {
                            try {
                                const start = new DateTime(item.start);
                                const end = new DateTime(item.end);

                                return [
                                    __('update-in-progress'),
                                    __('from-date-to-date', {
                                        from: start.toReadable(),
                                        to: end.toReadable(),
                                    }),
                                ].join('\n');
                            } catch {
                                // -
                            }
                        }
                        return __('update-in-progress');
                    },
                },
                selectable: editable,
                editable: (
                    editable
                        ? {
                            add: false,
                            updateTime: true,
                            updateGroup: false,
                            remove: true,
                            overrideItems: false,
                        }
                        : false
                ),
                margin: { axis: 0 },
                moment: (input: MomentInput) => moment(input),
                onMoving: (_item: TimelineItemCore, callback: (item: TimelineItemCore | null) => void) => {
                    const { snapTime } = this;
                    if (!snapTime) {
                        callback(_item);
                    }

                    try {
                        const start = new DateTime(_item.start)
                            .roundTimeUnit(snapTime!.unit, snapTime!.precision, DateTimeRoundingMethod.FLOOR)
                            .toDate();
                        const end = new DateTime(_item.end)
                            .roundTimeUnit(snapTime!.unit, snapTime!.precision, DateTimeRoundingMethod.CEIL)
                            .toDate();

                        callback({ ..._item, start, end });
                    } catch (error) {
                        // eslint-disable-next-line no-console
                        console.warn(`Exception occurred while moving event on timeline:`, _item, error);
                    }
                },
                onMove: (item: TimelineItemCore, callback: (finalItem: TimelineItemCore | null) => void) => {
                    this.handleItemMove(item, callback);
                },
                onRemove: (item: TimelineItemCore, callback: (finalItem: TimelineItemCore | null) => void) => {
                    this.handleItemRemove(item, callback);
                },
            };
        },

        formattedItems(): TimelineItemCore[] {
            return (this.items ?? []).flatMap((rawItem: TimelineItem) => {
                const {
                    summary,
                    tooltip,
                    period: suppliedPeriod,
                    style: rawStyle = {},
                    color: rawColor = null,
                    className: suppliedClassName = [],
                    ...item
                } = rawItem;

                const style = typeof rawStyle === 'object' ? { ...rawStyle } : {};
                const baseClassName: ClassValue[] = ['Timeline__item'];

                if (rawColor !== null && rawColor !== undefined) {
                    const color = new Color(rawColor);

                    if (!('--timeline-item-color' in style)) {
                        style['--timeline-item-color'] = color.toHexString();
                    }

                    const colorType = color.isDark() ? 'dark' : 'light';
                    baseClassName.push(
                        `Timeline__item--with-custom-color`,
                        `Timeline__item--with-${colorType}-color`,
                    );
                }

                if (suppliedPeriod instanceof Period) {
                    const period = suppliedPeriod.setFullDays(false);
                    return {
                        ...item,
                        id: JSON.stringify({ id: item.id, type: undefined }),
                        content: summary,
                        start: period.start.toDate(),
                        end: period.end.toDate(),
                        style: styleObjectToString(style),
                        className: clsx(baseClassName, suppliedClassName),
                        ...(tooltip ? { title: tooltip } : {}),
                    };
                }

                invariant(
                    (
                        TimelineItemPeriodType.ACTUAL in suppliedPeriod &&
                        TimelineItemPeriodType.EXPECTED in suppliedPeriod
                    ),
                    `Invalid item period, missing \`${TimelineItemPeriodType.ACTUAL}\` or ` +
                    `\`${TimelineItemPeriodType.EXPECTED}\` key.`,
                );

                const periods: Map<TimelineItemPeriodType, Period<false>> = new Map();

                // - Période effective
                const actualPeriod = suppliedPeriod[TimelineItemPeriodType.ACTUAL].setFullDays(false);
                periods.set(TimelineItemPeriodType.ACTUAL, actualPeriod);

                // - Période prevue.
                const rawExpectedPeriod = suppliedPeriod[TimelineItemPeriodType.EXPECTED].setFullDays(false);
                const expectedPeriod = rawExpectedPeriod.narrow(actualPeriod) as Period<false> | null;
                if (expectedPeriod === null) {
                    // eslint-disable-next-line no-console
                    console.warn(
                        `The supplied \`${TimelineItemPeriodType.EXPECTED}\` period ` +
                        `does not share any dates with the \`${TimelineItemPeriodType.ACTUAL}\` ` +
                        'period, so it has been ignored.',
                    );
                } else {
                    periods.set(TimelineItemPeriodType.EXPECTED, expectedPeriod);
                }

                // - Période de retard.
                if (suppliedPeriod[TimelineItemPeriodType.OVERDUE] !== undefined) {
                    const overduePeriod = (
                        suppliedPeriod[TimelineItemPeriodType.OVERDUE] instanceof Period
                            ? suppliedPeriod[TimelineItemPeriodType.OVERDUE]
                            // @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date#the_epoch_timestamps_and_invalid_date
                            : actualPeriod.tail(new DateTime(8.64e15))
                    ) as Period<false>;

                    if (!overduePeriod.start.isSame(actualPeriod.end)) {
                        // eslint-disable-next-line no-console
                        console.warn(
                            `The supplied \`${TimelineItemPeriodType.OVERDUE}\` period ` +
                            `doest not follow the \`${TimelineItemPeriodType.ACTUAL}\` ` +
                            'period, so it has been ignored.',
                        );
                    } else {
                        baseClassName.push('Timeline__item--with-overdue');
                        periods.set(TimelineItemPeriodType.OVERDUE, overduePeriod);
                    }
                }

                // - Période entière.
                const fullPeriod: Period<false> | null = Array.from(periods.values()).reduce(
                    (currentPeriod: Period<false> | null, period: Period<false>): Period<false> => (
                        currentPeriod?.merge(period) as Period<false> | null ?? period.clone()
                    ),
                    null,
                );

                // - Est-ce que les périodes sont unifiées ?
                const arePeriodsUnified = (
                    expectedPeriod === null ||
                    actualPeriod.setFullDays(false).isSame(expectedPeriod)
                );
                if (arePeriodsUnified) {
                    baseClassName.push('Timeline__item--unified');
                }

                return [
                    ...Array.from(periods.entries()).map(
                        ([type, period]: [TimelineItemPeriodType, Period<false>]) => ({
                            ...item,
                            id: JSON.stringify({ id: item.id, type }),
                            content: '',
                            start: period.start.toDate(),
                            end: period.end.toDate(),
                            subgroup: item.id,
                            style: styleObjectToString(style),
                            className: clsx(
                                baseClassName,
                                `Timeline__item--${type}`,
                                {
                                    'Timeline__item--ongoing': this.now.isBetween(period),
                                    'Timeline__item--past': period.isBefore(this.now),
                                },
                                suppliedClassName,
                            ),
                        }),
                    ),
                    fullPeriod === null ? null : {
                        ...item,
                        id: JSON.stringify({ id: item.id, type: null }),
                        content: summary,
                        start: fullPeriod.start.toDate(),
                        end: fullPeriod.end.toDate(),
                        subgroup: item.id,
                        style: styleObjectToString(style),
                        className: clsx(
                            baseClassName,
                            `Timeline__item--base`,
                            {
                                'Timeline__item--ongoing': this.now.isBetween(fullPeriod),
                                'Timeline__item--past': fullPeriod.isBefore(this.now),
                            },
                            suppliedClassName,
                        ),
                        ...(tooltip ? { title: tooltip } : {}),
                    },
                ].filter(isTruthy) as TimelineItemCore[];
            });
        },

        formattedGroups(): TimelineGroupCore[] | undefined {
            if (this.groups === undefined) {
                return undefined;
            }

            return this.groups.map((rawItem: TimelineGroup) => {
                const {
                    name,
                    style: rawStyle = {},
                    className: rawClassName = [],
                    actions,
                    ...item
                } = rawItem;

                const style = typeof rawStyle === 'object' ? { ...rawStyle } : {};

                const content = document.createElement('div');
                content.className = 'Timeline__group-content';

                const nameElement = document.createElement('span');
                nameElement.className = clsx('Timeline__group-content__name', rawClassName);
                nameElement.textContent = name;
                content.appendChild(nameElement);

                if (actions && actions.length > 0) {
                    const actionsElement = document.createElement('span');
                    actionsElement.className = 'Timeline__group-content__actions';

                    actions.forEach(({ icon, ariaLabel, onClick }: TimelineGroupAction) => {
                        const button = document.createElement('button');
                        button.className = 'Timeline__group-content__actions__item';
                        button.ariaLabel = ariaLabel ?? null;
                        button.onclick = onClick ?? null;

                        // - Icône de l'action.
                        const iconElement = document.createElement('i');
                        iconElement.className = ((): string => {
                            let normalizedIcon: { name: string, variant?: IconVariant };
                            if (!icon.includes(':')) {
                                normalizedIcon = { name: icon };
                            } else {
                                const [iconType, variant] = icon.split(':');
                                normalizedIcon = Object.values(IconVariant).includes(variant as any)
                                    ? { name: iconType, variant: variant as IconVariant }
                                    : { name: iconType };
                            }

                            return clsx([
                                ICON_VARIANT_MAP[normalizedIcon.variant ?? IconVariant.SOLID],
                                `fa-${normalizedIcon.name}`,
                            ]);
                        })();
                        button.appendChild(iconElement);

                        actionsElement.appendChild(button);
                    });

                    content.appendChild(actionsElement);
                }

                return {
                    ...item,
                    content,
                    style: styleObjectToString(style),
                };
            });
        },
    },
    watch: {
        fullOptions: {
            deep: true,
            handler() {
                this.timeline!.setOptions(this.fullOptions);
            },
        },
    },
    created() {
        // @see https://github.com/almende/vis/issues/2524
        this.timeline = undefined;
    },
    mounted() {
        // - Actualise le timestamp courant toutes les 10 secondes.
        this.nowTimer = setInterval(() => { this.now = markRaw(DateTime.now()); }, 10_000);

        // Note: Correction du double-call des events `doubletap` + `doubleClick`.
        // @see https://github.com/visjs/vis-timeline/issues/301
        this.handleDoubleClickThrottled = throttle(this.handleDoubleClick.bind(this), 100, { trailing: false });

        const data = mountVisData(this, 'formattedItems', 'data');
        this.data = data !== undefined ? markRaw(data) : undefined;

        const groupData = mountVisData(this, 'formattedGroups', 'groupData');
        this.groupData = groupData !== undefined ? markRaw(groupData) : undefined;

        const options: TimelineOptions = { ...this.fullOptions };

        // - La date de début et de fin par défaut ne sont ajoutés au tableau d'option qu'à
        //   l'initialisation pour éviter que le calendrier ne se replace toujours sur ces
        //   dates si elles changent après coup (= non contrôlé).
        if (this.defaultPeriod || this.period) {
            const defaultPeriod = (this.defaultPeriod ?? this.period)!.setFullDays(false);
            options.start = defaultPeriod.start.toDate();
            options.end = defaultPeriod.end.toDate();
        }

        this.timeline = this.groupData !== undefined
            ? new TimelineCore(
                this.$refs.visualization as HTMLElement,
                this.data!,
                this.groupData,
                options,
            )
            : new TimelineCore(
                this.$refs.visualization as HTMLElement,
                this.data!,
                options,
            );

        // - Vu qu'il n'y a pas de moyen correct d'observer quand la timeline a terminé de rendre,
        //   on ajoute un `MutationObserver` et on passe en `loading=false` lorsqu'il y a un
        //   changement dans les enfants du conteneur de la timeline.
        this.domObserver = new MutationObserver(() => {
            this.loading = false;
            this.domObserver?.disconnect();
        });
        this.domObserver.observe(this.$refs.visualization as HTMLElement, { childList: true });

        // - Binding des événements globaux.
        const globalsEvents: Partial<Record<TimelineEventName, keyof InstanceType<typeof Timeline>>> = {
            itemover: 'handleItemOver',
            itemout: 'handleItemOut',
            rangechanged: 'handleRangeChanged',
            doubleClick: 'handleDoubleClickThrottled',
            doubletap: 'handleDoubleClickThrottled',
            click: 'handleClick',
        };
        Object.entries(globalsEvents).forEach(([originalName, handlerName]: [string, keyof InstanceType<typeof Timeline>]) => {
            this.timeline!.on(originalName as TimelineEventName, (props: any): void => {
                if (originalName === 'doubletap') {
                    // - L'événement `doubleClick` n'est pas trigger correctement dans tous les
                    //   cas sur mobile, on observe donc l'événement `doubletap`, mais comme celui-ci
                    //   est bas niveau, on est obligé de récupérer les propriétés customs de
                    //   l'événement "à la main".
                    // @see https://github.com/visjs/vis-timeline/blob/v7.4.7/lib/timeline/Core.js#L160
                    // @see https://github.com/visjs/vis-timeline/blob/v7.4.7/lib/timeline/Timeline.js#L165
                    // @see https://github.com/visjs/vis-timeline/blob/v7.4.7/lib/timeline/component/item/Item.js#L203
                    props = this.timeline!.getEventProperties(props);
                }
                this[handlerName](props);
            });
        });

        // - Binding des événements liés aux données.
        (['add', 'update', 'remove'] as const).forEach(
            <T extends 'add' | 'update' | 'remove'>(name: T) => {
                this.data!.on(name as any, (event: any, changes: TimelineChangeEventCore[T]) => {
                    if (changes !== null) {
                        this.handleDataChange(name, changes);
                    }
                });
            },
        );
    },
    beforeDestroy() {
        if (this.nowTimer) {
            clearInterval(this.nowTimer);
        }

        this.handleDoubleClickThrottled?.cancel();

        this.domObserver?.disconnect();
        this.timeline!.destroy();
        this.timeline = undefined;
    },
    methods: {
        // ------------------------------------------------------
        // -
        // -    Handlers
        // -
        // ------------------------------------------------------

        handleDoubleClick(rawPayload: TimelineClickEventCore) {
            this.$emit('doubleClick', this.formatTimelineClickEvent(rawPayload));
        },

        handleClick(rawPayload: TimelineClickEventCore) {
            this.$emit('click', this.formatTimelineClickEvent(rawPayload));
        },

        handleRangeChanged(payload: RangeChangedEvent) {
            if (!payload.start || !payload.end) {
                return;
            }
            this.$emit('rangeChanged', markRaw(new Period(payload.start, payload.end)));
        },

        handleItemOver(rawPayload: ItemOverEvent) {
            if (!rawPayload.item) {
                return;
            }

            const item = safeJsonParse<TimelineItemIdentifier>(rawPayload.item as string);
            if (item === undefined) {
                return;
            }

            this.$emit('itemOver', item);
        },

        handleItemOut(rawPayload: ItemOverEvent) {
            if (!rawPayload.item) {
                return;
            }

            const item = safeJsonParse<TimelineItemIdentifier>(rawPayload.item as string);
            if (item === undefined) {
                return;
            }

            this.$emit('itemOut', item);
        },

        handleItemMove(rawItem: TimelineItemCore, callback: (finalItem: TimelineItemCore | null) => void) {
            if (!rawItem.start || !rawItem.end) {
                callback(null);
                return;
            }

            const item = safeJsonParse<TimelineItemIdentifier>(rawItem.id as string);
            if (item === undefined) {
                callback(null);
                return;
            }

            let newPeriod: Raw<Period>;
            try {
                newPeriod = markRaw(new Period(new Date(rawItem.start), new Date(rawItem.end)));
            } catch (error) {
                // eslint-disable-next-line no-console
                console.warn(`Exception occurred while moving event on timeline:`, item, error);

                callback(null);
                return;
            }

            const confirmCallback: TimelineConfirmCallback = (confirm: boolean): void => {
                callback(confirm ? rawItem : null);
            };
            this.$emit('itemMove', item, newPeriod, rawItem.group ?? null, confirmCallback);
        },

        handleItemRemove(rawItem: TimelineItemCore, callback: (finalItem: TimelineItemCore | null) => void) {
            const item = safeJsonParse<TimelineItemIdentifier>(rawItem.id as string);
            if (item === undefined) {
                callback(null);
                return;
            }

            const confirmCallback: TimelineConfirmCallback = (confirm: boolean): void => {
                callback(confirm ? rawItem : null);
            };
            this.$emit('itemRemove', item, confirmCallback);
        },

        handleDataChange<T extends 'add' | 'update' | 'remove'>(type: T, rawPayload: NonNullable<TimelineChangeEventCore[T]>) {
            const payload: TimelineDataChangeEvent = { type, items: rawPayload.items };
            this.$emit('dataChange', payload);
        },

        // ------------------------------------------------------
        // -
        // -    Méthodes internes
        // -
        // ------------------------------------------------------

        formatTimelineClickEvent(rawPayload: TimelineClickEventCore): TimelineClickEvent {
            const time = markRaw(new DateTime(rawPayload.time));
            const snappedTime = markRaw(
                this.snapTime
                    ? time.roundTimeUnit(
                        this.snapTime.unit,
                        this.snapTime.precision,
                        DateTimeRoundingMethod.FLOOR,
                    )
                    : time,
            );

            const item: TimelineItemIdentifier | null = rawPayload.item
                ? (safeJsonParse<TimelineItemIdentifier>(rawPayload.item as string) ?? null)
                : null;

            const payload: TimelineClickEvent = {
                ...pick(rawPayload, ['x', 'y', 'pageX', 'pageY']),
                group: rawPayload.group ?? null,
                snappedTime,
                item,
                time,
            };

            return payload;
        },

        // ------------------------------------------------------
        // -
        // -    API Publique
        // -
        // ------------------------------------------------------

        /**
         * Déplace la timeline jusqu'à la date spécifiée.
         *
         * @param date - La date ou le jour vers lequel on veut déplacer la timeline.
         *
         * @returns Une promesse, résolue lorsque le déplacement sera terminé.
         */
        moveTo(date: Day | DateTime): Promise<void> {
            const _date: Date = date instanceof Day
                ? date.toDateTime().toDate()
                : date.toDate();

            return new Promise((resolve) => {
                this.timeline!.moveTo(_date, {}, () => {
                    resolve();
                });
            });
        },

        /**
         * Zoom dans la partie de la timeline actuellement visible.
         *
         * @param percentage - Un nombre compris entre 0 et 1.
         * @param animate - Le zoom doit-t'il être animé ?
         *
         * @returns Une promesse, résolue lorsque le zoom sera terminé.
         *          (utile uniquement si `animate` n'est pas à `false`)
         */
        zoomIn(percentage: number, animate: boolean = true): Promise<void> {
            return new Promise((resolve) => {
                this.timeline!.zoomIn(percentage, { animation: animate }, () => {
                    resolve();
                });
            });
        },
    },
    render() {
        const { loading, formattedGroups: groups } = this;

        const _className = ['Timeline', {
            'Timeline--grouped': !!(groups && groups.length > 0),
        }];

        return (
            <div class={_className}>
                {loading && <Loading class="Timeline__loading" />}
                <div class="Timeline__content" ref="visualization" />
            </div>
        );
    },
});

export type {
    SnapTime,
    TimelineItem,
    TimelineGroup,
    TimelineItemIdentifier,
    TimelineConfirmCallback,
};
export type {
    TimelineClickEvent,
    TimelineDataChangeEvent,
} from './_types';

export default Timeline;
