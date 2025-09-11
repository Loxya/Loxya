import './index.scss';
import { defineComponent } from 'vue';
import apiPasswordReset from '@/stores/api/password-reset';
import FormField from '@/themes/default/components/FormField';
import Button from '@/themes/default/components/Button';
import { HttpCode, RequestError } from '@/utils/requester';

import type { Payload } from '../..';
import type { PropType } from 'vue';

type Props = {
    data: Payload,
};

type Data = {
    values: Record<'password' | 'confirmation', string | null>,
    validationErrors: Record<string, string> | null,
    isSubmitting: boolean,
};

/**
 * Étape de finalisation (changement du mot de passe)
 * dans le processus de réinitialisation de mot de passe.
 */
const ResetPasswordPageFinalizeStep = defineComponent({
    name: 'ResetPasswordPageFinalizeStep',
    provide: {
        verticalForm: true,
    },
    props: {
        data: {
            type: Object as PropType<Props['data']>,
            required: true,
        },
    },
    data: (): Data => ({
        validationErrors: null,
        isSubmitting: false,
        values: {
            password: null,
            confirmation: null,
        },
    }),
    computed: {
        token(): string {
            return this.data.token!;
        },
    },
    methods: {
        // ------------------------------------------------------
        // -
        // -    Handlers
        // -
        // ------------------------------------------------------

        handleSubmit(e: SubmitEvent): void {
            e.preventDefault();

            this.submit();
        },

        // ------------------------------------------------------
        // -
        // -    Méthodes internes
        // -
        // ------------------------------------------------------

        async submit(): Promise<void> {
            if (this.isSubmitting) {
                return;
            }
            const { __, token, values: { password, confirmation } } = this;

            // - Validation
            const validationErrors = new Map<'password' | 'confirmation', string>();
            if (password === null || password.trim() === '') {
                validationErrors.set('password', __('errors.mandatory-field'));
            }
            if (confirmation === null || confirmation.trim() === '') {
                validationErrors.set('confirmation', __('errors.mandatory-field'));
            }
            if (validationErrors.size === 0 && password !== confirmation) {
                validationErrors.set('confirmation', __('errors.invalid-confirmation'));
            }
            if (validationErrors.size !== 0) {
                this.validationErrors = Object.fromEntries(validationErrors);
                return;
            }

            this.isSubmitting = true;
            try {
                await apiPasswordReset.finalize(token, password!);

                // - On réinitialise l'éventuelle erreur de validation.
                this.validationErrors = null;

                // - On redirige vers l'accueil.
                this.$toasted.success(__('password-modified'), { duration: 20_000 });
                this.$router.push({ name: 'login' });
            } catch (error) {
                this.isSubmitting = false;

                if (error instanceof RequestError && error.httpCode === HttpCode.BadRequest) {
                    this.validationErrors = { ...error.details };
                    return;
                }

                // eslint-disable-next-line no-console
                console.error(`Error occurred while finalizing the password reset`, error);
                this.$toasted.error(__('global.errors.unexpected'));
            }
        },

        __(key: string, params?: Record<string, number | string>, count?: number): string {
            if (!key.startsWith('global.')) {
                if (!key.startsWith('page.')) {
                    key = `page.steps.finalization.${key}`;
                }
                key = key.replace(/^page\./, 'page.reset-password.');
            } else {
                key = key.replace(/^global\./, '');
            }
            return this.$t(key, params, count);
        },
    },
    render() {
        const { __, isSubmitting, validationErrors, handleSubmit } = this;

        return (
            <div class="ResetPasswordPageFinalizeStep">
                <h1 class="ResetPasswordPageFinalizeStep__title">
                    {__('title')}
                </h1>
                <p class="ResetPasswordPageFinalizeStep__instruction">
                    {__('introduction')}
                </p>
                <form class="ResetPasswordPageFinalizeStep__form" onSubmit={handleSubmit}>
                    <div class="ResetPasswordPageFinalizeStep__form__fields">
                        <FormField
                            type="password"
                            autocomplete="new-password"
                            label={__('fields.password')}
                            error={validationErrors?.password}
                            v-model={this.values.password}
                            required
                        />
                        <FormField
                            type="password"
                            autocomplete="new-password"
                            label={__('fields.password-confirmation')}
                            error={validationErrors?.confirmation}
                            v-model={this.values.confirmation}
                            required
                        />
                    </div>
                    <div class="ResetPasswordPageFinalizeStep__form__action">
                        <Button
                            type="primary"
                            htmlType="submit"
                            size="full-width"
                            loading={isSubmitting}
                        >
                            {__('action')}
                        </Button>
                    </div>
                </form>
            </div>
        );
    },
});

export default ResetPasswordPageFinalizeStep;
