import Period from '@/utils/period';
import DateTime, { DateTimeRoundingMethod } from '@/utils/datetime';
import config, { ReturnPolicy } from '@/globals/config';
import { BookingEntity } from '@/stores/api/bookings';
import getBookingIcon from '@/utils/getBookingIcon';
import getBookingColor from '@/utils/getBookingColor';
import getTimelineBookingClassNames from './_utils/getClassNames';
import getTimelineBookingStatuses from './_utils/getStatuses';

import type Color from '@/utils/color';
import type { BookingExcerpt, BookingSummary } from '@/stores/api/bookings';
import type { TimelineItem } from '@/themes/default/components/Timeline';
import type { BookingTimelineStatus } from './_utils/getStatuses';
import type { BookingContext } from './_types';
import type { I18nTranslate } from 'vuex-i18n';
import type { Beneficiary } from '@/stores/api/beneficiaries';
import type { EventTechnician } from '@/stores/api/events';

//
// - Types
//

type FormatOptions = {
    /**
     * Si le booking est un événement, faut-il afficher le lieu ou il se déroule
     * dans l'élément de la timeline ?
     *
     * @default true
     */
    showEventLocation?: boolean,

    /**
     * Si le booking est un événement, faut-il afficher le premier bénéficiaire
     * dans l'élément de la timeline ?
     *
     * @default false
     */
    showEventBorrower?: boolean,
};

type TimelineBookingFormatter = (
    & ((booking: BookingSummary) => TimelineItem)
    & ((booking: BookingExcerpt, excerpt: true, quantity?: number) => TimelineItem)
    & ((booking: BookingSummary, excerpt: false, quantity?: number) => TimelineItem)
);

//
// - Formatters
//

const withIcon = (iconName: string | null, text: string): string => (
    iconName ? `<i class="fas fa-${iconName}"></i> ${text}` : text
);

