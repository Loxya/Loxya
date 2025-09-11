import './index.scss';
import { defineComponent } from 'vue';
import { HttpCode, RequestError } from '@/globals/requester';
import Loading from '@/themes/default/components/Loading';
import Link from '@/themes/default/components/Link';

/**
 * Raison ayant conduit l'utilisateur à être redirigé
 * vers la page de login.
 */
enum RouteEntryCause {
    /** L'utilisateur a explicitement fermé sa session. */
    SESSION_LOGOUT = 'session-logout',

    /** La session de l'utilisateur a expiré. */
    SESSION_EXPIRED = 'session-expired',

    /** L'accès a une partie de l'application a été refusé. */
    ACCESS_RESTRICTED = 'access-restricted',
}

type Data = {
    showEntryCause: boolean,
    isSubmitting: boolean,
    hasCredentialsError: boolean,
    credentials: {
        identifier: string | null,
        password: string | null,
    },
};

/** Page de connexion. */
const Login = defineComponent({
    name: 'Login',
    data: (): Data => ({
        showEntryCause: true,
        isSubmitting: false,
        hasCredentialsError: false,
        credentials: {
            identifier: null,
            password: null,
        },
    }),
    computed: {
        entryCause(): RouteEntryCause | undefined {
            const hashMap = new Map([
                ['#bye', RouteEntryCause.SESSION_LOGOUT],
                ['#expired', RouteEntryCause.SESSION_EXPIRED],
                ['#restricted', RouteEntryCause.ACCESS_RESTRICTED],
            ]);
            return hashMap.get(this.$route.hash);
        },
    },
    methods: {
        // ------------------------------------------------------
        // -
        // -    Handlers
        // -
        // ------------------------------------------------------

        handleSubmit(e: SubmitEvent) {
            e.preventDefault();

            this.login();
        },

        // ------------------------------------------------------
        // -
        // -    Méthodes internes
        // -
        // ------------------------------------------------------

        async login() {
            const { __ } = this;
            if (this.isSubmitting) {
                return;
            }

            this.isSubmitting = true;
            this.showEntryCause = false;
            try {
                await this.$store.dispatch('auth/login', { ...this.credentials });
                this.hasCredentialsError = false;
                this.$router.replace('/');
            } catch (error) {
                this.isSubmitting = false;
                this.hasCredentialsError = false;

                if (error instanceof RequestError) {
                    switch (error.httpCode) {
                        case HttpCode.Forbidden:
                        case HttpCode.BadRequest:
                        case HttpCode.Unauthorized: {
                            this.hasCredentialsError = true;
                            return;
                        }
                        // - No default.
                    }
                }

                // eslint-disable-next-line no-console
                console.error(`Error occurred while logging in:`, error);
                this.$toasted.error(__('global.errors.api-unreachable'));
            }
        },

        __(key: string, params?: Record<string, number | string>, count?: number): string {
            key = !key.startsWith('global.')
                ? `page.login.${key}`
                : key.replace(/^global\./, '');

            return this.$t(key, params, count);
        },
    },
    render() {
        const {
            __,
            showEntryCause,
            entryCause,
            credentials,
            isSubmitting,
            hasCredentialsError,
            handleSubmit,
        } = this;

        const renderMessage = (): JSX.Node => {
            if (isSubmitting) {
                return (
                    <div class={['Login__message', 'Login__message--default']}>
                        <Loading message={__('please-wait')} horizontal />
                    </div>
                );
            }

            if (hasCredentialsError) {
                return (
                    <div class={['Login__message', 'Login__message--error']}>
                        {__('error.bad-infos')}
                    </div>
                );
            }

            let type: 'default' | 'success' | 'error' = 'default';
            let message: string = __('welcome');
            if (showEntryCause && entryCause !== undefined) {
                switch (entryCause) {
                    case RouteEntryCause.SESSION_LOGOUT: {
                        type = 'success';
                        message = __('bye');
                        break;
                    }
                    case RouteEntryCause.SESSION_EXPIRED: {
                        type = 'error';
                        message = __('error.expired-session');
                        break;
                    }
                    case RouteEntryCause.ACCESS_RESTRICTED: {
                        type = 'error';
                        message = __('error.not-allowed');
                        break;
                    }
                    // - No default.
                }
            }

            return (
                <div class={['Login__message', `Login__message--${type}`]}>
                    {message}
                </div>
            );
        };

        return (
            <div class="Login">
                {renderMessage()}
                <div class="Login__body">
                    <form class="Login__form" onSubmit={handleSubmit}>
                        <input
                            type="text"
                            value={credentials.identifier}
                            autocomplete="username"
                            class="Login__form__input"
                            placeholder={__('global.email-address-or-pseudo')}
                            onInput={(e: InputEvent) => {
                                const { value } = e.target! as HTMLInputElement;
                                credentials.identifier = value;
                            }}
                        />
                        <div class="Login__form__password">
                            <input
                                type="password"
                                value={credentials.password}
                                autocomplete="current-password"
                                placeholder={__('global.password')}
                                class={[
                                    'Login__form__input',
                                    'Login__form__password__input',
                                ]}
                                onInput={(e: InputEvent) => {
                                    const { value } = e.target! as HTMLInputElement;
                                    credentials.password = value;
                                }}
                            />
                            <Link
                                to={{ name: 'reset-password' }}
                                class="Login__form__password__forgot-link"
                            >
                                {__('forgot-password')}
                            </Link>
                        </div>
                        <button type="submit" class="Login__form__submit" disabled={isSubmitting}>
                            {__('connexion')}
                        </button>
                    </form>
                </div>
            </div>
        );
    },
});

export default Login;
