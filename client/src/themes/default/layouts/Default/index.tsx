import './index.scss';
import { defineComponent } from 'vue';
import Header from './components/Header';
import Sidebar from './components/Sidebar';

type Data = {
    isLoading: boolean,
    isSidebarOpened: boolean,
};

/** Variante par défaut du layout de l'application. */
const DefaultLayout = defineComponent({
    name: 'DefaultLayout',
    provide(this: any) {
        return {
            'setGlobalLoading': (isLoading: boolean) => {
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
            isLoading,
            isSidebarOpened,
            handleSidebarToggle,
        } = this;

        return (
            <div class="DefaultLayout">
                {isLogged && (
                    <Sidebar
                        isOpen={isSidebarOpened}
                    />
                )}
                <div class="DefaultLayout__body">
                    {isLogged && (
                        <Header
                            onToggleMenu={handleSidebarToggle}
                            showLoading={isLoading}
                        />
                    )}
                    <div class="DefaultLayout__body__content">
                        {children}
                    </div>
                </div>
            </div>
        );
    },
});

export default DefaultLayout;
