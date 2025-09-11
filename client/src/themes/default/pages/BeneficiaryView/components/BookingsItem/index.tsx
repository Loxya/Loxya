import './index.scss';
import DateTime from '@/utils/datetime';
import upperFirst from 'lodash/upperFirst';
import config, { ReturnPolicy } from '@/globals/config';
import { defineComponent, markRaw } from 'vue';
import { BookingEntity } from '@/stores/api/bookings';
import getBookingIcon from '@/utils/getBookingIcon';
import Button from '@/themes/default/components/Button';
import Icon from '@/themes/default/components/Icon';

import type Period from '@/utils/period';
import type { PropType, Raw } from 'vue';
import type { LazyBooking } from '../../_types';

type Props = {
    /**
     * L'emprunt (booking) à afficher dans un format hybride permettant
     * de savoir si on a affaire à un extrait ou à un résumé de l'emprunt.
     */
    lazyBooking: LazyBooking,

    /**
     * Fonction appelée lorsque l'élément a été cliqué.
     *
     * @param entity - Type d'entité du booking.
     * @param id - Identifiant du booking cliqué.
     */
    onClick?(entity: BookingEntity, id: LazyBooking['booking']['id']): void,

    /**
     * Fonction appelée lorsque l'utilisateur clique sur le
     * bouton d'ouverture du booking.
     *
     * @param entity - Type d'entité du booking.
     * @param id - Identifiant du booking à ouvrir.
     */
    onOpenClick?(entity: BookingEntity, id: LazyBooking['booking']['id']): void,
};

type InstanceProperties = {
    nowTimer: ReturnType<typeof setInterval> | undefined,
};

type Data = {
    now: Raw<DateTime>,
};

