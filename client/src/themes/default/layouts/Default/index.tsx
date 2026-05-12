import './index.scss';
import { defineComponent } from 'vue';
import Sidebar from './components/Sidebar';
import {
    SetGlobalSidebarStateKey,
    SetGlobalLoadingKey,
} from './_constants';

type Data = {
    isLoading: boolean,
    isSidebarOpened: boolean,
};

/** Variante par défaut du layout de l'application. */
const DefaultLayout = defineComponent({
    name: 'DefaultLayout',
    provide(this: any) {
        return {
            [SetGlobalSidebarStateKey as symbol]: (isOpen: boolean | 'toggle') => {
                if (isOpen === 'toggle') {
                    this.isSidebarOpened = !this.isSidebarOpened;
                    return;
                }
                this.isSidebarOpened = isOpen;
            },
            [SetGlobalLoadingKey as symbol]: (isLoading: boolean) => {
                this.isLoading = isLoading;
            },
        };
    },
    data: (): Data => ({
        isLoading: false,
        isSidebarOpened: false,
    }),
    computed: {
        isLogged(): boolean {
            return this.$store.getters['auth/isLogged'];
        },
    },
    watch: {
        $route() {
            this.isSidebarOpened = false;
        },
    },
    methods: {
        // ------------------------------------------------------
        // -
        // -    Handlers
        // -
        // ------------------------------------------------------

        handleSidebarToggle(isOpen: boolean | 'toggle') {
            if (isOpen === 'toggle') {
                this.isSidebarOpened = !this.isSidebarOpened;
                return;
            }
            this.isSidebarOpened = isOpen;
        },
    },
    render() {
        const children = this.$slots.default;
        const {
            isLogged,
            isSidebarOpened,
        } = this;

        return (
            <div class="DefaultLayout">
                {isLogged && (
                    <Sidebar
                        isOpen={isSidebarOpened}
                    />
                )}
                <div class="DefaultLayout__body">
                    {children}
                </div>
            </div>
        );
    },
});

export {
    SetGlobalSidebarStateKey,
    SetGlobalLoadingKey,
} from './_constants';

export default DefaultLayout;
