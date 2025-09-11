import './index.scss';
import config from '@/globals/config';
import throttle from 'lodash/throttle';
import { defineComponent } from 'vue';
import { DEBOUNCE_WAIT_DURATION } from '@/globals/constants';
import { Group } from '@/stores/api/groups';
import apiEvents from '@/stores/api/events';
import Notepad from '@/themes/default/components/Notepad';
import Button from '@/themes/default/components/Button';

import type { PropType } from 'vue';
import type { EventDetails, EventTechnician } from '@/stores/api/events';
import type { DebouncedMethod } from 'lodash';
import type { Session } from '@/stores/api/session';

/**
 * Nombre d'essai de sauvegarde au-delà duquel:
 * - Une erreur est affichée à l'utilisateur.
 * - Le système ne re-tente plus de sauvegarder.
 * - La sauvegarde passe en mode manuel.
 */
const MAX_AUTOMATIC_SAVE_ATTEMPTS: number = 2;

type Props = {
    /** L'événement dont on souhaite afficher l'onglet des notes. */
    event: EventDetails,

    /**
     * Fonction appelée lorsque l'événement a été mise à jour
     * après que la note ai été modifiée.
     *
     * @param event - L'événement, mise à jour.
     */
    onUpdated?(event: EventDetails): void,
};

enum SaveMode {
    AUTOMATIC = 'automatic',
    MANUAL = 'manual',
}

type InstanceProperties = {
    throttledSave: (
        | DebouncedMethod<typeof EventDetailsNote, 'save'>
        | undefined
    ),
};

type Data = {
    value: string,
    isSaving: boolean,
    shouldReSave: boolean,
    saveRetryAttempts: number,
    saveMode: SaveMode,
};

// @vue/component
const EventDetailsNote = defineComponent({
    name: 'EventDetailsNote',
    props: {
        event: {
            type: Object as PropType<Required<Props>['event']>,
            required: true,
        },
        // eslint-disable-next-line vue/no-unused-properties
        onUpdated: {
            type: Function as PropType<Props['onUpdated']>,
            default: undefined,
        },
    },
    emits: ['updated'],
    setup: (): InstanceProperties => ({
        throttledSave: undefined,
    }),
    data(): Data {
        return {
            value: this.event.note ?? '',
            saveMode: SaveMode.AUTOMATIC,
            saveRetryAttempts: 0,
            shouldReSave: false,
            isSaving: false,
        };
    },
    computed: {
        isTeamMember(): boolean {
            return this.$store.getters['auth/is']([
                Group.ADMINISTRATION,
                Group.SUPERVISION,
                Group.OPERATION,
            ]);
        },

        isTechniciansEnabled(): boolean {
            return config.features.technicians;
        },

        readOnly(): boolean {
            if (this.isTeamMember) {
                return false;
            }

            // - Pour donner accès à la modification des notes à un utilisateur
            //   non-membre de l'équipe, on vérifie qu'il est chef de projet...
            const currentUser: Session = this.$store.state.auth.user;
            if (this.event.manager?.id === currentUser.id) {
                return false;
            }

            if (this.isTechniciansEnabled) {
                // - ... ou qu'il fait partie des techniciens assignés à l'événement.
                return !(this.event.technicians ?? []).some(
                    (eventTechnician: EventTechnician) => (
                        currentUser.id === eventTechnician.technician.user_id
                    ),
                );
            }

            return true;
        },
    },
    created() {
        this.throttledSave = throttle(
            this.save.bind(this),
            DEBOUNCE_WAIT_DURATION.asMilliseconds(),
            { leading: false },
        );
    },
    beforeDestroy() {
        this.throttledSave?.flush();
    },
    methods: {
        // ------------------------------------------------------
        // -
        // -    Handlers
        // -
        // ------------------------------------------------------

        handleInput(newValue: string) {
            this.value = newValue;

            if (this.saveMode === SaveMode.AUTOMATIC) {
                this.throttledSave!();
            }
        },

        handleChange(newValue: string) {
            if (this.value === newValue) {
                return;
            }
            this.value = newValue;

            if (this.saveMode === SaveMode.AUTOMATIC) {
                this.throttledSave!.cancel();
                this.save();
            }
        },

        handleSubmit(e: SubmitEvent) {
            e.preventDefault();

            this.throttledSave!.cancel();
            this.save();
        },

        // ------------------------------------------------------
        // -
        // -    Internal methods
        // -
        // ------------------------------------------------------

        async save() {
            if (this.isSaving) {
                this.shouldReSave = true;
                return;
            }

            const { $t: __, event, value: note } = this;
            this.shouldReSave = false;
            this.isSaving = true;

            try {
                const updatedEvent = await apiEvents.updateNote(event.id, note);

                this.saveRetryAttempts = 0;
                this.$emit('updated', updatedEvent);
            } catch {
                if (this.saveMode === SaveMode.MANUAL || this.saveRetryAttempts >= MAX_AUTOMATIC_SAVE_ATTEMPTS) {
                    this.$toasted.error(__('errors.unexpected-while-saving'));
                    this.saveRetryAttempts = 0;
                    this.saveMode = SaveMode.MANUAL;
                } else if (!this.shouldReSave) {
                    this.saveRetryAttempts += 1;
                    this.shouldReSave = true;
                }
            } finally {
                this.isSaving = false;

                if (this.shouldReSave) {
                    this.save();
                }
            }
        },
    },
    render() {
        const {
            $t: __,
            value,
            isSaving,
            readOnly,
            saveMode,
            handleChange,
            handleInput,
            handleSubmit,
        } = this;

        return (
            <form class="EventDetailsNote" onSubmit={handleSubmit}>
                <div class="EventDetailsNote__body">
                    <Notepad
                        value={value}
                        onInput={handleInput}
                        onChange={handleChange}
                        disabled={readOnly}
                    />
                </div>
                {saveMode === SaveMode.MANUAL && (
                    <div class="EventDetailsNote__footer">
                        <Button type="primary" htmlType="submit" loading={isSaving}>
                            {isSaving ? __('saving') : __('manually-save')}
                        </Button>
                    </div>
                )}
            </form>
        );
    },
});

export default EventDetailsNote;
