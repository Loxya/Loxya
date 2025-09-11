import './index.scss';
import Queue from 'p-queue';
import Day from '@/utils/day';
import isEqual from 'lodash/isEqual';
import config from '@/globals/config';
import debounce from 'lodash/debounce';
import DateTime from '@/utils/datetime';
import { HttpCode, RequestError } from '@/globals/requester';
import showModal from '@/utils/showModal';
import { Group } from '@/stores/api/groups';
import parseInteger from '@/utils/parseInteger';
import stringIncludes from '@/utils/stringIncludes';
import mergeDifference from '@/utils/mergeDifference';
import { defineComponent, markRaw } from 'vue';
import { DEBOUNCE_WAIT_DURATION } from '@/globals/constants';
import bookingFormatterFactory from '@/utils/formatTimelineBooking';
import apiBookings, { BookingEntity } from '@/stores/api/bookings';
import Page from '@/themes/default/components/Page';
import CriticalError from '@/themes/default/components/CriticalError';
import Timeline from '@/themes/default/components/Timeline';
import Header from './components/Header';
import Caption from './components/Caption';
import {
    MIN_ZOOM,
    MAX_ZOOM,
    SNAP_TIME,
    FETCH_DELTA,
    MAX_FETCHES_PER_SECOND,
    CALENDAR_PERIOD_STORAGE_KEY,
} from './_constants';
import {
    persistFilters,
    getPersistedFilters,
    clearPersistedFilters,
    getDefaultPeriod,
    getFiltersFromRoute,
    getCenterDateFromPeriod,
    convertFiltersToRouteQuery,
} from './_utils';

// - Modals
import EventDetails from '@/themes/default/modals/EventDetails';

import type Period from '@/utils/period';
import type { Filters } from './components/Filters';
import type { Beneficiary } from '@/stores/api/beneficiaries';
import type { User } from '@/stores/api/users';
import type { EventDetails as EventDetailsType } from '@/stores/api/events';
import type { Session } from '@/stores/api/session';
import type { DebouncedMethod } from 'lodash';
import type { ComponentRef, Raw } from 'vue';
import type {
    TimelineItem,
    TimelineClickEvent,
} from '@/themes/default/components/Timeline';
import type {
    BookingExcerpt,
    BookingSummary,
} from '@/stores/api/bookings';

type InstanceProperties = {
    fetchIncompleteBookingsQueue: Queue | undefined,
    nowTimer: ReturnType<typeof setInterval> | undefined,
    handleRangeChangedDebounced: (
        | DebouncedMethod<typeof ScheduleCalendar, 'handleRangeChanged'>
        | undefined
    ),
};

type LazyBooking<F extends boolean = boolean> = (
    F extends true
        ? { isComplete: true, booking: BookingSummary }
        : { isComplete: false, booking: BookingExcerpt }
);

type Data = {
    bookings: LazyBooking[],
    isLoading: boolean,
    isFetched: boolean,
    isSaving: boolean,
    hasCriticalError: boolean,
    centerDate: Raw<Day> | null,
    defaultPeriod: Raw<Period>,
    fetchPeriod: Raw<Period>,
    filters: Filters,
    now: Raw<DateTime>,
};

