import Vue from 'vue';
import qs from 'qs';
import Router from 'vue-router';
import routes from '@/themes/default/pages';
import store from './store';

Vue.use(Router);

const router = new Router({
    mode: 'history',
    routes,
    parseQuery(query) {
        return qs.parse(query);
    },
    stringifyQuery(query) {
        const result = qs.stringify(query, {
            encodeValuesOnly: true,
            arrayFormat: 'brackets',
        });
        return result ? `?${result}` : '';
    },
});

router.beforeEach((to, from, next) => {
    let restrictAccess = false;

    const requiresLogin = to.matched.reduce(
        (currentState, { meta }) => {
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

    const isLogged = store.getters['auth/isLogged'];
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

    const { requiresGroups } = to.matched[0].meta;
    if (requiresGroups && requiresGroups.length) {
        if (!isLogged) {
            next({ name: 'login' });
            return;
        }

        const { group } = store.state.auth.user;
        if (!requiresGroups.includes(group)) {
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
