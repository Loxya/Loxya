import './index.scss';
import omit from 'lodash/omit';
import { defineComponent } from 'vue';
import { Group } from '@/stores/api/groups';
import Button from '@/themes/default/components/Button';
import Item from './Item';

import type { PropType } from 'vue';
import type { EventDetails, EventMaterial } from '@/stores/api/events';
import type { EventMaterialWithQuantityDetails } from './_types';

type Props = {
    /** L'événement dont on souhaite afficher la synthèse du retour. */
    event: EventDetails,
};

/** Synthèse du retour dans l'onglet "Materiel" de la fenêtre d'un événement. */
const EventDetailsReturnSummary = defineComponent({
    name: 'EventDetailsReturnSummary',
    props: {
        event: {
            type: Object as PropType<Required<Props>['event']>,
            required: true,
        },
    },
    computed: {
        isTeamMember(): boolean {
            return this.$store.getters['auth/is']([
                Group.ADMINISTRATION,
                Group.SUPERVISION,
                Group.OPERATION,
            ]);
        },

        materialsWithProblem(): EventMaterialWithQuantityDetails[] {
            return this.event.materials
                .map((material: EventMaterial): EventMaterialWithQuantityDetails => ({
                    ...omit(material, ['quantity', 'quantity_returned', 'quantity_returned_broken']),
                    quantity: {
                        out: material.quantity,
                        returned: material.quantity_returned ?? 0,
                        missing: material.quantity - (material.quantity_returned ?? 0),
                        broken: material.quantity_returned_broken ?? 0,
                    },
                }))
                .filter(
                    ({ quantity }: EventMaterialWithQuantityDetails) => (
                        quantity.missing > 0 || quantity.broken > 0
                    ),
                );
        },

        hasProblems(): boolean {
            return this.materialsWithProblem.length > 0;
        },
    },
    render() {
        const { $t: __, event, isTeamMember, hasProblems, materialsWithProblem } = this;
        const { is_return_inventory_done: isReturnInventoryDone } = event;

        if (!isReturnInventoryDone) {
            return null;
        }

        const title = hasProblems
            ? __('modal.event-details.materials.problems-on-returned-materials')
            : __('modal.event-details.materials.all-material-returned');

        const classNames = ['EventDetailsReturnSummary', {
            'EventDetailsReturnSummary--has-problems': hasProblems,
            'EventDetailsReturnSummary--centered': !hasProblems && !isTeamMember,
        }];

        return (
            <div class={classNames}>
                <div class="EventDetailsReturnSummary__header">
                    <h3 class="EventDetailsReturnSummary__title">
                        {title}
                    </h3>
                    {isTeamMember && (
                        <Button
                            icon="tasks"
                            to={{
                                name: 'event-return-inventory',
                                params: { id: event.id.toString() },
                            }}
                        >
                            {__('modal.event-details.materials.view-return-inventory')}
                        </Button>
                    )}
                </div>
                {hasProblems && (
                    <table class="EventDetailsReturnSummary__list">
                        {materialsWithProblem.map((datum: EventMaterialWithQuantityDetails) => (
                            <Item key={datum.id} data={datum} />
                        ))}
                    </table>
                )}
            </div>
        );
    },
});

export default EventDetailsReturnSummary;
