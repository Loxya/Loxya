import './index.scss';
import Queue from 'p-queue';
import pick from 'lodash/pick';
import omit from 'lodash/omit';
import isEqual from 'lodash/isEqual';
import createDeferred from 'p-defer';
import throttle from 'lodash/throttle';
import upperFirst from 'lodash/upperFirst';
import DateTime from '@/utils/datetime';
import config, { ReturnPolicy } from '@/globals/config';
import mergeDifference from '@/utils/mergeDifference';
import { defineComponent, markRaw } from 'vue';
import { DEBOUNCE_WAIT_DURATION } from '@/globals/constants';
import apiBookings, { BookingEntity } from '@/stores/api/bookings';
import { HttpCode, RequestError } from '@/globals/requester';
import showModal from '@/utils/showModal';
import getBookingIcon from '@/utils/getBookingIcon';
import Fragment from '@/components/Fragment';
import Icon from '@/themes/default/components/Icon';
import Dropdown from '@/themes/default/components/Dropdown';
import CriticalError from '@/themes/default/components/CriticalError';
import Page from '@/themes/default/components/Page';
import Button from '@/themes/default/components/Button';
import { BookingsViewMode } from '@/stores/api/users';
import { PeriodReadableFormat } from '@/utils/period';
import ViewModeSwitch from '../../components/ViewModeSwitch';
import FiltersPanel from './components/Filters';
import {
    ServerTable,
    getLegacySavedSearch,
} from '@/themes/default/components/Table';
import {
    persistFilters,
    getPersistedFilters,
    clearPersistedFilters,
    getFiltersFromRoute,
    convertFiltersToRouteQuery,
} from './_utils';

// - Modals
import EventDetails from '@/themes/default/modals/EventDetails';

import type Period from '@/utils/period';
import type { DebouncedMethod } from 'lodash';
import type { ComponentRef, CreateElement, Raw } from 'vue';
import type { PaginatedData, PaginationParams, SortableParams } from '@/stores/api/@types';
import type { Columns } from '@/themes/default/components/Table/Server';
import type { Beneficiary } from '@/stores/api/beneficiaries';
import type { Filters, StateFilter } from './components/Filters';
import type { Session } from '@/stores/api/session';
import type { DeferredPromise } from 'p-defer';
import type {
    BookingExcerpt,
    BookingSummary,
    BookingListFilters,
} from '@/stores/api/bookings';

type InstanceProperties = {
    nowTimer: ReturnType<typeof setInterval> | undefined,
    fetchSummariesQueue: Queue | undefined,
    refreshTableDebounced: (
        | DebouncedMethod<typeof ScheduleListing, 'refreshTable'>
        | undefined
    ),
};

type LazyBooking<F extends boolean = boolean> = (
    F extends true
        ? { isComplete: true, booking: BookingSummary }
        : { isComplete: false, booking: BookingExcerpt }
);

type Data = {
    filters: Filters,
    ready: Raw<DeferredPromise<undefined>>,
    isLoading: boolean,
    hasCriticalError: boolean,
    now: Raw<DateTime>,
};

/** Nombre max. de bookings par page. */
const MAX_ITEMS_PER_PAGE = 30;

/**
 * Nombre de requêtes maximum pour la récupération du matériel
 * manquant envoyées par seconde.
 */
export const MAX_FETCHES_PER_SECOND: number = 15;

