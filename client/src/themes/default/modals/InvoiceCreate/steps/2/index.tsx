import './index.scss';
import { Step } from '..';
import config from '@/globals/config';
import { defineComponent, inject } from 'vue';
import FormField from '@/themes/default/components/FormField';
import Button from '@/themes/default/components/Button';
import { GoToStepKey } from '../../_constants';

import type Day from '@/utils/day';
import type { EditData } from '../../_types';
import type { Injected, PropType, Raw } from 'vue';
import type { Options as SelectOptions } from '@/themes/default/components/Select';

type Props = {
    /** Les données éditées de la facture. */
    data: EditData,

    /** Les éventuelles erreurs de validation. */
    errors?: Record<string, any> | null,

    /** La sauvegarde est-elle en cours ? */
    isSaving: boolean,

    /**
     * Fonction appelée lorsqu'un ou plusieurs champs édités changent.
     *
     * @param data - Les données éditées mises à jour.
     */
    onChange?(data: EditData): void,

    /** Fonction appelée quand l'utilisateur soumet le formulaire. */
    onSubmit?(): void,

    /**
     * Fonction appelée quand l'utilisateur
     * demande à annuler l'opération.
     */
    onCancel?(): void,
};

type InstanceProperties = {
    goToStep: Injected<typeof GoToStepKey>,
};

/** Étape 2 de la création d'une facture : Autres informations. */
const InvoiceCreateStepOtherInformations = defineComponent({
    name: 'InvoiceCreateStepOtherInformations',
    props: {
        data: {
            type: Object as PropType<Props['data']>,
            required: true,
        },
        errors: {
            type: Object as PropType<Props['errors']>,
            default: null,
        },
        isSaving: {
            type: Boolean as PropType<Props['isSaving']>,
            required: true,
        },
        // eslint-disable-next-line vue/no-unused-properties
        onChange: {
            type: Function as PropType<Props['onChange']>,
            default: undefined,
        },
        // eslint-disable-next-line vue/no-unused-properties
        onSubmit: {
            type: Function as PropType<Props['onSubmit']>,
            default: undefined,
        },
        // eslint-disable-next-line vue/no-unused-properties
        onCancel: {
            type: Function as PropType<Props['onCancel']>,
            default: undefined,
        },
    },
    emits: ['change', 'submit', 'cancel'],
    setup: (): InstanceProperties => ({
        goToStep: inject(GoToStepKey)!,
    }),
    computed: {
        langOptions(): SelectOptions<'fr' | 'en'> {
            const { __ } = this;
            return [
                { label: __('fields.lang.options.fr'), value: 'fr' },
                { label: __('fields.lang.options.en'), value: 'en' },
            ];
        },
    },
    methods: {
        // ------------------------------------------------------
        // -
        // -    Handlers
        // -
        // ------------------------------------------------------

        handleChange(changes: Partial<EditData>) {
            this.$emit('change', { ...this.data, ...changes });
        },

        handlePrevClick() {
            this.goToStep(Step.BUYER_AND_LINES);
        },

        handleSubmit(e: SubmitEvent) {
            e.preventDefault();

            this.$emit('submit');
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
                    key = `modal.steps.other-informations.${key}`;
                }
                key = key.replace(/^modal\./, 'modal.invoice-create.');
            } else {
                key = key.replace(/^global\./, '');
            }
            return this.$t(key, params, count);
        },
    },
    render() {
        const { paymentTermDays } = config.invoices;
        const {
            __,
            data,
            langOptions,
            errors,
            isSaving,
            handleChange,
            handlePrevClick,
            handleCancelClick,
            handleSubmit,
        } = this;

        return (
            <form class="InvoiceCreateStepOtherInformations" onSubmit={handleSubmit}>
                <div class="InvoiceCreateStepOtherInformations__body">
                    <div class="InvoiceCreateStepOtherInformations__group">
                        <FormField
                            type="select"
                            label={__('fields.lang.label')}
                            class="InvoiceCreateStepOtherInformations__group__field"
                            value={data.lang}
                            options={langOptions}
                            error={errors?.lang}
                            placeholder={false}
                            onChange={(value: string) => {
                                handleChange({ lang: value });
                            }}
                            required
                        />
                        <FormField
                            type="date"
                            label={__('fields.due-date.label')}
                            class="InvoiceCreateStepOtherInformations__group__field"
                            value={data.due_date}
                            placeholder={(
                                paymentTermDays <= 0
                                    ? __('fields.due-date.placeholder.immediately')
                                    : __(
                                        'fields.due-date.placeholder.with-delay',
                                        { days: paymentTermDays },
                                        paymentTermDays,
                                    )
                            )}
                            minDate="now"
                            error={errors?.due_date}
                            onInput={(value: Raw<Day> | null) => {
                                handleChange({ due_date: value });
                            }}
                            clearable
                        />
                    </div>
                    <FormField
                        label={__('fields.order-number')}
                        value={data.order_number}
                        error={errors?.order_number}
                        onInput={(value: string) => {
                            handleChange({ order_number: value });
                        }}
                    />
                    <FormField
                        type="textarea"
                        label={__('fields.special-mentions')}
                        value={data.special_mentions}
                        error={errors?.special_mentions}
                        rows={3}
                        onInput={(value: string) => {
                            handleChange({ special_mentions: value });
                        }}
                    />
                </div>
                <div class="InvoiceCreateStepOtherInformations__actions">
                    <Button
                        icon={{ name: 'arrow-left', position: 'before' }}
                        onClick={handlePrevClick}
                    >
                        {__('modal.actions.prev-step')}
                    </Button>
                    <div class="InvoiceCreateStepOtherInformations__actions__main">
                        <Button onClick={handleCancelClick}>
                            {__('global.cancel')}
                        </Button>
                        <Button icon="save" type="primary" htmlType="submit" loading={isSaving}>
                            {isSaving ? __('global.saving') : __('action')}
                        </Button>
                    </div>
                </div>
            </form>
        );
    },
});

export default InvoiceCreateStepOtherInformations;
