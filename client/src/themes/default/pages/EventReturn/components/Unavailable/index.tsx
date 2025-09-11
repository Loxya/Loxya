import { defineComponent } from 'vue';
import StateMessage, { State } from '@/themes/default/components/StateMessage';

import type { PropType } from 'vue';
import type { EventDetails } from '@/stores/api/events';
import type { Action } from '@/themes/default/components/StateMessage';

export enum UnavailabilityReason {
    TOO_SOON = 'too-soon',
    ARCHIVED = 'archived',
    NO_MATERIALS = 'no-materials',
    MATERIAL_SHORTAGE = 'material-shortage',
}

const REASONS_STATE = {
    [UnavailabilityReason.TOO_SOON]: State.TOO_SOON,
    [UnavailabilityReason.ARCHIVED]: State.LOCKED,
    [UnavailabilityReason.NO_MATERIALS]: State.EMPTY,
    [UnavailabilityReason.MATERIAL_SHORTAGE]: State.EMPTY,
} as const;

type Props = {
    /** L'événement concerné par l'inventaire de retour. */
    event: EventDetails,

    /**
     * La raison pour laquelle l'inventaire de retour est indisponible.
     *
     * Voir {@see {@link UnavailabilityReason}}
     */
    reason: UnavailabilityReason,
};

const EventReturnUnavailable = defineComponent({
    name: 'EventReturnUnavailable',
    props: {
        event: {
            type: Object as PropType<Required<Props>['event']>,
            required: true,
        },
        reason: {
            type: String as PropType<Required<Props>['reason']>,
            required: true,
        },
    },
    computed: {
        isMaterialEditable(): boolean {
            const { event } = this;

            return (
                // - Un événement archivé n'est pas modifiable.
                !event.is_archived &&

                // - Un événement ne peut être modifié que si son inventaire de retour
                //   n'a pas été effectué (sans quoi celui-ci n'aurait plus aucun sens,
                //   d'autant que le stock global a pu être impacté suite à cet inventaire).
                !event.is_return_inventory_done
            );
        },
    },
    methods: {
        // ------------------------------------------------------
        // -
        // -    Méthodes internes
        // -
        // ------------------------------------------------------

        __(key: string, params?: Record<string, number | string>, count?: number): string {
            key = !key.startsWith('global.')
                ? `page.event-return.${key}`
                : key.replace(/^global\./, '');

            return this.$t(key, params, count);
        },
    },
    render() {
        const { __, event: { id }, isMaterialEditable, reason } = this;
        const state = REASONS_STATE[reason];

        const renderMessage = (): string => {
            if (reason === UnavailabilityReason.ARCHIVED) {
                return __('unavailabilities.archived');
            }
            if (reason === UnavailabilityReason.TOO_SOON) {
                return __('unavailabilities.event-not-started');
            }
            if (reason === UnavailabilityReason.NO_MATERIALS) {
                return __('unavailabilities.no-materials');
            }
            if (reason === UnavailabilityReason.MATERIAL_SHORTAGE) {
                return __('unavailabilities.material-shortage');
            }
            return __('unavailabilities.unknown');
        };

        const renderAction = (): Action => {
            if (reason === UnavailabilityReason.MATERIAL_SHORTAGE && isMaterialEditable) {
                return {
                    type: 'edit',
                    target: { name: 'edit-event', params: { id: id.toString() } },
                    label: __('actions.update-materials'),
                };
            }

            return {
                type: 'primary',
                icon: 'arrow-left',
                target: { name: 'schedule' },
                label: __('global.back-to-schedule'),
            };
        };

        return (
            <StateMessage
                type={state}
                message={renderMessage()}
                action={renderAction()}
            />
        );
    },
});

export default EventReturnUnavailable;
