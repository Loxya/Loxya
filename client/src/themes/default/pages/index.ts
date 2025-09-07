import { Layout } from '@/themes/default/layouts';
import { Group } from '@/stores/api/groups';

// - Pages
import Login from './Login';
import ResetPassword from './ResetPassword';
import Schedule, { pages as schedulePages } from './Schedule';
import EventEdit from './EventEdit';
import EventDeparture from './EventDeparture';
import EventReturn from './EventReturn';
import Users from './Users';
import UserEdit from './UserEdit';
import Beneficiaries from './Beneficiaries';
import BeneficiaryView from './BeneficiaryView';
import BeneficiaryEdit from './BeneficiaryEdit';
import CompanyEdit from './CompanyEdit';
import Materials from './Materials';
import MaterialEdit from './MaterialEdit';
import MaterialView from './MaterialView';
import Properties from './Properties';
import PropertyEdit from './PropertyEdit';
import Technicians, { pages as techniciansPages } from './Technicians';
import TechnicianEdit from './TechnicianEdit';
import TechnicianView from './TechnicianView';
import Roles from './Roles';
import Parks from './Parks';
import ParkEdit from './ParkEdit';
import UserSettings from './Settings/User';
import GlobalSettings, { pages as globalSettingsPages } from './Settings/Global';

import type { RouteConfig } from 'vue-router';

