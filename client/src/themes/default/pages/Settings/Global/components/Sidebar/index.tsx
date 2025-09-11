import './index.scss';
import { defineComponent } from 'vue';
import Icon from '@/themes/default/components/Icon';
import allPages from '../../pages';

import type { CustomRouterLinkProps, RouteConfig } from 'vue-router';
import type { Page } from '../../pages';

/** Sidebar de la page des paramètres globaux. */
const GlobalSettingsSidebar = defineComponent({
    name: 'GlobalSettingsSidebar',
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
    },
    render() {
        const { $t: __, pages } = this;

        return (
            <ul class="GlobalSettingsSidebar">
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
        );
    },
});

export default GlobalSettingsSidebar;
