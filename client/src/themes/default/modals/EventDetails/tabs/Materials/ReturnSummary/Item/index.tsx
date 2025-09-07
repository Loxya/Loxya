import './index.scss';
import { defineComponent } from 'vue';

import type { PropType } from 'vue';
import type { EventMaterialWithQuantityDetails } from '../_types';

type Props = {
    /** Le matériel problématique dont on veut afficher les détails. */
    data: EventMaterialWithQuantityDetails,
};

/**
 * Un matériel problématique dans la synthèse du retour dans
 * l'onglet "Materiel" de la fenêtre d'un événement.
 */
const EventDetailsReturnSummaryItem = defineComponent({
    name: 'EventDetailsReturnSummaryItem',
    props: {
        data: {
            type: Object as PropType<Required<Props>['data']>,
            required: true,
        },
    },
    render() {
        const { $t: __, data } = this;
        const { id, name, quantity: { out, returned, missing, broken } } = data;

        return (
            <tr class="EventDetailsReturnSummaryItem">
                <td
                    class={[
                        'EventDetailsReturnSummaryItem__col',
                        'EventDetailsReturnSummaryItem__col--name',
                        'EventDetailsReturnSummaryItem__name',
                    ]}
                >
                    <router-link
                        to={{ name: 'view-material', params: { id } }}
                        class="EventDetailsReturnSummaryItem__name__link"
                    >
                        {name}
                    </router-link>
                </td>
                <td
                    class={[
                        'EventDetailsReturnSummaryItem__col',
                        'EventDetailsReturnSummaryItem__col--missing',
                    ]}
                >
                    {missing > 0 && __(
                        'modal.event-details.materials.not-returned-material-count',
                        { out, returned, missing },
                        returned,
                    )}
                </td>
                <td
                    class={[
                        'EventDetailsReturnSummaryItem__col',
                        'EventDetailsReturnSummaryItem__col--broken',
                    ]}
                >
                    {broken > 0 && __(
                        'modal.event-details.materials.broken-material-count',
                        { broken },
                        broken,
                    )}
                </td>
            </tr>
        );
    },
});

export default EventDetailsReturnSummaryItem;
