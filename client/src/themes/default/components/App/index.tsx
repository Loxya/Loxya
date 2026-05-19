import invariant from 'invariant';
import { HttpCode, RequestError } from '@/globals/requester';
import layouts, { Layout } from '@/themes/default/layouts';
import { defineComponent } from 'vue';

import type { Toasted } from 'vue-toasted';
import type { RouteRecord } from 'vue-router';

/** Wrapper de l'application. */
const App = defineComponent({
    name: 'App',
    computed: {
        layout(): Layout {
            const { $route } = this;

            const layout: Layout | undefined = $route.matched.reduce(
                (current: Layout | undefined, { meta }: RouteRecord) => {
                    if (meta?.layout === undefined) {
                        return current;
                    }

                    return typeof meta.layout === 'function'
                        ? meta.layout()
                        : meta.layout;
                },
                undefined,
            );

            return layout ?? Layout.DEFAULT;
        },

        routeKey(): string {
            const { $route } = this;

            // - Pour les routes "racines" (!= child), retourne le chemin (e.g. `/calendar`).
            if ($route.matched.length <= 1) {
                return $route.path;
            }

            // - Sinon, si la route parente déclare qu'on doit garder le rendu, on
            //   utilise le `path` du parent (e.g. `/auth` pour `/auth/login` et
            //   `/auth/register`). Si ce n'est pas le cas on utilise la route
            //   complète de l'enfant (e.g. `/schedule/listing`).
            const rootRecord = [...this.$route.matched].shift();
            return rootRecord?.meta.stickyRoot
                ? rootRecord.path
                : $route.path;
        },
    },
    watch: {
        $route() {
            // - Ferme les modales ouvertes entre deux changements de page.
            this.$modal.clear();
        },
    },
    created() {
        // - Configure le requester pour qu'il redirige en cas de soucis de connexion lors des requêtes API.
        this.$http.interceptors.response.use((response) => response, (error: unknown) => {
            if (error instanceof RequestError && error.httpCode === HttpCode.Unauthorized) {
                this.$store.dispatch('auth/logout').then(() => {
                    this.$router.replace({ name: 'login', hash: '#expired' })
                        .catch(() => {});
                });
            }
            return Promise.reject(error);
        });
    },
    mounted() {
        this.showBootMessages();
    },
    methods: {
        // ------------------------------------------------------
        // -
        // -    Méthodes internes
        // -
        // ------------------------------------------------------

        showBootMessages() {
            const showBootMessage = (type: keyof Toasted, message: string): void => {
                this.$toasted[type](message, {
                    keepOnHover: true,
                    duration: 10_000,
                });
            };

            // - S'il y a des messages serveur, on les affiche.
            (window.__SERVER_MESSAGES__ ?? []).forEach(({ type, message }: ServerMessage) => {
                const toastType: keyof Toasted = !['success', 'info', 'error'].includes(type) ? 'show' : type;
                showBootMessage(toastType, message);
            });
        },
    },
    render() {
        const { layout, routeKey } = this;

        invariant(layout in layouts, `The \`${layout}\` layout doesn't exist.`);
        const LayoutComponent = layouts[layout];

        return (
            <LayoutComponent>
                <router-view key={routeKey} />
            </LayoutComponent>
        );
    },
});

export default App;
