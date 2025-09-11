import './index.scss';
import { defineComponent } from 'vue';
import { RequestError } from '@/globals/requester';
import cloneDeep from 'lodash/cloneDeep';
import apiSettings, { MaterialDisplayMode } from '@/stores/api/settings';
import { ApiErrorCode } from '@/stores/api/@codes';
import Fieldset from '@/themes/default/components/Fieldset';
import FormField from '@/themes/default/components/FormField';
import Button from '@/themes/default/components/Button';
import SubPage from '../../components/SubPage';

import type { Settings } from '@/stores/api/settings';

type Data = {
    isSaving: boolean,
    validationErrors: Record<string, string> | null,
    values: (
        & Omit<Settings['eventSummary'], 'customText'>
        & {
            customText: {
                title: string,
                content: string,
            },
        }
    ),
};

/** Page des paramètres des fiches de sortie des événements / réservations. */
const EventSummaryGlobalSettings = defineComponent({
    name: 'EventSummaryGlobalSettings',
    data(): Data {
        return {
            isSaving: false,
            validationErrors: null,
            values: (() => {
                const _values = cloneDeep((this.$store.state.settings as Settings).eventSummary);
                return {
                    ..._values,
                    customText: {
                        title: _values.customText?.title ?? '',
                        content: _values.customText?.content ?? '',
                    },
                };
            })(),
        };
    },
    computed: {
        listModeOptions(): Array<{ label: string, value: MaterialDisplayMode }> {
            const { $t: __, $store: { state: { parks: { list: parks } } } } = this;

            return Object.values(MaterialDisplayMode)
                .filter((mode: MaterialDisplayMode) => (
                    mode !== MaterialDisplayMode.PARKS || parks.length > 1
                ))
                .map((mode: MaterialDisplayMode) => ({
                    value: mode,
                    label: __(`page.settings.event-summary.list-display-mode-${mode}`),
                }));
        },
    },
    mounted() {
        this.$store.dispatch('parks/fetch');
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
                await apiSettings.update({ eventSummary: values });

                this.validationErrors = null;

                this.$store.dispatch('settings/fetch');
                this.$toasted.success(__('page.settings.event-summary.saved'));
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
    },
    render() {
        const {
            $t: __,
            values,
            isSaving,
            listModeOptions,
            validationErrors,
            handleSubmit,
        } = this;

        return (
            <SubPage
                class="EventSummaryGlobalSettings"
                title={__('page.settings.event-summary.title')}
                help={__('page.settings.event-summary.help')}
                hasValidationError={!!validationErrors}
            >
                <form class="EventSummaryGlobalSettings__form" onSubmit={handleSubmit}>
                    <Fieldset title={__('page.settings.event-summary.header')}>
                        <FormField
                            type="switch"
                            label="page.settings.event-summary.display-legal-numbers"
                            error={validationErrors?.['eventSummary.showLegalNumbers']}
                            v-model={values.showLegalNumbers}
                        />
                    </Fieldset>
                    <Fieldset title={__('page.settings.event-summary.material-list')}>
                        <FormField
                            type="select"
                            label="page.settings.event-summary.display-mode"
                            options={listModeOptions}
                            error={validationErrors?.['eventSummary.materialDisplayMode']}
                            v-model={values.materialDisplayMode}
                            placeholder={false}
                        />
                        <FormField
                            type="switch"
                            class="EventSummaryGlobalSettings__switch"
                            label="page.settings.event-summary.display-pictures"
                            error={validationErrors?.['eventSummary.showPictures']}
                            v-model={values.showPictures}
                        />
                        <FormField
                            type="switch"
                            class="EventSummaryGlobalSettings__switch"
                            label="page.settings.event-summary.display-replacement-prices"
                            error={validationErrors?.['eventSummary.showReplacementPrices']}
                            v-model={values.showReplacementPrices}
                        />
                        <FormField
                            type="switch"
                            class="EventSummaryGlobalSettings__switch"
                            label="page.settings.event-summary.display-descriptions"
                            error={validationErrors?.['eventSummary.showDescriptions']}
                            v-model={values.showDescriptions}
                        />
                        <FormField
                            type="switch"
                            class="EventSummaryGlobalSettings__switch"
                            label="page.settings.event-summary.display-tags"
                            error={validationErrors?.['eventSummary.showTags']}
                            v-model={values.showTags}
                        />
                    </Fieldset>
                    <Fieldset title={__('page.settings.event-summary.custom-text')}>
                        <FormField
                            type="text"
                            label="page.settings.event-summary.custom-text-title"
                            error={validationErrors?.['eventSummary.customText.title']}
                            v-model={values.customText.title}
                        />
                        <FormField
                            type="textarea"
                            label="page.settings.event-summary.custom-text-content"
                            rows={10}
                            error={validationErrors?.['eventSummary.customText.content']}
                            v-model={values.customText.content}
                        />
                    </Fieldset>
                    <section class="EventSummaryGlobalSettings__actions">
                        <Button icon="save" htmlType="submit" type="primary" loading={isSaving}>
                            {isSaving ? __('saving') : __('save')}
                        </Button>
                    </section>
                </form>
            </SubPage>
        );
    },
});

export default EventSummaryGlobalSettings;
