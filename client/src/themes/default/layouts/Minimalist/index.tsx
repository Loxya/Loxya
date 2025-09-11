import './index.scss';
import { defineComponent, markRaw } from 'vue';
import config from '@/globals/config';
import DateTime from '@/utils/datetime';
import Logo from '@/themes/default/components/Logo';

import type { Raw } from 'vue';

type InstanceProperties = {
    nowTimer: ReturnType<typeof setInterval> | undefined,
};

type Data = {
    now: Raw<DateTime>,
};

/**
 * Variante minimaliste du template de l'application.
 */
const MinimalistLayout = defineComponent({
    name: 'MinimalistLayout',
    setup: (): InstanceProperties => ({
        nowTimer: undefined,
    }),
    data: (): Data => ({
        now: markRaw(DateTime.now()),
    }),
    computed: {
        year(): string {
            return this.now.format('YYYY');
        },

        version(): string {
            return config.version;
        },
    },
    mounted() {
        // - Actualise le timestamp courant toutes les 10 minutes.
        this.nowTimer = setInterval(() => { this.now = markRaw(DateTime.now()); }, 10 * 60_000);
    },
    beforeDestroy() {
        if (this.nowTimer) {
            clearInterval(this.nowTimer);
        }
    },
    render() {
        const { $t: __, year, version } = this;
        const children = this.$slots.default;

        return (
            <div class="MinimalistLayout">
                <div class="MinimalistLayout__background" />
                <div class="MinimalistLayout__content">
                    <div class="MinimalistLayout__logo">
                        <Logo variant="light" />
                    </div>
                    <div class="MinimalistLayout__body">
                        <div class="MinimalistLayout__body__content">
                            {children}
                        </div>
                    </div>
                    <div class="MinimalistLayout__footer">
                        <a
                            class="MinimalistLayout__footer__link"
                            href="https://loxya.com"
                            target="_blank"
                            rel="noreferrer"
                        >
                            {__('external-links.official-website')}
                        </a>
                        {' '}|{' '}
                        <a
                            class="MinimalistLayout__footer__link"
                            href="https://forum.robertmanager.org"
                            target="_blank"
                            rel="noreferrer"
                        >
                            {__('external-links.support-platform')}
                        </a>
                        {' '}|{' '}
                        v{version}
                        {' '}|{' '}
                        {__('layout.minimalist.copyright', { year })}
                    </div>
                </div>
            </div>
        );
    },
});

export default MinimalistLayout;
