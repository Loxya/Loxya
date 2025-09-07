import './index.scss';
import Day from '@/utils/day';
import Period from '@/utils/period';
import DateTime from '@/utils/datetime';
import parseInteger from '@/utils/parseInteger';
import { defineComponent, markRaw } from 'vue';
import apiBookings, { BookingEntity } from '@/stores/api/bookings';
import bookingFormatterFactory from '@/utils/formatTimelineBooking';
import showModal from '@/utils/showModal';
import apiBeneficiaries from '@/stores/api/beneficiaries';
import Queue from 'p-queue';
import EventDetails from '@/themes/default/modals/EventDetails';
import CriticalError from '@/themes/default/components/CriticalError';
import Loading from '@/themes/default/components/Loading';
import Timeline from '@/themes/default/components/Timeline';
import EmptyMessage from '@/themes/default/components/EmptyMessage';
import config from '@/globals/config';
import Item from '../../components/BookingsItem';

import type { ComponentRef, PropType, Raw } from 'vue';
import type { BeneficiaryDetails } from '@/stores/api/beneficiaries';
import type { TimelineClickEvent, TimelineItem } from '@/themes/default/components/Timeline';
import type { BookingExcerpt, BookingSummary } from '@/stores/api/bookings';
import type { LazyBooking } from '../../_types';

type Props = {
    /** Le bénéficiaire dont on veut afficher les emprunts. */
    beneficiary: BeneficiaryDetails,
};

type InstanceProperties = {
    nowTimer: ReturnType<typeof setInterval> | undefined,
    fetchMissingMaterialsQueue: Queue | undefined,
    cancelOngoingFetch: (() => void) | undefined,
};

type Data = {
    bookings: LazyBooking[],
    defaultShownPeriod: Raw<Period>,
    hasCriticalError: boolean,
    isPartiallyFetched: boolean,
    isFullyFetched: boolean,
    now: Raw<DateTime>,
};

/**
 * Interval de temps minimum affiché dans la timeline.
 * (Il ne sera pas possible d'augmenter le zoom au delà de cette limite)
 */
const MIN_ZOOM = DateTime.duration(1, 'hour');

/**
 * Interval de temps maximum affiché dans la timeline.
 * (Il ne sera pas possible de dé-zoomer au delà de cette limite)
 */
const MAX_ZOOM = DateTime.duration(config.maxFetchPeriod, 'days');

/**
 * Nombre de requêtes maximum pour la récupération du matériel
 * manquant envoyées par seconde.
 */
export const MAX_FETCHES_PER_SECOND: number = 10;

