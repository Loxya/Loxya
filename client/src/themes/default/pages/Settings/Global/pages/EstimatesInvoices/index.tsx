import './index.scss';
import { defineComponent } from 'vue';
import axios from 'axios';
import apiSettings from '@/stores/api/settings';
import { ApiErrorCode } from '@/stores/api/@codes';
import Fieldset from '@/themes/default/components/Fieldset';
import FormField from '@/themes/default/components/FormField';
import Checkboxes from '@/themes/default/components/Checkboxes';
import Button from '@/themes/default/components/Button';
import SubPage from '../../components/SubPage';

import type { Settings, SettingsEdit } from '@/stores/api/settings';
import type { OptionData } from '@/themes/default/components/Checkboxes/Option';

enum BillableType {
    INVOICES = 'invoices',
    ESTIMATES = 'estimates',
}

type EditedData = {
    showMobilizationPeriod: BillableType[],
    showBookingDescription: BillableType[],
    showTotalReplacementPrice: BillableType[],
    showTotalisableProperties: BillableType[],
    showPictures: BillableType[],
    showReplacementPrices: BillableType[],
    showDescriptions: BillableType[],
    showUnitPrices: BillableType[],
    customText: {
        estimates: {
            title: string,
            content: string,
        },
        invoices: {
            title: string,
            content: string,
        },
    },
};

type Data = {
    isSaving: boolean,
    validationErrors: Record<string, string> | null,
    data: EditedData,
};

