import './index.scss';
import Vue from 'vue';
import vuexI18n from 'vuex-i18n';
import { VTooltip } from 'v-tooltip';
import Toasted from 'vue-toasted';
import Portal from 'portal-vue';
import { getDefaultLang, getLang } from '@/globals/lang';
import { init as initRawDateTime } from '@/globals/rawDatetime';
import { plugin as Modal } from '@/themes/default/components/Modal';
import requester, { init as initRequester } from '@/globals/requester';
import initCountry from '@/globals/init/country';
import initMoment from '@/globals/init/moment';
import store from './globals/store';
import router from './globals/router';
import translations from './locale';
import App from './components/App';

import type { GlobalVTooltipOptions } from 'v-tooltip';
import type { ToastObject } from 'vue-toasted';

Vue.config.productionTip = false;

// - Initialisation.
initMoment();
initCountry();
initRawDateTime();
initRequester();

// - HTTP (Ajax) lib.
Vue.prototype.$http = requester;

// - Fenêtres modales.
Vue.use(Modal);

// - Tooltips
const vTooltipOptions = (VTooltip as any).options as GlobalVTooltipOptions;
vTooltipOptions.defaultContainer = 'body';
vTooltipOptions.disposeTimeout = 1000;
vTooltipOptions.defaultDelay = 100;
vTooltipOptions.defaultOffset = 10;
Vue.directive('tooltip', VTooltip);

// - Internationalisation.
Vue.use(vuexI18n.plugin, store);

Object.keys(translations).forEach((lang) => {
    Vue.i18n.add(lang, translations[lang]);
});

const defaultLang = getDefaultLang();
const currentLang = getLang();
Vue.i18n.fallback(defaultLang);
Vue.i18n.set((
    Vue.i18n.localeExists(currentLang)
        ? currentLang
        : defaultLang
));

// - Notifications toast.
Vue.use(Toasted, {
    duration: 5000,
    position: 'top-center',
    className: 'Notification',
    containerClass: 'Notifications',
    action: {
        text: Vue.i18n.translate('close'),
        onClick: (e: any, toastObject: ToastObject) => {
            toastObject.goAway(0);
        },
    },
});

// - Portails
Vue.use(Portal);

const boot = async (): Promise<void> => {
    await store.dispatch('auth/fetch');
    await store.dispatch('settings/boot');

    // eslint-disable-next-line no-new, vue/require-name-property
    new Vue({
        el: '#app',
        store,
        router,
        render() {
            return (
                <div id="app">
                    <App />
                </div>
            );
        },
    });
};
boot();
