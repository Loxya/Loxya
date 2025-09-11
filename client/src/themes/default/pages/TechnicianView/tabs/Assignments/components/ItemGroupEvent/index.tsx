import './index.scss';
import DateTime from '@/utils/datetime';
import upperFirst from 'lodash/upperFirst';
import { defineComponent, markRaw } from 'vue';
import Decimal from 'decimal.js';
import Button from '@/themes/default/components/Button';

import type { PropType, Raw } from 'vue';
import type { TechnicianEvent } from '@/stores/api/technicians';
import type { AssignmentGroupEvent } from '../../_types';

type Props = {
    /** Le groupe d'assignations à afficher. */
    data: AssignmentGroupEvent,

    /**
     * Fonction appelée lorsque l'utilisateur clique sur une assignation.
     *
     * @param id - Identifiant de l'assignation cliquée.
     */
    onClick?(id: TechnicianEvent['id']): void,

    /**
     * Fonction appelée lorsque l'utilisateur demande
     * l'ouverture de la page de l'événement.
     *
     * @param id - Identifiant de l'événement à ouvrir.
     */
    onOpenEventClick?(id: AssignmentGroupEvent['event']['id']): void,
};

type InstanceProperties = {
    nowTimer: ReturnType<typeof setInterval> | undefined,
};

type Data = {
    now: Raw<DateTime>,
    isOpen: boolean,
};

