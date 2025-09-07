import './index.scss';
import invariant from 'invariant';
import { defineComponent } from 'vue';
import { Group } from '@/stores/api/groups';
import apiEvents from '@/stores/api/events';
import Fragment from '@/components/Fragment';
import Icon from '@/themes/default/components/Icon';
import Button from '@/themes/default/components/Button';
import Estimate from './components/Estimate';

import type { PropType } from 'vue';
import type { EventDetails } from '@/stores/api/events';
import type { Estimate as EstimateType } from '@/stores/api/estimates';

type Props = {
    /** L'événement dont on souhaite gérer les devis. */
    event: EventDetails<true>,

    /**
     * Fonction appelée lorsqu'un devis a été créé.
     *
     * @param estimate - Le devis nouvellement créé.
     */
    onCreated?(estimate: EstimateType): void,

    /**
     * Fonction appelée lorsqu'un devis a été supprimé.
     *
     * @param id - Identifiant du devis supprimé.
     */
    onDeleted?(id: EstimateType['id']): void,
};

type Data = {
    isCreating: boolean,
};

/** L'onglet "Devis" de la modale de détails d'un événement. */
const EventDetailsEstimates = defineComponent({
    name: 'EventDetailsEstimates',
    props: {
        event: {
            type: Object as PropType<Required<Props>['event']>,
            required: true,
            validator: (event: EventDetails) => (
                event.is_billable &&
                event.materials.length > 0
            ),
        },
        // eslint-disable-next-line vue/no-unused-properties
        onCreated: {
            type: Function as PropType<Props['onCreated']>,
            default: undefined,
        },
        // eslint-disable-next-line vue/no-unused-properties
        onDeleted: {
            type: Function as PropType<Props['onDeleted']>,
            default: undefined,
        },
    },
    emits: ['created', 'deleted'],
    data: (): Data => ({
        isCreating: false,
    }),
    computed: {
        isBillable(): boolean {
            return (
                this.event.is_billable &&
                this.event.materials.length > 0
            );
        },

        hasBeneficiary(): boolean {
            return this.event.beneficiaries.length > 0;
        },

        hasEstimate(): boolean {
            return (this.event.estimates ?? []).length > 0;
        },

        userCanEdit(): boolean {
            return this.$store.getters['auth/is']([
                Group.ADMINISTRATION,
                Group.SUPERVISION,
                Group.OPERATION,
            ]);
        },
    },
    created() {
        invariant(
            this.isBillable,
            `A non billable event has been passed to <EventDetailsEstimates />`,
        );
    },
    methods: {
        // ------------------------------------------------------
        // -
        // -    Handlers
        // -
        // ------------------------------------------------------

        async handleCreate() {
            if (this.isCreating) {
                return;
            }

            this.isCreating = true;
            const { __, event: { id } } = this;

            try {
                const estimate = await apiEvents.createEstimate(id);

                this.$emit('created', estimate);
                this.$toasted.success(__('estimate-created'));
            } catch {
                this.$toasted.error(__('error-while-generating'));
            } finally {
                this.isCreating = false;
            }
        },

        handleDeleted(id: EstimateType['id']) {
            this.$emit('deleted', id);
        },

        // ------------------------------------------------------
        // -
        // -    Méthodes internes
        // -
        // ------------------------------------------------------

        __(key: string, params?: Record<string, number | string>, count?: number): string {
            key = !key.startsWith('global.')
                ? `modal.event-details.estimates.${key}`
                : key.replace(/^global\./, '');

            return this.$t(key, params, count);
        },
    },
    render() {
        const {
            __,
            event,
            isCreating,
            isBillable,
            hasEstimate,
            hasBeneficiary,
            userCanEdit,
            handleCreate,
            handleDeleted,
        } = this;

        if (!isBillable) {
            return null;
        }

        const renderContent = (): JSX.Element => {
            if (!hasEstimate) {
                if (!hasBeneficiary) {
                    return (
                        <div class="EventDetailsEstimates__not-billable">
                            <h3 class="EventDetailsEstimates__not-billable__title">
                                <Icon name="exclamation-triangle" /> {__('global.missing-beneficiary')}
                            </h3>
                            <p class="EventDetailsEstimates__not-billable__text">
                                {__('no-beneficiary-billable-help')}
                            </p>
                        </div>
                    );
                }

                return (
                    <div class="EventDetailsEstimates__no-estimate">
                        <p class="EventDetailsEstimates__no-estimate__text">
                            {__('no-estimate-help')}
                        </p>
                        <p class="EventDetailsEstimates__no-estimate__text">
                            {
                                userCanEdit
                                    ? __('create-estimate-help')
                                    : __('contact-someone-to-create-estimate')
                            }
                        </p>
                        {userCanEdit && (
                            <Button type="add" onClick={handleCreate} loading={isCreating}>
                                {__('create-estimate')}
                            </Button>
                        )}
                    </div>
                );
            }

            return (
                <Fragment>
                    <ul class="EventDetailsEstimates__list">
                        {event.estimates!.map((estimate: EstimateType, index: number) => (
                            <li key={estimate.id} class="EventDetailsEstimates__list__item">
                                <Estimate
                                    key={estimate.id}
                                    estimate={estimate}
                                    outdated={index > 0}
                                    onDeleted={handleDeleted}
                                />
                            </li>
                        ))}
                    </ul>
                    {(hasBeneficiary && userCanEdit) && (
                        <div class="EventDetailsEstimates__create-new">
                            <p class="EventDetailsEstimates__create-new__text">
                                {__('create-new-help')}
                            </p>
                            <Button
                                type="add"
                                class="EventDetailsEstimates__create-new__button"
                                loading={isCreating}
                                onClick={handleCreate}
                            >
                                {__('create-new-estimate')}
                            </Button>
                        </div>
                    )}
                </Fragment>
            );
        };

        return (
            <section class="EventDetailsEstimates">
                {renderContent()}
            </section>
        );
    },
});

export default EventDetailsEstimates;
