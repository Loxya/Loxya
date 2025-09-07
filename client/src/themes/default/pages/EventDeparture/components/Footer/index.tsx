import './index.scss';
import { defineComponent } from 'vue';
import Button from '@/themes/default/components/Button';

import type { PropType } from 'vue';
import type { EventDetails } from '@/stores/api/events';

type Props = {
    /** L'événement dont on veut obtenir le footer d'inventaire de départ. */
    event: EventDetails,

    /** Indique si l'inventaire de départ peut-être "terminé" ou non. */
    canTerminate: boolean,

    /** L'inventaire de départ est-il en cours de sauvegarde ? */
    isSaving?: boolean,

    /**
     * Fonction appelée lorsque l'utilisateur souhaite sauvegarder l'inventaire.
     */
    onSave?(): void,

    /**
     * Fonction appelée lorsque l'utilisateur souhaite terminer l'inventaire.
     */
    onTerminate?(): void,
};

/** Footer de la page d'inventaire de départ d'événement. */
const EventDepartureFooter = defineComponent({
    name: 'EventDepartureFooter',
    props: {
        event: {
            type: Object as PropType<Required<Props>['event']>,
            required: true,
        },
        canTerminate: {
            type: Boolean as PropType<Props['canTerminate']>,
            required: true,
        },
        isSaving: {
            type: Boolean as PropType<Required<Props>['isSaving']>,
            default: false,
        },
        // eslint-disable-next-line vue/no-unused-properties
        onSave: {
            type: Function as PropType<Props['onSave']>,
            default: undefined,
        },
        // eslint-disable-next-line vue/no-unused-properties
        onTerminate: {
            type: Function as PropType<Props['onTerminate']>,
            default: undefined,
        },
    },
    emits: ['save', 'terminate'],
    computed: {
        isEditable(): boolean {
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

        handleClickSave() {
            this.$emit('save');
        },

        handleClickTerminate() {
            if (!this.canTerminate) {
                return;
            }
            this.$emit('terminate');
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
        const {
            __,
            isSaving,
            isEditable,
            canTerminate,
            handleClickSave,
            handleClickTerminate,
        } = this;

        return (
            <div class="EventDepartureFooter">
                <Button
                    icon="save"
                    type={!canTerminate ? 'primary' : 'default'}
                    class="EventDepartureFooter__action"
                    onClick={handleClickSave}
                    disabled={isSaving}
                    loading={isSaving}
                >
                    {isSaving ? __('global.saving') : __('global.save-draft')}
                </Button>
                <Button
                    icon="check"
                    type="primary"
                    class="EventDepartureFooter__action"
                    onClick={handleClickTerminate}
                    tooltip={(
                        !canTerminate
                            ? (
                                isEditable
                                    ? __('incomplete-inventory-editable-help')
                                    : __('incomplete-inventory-help')
                            )
                            : undefined
                    )}
                    disabled={isSaving || !canTerminate}
                    loading={isSaving}
                >
                    {isSaving ? __('global.saving') : __('global.terminate-inventory')}
                </Button>
            </div>
        );
    },
});

export default EventDepartureFooter;
