import './index.scss';
import { defineComponent } from 'vue';
import { RequestError } from '@/globals/requester';
import pick from 'lodash/pick';
import { confirm } from '@/utils/alert';
import apiSettings from '@/stores/api/settings';
import { ApiErrorCode } from '@/stores/api/@codes';
import Fieldset from '@/themes/default/components/Fieldset';
import FormField from '@/themes/default/components/FormField';
import Button from '@/themes/default/components/Button';
import SubPage from '../../components/SubPage';

import type { Settings, SettingsEdit } from '@/stores/api/settings';

type Data = {
    isSaving: boolean,
    validationErrors: Record<string, string> | null,
    values: {
        event: Pick<Settings['calendar']['event'], 'showLocation' | 'showBorrower'>,
        public: Pick<Settings['calendar']['public'], 'enabled'>,
    },

    /**
     * State "temporaire" juste pendant la durée de vie de ce formulaire.
     * (on veut que le bouton de "Régénération du lien" du calendrier public
     * ré-apparaisse lorsqu'on reviendra sur le formulaire)
     */
    hasRegeneratedCalendarLink: boolean,
};

/** Page des paramètres du calendrier. */
const CalendarGlobalSettings = defineComponent({
    name: 'CalendarGlobalSettings',
    data(): Data {
        return {
            isSaving: false,
            validationErrors: null,
            hasRegeneratedCalendarLink: false,
            values: (pick as any)(this.$store.state.settings.calendar, [
                'event.showLocation',
                'event.showBorrower',
                'public.enabled',
            ]),
        };
    },
    computed: {
        persistedData(): Settings['calendar'] {
            return this.$store.state.settings.calendar;
        },
    },
    methods: {
        // ------------------------------------------------------
        // -
        // -    Handlers
        // -
        // ------------------------------------------------------

        async handleSubmit(e: SubmitEvent) {
            e.preventDefault();

            if (this.isSaving) {
                return;
            }

            this.isSaving = true;
            const { $t: __, values } = this;

            try {
                await apiSettings.update({ calendar: values } as SettingsEdit);

                this.validationErrors = null;

                this.$store.dispatch('settings/fetch');
                this.$toasted.success(__('page.settings.calendar.saved'));
            } catch (error) {
                if (error instanceof RequestError && error.code === ApiErrorCode.VALIDATION_FAILED) {
                    this.validationErrors = { ...error.details };
                    return;
                }
                this.$toasted.error(__('errors.unexpected-while-saving'));
            } finally {
                this.isSaving = false;
            }
        },

        async handleRegenerateCalendarUrl() {
            const { $t: __ } = this;

            const isConfirmed = await confirm({
                type: 'danger',
                title: __('warning'),
                text: __('page.settings.calendar.public-calendar-url-reset-warning'),
                confirmButtonText: __('yes-regenerate-link'),
            });
            if (!isConfirmed) {
                return;
            }

            try {
                await apiSettings.reset('calendar.public.url');

                this.$store.dispatch('settings/fetch');
                this.hasRegeneratedCalendarLink = true;
            } catch {
                this.$toasted.error(__('page.settings.calendar.public-calendar-url-reset-error'));
            }
        },
    },
    render() {
        const {
            $t: __,
            values,
            isSaving,
            persistedData,
            validationErrors,
            hasRegeneratedCalendarLink,
            handleSubmit,
            handleRegenerateCalendarUrl,
        } = this;

        const renderPublicCalendarUrl = (): JSX.Element | null => {
            const isClientSideEnabled = values.public.enabled;
            if (!isClientSideEnabled) {
                return null;
            }

            const isServerSideEnabled = persistedData.public.enabled;
            if (!isServerSideEnabled) {
                return (
                    <FormField
                        type="static"
                        label="page.settings.calendar.public-calendar-url"
                        value={__('page.settings.calendar.save-to-get-calendar-url')}
                    />
                );
            }

            if (!persistedData.public.url) {
                return null;
            }

            return (
                <FormField
                    type="copy"
                    label="page.settings.calendar.public-calendar-url"
                    class="CalendarGlobalSettings__public-calendar-url"
                    value={persistedData.public.url}
                    scopedSlots={{
                        'help': () => {
                            if (hasRegeneratedCalendarLink) {
                                return (
                                    <span
                                        class={[
                                            'CalendarGlobalSettings__public-calendar-url__help',
                                            'CalendarGlobalSettings__public-calendar-url__help--success',
                                        ]}
                                    >
                                        {__('page.settings.calendar.public-calendar-url-reset-success')}
                                    </span>
                                );
                            }

                            return (
                                <span class="CalendarGlobalSettings__public-calendar-url__help">
                                    {__('page.settings.calendar.public-calendar-url-reset-help')}
                                    <Button onClick={handleRegenerateCalendarUrl} type="warning">
                                        {__('regenerate-link')}
                                    </Button>
                                </span>
                            );
                        },
                    }}
                />
            );
        };

        return (
            <SubPage
                class="CalendarGlobalSettings"
                title={__('page.settings.calendar.title')}
                help={__('page.settings.calendar.help')}
                hasValidationError={!!validationErrors}
            >
                <form class="CalendarGlobalSettings__form" onSubmit={handleSubmit}>
                    <Fieldset title={__('page.settings.calendar.events-display-section-title')}>
                        <FormField
                            type="switch"
                            label="page.settings.calendar.showLocation"
                            error={validationErrors?.['calendar.event.showLocation']}
                            v-model={values.event.showLocation}
                        />
                        <FormField
                            type="switch"
                            label="page.settings.calendar.showBorrower"
                            error={validationErrors?.['calendar.event.showBorrower']}
                            v-model={values.event.showBorrower}
                        />
                    </Fieldset>
                    <Fieldset
                        title={__('page.settings.calendar.public-calendar-section-title')}
                        help={__('page.settings.calendar.public-calendar-help')}
                    >
                        <FormField
                            type="switch"
                            label="page.settings.calendar.enable-public-calendar"
                            error={validationErrors?.['calendar.public.enabled']}
                            v-model={values.public.enabled}
                        />
                        {renderPublicCalendarUrl()}
                    </Fieldset>
                    <section class="CalendarGlobalSettings__actions">
                        <Button icon="save" htmlType="submit" type="primary" loading={isSaving}>
                            {isSaving ? __('saving') : __('save')}
                        </Button>
                    </section>
                </form>
            </SubPage>
        );
    },
});

export default CalendarGlobalSettings;
