import './index.scss';
import upperFirst from 'lodash/upperFirst';
import { defineComponent } from 'vue';
import Button from '@/themes/default/components/Button';

import type { PropType } from 'vue';
import type { EventSummary } from '@/stores/api/events';

type Props = {
    /** L'événement à afficher. */
    event: EventSummary,

    /**
     * Fonction appelée lorsque le résultat est choisi par l'utilisateur.
     *
     * @param id - L'id de l'événement choisi.
     */
    onSelect?(id: EventSummary['id']): void,
};

/** Un résultat de recherche d'événement. */
const ImportFromEventSearchResult = defineComponent({
    name: 'ImportFromEventSearchResult',
    props: {
        event: {
            type: Object as PropType<Required<Props>['event']>,
            required: true,
        },
        // eslint-disable-next-line vue/no-unused-properties
        onSelect: {
            type: Function as PropType<Props['onSelect']>,
            default: undefined,
        },
    },
    emits: ['select'],
    methods: {
        handleSelect() {
            const { id } = this.event;
            this.$emit('select', id);
        },
    },
    render() {
        const { $t: __, event, handleSelect } = this;

        return (
            <li class="ImportFromEventSearchResult">
                <span class="ImportFromEventSearchResult__main">
                    <span class="ImportFromEventSearchResult__title">
                        {event.title}
                    </span>
                    {(event.location ?? '').length > 0 && (
                        <span class="ImportFromEventSearchResult__location">
                            ({event.location})
                        </span>
                    )}
                </span>
                <span class="ImportFromEventSearchResult__dates">
                    {upperFirst(event.operation_period.toReadable(__))}
                </span>
                <Button
                    type="primary"
                    class="ImportFromEventSearchResult__select"
                    onClick={handleSelect}
                >
                    {__('choose')}
                </Button>
            </li>
        );
    },
});

export default ImportFromEventSearchResult;
