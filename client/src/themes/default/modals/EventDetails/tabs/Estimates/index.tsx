import './index.scss';
import invariant from 'invariant';
import { defineComponent } from 'vue';
import { Group } from '@/stores/api/groups';
import Fragment from '@/components/Fragment';
import Icon from '@/themes/default/components/Icon';
import Button from '@/themes/default/components/Button';
import Alert from '@/themes/default/components/Alert';
import Estimate from './components/Estimate';

// - Modales
import CreateEstimateModal from './modals/CreateEstimateModal';
import InvoiceDetailsModal from '@/themes/default/modals/InvoiceDetails';
import EstimateDetailsModal from '@/themes/default/modals/EstimateDetails';

import type { PropType } from 'vue';
import type { Location } from 'vue-router';
import type { Beneficiary } from '@/stores/api/beneficiaries';
import type { Estimate as EstimateType, EstimateDetails } from '@/stores/api/estimates';
import type { EventDetails } from '@/stores/api/events';

type Props = {
    /** L'événement dont on souhaite gérer les devis. */
    event: EventDetails<true>,

    /**
     * Fonction appelée lorsqu'un devis a été créé.
     *
     * @param estimate - Le devis nouvellement créé.
     */
    onCreated?(estimate: EstimateDetails): void,

    /**
     * Fonction appelée lorsqu'un devis a été mis à jour.
     *
     * @param estimate - Le devis mis à jour.
     */
    onUpdated?(estimate: EstimateDetails): void,

    /**
     * Fonction appelée lorsqu'un devis a été supprimé.
     *
     * @param id - Identifiant du devis supprimé.
     */
    onDeleted?(id: EstimateType['id']): void,

    /**
     * Fonction appelée lorsqu'un rechargement complet
     * des données est nécessaire.
     */
    onRefetchNeeded?(): void,
};

