import './index.scss';
import isEqual from 'lodash/isEqual';
import DateTime from '@/utils/datetime';
import { HttpCode, RequestError } from '@/globals/requester';
import debounce from 'lodash/debounce';
import showModal from '@/utils/showModal';
import stringIncludes from '@/utils/stringIncludes';
import mergeDifference from '@/utils/mergeDifference';
import { defineComponent, markRaw } from 'vue';
import apiTechnicians from '@/stores/api/technicians';
import { DEBOUNCE_WAIT_DURATION } from '@/globals/constants';
import assignmentFormatterFactory from '@/utils/formatTimelineAssignment';
import Page from '@/themes/default/components/Page';
import Header from './components/Header';
import Loading from '@/themes/default/components/Loading';
import EmptyMessage from '@/themes/default/components/EmptyMessage';
import StateMessage, { State } from '@/themes/default/components/StateMessage';
import CriticalError from '@/themes/default/components/CriticalError';
import Timeline from '@/themes/default/components/Timeline';
import Fragment from '@/components/Fragment';
import {
    MIN_ZOOM,
    MAX_ZOOM,
    FETCH_DELTA,
    TIMELINE_PERIOD_STORAGE_KEY,
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

import type Day from '@/utils/day';
import type { ComponentRef, Raw } from 'vue';
import type Period from '@/utils/period';
import type { DebouncedMethod } from 'lodash';
import type { Role } from '@/stores/api/roles';
import type { Session } from '@/stores/api/session';
import type { Filters } from './components/Filters';
import type {
    TechnicianEvent,
    TechnicianWithEvents,
} from '@/stores/api/technicians';
import type {
    TimelineItem,
    TimelineGroup,
    TimelineClickEvent,
} from '@/themes/default/components/Timeline';

type InstanceProperties = {
    nowTimer: ReturnType<typeof setInterval> | undefined,
    handleRangeChangedDebounced: (
        | DebouncedMethod<typeof TechniciansTimeline, 'handleRangeChanged'>
        | undefined
    ),
};

type Data = {
    technicians: TechnicianWithEvents[],
    isLoading: boolean,
    isFetched: boolean,
    hasCriticalError: boolean,
    centerDate: Raw<Day> | null,
    defaultPeriod: Raw<Period>,
    fetchPeriod: Raw<Period>,
    filters: Filters,
    now: Raw<DateTime>,
};

/** Page de listing des techniciens sous forme de timeline. */
const TechniciansTimeline = defineComponent({
    name: 'TechniciansTimeline',
    setup: (): InstanceProperties => ({
        handleRangeChangedDebounced: undefined,
        nowTimer: undefined,
    }),
    data(): Data {
        const urlFilters = getFiltersFromRoute(this.$route);

        // - Filtres par défaut.
        const filters: Filters = {
            search: [],
            role: null,
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
            technicians: [],
            isLoading: false,
            isFetched: false,
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

        hasTechnicians(): boolean {
            return this.technicians.length > 0;
        },

        hasFilteredTechnicians(): boolean {
            return this.filteredTechnicians.length > 0;
        },

        filteredTechnicians(): TechnicianWithEvents[] {
            const { technicians, filters } = this;
            const search = filters.search.filter(
                (term: string) => term.trim().length > 1,
            );

            return technicians.filter((technician: TechnicianWithEvents): boolean => {
                // - Recherche textuelle.
                if (search.length > 0) {
                    const isMatching = search.some((term: string) => (
                        stringIncludes(technician.first_name, term) ||
                        stringIncludes(technician.last_name, term) ||
                        stringIncludes(`${technician.first_name} ${technician.last_name}`, term) ||
                        stringIncludes(`${technician.last_name} ${technician.first_name}`, term) ||
                        (
                            technician.nickname !== null &&
                            stringIncludes(technician.nickname, term)
                        ) ||
                        (
                            technician.email !== null &&
                            stringIncludes(technician.email, term)
                        )
                    ));
                    if (!isMatching) {
                        return false;
                    }
                }

                // - Rôle
                if (filters.role !== null) {
                    const hasRole = technician.roles.some(
                        (role: Role) => role.id === filters.role!,
                    );
                    if (!hasRole) {
                        return false;
                    }
                }

                return true;
            });
        },

        timelineGroups(): TimelineGroup[] {
            return this.filteredTechnicians.map((technician: TechnicianWithEvents) => (
                { id: technician.id, name: technician.full_name }
            ));
        },

        timelineItems(): TimelineItem[] {
            const { $t: __, now, technicians } = this;

            const formatter = assignmentFormatterFactory(__, now);
            return technicians.flatMap((technician: TechnicianWithEvents) => (
                technician.events.map((assignment: TechnicianEvent) => (
                    formatter(technician, assignment)
                ))
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
        this.handleRangeChangedDebounced = debounce(
            this.handleRangeChanged.bind(this),
            DEBOUNCE_WAIT_DURATION.asMilliseconds(),
        );
    },
    mounted() {
        // - Actualise le timestamp courant toutes les minutes.
        this.nowTimer = setInterval(() => { this.now = markRaw(DateTime.now()); }, 60_000);

        this.fetchData();
    },
    beforeDestroy() {
        this.handleRangeChangedDebounced?.cancel();

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
            this.fetchData();
        },

        handleChangeCenterDate(day: Raw<Day>) {
            this.centerDate = day;

            const $timeline = this.$refs.timeline as ComponentRef<typeof Timeline>;
            $timeline?.moveTo(day.toDateTime().set('hour', 12));
        },

        handleRangeChanged(newPeriod: Raw<Period>) {
            localStorage.setItem(TIMELINE_PERIOD_STORAGE_KEY, JSON.stringify(newPeriod));
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

            // - Rôle.
            if (this.filters.role !== newFilters.role) {
                this.filters.role = newFilters.role;
            }
        },

        //
        // - Handlers pour les items.
        //

        async handleItemDoubleClick(payload: TimelineClickEvent) {
            // - Si c'est un double-clic sur une partie vide (= sans assignation) du planning...
            //   => On ne fait rien.
            const identifier = payload.item?.id ?? null;
            if (identifier === null) {
                return;
            }

            // - Récupération de l'assignation.
            const assignment = this.technicians
                .flatMap((_technician: TechnicianWithEvents) => _technician.events)
                .find((_assignment: TechnicianEvent) => _assignment.id === identifier);
            if (assignment === undefined) {
                return;
            }

            let shouldRefetch = false;
            await showModal(this.$modal, EventDetails, {
                id: assignment.event_id,
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
                this.fetchData();
            }
        },

        // ------------------------------------------------------
        // -
        // -    Méthodes internes
        // -
        // ------------------------------------------------------

        async fetchData() {
            this.isLoading = true;

            try {
                this.technicians = await apiTechnicians.allWithAssignments({
                    period: this.fetchPeriod,
                    paginated: false,
                });
                this.isFetched = true;
            } catch (error) {
                if (error instanceof RequestError && error.httpCode === HttpCode.RangeNotSatisfiable) {
                    const $timeline = this.$refs.timeline as ComponentRef<typeof Timeline>;
                    $timeline?.zoomIn(1, false);
                    return;
                }

                // eslint-disable-next-line no-console
                console.error(`Error occurred while retrieving technicians:`, error);
                this.hasCriticalError = true;
            } finally {
                this.isLoading = false;
            }
        },

        __(key: string, params?: Record<string, number | string>, count?: number): string {
            if (!key.startsWith('global.')) {
                if (!key.startsWith('page.')) {
                    key = `page.sub-pages.timeline.${key}`;
                }
                key = key.replace(/^page\./, 'page.technicians.');
            } else {
                key = key.replace(/^global\./, '');
            }
            return this.$t(key, params, count);
        },
    },
    render() {
        const {
            __,
            filters,
            isFetched,
            isLoading,
            centerDate,
            defaultPeriod,
            hasTechnicians,
            hasCriticalError,
            hasFilteredTechnicians,
            timelineGroups,
            timelineItems,
            handleRefresh,
            handleFiltersChange,
            handleItemDoubleClick,
            handleChangeCenterDate,
            handleRangeChangedDebounced,
        } = this;

        if (hasCriticalError) {
            return (
                <Page
                    name="technicians-planning"
                    title={__('title')}
                    centered
                >
                    <CriticalError />
                </Page>
            );
        }

        const renderContent = (): JSX.Element => {
            if (!isFetched) {
                return <Loading />;
            }

            if (!hasTechnicians) {
                return (
                    <EmptyMessage
                        message={__('no-technicians')}
                        action={{
                            type: 'add',
                            icon: 'user-plus',
                            label: __('add-technician'),
                            target: { name: 'add-technician' },
                        }}
                    />
                );
            }

            if (!hasFilteredTechnicians) {
                return (
                    <StateMessage
                        type={State.NO_RESULT}
                        message={__('no-technicians-with-this-search')}
                    />
                );
            }

            return (
                <Fragment>
                    <Timeline
                        ref="timeline"
                        class="TechniciansPlanning__timeline"
                        defaultPeriod={defaultPeriod}
                        zoomMin={MIN_ZOOM}
                        zoomMax={MAX_ZOOM}
                        groups={timelineGroups}
                        items={timelineItems}
                        onDoubleClick={handleItemDoubleClick}
                        onRangeChanged={handleRangeChangedDebounced}
                    />
                </Fragment>
            );
        };

        return (
            <Page
                name="technicians-planning"
                title={__('title')}
                loading={isLoading}
            >
                <div class="TechniciansPlanning">
                    <Header
                        ref="header"
                        filters={filters}
                        centerDate={centerDate}
                        isLoading={isLoading}
                        onRefresh={handleRefresh}
                        onChangeCenterDate={handleChangeCenterDate}
                        onFiltersChange={handleFiltersChange}
                    />
                    <div class="TechniciansPlanning__content">
                        {renderContent()}
                    </div>
                </div>
            </Page>
        );
    },
});

export default TechniciansTimeline;
