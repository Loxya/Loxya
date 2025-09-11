import './index.scss';
import debounce from 'lodash/debounce';
import { ApiErrorCode } from '@/stores/api/@codes';
import { defineComponent, markRaw } from 'vue';
import DateTime, { DateTimeRoundingMethod } from '@/utils/datetime';
import apiPasswordReset from '@/stores/api/password-reset';
import { RequestError, HttpCode } from '@/globals/requester';
import Button from '@/themes/default/components/Button';
import Interpolated from '@/components/Interpolated';
import Fragment from '@/components/Fragment';

import type { Payload } from '../..';
import type { DebouncedMethod } from 'lodash';
import type { PropType, Raw } from 'vue';

/** La longueur du code de vérification. */
const CODE_LENGTH = 6;

/** Le temps de debounce avant de soumettre la vérification du code. */
const DEBOUNCE_WAIT_DURATION = DateTime.duration(1, 's');

type Props = {
    /** Les données de réinitialisation. */
    data: Payload,

    /**
     * Fonction appelée lorsque les données de réinitialisation sont mises à jour.
     * (Notamment la partie liée à l’authentification de la requête (token, date d'expiration du token))
     *
     * @param payload - Les nouvelles données de réinitialisation.
     */
    onUpdate?(payload: Payload): void,

    /**
     * Fonction appelée lorsque l'authentification de la requête est terminée.
     *
     * @param payload - Les données de réinitialisation finales.
     */
    onFinish?(payload: Payload): void,
};

type InstanceProperties = {
    nowTimer: ReturnType<typeof setInterval> | undefined,
    handleVerifyDebounced: (
        | DebouncedMethod<typeof ResetPasswordPageVerificationStep, 'handleVerify'>
        | undefined
    ),
};

type Data = {
    now: Raw<DateTime>,
    code: Array<number | null>,
    lastSentAt: Raw<DateTime> | null,
    hasReachedMaxAttempts: boolean,
    wrongCodes: string[],
    isSending: boolean,
    isProcessing: boolean,
    focusedIndex: number | null,
};

const getDefaultCode = (): Array<number | null> => (
    Array.from({ length: CODE_LENGTH }, () => null)
);

/**
 * Étape de vérification du code envoyé par e-mail dans
 * le processus de réinitialisation de mot de passe.
 */