/** Page du calendrier des événements. */
const ScheduleCalendar = defineComponent({
    name: 'ScheduleCalendar',
    setup: (): InstanceProperties => ({
        handleRangeChangedDebounced: undefined,
        fetchIncompleteBookingsQueue: undefined,
        nowTimer: undefined,
    }),
    data(): Data {
        const urlFilters = getFiltersFromRoute(this.$route);

        // - Filtres par défaut.
        const filters: Filters = {
            search: [],
            park: null,
            category: null,
            withMissingMaterial: false,
            ...urlFilters,
        };

        // - Filtres sauvegardés.
        const session = this.$store.state.auth.user as Session;
        if (!session.disable_search_persistence) {
            if (urlFilters === undefined) {
                const savedFilters = getPersistedFilters();
                Object.assign(filters, savedFilters ?? {});
            }

            // NOTE: Le local storage est mis à jour via un `watch` de `filters`.
        } else {
            clearPersistedFilters();
        }

        // - Périodes par défaut.
        const defaultPeriod = markRaw(getDefaultPeriod());
        const fetchPeriod = markRaw(
            defaultPeriod
                .setFullDays(true)
                .offset(FETCH_DELTA),
        );

        return {
            bookings: [],
            isLoading: false,
            isFetched: false,
            isSaving: false,
            hasCriticalError: false,
            now: markRaw(DateTime.now()),
            centerDate: null,
            defaultPeriod,
            fetchPeriod,
            filters,
        };
    },
    computed: {
        shouldPersistSearch(): boolean {
            const session = this.$store.state.auth.user as Session;
            return !session.disable_search_persistence;
        },

        title(): string {
            const { $t: __ } = this;
            return __('page.schedule.calendar.title');
        },

        isTeamMember(): boolean {
            return this.$store.getters['auth/is']([
                Group.ADMINISTRATION,
                Group.SUPERVISION,
                Group.OPERATION,
            ]);
        },

        filteredBookings(): LazyBooking[] {
            const { bookings, filters } = this;
            const search = filters.search.filter(
                (term: string) => term.trim().length > 1,
            );

            return bookings.filter(({ isComplete, booking }: LazyBooking) => {
                // - Si on a un filtrage sur les événements, on ne laisse
                //   passer que les bookings avec matériel manquant.
                if (filters.withMissingMaterial && (!isComplete || !booking.has_missing_materials)) {
                    return false;
                }

                // - Recherche textuelle
                if (search.length > 0) {
                    const isMatching = search.some((term: string) => {
                        const isBeneficiaryMatching = (beneficiary: Beneficiary): boolean => (
                            stringIncludes(beneficiary.first_name, term) ||
                            stringIncludes(beneficiary.last_name, term) ||
                            stringIncludes(`${beneficiary.first_name} ${beneficiary.last_name}`, term) ||
                            stringIncludes(`${beneficiary.last_name} ${beneficiary.first_name}`, term) ||
                            (
                                beneficiary.company !== null &&
                                stringIncludes(beneficiary.company.legal_name, term)
                            ) ||
                            (
                                beneficiary.reference !== null &&
                                stringIncludes(beneficiary.reference, term)
                            ) ||
                            (
                                beneficiary.email !== null &&
                                stringIncludes(beneficiary.email, term)
                            )
                        );

                        const isUserMatching = (author: User): boolean => (
                            stringIncludes(author.first_name, term) ||
                            stringIncludes(author.last_name, term) ||
                            stringIncludes(`${author.first_name} ${author.last_name}`, term) ||
                            stringIncludes(`${author.last_name} ${author.first_name}`, term) ||
                            stringIncludes(author.pseudo, term) ||
                            stringIncludes(author.email, term)
                        );

                        if (booking.entity === BookingEntity.EVENT) {
                            // - Titre ou lieu de l'événement
                            if (
                                stringIncludes(booking.title, term) ||
                                (
                                    booking.location !== null &&
                                    stringIncludes(booking.location, term)
                                )
                            ) {
                                return true;
                            }

                            // - Bénéficiaires de l'événement
                            const hasMatchingBeneficiary = booking.beneficiaries
                                .some(isBeneficiaryMatching);
                            if (hasMatchingBeneficiary) {
                                return true;
                            }

                            // - Créateur de l'événement.
                            if (booking.author !== null && isUserMatching(booking.author)) {
                                return true;
                            }

                            // - Chef de projet de l'événement.
                            if (booking.manager !== null && isUserMatching(booking.manager)) {
                                return true;
                            }
                        }

                        return false;
                    });
                    if (!isMatching) {
                        return false;
                    }
                }

                // - Si on a un filtrage sur un parc,
                //   on vérifie que ce parc est présent parmi les parcs de l'événement.
                const parkFilter = filters.park;
                if (
                    parkFilter !== null &&
                    booking.parks !== null &&
                    !booking.parks.includes(parkFilter)
                ) {
                    return false;
                }

                // - Catégorie
                if (
                    filters.category !== null &&
                    booking.categories !== null &&
                    !booking.categories.includes(filters.category)
                ) {
                    return false;
                }

                return true;
            });
        },

        timelineItems(): TimelineItem[] {
            const { $t: __, now, filteredBookings } = this;
            const calendarSettings = this.$store.state.settings.calendar ?? {};

            const formatter = bookingFormatterFactory(__, now, {
                showEventLocation: calendarSettings.event?.showLocation ?? true,
                showEventBorrower: calendarSettings.event?.showBorrower ?? false,
            });

            return filteredBookings.map((lazy: LazyBooking): TimelineItem => (
                lazy.isComplete
                    ? formatter(lazy.booking, false)
                    : formatter(lazy.booking, true)
            ));
        },
    },
    watch: {
        filters: {
            handler(newFilters: Filters) {
                // - Persistance dans le local storage.
                if (this.shouldPersistSearch) {
                    persistFilters(newFilters);
                }

                // - Mise à jour de l'URL.
                const prevRouteQuery = this.$route?.query ?? {};
                const newRouteQuery = convertFiltersToRouteQuery(newFilters);
                if (!isEqual(prevRouteQuery, newRouteQuery)) {
                    this.$router.replace({ query: newRouteQuery });
                }
            },
            deep: true,
            immediate: true,
        },
    },
    created() {
        // - Debounce.
        this.handleRangeChangedDebounced = debounce(
            this.handleRangeChanged.bind(this),
            DEBOUNCE_WAIT_DURATION.asMilliseconds(),
        );

        // - Fetch queue.
        this.fetchIncompleteBookingsQueue = new Queue({
            interval: DateTime.duration(1, 'second').asMilliseconds(),
            concurrency: config.maxConcurrentFetches,
            intervalCap: MAX_FETCHES_PER_SECOND,
        });
    },
    mounted() {
        // - Actualise le timestamp courant toutes les minutes.
        this.nowTimer = setInterval(() => { this.now = markRaw(DateTime.now()); }, 10_000);
    },
    beforeDestroy() {
        this.handleRangeChangedDebounced?.cancel();
        this.fetchIncompleteBookingsQueue?.clear();

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

        handleRefresh() {
            this.fetchData(true);
        },

        handleChangeCenterDate(day: Day) {
            this.centerDate = markRaw(day);

            const $timeline = this.$refs.timeline as ComponentRef<typeof Timeline>;
            $timeline?.moveTo(day.toDateTime().set('hour', 12));
        },

        handleRangeChanged(newPeriod: Period) {
            localStorage.setItem(CALENDAR_PERIOD_STORAGE_KEY, JSON.stringify(newPeriod));
            this.centerDate = markRaw(getCenterDateFromPeriod(newPeriod));

            const newFetchPeriod = newPeriod
                .setFullDays(true)
                .offset(FETCH_DELTA);

            const needFetch = (
                !this.isFetched ||
                newFetchPeriod.start.isBefore(this.fetchPeriod.start) ||
                newFetchPeriod.end.isAfter(this.fetchPeriod.end)
            );
            if (needFetch) {
                this.fetchPeriod = markRaw(newFetchPeriod);
                this.fetchData();
            }
        },

        handleFiltersChange(newFilters: Filters) {
            // - Recherche textuelle.
            const newSearch = mergeDifference(this.filters.search, newFilters.search);
            if (!isEqual(this.filters.search, newSearch)) {
                this.filters.search = newSearch;
            }

            // - Parc.
            if (this.filters.park !== newFilters.park) {
                this.filters.park = newFilters.park;
            }

            // - Catégorie.
            if (this.filters.category !== newFilters.category) {
                this.filters.category = newFilters.category;
            }

            // - Avec matériel manquant.
            if (this.filters.withMissingMaterial !== newFilters.withMissingMaterial) {
                this.filters.withMissingMaterial = newFilters.withMissingMaterial;
            }
        },

        //
        // - Handlers pour les items.
        //

        handleItemDoubleClick(payload: TimelineClickEvent) {
            const {
                isTeamMember,
                handleUpdatedBooking,
                handleDuplicatedBooking,
                handleDeletedBooking,
            } = this;

            // - Si c'est un double-clic sur une partie vide (= sans booking) du calendrier...
            //   => On redirige vers la création d'un événement avec cette date.
            const identifier = payload.item?.id ?? null;
            if (identifier === null) {
                // - Si l'utilisateur courant n'est pas un membre de l'équipe, on ne va pas plus loin.
                if (!isTeamMember) {
                    return;
                }

                // - Sinon, on redirige vers la création d'un événement.
                const atDate = new Day(payload.snappedTime).toString();
                this.$router.push({ name: 'add-event', query: { atDate } });
                return;
            }

            // - Parsing de l'identifier de l'événement du calendrier.
            const identifierParts = (identifier as string).split('-');
            if (identifierParts.length !== 2) {
                return;
            }
            const entity = identifierParts[0];
            const id = parseInteger(identifierParts[1]);
            if (id === null) {
                return;
            }

            // - Récupération du booking lié.
            const lazyBooking = this.bookings.find((lazy: LazyBooking) => (
                lazy.booking.entity === entity && lazy.booking.id === id
            ));
            if (lazyBooking === undefined) {
                return;
            }
            const { booking } = lazyBooking;

            switch (booking.entity) {
                case BookingEntity.EVENT: {
                    showModal(this.$modal, EventDetails, {
                        id: booking.id,
                        async onUpdated(event: EventDetailsType) {
                            try {
                                handleUpdatedBooking(await apiBookings.oneSummary(BookingEntity.EVENT, event.id));
                            } catch (error) {
                                // eslint-disable-next-line no-console
                                console.error('Error while retrieving updated booking data', error);
                            }
                        },
                        async onDuplicated(newEvent: EventDetailsType) {
                            try {
                                handleDuplicatedBooking(await apiBookings.oneSummary(BookingEntity.EVENT, newEvent.id));
                            } catch (error) {
                                // eslint-disable-next-line no-console
                                console.error('Error while retrieving duplicated booking data', error);
                            }
                        },
                        onDeleted() {
                            handleDeletedBooking(booking);
                        },
                    });
                    break;
                }
                default: {
                    throw new Error('Unsupported booking type.');
                }
            }
        },

        handleUpdatedBooking(booking: BookingSummary) {
            const originalBookingIndex = this.bookings.findIndex(
                ({ booking: _booking }: LazyBooking) => (
                    _booking.entity === booking.entity &&
                    _booking.id === booking.id
                ),
            );
            if (originalBookingIndex === -1) {
                return;
            }
            this.$set(this.bookings, originalBookingIndex, { isComplete: true, booking });
        },

        handleDuplicatedBooking(newBooking: BookingSummary) {
            this.bookings.push({ isComplete: true, booking: newBooking });

            const $timeline = this.$refs.timeline as ComponentRef<typeof Timeline>;
            $timeline?.moveTo(newBooking.mobilization_period.start);
        },

        handleDeletedBooking(booking: BookingExcerpt | BookingSummary) {
            const bookingIndex = this.bookings.findIndex(
                ({ booking: _booking }: LazyBooking) => (
                    _booking.entity === booking.entity &&
                    _booking.id === booking.id
                ),
            );
            if (bookingIndex === -1) {
                return;
            }
            this.bookings.splice(bookingIndex, 1);
        },

        // ------------------------------------------------------
        // -
        // -    Méthodes internes
        // -
        // ------------------------------------------------------

        async fetchData(forceRefresh: boolean = false) {
            this.isLoading = true;

            // - Vide la file d'attente des requêtes avant de la re-peupler.
            this.fetchIncompleteBookingsQueue?.clear();

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

                this.bookings = (await apiBookings.all({ paginated: false, period: this.fetchPeriod })).map(
                    (booking: BookingExcerpt) => {
                        const prevEntityBookings = prevCompleteBookings.get(booking.entity);
                        return prevEntityBookings?.has(booking.id)
                            // TODO: Si quelque chose a changé notamment au niveau du retour,
                            //       invalider le cache `isComplete: true` du booking ?
                            ? { isComplete: true, booking: prevEntityBookings.get(booking.id)! }
                            : { isComplete: false, booking };
                    },
                );

                this.isFetched = true;
            } catch (error) {
                if (error instanceof RequestError && error.httpCode === HttpCode.RangeNotSatisfiable) {
                    const $timeline = this.$refs.timeline as ComponentRef<typeof Timeline>;
                    $timeline?.zoomIn(1, false);
                    return;
                }

                // eslint-disable-next-line no-console
                console.error(`Error occurred while retrieving bookings:`, error);
                this.hasCriticalError = true;
            }

            try {
                const promises = this.bookings
                    .filter((lazy: LazyBooking): lazy is LazyBooking<false> => (
                        !lazy.isComplete &&
                        lazy.booking.mobilization_period.end.isAfter(this.now)
                    ))
                    .map(({ booking }: LazyBooking<false>) => async () => {
                        const finalBooking = await apiBookings.oneSummary(booking.entity, booking.id);
                        this.handleUpdatedBooking(finalBooking);
                    });

                await this.fetchIncompleteBookingsQueue?.addAll(promises);
            } catch (error) {
                // eslint-disable-next-line no-console
                console.error(`Error occurred while retrieving missing materials:`, error);
            } finally {
                this.isLoading = false;
            }
        },
    },
    render() {
        const {
            $t: __,
            title,
            filters,
            isLoading,
            isSaving,
            centerDate,
            defaultPeriod,
            hasCriticalError,
            timelineItems,
            handleRefresh,
            handleFiltersChange,
            handleRangeChangedDebounced,
            handleItemDoubleClick,
            handleChangeCenterDate,
        } = this;

        if (hasCriticalError) {
            return (
                <Page
                    name="schedule-calendar"
                    title={title}
                    centered
                >
                    <CriticalError />
                </Page>
            );
        }

        return (
            <Page
                name="schedule-calendar"
                title={title}
                loading={isLoading || isSaving}
            >
                <div class="ScheduleCalendar">
                    <Header
                        ref="header"
                        filters={filters}
                        centerDate={centerDate}
                        isLoading={isLoading || isSaving}
                        onRefresh={handleRefresh}
                        onChangeCenterDate={handleChangeCenterDate}
                        onFiltersChange={handleFiltersChange}
                    />
                    <Timeline
                        ref="timeline"
                        class="ScheduleCalendar__timeline"
                        defaultPeriod={defaultPeriod}
                        zoomMin={MIN_ZOOM}
                        zoomMax={MAX_ZOOM}
                        snapTime={SNAP_TIME}
                        items={timelineItems}
                        onDoubleClick={handleItemDoubleClick}
                        onRangeChanged={handleRangeChangedDebounced}
                    />
                    <div class="ScheduleCalendar__footer">
                        <p class="ScheduleCalendar__footer__help">
                            {__('page.schedule.calendar.help')}
                        </p>
                        <Caption />
                    </div>
                </div>
            </Page>
        );
    },
});

export default ScheduleCalendar;
