import './index.scss';
import Fragment from '@/components/Fragment';
import { defineComponent } from 'vue';
import Alert from '@/themes/default/components/Alert';
import Summary from './Summary';

import type { PropType } from 'vue';
import type { SourceMaterial } from '../../../_types';
import type { EventDetails, EventMaterial } from '@/stores/api/events';

type Props = {
    /** L'événement sélectionné. */
    event: EventDetails,

    /**
     * La liste du matériel disponible au moment de l'import, avec
     * les informations de surcharge, si disponible.
     */
    allMaterials: SourceMaterial[],

    /** Doit-on afficher les informations liées à la facturation ? */
    withBilling: boolean,
};

const ImportFromEventSelected = defineComponent({
    name: 'ImportFromEventSelected',
    props: {
        event: {
            type: Object as PropType<Required<Props>['event']>,
            required: true,
        },
        allMaterials: {
            type: Array as PropType<Props['allMaterials']>,
            required: true,
        },
        withBilling: {
            type: Boolean as PropType<Required<Props>['withBilling']>,
            required: true,
        },
    },
    computed: {
        isEmpty(): boolean {
            const { allMaterials, event } = this;

            if (event.materials.length === 0) {
                return true;
            }

            return !event.materials.some(({ id }: EventMaterial) => {
                const material = allMaterials.find(({ id: _id }: SourceMaterial) => _id === id);
                return material !== undefined && !material.is_deleted;
            });
        },
    },
    methods: {
        __(key: string, params?: Record<string, number | string>, count?: number): string {
            key = !key.startsWith('global.')
                ? `components.MaterialsSelector.modals.import-from-event.${key}`
                : key.replace(/^global\./, '');

            return this.$t(key, params, count);
        },
    },
    render() {
        const { title, description } = this.event;
        const {
            __,
            event,
            isEmpty,
            allMaterials,
            withBilling,
        } = this;

        return (
            <div class="ImportFromEventSelected">
                <h3 class="ImportFromEventSelected__title">
                    {__('event-details', { name: title })}
                </h3>
                {(description ?? '').length > 0 && (
                    <p class="ImportFromEventSelected__description">
                        {description}
                    </p>
                )}
                {isEmpty && (
                    <Alert type="warning">
                        {__('event-is-empty')}
                    </Alert>
                )}
                {!isEmpty && (
                    <Fragment>
                        <div class="ImportFromEventSelected__summary">
                            <Summary
                                event={event}
                                allMaterials={allMaterials}
                                withBilling={withBilling}
                            />
                        </div>
                        <Alert type="warning">
                            {__('reuse-list-from-event-warning')}
                        </Alert>
                    </Fragment>
                )}
            </div>
        );
    },
});

export default ImportFromEventSelected;
