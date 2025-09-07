import './index.scss';
import Vue, { defineComponent } from 'vue';
import config from '@/globals/config';
import { RequestError } from '@/globals/requester';
import { Group } from '@/stores/api/groups';
import apiUsers, { BookingsViewMode, TechniciansViewMode } from '@/stores/api/users';
import CriticalError from '@/themes/default/components/CriticalError';
import Loading from '@/themes/default/components/Loading';
import Fieldset from '@/themes/default/components/Fieldset';
import FormField from '@/themes/default/components/FormField';
import Button from '@/themes/default/components/Button';
import { ApiErrorCode } from '@/stores/api/@codes';

import type { UserSettings } from '@/stores/api/users';
import type { Options } from '@/utils/formatOptions';

type FormData = Pick<UserSettings, (
    | 'language'
    | 'default_bookings_view'
    | 'default_technicians_view'
    | 'disable_contextual_popovers'
    | 'disable_search_persistence'
)>;

type Data = {
    hasCriticalError: boolean,
    isFetching: boolean,
    isSaving: boolean,
    data: FormData,
    validationErrors: Record<keyof FormData, string> | undefined,
};

const normalizeFormData = (savedData?: UserSettings): FormData => ({
    language: savedData?.language ?? '',
    default_bookings_view: savedData?.default_bookings_view ?? BookingsViewMode.CALENDAR,
    default_technicians_view: savedData?.default_technicians_view ?? TechniciansViewMode.LISTING,
    disable_contextual_popovers: savedData?.disable_contextual_popovers ?? false,
    disable_search_persistence: savedData?.disable_search_persistence ?? false,
});