/** Page de listing des événements. */
const ScheduleListing = defineComponent({
    name: 'ScheduleListing',
    setup: (): InstanceProperties => ({
        nowTimer: undefined,
        fetchSummariesQueue: undefined,
        refreshTableDebounced: undefined,
    }),
    data(): Data {
        const urlFilters = getFiltersFromRoute(this.$route);

        // - Filtres par défaut.
        const filters: Filters = {
            search: [],
            period: null,
            park: null,
            category: null,
            states: [],
            ...urlFilters,
        };

        // - Filtres sauvegardés.
        const session = this.$store.state.auth.user as Session;
        if (!session.disable_search_persistence) {
            if (urlFilters === undefined) {
                const savedFilters = getPersistedFilters();
                if (savedFilters !== null) {
                    Object.assign(filters, savedFilters);
                } else {
                    // - Ancienne sauvegarde éventuelle, dans le component `<Table />`.
                    const savedSearchLegacy = this.$options.name
                        ? getLegacySavedSearch(this.$options.name)
                        : null;

                    if (savedSearchLegacy !== null) {
                        Object.assign(filters, { search: [savedSearchLegacy] });
                    }
                }
            }

            // NOTE: Le local storage est mis à jour via un `watch` de `filters`.
        } else {
            clearPersistedFilters();
        }

        return {
            ready: markRaw(createDeferred()),
            isLoading: false,
            hasCriticalError: false,
            now: markRaw(DateTime.now()),
            filters,
        };
    },
    computed: {
        shouldPersistSearch(): boolean {
            const session = this.$store.state.auth.user as Session;
            return !session.disable_search_persistence;
        },

        hasMultipleParks(): boolean {
            return this.$store.state.parks.list.length > 1;
        },

        title(): string {
            const { $t: __ } = this;
            return __('page.schedule.listing.title');
        },

        columns(): Columns<LazyBooking> {
            const { $t: __, now, hasMultipleParks, handleOpen } = this;
            const getCategoryName = this.$store.getters['categories/categoryName'];
            const getParkName = this.$store.getters['parks/getName'];

            return [
                {
                    key: 'icon',
                    label: __('page.schedule.listing.columns.state-icon'),
                    class: [
                        'ScheduleListing__table__cell',
                        'ScheduleListing__table__cell--icon',
                    ],
                    render(h: CreateElement, { isComplete, booking }: LazyBooking) {
                        const icon = getBookingIcon(booking, !isComplete, now);
                        return <Icon name={icon ?? 'circle-notch'} spin={icon === null} />;
                    },
                },
                {
                    key: 'title',
                    hideable: false,
                    title: __('page.schedule.listing.columns.title'),
                    class: [
                        'ScheduleListing__table__cell',
                        'ScheduleListing__table__cell--title',
                    ],
                    render(h: CreateElement, { booking }: LazyBooking) {
                        const getTitle = (): string => {
                            const { entity } = booking;
                            switch (entity) {
                                case BookingEntity.EVENT: {
                                    const { title, location } = booking;
                                    return !location ? title : `${title} (${location})`;
                                }
                                default: {
                                    throw new Error(`Unsupported entity ${entity as any}`);
                                }
                            }
                        };

                        const duration = booking.operation_period.asDays();
                        return (
                            <Fragment>
                                <h3 class="ScheduleListing__title">{getTitle()}</h3>
                                <div
                                    class="ScheduleListing__operation-period"
                                    title={__('duration-days', { duration }, duration)}
                                >
                                    {upperFirst(booking.operation_period.toReadable(__))}
                                </div>
                            </Fragment>
                        );
                    },
                },
                {
                    key: 'mobilization_start_date',
                    title: __('page.schedule.listing.columns.mobilization-period'),
                    class: [
                        'ScheduleListing__table__cell',
                        'ScheduleListing__table__cell--mobilization-period',
                    ],
                    sortable: true,
                    render(h: CreateElement, { booking }: LazyBooking) {
                        const { mobilization_period: mobilizationPeriod } = booking;
                        const duration = mobilizationPeriod.asDays();
                        const isPast = booking.mobilization_period.isPast();
                        const isArchived = booking.is_archived;

                        const useManualReturn = config.returnPolicy === ReturnPolicy.MANUAL;
                        if (isPast && useManualReturn) {
                            const isOverdue = (
                                !isArchived &&
                                !booking.is_return_inventory_done &&
                                booking.has_materials
                            );
                            const wasOverdue = (
                                booking.is_return_inventory_done &&
                                booking.return_inventory_datetime !== null &&
                                booking.mobilization_period.end.isBefore(
                                    booking.return_inventory_datetime,
                                )
                            );
                            if (isOverdue || wasOverdue) {
                                const renderOverdueSummary = (): string => {
                                    // - Si le booking n'a toujours pas été retourné et qu'on en mode strict.
                                    if (isOverdue) {
                                        const overduePeriod = booking.mobilization_period.tail(now) as Period<false>;
                                        return __('page.schedule.listing.overdue-since', {
                                            duration: overduePeriod.toReadableDuration(__),
                                        });
                                    }

                                    // - Si le booking a été retourné en retard.
                                    const overduePeriod = booking.mobilization_period
                                        .tail(booking.return_inventory_datetime!) as Period<false>;

                                    return __('page.schedule.listing.late-return-on', {
                                        date: booking.return_inventory_datetime!.toReadable(),
                                        duration: overduePeriod.toReadableDuration(__),
                                    });
                                };

                                return (
                                    <Fragment>
                                        <div title={__('duration-days', { duration }, duration)}>
                                            {__('page.schedule.listing.initially-planned-period', {
                                                period: booking.mobilization_period.toReadable(__, PeriodReadableFormat.SHORT),
                                            })}
                                        </div>
                                        <div
                                            class={['ScheduleListing__overdue', {
                                                'ScheduleListing__overdue--ongoing': isOverdue,
                                            }]}
                                        >
                                            {renderOverdueSummary()}
                                        </div>
                                    </Fragment>
                                );
                            }
                        }

                        return (
                            <div title={__('duration-days', { duration }, duration)}>
                                {upperFirst(mobilizationPeriod.toReadable(__, PeriodReadableFormat.SHORT))}
                            </div>
                        );
                    },
                },
                {
                    key: 'beneficiary',
                    title: __('page.schedule.listing.columns.beneficiaries'),
                    class: [
                        'ScheduleListing__table__cell',
                        'ScheduleListing__table__cell--beneficiaries',
                    ],
                    render(h: CreateElement, { booking }: LazyBooking) {
                        const { entity } = booking;
                        switch (entity) {
                            case BookingEntity.EVENT: {
                                if (booking.beneficiaries.length === 0) {
                                    return (
                                        <span class="ScheduleListing__table__cell__empty">
                                            {__('not-specified')}
                                        </span>
                                    );
                                }

                                return (
                                    <ul class="ScheduleListing__beneficiaries">
                                        {booking.beneficiaries.map((beneficiary: Beneficiary) => {
                                            const { company, full_name: fullName } = beneficiary;

                                            return (
                                                <li key={beneficiary.id} class="ScheduleListing__beneficiaries__item">
                                                    <span class="ScheduleListing__beneficiary">
                                                        <span class="ScheduleListing__beneficiary__name">
                                                            {`${fullName}${company ? ` (${company.legal_name})` : ''}`}
                                                        </span>
                                                    </span>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                );
                            }
                            default: {
                                throw new Error(`Unsupported entity ${entity as any}`);
                            }
                        }
                    },
                },
                {
                    key: 'parks',
                    title: __('page.schedule.listing.columns.parks'),
                    class: [
                        'ScheduleListing__table__cell',
                        'ScheduleListing__table__cell--parks',
                    ],
                    defaultHidden: !hasMultipleParks,
                    render(h: CreateElement, { booking }: LazyBooking) {
                        const parks: string[] = booking.parks.map(getParkName);
                        if (parks.length === 0) {
                            return null;
                        }

                        return (
                            <ul class="ScheduleListing__parks">
                                {parks.map((parkName: string) => (
                                    <li key={parkName} class="ScheduleListing__parks__item">{parkName}</li>
                                ))}
                            </ul>
                        );
                    },
                },
                {
                    key: 'categories',
                    title: __('page.schedule.listing.columns.categories'),
                    class: [
                        'ScheduleListing__table__cell',
                        'ScheduleListing__table__cell--categories',
                    ],
                    render(h: CreateElement, { booking }: LazyBooking) {
                        if (booking.categories.length === 0) {
                            return null;
                        }

                        const categories: string[] = booking.categories.map(getCategoryName);
                        return (
                            <ul class="ScheduleListing__categories">
                                {categories.map((category: string) => (
                                    <li key={category} class="ScheduleListing__categories__item">{category}</li>
                                ))}
                            </ul>
                        );
                    },
                },
                {
                    key: 'actions',
                    class: [
                        'ScheduleListing__table__cell',
                        'ScheduleListing__table__cell--actions',
                    ],
                    render: (h: CreateElement, lazyBooking: LazyBooking) => (
                        <Button
                            icon="eye"
                            onClick={(e: Event) => {
                                e.stopPropagation();
                                handleOpen(lazyBooking);
                            }}
                        />
                    ),
                },
            ];
        },
    },
    watch: {
        filters: {
            handler(newFilters: Filters, prevFilters: Filters | undefined) {
                if (prevFilters !== undefined) {
                    this.refreshTableDebounced!();
                }

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
        this.$store.dispatch('parks/fetch');

        // - Binding.
        this.fetch = this.fetch.bind(this);

        // - Debounce.
        this.refreshTableDebounced = throttle(
            this.refreshTable.bind(this),
            DEBOUNCE_WAIT_DURATION.asMilliseconds(),
            { leading: false },
        );

        // - Fetch queue.
        this.fetchSummariesQueue = new Queue({
            interval: DateTime.duration(1, 'second').asMilliseconds(),
            concurrency: config.maxConcurrentFetches,
            intervalCap: MAX_FETCHES_PER_SECOND,
        });

        // - Initialisation.
        this.init();
    },
    mounted() {
        // - Actualise le timestamp courant toutes les minutes.
        this.nowTimer = setInterval(() => { this.now = markRaw(DateTime.now()); }, 60_000);
    },
    beforeDestroy() {
        this.refreshTableDebounced?.cancel();
        this.fetchSummariesQueue?.clear();

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

        async handleOpen({ booking }: LazyBooking) {
            const modalComponents = {
                [BookingEntity.EVENT]: EventDetails,
            };
            if (!(booking.entity in modalComponents)) {
                throw new Error('Unsupported booking type.');
            }

            let shouldRefetch = false;
            const modalComponent = modalComponents[booking.entity];
            await showModal(this.$modal, modalComponent, {
                id: booking.id,
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
                this.refreshTable();
            }
        },

        handleFiltersChange(newFilters: Filters) {
            // - Recherche textuelle.
            const newSearch = mergeDifference(this.filters.search, newFilters.search);
            if (!isEqual(this.filters.search, newSearch)) {
                this.filters.search = newSearch;
            }

            // - Période.
            if (
                (this.filters.period === null && newFilters.period !== null) ||
                (this.filters.period !== null && newFilters.period === null) ||
                (
                    (this.filters.period !== null && newFilters.period !== null) &&
                    !this.filters.period.isSame(newFilters.period)
                )
            ) {
                this.filters.period = newFilters.period;
            }

            // - Parc.
            if (this.filters.park !== newFilters.park) {
                this.filters.park = newFilters.park;
            }

            // - Catégorie.
            if (this.filters.category !== newFilters.category) {
                this.filters.category = newFilters.category;
            }

            // - États
            const newStates = mergeDifference(this.filters.states, newFilters.states);
            if (!isEqual(this.filters.states, newStates)) {
                this.filters.states = newStates;
            }
        },

        handleFiltersSubmit() {
            this.refreshTable();
        },

        handleConfigureColumns() {
            const $table = this.$refs.table as ComponentRef<typeof ServerTable>;
            $table?.showColumnsSelector();
        },

        // ------------------------------------------------------
        // -
        // -    Méthodes internes
        // -
        // ------------------------------------------------------

        async init() {
            this.$store.dispatch('categories/fetch');

            // - L'initialisation est maintenant terminée.
            this.ready.resolve();
        },

        async fetch(pagination: PaginationParams & SortableParams): Promise<PaginatedData<LazyBooking[]> | undefined> {
            await this.ready.promise;

            pagination = pick(pagination, ['page', 'limit', 'ascending', 'orderBy']);
            this.isLoading = true;

            const { filters: rawFilters } = this;
            const filters: BookingListFilters = omit(rawFilters, ['states']);
            rawFilters.states.forEach((state: StateFilter) => {
                if (rawFilters.states.includes(state)) {
                    filters[state] = true;
                }
            });

            // - Vide la file d'attente des requêtes avant de la re-peupler.
            this.fetchSummariesQueue?.clear();

            try {
                const data = await apiBookings.all({
                    paginated: true,
                    ...pagination,
                    ...filters,
                });

                const lazyData: LazyBooking[] = data.data.map(
                    (booking: BookingExcerpt) => ({ isComplete: false, booking }),
                );

                this.fetchSummaries(lazyData);

                return { data: lazyData, pagination: data.pagination };
            } catch (error) {
                if (error instanceof RequestError && error.httpCode === HttpCode.RangeNotSatisfiable) {
                    this.refreshTable();
                    return undefined;
                }

                // eslint-disable-next-line no-console
                console.error(`Error occurred while retrieving bookings:`, error);
                this.hasCriticalError = true;
            } finally {
                this.isLoading = false;
            }

            return undefined;
        },

        async fetchSummaries(data: LazyBooking[]) {
            const promises = data
                .filter((lazy: LazyBooking): lazy is LazyBooking<false> => (
                    !lazy.isComplete &&
                    lazy.booking.mobilization_period.end.isAfter(this.now)
                ))
                .map(({ booking }: LazyBooking<false>) => async () => {
                    const finalBooking = await apiBookings.oneSummary(booking.entity, booking.id);

                    const index = data.findIndex(({ booking: { entity, id } }: LazyBooking) => (
                        entity === booking.entity && id === booking.id
                    ));
                    if (index === undefined) {
                        return;
                    }

                    this.$set(data, index, { isComplete: true, booking: finalBooking });
                });

            await this.fetchSummariesQueue?.addAll(promises);
        },

        refreshTable() {
            this.refreshTableDebounced?.cancel();

            (this.$refs.table as ComponentRef<typeof ServerTable>)?.refresh();
        },
    },
    render() {
        const {
            $t: __,
            title,
            isLoading,
            hasCriticalError,
            filters,
            $options,
            columns,
            fetch,
            handleOpen,
            handleFiltersChange,
            handleFiltersSubmit,
            handleConfigureColumns,
        } = this;

        if (hasCriticalError) {
            return (
                <Page name="schedule-listing" title={title} centered>
                    <CriticalError />
                </Page>
            );
        }

        const getRowClass = (lazyBooking: LazyBooking): JSX.NodeClass => {
            const { isComplete, booking } = lazyBooking;
            const isPast = booking.mobilization_period.isPast();
            const isArchived = booking.is_archived;
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

            const hasWarnings: boolean = (
                // - Si le booking est en cours ou à venir et qu'il manque du matériel.
                (!isPast && isComplete && booking.has_missing_materials === true) ||

                // - Si le booking est passé et qu'il a du matériel manquant.
                (isPast && !isArchived && booking.has_not_returned_materials === true) ||

                // - S'il y a un retard.
                isOverdue
            );

            return ['ScheduleListing__table__row', {
                'ScheduleListing__table__row--with-warning': hasWarnings,
            }];
        };

        return (
            <Page
                name="schedule-listing"
                title={title}
                loading={isLoading}
                actions={[
                    <ViewModeSwitch mode={BookingsViewMode.LISTING} />,
                    <Button type="add" to={{ name: 'add-event' }} collapsible>
                        {__('page.schedule.listing.add-event')}
                    </Button>,
                    <Dropdown>
                        <Button icon="table" onClick={handleConfigureColumns}>
                            {__('configure-columns')}
                        </Button>
                    </Dropdown>,
                ]}
                scopedSlots={{
                    headerContent: (): JSX.Node => (
                        <FiltersPanel
                            values={filters}
                            onChange={handleFiltersChange}
                            onSubmit={handleFiltersSubmit}
                        />
                    ),
                }}
            >
                <div class="ScheduleListing">
                    <ServerTable
                        ref="table"
                        key="default"
                        name={$options.name}
                        class="ScheduleListing__table"
                        rowClass={getRowClass}
                        columns={columns}
                        fetcher={fetch}
                        onRowClick={handleOpen}
                        defaultOrderBy={{
                            column: 'mobilization_start_date',
                            ascending: false,
                        }}
                        perPage={MAX_ITEMS_PER_PAGE}
                    />
                </div>
            </Page>
        );
    },
});

export default ScheduleListing;
