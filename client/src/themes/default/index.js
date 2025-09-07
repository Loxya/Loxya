import './index.scss';
import Vue from 'vue';
import vuexI18n from 'vuex-i18n';
import VueJsModal from 'vue-js-modal/dist/index.nocss';
import { VTooltip } from 'v-tooltip';
import { ClientTable, ServerTable } from 'vue-tables-2-premium';
import Toasted from 'vue-toasted';
import Portal from 'portal-vue';
import config from '@/globals/config';
import { getDefaultLang, getLang } from '@/globals/lang';
import { init as initRawDateTime } from '@/globals/rawDatetime';
import requester, { init as initRequester } from '@/globals/requester';
import initMoment from '@/globals/init/moment';
import store from '@/themes/default/globals/store';
import router from '@/themes/default/globals/router';
import translations from '@/themes/default/locale';
import vueTableTranslations from '@/themes/default/locale/vendors/vue-tables';
import App from './components/App';

Vue.config.productionTip = false;

// - Initialisation.
initMoment();
initRawDateTime();
initRequester();

// - HTTP (Ajax) lib.
Vue.prototype.$http = requester;

// - Modal
Vue.use(VueJsModal, {
    dialog: true,
    dynamic: true,
    dynamicDefaults: {
        width: 950,
        height: 'auto',
        adaptive: true,
        minHeight: 300,
        draggable: false,
    },
});

// - Tooltips
VTooltip.options.defaultContainer = '#app';
VTooltip.options.disposeTimeout = 1000;
VTooltip.options.defaultDelay = 100;
VTooltip.options.defaultOffset = 10;
Vue.directive('tooltip', VTooltip);

// - Internationalization
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

// - Tables (order, pagination)
const tablesConfig = {
    sortIcon: {
        base: 'fas',
        up: 'fa-sort-up',
        down: 'fa-sort-down',
        is: 'fa-sort',
    },
    texts: vueTableTranslations[currentLang],
    requestKeys: { query: 'search' },
    perPage: config.defaultPaginationLimit,
    perPageValues: [config.defaultPaginationLimit],
    responseAdapter: (response) => {
        const { data, pagination } = response ?? { data: [] };
        return { data, count: pagination?.total.items ?? 0 };
    },
};
Vue.use(ClientTable, tablesConfig, false);
Vue.use(ServerTable, tablesConfig, false);

// - Toast notifications
Vue.use(Toasted, {
    duration: 5000,
    position: 'top-center',
    className: 'Notification',
    containerClass: 'Notifications',
    action: {
        text: Vue.i18n.translate('close'),
        onClick: (e, toastObject) => {
            toastObject.goAway(0);
        },
    },
});

// - Portails
Vue.use(Portal);

const boot = async () => {
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
