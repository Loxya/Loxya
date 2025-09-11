import './index.scss';
import { defineComponent } from 'vue';
import { confirm } from '@/utils/alert';
import Icon from '@/themes/default/components/Icon';

import type { CustomRouterLinkProps } from 'vue-router';

/**
 * Le dropdown avec les actions utilisateur dans la
 * barre latérale du layout par défaut.
 */
const DefaultLayoutSidebarUserDropdown = defineComponent({
    name: 'DefaultLayoutSidebarUserDropdown',
    methods: {
        // ------------------------------------------------------
        // -
        // -    Handlers
        // -
        // ------------------------------------------------------

        async handleClickLogout() {
            const { $t: __ } = this;
            const isConfirmed = await confirm({
                type: 'warning',
                text: __('layout.default.menu.confirm-logout'),
                confirmButtonText: __('layout.default.menu.yes-logout'),
            });
            if (!isConfirmed) {
                return;
            }

            await this.$store.dispatch('auth/logout');
            this.$router.replace({ name: 'login', hash: '#bye' });
        },
    },
    render() {
        const { $t: __, handleClickLogout } = this;

        return (
            <ul class="DefaultLayoutSidebarUserDropdown">
                <router-link to={{ name: 'user-settings' }} exact custom>
                    {({ href, navigate }: CustomRouterLinkProps) => (
                        <li class="DefaultLayoutSidebarUserDropdown__item">
                            <a href={href} onClick={navigate} class="DefaultLayoutSidebarUserDropdown__item__link">
                                <Icon
                                    name="user-cog"
                                    class="DefaultLayoutSidebarUserDropdown__item__icon"
                                />
                                <span class="DefaultLayoutSidebarUserDropdown__item__text">
                                    {__('layout.default.menu.your-settings')}
                                </span>
                            </a>
                        </li>
                    )}
                </router-link>
                <li class="DefaultLayoutSidebarUserDropdown__item">
                    <button
                        type="button"
                        class="DefaultLayoutSidebarUserDropdown__item__link"
                        onClick={handleClickLogout}
                    >
                        <Icon
                            name="power-off"
                            class="DefaultLayoutSidebarUserDropdown__item__icon"
                        />
                        <span class="DefaultLayoutSidebarUserDropdown__item__text">
                            {__('layout.default.menu.logout-quit')}
                        </span>
                    </button>
                </li>
            </ul>
        );
    },
});

export default DefaultLayoutSidebarUserDropdown;