/** Un emprunt (booking) sous forme d'une cellule "inline". */
const BeneficiaryViewBookingsItem = defineComponent({
    name: 'BeneficiaryViewBookingsItem',
    props: {
        lazyBooking: {
            type: Object as PropType<Props['lazyBooking']>,
            required: true,
        },
        // eslint-disable-next-line vue/no-unused-properties
        onClick: {
            type: Function as PropType<Props['onClick']>,
            default: undefined,
        },
        // eslint-disable-next-line vue/no-unused-properties
        onOpenClick: {
            type: Function as PropType<Props['onOpenClick']>,
            default: undefined,
        },
    },
    emits: ['click', 'openClick'],
    setup: (): InstanceProperties => ({
        nowTimer: undefined,
    }),
    data: (): Data => ({
        now: markRaw(DateTime.now()),
    }),
    computed: {
        icon(): string | null {
            const { isComplete, booking } = this.lazyBooking;
            return getBookingIcon(booking, !isComplete, this.now);
        },

        title(): string {
            const { lazyBooking: { booking } } = this;

            switch (booking.entity) {
                case BookingEntity.EVENT: {
                    const { title, location } = booking;
                    return !location ? title : `${title} (${location})`;
                }
                default: {
                    throw new Error(`Unsupported entity ${(booking as any).entity}`);
                }
            }
        },

        arePeriodsUnified(): boolean {
            const { booking } = this.lazyBooking;
            const {
                operation_period: operationPeriod,
                mobilization_period: mobilizationPeriod,
            } = booking;

            return operationPeriod
                .setFullDays(false)
                .isSame(mobilizationPeriod);
        },

        duration(): number {
            const { booking } = this.lazyBooking;
            return booking.operation_period.asDays();
        },

        isOneDay(): boolean {
            return this.duration === 1;
        },

        isPast(): boolean {
            const { booking } = this.lazyBooking;
            return booking.mobilization_period.isBefore(this.now);
        },

        isFuture(): boolean {
            const { booking } = this.lazyBooking;
            return !booking.mobilization_period.isBeforeOrDuring(this.now);
        },

        isOngoing(): boolean {
            const { booking } = this.lazyBooking;
            return this.now.isBetween(booking.mobilization_period);
        },

        isConfirmed(): boolean {
            const { booking } = this.lazyBooking;

            switch (booking.entity) {
                case BookingEntity.EVENT: {
                    return booking.is_confirmed;
                }
                default: {
                    throw new Error(`Unsupported entity ${(booking as any).entity}`);
                }
            }
        },

        isOverdue(): boolean {
            const { booking } = this.lazyBooking;
            const useManualReturn = config.returnPolicy === ReturnPolicy.MANUAL;
            if (!this.isPast || !useManualReturn) {
                return false;
            }

            return (
                !booking.is_archived &&
                !booking.is_return_inventory_done &&
                booking.has_materials
            );
        },

        wasOverdue(): boolean {
            const { booking } = this.lazyBooking;
            const useManualReturn = config.returnPolicy === ReturnPolicy.MANUAL;
            if (!this.isPast || !useManualReturn) {
                return false;
            }

            return (
                booking.is_return_inventory_done &&
                booking.return_inventory_datetime !== null &&
                booking.mobilization_period.end.isBefore(
                    booking.return_inventory_datetime,
                )
            );
        },

        hasOverdue(): boolean {
            return this.isOverdue || this.wasOverdue;
        },

        overduePeriod(): Period<false> | null {
            const { booking } = this.lazyBooking;
            if (!this.hasOverdue) {
                return null;
            }

            return (
                this.isOverdue
                    ? booking.mobilization_period.tail(this.now)
                    : booking.mobilization_period.tail(
                        booking.return_inventory_datetime!,
                    )
            ) as Period<false>;
        },

        hasWarnings(): boolean {
            const { isPast, isOverdue, lazyBooking } = this;
            const {
                is_archived: isArchived,
                has_not_returned_materials: hasNotReturnedMaterials,
            } = lazyBooking.booking;

            return (
                // - Si le booking est en cours ou à venir et qu'il manque du matériel.
                (!isPast && lazyBooking.isComplete && lazyBooking.booking.has_missing_materials === true) ||

                // - Si le booking est passé et qu'il a du matériel non retourné.
                (isPast && !isArchived && hasNotReturnedMaterials === true) ||

                // - S'il y a un retard.
                isOverdue
            );
        },

        readableState(): string {
            const { $t: __, isOngoing, isOverdue, isPast, lazyBooking: { booking } } = this;
            const { mobilization_period: mobilizationPeriod } = booking;

            if (isPast) {
                return !isOverdue
                    ? __('page.beneficiary-view.borrowings.done')
                    : __('page.beneficiary-view.borrowings.overdue-since', {
                        duration: this.overduePeriod!.toReadableDuration(__),
                    });
            }

            if (isOngoing) {
                return __('page.beneficiary-view.borrowings.currently-mobilized');
            }

            return __(
                'page.beneficiary-view.borrowings.mobilized-starting-from',
                { date: mobilizationPeriod.start.toReadable() },
            );
        },
    },
    mounted() {
        // - Actualise le timestamp courant toutes les minutes.
        this.nowTimer = setInterval(() => { this.now = markRaw(DateTime.now()); }, 60_000);
    },
    beforeDestroy() {
        if (this.nowTimer) {
            clearInterval(this.nowTimer);
        }
    },
    methods: {
        // ------------------------------------------------------
        // -
        // -    Handlers
        // -
        // ------------------------------------------------------

        handleClick() {
            const { booking } = this.lazyBooking;
            this.$emit('click', booking.entity, booking.id);
        },

        handleOpenClick(e: MouseEvent) {
            e.stopPropagation();

            const { booking } = this.lazyBooking;
            this.$emit('openClick', booking.entity, booking.id);
        },

        // ------------------------------------------------------
        // -
        // -    API Publique
        // -
        // ------------------------------------------------------

        /**
         * Fait défiler la liste de manière à faire apparaître le booking.
         *
         * @param behavior - Détermine la manière d'atteindre l'élément:
         *                     - `smooth`: Le defilement sera progressif, avec animation (défaut).
         *                     - `instant`: La defilement sera instantanée.
         *                     - `auto`: L'animation de defilement sera déterminée via la
         *                               propriété CSS `scroll-behavior`.
         */
        scrollIntoView(behavior: ScrollBehavior = 'smooth') {
            this.$el.scrollIntoView({ behavior, block: 'center' });
        },
    },
    render() {
        const { booking } = this.lazyBooking;
        const {
            $t: __,
            icon,
            title,
            duration,
            isFuture,
            isOverdue,
            isOneDay,
            isOngoing,
            isConfirmed,
            hasOverdue,
            wasOverdue,
            hasWarnings,
            arePeriodsUnified,
            overduePeriod,
            readableState,
            handleClick,
            handleOpenClick,
        } = this;

        const className = ['BeneficiaryViewBookingsItem', {
            'BeneficiaryViewBookingsItem--future': isFuture,
            'BeneficiaryViewBookingsItem--current': isOngoing,
            'BeneficiaryViewBookingsItem--overdue': isOverdue,
            'BeneficiaryViewBookingsItem--confirmed': isConfirmed,
            'BeneficiaryViewBookingsItem--warning': hasWarnings,
        }];

        return (
            <li class={className} onClick={handleClick} role="button">
                <div class="BeneficiaryViewBookingsItem__booking">
                    <div class="BeneficiaryViewBookingsItem__booking__icon">
                        <Icon name={icon ?? 'circle-notch'} spin={icon === null} />
                    </div>
                    <div class="BeneficiaryViewBookingsItem__booking__infos">
                        <h3 class="BeneficiaryViewBookingsItem__booking__title">
                            {title}
                        </h3>
                        <div class="BeneficiaryViewBookingsItem__booking__periods">
                            <span
                                class={[
                                    'BeneficiaryViewBookingsItem__booking__periods__item',
                                    'BeneficiaryViewBookingsItem__booking__periods__item--operation',
                                ]}
                            >
                                {(
                                    !hasOverdue || !arePeriodsUnified
                                        ? upperFirst(booking.operation_period.toReadable(__))
                                        : __('page.beneficiary-view.borrowings.initially-planned-period', {
                                            period: booking.operation_period.toReadable(__),
                                        })
                                )}
                                {!isOneDay && (
                                    <span class="BeneficiaryViewBookingsItem__booking__periods__item__duration">
                                        ({__('days-count', { duration }, duration)})
                                    </span>
                                )}
                            </span>
                            {!arePeriodsUnified && (
                                <span
                                    class={[
                                        'BeneficiaryViewBookingsItem__booking__periods__item',
                                        'BeneficiaryViewBookingsItem__booking__periods__item--mobilization',
                                    ]}
                                >
                                    {(
                                        !isOverdue && !wasOverdue
                                            ? upperFirst(booking.mobilization_period.toReadable(__))
                                            : __('page.beneficiary-view.borrowings.initially-planned-period', {
                                                period: booking.mobilization_period.toReadable(__),
                                            })
                                    )}
                                </span>
                            )}
                        </div>
                        {wasOverdue && (
                            <div class="BeneficiaryViewBookingsItem__booking__overdue-summary">
                                {__('page.beneficiary-view.borrowings.late-return-on', {
                                    date: booking.return_inventory_datetime!.toReadable(),
                                    duration: overduePeriod!.toReadableDuration(__),
                                })}
                            </div>
                        )}
                    </div>
                </div>
                <div class="BeneficiaryViewBookingsItem__readable-state">
                    {readableState}
                </div>
                <div class="BeneficiaryViewBookingsItem__actions">
                    <Button icon="eye" onClick={handleOpenClick} />
                </div>
            </li>
        );
    },
});

export default BeneficiaryViewBookingsItem;