const formatTimelineBookingEvent = (
    context: BookingContext,
    __: I18nTranslate,
    now: DateTime,
    options: FormatOptions = {},
): TimelineItem => {
    const { isExcerpt, booking, quantity } = context;
    const { title, location, beneficiaries, technicians, manager } = booking;
    const { showEventLocation = true, showEventBorrower = false } = options;
    const isPast = booking.mobilization_period.isBefore(now);
    const isArchived = booking.is_archived;
    const hasBorrower = beneficiaries.length > 0;
    const mainBeneficiary = hasBorrower
        ? ([...beneficiaries].shift() ?? null)
        : null;

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

    // - L'événement a t'il été retourné en retard ?
    const wasOverdue = (() => {
        const useManualReturn = config.returnPolicy === ReturnPolicy.MANUAL;
        if (!isPast || !useManualReturn) {
            return false;
        }

        return (
            booking.is_return_inventory_done &&
            booking.return_inventory_datetime !== null &&
            booking.mobilization_period.end.isBefore(
                booking.return_inventory_datetime,
            )
        );
    })();

    // - Y'a t'il un retard (passé ou présent) ?
    const hasOverdue = isOverdue || wasOverdue;

    // - Période de retard éventuelle.
    const overduePeriod: Period<false> | undefined = (() => {
        if (!hasOverdue) {
            return undefined;
        }

        return (
            isOverdue
                ? booking.mobilization_period.tail(now)
                : booking.mobilization_period.tail(
                    booking.return_inventory_datetime!,
                )
        ) as Period<false>;
    })();

    // - Période de retard éventuelle, arrondie aux 15 minutes suivantes.
    const strictOverduePeriod = overduePeriod === undefined ? undefined : (
        new Period(
            overduePeriod.start,
            overduePeriod.end.roundMinutes(15, DateTimeRoundingMethod.CEIL),
        )
    );

    // - Couleur.
    const color: Color | null = getBookingColor(booking)?.value ?? null;

    // - Lieu
    const hasLocation = (location ?? '').length > 0;
    const locationText = withIcon('map-marker-alt', hasLocation ? location! : '?');

    // - Quantité utilisée
    const quantityText = quantity !== undefined
        ? __('used-count', { count: quantity }, quantity)
        : null;

    // - Summary
    const summaryParts = [title + (quantityText ? ` (${quantityText})` : '')];
    if (showEventLocation && hasLocation) {
        summaryParts.push(locationText);
    }
    if (showEventBorrower && hasBorrower) {
        const mainBeneficiaryIsCompany = !!mainBeneficiary!.company;
        let beneficiaryExcerpt = mainBeneficiaryIsCompany
            ? mainBeneficiary!.company!.legal_name
            : mainBeneficiary!.full_name;

        if (beneficiaries.length > 1) {
            const countSecondaryBeneficiaries = beneficiaries.length - 1;
            beneficiaryExcerpt = withIcon('users', __(
                'name-and-n-others',
                {
                    name: beneficiaryExcerpt,
                    count: countSecondaryBeneficiaries,
                },
                countSecondaryBeneficiaries,
            ));
        } else {
            beneficiaryExcerpt = withIcon(
                mainBeneficiaryIsCompany ? 'industry' : 'user',
                beneficiaryExcerpt,
            );
        }
        summaryParts.push(beneficiaryExcerpt);
    }
    const mainIcon = getBookingIcon(booking, isExcerpt, now) ?? 'spinner';
    const summary = withIcon(mainIcon, summaryParts.join(' - '));

    const tooltip: string = (() => {
        // - Période d'opération de l'événement
        const operationPeriodText = withIcon('calendar-alt', booking.operation_period.toReadable(__));

        const arePeriodsUnified = booking.operation_period
            .setFullDays(false)
            .isSame(booking.mobilization_period);

        // - Période de mobilisation de l'événement
        let mobilizationPeriodText = null;
        if (!arePeriodsUnified || hasOverdue) {
            /* eslint-disable @stylistic/function-paren-newline */
            mobilizationPeriodText = withIcon('clock', (
                !hasOverdue
                    ? booking.mobilization_period.toReadable(__)
                    : __('initially-planned-period', {
                        period: booking.mobilization_period.toReadable(__),
                    })
            ));
            /* eslint-enable @stylistic/function-paren-newline */
        }

        // - Retard
        let overdueText = null;
        if (hasOverdue) {
            /* eslint-disable @stylistic/function-paren-newline */
            overdueText = withIcon('hourglass', (
                isOverdue
                    ? __('overdue-since', {
                        duration: overduePeriod!.toReadableDuration(__),
                    })
                    : __('late-return-on', {
                        date: booking.return_inventory_datetime!.toReadable(),
                        duration: overduePeriod!.toReadableDuration(__),
                    })
            ));
            /* eslint-enable @stylistic/function-paren-newline */
        }

        // - Statut
        const statusesText = getTimelineBookingStatuses(context, __, now)
            .map(({ icon, label }: BookingTimelineStatus) => withIcon(icon, label))
            .join('\n');

        // - Bénéficiaire
        let borrowerText = withIcon('exclamation-triangle', `<em>(${__('missing-beneficiary')})</em>`);
        if (hasBorrower) {
            const beneficiariesNames = beneficiaries.map((beneficiary: Beneficiary) => {
                if (!beneficiary.company) {
                    return beneficiary.full_name;
                }
                return `${beneficiary.full_name} (${beneficiary.company.legal_name})`;
            });
            borrowerText = withIcon('address-book', __('for', { beneficiary: beneficiariesNames.join(', ') }));
        }

        // - Chef de projet.
        const managerText = manager !== null
            ? withIcon('user-tie', __('event-managed-by', { name: manager.full_name }))
            : null;

        // - Techniciens
        let techniciansText = null;
        if (config.features.technicians && technicians.length > 0) {
            const techniciansNames = technicians
                .filter((eventTechnician: EventTechnician, index: number, self: EventTechnician[]) => (
                    eventTechnician.technician && index === self.findIndex(
                        ({ technician }: EventTechnician) => (
                            technician && technician.id === eventTechnician.technician.id
                        ),
                    )
                ))
                .map(({ technician }: EventTechnician) => technician.full_name);

            techniciansText = withIcon('people-carry', `${__('with')} ${techniciansNames.join(', ')}`);
        }

        let positionsText = null;
        if (config.features.technicians && booking.has_unassigned_mandatory_positions) {
            positionsText = withIcon('exclamation-triangle', `<em>(${__('@event.has-unassigned-position')})</em>`);
        }

        return [
            // eslint-disable-next-line prefer-template
            `<strong>${title}</strong>` + (quantityText ? `, ${quantityText}` : ''),
            [
                locationText,
                operationPeriodText,
                mobilizationPeriodText,
                overdueText,
                borrowerText,
                managerText,
                techniciansText,
                positionsText,
            ]
                .filter(Boolean)
                .join('\n'),
            statusesText,
        ].filter(Boolean).join('\n\n');
    })();

    return {
        id: `${BookingEntity.EVENT}-${booking.id}`,
        period: {
            expected: booking.operation_period,
            actual: booking.mobilization_period,
            overdue: isOverdue ? true : strictOverduePeriod,
        },
        summary,
        tooltip,
        color: color?.toHexString() ?? null,
        className: getTimelineBookingClassNames(context, now),
    };
};

//
// - Factory
//

const factory = (__: I18nTranslate, now: DateTime = DateTime.now(), options: FormatOptions = {}): TimelineBookingFormatter => (
    /**
     * Permet de formater un booking pour une timeline.
     *
     * Si le paramètre `excerpt` est passé à `true`, cette fonction attendra un booking au
     * format {@link BookingExcerpt} et ne produira qu'un événement de timeline succinct
     * qui a vocation a être complété en différé lorsque le reste des données aura été chargé.
     *
     * @param booking - Le booking (événement, réservation) que l'on veut formater.
     * @param excerpt - Active le mode "extrait" uniquement qui ne requiert et n'affiche
     *                  qu'un extrait du booking (`false` si non spécifié).
     *                  Seul ce mode accepte un `BookingExcerpt` en entrée.
     * @param quantity - Si défini; affichera un compteur dans le titre de l'événement.
     *
     * @returns Le booking dans un format accepté par une timeline.
     *          (= `<Timeline items={[>> ICI <<]} />`)
     */
    (booking: BookingSummary | BookingExcerpt, excerpt: boolean = false, quantity?: number): TimelineItem => {
        const context = { isExcerpt: excerpt, booking, quantity } as BookingContext;

        switch (booking.entity) {
            case BookingEntity.EVENT: {
                return formatTimelineBookingEvent(context, __, now, options);
            }
            default: {
                throw new Error(`Unsupported entity ${(booking as any).entity}`);
            }
        }
    }
);

export default factory;
