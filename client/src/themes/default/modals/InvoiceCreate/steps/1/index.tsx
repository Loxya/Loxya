import './index.scss';
import { Step } from '..';
import config from '@/globals/config';
import { defineComponent, inject } from 'vue';
import { GoToStepKey } from '../../_constants';
import BillingEditor from '@/themes/default/components/BillingEditor';
import FormField from '@/themes/default/components/FormField';
import Button from '@/themes/default/components/Button';
import BuyerSelect from './BuyerSelect';

import type { EditData } from '../../_types';
import type { Injected, PropType } from 'vue';
import type { Beneficiary } from '@/stores/api/beneficiaries';
import type { BillingData, BillingContext } from '@/themes/default/components/BillingEditor';

type Props = {
    /** Les données éditées de la facture. */
    data: EditData,

    /** Les éventuelles erreurs de validation. */
    errors?: Record<string, any> | null,

    /**
     * Fonction appelée lorsqu'un ou plusieurs champs édités changent.
     *
     * @param data - Les données éditées mises à jour.
     */
    onChange?(data: EditData): void,

    /**
     * Fonction appelée quand l'utilisateur
     * demande à annuler l'opération.
     */
    onCancel?(): void,
};

type InstanceProperties = {
    goToStep: Injected<typeof GoToStepKey>,
};

/** Étape 1 de la création d'une facture : Acheteur et lignes. */
const InvoiceCreateStepBuyerAndLines = defineComponent({
    name: 'InvoiceCreateStepBuyerAndLines',
    props: {
        data: {
            type: Object as PropType<Props['data']>,
            required: true,
        },
        errors: {
            type: Object as PropType<Props['errors']>,
            default: null,
        },
        // eslint-disable-next-line vue/no-unused-properties
        onChange: {
            type: Function as PropType<Props['onChange']>,
            default: undefined,
        },
        // eslint-disable-next-line vue/no-unused-properties
        onCancel: {
            type: Function as PropType<Props['onCancel']>,
            default: undefined,
        },
    },
    emits: ['change', 'cancel'],
    setup: (): InstanceProperties => ({
        goToStep: inject(GoToStepKey)!,
    }),
    computed: {
        isBillingEmpty(): boolean {
            return this.data.lines.length === 0;
        },

        isFilled(): boolean {
            return this.data.buyer !== null && !this.isBillingEmpty;
        },

        billingContext(): BillingContext {
            const { buyer } = this.data;

            return {
                buyer,
                entity: 'standalone',
                currency: config.currency,
                lines: this.data.lines,
                global_discount_rate: this.data.global_discount_rate,
            };
        },
    },
    methods: {
        // ------------------------------------------------------
        // -
        // -    Handlers
        // -
        // ------------------------------------------------------

        handleBuyerChange(buyer: Beneficiary | null) {
            // - Lorsque l'acheteur a une langue par défaut, on aligne la langue
            //   de la facture dessus. Sinon, on conserve la langue courante.
            const lang = buyer?.language ?? this.data.lang;
            this.$emit('change', { ...this.data, buyer, lang });
        },

        handleBillingChange(billingData: BillingData) {
            this.$emit('change', {
                ...this.data,
                lines: billingData.extras,
                global_discount_rate: billingData.global_discount_rate,
            });
        },

        handleNextClick() {
            if (!this.isFilled) {
                return;
            }
            this.goToStep(Step.OTHER_INFORMATIONS);
        },

        handleCancelClick() {
            this.$emit('cancel');
        },

        // ------------------------------------------------------
        // -
        // -    Méthodes internes
        // -
        // ------------------------------------------------------

        __(key: string, params?: Record<string, number | string>, count?: number): string {
            if (!key.startsWith('global.')) {
                if (!key.startsWith('modal.')) {
                    key = `modal.steps.buyer-and-lines.${key}`;
                }
                key = key.replace(/^modal\./, 'modal.invoice-create.');
            } else {
                key = key.replace(/^global\./, '');
            }
            return this.$t(key, params, count);
        },
    },
    render() {
        const {
            __,
            data,
            billingContext,
            errors,
            isFilled,
            handleBuyerChange,
            handleBillingChange,
            handleNextClick,
            handleCancelClick,
        } = this;

        return (
            <div class="InvoiceCreateStepBuyerAndLines">
                <div class="InvoiceCreateStepBuyerAndLines__body">
                    <FormField
                        type="custom"
                        class="InvoiceCreateStepBuyerAndLines__buyer"
                        label={__('fields.buyer.label')}
                        error={errors?.buyer_id}
                        required
                    >
                        <BuyerSelect
                            value={data.buyer}
                            onChange={handleBuyerChange}
                        />
                    </FormField>
                    <div class="InvoiceCreateStepBuyerAndLines__lines">
                        <div class="InvoiceCreateStepBuyerAndLines__lines__title">
                            {__('fields.lines.label')}
                        </div>
                        <div class="InvoiceCreateStepBuyerAndLines__lines__body">
                            <BillingEditor
                                context={billingContext}
                                errors={errors ?? undefined}
                                onChange={handleBillingChange}
                                compact
                            />
                        </div>
                    </div>
                </div>
                <div class="InvoiceCreateStepBuyerAndLines__actions">
                    <Button onClick={handleCancelClick}>
                        {__('global.cancel')}
                    </Button>
                    <Button
                        type="primary"
                        icon={{ name: 'arrow-right', position: 'after' }}
                        disabled={!isFilled}
                        onClick={handleNextClick}
                    >
                        {__('modal.actions.next-step')}
                    </Button>
                </div>
            </div>
        );
    },
});

export default InvoiceCreateStepBuyerAndLines;
