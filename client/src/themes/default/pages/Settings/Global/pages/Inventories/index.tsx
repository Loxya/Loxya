import './index.scss';
import pick from 'lodash/pick';
import { RequestError } from '@/globals/requester';
import { defineComponent } from 'vue';
import apiSettings, { ReturnInventoryMode } from '@/stores/api/settings';
import { ApiErrorCode } from '@/stores/api/@codes';
import Fieldset from '@/themes/default/components/Fieldset';
import FormField from '@/themes/default/components/FormField';
import Button from '@/themes/default/components/Button';
import SubPage from '../../components/SubPage';

import type { Settings } from '@/stores/api/settings';

type Data = {
    isSaving: boolean,
    validationErrors: Record<string, string> | null,
    values: Pick<Settings, 'returnInventory'>,
};

/**
 * Page des paramètres des inventaires de départ / sortie
 * des événements / réservations.
 */
const InventoriesGlobalSettings = defineComponent({
    name: 'InventoriesGlobalSettings',
    data(): Data {
        return {
            isSaving: false,
            validationErrors: null,
            values: pick(this.$store.state.settings, [
                'returnInventory',
            ]),
        };
    },
    computed: {
        returnInventoryModeOptions(): Array<{ label: string, value: ReturnInventoryMode }> {
            const { $t: __ } = this;

            return Object.values(ReturnInventoryMode)
                .map((mode: ReturnInventoryMode) => ({
                    value: mode,
                    label: __(`page.settings.inventories.return.fill-mode.choices.${mode}`),
                }));
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

            const { $t: __, values } = this;
            this.isSaving = true;

            try {
                await apiSettings.update(values);

                this.validationErrors = null;

                this.$store.dispatch('settings/fetch');
                this.$toasted.success(__('page.settings.inventories.saved'));
            } catch (error) {
                if (error instanceof RequestError && error.code === ApiErrorCode.VALIDATION_FAILED) {
                    this.validationErrors = { ...error.details };
                    return;
                }

                // eslint-disable-next-line no-console
                console.error(`Error occurred while saving the settings`, error);
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
            validationErrors,
            returnInventoryModeOptions,
            handleSubmit,
        } = this;

        return (
            <SubPage
                class="InventoriesGlobalSettings"
                title={__('page.settings.inventories.title')}
                help={__('page.settings.inventories.help')}
                hasValidationError={!!validationErrors}
            >
                <form class="InventoriesGlobalSettings__form" onSubmit={handleSubmit}>
                    <Fieldset title={__('page.settings.inventories.return.section-title')}>
                        <FormField
                            type="radio"
                            name="returnInventory.mode"
                            label={__('page.settings.inventories.return.fill-mode.label')}
                            error={validationErrors?.['returnInventory.mode']}
                            v-model={values.returnInventory.mode}
                            options={returnInventoryModeOptions}
                        />
                    </Fieldset>
                    <section class="InventoriesGlobalSettings__actions">
                        <Button icon="save" htmlType="submit" type="primary" loading={isSaving}>
                            {isSaving ? __('saving') : __('save')}
                        </Button>
                    </section>
                </form>
            </SubPage>
        );
    },
});

export default InventoriesGlobalSettings;
