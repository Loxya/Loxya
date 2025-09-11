import './index.scss';
import DateTime, { DateTimeRoundingMethod } from '@/utils/datetime';
import { defineComponent } from 'vue';
import apiPasswordReset from '@/stores/api/password-reset';
import FormField from '@/themes/default/components/FormField';
import Button from '@/themes/default/components/Button';
import { HttpCode, RequestError } from '@/utils/requester';

import type { Payload } from '../..';
import type { PropType } from 'vue';

type Props = {
    /**
     * Fonction appelée à la fin de l'étape de récolte des informations
     * de réinitialisation (e-mail).
     *
     * @param payload - Les données de réinitialisation.
     */
    onFinish?(payload: Payload): void,
};

type Data = {
    value: string | null,
    validationError: string | null,
    isSubmitting: boolean,
};

/**
 * Étape de récupération de l'email dans le processus
 * de réinitialisation de mot de passe.
 */
const ResetPasswordPageInformationsStep = defineComponent({
    name: 'ResetPasswordPageInformationsStep',
    provide: {
        verticalForm: true,
    },
    props: {
        // eslint-disable-next-line vue/no-unused-properties
        onFinish: {
            type: Function as PropType<Props['onFinish']>,
            default: undefined,
        },
    },
    emits: ['finish'],
    data: (): Data => ({
        value: null,
        validationError: null,
        isSubmitting: false,
    }),
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
            const { __, value } = this;

            if (value === null || value.trim() === '') {
                this.validationError = __('errors.mandatory-email');
                return;
            }

            this.isSubmitting = true;
            try {
                const response = await apiPasswordReset.create(value);

                // - On réinitialise l'éventuelle erreur de validation.
                this.validationError = null;

                this.$emit('finish', { ...response, email: value });
            } catch (error) {
                this.isSubmitting = false;

                if (error instanceof RequestError) {
                    switch (error.httpCode) {
                        case HttpCode.Forbidden: {
                            window.location.reload();
                            return;
                        }

                        case HttpCode.BadRequest: {
                            this.validationError = __('errors.invalid-email');
                            return;
                        }

                        case HttpCode.TooManyRequests: {
                            let retryAt: DateTime | undefined;
                            const rawRetryAt = error.details?.retryAt;
                            if (rawRetryAt !== undefined) {
                                try {
                                    retryAt = new DateTime(rawRetryAt).roundMinutes(1, DateTimeRoundingMethod.CEIL);
                                    if (!retryAt.isFuture()) {
                                        retryAt = undefined;
                                    }
                                } catch {
                                    retryAt = undefined;
                                }
                            }

                            this.validationError = retryAt !== undefined
                                ? __('page.errors.resend-too-soon.with-delay', { time: retryAt.format('HH:mm') })
                                : __('page.errors.resend-too-soon.without-delay');
                            return;
                        }

                        // - No default.
                    }
                }

                // eslint-disable-next-line no-console
                console.error(`Error occurred while initiating a password reset`, error);
                this.$toasted.error(__('global.errors.unexpected'));
            }
        },

        __(key: string, params?: Record<string, number | string>, count?: number): string {
            if (!key.startsWith('global.')) {
                if (!key.startsWith('page.')) {
                    key = `page.steps.informations.${key}`;
                }
                key = key.replace(/^page\./, 'page.reset-password.');
            } else {
                key = key.replace(/^global\./, '');
            }
            return this.$t(key, params, count);
        },
    },
    render() {
        const { __, isSubmitting, validationError, handleSubmit } = this;

        return (
            <div class="ResetPasswordPageInformationsStep">
                <h1 class="ResetPasswordPageInformationsStep__title">
                    {__('title')}
                </h1>
                <p class="ResetPasswordPageInformationsStep__instruction">
                    {__('introduction')}
                </p>
                <form class="ResetPasswordPageInformationsStep__form" onSubmit={handleSubmit}>
                    <FormField
                        type="email"
                        label={__('global.email-address')}
                        error={validationError}
                        v-model={this.value}
                    />
                    <div class="ResetPasswordPageInformationsStep__form__action">
                        <Button
                            type="primary"
                            htmlType="submit"
                            size="full-width"
                            loading={isSubmitting}
                        >
                            {__('continue')}
                        </Button>
                    </div>
                </form>
            </div>
        );
    },
});

export default ResetPasswordPageInformationsStep;
