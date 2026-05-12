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
    showTotalReplacementPrice: BillableType[],
    showTotalisableProperties: BillableType[],
    showReplacementPrices: BillableType[],
    showDescriptions: BillableType[],
    specialMentions: {
        estimates: string,
        invoices: string,
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
            'showTotalReplacementPrice',
            'showTotalisableProperties',
            'showReplacementPrices',
            'showDescriptions',
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
                specialMentions: Object.fromEntries(
                    (Object.values(BillableType)).map((type: BillableType) => (
                        [type, settings[type]?.specialMentions ?? '']
                    )),
                ) as EditedData['specialMentions'],
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
                        showTotalReplacementPrice: data.showTotalReplacementPrice.includes(key),
                        showTotalisableProperties: data.showTotalisableProperties.includes(key),
                        showReplacementPrices: data.showReplacementPrices.includes(key),
                        showDescriptions: data.showDescriptions.includes(key),
                        specialMentions: (
                            data.specialMentions[key].length > 0
                                ? data.specialMentions[key]
                                : null
                        ),
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
            data,
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
                    <div class="EstimatesInvoicesGlobalSettings__display-options">
                        <Fieldset
                            title={__('details')}
                            class="EstimatesInvoicesGlobalSettings__display-options__fieldset"
                        >
                            <FormField
                                type="custom"
                                label={__('display-total-replacement-price')}
                                error={validationErrors?.['estimates.showTotalReplacementPrice']}
                            >
                                <Checkboxes
                                    options={chooserOptions}
                                    value={data.showTotalReplacementPrice}
                                    onInput={(values: BillableType[]) => {
                                        data.showTotalReplacementPrice = values;
                                    }}
                                />
                            </FormField>
                            <FormField
                                type="custom"
                                label={__('display-totalisable-attributes')}
                                error={validationErrors?.['estimates.showTotalisableProperties']}
                            >
                                <Checkboxes
                                    options={chooserOptions}
                                    value={data.showTotalisableProperties}
                                    onInput={(values: BillableType[]) => {
                                        data.showTotalisableProperties = values;
                                    }}
                                />
                            </FormField>
                        </Fieldset>
                        <Fieldset
                            title={__('material-list')}
                            class="EstimatesInvoicesGlobalSettings__display-options__fieldset"
                        >
                            <FormField
                                type="custom"
                                label={__('display-replacement-prices')}
                                error={validationErrors?.['estimates.showReplacementPrices']}
                            >
                                <Checkboxes
                                    options={chooserOptions}
                                    value={data.showReplacementPrices}
                                    onInput={(values: BillableType[]) => {
                                        data.showReplacementPrices = values;
                                    }}
                                />
                            </FormField>
                            <FormField
                                type="custom"
                                label={__('display-descriptions')}
                                error={validationErrors?.['estimates.showDescriptions']}
                            >
                                <Checkboxes
                                    options={chooserOptions}
                                    value={data.showDescriptions}
                                    onInput={(values: BillableType[]) => {
                                        data.showDescriptions = values;
                                    }}
                                />
                            </FormField>
                        </Fieldset>
                    </div>

                    <Fieldset title={__('special-mentions.estimates')}>
                        <FormField
                            type="textarea"
                            rows={7}
                            error={validationErrors?.['estimates.specialMentions']}
                            value={data.specialMentions.estimates}
                            onInput={(values: string) => {
                                data.specialMentions.estimates = values;
                            }}
                        />
                    </Fieldset>
                    <Fieldset title={__('special-mentions.invoices')}>
                        <FormField
                            type="textarea"
                            rows={7}
                            error={validationErrors?.['invoices.specialMentions']}
                            value={data.specialMentions.invoices}
                            onInput={(values: string) => {
                                data.specialMentions.invoices = values;
                            }}
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
