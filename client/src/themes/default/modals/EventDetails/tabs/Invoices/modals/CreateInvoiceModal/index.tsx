import './index.scss';
import config from '@/globals/config';
import { defineComponent } from 'vue';
import { RequestError } from '@/globals/requester';
import { ApiErrorCode } from '@/stores/api/@codes';
import { getDefaultLang } from '@/globals/lang';
import apiEvents from '@/stores/api/events';
import FormField from '@/themes/default/components/FormField';
import { VerticalFormKey } from '@/themes/default/components/@constants';
import Button from '@/themes/default/components/Button';

import type Day from '@/utils/day';
import type { PropType, Raw } from 'vue';
import type { Invoice } from '@/stores/api/invoices';
import type { Settings } from '@/stores/api/settings';
import type { Options } from '@/themes/default/components/Select';
import type { EventDetails, EventInvoiceCreate } from '@/stores/api/events';

type Props = {
    /** L'événement pour lequel on souhaite créer une facture. */
    event: EventDetails<true>,

    /**
     * Fonction appelée à la fermeture de la modale.
     *
     * @param invoice - La facture créée si l'utilisateur a
     *                  été au bout de la création.
     */
    onClose?(invoice?: Invoice): void,
};

type EditData = Required<EventInvoiceCreate>;

type Data = {
    data: EditData,
    isSaving: boolean,
    validationErrors: Record<string, string> | null,
};

/** Modale de création d'une facture pour un événement. */
const EventCreateInvoiceModal = defineComponent({
    name: 'EventCreateInvoiceModal',
    modal: {
        width: 600,
        dismissible: false,
    },
    provide: {
        [VerticalFormKey as symbol]: true,
    },
    props: {
        event: {
            type: Object as PropType<Props['event']>,
            required: true,
        },
        // eslint-disable-next-line vue/no-unused-properties
        onClose: {
            type: Function as PropType<Props['onClose']>,
            default: undefined,
        },
    },
    emits: ['close'],
    data(): Data {
        const settings = this.$store.state.settings as Settings;
        const mainBeneficiary = [...this.event.beneficiaries].shift()!;

        const data: EditData = {
            order_number: null,
            due_date: null,
            special_mentions: settings.invoices?.specialMentions ?? null,

            // - Utilise la langue de l'utilisateur rattaché au bénéficiaire
            //   principal si disponible, sinon la langue par défaut.
            lang: mainBeneficiary?.language ?? getDefaultLang(),
        };

        return {
            data,
            isSaving: false,
            validationErrors: null,
        };
    },
    computed: {
        langOptions(): Options<'fr' | 'en'> {
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

        handleSubmit(e: Event) {
            e?.preventDefault();

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
            if (this.isSaving) {
                return;
            }
            this.isSaving = true;
            const { __, event, data } = this;

            try {
                const invoice = await apiEvents.createInvoice(event.id, data);

                this.$toasted.success(__('created'));
                this.$emit('close', invoice);
            } catch (error) {
                this.isSaving = false;

                if (error instanceof RequestError && error.code === ApiErrorCode.VALIDATION_FAILED) {
                    this.validationErrors = { ...error.details };
                    return;
                }

                // eslint-disable-next-line no-console
                console.error(`Error occurred while creating the invoice`, error);
                this.$toasted.error(__('global.errors.unexpected-while-creating'));
            }
        },

        __(key: string, params?: Record<string, number | string>, count?: number): string {
            key = !key.startsWith('global.')
                ? `modal.event-details.invoices.modals.create.${key}`
                : key.replace(/^global\./, '');

            return this.$t(key, params, count);
        },
    },
    render() {
        const { paymentTermDays } = config.invoices;
        const {
            __,
            data,
            event,
            langOptions,
            isSaving,
            validationErrors,
            handleSubmit,
            handleClose,
        } = this;

        return (
            <div class="EventCreateInvoiceModal">
                <header class="EventCreateInvoiceModal__header">
                    <h2 class="EventCreateInvoiceModal__header__title">
                        {__('title', { name: event.title })}
                    </h2>
                    <Button
                        type="close"
                        class="EventCreateInvoiceModal__header__close-button"
                        onClick={handleClose}
                    />
                </header>
                <div class="EventCreateInvoiceModal__body">
                    <form class="EventCreateInvoiceModal__form" onSubmit={handleSubmit}>
                        <FormField
                            label={__('fields.order-number')}
                            value={data.order_number}
                            error={validationErrors?.order_number}
                            onInput={(value: string) => {
                                data.order_number = value;
                            }}
                        />
                        <FormField
                            type="select"
                            label={__('fields.lang.label')}
                            value={data.lang}
                            options={langOptions}
                            error={validationErrors?.lang}
                            placeholder={false}
                            onChange={(value: string) => {
                                data.lang = value;
                            }}
                            required
                        />
                        <FormField
                            type="date"
                            label={__('fields.due-date.label')}
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
                            error={validationErrors?.due_date}
                            onInput={(value: Raw<Day> | null) => {
                                data.due_date = value;
                            }}
                            clearable
                        />
                        <FormField
                            type="textarea"
                            label={__('fields.special-mentions')}
                            value={data.special_mentions}
                            error={validationErrors?.special_mentions}
                            rows={3}
                            onInput={(value: string) => {
                                data.special_mentions = value;
                            }}
                        />
                    </form>
                </div>
                <div class="EventCreateInvoiceModal__footer">
                    <Button type="primary" onClick={handleSubmit} loading={isSaving}>
                        {isSaving ? __('global.saving') : __('action')}
                    </Button>
                    <Button onClick={handleClose}>
                        {__('global.cancel')}
                    </Button>
                </div>
            </div>
        );
    },
});

export default EventCreateInvoiceModal;