/** Onglet "interface" des paramètres utilisateur. */
const InterfaceUserSettings = defineComponent({
    name: 'InterfaceUserSettings',
    provide: {
        verticalForm: true,
    },
    data: (): Data => ({
        hasCriticalError: false,
        isFetching: false,
        isSaving: false,
        data: normalizeFormData(),
        validationErrors: undefined,
    }),
    computed: {
        isTeamMember(): boolean {
            return this.$store.getters['auth/is']([
                Group.ADMINISTRATION,
                Group.SUPERVISION,
                Group.OPERATION,
            ]);
        },

        isTechniciansEnabled(): boolean {
            return config.features.technicians;
        },

        langsOptions: (): Options<{ id: 'fr' | 'en' }> => [
            { label: 'Français', value: 'fr' },
            { label: 'English', value: 'en' },
        ],

        bookingsViewModesOptions(): Options<{ id: BookingsViewMode }> {
            const { __ } = this;

            return [
                {
                    label: __('bookings-view-mode.options.calendar'),
                    value: BookingsViewMode.CALENDAR,
                },
                {
                    label: __('bookings-view-mode.options.listing'),
                    value: BookingsViewMode.LISTING,
                },
            ];
        },

        techniciansViewModesOptions(): Options<{ id: TechniciansViewMode }> {
            const { __ } = this;

            return [
                {
                    label: __('technicians-view-mode.options.listing'),
                    value: TechniciansViewMode.LISTING,
                },
                {
                    label: __('technicians-view-mode.options.timeline'),
                    value: TechniciansViewMode.TIMELINE,
                },
            ];
        },
    },
    mounted() {
        this.fetch();
    },
    methods: {
        // ------------------------------------------------------
        // -
        // -    Handlers
        // -
        // ------------------------------------------------------

        handleSave(e: SubmitEvent) {
            e.preventDefault();

            this.save();
        },

        // ------------------------------------------------------
        // -
        // -    Méthodes internes
        // -
        // ------------------------------------------------------

        async fetch() {
            this.isFetching = true;

            try {
                this.data = normalizeFormData(await apiUsers.getSettings('self'));
            } catch {
                this.hasCriticalError = true;
            } finally {
                this.isFetching = false;
            }
        },

        async save() {
            const { __ } = this;

            if (this.isSaving) {
                return;
            }
            this.isSaving = true;

            try {
                const updatedSettings = await apiUsers.updateSettings('self', this.data);
                this.data = normalizeFormData(updatedSettings);
                this.$toasted.success(__('page.saved'));
                this.validationErrors = undefined;

                localStorage.setItem('userLocale', updatedSettings.language);
                this.$store.commit('auth/setLocale', updatedSettings.language);
                this.$store.commit('auth/setInterfaceSettings', updatedSettings);
                Vue.i18n.set(updatedSettings.language);
            } catch (error) {
                if (error instanceof RequestError && error.code === ApiErrorCode.VALIDATION_FAILED) {
                    this.validationErrors = { ...error.details };
                    return;
                }

                // eslint-disable-next-line no-console
                console.error(`Error occurred while saving the user settings`, error);
                this.$toasted.error(__('global.errors.unexpected-while-saving'));
            } finally {
                this.isSaving = false;
            }
        },

        __(key: string, params?: Record<string, number | string>, count?: number): string {
            if (!key.startsWith('global.')) {
                if (!key.startsWith('page.')) {
                    key = `page.interface.${key}`;
                }
                key = key.replace(/^page\./, 'page.user-settings.');
            } else {
                key = key.replace(/^global\./, '');
            }
            return this.$t(key, params, count);
        },
    },
    render() {
        const {
            __,
            isSaving,
            isFetching,
            isTeamMember,
            isTechniciansEnabled,
            hasCriticalError,
            data,
            langsOptions,
            bookingsViewModesOptions,
            techniciansViewModesOptions,
            validationErrors,
            handleSave,
        } = this;

        if (hasCriticalError || isFetching) {
            return (
                <div class="InterfaceUserSettings">
                    {hasCriticalError ? <CriticalError /> : <Loading class="InterfaceUserSettings__loading" />}
                </div>
            );
        }

        return (
            <form class="InterfaceUserSettings" onSubmit={handleSave}>
                <section class="InterfaceUserSettings__inputs">
                    <Fieldset>
                        <FormField
                            type="select"
                            options={langsOptions}
                            v-model={data.language}
                            error={validationErrors?.language}
                            label={__('language')}
                            class="InterfaceUserSettings__language"
                            placeholder={false}
                        />
                    </Fieldset>
                    <Fieldset title={__('default-views')}>
                        <div class="InterfaceUserSettings__default-views">
                            <FormField
                                type="select"
                                options={bookingsViewModesOptions}
                                v-model={data.default_bookings_view}
                                error={validationErrors?.default_bookings_view}
                                label={__('bookings-view-mode.label')}
                                class="InterfaceUserSettings__default-views__item"
                                placeholder={false}
                            />
                            {(isTeamMember && isTechniciansEnabled) && (
                                <FormField
                                    type="select"
                                    options={techniciansViewModesOptions}
                                    v-model={data.default_technicians_view}
                                    error={validationErrors?.default_technicians_view}
                                    label={__('technicians-view-mode.label')}
                                    class="InterfaceUserSettings__default-views__item"
                                    placeholder={false}
                                />
                            )}
                        </div>
                    </Fieldset>
                    <Fieldset title={__('interactions')}>
                        <div class="InterfaceUserSettings__interactions">
                            <FormField
                                type="switch"
                                v-model={data.disable_search_persistence}
                                error={validationErrors?.disable_search_persistence}
                                label={__('disable-search-persistence')}
                                class="InterfaceUserSettings__interactions__item"
                            />
                            <FormField
                                type="switch"
                                v-model={data.disable_contextual_popovers}
                                error={validationErrors?.disable_contextual_popovers}
                                label={__('disable-contextual-popover')}
                                class="InterfaceUserSettings__interactions__item"
                            />
                        </div>
                    </Fieldset>
                </section>
                <section class="InterfaceUserSettings__actions">
                    <Button icon="save" htmlType="submit" type="primary" loading={isSaving}>
                        {__('global.save')}
                    </Button>
                </section>
            </form>
        );
    },
});

export default InterfaceUserSettings;
