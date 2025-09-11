import Color from '@/utils/color';
import getCSSProperty from '@/utils/getCSSProperty';

import type { BookingEntity, BookingExcerpt, BookingSummary } from '@/stores/api/bookings';
import type { EventDetails } from '@/stores/api/events';

type Booking = (
    | BookingSummary
    | BookingExcerpt
    | { entity: BookingEntity.EVENT } & EventDetails
);

export enum BookingColorReason {
    /** Définie spécifiquement sur le booking. */
    BOOKING_DEFINED = 'BOOKING_DEFINED',

    /** Couleur par défaut car pas d'overwrite. */
    DEFAULT = 'default',
}

export type BookingColor = (
    | { reason: BookingColorReason.BOOKING_DEFINED, value: Color }
);

export type BookingColorWithDefault = (
    | BookingColor
    | { reason: BookingColorReason.DEFAULT, value: Color | null }
);

export const getDefaultBookingColor = (): Color | null => {
    const defaultRawColor = getCSSProperty('calendar-event-default-color');
    return defaultRawColor && Color.isValid(defaultRawColor)
        ? new Color(defaultRawColor)
        : null;
};

function getBookingColor(booking: Booking, withDefault: true): BookingColorWithDefault;
function getBookingColor(booking: Booking, withDefault?: false): BookingColor | null;
function getBookingColor(booking: Booking, withDefault: boolean = false): BookingColor | BookingColorWithDefault | null {
    if (booking.color !== null) {
        return {
            reason: BookingColorReason.BOOKING_DEFINED,
            value: booking.color,
        };
    }

    return !withDefault ? null : {
        reason: BookingColorReason.DEFAULT,
        value: getDefaultBookingColor(),
    };
}

export default getBookingColor;
