import config, { BillingMode } from '@/globals/config';
import isTruthy from '@/utils/isTruthy';
import { Group } from '@/stores/api/groups';
import store from '@/themes/default/globals/store';
import EventSummarySettings from './EventSummary';
import CategoriesSettings from './Categories';
import CompaniesSettings from './Companies';
import TagsSettings from './Tags';
import CalendarSettings from './Calendar';
import InventoriesSettings from './Inventories';
import TaxesSettings from './Taxes';
import DegressiveRatesSettings from './DegressiveRates';
import EstimatesInvoicesSettings from './EstimatesInvoices';

import type { RouteConfig } from 'vue-router';
import { component } from 'vue/types/umd';

export type Page = (
    & RouteConfig
    & {
        meta: {
            icon: string,
            title: string,
            requiresGroups: Group[],
        },
    }
);

const pages: Array<Page | RouteConfig> = [
    {
        name: 'global-settings',
        path: '',
        redirect: () => {
            const defaultView = store.getters['auth/is'](Group.ADMINISTRATION)
                ? 'calendar'
                : 'categories';

            return { name: `global-settings:${defaultView}` };
        },
    },
    {
        name: 'global-settings:calendar',
        path: 'calendar',
        component: CalendarSettings,
        meta: {
            icon: 'calendar-alt',
            title: 'page.settings.calendar.title',
            requiresGroups: [Group.ADMINISTRATION],
        },
    },
    {
        name: 'global-settings:categories',
        path: 'categories',
        component: CategoriesSettings,
        meta: {
            icon: 'sitemap',
            title: 'page.settings.categories.title',
            requiresGroups: [Group.ADMINISTRATION, Group.SUPERVISION],
        },
    },
    {
        name: 'global-settings:tags',
        path: 'tags',
        component: TagsSettings,
        meta: {
            icon: 'tags',
            title: 'page.settings.tags.title',
            requiresGroups: [Group.ADMINISTRATION, Group.SUPERVISION],
        },
    },
    {
        name: 'global-settings:event-summary',
        path: 'event-summary',
        component: EventSummarySettings,
        meta: {
            icon: 'print',
            title: 'page.settings.event-summary.title',
            requiresGroups: [Group.ADMINISTRATION],
        },
    },
    {
        name: 'global-settings:inventories',
        path: 'inventories',
        component: InventoriesSettings,
        meta: {
            icon: 'tasks',
            title: 'page.settings.inventories.title',
            requiresGroups: [Group.ADMINISTRATION],
        },
    },
    {
        name: 'global-settings:companies',
        path: 'companies',
        component: CompaniesSettings,
        meta: {
            icon: 'building',
            title: 'page.settings.companies.title',
            requiresGroups: [Group.ADMINISTRATION],
        }
    },
    config.billingMode !== BillingMode.NONE && {
        name: 'global-settings:taxes',
        path: 'taxes',
        component: TaxesSettings,
        meta: {
            icon: 'percentage',
            title: 'page.settings.taxes.title',
            requiresGroups: [Group.ADMINISTRATION],
        },
    },
    config.billingMode !== BillingMode.NONE && {
        name: 'global-settings:degressive-rates',
        path: 'degressive-rates',
        component: DegressiveRatesSettings,
        meta: {
            icon: 'funnel-dollar',
            title: 'page.settings.degressive-rates.title',
            requiresGroups: [Group.ADMINISTRATION],
        },
    },
    config.billingMode !== BillingMode.NONE && {
        name: 'global-settings:estimates-invoices',
        path: 'estimates-invoices',
        component: EstimatesInvoicesSettings,
        meta: {
            icon: 'file-invoice',
            title: 'page.settings.estimates-invoices.title',
            requiresGroups: [Group.ADMINISTRATION],
        },
    },
].filter(isTruthy);

export default pages;
