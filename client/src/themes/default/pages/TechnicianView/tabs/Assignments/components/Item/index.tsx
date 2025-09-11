import './index.scss';
import DateTime from '@/utils/datetime';
import upperFirst from 'lodash/upperFirst';
import { defineComponent, markRaw } from 'vue';
import Button from '@/themes/default/components/Button';
import Icon from '@/themes/default/components/Icon';

import type { PropType, Raw } from 'vue';
import type { TechnicianEvent } from '@/stores/api/technicians';
import type Decimal from 'decimal.js';

type Props = {
    /** L'assignation de technicien à afficher. */
    assignment: TechnicianEvent,

    /**
     * Fonction appelée lorsque l'assignation a été cliquée.
     *
     * @param id - Identifiant de l'assignation cliquée.
     */
    onClick?(id: TechnicianEvent['id']): void,

    /**
     * Fonction appelée lorsque l'utilisateur demande l'ouverture
     * de la page de l'assignation.
     *
     * @param id - Identifiant de l'assignation à ouvrir.
     */
    onOpenClick?(id: TechnicianEvent['id']): void,
};

type InstanceProperties = {
    nowTimer: ReturnType<typeof setInterval> | undefined,
};

type Data = {
    now: Raw<DateTime>,
};

/** Une assignation de technicien sous forme d'une cellule "inline". */
const TechnicianViewAssignmentItem = defineComponent({
    name: 'TechnicianViewAssignmentItem',
    props: {
        assignment: {
            type: Object as PropType<Props['assignment']>,
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
        eventTitle(): string {
            const { title, location } = this.assignment.event;
            return !location ? title : `${title} (${location})`;
        },

        areEventPeriodsUnified(): boolean {
            const { event } = this.assignment;
            const {
                operation_period: operationPeriod,
                mobilization_period: mobilizationPeriod,
            } = event;

            return operationPeriod
                .setFullDays(false)
                .isSame(mobilizationPeriod);
        },

        eventDuration(): number {
            const { event } = this.assignment;
            return event.operation_period.asDays();
        },

        duration(): Decimal {
            const { period } = this.assignment;
            return period.asHours(true);
        },

        isPast(): boolean {
            const { period } = this.assignment;
            return period.isBefore(this.now);
        },

        isFuture(): boolean {
            const { period } = this.assignment;
            return !period.isBeforeOrDuring(this.now);
        },

        isOngoing(): boolean {
            const { period } = this.assignment;
            return this.now.isBetween(period);
        },

        readableState(): string {
            const { __, isOngoing, isPast, assignment } = this;

            if (isPast) {
                return __('done');
            }

            if (isOngoing) {
                return __('currently-mobilized');
            }

            return __('mobilized-starting-from', { date: assignment.period.start.toReadable() });
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
            this.$emit('click', this.assignment.id);
        },

        handleOpenClick(e: MouseEvent) {
            e.stopPropagation();

            this.$emit('openClick', this.assignment.id);
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
            eventTitle,
            assignment,
            duration,
            eventDuration,
            isFuture,
            isOngoing,
            areEventPeriodsUnified,
            readableState,
            handleClick,
            handleOpenClick,
        } = this;

        const className = ['TechnicianViewAssignmentItem', {
            'TechnicianViewAssignmentItem--future': isFuture,
            'TechnicianViewAssignmentItem--current': isOngoing,
        }];

        return (
            <li class={className} onClick={handleClick} role="button">
                <div class="TechnicianViewAssignmentItem__icon">
                    <Icon name="tools" />
                </div>
                <div class="TechnicianViewAssignmentItem__assignation-details">
                    <h3 class="TechnicianViewAssignmentItem__assignation-details__title">
                        {(
                            assignment.role !== null
                                ? __('assigned-to-role', { role: assignment.role.name })
                                : __('assigned-without-role')
                        )}
                    </h3>
                    <div class="TechnicianViewAssignmentItem__assignation-details__period">
                        {assignment.period.toReadable(this.$t)}
                        {' '}({__('global.hours-count', { count: duration.toString() })})
                    </div>
                </div>
                <div class="TechnicianViewAssignmentItem__event">
                    <div class="TechnicianViewAssignmentItem__event__infos">
                        <div class="TechnicianViewAssignmentItem__event__title">
                            {__('event-title', { title: eventTitle })}
                        </div>
                        <div class="TechnicianViewAssignmentItem__event__periods">
                            <span
                                class={[
                                    'TechnicianViewAssignmentItem__event__periods__item',
                                    'TechnicianViewAssignmentItem__event__periods__item--operation',
                                ]}
                            >
                                {upperFirst(assignment.event.operation_period.toReadable(this.$t))}
                                {eventDuration > 1 && (
                                    <span class="TechnicianViewAssignmentItem__event__periods__item__duration">
                                        ({__('global.days-count', { duration: eventDuration }, eventDuration)})
                                    </span>
                                )}
                            </span>
                            {!areEventPeriodsUnified && (
                                <span
                                    class={[
                                        'TechnicianViewAssignmentItem__event__periods__item',
                                        'TechnicianViewAssignmentItem__event__periods__item--mobilization',
                                    ]}
                                >
                                    {upperFirst(assignment.event.mobilization_period.toReadable(this.$t))}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
                <div class="TechnicianViewAssignmentItem__readable-state">
                    {readableState}
                </div>
                <div class="TechnicianViewAssignmentItem__actions">
                    <Button icon="eye" onClick={handleOpenClick} />
                </div>
            </li>
        );
    },
});

export default TechnicianViewAssignmentItem;