/** Un groupe d'assignations de technicien (pour un événement). */
const TechnicianViewAssignmentItemGroupEvent = defineComponent({
    name: 'TechnicianViewAssignmentItemGroupEvent',
    props: {
        data: {
            type: Object as PropType<Props['data']>,
            required: true,
        },
        // eslint-disable-next-line vue/no-unused-properties
        onClick: {
            type: Function as PropType<Props['onClick']>,
            default: undefined,
        },
        // eslint-disable-next-line vue/no-unused-properties
        onOpenEventClick: {
            type: Function as PropType<Props['onOpenEventClick']>,
            default: undefined,
        },
    },
    emits: ['click', 'openEventClick'],
    setup: (): InstanceProperties => ({
        nowTimer: undefined,
    }),
    data: (): Data => ({
        now: markRaw(DateTime.now()),
        isOpen: false,
    }),
    computed: {
        eventTitle(): string {
            const { title, location } = this.data.event;
            return !location ? title : `${title} (${location})`;
        },

        eventDuration(): number {
            const { event } = this.data;
            return event.operation_period.asDays();
        },

        totalAssignmentsDuration(): Decimal {
            return this.data.assignments.reduce(
                (total: Decimal, { period }: TechnicianEvent) => (
                    period.asHours(true).add(total)
                ),
                new Decimal(0),
            );
        },

        isPast(): boolean {
            const { mobilization_period: period } = this.data.event;
            return period.isBefore(this.now);
        },

        isFuture(): boolean {
            const { mobilization_period: period } = this.data.event;
            return !period.isBeforeOrDuring(this.now);
        },

        isOngoing(): boolean {
            const { mobilization_period: period } = this.data.event;
            return this.now.isBetween(period);
        },

        areEventPeriodsUnified(): boolean {
            const { event } = this.data;
            const {
                operation_period: operationPeriod,
                mobilization_period: mobilizationPeriod,
            } = event;

            return operationPeriod
                .setFullDays(false)
                .isSame(mobilizationPeriod);
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

        handleToggle() {
            this.isOpen = !this.isOpen;
        },

        handleClick(id: TechnicianEvent['id']) {
            this.$emit('click', id);
        },

        handleOpenEventClick(e: MouseEvent) {
            e.stopPropagation();

            this.$emit('openEventClick', this.data.event.id);
        },

        // ------------------------------------------------------
        // -
        // -    API Publique
        // -
        // ------------------------------------------------------

        /**
         * Fait défiler la liste de manière à faire apparaître l'assignation.
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

        // ------------------------------------------------------
        // -
        // -    Méthodes internes
        // -
        // ------------------------------------------------------

        __(key: string, params?: Record<string, number | string>, count?: number): string {
            key = !key.startsWith('global.')
                ? `page.technician-view.assignments.${key}`
                : key.replace(/^global\./, '');

            return this.$t(key, params, count);
        },
    },
    render() {
        const {
            __,
            data,
            isOpen,
            eventTitle,
            eventDuration,
            totalAssignmentsDuration,
            isFuture,
            isOngoing,
            areEventPeriodsUnified,
            handleToggle,
            handleClick,
            handleOpenEventClick,
        } = this;

        const className = ['TechnicianViewAssignmentItemGroupEvent', {
            'TechnicianViewAssignmentItemGroupEvent--opened': isOpen,
            'TechnicianViewAssignmentItemGroupEvent--future': isFuture,
            'TechnicianViewAssignmentItemGroupEvent--current': isOngoing,
        }];

        return (
            <li class={className}>
                <div class="TechnicianViewAssignmentItemGroupEvent__event">
                    <div class="TechnicianViewAssignmentItemGroupEvent__event__toggle">
                        <Button
                            icon={isOpen ? 'caret-down' : 'caret-right'}
                            onClick={handleToggle}
                        />
                    </div>
                    <div class="TechnicianViewAssignmentItemGroupEvent__event__infos">
                        <h3 class="TechnicianViewAssignmentItemGroupEvent__event__title">
                            {eventTitle}
                        </h3>
                        <div class="TechnicianViewAssignmentItemGroupEvent__event__periods">
                            <span
                                class={[
                                    'TechnicianViewAssignmentItemGroupEvent__event__periods__item',
                                    'TechnicianViewAssignmentItemGroupEvent__event__periods__item--operation',
                                ]}
                            >
                                {upperFirst(data.event.operation_period.toReadable(this.$t))}
                                {eventDuration > 1 && (
                                    <span class="TechnicianViewAssignmentItemGroupEvent__event__periods__item__duration">
                                        ({__('global.days-count', { duration: eventDuration }, eventDuration)})
                                    </span>
                                )}
                            </span>
                            {!areEventPeriodsUnified && (
                                <span
                                    class={[
                                        'TechnicianViewAssignmentItemGroupEvent__event__periods__item',
                                        'TechnicianViewAssignmentItemGroupEvent__event__periods__item--mobilization',
                                    ]}
                                >
                                    {upperFirst(data.event.mobilization_period.toReadable(this.$t))}
                                </span>
                            )}
                        </div>
                    </div>
                    <div class="TechnicianViewAssignmentItemGroupEvent__event__assignments-count">
                        {__('assignments-count', { count: data.assignments.length }, data.assignments.length)}
                        {' '}({__('global.hours-count', { count: totalAssignmentsDuration.toString() })})
                    </div>
                    <div class="TechnicianViewAssignmentItemGroupEvent__event__actions">
                        <Button icon="eye" onClick={handleOpenEventClick} />
                    </div>
                </div>
                {isOpen && (
                    <div class="TechnicianViewAssignmentItemGroupEvent__assignments">
                        <div class="TechnicianViewAssignmentItemGroupEvent__heading">
                            <div class="TechnicianViewAssignmentItemGroupEvent__heading__position">
                                {__('role')}
                            </div>
                            <div class="TechnicianViewAssignmentItemGroupEvent__heading__period">
                                {__('global.period')}
                            </div>
                        </div>
                        <ul class="TechnicianViewAssignmentItemGroupEvent__list">
                            {data.assignments.map(({ id, role, period }: TechnicianEvent) => (
                                <li
                                    key={`assignment-${id}`}
                                    role="button"
                                    class={['TechnicianViewAssignmentItemGroupEvent__assignment', {
                                        'TechnicianViewAssignmentItemGroupEvent__assignment--no-role': !role,
                                        'TechnicianViewAssignmentItemGroupEvent__assignment--ongoing': this.now.isBetween(period),
                                    }]}
                                    onClick={() => { handleClick(id); }}
                                >
                                    <div class="TechnicianViewAssignmentItemGroupEvent__assignment__position">
                                        {role?.name ?? __('no-specific-role')}
                                    </div>
                                    <div class="TechnicianViewAssignmentItemGroupEvent__assignment__period">
                                        {period.toReadable(this.$t)}
                                        {' '}({__('global.hours-count', { count: period.asHours(true).toString() })})
                                        {this.now.isBetween(period) && (
                                            <span class="TechnicianViewAssignmentItemGroupEvent__assignment__ongoing">
                                                {__('currently-mobilized')}
                                            </span>
                                        )}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </li>
        );
    },
});

export default TechnicianViewAssignmentItemGroupEvent;