/** Contenu de l'onglet "emprunts" de la page de détails d'un bénéficiaire. */
const BeneficiaryViewBorrowings = defineComponent({
    name: 'BeneficiaryViewBorrowings',
    props: {
        beneficiary: {
            type: Object as PropType<Props['beneficiary']>,
            required: true,
        },
    },
    setup: (): InstanceProperties => ({
        nowTimer: undefined,
        cancelOngoingFetch: undefined,
        fetchMissingMaterialsQueue: undefined,
    }),
    data: (): Data => ({
        bookings: [],
        defaultShownPeriod: markRaw(new Period(
            Day.today().subDay(7),
            Day.today().addDay(7),
            true,
        )),
        hasCriticalError: false,
        isPartiallyFetched: false,
        isFullyFetched: false,
        now: markRaw(DateTime.now()),
    }),
    computed: {
        timelineBookings(): TimelineItem[] {
            const { $t: __, now, bookings } = this;
            const calendarSettings = this.$store.state.settings.calendar ?? {};

            const formatter = bookingFormatterFactory(__, now, {
                showEventLocation: calendarSettings.event?.showLocation ?? true,
                showEventBorrower: calendarSettings.event?.showBorrower ?? false,
            });

            return bookings.map((lazy: LazyBooking): TimelineItem => {
                const formattedBooking = (
                    lazy.isComplete
                        ? formatter(lazy.booking, false)
                        : formatter(lazy.booking, true)
                );
                return { ...formattedBooking, editable: false };
            });
        },
    },
    created() {
        this.fetchMissingMaterialsQueue = new Queue({
            interval: DateTime.duration(1, 'second').asMilliseconds(),
            concurrency: config.maxConcurrentFetches,
            intervalCap: MAX_FETCHES_PER_SECOND,
        });
    },
    mounted() {
        this.fetchData();

        // - Actualise le timestamp courant toutes les minutes.
        this.nowTimer = setInterval(() => { this.now = markRaw(DateTime.now()); }, 60_000);
    },
    beforeDestroy() {
        this.cancelOngoingFetch?.();
        this.fetchMissingMaterialsQueue?.clear();

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

        handleClickItem(entity: BookingEntity, id: BookingExcerpt['id']) {
            // - Récupération du booking lié.
            const lazyBooking = this.bookings.find((lazy: LazyBooking) => (
                lazy.booking.entity === entity && lazy.booking.id === id
            ));
            if (lazyBooking === undefined) {
                return;
            }
            const { booking } = lazyBooking;

            const $timeline = this.$refs.timeline as ComponentRef<typeof Timeline>;
            $timeline?.moveTo(booking.mobilization_period.start);
        },

        handleClickOpenItem(entity: BookingEntity, id: BookingExcerpt['id']) {
            this.showModal(entity, id);
        },

        handleDoubleClickTimelineItem(payload: TimelineClickEvent) {
            // - Si c'est un double-clic sur une partie vide (= sans booking) du calendrier...
            //   => On ne pas va plus loin.
            const identifier = payload.item?.id ?? null;
            if (identifier === null) {
                return;
            }

            // - Parsing de l'identifier du booking du calendrier.
            const identifierParts = (identifier as string).split('-');
            if (identifierParts.length !== 2) {
                return;
            }
            const entity = identifierParts[0];
            if (!Object.values(BookingEntity).includes(entity as any)) {
                return;
            }

            const id = parseInteger(identifierParts[1]);
            if (id === null) {
                return;
            }

            this.showModal(entity as BookingEntity, id);
        },

        handleClickTimelineItem(payload: TimelineClickEvent) {
            const identifier = payload.item?.id ?? null;
            if (identifier === null) {
                return;
            }

            const $item = this.$refs[`items[${identifier}]`] as ComponentRef<typeof Item>;
            $item?.scrollIntoView();
        },

        // ------------------------------------------------------
        // -
        // -    Méthodes internes
        // -
        // ------------------------------------------------------

        async fetchData(forceRefresh: boolean = false) {
            const { beneficiary } = this;

            // - Vide la file d'attente des requêtes avant de la re-peupler.
            this.fetchMissingMaterialsQueue?.clear();

            // - Annule la récupération en cours, s'il y en a une.
            this.cancelOngoingFetch?.();

            let isCancelled: boolean = false;
            this.cancelOngoingFetch = () => {
                isCancelled = true;
            };

            try {
                // - On garde en mémoire les données des bookings précédemment récupérés complètement
                //   pour éviter de renvoyer les requêtes de récupération inutilement pour ceux-ci.
                const prevCompleteBookings = new Map<BookingEntity, Map<number, BookingSummary>>([
                    [BookingEntity.EVENT, new Map()],
                ]);
                if (!forceRefresh) {
                    this.bookings.forEach(({ isComplete, booking }: LazyBooking) => {
                        if (isComplete) {
                            prevCompleteBookings
                                .get(booking.entity)!
                                .set(booking.id, booking);
                        }
                    });
                }

                const fetchPageRecursive = async (page: number): Promise<void> => {
                    const { data, pagination } = await apiBeneficiaries.bookings(beneficiary.id, { page });
                    if (isCancelled) {
                        return;
                    }

                    const lazyBookings: LazyBooking[] = data.map(
                        (booking: BookingExcerpt) => {
                            const prevEntityBookings = prevCompleteBookings.get(booking.entity);
                            return prevEntityBookings?.has(booking.id)
                                ? { isComplete: true, booking: prevEntityBookings.get(booking.id)! }
                                : { isComplete: false, booking };
                        },
                    );

                    if (page === 1) {
                        this.bookings = lazyBookings;
                    } else {
                        this.bookings.push(...lazyBookings);
                    }

                    const promises = lazyBookings
                        .filter((lazy: LazyBooking): lazy is LazyBooking<false> => (
                            !lazy.isComplete &&
                            lazy.booking.mobilization_period.end.isAfter(this.now)
                        ))
                        .map(({ booking }: LazyBooking<false>) => async () => {
                            const finalBooking = await apiBookings.oneSummary(booking.entity, booking.id);

                            const originalBookingIndex = this.bookings.findIndex(
                                ({ booking: _booking }: LazyBooking) => (
                                    _booking.entity === booking.entity &&
                                    _booking.id === booking.id
                                ),
                            );
                            if (originalBookingIndex === -1) {
                                return;
                            }

                            const lazyBooking = { isComplete: true, booking: finalBooking };
                            this.$set(this.bookings, originalBookingIndex, lazyBooking);
                        });

                    await this.fetchMissingMaterialsQueue?.addAll(promises);

                    this.isPartiallyFetched = true;
                    this.isFullyFetched = false;

                    if (page < pagination.total.pages) {
                        await fetchPageRecursive(page + 1);
                    }
                };
                await fetchPageRecursive(1);

                if (!isCancelled) {
                    this.isFullyFetched = true;
                    this.isPartiallyFetched = false;
                }
            } catch {
                this.hasCriticalError = true;
            }
        },

        async showModal(entity: BookingEntity, id: BookingExcerpt['id']) {
            const modalComponents = {
                [BookingEntity.EVENT]: EventDetails,
            };
            if (!(entity in modalComponents)) {
                throw new Error('Unsupported booking type.');
            }

            let shouldRefetch = false;
            const modalComponent = modalComponents[entity];
            await showModal(this.$modal, modalComponent, {
                id,
                onUpdated: () => {
                    shouldRefetch = true;
                },
                onDuplicated() {
                    shouldRefetch = true;
                },
                onDeleted: () => {
                    shouldRefetch = true;
                },
            });

            if (shouldRefetch) {
                this.fetchData(true);
            }
        },
    },
    render() {
        const {
            $t: __,
            bookings,
            defaultShownPeriod,
            hasCriticalError,
            isPartiallyFetched,
            isFullyFetched,
            timelineBookings,
            handleClickItem,
            handleClickOpenItem,
            handleClickTimelineItem,
            handleDoubleClickTimelineItem,
        } = this;

        if (hasCriticalError || (!isPartiallyFetched && !isFullyFetched)) {
            return (
                <div class="BeneficiaryViewBorrowings">
                    {hasCriticalError ? <CriticalError /> : <Loading />}
                </div>
            );
        }

        if (bookings.length === 0) {
            return (
                <div class="BeneficiaryViewBorrowings">
                    <EmptyMessage
                        message={__('page.beneficiary-view.borrowings.nothing-to-show')}
                    />
                </div>
            );
        }

        return (
            <div class="BeneficiaryViewBorrowings">
                <ul class="BeneficiaryViewBorrowings__listing">
                    {bookings.map((lazy: LazyBooking) => (
                        <Item
                            ref={`items[${lazy.booking.entity}-${lazy.booking.id}]`}
                            key={`${lazy.booking.entity}-${lazy.booking.id}`}
                            lazyBooking={lazy}
                            onClick={handleClickItem}
                            onOpenClick={handleClickOpenItem}
                        />
                    ))}
                </ul>
                <div class="BeneficiaryViewBorrowings__timeline">
                    <Timeline
                        ref="timeline"
                        class="BeneficiaryViewBorrowings__timeline__element"
                        defaultPeriod={defaultShownPeriod}
                        zoomMin={MIN_ZOOM}
                        zoomMax={MAX_ZOOM}
                        items={timelineBookings}
                        onClick={handleClickTimelineItem}
                        onDoubleClick={handleDoubleClickTimelineItem}
                    />
                </div>
            </div>
        );
    },
});

export default BeneficiaryViewBorrowings;
