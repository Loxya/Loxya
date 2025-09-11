import './index.scss';
import config from '@/globals/config';
import { defineComponent } from 'vue';
import { BookingsViewMode } from '@/stores/api/users';
import { Group } from '@/stores/api/groups';
import Item from './Item';

import type { Session } from '@/stores/api/session';
import type { Props as ItemProps } from './Item';

/** Menu principal de la barre latérale du layout par défaut. */
const DefaultLayoutSidebarMainMenu = defineComponent({
    name: 'DefaultLayoutSidebarMainMenu',
    computed: {
        isAdmin(): boolean {
            return this.$store.getters['auth/is'](Group.ADMINISTRATION);
        },

        isTeamMember(): boolean {
            return this.$store.getters['auth/is']([
                Group.ADMINISTRATION,
                Group.SUPERVISION,
                Group.OPERATION,
            ]);
        },

        isTechniciansEnabled(): boolean {
            return config.features.technicians;
        },

        links(): ItemProps[] {
            const {
                __,
                isAdmin,
                isTeamMember,
                isTechniciansEnabled,
            } = this;

            const links: ItemProps[] = [];

            const { default_bookings_view: defaultBookingsView } = this.$store.state.auth.user as Session;
            if (defaultBookingsView === BookingsViewMode.LISTING) {
                links.push({
                    icon: 'list',
                    label: __('schedule-listing'),
                    to: { name: 'schedule:listing' },
                });
            } else {
                links.push({
                    icon: 'calendar-alt',
                    label: __('schedule-calendar'),
                    to: { name: 'schedule:calendar' },
                });
            }

            if (isTeamMember) {
                links.push({
                    icon: 'box',
                    label: __('materials'),
                    to: { name: 'materials' },
                });

                if (isTechniciansEnabled) {
                    links.push({
                        icon: 'people-carry',
                        label: __('technicians'),
                        to: { name: 'technicians' },
                    });
                }

                links.push({
                    icon: 'address-book',
                    label: __('beneficiaries'),
                    to: { name: 'beneficiaries' },
                });
            }

            if (isAdmin) {
                links.push(
                    {
                        icon: 'industry',
                        label: __('parks'),
                        to: { name: 'parks' },
                    },
                    {
                        icon: 'users-cog',
                        label: __('users'),
                        to: { name: 'users' },
                    },
                );
            }

            return links;
        },
    },
    methods: {
        // ------------------------------------------------------
        // -
        // -    Méthodes internes
        // -
        // ------------------------------------------------------

        __(key: string, params?: Record<string, number | string>, count?: number): string {
            key = !key.startsWith('global.')
                ? `layout.default.menu.${key}`
                : key.replace(/^global\./, '');

            return this.$t(key, params, count);
        },
    },
    render() {
        const { links } = this;

        return (
            <ul class="DefaultLayoutSidebarMainMenu">
                {links.map(({ label, icon, to, counter, exact }: ItemProps) => (
                    <Item
                        key={label}
                        label={label}
                        to={to}
                        icon={icon}
                        counter={counter}
                        exact={exact}
                    />
                ))}
            </ul>
        );
    },
});

export default DefaultLayoutSidebarMainMenu;
