import './index.scss';
import { defineComponent } from 'vue';
import { Group } from '@/stores/api/groups';
import Icon from '@/themes/default/components/Icon';
import User from './User';

import type { CustomRouterLinkProps } from 'vue-router';

/** Menu utilisateur de la barre latérale du layout par défaut. */
const DefaultLayoutSidebarUserMenu = defineComponent({
    name: 'DefaultLayoutSidebarUserMenu',
    computed: {
        isAdmin(): boolean {
            return this.$store.getters['auth/is'](Group.ADMINISTRATION);
        },

        isSupervisor(): boolean {
            return this.$store.getters['auth/is'](Group.SUPERVISION);
        },
    },
    render() {
        const { $t: __, isAdmin, isSupervisor } = this;

        return (
            <div class="DefaultLayoutSidebarUserMenu">
                <ul class="DefaultLayoutSidebarUserMenu__nav">
                    {(isAdmin || isSupervisor) && (
                        <router-link to="/settings" exact custom>
                            {({ href, navigate, isActive }: CustomRouterLinkProps) => (
                                <li
                                    class={['DefaultLayoutSidebarUserMenu__nav__item', {
                                        'DefaultLayoutSidebarUserMenu__nav__item--active': isActive,
                                    }]}
                                >
                                    <a
                                        href={href}
                                        onClick={navigate}
                                        class="DefaultLayoutSidebarUserMenu__nav__item__link"
                                    >
                                        <Icon
                                            name="sliders-h"
                                            class="DefaultLayoutSidebarUserMenu__nav__item__icon"
                                        />
                                        <span class="DefaultLayoutSidebarUserMenu__nav__item__text">
                                            {__(`layout.default.menu.settings`)}
                                        </span>
                                    </a>
                                </li>
                            )}
                        </router-link>
                    )}
                </ul>
                <hr class="DefaultLayoutSidebarUserMenu__divider" />
                <User />
            </div>
        );
    },
});

export default DefaultLayoutSidebarUserMenu;