/** L'onglet "Devis" de la modale de détails d'un événement. */
const EventDetailsEstimates = defineComponent({
    name: 'EventDetailsEstimates',
    props: {
        event: {
            type: Object as PropType<Props['event']>,
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
        onUpdated: {
            type: Function as PropType<Props['onUpdated']>,
            default: undefined,
        },
        // eslint-disable-next-line vue/no-unused-properties
        onDeleted: {
            type: Function as PropType<Props['onDeleted']>,
            default: undefined,
        },
        // eslint-disable-next-line vue/no-unused-properties
        onRefetchNeeded: {
            type: Function as PropType<Props['onRefetchNeeded']>,
            default: undefined,
        },
    },
    emits: [
        'created',
        'updated',
        'deleted',
        'refetchNeeded',
    ],
    computed: {
        isBillable(): boolean {
            return (
                this.event.is_billable &&
                this.event.materials.length > 0
            );
        },

        mainBeneficiary(): Beneficiary | null {
            return [...this.event.beneficiaries].shift() ?? null;
        },

        hasEstimate(): boolean {
            return (this.event.estimates ?? []).length > 0;
        },

        hasBilledMaterials(): boolean {
            const { materials } = this.event;
            return materials.some((material) => (
                !material.unit_price.isZero() ||
                !material.total_without_taxes.isZero() ||
                !(material.material.is_hidden_on_bill ?? false)
            ));
        },

        hasBilledLines(): boolean {
            const { extras } = this.event;
            return this.hasBilledMaterials || extras.length > 0;
        },

        isCreationAvailable(): boolean {
            return (
                this.mainBeneficiary !== null &&
                this.mainBeneficiary.is_invoiceable &&
                this.hasBilledLines
            );
        },

        userCanCreate(): boolean {
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
            const estimate = await this.$modal.show(CreateEstimateModal, {
                event: this.event,
            });
            if (estimate === undefined) {
                return;
            }
            this.$emit('created', estimate);

            let isDeleted: boolean = false;
            let shouldRefetch: boolean = false;
            let updatedEstimate: EstimateDetails | null = null;
            let nextOpen = null as { kind: 'estimate' | 'invoice', id: number } | null;

            await this.$modal.show(EstimateDetailsModal, {
                id: estimate.id,
                onUpdated: (updated: EstimateDetails) => {
                    updatedEstimate = updated;
                },
                onDeleted: () => { isDeleted = true; },
                onInvoiceCreated: () => { shouldRefetch = true; },
                onRequestOpen: (kind, id): void => {
                    nextOpen = { kind, id };
                },
            });

            while (nextOpen !== null) {
                const current = nextOpen;
                nextOpen = null;

                /* eslint-disable @typescript-eslint/no-loop-func, no-await-in-loop */
                if (current.kind === 'estimate') {
                    await this.$modal.show(EstimateDetailsModal, {
                        id: current.id,
                        onChange: () => { shouldRefetch = true; },
                        onRequestOpen: (kind, id): void => {
                            nextOpen = { kind, id };
                        },
                    });
                } else {
                    await this.$modal.show(InvoiceDetailsModal, {
                        id: current.id,
                        onChange: () => { shouldRefetch = true; },
                        onRequestOpen: (kind, id): void => {
                            nextOpen = { kind, id };
                        },
                    });
                }
                /* eslint-enable @typescript-eslint/no-loop-func, no-await-in-loop */
            }

            if (shouldRefetch) {
                this.$emit('refetchNeeded');
            } else if (isDeleted) {
                this.$emit('deleted', estimate.id);
            } else if (updatedEstimate !== null) {
                this.$emit('updated', updatedEstimate);
            }
        },

        handleUpdated(estimate: EstimateType) {
            this.$emit('updated', estimate);
        },

        handleDeleted(id: EstimateType['id']) {
            this.$emit('deleted', id);
        },

        handleRefetchNeeded() {
            this.$emit('refetchNeeded');
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
            isBillable,
            hasEstimate,
            hasBilledLines,
            isCreationAvailable,
            mainBeneficiary,
            userCanCreate,
            handleCreate,
            handleUpdated,
            handleDeleted,
            handleRefetchNeeded,
        } = this;

        if (!isBillable) {
            return null;
        }

        const renderWarningIfAny = (): JSX.Element | null => {
            if (!userCanCreate) {
                return null;
            }

            // - S'il n'y a pas de lignes de facture...
            if (!hasBilledLines) {
                return (
                    <Alert
                        type="warning"
                        action={{
                            label: __('warnings.empty.action'),
                            target: {
                                name: 'edit-event',
                                params: { id: event.id.toString() },
                            },
                        }}
                        class="EventDetailsEstimates__warning"
                    >
                        {__('warnings.empty.message')}
                    </Alert>
                );
            }

            // - Si le bénéficiaire n'est pas complet...
            if (mainBeneficiary !== null && !mainBeneficiary.is_invoiceable) {
                const beneficiaryName = mainBeneficiary.company !== null
                    ? mainBeneficiary.company.legal_name
                    : mainBeneficiary.full_name;

                const beneficiaryLocation: Location = mainBeneficiary.company !== null
                    ? { name: 'edit-company', params: { id: mainBeneficiary.company.id.toString() } }
                    : { name: 'edit-beneficiary', params: { id: mainBeneficiary.id.toString() } };

                const messageKey = hasEstimate
                    ? 'warnings.beneficiary-not-invoiceable.message.with-estimates'
                    : 'warnings.beneficiary-not-invoiceable.message.without-estimates';

                return (
                    <Alert
                        type="warning"
                        action={{
                            label: __('warnings.beneficiary-not-invoiceable.action'),
                            target: beneficiaryLocation,
                        }}
                        class="EventDetailsEstimates__warning"
                    >
                        {__(messageKey, { name: beneficiaryName })}
                    </Alert>
                );
            }

            return null;
        };

        const renderContent = (): JSX.Element => {
            if (!hasEstimate) {
                if (mainBeneficiary === null) {
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
                    <Fragment>
                        {renderWarningIfAny()}
                        <div class="EventDetailsEstimates__no-estimate">
                            <p class="EventDetailsEstimates__no-estimate__text">
                                {__('no-estimate-help')}
                            </p>
                            {isCreationAvailable && (
                                <Fragment>
                                    <p class="EventDetailsEstimates__no-estimate__text">
                                        {
                                            userCanCreate
                                                ? __('actions.create.help')
                                                : __('contact-someone-to-create-estimate')
                                        }
                                    </p>
                                    {userCanCreate && (
                                        <Button type="add" onClick={handleCreate}>
                                            {__('actions.create.label')}
                                        </Button>
                                    )}
                                </Fragment>
                            )}
                        </div>
                    </Fragment>
                );
            }

            return (
                <Fragment>
                    {renderWarningIfAny()}
                    <ul class="EventDetailsEstimates__list">
                        {event.estimates!.map((estimate: EstimateType) => (
                            <li key={estimate.id} class="EventDetailsEstimates__list__item">
                                <Estimate
                                    estimate={estimate}
                                    onUpdated={handleUpdated}
                                    onDeleted={handleDeleted}
                                    onRefetchNeeded={handleRefetchNeeded}
                                />
                            </li>
                        ))}
                    </ul>
                    {(isCreationAvailable && userCanCreate) && (
                        <div class="EventDetailsEstimates__create-new">
                            <p class="EventDetailsEstimates__create-new__text">
                                {__('actions.create-new.help')}
                            </p>
                            <Button
                                type="add"
                                class="EventDetailsEstimates__create-new__button"
                                onClick={handleCreate}
                            >
                                {__('actions.create-new.label')}
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
