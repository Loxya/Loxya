import './index.scss';
import { defineComponent } from 'vue';
import config from '@/globals/config';
import Logo from '@/themes/default/components/Logo';

/** Variante "vide" du template de l'application. */
const BlankLayout = defineComponent({
    name: 'BlankLayout',
    computed: {
        version(): string {
            return config.version;
        },
    },
    render() {
        const { $t: __, version } = this;
        const children = this.$slots.default;

        return (
            <div class="BlankLayout">
                <div class="BlankLayout__body">
                    <div class="BlankLayout__logo">
                        <Logo />
                    </div>
                    <div class="BlankLayout__content">
                        {children}
                    </div>
                </div>
                <div class="BlankLayout__footer">
                    {__('layout.blank.footer-text')}<br />
                    <a
                        class="BlankLayout__footer__link"
                        href="https://loxya.com"
                        target="_blank"
                        rel="noreferrer"
                    >
                        {__('external-links.official-website')}
                    </a>
                    {' '}|{' '}
                    <a
                        class="BlankLayout__footer__link"
                        href="https://forum.robertmanager.org"
                        target="_blank"
                        rel="noreferrer"
                    >
                        {__('external-links.support-platform')}
                    </a>
                    {' '}|{' '}
                    v{version}
                </div>
            </div>
        );
    },
});

export default BlankLayout;
