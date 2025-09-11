import { defineComponent } from 'vue';
import { DateTimeReadableFormat } from '@/utils/datetime';
import StateMessage, { State } from '@/themes/default/components/StateMessage';

import type DateTime from '@/utils/datetime';
import type { PropType } from 'vue';
import type { EventDetails } from '@/stores/api/events';
import type { Action } from '@/themes/default/components/StateMessage';

export enum UnavailabilityReason {
    TOO_SOON = 'too-soon',
    TOO_LATE = 'too-late',
    ARCHIVED = 'archived',
    NO_MATERIALS = 'no-materials',
    MATERIAL_SHORTAGE = 'material-shortage',
}

const REASONS_STATE = {
    [UnavailabilityReason.TOO_SOON]: State.TOO_SOON,
    [UnavailabilityReason.TOO_LATE]: State.TOO_LATE,
    [UnavailabilityReason.ARCHIVED]: State.LOCKED,
    [UnavailabilityReason.NO_MATERIALS]: State.EMPTY,
    [UnavailabilityReason.MATERIAL_SHORTAGE]: State.EMPTY,
} as const;

type Props = {
    /** L'événement concerné par l'inventaire de départ. */
    event: EventDetails,

    /**
     * La raison pour laquelle l'inventaire de départ est indisponible.
     *
     * Voir {@see {@link UnavailabilityReason}}
     */
    reason: UnavailabilityReason,

    /**
     * Un objet contenant des éventuelles variable à
     * utiliser dans le message lié à la raison.
     */
    variables?: AnyLiteralObject,

    /**
     * Fonction appelée lorsque l'utilisateur demande
     * à acceder à l'édition du matériel de l'événement.
     */
    onUpdateMaterialClick?(): void,
};

const EventDepartureUnavailable = defineComponent({
    name: 'EventDepartureUnavailable',
    props: {
        event: {
            type: Object as PropType<Required<Props>['event']>,
            required: true,
        },
        reason: {
            type: String as PropType<Required<Props>['reason']>,
            required: true,
        },
        variables: {
            type: Object as PropType<Required<Props>['variables']>,
            default: () => ({}),
        },
        // eslint-disable-next-line vue/no-unused-properties
        onUpdateMaterialClick: {
            type: Function as PropType<Props['onUpdateMaterialClick']>,
            default: undefined,
        },
    },
    emits: ['updateMaterialClick'],
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
        // -    Handlers
        // -
        // ------------------------------------------------------

        handleUpdateMaterialClick() {
            this.$emit('updateMaterialClick');
        },

        // ------------------------------------------------------
        // -
        // -    Méthodes internes
        // -
        // ------------------------------------------------------

        __(key: string, params?: Record<string, number | string>, count?: number): string {
            key = !key.startsWith('global.')
                ? `page.event-departure.${key}`
                : key.replace(/^global\./, '');

            return this.$t(key, params, count);
        },
    },
    render() {
        const { __, isMaterialEditable, reason, variables, handleUpdateMaterialClick } = this;
        const state = REASONS_STATE[reason];

        const renderMessage = (): string => {
            if (reason === UnavailabilityReason.ARCHIVED) {
                return __('unavailabilities.archived');
            }
            if (reason === UnavailabilityReason.TOO_SOON) {
                if (variables.inventoryPeriodStart) {
                    const date: DateTime = variables.inventoryPeriodStart;
                    return __('unavailabilities.inventory-period-not-started-details', {
                        date: date.toReadable(DateTimeReadableFormat.MEDIUM),
                    });
                }
                return __('unavailabilities.inventory-period-not-started');
            }
            if (reason === UnavailabilityReason.TOO_LATE) {
                return __('unavailabilities.inventory-period-past');
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
            const materialShortageStatuses = [
                UnavailabilityReason.NO_MATERIALS,
                UnavailabilityReason.MATERIAL_SHORTAGE,
            ];
            if (materialShortageStatuses.includes(reason) && isMaterialEditable) {
                return {
                    type: 'edit',
                    label: __('actions.update-materials'),
                    onClick: handleUpdateMaterialClick,
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

export default EventDepartureUnavailable;
