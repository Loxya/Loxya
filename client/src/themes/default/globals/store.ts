import Vue from 'vue';
import Vuex, { Store } from 'vuex';
import stores from '@/themes/default/stores';

import type { RootState } from '@/themes/default/stores';

export type State = RootState & {
    pageRawTitle: string | null,
};

Vue.use(Vuex);

export default new Store<State>({
    state: {
        pageRawTitle: null,
    } as any,
    mutations: {
        setPageRawTitle(state: State, title: string | null) {
            state.pageRawTitle = title;
        },
    },
    modules: stores,
});
