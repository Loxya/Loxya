import { BookingEntity } from '@/stores/api/bookings';
import config, { ReturnPolicy } from '@/globals/config';

import type DateTime from '@/utils/datetime';
import type { BookingContext } from '../_types';

const getTimelineBookingClassNames = (context: BookingContext, now: DateTime): string[] => {
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

    // - Le retour de l'événement est-il actuellement en retard ?
    const isOverdue = (() => {
        const useManualReturn = config.returnPolicy === ReturnPolicy.MANUAL;
        if (!isPast || !useManualReturn) {
            return false;
        }

        return (
            !isArchived &&
            !booking.is_return_inventory_done &&
            booking.has_materials
        );
    })();

    const classNames = ['timeline-event'];

    if (isPast) {
        classNames.push('timeline-event--past');

        if (!isOverdue && isConfirmed && !isReturnInventoryDone && hasMaterials) {
            classNames.push('timeline-event--no-return-inventory');
        }
    }

    if (isArchived) {
        classNames.push('timeline-event--archived');
    }

    if (isOverdue) {
        classNames.push('timeline-event--ongoing-overdue');
    }

    if (isOngoing) {
        classNames.push('timeline-event--in-progress');
    }

    if (!isConfirmed) {
        classNames.push('timeline-event--not-confirmed');
    }

    const hasWarnings = (
        // - Si le booking est en cours ou à venir et qu'il manque du matériel.
        (!isPast && !isExcerpt && booking.has_missing_materials === true) ||

        // - Si le booking est passé et qu'il a du matériel non retourné.
        (isPast && !isArchived && hasNotReturnedMaterials === true) ||

        // - S'il y a un retard.
        isOverdue
    );
    if (hasWarnings) {
        classNames.push('timeline-event--with-warning');
    }

    return classNames;
};

export default getTimelineBookingClassNames;
