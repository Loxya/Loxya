import './index.scss';
import config, { BillingMode } from '@/globals/config';
import { defineComponent } from 'vue';
import { BookingsViewMode } from '@/stores/api/users';
import { Group } from '@/stores/api/groups';
import SubMenu from './SubMenu';
import Item from './Item';

import type { Session } from '@/stores/api/session';
import type { Props as SubMenuProps } from './SubMenu';
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

        isBillingEnabled(): boolean {
            return config.billingMode !== BillingMode.NONE;
        },

        isTechniciansEnabled(): boolean {
            return config.features.technicians;
        },

        items(): Array<ItemProps | SubMenuProps> {
            const {
                __,
                isAdmin,
                isTeamMember,
                isBillingEnabled,
                isTechniciansEnabled,
            } = this;

            const items: Array<ItemProps | SubMenuProps> = [];

            const { default_bookings_view: defaultBookingsView } = this.$store.state.auth.user as Session;
            if (defaultBookingsView === BookingsViewMode.LISTING) {
                items.push({
                    icon: 'list',
                    label: __('schedule-listing'),
                    to: { name: 'schedule:listing' },
                });
            } else {
                items.push({
                    icon: 'calendar-alt',
                    label: __('schedule-calendar'),
                    to: { name: 'schedule:calendar' },
                });
            }

            if (isTeamMember) {
                items.push(
                    {
                        icon: 'box',
                        label: __('materials'),
                        to: { name: 'materials' },
                    },
                    {
                        icon: 'address-book',
                        label: __('beneficiaries'),
                        to: { name: 'beneficiaries' },
                    },
                );

                if (isBillingEnabled) {
                    items.push({
                        icon: 'file-invoice',
                        label: __('billing'),
                        items: [
                            {
                                icon: 'file-invoice-dollar',
                                label: __('global.invoices'),
                                to: { name: 'invoices' },
                            },
                            {
                                icon: 'file-contract',
                                label: __('global.estimates'),
                                to: { name: 'estimates' },
                            },
                        ],
                    });
                }

                if (isTechniciansEnabled) {
                    items.push({
                        icon: 'people-carry',
                        label: __('technicians'),
                        to: { name: 'technicians' },
                    });
                }
            }

            if (isAdmin) {
                items.push(
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

            return items;
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
        const { items } = this;

        return (
            <ul class="DefaultLayoutSidebarMainMenu">
                {items.map((item: ItemProps | SubMenuProps) => {
                    if ('items' in item) {
                        return (
                            <SubMenu
                                key={item.label}
                                label={item.label}
                                icon={item.icon}
                                counter={item.counter}
                                items={item.items}
                            />
                        );
                    }

                    return (
                        <Item
                            key={item.label}
                            label={item.label}
                            to={item.to}
                            icon={item.icon}
                            counter={item.counter}
                            exact={item.exact}
                        />
                    );
                })}
            </ul>
        );
    },
});

export default DefaultLayoutSidebarMainMenu;
