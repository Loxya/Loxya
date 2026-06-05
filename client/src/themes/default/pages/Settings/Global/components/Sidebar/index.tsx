import './index.scss';
import { defineComponent } from 'vue';
import Icon from '@/themes/default/components/Icon';
import allPages from '../../pages';

import type { CustomRouterLinkProps, RouteConfig } from 'vue-router';
import type { Page } from '../../pages';

type Data = {
    isMenuOpen: boolean,
};

/** Sidebar de la page des paramètres globaux. */
const GlobalSettingsSidebar = defineComponent({
    name: 'GlobalSettingsSidebar',
    data: (): Data => ({
        isMenuOpen: false,
    }),
    computed: {
        pages(): Page[] {
            return allPages
                .filter((page: Page | RouteConfig): page is Page => (
                    'meta' in page &&
                    !!page.meta &&
                    Array.isArray(page.meta.requiresGroups)
                ))
                .filter(({ meta }: Page) => {
                    const { requiresGroups } = meta;
                    return this.$store.getters['auth/is'](requiresGroups);
                });
        },

        activePage(): Page | undefined {
            return this.pages.find(({ name }: Page) => name === this.$route.name);
        },
    },
    watch: {
        $route() {
            // - Referme le menu déroulant après une navigation.
            this.isMenuOpen = false;
        },
    },
    methods: {
        handleToggleMenu() {
            this.isMenuOpen = !this.isMenuOpen;
        },
    },
    render() {
        const {
            $t: __,
            pages,
            isMenuOpen,
            activePage,
            handleToggleMenu,
        } = this;

        const classNames = ['GlobalSettingsSidebar', {
            'GlobalSettingsSidebar--open': isMenuOpen,
        }];

        return (
            <nav class={classNames}>
                <button
                    type="button"
                    class="GlobalSettingsSidebar__current"
                    onClick={handleToggleMenu}
                >
                    {!!activePage && (
                        <Icon
                            name={activePage.meta.icon}
                            class="GlobalSettingsSidebar__current__icon"
                        />
                    )}
                    <span class="GlobalSettingsSidebar__current__title">
                        {activePage ? __(activePage.meta.title) : __('page.settings.title')}
                    </span>
                    <Icon
                        name={isMenuOpen ? 'chevron-up' : 'chevron-down'}
                        class="GlobalSettingsSidebar__current__chevron"
                    />
                </button>
                <ul class="GlobalSettingsSidebar__list">
                    {pages.map(({ name, meta }: Page, index: number) => (
                        <router-link key={index} to={{ name }} exact custom>
                            {({ href, navigate, isActive }: CustomRouterLinkProps) => (
                                <li
                                    class={[
                                        'GlobalSettingsSidebar__item',
                                        { 'GlobalSettingsSidebar__item--active': isActive },
                                    ]}
                                >
                                    <a href={href} onClick={navigate} class="GlobalSettingsSidebar__item__link">
                                        <Icon name={meta.icon} class="GlobalSettingsSidebar__item__icon" />
                                        <span class="GlobalSettingsSidebar__item__title">{__(meta.title)}</span>
                                    </a>
                                </li>
                            )}
                        </router-link>
                    ))}
                </ul>
            </nav>
        );
    },
});

export default GlobalSettingsSidebar;
