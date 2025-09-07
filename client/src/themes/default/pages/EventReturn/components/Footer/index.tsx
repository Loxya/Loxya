import './index.scss';
import { defineComponent } from 'vue';
import IconMessage from '@/themes/default/components/IconMessage';
import Button from '@/themes/default/components/Button';

import type { PropType } from 'vue';
import type { EventDetails } from '@/stores/api/events';

type Props = {
    /** L'événement dont on veut obtenir le footer d'inventaire de retour. */
    event: EventDetails,

    /** Indique si l'inventaire de retour peut-être "terminé" ou non. */
    canTerminate: boolean,

    /** L'inventaire de retour est-il en cours de sauvegarde ? */
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

/** Footer de la page d'inventaire de retour d'événement. */
const EventReturnFooter = defineComponent({
    name: 'EventReturnFooter',
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
        hasStarted(): boolean {
            return !!this.event.is_return_inventory_started;
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
                ? `page.event-return.${key}`
                : key.replace(/^global\./, '');

            return this.$t(key, params, count);
        },
    },
    render() {
        const {
            __,
            isSaving,
            hasStarted,
            canTerminate,
            handleClickSave,
            handleClickTerminate,
        } = this;

        return (
            <div class="EventReturnFooter">
                <div class="EventReturnFooter__actions">
                    <Button
                        icon="save"
                        type="primary"
                        class="EventReturnFooter__action"
                        onClick={handleClickSave}
                        disabled={isSaving}
                        loading={isSaving}
                    >
                        {isSaving ? __('global.saving') : __('global.save-draft')}
                    </Button>
                    {canTerminate && (
                        <Button
                            icon="check"
                            class="EventReturnFooter__action"
                            onClick={handleClickTerminate}
                            disabled={isSaving}
                            loading={isSaving}
                        >
                            {isSaving ? __('global.saving') : __('global.terminate-inventory')}
                        </Button>
                    )}
                </div>
                {(!canTerminate || !hasStarted) && (
                    <div class="EventReturnFooter__warnings">
                        {!canTerminate && (
                            <IconMessage
                                name="exclamation-triangle"
                                message={__('alerts.not-finished-yet')}
                                class="EventReturnFooter__warnings__item"
                            />
                        )}
                        {!hasStarted && (
                            <IconMessage
                                name="exclamation-triangle"
                                message={__('alerts.not-saved-yet')}
                                class="EventReturnFooter__warnings__item"
                            />
                        )}
                    </div>
                )}
            </div>
        );
    },
});

export default EventReturnFooter;
