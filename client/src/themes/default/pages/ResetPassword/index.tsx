import './index.scss';
import DateTime from '@/utils/datetime';
import { defineComponent, markRaw } from 'vue';
import Link from '@/themes/default/components/Link';

// - Étapes
import InformationsStep from './steps/Informations';
import VerificationStep from './steps/Verification';
import FinalizeStep from './steps/Finalize';

import type { Raw } from 'vue';

/* eslint-disable @typescript-eslint/naming-convention */
export type Payload = {
    email: string,
    token?: string,
    expires_at: Raw<DateTime>,
    resend_at: Raw<DateTime>,
};
/* eslint-enable @typescript-eslint/naming-convention */

type Data = {
    now: Raw<DateTime>,
    data: Payload | null,
};

type InstanceProperties = {
    nowTimer: ReturnType<typeof setInterval> | undefined,
};

/** Page de réinitialisation de mot de passe. */
const ResetPasswordPage = defineComponent({
    name: 'ResetPasswordPage',
    setup: (): InstanceProperties => ({
        nowTimer: undefined,
    }),
    data: (): Data => ({
        now: markRaw(DateTime.now()),
        data: null,
    }),
    computed: {
        isTokenExpired(): boolean {
            if (this.data?.token === undefined) {
                return false;
            }

            const expiresAt = this.data.expires_at;
            return expiresAt.isSameOrBefore(this.now);
        },
    },
    watch: {
        isTokenExpired(isTokenExpired: boolean) {
            if (!isTokenExpired) {
                return;
            }
            this.handleTokenExpiration();
        },
    },
    mounted() {
        // - Actualise le timestamp courant toutes les secondes.
        this.nowTimer = setInterval(() => { this.now = markRaw(DateTime.now()); }, 1000);
    },
    beforeDestroy() {
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

        handleUpdate(payload: Payload) {
            this.data = payload;
        },

        handleTokenExpiration() {
            const { __ } = this;

            this.$toasted.error(__('errors.reset-session-expired'), { duration: 50_000 });
            this.data = null;
        },

        // ------------------------------------------------------
        // -
        // -    Méthodes internes
        // -
        // ------------------------------------------------------

        __(key: string, params?: Record<string, number | string>, count?: number): string {
            key = !key.startsWith('global.')
                ? `page.reset-password.${key}`
                : key.replace(/^global\./, '');

            return this.$t(key, params, count);
        },
    },
    render() {
        const { __, data, handleUpdate } = this;

        const renderStep = (): JSX.Node => {
            if (data !== null) {
                return data.token === undefined
                    ? <VerificationStep data={data} onUpdate={handleUpdate} />
                    : <FinalizeStep data={data} />;
            }
            return <InformationsStep onFinish={handleUpdate} />;
        };

        return (
            <div class="ResetPasswordPage">
                <div class="ResetPasswordPage__body">
                    {renderStep()}
                </div>
                <div class="ResetPasswordPage__footer">
                    <Link to={{ name: 'login' }} variant="primary">
                        {__('return-to-login')}
                    </Link>
                </div>
            </div>
        );
    },
});

export default ResetPasswordPage;
