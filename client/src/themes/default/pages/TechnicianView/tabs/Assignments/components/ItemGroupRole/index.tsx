import './index.scss';
import DateTime from '@/utils/datetime';
import { defineComponent, markRaw } from 'vue';
import Decimal from 'decimal.js';
import Button from '@/themes/default/components/Button';

import type { PropType, Raw } from 'vue';
import type { TechnicianEvent } from '@/stores/api/technicians';
import type { AssignmentGroupRole } from '../../_types';

type Props = {
    /** Le groupe d'assignations à afficher. */
    data: AssignmentGroupRole,

    /**
     * Fonction appelée lorsque l'utilisateur clique sur une assignation.
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
    isOpen: boolean,
};

/** Un groupe d'assignations de technicien (pour un rôle). */
const TechnicianViewAssignmentItemGroupRole = defineComponent({
    name: 'TechnicianViewAssignmentItemGroupRole',
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
        isOpen: false,
    }),
    computed: {
        hasOngoingAssignment(): boolean {
            return this.data.assignments.some(({ period }: TechnicianEvent) => (
                this.now.isBetween(period)
            ));
        },

        totalAssignmentsDuration(): Decimal {
            return this.data.assignments.reduce(
                (total: Decimal, { period }: TechnicianEvent) => (
                    period.asHours(true).add(total)
                ),
                new Decimal(0),
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

        handleToggle() {
            this.isOpen = !this.isOpen;
        },

        handleClick(id: TechnicianEvent['id']) {
            this.$emit('click', id);
        },

        handleOpenClick(e: MouseEvent, id: TechnicianEvent['id']) {
            e.stopPropagation();

            this.$emit('openClick', id);
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
            totalAssignmentsDuration,
            hasOngoingAssignment,
            isOpen,
            handleToggle,
            handleClick,
            handleOpenClick,
        } = this;

        const classnames = ['TechnicianViewAssignmentItemGroupRole', {
            'TechnicianViewAssignmentItemGroupRole--opened': isOpen,
            'TechnicianViewAssignmentItemGroupRole--ongoing': hasOngoingAssignment,
        }];

        return (
            <li class={classnames}>
                <div class="TechnicianViewAssignmentItemGroupRole__event">
                    <div class="TechnicianViewAssignmentItemGroupRole__event__toggle">
                        <Button
                            icon={isOpen ? 'caret-down' : 'caret-right'}
                            onClick={handleToggle}
                        />
                    </div>
                    <div class="TechnicianViewAssignmentItemGroupRole__event__infos">
                        <h3 class="TechnicianViewAssignmentItemGroupRole__event__title">
                            {data.role?.name ?? __('no-specific-role')}
                        </h3>
                    </div>
                    <div class="TechnicianViewAssignmentItemGroupRole__event__assignments-count">
                        {__('assignments-count', { count: data.assignments.length }, data.assignments.length)}
                        {' '}({__('global.hours-count', { count: totalAssignmentsDuration.toString() })})
                        {hasOngoingAssignment && (
                            <span class="TechnicianViewAssignmentItemGroupRole__event__assignments-count-ongoing">
                                ({__('including-ongoing')})
                            </span>
                        )}
                    </div>
                </div>
                {isOpen && (
                    <div class="TechnicianViewAssignmentItemGroupRole__assignments">
                        <div class="TechnicianViewAssignmentItemGroupRole__heading">
                            <div class="TechnicianViewAssignmentItemGroupRole__heading__event-title">
                                {__('global.event')}
                            </div>
                            <div class="TechnicianViewAssignmentItemGroupRole__heading__period">
                                {__('assignment-period')}
                            </div>
                        </div>
                        <ul class="TechnicianViewAssignmentItemGroupRole__list">
                            {data.assignments.map(({ id, event, period }: TechnicianEvent) => (
                                <li
                                    key={`assignment-${id}`}
                                    role="button"
                                    class={['TechnicianViewAssignmentItemGroupRole__assignment', {
                                        'TechnicianViewAssignmentItemGroupRole__assignment--ongoing': this.now.isBetween(period),
                                    }]}
                                    onClick={() => { handleClick(id); }}
                                >
                                    <div class="TechnicianViewAssignmentItemGroupRole__assignment__event-title">
                                        {event.title}
                                    </div>
                                    <div class="TechnicianViewAssignmentItemGroupRole__assignment__period">
                                        {period.toReadable(this.$t)}
                                        {' '}({__('global.hours-count', { count: period.asHours(true).toString() })})
                                        {this.now.isBetween(period) && (
                                            <span class="TechnicianViewAssignmentItemGroupRole__assignment__ongoing">
                                                {__('currently-mobilized')}
                                            </span>
                                        )}
                                    </div>
                                    <div class="TechnicianViewAssignmentItemGroupRole__assignment__actions">
                                        <Button
                                            icon="eye"
                                            onClick={(e: MouseEvent) => { handleOpenClick(e, id); }}
                                        />
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

export default TechnicianViewAssignmentItemGroupRole;