const ResetPasswordPageVerificationStep = defineComponent({
    name: 'ResetPasswordPageVerificationStep',
    props: {
        data: {
            type: Object as PropType<Props['data']>,
            required: true,
        },
        // eslint-disable-next-line vue/no-unused-properties
        onUpdate: {
            type: Function as PropType<Props['onUpdate']>,
            default: undefined,
        },
        // eslint-disable-next-line vue/no-unused-properties
        onFinish: {
            type: Function as PropType<Props['onFinish']>,
            default: undefined,
        },
    },
    emits: ['update', 'finish'],
    setup: (): InstanceProperties => ({
        nowTimer: undefined,
        handleVerifyDebounced: undefined,
    }),
    data: (): Data => ({
        now: markRaw(DateTime.now()),
        code: getDefaultCode(),
        hasReachedMaxAttempts: false,
        wrongCodes: [],
        lastSentAt: null,
        isSending: false,
        isProcessing: false,
        focusedIndex: null,
    }),
    computed: {
        email(): string {
            return this.data.email;
        },

        isVerified(): boolean {
            return this.data.token !== undefined;
        },

        hasOngoingVerificationRaw(): boolean {
            if (this.isVerified) {
                return false;
            }

            const expiresAt = this.data.expires_at;
            return expiresAt.isAfter(this.now);
        },

        hasOngoingVerification(): boolean {
            return (
                !this.hasReachedMaxAttempts &&
                this.hasOngoingVerificationRaw
            );
        },

        hasJustSent(): boolean {
            if (this.lastSentAt === null) {
                return false;
            }

            // - Si l'envoi date d'il y a moins de 20s, on
            //   considère que l'on vient juste d'envoyer.
            const adjustedNow = this.now.subSecond(20);
            return this.lastSentAt?.isAfter(adjustedNow);
        },

        canResendAt(): DateTime {
            return this.data.resend_at;
        },

        remainingSecondsBeforeResend(): number {
            if (this.canResendAt === null) {
                return 0;
            }
            return Math.max(0, Math.ceil(this.canResendAt.diff(this.now, 'seconds')));
        },

        canResend(): boolean {
            return this.remainingSecondsBeforeResend === 0;
        },

        isComplete(): boolean {
            return this.code.every((digit: number | null) => digit !== null);
        },

        isWrongCode(): boolean {
            if (!this.isComplete) {
                return false;
            }
            return this.wrongCodes.includes(this.code.join(''));
        },

        isVerifiable(): boolean {
            if (this.isVerified || !this.hasOngoingVerification || !this.isComplete) {
                return false;
            }
            return !this.isWrongCode;
        },
    },
    watch: {
        hasOngoingVerificationRaw(hasOngoingVerification: boolean) {
            if (hasOngoingVerification) {
                return;
            }

            // - On annule la soumission de la vérification du code car
            //   il n'y a plus de vérification en cours.
            this.handleVerifyDebounced!.cancel();

            // - On reset les données.
            this.hasReachedMaxAttempts = false;
            this.code = getDefaultCode();
            this.wrongCodes = [];
        },
        isVerified(isVerified: boolean) {
            if (!isVerified) {
                return;
            }

            // - On annule la soumission de la vérification du code
            //   car le compte est déjà vérifié.
            this.handleVerifyDebounced!.cancel();

            // - On reset les données.
            this.hasReachedMaxAttempts = false;
            this.code = getDefaultCode();
            this.lastSentAt = null;
            this.wrongCodes = [];
        },
        isComplete(isComplete: boolean) {
            if (!isComplete) {
                // - On annule la soumission de la vérification du code
                //   car le code saisi n'est plus complet.
                this.handleVerifyDebounced!.cancel();
                return;
            }

            if (this.isVerifiable && !this.isSending && !this.isProcessing) {
                this.handleVerifyDebounced!();
            }
        },
    },
    created() {
        this.handleVerifyDebounced = debounce(
            this.handleVerify.bind(this),
            DEBOUNCE_WAIT_DURATION.asMilliseconds(),
        );
    },
    mounted() {
        // - Actualise le timestamp courant toutes les secondes.
        this.nowTimer = setInterval(() => { this.now = markRaw(DateTime.now()); }, 1000);
    },
    beforeDestroy() {
        this.handleVerifyDebounced?.cancel();

        if (this.nowTimer) {
            clearInterval(this.nowTimer);
        }
    },
    methods: {
        // ------------------------------------------------------
        // -
        // -    Handlers
        // -
        // ------------------------------------------------------

        async handleResend(): Promise<void> {
            if (this.isVerified || !this.canResend || this.isSending || this.isProcessing) {
                return;
            }
            this.isSending = true;
            const { __, email } = this;

            // - On annule la soumission de la vérification du code
            //   car la personne a demandée le renvoi et le champ va être vidé.
            this.handleVerifyDebounced!.cancel();

            // - On reset le code.
            this.code = getDefaultCode();

            // - On reset les codes faux, vu que le code va changer.
            this.wrongCodes = [];

            try {
                const response = await apiPasswordReset.create(email);
                this.$emit('update', { ...response, email });
                this.hasReachedMaxAttempts = false;
                this.lastSentAt = markRaw(DateTime.now());
            } catch (error) {
                if (error instanceof RequestError) {
                    switch (error.httpCode) {
                        case HttpCode.Forbidden:
                        case HttpCode.BadRequest: {
                            window.location.reload();
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

                            this.$toasted.error(
                                retryAt !== undefined
                                    ? __('page.errors.resend-too-soon.with-delay', { time: retryAt.format('HH:mm') })
                                    : __('page.errors.resend-too-soon.without-delay'),
                            );

                            // - On met à jour les données locales car on n'est plus synchronisé.
                            //   (sinon l'utilisateur n'aurait pas pu demander le renvoi)
                            this.$emit('update', { ...this.data, resend_at: retryAt });
                            return;
                        }

                        // - No default.
                    }
                }

                // eslint-disable-next-line no-console
                console.error(`Error occurred while re-initiating (resend) a password reset`, error);
                this.$toasted.error(__('global.errors.unexpected'));
            } finally {
                this.isSending = false;
            }
        },

        async handleVerify(): Promise<void> {
            if (!this.isVerifiable || this.isSending || this.isProcessing) {
                return;
            }
            this.isProcessing = true;

            const { __, email } = this;
            const code = this.code.join('');
            try {
                const response = await apiPasswordReset.verify(email, code);
                const payload: Payload = { ...this.data, ...response };
                this.$emit('update', payload);
                this.$emit('finish', payload);
            } catch (error) {
                this.isProcessing = false;

                if (error instanceof RequestError) {
                    switch (error.httpCode) {
                        case HttpCode.Forbidden: {
                            window.location.reload();
                            return;
                        }

                        case HttpCode.BadRequest: {
                            if (error.code === ApiErrorCode.PASSWORD_RESET_WRONG_CODE) {
                                this.wrongCodes.push(code);
                                this.$toasted.error(__('errors.wrong-code'));
                                return;
                            }
                            window.location.reload();
                            return;
                        }

                        case HttpCode.TooManyRequests: {
                            // - Nombre de tentative de vérification dépassé, on reset
                            //   et on force la demande d'un nouveau code.
                            if (error.code === ApiErrorCode.PASSWORD_RESET_TOO_MANY_ATTEMPTS) {
                                this.hasReachedMaxAttempts = true;
                                this.code = getDefaultCode();
                                this.wrongCodes = [];
                                return;
                            }
                        }

                        // - No default.
                    }
                }

                // eslint-disable-next-line no-console
                console.error(`Error occurred while verifying the pending user`, error);
                this.$toasted.error(__('global.errors.unexpected'));
            }
        },

        handleInput(e: InputEvent, editedIndex: number) {
            if (this.isVerified || !this.hasOngoingVerification || this.isSending || this.isProcessing) {
                return;
            }

            // - Si cet index n'existe pas ou qu'il est déjà défini, on empêche la modif.
            if (this.code.at(editedIndex) === undefined) {
                this.$forceUpdate();
                return;
            }

            // - Si ce n'est pas l'index 0 et que l'index précédent n'est pas rempli, on empêche la modif.
            if (editedIndex !== 0 && (this.code.at(editedIndex - 1)!) === null) {
                this.$forceUpdate();
                return;
            }

            const { value } = e.target as HTMLInputElement;
            const normalizedValue = value.replaceAll(/[\s\u00A0]+/g, '');
            if (
                !/^[0-9]{1,6}$/.test(normalizedValue) ||
                normalizedValue.length > (CODE_LENGTH - editedIndex)
            ) {
                this.$forceUpdate();
                return;
            }

            // - On annule la soumission de la vérification du code car
            //   le contenu du champ va potentiellement changer.
            this.handleVerifyDebounced!.cancel();

            // - On met à jour le code.
            const code: Array<number | null> = Array.from(
                { length: CODE_LENGTH - editedIndex },
                (_: any, index: number) => {
                    const char = normalizedValue[index];
                    return char !== undefined ? parseInt(char, 10) : null;
                },
            );
            code.forEach((digit: number | null, index: number) => {
                this.$set(this.code, editedIndex + index, digit);
            });

            // - On met à jour la vue ...
            this.$forceUpdate();

            // - ... et on focus le champ suivant si possible, sinon on blur.
            const nextIndex = editedIndex + normalizedValue.length;
            if (nextIndex <= CODE_LENGTH - 1) {
                this.$nextTick(() => { this.focusInput(nextIndex); });
            } else {
                this.$nextTick(() => { this.blurInput(editedIndex); });

                // - Si le champ est complet, on demande la vérification.
                if (this.isVerifiable) {
                    this.handleVerifyDebounced!();
                }
            }
        },

        handleKeydown(e: KeyboardEvent, editedIndex: number) {
            const { key } = e;

            if (this.isVerified || !this.hasOngoingVerification || this.isSending || this.isProcessing) {
                return;
            }

            // - Si cet index n'existe pas ou qu'il est déjà défini, on empêche la modif.
            const value = this.code.at(editedIndex);
            if (value === undefined) {
                return;
            }

            // - Si ce n'est pas l'index 0 et que l'index précédent n'est pas rempli, on empêche la modif.
            if (editedIndex !== 0 && (this.code.at(editedIndex - 1)!) === null) {
                return;
            }

            const handlers: Record<string, () => void> = {
                'Backspace': () => {
                    e.preventDefault();

                    if (editedIndex === 0 && value === null) {
                        return;
                    }

                    // - On annule la soumission de la vérification du code
                    //   car le contenu du champ va changer.
                    this.handleVerifyDebounced!.cancel();

                    if (value !== null) {
                        Array.from({ length: CODE_LENGTH - editedIndex }).forEach(
                            (_: any, index: number) => {
                                this.$set(this.code, editedIndex + index, null);
                            },
                        );
                    } else if (editedIndex > 0) {
                        const deleteFromIndex = editedIndex - 1;
                        this.focusInput(deleteFromIndex);

                        Array.from({ length: CODE_LENGTH - deleteFromIndex }).forEach(
                            (_: any, index: number) => {
                                this.$set(this.code, deleteFromIndex + index, null);
                            },
                        );
                    }
                },
                'ArrowLeft': () => {
                    e.preventDefault();

                    if (editedIndex !== 0) {
                        this.focusInput(editedIndex - 1);
                    }
                },
                'ArrowRight': () => {
                    e.preventDefault();

                    if (editedIndex < CODE_LENGTH - 1 && value !== null) {
                        this.focusInput(editedIndex + 1);
                    }
                },
            };

            if (!Object.keys(handlers).includes(key)) {
                return;
            }

            handlers[key]();
        },

        handleFocus(index: number) {
            this.focusedIndex = index;

            // - On annule la soumission de la vérification du
            //   code car l'utilisateur a donné le focus à l'un
            //   des champs.
            this.handleVerifyDebounced!.cancel();
        },

        handleBlur() {
            this.focusedIndex = null;

            // - Si l'utilisateur a blur le champ et qu'il est complete,
            //   on demande la vérification.
            if (this.isVerifiable && !this.isSending && !this.isProcessing) {
                this.handleVerifyDebounced!();
            }
        },

        handleFinalize() {
            if (!this.isVerified) {
                return;
            }
            this.$emit('finish', this.data);
        },

        // ------------------------------------------------------
        // -
        // -    Méthodes internes
        // -
        // ------------------------------------------------------

        focusInput(index: number) {
            const $input = this.$refs[`digit-${index}`] as HTMLInputElement | undefined;
            if ($input === undefined) {
                return;
            }

            $input.focus();
            $input.select();
        },

        blurInput(index: number) {
            const $input = this.$refs[`digit-${index}`] as HTMLInputElement | undefined;
            if ($input === undefined) {
                return;
            }

            $input.blur();
        },

        __(key: string, params?: Record<string, number | string>, count?: number): string {
            if (!key.startsWith('global.')) {
                if (!key.startsWith('page.')) {
                    key = `page.steps.verification.${key}`;
                }
                key = key.replace(/^page\./, 'page.reset-password.');
            } else {
                key = key.replace(/^global\./, '');
            }
            return this.$t(key, params, count);
        },
    },
    render() {
        const {
            __,
            code,
            email,
            canResend,
            isSending,
            isVerified,
            isWrongCode,
            isProcessing,
            hasJustSent,
            focusedIndex,
            hasReachedMaxAttempts,
            hasOngoingVerification,
            remainingSecondsBeforeResend,
            handleResend,
            handleFocus,
            handleBlur,
            handleKeydown,
            handleInput,
            handleFinalize,
        } = this;

        const renderContent = (): JSX.Node => {
            if (isVerified) {
                return (
                    <Fragment>
                        <p class="ResetPasswordPageVerificationStep__text">
                            {__('verified.instructions')}
                        </p>
                        <Button type="primary" size="large" onClick={handleFinalize}>
                            {__('verified.action')}
                        </Button>
                    </Fragment>
                );
            }

            if (!hasOngoingVerification) {
                const renderAction = (): JSX.Node => {
                    if (canResend) {
                        return (
                            <Button
                                type="primary"
                                size="large"
                                loading={isSending}
                                disabled={isProcessing}
                                onClick={handleResend}
                            >
                                {__('without-ongoing.action.without-delay')}
                            </Button>
                        );
                    }

                    return (
                        <Button type="primary" size="large" disabled>
                            {__('without-ongoing.action.with-delay', {
                                seconds: remainingSecondsBeforeResend,
                            })}
                        </Button>
                    );
                };

                return (
                    <Fragment>
                        <p class="ResetPasswordPageVerificationStep__text">
                            {(
                                hasReachedMaxAttempts
                                    ? __('without-ongoing.instructions.too-many-attempts')
                                    : __('without-ongoing.instructions.obsolete')
                            )}
                        </p>
                        {renderAction()}
                    </Fragment>
                );
            }

            return (
                <Fragment>
                    <p class="ResetPasswordPageVerificationStep__text">
                        <Interpolated
                            text={__('with-ongoing.instructions', { email })}
                            placeholders={{
                                highlight: (content: string) => (
                                    <strong>{content}</strong>
                                ),
                            }}
                        />
                    </p>
                    <div
                        class={[
                            'ResetPasswordPageVerificationStep__code',
                            { 'ResetPasswordPageVerificationStep__code--invalid': isWrongCode },
                        ]}
                    >
                        {Array.from({ length: CODE_LENGTH }).map((_: unknown, index: number) => {
                            const value = code.at(index) ?? null;
                            const isPending = focusedIndex !== null && focusedIndex <= index;
                            const isDisabled = isProcessing || isSending || (
                                index !== 0 && (code.at(index - 1)!) === null
                            );

                            return (
                                <input
                                    key={index}
                                    ref={`digit-${index}`}
                                    type="text"
                                    inputmode="numeric"
                                    class="ResetPasswordPageVerificationStep__code__digit"
                                    value={isPending ? null : value}
                                    placeholder={(
                                        isPending
                                            ? (value?.toString() ?? undefined)
                                            : undefined
                                    )}
                                    disabled={isDisabled}
                                    onFocus={() => { handleFocus(index); }}
                                    onBlur={() => { handleBlur(); }}
                                    onInput={(e: InputEvent) => {
                                        handleInput(e, index);
                                    }}
                                    onKeydown={(e: KeyboardEvent) => {
                                        handleKeydown(e, index);
                                    }}
                                />
                            );
                        })}
                    </div>
                    <button
                        type="button"
                        class={[
                            'ResetPasswordPageVerificationStep__resend-text',
                            {
                                'ResetPasswordPageVerificationStep__resend-text--hidden': (
                                    !canResend && hasJustSent
                                ),
                            },
                        ]}
                        disabled={!canResend || isSending || isProcessing}
                        onClick={handleResend}
                    >
                        {(
                            canResend
                                ? __('with-ongoing.action-resend.without-delay')
                                : __('with-ongoing.action-resend.with-delay', {
                                    seconds: remainingSecondsBeforeResend,
                                })
                        )}
                    </button>
                </Fragment>
            );
        };

        return (
            <div class="ResetPasswordPageVerificationStep">
                <div class="ResetPasswordPageVerificationStep__body">
                    {renderContent()}
                </div>
            </div>
        );
    },
});

export default ResetPasswordPageVerificationStep;
