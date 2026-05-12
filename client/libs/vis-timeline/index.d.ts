import { Timeline as TimelineCore } from 'vis-timeline';
import {
    DataSet as DateSetCore,
    DataView as DataViewCore,
} from 'vis-data';

import type { Moment } from 'moment';
import type { EventPayloads as DataChangeEvent } from 'vis-data';
import type {
    TimelineEvents,
    TimelineEventPropertiesResult,
} from 'vis-timeline';

export type ItemShape = { id?: undefined | null | number | string };

declare class DataView<T extends ItemShape = any> extends DataViewCore<T> {}
declare class DataSet<T extends ItemShape = any> extends DateSetCore<T> {}

export type TimelineChangeEvent = DataChangeEvent<ItemShape, 'id'>;

//
// - Timeline
//

export type TimelineEventName = TimelineEvents | 'doubletap';

type TimelineClickEventName = (
    | 'doubleClick'
    | 'doubletap'
    | 'click'
);

export type RangeChangedEvent = {
    start: Date,
    end: Date,
    byUser: boolean,
};

export type ItemOverEvent = Pick<TimelineEventPropertiesResult, 'item' | 'event'>;

export type TimelineClickEvent = (
    & Omit<TimelineEventPropertiesResult, 'snappedTime'>
    & { snappedTime: Moment }
);

declare class Timeline extends TimelineCore {
    public on(event: 'rangechanged', callback: (payload: RangeChangedEvent) => void): void;
    public on(event: 'itemover' | 'itemout', callback: (payload: ItemOverEvent) => void): void;
    public on(event: TimelineClickEventName, callback: (payload: TimelineClickEvent) => void): void;
    public on(event: TimelineEventName, callback: (payload: any) => void): void;
}

//
// - Exports.
//

export type {
    TimelineOptions,
    TimelineGroup,
    TimelineItem,
} from 'vis-timeline';

export { Timeline, DataView, DataSet };
