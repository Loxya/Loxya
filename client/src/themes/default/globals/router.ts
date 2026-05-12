import Vue from 'vue';
import qs from 'qs';
import store from './store';
import Router from 'vue-router';
import routes from '@/themes/default/pages';
import { AuthType } from '@/stores/api/session';

import type {
    Route,
    RouteRecord,
    NavigationGuardNext,
} from 'vue-router';

Vue.use(Router);

const router = new Router({
    mode: 'history',
    routes,
    parseQuery(query: string): Record<string, any> {
        return qs.parse(query);
    },
    stringifyQuery(query: Record<string, any>): string {
        const result = qs.stringify(query, {
            encodeValuesOnly: true,
            arrayFormat: 'brackets',
        });
        return result ? `?${result}` : '';
    },
});

router.beforeEach((to: Route, from: Route, next: NavigationGuardNext) => {
    // - Si la route est désactivée, on redirige vers l'accueil.
    const isDisabled: boolean = to.matched.some(({ meta }) => !!(
        typeof meta.disabled === 'function'
            ? meta.disabled()
            : meta.disabled
    ));
    if (isDisabled) {
        next('/');
        return;
    }

    const requiresLogin: boolean | null = to.matched.reduce<boolean | null>(
        (currentState: boolean | null, { meta }: RouteRecord) => {
            // - Non indiqué explicitement => Route publique.
            if ([undefined, null].includes(meta.requiresLogin)) {
                return currentState;
            }

            // - Marqué à `true` (ou valeur truthy) => Authentification requise.
            if (meta.requiresLogin) {
                return true;
            }

            // - Marqué à `false` (ou valeur falsy) => Route pour visiteurs.
            //   (uniquement si l'état courant n'est pas déjà marqué comme "authentification requise")
            //   (= l'authentification requise l'emporte sur la route visiteur)
            if (currentState === null && !meta.requiresLogin) {
                return false;
            }

            return currentState;
        },
        null,
    );

    const isLogged: boolean = store.getters['auth/isLogged'];
    if (requiresLogin && !isLogged) {
        next({ name: 'login' });
        return;
    }

    if (!requiresLogin) {
        // - Si l'authentification est marquée explicitement comme non requise (= `false`).
        //   => Redirige vers l'accueil si authentifié car la route ne peut être accédée que
        //      par les utilisateurs non connectés.
        if (requiresLogin === false && isLogged) {
            next('/');
            return;
        }

        next();
        return;
    }

    let restrictAccess = false;
    const { requiresGroups } = to.matched[0].meta;
    if (requiresGroups && requiresGroups.length) {
        if (!isLogged) {
            next({ name: 'login' });
            return;
        }

        const user = store.state.auth.user!;
        if (
            user.type === AuthType.GUEST ||
            !requiresGroups.includes(user.group)
        ) {
            restrictAccess = true;
        }
    }
    if (restrictAccess) {
        store.dispatch('auth/logout').then(() => {
            next({ name: 'login', hash: '#restricted' });
        });
        return;
    }

    next();
});

export default router;
