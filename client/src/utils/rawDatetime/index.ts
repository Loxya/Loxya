import dayjs from 'dayjs';
import durationPlugin from 'dayjs/plugin/duration';
import isSameOrAfterPlugin from 'dayjs/plugin/isSameOrAfter';
import customParseFormatPlugin from 'dayjs/plugin/customParseFormat';
import localizedFormatPlugin from 'dayjs/plugin/localizedFormat';
import relativeTimePlugin from 'dayjs/plugin/relativeTime';
import localeDataPlugin from 'dayjs/plugin/localeData';
import timezonePlugin from 'dayjs/plugin/timezone';
import explicitPlugin from './plugins/explicit';
import utcPlugin from 'dayjs/plugin/utc';

dayjs.extend(explicitPlugin);
dayjs.extend(durationPlugin);
dayjs.extend(localeDataPlugin);
dayjs.extend(localizedFormatPlugin);
dayjs.extend(isSameOrAfterPlugin);
dayjs.extend(relativeTimePlugin);
dayjs.extend(customParseFormatPlugin);
dayjs.extend(timezonePlugin);
dayjs.extend(utcPlugin);

export type {
    Duration,
    DurationUnitType as DurationUnit,
    DurationUnitsObjectType,
} from 'dayjs/plugin/duration';

export type {
    UnitType as Unit,
    TimeUnitType as TimeUnit,
    TimeUnitTypeLong as TimeUnitLong,
    OpUnitType as UnitWithWeek,
    QUnitType as UnitWithQuarter,
    ManipulateType as ManipulateUnit,
    Dayjs as RawDateTimeInstance,
    DayjsInput as RawDateTimeInput,
    GlobalLocaleDataReturn as LocaleData,
} from 'dayjs';

export { isDayjs as isRawDateTime } from 'dayjs';
export default dayjs;
