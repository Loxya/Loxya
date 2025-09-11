import type { Raw } from 'vue';
import type DateTime from '@/utils/datetime';
import type Period from '@/utils/period';
import type Color from '@/utils/color';
import type { Merge } from 'type-fest';
import type { ClassValue } from 'clsx';
import type { RawColor } from '@/utils/color';
import type { TimeUnit } from '@/utils/datetime';
import type { Props as IconProps } from '@/themes/default/components/Icon';
import type {
    TimelineGroup as TimelineGroupCore,
    TimelineItem as TimelineItemCore,
    TimelineClickEvent as TimelineClickEventCore,
} from '@loxya/vis-timeline';

export enum TimelineItemPeriodType {
    /**
     * Correspond à la période attendue pour un élément de la timeline.
     *
     * - Cette période commence forcément après ou au moment de la période effective.
     * - Cette période est toujours considérée comme "secondaire" par rapport à la période effective:
     *   Si la période effective se termine avant, cette période sera tronquée sur la timeline.
     */
    EXPECTED = 'expected',

    /**
     * Correspond à la période effective pour un élément de la timeline.
     *
     * - Cette période commence forcément avant ou au moment de la période attendue.
     * - Cette période se termine forcément après le début de la période attendue.
     * - Cette période peut se terminer avant ou après la date de fin de période attendue.
     */
    ACTUAL = 'actual',

    /**
     * Correspond à une période de retard pour un élément de la timeline.
     *
     * - Cette période commence à la fin de la période effective.
     * - Elle représente le temps écoulé après la fin effective si l'élément n'a pas été rendu ou clôturé.
     * - Elle n'est visible que si l'élément est encore actif après sa période effective.
     */
    OVERDUE = 'overdue',
}

export type TimelineItemPeriods = {
    [TimelineItemPeriodType.EXPECTED]: Period,
    [TimelineItemPeriodType.ACTUAL]: Period,
    [TimelineItemPeriodType.OVERDUE]?: Period | boolean | undefined,
};

export type TimelineItem = (
    & Omit<TimelineItemCore, 'content' | 'title' | 'className' | 'style' | 'start' | 'end'>
    & {
        summary: string,
        tooltip?: string,
        period: Period | TimelineItemPeriods,
        color?: Color | RawColor | null,
        className?: ClassValue,
        style?: AnyLiteralObject,
    }
);

export type TimelineGroupAction = {
    /**
     * L'icône à utiliser pour le bouton d'action.
     *
     * Doit contenir une chaîne de caractère avec les composantes suivantes séparées par `:` :
     * - Le nom de l'icône sous forme de chaîne (e.g. `plus`, `wrench`)
     *   Pour une liste exhaustive des codes, voir: https://fontawesome.com/v5.15/icons?m=free
     * - La variante à utiliser de l'icône à utiliser (`solid`, `regular`, ...).
     *
     * @example
     * - `wrench`
     * - `wrench:solid`
     */
    icon: string | `${string}:${Required<IconProps>['variant']}`,

    /** Libellé accessible pour le bouton d'action. */
    ariaLabel?: string,

    /**
     * Fonction appelée lorsque le bouton d'action est cliqué.
     *
     * @param event - L'événement d'origine.
     */
    onClick?(event: PointerEvent): void,
};

export type TimelineGroup = (
    & Omit<TimelineGroupCore, 'content' | 'title' | 'className' | 'style'>
    & {
        name: string,
        className?: ClassValue,
        style?: AnyLiteralObject,
        actions?: TimelineGroupAction[],
    }
);

export type SnapTime = {
    precision: number,
    unit: TimeUnit,
};

export type TimelineItemIdentifier<T extends TimelineItem['id'] = TimelineItem['id']> = {
    id: T,
    type: TimelineItemPeriodType | undefined,
};

export type TimelineClickEvent = Merge<
    Pick<TimelineClickEventCore, 'x' | 'y' | 'pageX' | 'pageY'>,
    {
        item: TimelineItemIdentifier | null,
        group: TimelineGroup['id'] | null,
        snappedTime: Raw<DateTime>,
        time: Raw<DateTime>,
    }
>;

export type TimelineDataChangeEvent = {
    type: 'add' | 'update' | 'remove',
    items: Array<TimelineItem['id']>,
};

export type TimelineConfirmCallback = (confirm: boolean) => void;
