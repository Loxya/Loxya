import invariant from 'invariant';
import config from '@/globals/config';
import cookies from '@/utils/cookies';
import { HttpCode, RequestError } from '@/globals/requester';
import apiSession, { AuthType } from '@/stores/api/session';

import type { Group } from '@/stores/api/groups';
import type { Module, ActionContext } from 'vuex';
import type { Session, Credentials } from '@/stores/api/session';
import type { UserSettings } from '@/stores/api/users';
import type { RootState } from '.';

export type State = {
    user: Session<true> | null,
};

export type AuthenticatePayload = { token: string, user: Session<true> };

const setSessionCookie = (token: string): void => {
    const { cookie, timeout } = config.auth;

    const cookieConfig: Cookies.CookieAttributes = {
        secure: config.isSslEnabled,

        // - Note: Permet la création de cookies lorsque Loxya est
        //   intégré dans des systèmes tiers (e.g. Notion).
        sameSite: config.isSslEnabled ? 'None' : 'Lax',
    };

    if (timeout) {
        const timeoutMs = timeout * 60 * 60 * 1000;
        const timeoutDate = new Date(Date.now() + timeoutMs);
        cookieConfig.expires = timeoutDate;
    }

    cookies.set(cookie, token, cookieConfig);
};

const store: Module<State, RootState> = {
    namespaced: true,
    state: {
        user: null,
    },
    getters: {
        /**
         * Indique si l'utilisateur est authentifié.
         *
         * Attention, cela ne veut pas forcément dire que c'est une utilisateur permanent connecté.
         * Un utilisateur temporaire ("guest") peut-être authentifié sans qu'il soit connecté.
         *
         * @param state - Le state actuel du store.
         *
         * @returns `true` si l'utilisateur est authentifié, `false` sinon.
         */
        isAuthenticated: (state: State): boolean => (
            state.user !== null
        ),

        /**
         * Indique si l'utilisateur est connecté.
         *
         * Ceci implique qu'il est identifié et que c'est un utilisateur permanent.
         *
         * @param state - Le state actuel du store.
         *
         * @returns `true` si l'utilisateur est connecté, `false` sinon.
         */
        isLogged: (state: State): boolean => (
            state.user !== null &&
            state.user.type === AuthType.USER
        ),

        is: (state: State) => (groups: Group | Group[]): boolean => {
            if (state.user?.type !== AuthType.USER) {
                return false;
            }

            const normalizedGroups = Array.isArray(groups) ? groups : [groups];
            return normalizedGroups.includes(state.user.group);
        },

        user: (state: State): Session<true> | null => state.user,
    },
    mutations: {
        setUser(state: State, user: Session<true>) {
            state.user = user;
        },

        updateUser(state: State, newData: Session<true>) {
            state.user = { ...state.user, ...newData };
        },

        setLocale(state: State, language: string) {
            invariant(
                state.user?.type === AuthType.USER,
                `Unable to update language of a guest user.`,
            );

            state.user.language = language;
        },

        setInterfaceSettings(state: State, settings: UserSettings) {
            invariant(
                state.user?.type === AuthType.USER,
                `Unable to update interface settings of a guest user.`,
            );

            state.user.default_bookings_view = settings.default_bookings_view;
            state.user.default_technicians_view = settings.default_technicians_view;
            state.user.disable_contextual_popovers = settings.disable_contextual_popovers;
            state.user.disable_search_persistence = settings.disable_search_persistence;
        },
    },
    actions: {
        async fetch({ dispatch, commit }: ActionContext<State, RootState>) {
            if (!cookies.get(config.auth.cookie)) {
                commit('setUser', null);
                return;
            }

            try {
                commit('setUser', await apiSession.get(true));
            } catch (error) {
                // - Non connecté.
                if (error instanceof RequestError && error.httpCode === HttpCode.Unauthorized) {
                    dispatch('logout', false);
                    return;
                }

                // eslint-disable-next-line no-console
                console.error('Unexpected error during user retrieval:', error);
            }
        },

        async authenticate(
            { dispatch, commit }: ActionContext<State, RootState>,
            { token, user }: AuthenticatePayload,
        ) {
            commit('setUser', user);
            setSessionCookie(token);

            if (user.type === AuthType.USER) {
                window.localStorage.setItem('userLocale', user.language);
                await dispatch('i18n/setLocale', { locale: user.language }, { root: true });
            }
            await dispatch('settings/fetch', undefined, { root: true });
        },

        async login({ dispatch }: ActionContext<State, RootState>, credentials: Credentials) {
            const { token, ...user } = await apiSession.create(credentials);
            await dispatch('authenticate', { token, user });
        },

        async logout({ state }: ActionContext<State, RootState>, full: boolean = true) {
            const wasLogged = state.user?.type === AuthType.USER;
            const theme = '';

            if (wasLogged && full) {
                window.location.assign(`${config.baseUrl}${theme}/logout`);
            } else {
                cookies.remove(config.auth.cookie);
                window.location.assign(
                    wasLogged
                        ? `${config.baseUrl}${theme}/login`
                        : `${config.baseUrl}${theme}/`,
                );
            }

            // - Timeout de 5 secondes avant de rejeter la promise.
            // => L'idée étant que la redirection doit avoir lieu dans ce laps de temps.
            // => Cela permet aussi de "bloquer" les listeners de cette méthode pour éviter
            //    qu'ils exécutent des process post-logout (redirection, vidage de store ...)
            await new Promise((__: any, reject: any) => { setTimeout(reject, 5000); });
        },
    },
};

export default store;
