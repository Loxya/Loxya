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
import type { PropType } from 'vue';
import type { Estimate } from '@/stores/api/estimates';
import type { Settings } from '@/stores/api/settings';
import type { Options } from '@/themes/default/components/Select';
import type { EventDetails, EventEstimateCreate } from '@/stores/api/events';

type Props = {
    /** L'événement pour lequel on souhaite créer un devis. */
    event: EventDetails<true>,

    /**
     * Fonction appelée à la fermeture de la modale.
     *
     * @param estimate - Le devis créé si l'utilisateur a
     *                   été au bout de la création.
     */
    onClose?(estimate?: Estimate): void,
};

type EditData = Required<EventEstimateCreate>;

type Data = {
    data: EditData,
    isSaving: boolean,
    validationErrors: Record<string, string> | null,
};

/** Modale de création d'un devis pour un événement. */
const EventCreateEstimateModal = defineComponent({
    name: 'EventCreateEstimateModal',
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
            due_date: null,
            special_mentions: settings.estimates?.specialMentions ?? null,

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
                const estimate = await apiEvents.createEstimate(event.id, data);

                this.$toasted.success(__('created'));
                this.$emit('close', estimate);
            } catch (error) {
                this.isSaving = false;

                if (error instanceof RequestError && error.code === ApiErrorCode.VALIDATION_FAILED) {
                    this.validationErrors = { ...error.details };
                    return;
                }

                // eslint-disable-next-line no-console
                console.error(`Error occurred while creating the estimate`, error);
                this.$toasted.error(__('global.errors.unexpected-while-creating'));
            }
        },

        __(key: string, params?: Record<string, number | string>, count?: number): string {
            key = !key.startsWith('global.')
                ? `modal.event-details.estimates.modals.create.${key}`
                : key.replace(/^global\./, '');

            return this.$t(key, params, count);
        },
    },
    render() {
        const { validityDays } = config.estimates;
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
            <div class="EventCreateEstimateModal">
                <header class="EventCreateEstimateModal__header">
                    <h2 class="EventCreateEstimateModal__header__title">
                        {__('title', { name: event.title })}
                    </h2>
                    <Button
                        type="close"
                        class="EventCreateEstimateModal__header__close-button"
                        onClick={handleClose}
                    />
                </header>
                <div class="EventCreateEstimateModal__body">
                    <form class="EventCreateEstimateModal__form" onSubmit={handleSubmit}>
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
                            placeholder={__('fields.due-date.placeholder', { days: validityDays })}
                            minDate="now"
                            error={validationErrors?.due_date}
                            onInput={(value: Day | null) => {
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
                <div class="EventCreateEstimateModal__footer">
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

export default EventCreateEstimateModal;