/** Page des paramètres de présentation des devis et factures. */
const EstimatesInvoicesGlobalSettings = defineComponent({
    name: 'EstimatesInvoicesGlobalSettings',
    data(): Data {
        const settings = this.$store.state.settings as Settings;
        const fields: Array<keyof Settings['estimates'] | keyof Settings['invoices']> = [
            'showMobilizationPeriod',
            'showBookingDescription',
            'showTotalReplacementPrice',
            'showTotalisableProperties',
            'showPictures',
            'showReplacementPrices',
            'showDescriptions',
            'showUnitPrices',
        ];
        const data: EditedData = fields.reduce(
            (acc: Partial<EditedData>, field: keyof Settings['estimates'] | keyof Settings['invoices']): Partial<EditedData> => {
                const choiceState = [];
                if (settings.estimates?.[field] === true) {
                    choiceState.push(BillableType.ESTIMATES);
                }
                if (settings.invoices?.[field] === true) {
                    choiceState.push(BillableType.INVOICES);
                }
                return { ...acc, [field]: choiceState };
            },
            {
                customText: Object.fromEntries(
                    (Object.values(BillableType)).map(
                        (type: BillableType) => [type, {
                            title: settings[type]?.customText?.title ?? '',
                            content: settings[type]?.customText?.content ?? '',
                        }],
                    ),
                ) as EditedData['customText'],
            },
        ) as EditedData;

        return {
            isSaving: false,
            validationErrors: null,
            data,
        };
    },
    computed: {
        chooserOptions(): OptionData[] {
            const { __ } = this;

            return [
                {
                    label: __('global.estimates'),
                    value: BillableType.ESTIMATES,
                },
                {
                    label: __('global.invoices'),
                    value: BillableType.INVOICES,
                },
            ];
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
            const { __, data } = this;

            const payload: SettingsEdit = (Object.values(BillableType)).reduce(
                (acc: SettingsEdit, key: BillableType): SettingsEdit => {
                    const _payload = {
                        showMobilizationPeriod: data.showMobilizationPeriod.includes(key),
                        showBookingDescription: data.showBookingDescription.includes(key),
                        showTotalReplacementPrice: data.showTotalReplacementPrice.includes(key),
                        showTotalisableProperties: data.showTotalisableProperties.includes(key),
                        showPictures: data.showPictures.includes(key),
                        showReplacementPrices: data.showReplacementPrices.includes(key),
                        showDescriptions: data.showDescriptions.includes(key),
                        showUnitPrices: data.showUnitPrices.includes(key),
                        customText: data.customText[key],
                    };
                    return { ...acc, [key]: _payload };
                },
                {},
            );

            try {
                await apiSettings.update(payload);

                this.validationErrors = null;

                this.$store.dispatch('settings/fetch');
                this.$toasted.success(__('saved'));
            } catch (error) {
                if (axios.isAxiosError(error)) {
                    const { code, details } = error.response?.data?.error || { code: ApiErrorCode.UNKNOWN, details: {} };
                    if (code === ApiErrorCode.VALIDATION_FAILED) {
                        this.validationErrors = { ...details };
                        return;
                    }
                }
                this.$toasted.error(__('global.errors.unexpected-while-saving'));
            } finally {
                this.isSaving = false;
            }
        },

        // ------------------------------------------------------
        // -
        // -    Méthodes internes
        // -
        // ------------------------------------------------------

        __(key: string, params?: Record<string, number | string>, count?: number): string {
            if (!key.startsWith('global.')) {
                if (!key.startsWith('page.')) {
                    key = `page.estimates-invoices.${key}`;
                }
                key = key.replace(/^page\./, 'page.settings.');
            } else {
                key = key.replace(/^global\./, '');
            }
            return this.$t(key, params, count);
        },
    },
    render() {
        const {
            __,
            data: { customText },
            isSaving,
            validationErrors,
            chooserOptions,
            handleSubmit,
        } = this;

        return (
            <SubPage
                class="EstimatesInvoicesGlobalSettings"
                title={__('title')}
                help={__('help')}
                hasValidationError={!!validationErrors}
            >
                <form class="EstimatesInvoicesGlobalSettings__form" onSubmit={handleSubmit}>
                    <Fieldset title={__('details')}>
                        <FormField
                            type="custom"
                            label="page.settings.estimates-invoices.display-mobilization-period"
                            error={validationErrors?.['estimates.showMobilizationPeriod']}
                        >
                            <Checkboxes
                                options={chooserOptions}
                                value={this.data.showMobilizationPeriod}
                                onInput={(values: BillableType[]) => {
                                    this.data.showMobilizationPeriod = values;
                                }}
                            />
                        </FormField>
                        <FormField
                            type="custom"
                            label="page.settings.estimates-invoices.display-booking-description"
                            error={validationErrors?.['estimates.showBookingDescription']}
                        >
                            <Checkboxes
                                options={chooserOptions}
                                value={this.data.showBookingDescription}
                                onInput={(values: BillableType[]) => {
                                    this.data.showBookingDescription = values;
                                }}
                            />
                        </FormField>
                        <FormField
                            type="custom"
                            label="page.settings.estimates-invoices.display-total-replacement-price"
                            error={validationErrors?.['estimates.showTotalReplacementPrice']}
                        >
                            <Checkboxes
                                options={chooserOptions}
                                value={this.data.showTotalReplacementPrice}
                                onInput={(values: BillableType[]) => {
                                    this.data.showTotalReplacementPrice = values;
                                }}
                            />
                        </FormField>
                        <FormField
                            type="custom"
                            label="page.settings.estimates-invoices.display-totalisable-attributes"
                            error={validationErrors?.['estimates.showTotalisableProperties']}
                        >
                            <Checkboxes
                                options={chooserOptions}
                                value={this.data.showTotalisableProperties}
                                onInput={(values: BillableType[]) => {
                                    this.data.showTotalisableProperties = values;
                                }}
                            />
                        </FormField>
                    </Fieldset>
                    <Fieldset title={__('material-list')}>
                        <FormField
                            type="custom"
                            label="page.settings.estimates-invoices.display-pictures"
                            error={validationErrors?.['estimates.showPictures']}
                        >
                            <Checkboxes
                                options={chooserOptions}
                                value={this.data.showPictures}
                                onInput={(values: BillableType[]) => {
                                    this.data.showPictures = values;
                                }}
                            />
                        </FormField>
                        <FormField
                            type="custom"
                            label="page.settings.estimates-invoices.display-replacement-prices"
                            error={validationErrors?.['estimates.showReplacementPrices']}
                        >
                            <Checkboxes
                                options={chooserOptions}
                                value={this.data.showReplacementPrices}
                                onInput={(values: BillableType[]) => {
                                    this.data.showReplacementPrices = values;
                                }}
                            />
                        </FormField>
                        <FormField
                            type="custom"
                            label="page.settings.estimates-invoices.display-descriptions"
                            error={validationErrors?.['estimates.showDescriptions']}
                        >
                            <Checkboxes
                                options={chooserOptions}
                                value={this.data.showDescriptions}
                                onInput={(values: BillableType[]) => {
                                    this.data.showDescriptions = values;
                                }}
                            />
                        </FormField>
                        <FormField
                            type="custom"
                            label="page.settings.estimates-invoices.display-unit-prices"
                            error={validationErrors?.['estimates.showUnitPrices']}
                        >
                            <Checkboxes
                                options={chooserOptions}
                                value={this.data.showUnitPrices}
                                onInput={(values: BillableType[]) => {
                                    this.data.showUnitPrices = values;
                                }}
                            />
                        </FormField>
                    </Fieldset>
                    <Fieldset title={__('estimates-custom-text')}>
                        <FormField
                            type="text"
                            label="page.settings.estimates-invoices.custom-text-title"
                            error={validationErrors?.['estimates.customText.title']}
                            v-model={customText.estimates.title}
                        />
                        <FormField
                            type="textarea"
                            label="page.settings.estimates-invoices.custom-text-content"
                            rows={10}
                            error={validationErrors?.['estimates.customText.content']}
                            v-model={customText.estimates.content}
                        />
                    </Fieldset>
                    <Fieldset title={__('invoices-custom-text')}>
                        <FormField
                            type="text"
                            label="page.settings.estimates-invoices.custom-text-title"
                            error={validationErrors?.['invoices.customText.title']}
                            v-model={customText.invoices.title}
                        />
                        <FormField
                            type="textarea"
                            label="page.settings.estimates-invoices.custom-text-content"
                            rows={10}
                            error={validationErrors?.['invoices.customText.content']}
                            v-model={customText.invoices.content}
                        />
                    </Fieldset>
                    <section class="EstimatesInvoicesGlobalSettings__actions">
                        <Button icon="save" htmlType="submit" type="primary" loading={isSaving}>
                            {isSaving ? __('global.saving') : __('global.save')}
                        </Button>
                    </section>
                </form>
            </SubPage>
        );
    },
});

export default EstimatesInvoicesGlobalSettings;
