import './index.scss';
import config from '@/globals/config';
import DateTime from '@/utils/datetime';
import { Direction } from '@/stores/api/@types';
import { defineComponent } from 'vue';
import showModal from '@/utils/showModal';
import apiBookings, { BookingEntity } from '@/stores/api/bookings';
import apiBeneficiaries from '@/stores/api/beneficiaries';
import Queue from 'p-queue';
import Loading from '@/themes/default/components/Loading';
import EventDetails from '@/themes/default/modals/EventDetails';
import Item from '../../../components/BookingsItem';

import type { PropType } from 'vue';
import type { Beneficiary } from '@/stores/api/beneficiaries';
import type { BookingExcerpt, BookingSummary } from '@/stores/api/bookings';
import type { LazyBooking } from '../../../_types';

type Props = {
    /** Identifiant du bénéficiaire. */
    id: Beneficiary['id'],
};

type InstanceProperties = {
    cancelOngoingFetch: (() => void) | undefined,
    fetchMissingMaterialsQueue: Queue | undefined,
};

type Data = {
    bookings: LazyBooking[],
    hasCriticalError: boolean,
    isPartiallyFetched: boolean,
    isFullyFetched: boolean,
};

/**
 * Nombre de requêtes maximum pour la récupération du matériel
 * manquant envoyées par seconde.
 */
export const MAX_FETCHES_PER_SECOND: number = 10;

/** Liste des emprunts en cours ou futurs d'un bénéficiaire. */
const BeneficiaryViewNextBookings = defineComponent({
    name: 'BeneficiaryViewNextBookings',
    props: {
        id: {
            type: Number as PropType<Props['id']>,
            required: true,
        },
    },
    setup: (): InstanceProperties => ({
        cancelOngoingFetch: undefined,
        fetchMissingMaterialsQueue: undefined,
    }),
    data: (): Data => ({
        bookings: [],
        hasCriticalError: false,
        isPartiallyFetched: false,
        isFullyFetched: false,
    }),
    created() {
        this.fetchMissingMaterialsQueue = new Queue({
            interval: DateTime.duration(1, 'second').asMilliseconds(),
            concurrency: config.maxConcurrentFetches,
            intervalCap: MAX_FETCHES_PER_SECOND,
        });
    },
    mounted() {
        this.fetchData();
    },
    beforeDestroy() {
        this.cancelOngoingFetch?.();
        this.fetchMissingMaterialsQueue?.clear();
    },
    methods: {
        // ------------------------------------------------------
        // -
        // -    Handlers
        // -
        // ------------------------------------------------------

        handleClickItem(entity: BookingEntity, id: BookingExcerpt['id']) {
            this.showModal(entity, id);
        },

        handleClickOpenItem(entity: BookingEntity, id: BookingExcerpt['id']) {
            this.showModal(entity, id);
        },

        // ------------------------------------------------------
        // -
        // -    Méthodes internes
        // -
        // ------------------------------------------------------

        async fetchData(forceRefresh: boolean = false) {
            const { id } = this;
            const now = DateTime.now();

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
                    const params = { page, direction: Direction.ASC, after: now };
                    const { data, pagination } = await apiBeneficiaries.bookings(id, params);
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
                        .filter((lazy: LazyBooking): lazy is LazyBooking<false> => !lazy.isComplete)
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
            hasCriticalError,
            isPartiallyFetched,
            isFullyFetched,
            handleClickItem,
            handleClickOpenItem,
        } = this;

        if (hasCriticalError) {
            return null;
        }

        const renderContent = (): JSX.Element => {
            if (!isPartiallyFetched && !isFullyFetched) {
                return <Loading horizontal />;
            }

            if (bookings.length === 0) {
                return (
                    <p class="BeneficiaryViewNextBookings__empty">
                        {__('page.beneficiary-view.infos.no-borrowing-planned')}
                    </p>
                );
            }

            return (
                <ul class="BeneficiaryViewNextBookings__list">
                    {bookings.map((lazy: LazyBooking) => (
                        <Item
                            key={`${lazy.booking.entity}-${lazy.booking.id}`}
                            lazyBooking={lazy}
                            onClick={handleClickItem}
                            onOpenClick={handleClickOpenItem}
                        />
                    ))}
                </ul>
            );
        };

        return (
            <div class="BeneficiaryViewNextBookings">
                <h3 class="BeneficiaryViewNextBookings__title">
                    {__('page.beneficiary-view.infos.next-borrowings-title')}
                </h3>
                {renderContent()}
            </div>
        );
    },
});

export default BeneficiaryViewNextBookings;
