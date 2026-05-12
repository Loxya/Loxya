import './index.scss';
import Decimal from 'decimal.js';
import { GoToStepKey } from './_constants';
import { VerticalFormKey } from '@/themes/default/components/@constants';
import { defineComponent, markRaw } from 'vue';
import { RequestError } from '@/globals/requester';
import { ApiErrorCode } from '@/stores/api/@codes';
import { getDefaultLang } from '@/globals/lang';
import apiInvoices from '@/stores/api/invoices';
import Button from '@/themes/default/components/Button';
import Stepper, { StepperOrientation } from '@/themes/default/components/Stepper';
import STEPS_COMPONENTS, { Step } from './steps';

import type { PropType } from 'vue';
import type { EditData } from './_types';
import type { Settings } from '@/stores/api/settings';
import type { InvoiceDetails } from '@/stores/api/invoices';
import type { Step as StepData } from '@/themes/default/components/Stepper';

type Props = {
    /**
     * Fonction appelée à la fermeture de la modale.
     *
     * @param invoice - La facture créée si la création a été menée à son terme.
     */
    onClose?(invoice?: InvoiceDetails): void,
};

type Data = {
    currentStep: Step,
    data: EditData,
    isSaving: boolean,
    validationErrors: Record<string, any> | null,
};

/** Modale de création d'une facture "from scratch". */
const InvoiceCreateModal = defineComponent({
    name: 'InvoiceCreateModal',
    modal: {
        width: 940,
        dismissible: false,
    },
    provide(this: any) {
        return {
            [VerticalFormKey as symbol]: true,
            [GoToStepKey as symbol]: (step: Step) => {
                this.currentStep = step;
            },
        };
    },
    props: {
        // eslint-disable-next-line vue/no-unused-properties
        onClose: {
            type: Function as PropType<Props['onClose']>,
            default: undefined,
        },
    },
    emits: ['close'],
    data(): Data {
        const settings = this.$store.state.settings as Settings;

        const data: EditData = {
            buyer: null,
            due_date: null,
            order_number: null,
            special_mentions: settings.invoices?.specialMentions ?? null,
            lang: getDefaultLang(),
            lines: [],
            global_discount_rate: markRaw(new Decimal(0)),
        };

        return {
            data,
            currentStep: Step.BUYER_AND_LINES,
            isSaving: false,
            validationErrors: null,
        };
    },
    computed: {
        isBuyerAndLinesFilled(): boolean {
            return (
                this.data.buyer !== null &&
                this.data.lines.length > 0
            );
        },

        steps(): Array<StepData<Step>> {
            const { __, isBuyerAndLinesFilled, currentStep } = this;

            return [
                {
                    id: Step.BUYER_AND_LINES,
                    name: __('steps.buyer-and-lines.title'),
                    filled: isBuyerAndLinesFilled,
                    reachable: true,
                },
                {
                    id: Step.OTHER_INFORMATIONS,
                    name: __('steps.other-informations.title'),
                    filled: false,
                    reachable: (
                        isBuyerAndLinesFilled ||
                        currentStep === Step.OTHER_INFORMATIONS
                    ),
                },
            ];
        },
    },
    methods: {
        // ------------------------------------------------------
        // -
        // -    Handlers
        // -
        // ------------------------------------------------------

        handleChange(data: EditData) {
            this.data = data;
        },

        handleOpenStep(step: Step) {
            this.currentStep = step;
        },

        handleSubmit() {
            this.save();
        },

        handleClose() {
            this.$emit('close', undefined);
        },

        // ------------------------------------------------------
        // -
        // -    Méthodes internes
        // -
        // ------------------------------------------------------

        async save() {
            if (this.isSaving || !this.isBuyerAndLinesFilled) {
                return;
            }
            const { __, data } = this;
            this.isSaving = true;

            try {
                const invoice = await apiInvoices.create({
                    buyer_id: data.buyer!.id,
                    lang: data.lang,
                    due_date: data.due_date,
                    order_number: data.order_number,
                    lines: data.lines,
                    global_discount_rate: data.global_discount_rate,
                    special_mentions: data.special_mentions,
                });

                this.validationErrors = null;
                this.$toasted.success(__('created'));
                this.$emit('close', invoice);
            } catch (error) {
                this.isSaving = false;

                if (error instanceof RequestError && error.code === ApiErrorCode.VALIDATION_FAILED) {
                    this.validationErrors = { ...error.details };

                    // - On renvoie l'utilisateur sur l'étape contenant les champs
                    //   en erreur pour qu'il puisse les corriger.
                    const hasFirstStepError = ['buyer_id', 'lines', 'global_discount_rate'].some(
                        (field: string) => this.validationErrors?.[field] !== undefined,
                    );
                    this.currentStep = (
                        hasFirstStepError
                            ? Step.BUYER_AND_LINES
                            : Step.OTHER_INFORMATIONS
                    );
                    return;
                }

                // eslint-disable-next-line no-console
                console.error(`Error occurred while creating the invoice`, error);
                this.$toasted.error(__('global.errors.unexpected-while-creating'));
            }
        },

        __(key: string, params?: Record<string, number | string>, count?: number): string {
            key = !key.startsWith('global.')
                ? `modal.invoice-create.${key}`
                : key.replace(/^global\./, '');

            return this.$t(key, params, count);
        },
    },
    render() {
        const {
            __,
            data,
            steps,
            currentStep,
            validationErrors,
            isSaving,
            handleChange,
            handleOpenStep,
            handleSubmit,
            handleClose,
        } = this;

        const renderStep = (): JSX.Element | null => {
            const StepComponent = STEPS_COMPONENTS.get(currentStep)!;
            return (
                <StepComponent
                    data={data}
                    errors={validationErrors}
                    isSaving={isSaving}
                    onChange={handleChange}
                    onSubmit={handleSubmit}
                    onCancel={handleClose}
                />
            );
        };

        return (
            <div class="InvoiceCreateModal">
                <header class="InvoiceCreateModal__header">
                    <h2 class="InvoiceCreateModal__header__title">{__('title')}</h2>
                    <Button
                        type="close"
                        class="InvoiceCreateModal__header__close-button"
                        onClick={handleClose}
                    />
                </header>
                <div class="InvoiceCreateModal__stepper">
                    <Stepper
                        steps={steps}
                        currentStepId={currentStep}
                        orientation={StepperOrientation.HORIZONTAL}
                        onOpenStep={handleOpenStep}
                    />
                </div>
                <div class="InvoiceCreateModal__body">
                    {renderStep()}
                </div>
            </div>
        );
    },
});

export default InvoiceCreateModal;
