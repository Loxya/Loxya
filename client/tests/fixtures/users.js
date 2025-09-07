import omit from 'lodash/omit';
import pick from 'lodash/pick';
import { AuthType } from '@/stores/api/session';
import { Group } from '@/stores/api/groups';
import { dataFactory } from './@utils';
import countries from './countries';
import {
    BookingsViewMode,
    TechniciansViewMode,
} from '@/stores/api/users';

const data = [
    {
        id: 1,
        pseudo: 'test1',
        first_name: 'Jean',
        last_name: 'Fountain',
        full_name: 'Jean Fountain',
        phone: null,
        street: `1, somewhere av.`,
        postal_code: '1234',
        locality: `Megacity`,
        country_id: 1,
        country: countries.default(1),
        full_address: `1, somewhere av.\n1234 Megacity`,
        email: 'tester@loxya.com',
        group: Group.ADMINISTRATION,
        language: 'en',
        default_bookings_view: BookingsViewMode.CALENDAR,
        default_technicians_view: TechniciansViewMode.LISTING,
        disable_contextual_popovers: true,
        disable_search_persistence: false,
    },
    {
        id: 2,
        pseudo: 'test2',
        first_name: 'Roger',
        last_name: 'Rabbit',
        full_name: 'Roger Rabbit',
        phone: null,
        street: null,
        postal_code: null,
        locality: null,
        country_id: null,
        country: null,
        full_address: null,
        email: 'tester2@loxya.com',
        group: Group.OPERATION,
        language: 'fr',
        default_bookings_view: BookingsViewMode.CALENDAR,
        default_technicians_view: TechniciansViewMode.TIMELINE,
        disable_contextual_popovers: true,
        disable_search_persistence: true,
    },
    {
        id: 3,
        pseudo: 'nobody',
        first_name: null,
        last_name: null,
        full_name: null,
        phone: null,
        street: `156 bis, avenue des tests poussés`,
        postal_code: '88080',
        locality: 'Wazzaville',
        country_id: null,
        country: null,
        full_address: `156 bis, avenue des tests poussés\n88080 Wazzaville`,
        email: 'nobody@loxya.com',
        group: Group.OPERATION,
        language: 'fr',
        default_bookings_view: BookingsViewMode.LISTING,
        default_technicians_view: TechniciansViewMode.LISTING,
        disable_contextual_popovers: false,
        disable_search_persistence: false,
    },
    {
        id: 4,
        pseudo: 'TheVisitor',
        first_name: 'Henry',
        last_name: 'Berluc',
        full_name: 'Henry Berluc',
        phone: '+33724000000',
        street: null,
        postal_code: null,
        locality: null,
        country_id: 2,
        country: countries.default(2),
        full_address: null,
        email: 'visitor@loxya.com',
        group: Group.READONLY_PLANNING_GENERAL,
        language: 'fr',
        default_bookings_view: BookingsViewMode.CALENDAR,
        default_technicians_view: TechniciansViewMode.LISTING,
        disable_contextual_popovers: false,
        disable_search_persistence: false,
    },
    {
        id: 5,
        pseudo: 'caroline',
        first_name: 'Caroline',
        last_name: 'Farol',
        full_name: 'Caroline Farol',
        phone: '+33786325500',
        street: null,
        postal_code: null,
        locality: null,
        country_id: null,
        country: null,
        full_address: null,
        email: 'external@loxya.com',
        group: Group.READONLY_PLANNING_GENERAL,
        language: 'en',
        default_bookings_view: BookingsViewMode.CALENDAR,
        default_technicians_view: TechniciansViewMode.TIMELINE,
        disable_contextual_popovers: false,
        disable_search_persistence: false,
    },
];

//
// - Exports
//

/** @type {import('./@utils').FactoryReturnType} */
const asDefault = dataFactory(data, (user) => (
    omit(user, [
        'language',
        'default_bookings_view',
        'default_technicians_view',
        'disable_contextual_popovers',
        'disable_search_persistence',
        'street',
        'postal_code',
        'locality',
        'country_id',
        'country',
        'full_address',
    ])
));

/** @type {import('./@utils').FactoryReturnType} */
const asSummary = dataFactory(data, (user) => (
    pick(user, ['id', 'full_name', 'email'])
));

/** @type {import('./@utils').FactoryReturnType} */
const asDetails = dataFactory(data, (user) => (
    omit(user, [
        'language',
        'default_bookings_view',
        'default_technicians_view',
        'disable_contextual_popovers',
        'disable_search_persistence',
    ])
));

/** @type {import('./@utils').FactoryReturnType} */
const asSession = dataFactory(data, (user) => ({
    ...user,
    type: AuthType.USER,
}));

/** @type {import('./@utils').FactoryReturnType} */
const settings = dataFactory(data, (user) => (
    pick(user, [
        'language',
        'default_bookings_view',
        'default_technicians_view',
        'disable_contextual_popovers',
        'disable_search_persistence',
    ])
));

export default {
    summary: asSummary,
    default: asDefault,
    details: asDetails,
    session: asSession,
    settings,
};
