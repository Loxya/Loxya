import './index.scss';
import omit from 'lodash/omit';
import { RequestError } from '@/globals/requester';
import { defineComponent } from 'vue';
import CriticalError from '@/themes/default/components/CriticalError';
import Loading from '@/themes/default/components/Loading';
import FormField from '@/themes/default/components/FormField';
import Button from '@/themes/default/components/Button';
import apiUsers from '@/stores/api/users';
import { ApiErrorCode } from '@/stores/api/@codes';

import type { Simplify } from 'type-fest';
import type { Session } from '@/stores/api/session';
import type {
    UserDetails,
    UserEditSelf as UserEditSelfCore,
} from '@/stores/api/users';

type UserEditSelf = Simplify<(
    & UserEditSelfCore
    // eslint-disable-next-line @typescript-eslint/naming-convention
    & { password_confirmation: UserEditSelf['password'] }
)>;

const normalizeFormData = (savedData: Session | UserDetails): UserEditSelf => ({
    first_name: savedData.first_name,
    last_name: savedData.last_name,
    pseudo: savedData.pseudo,
    email: savedData.email,
    phone: savedData.phone,
    password: '',
    password_confirmation: '',
});

type Data = {
    hasCriticalError: boolean,
    isFetching: boolean,
    isSaving: boolean,
    data: UserEditSelf,
    validationErrors: Partial<Record<keyof UserEditSelf, string>> | undefined,
};

/** Onglet "profil" des paramètres utilisateur. */
const ProfileUserSettings = defineComponent({
    name: 'ProfileUserSettings',
    provide: {
        verticalForm: true,
    },
    data(): Data {
        const { user } = this.$store.state.auth;

        return {
            hasCriticalError: false,
            isFetching: false,
            isSaving: false,
            data: normalizeFormData(user),
            validationErrors: undefined,
        };
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
                this.data = normalizeFormData(await apiUsers.one('self'));
            } catch {
                this.hasCriticalError = true;
            } finally {
                this.isFetching = false;
            }
        },

        async save() {
            const { $t: __, data } = this;

            if (this.isSaving) {
                return;
            }
            this.isSaving = true;

            const hasPassword = !!data.password || !!data.password_confirmation;
            if (hasPassword && data.password !== data.password_confirmation) {
                this.validationErrors = {
                    ...this.validationErrors,
                    password: __('page.user-settings.profile.password-confirmation-must-match'),
                };
                return;
            }

            try {
                const postData: UserEditSelfCore = omit(data, ['password_confirmation']);
                const updatedUser = await apiUsers.update('self', postData);
                this.data = normalizeFormData(updatedUser);
                this.$store.commit('auth/updateUser', updatedUser);

                this.$toasted.success(
                    hasPassword
                        ? __('page.user-settings.profile.saved-with-password')
                        : __('page.user-settings.profile.saved'),
                );
                this.validationErrors = undefined;
            } catch (error) {
                if (error instanceof RequestError && error.code === ApiErrorCode.VALIDATION_FAILED) {
                    this.validationErrors = { ...error.details };
                    return;
                }

                // eslint-disable-next-line no-console
                console.error(`Error occurred while saving the user profile`, error);
                this.$toasted.error(__('errors.unexpected-while-saving'));
            } finally {
                this.isSaving = false;
            }
        },
    },
    render() {
        const {
            $t: __,
            hasCriticalError,
            isFetching,
            isSaving,
            data,
            validationErrors,
            handleSave,
        } = this;

        if (hasCriticalError || isFetching) {
            return (
                <div class="ProfileUserSettings">
                    {hasCriticalError ? <CriticalError /> : <Loading class="ProfileUserSettings__loading" />}
                </div>
            );
        }

        return (
            <form class="ProfileUserSettings" onSubmit={handleSave}>
                <section class="ProfileUserSettings__section ProfileUserSettings__section--infos">
                    <h3 class="ProfileUserSettings__section__title">{__('personal-infos')}</h3>
                    <div class="ProfileUserSettings__section__body">
                        <div class="ProfileUserSettings__name">
                            <FormField
                                class="ProfileUserSettings__first-name"
                                v-model={data.first_name}
                                name="first_name"
                                label="first-name"
                                error={validationErrors?.first_name}
                                required
                            />
                            <FormField
                                class="ProfileUserSettings__last-name"
                                v-model={data.last_name}
                                name="last_name"
                                label="last-name"
                                error={validationErrors?.last_name}
                                required
                            />
                        </div>
                        <FormField
                            v-model={data.phone}
                            name="phone"
                            label="phone"
                            type="tel"
                            error={validationErrors?.phone}
                        />
                    </div>
                </section>
                <section class="ProfileUserSettings__section">
                    <h3 class="ProfileUserSettings__section__title">{__('connexion-infos')}</h3>
                    <div class="ProfileUserSettings__section__body">
                        <FormField
                            v-model={data.pseudo}
                            name="pseudo"
                            label="pseudo"
                            error={validationErrors?.pseudo}
                            required
                        />
                        <FormField
                            v-model={data.email}
                            name="email"
                            label="email"
                            type="email"
                            error={validationErrors?.email}
                            required
                        />
                    </div>
                </section>
                <section class="ProfileUserSettings__section ProfileUserSettings__section--password">
                    <h3 class="ProfileUserSettings__section__title">
                        {__('page.user-settings.profile.new-password')}
                    </h3>
                    <p class="ProfileUserSettings__section__help">
                        {__('page.user-settings.profile.new-password-help')}
                    </p>
                    <div class="ProfileUserSettings__section__body">
                        <FormField
                            v-model={data.password}
                            name="password"
                            label="password"
                            type="password"
                            error={validationErrors?.password}
                        />
                        <FormField
                            v-model={data.password_confirmation}
                            name="passwordConfirmation"
                            label="page.user-settings.profile.password-confirmation"
                            type="password"
                        />
                    </div>
                </section>
                <section class="ProfileUserSettings__actions">
                    <Button icon="save" htmlType="submit" type="primary" loading={isSaving}>
                        {__('save')}
                    </Button>
                </section>
            </form>
        );
    },
});

export default ProfileUserSettings;