const pages: RouteConfig[] = [
    //
    // - Authentification
    //

    {
        name: 'login',
        path: '/login',
        component: Login,
        meta: {
            layout: Layout.BLANK,
            requiresLogin: false,
        },
    },
    {
        name: 'reset-password',
        path: '/reset-password',
        component: ResetPassword,
        meta: {
            layout: Layout.MINIMALIST,
            requiresLogin: false,
        },
    },

    //
    // - Accueil
    //

    {
        name: 'home',
        path: '/',
        redirect: { name: 'schedule' },
    },

    //
    // - Planning
    //

    {
        path: '/schedule',
        component: Schedule,
        meta: {
            requiresLogin: true,
            requiresGroups: [
                Group.ADMINISTRATION,
                Group.SUPERVISION,
                Group.OPERATION,
                Group.READONLY_PLANNING_GENERAL,
            ],
        },
        children: schedulePages,
    },

    //
    // - Événements
    //

    {
        name: 'add-event',
        path: '/events/new',
        component: EventEdit,
        meta: {
            requiresLogin: true,
            requiresGroups: [Group.ADMINISTRATION, Group.SUPERVISION, Group.OPERATION],
        },
    },
    {
        name: 'event-departure-inventory',
        path: '/events/:id(\\d+)/departure-inventory',
        component: EventDeparture,
        meta: {
            requiresLogin: true,
            requiresGroups: [Group.ADMINISTRATION, Group.SUPERVISION, Group.OPERATION],
        },
    },
    {
        name: 'event-return-inventory',
        path: '/events/:id(\\d+)/return-inventory',
        component: EventReturn,
        meta: {
            requiresLogin: true,
            requiresGroups: [Group.ADMINISTRATION, Group.SUPERVISION, Group.OPERATION],
        },
    },
    {
        name: 'edit-event',
        path: '/events/:id(\\d+)',
        component: EventEdit,
        meta: {
            requiresLogin: true,
            requiresGroups: [Group.ADMINISTRATION, Group.SUPERVISION, Group.OPERATION],
        },
    },

    //
    // - Utilisateurs
    //

    {
        name: 'users',
        path: '/users',
        component: Users,
        meta: {
            requiresLogin: true,
            requiresGroups: [Group.ADMINISTRATION],
        },
    },
    {
        name: 'add-user',
        path: '/users/new',
        component: UserEdit,
        meta: {
            requiresLogin: true,
            requiresGroups: [Group.ADMINISTRATION],
        },
    },
    {
        name: 'edit-user',
        path: '/users/:id(\\d+)',
        component: UserEdit,
        meta: {
            requiresLogin: true,
            requiresGroups: [Group.ADMINISTRATION],
        },
    },

    //
    // - Emprunteurs
    //

    {
        name: 'beneficiaries',
        path: '/beneficiaries',
        component: Beneficiaries,
        meta: {
            requiresLogin: true,
            requiresGroups: [Group.ADMINISTRATION, Group.SUPERVISION, Group.OPERATION],
        },
    },
    {
        name: 'view-beneficiary',
        path: '/beneficiaries/:id(\\d+)/view',
        component: BeneficiaryView,
        meta: {
            requiresLogin: true,
            requiresGroups: [Group.ADMINISTRATION, Group.SUPERVISION, Group.OPERATION],
        },
    },
    {
        name: 'add-beneficiary',
        path: '/beneficiaries/new',
        component: BeneficiaryEdit,
        meta: {
            requiresLogin: true,
            requiresGroups: [Group.ADMINISTRATION, Group.SUPERVISION, Group.OPERATION],
        },
    },
    {
        name: 'edit-beneficiary',
        path: '/beneficiaries/:id(\\d+)',
        component: BeneficiaryEdit,
        meta: {
            requiresLogin: true,
            requiresGroups: [Group.ADMINISTRATION, Group.SUPERVISION, Group.OPERATION],
        },
    },

    //
    // - Sociétés
    //

    {
        name: 'add-company',
        path: '/companies/new',
        component: CompanyEdit,
        meta: {
            requiresLogin: true,
            requiresGroups: [Group.ADMINISTRATION, Group.SUPERVISION, Group.OPERATION],
        },
    },
    {
        name: 'edit-company',
        path: '/companies/:id(\\d+)',
        component: CompanyEdit,
        meta: {
            requiresLogin: true,
            requiresGroups: [Group.ADMINISTRATION, Group.SUPERVISION, Group.OPERATION],
        },
    },

    //
    // - Matériel
    //

    {
        name: 'materials',
        path: '/materials',
        component: Materials,
        meta: {
            requiresLogin: true,
            requiresGroups: [Group.ADMINISTRATION, Group.SUPERVISION, Group.OPERATION],
        },
    },
    {
        name: 'add-material',
        path: '/materials/new',
        component: MaterialEdit,
        meta: {
            requiresLogin: true,
            requiresGroups: [Group.ADMINISTRATION, Group.SUPERVISION, Group.OPERATION],
        },
    },
    {
        name: 'edit-material',
        path: '/materials/:id(\\d+)',
        component: MaterialEdit,
        meta: {
            requiresLogin: true,
            requiresGroups: [Group.ADMINISTRATION, Group.SUPERVISION, Group.OPERATION],
        },
    },
    {
        name: 'view-material',
        path: '/materials/:id(\\d+)/view',
        component: MaterialView,
        meta: {
            requiresLogin: true,
            requiresGroups: [Group.ADMINISTRATION, Group.SUPERVISION, Group.OPERATION],
        },
    },

    //
    // - Caractéristiques spéciales
    //

    {
        name: 'properties',
        path: '/properties',
        component: Properties,
        meta: {
            requiresLogin: true,
            requiresGroups: [Group.ADMINISTRATION, Group.SUPERVISION],
        },
    },
    {
        name: 'add-property',
        path: '/properties/new',
        component: PropertyEdit,
        meta: {
            requiresLogin: true,
            requiresGroups: [Group.ADMINISTRATION, Group.SUPERVISION],
        },
    },
    {
        name: 'edit-property',
        path: '/properties/:id(\\d+)',
        component: PropertyEdit,
        meta: {
            requiresLogin: true,
            requiresGroups: [Group.ADMINISTRATION, Group.SUPERVISION],
        },
    },

    //
    // - Techniciens
    //

    {
        path: '/technicians',
        component: Technicians,
        meta: {
            requiresLogin: true,
            requiresGroups: [Group.ADMINISTRATION, Group.SUPERVISION, Group.OPERATION],
        },
        children: techniciansPages,
    },
    {
        name: 'add-technician',
        path: '/technicians/new',
        component: TechnicianEdit,
        meta: {
            requiresLogin: true,
            requiresGroups: [Group.ADMINISTRATION, Group.SUPERVISION, Group.OPERATION],
        },
    },
    {
        name: 'edit-technician',
        path: '/technicians/:id(\\d+)',
        component: TechnicianEdit,
        meta: {
            requiresLogin: true,
            requiresGroups: [Group.ADMINISTRATION, Group.SUPERVISION, Group.OPERATION],
        },
    },
    {
        name: 'view-technician',
        path: '/technicians/:id(\\d+)/view',
        component: TechnicianView,
        meta: {
            requiresLogin: true,
            requiresGroups: [Group.ADMINISTRATION, Group.SUPERVISION, Group.OPERATION],
        },
    },
    {
        name: 'roles',
        path: '/roles',
        component: Roles,
        meta: {
            requiresLogin: true,
            requiresGroups: [Group.ADMINISTRATION, Group.SUPERVISION, Group.OPERATION],
        },
    },

    //
    // - Parcs
    //

    {
        name: 'parks',
        path: '/parks',
        component: Parks,
        meta: {
            requiresLogin: true,
            requiresGroups: [Group.ADMINISTRATION],
        },
    },
    {
        name: 'add-park',
        path: '/parks/new',
        component: ParkEdit,
        meta: {
            requiresLogin: true,
            requiresGroups: [Group.ADMINISTRATION],
        },
    },
    {
        name: 'edit-park',
        path: '/parks/:id(\\d+)',
        component: ParkEdit,
        meta: {
            requiresLogin: true,
            requiresGroups: [Group.ADMINISTRATION],
        },
    },

    //
    // - Paramètres
    //

    {
        name: 'user-settings',
        path: '/user-settings',
        component: UserSettings,
        meta: {
            requiresLogin: true,
            requiresGroups: [
                Group.ADMINISTRATION,
                Group.SUPERVISION,
                Group.OPERATION,
                Group.READONLY_PLANNING_GENERAL,
            ],
        },
    },
    {
        path: '/settings',
        component: GlobalSettings,
        meta: {
            requiresLogin: true,
            requiresGroups: [Group.ADMINISTRATION, Group.SUPERVISION],
        },
        children: globalSettingsPages,
    },

    //
    // - Catch all.
    //

    { path: '*', redirect: '/' },
];

export default pages;
