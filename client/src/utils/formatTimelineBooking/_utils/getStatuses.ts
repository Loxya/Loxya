import { BookingEntity } from '@/stores/api/bookings';
import config, { ReturnPolicy } from '@/globals/config';

import type DateTime from '@/utils/datetime';
import type { BookingContext } from '../_types';
import type { I18nTranslate } from 'vuex-i18n';

export type BookingTimelineStatus = { icon: string, label: string };

const getTimelineBookingStatuses = (
    context: BookingContext,
    __: I18nTranslate,
    now: DateTime,
): BookingTimelineStatus[] => {
    const { isExcerpt, booking } = context;
    const isOngoing = now.isBetween(booking.mobilization_period);
    const isPast = booking.mobilization_period.isBefore(now);
    const {
        is_archived: isArchived,
        has_materials: hasMaterials,
        is_return_inventory_done: isReturnInventoryDone,
        has_not_returned_materials: hasNotReturnedMaterials,
    } = booking;

    // - Si c'est une réservation, elle est automatiquement confirmée.
    const isConfirmed = booking.entity === BookingEntity.EVENT
        ? booking.is_confirmed
        : true;

    const getStatusText = (status: string): string => {
        switch (booking.entity) {
            case BookingEntity.EVENT: {
                return __(`@event.statuses.${status}`);
            }
            default: {
                throw new Error(`Unsupported entity ${(booking as any).entity}`);
            }
        }
    };

    const statuses = [];

    if (isPast && hasNotReturnedMaterials) {
        statuses.push({
            icon: 'exclamation-triangle',
            label: getStatusText('has-not-returned-materials'),
        });
    }

    if (isArchived) {
        statuses.push({
            icon: 'archive',
            label: getStatusText('is-archived'),
        });
        return statuses;
    }

    if (booking.entity === BookingEntity.EVENT && isPast && !isConfirmed) {
        statuses.push({
            icon: 'history',
            label: getStatusText('is-past'),
        });
    }

    if (booking.entity === BookingEntity.EVENT && !isPast && !isConfirmed) {
        statuses.push({
            icon: 'question',
            label: getStatusText('is-not-confirmed'),
        });
    }

    if (isOngoing) {
        statuses.push({
            icon: 'running',
            label: getStatusText('is-currently-running'),
        });
    }

    if (booking.entity === BookingEntity.EVENT && isConfirmed) {
        statuses.push({
            icon: isPast ? 'lock' : 'check',
            label: isPast
                ? getStatusText('is-locked')
                : getStatusText('is-confirmed'),
        });
    }

    if (!isPast && !isExcerpt && booking.has_missing_materials) {
        statuses.push({
            icon: 'exclamation-triangle',
            label: getStatusText('has-missing-materials'),
        });
    }

    if (isPast && !isReturnInventoryDone && hasMaterials) {
        const useManualReturn = config.returnPolicy === ReturnPolicy.MANUAL;
        statuses.push({
            icon: 'exclamation-triangle',
            label: getStatusText(
                !useManualReturn
                    ? 'needs-its-return-inventory'
                    : 'overdue',
            ),
        });
    }

    return statuses;
};

export default getTimelineBookingStatuses;
