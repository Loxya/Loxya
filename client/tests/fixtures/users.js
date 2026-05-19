import omit from 'lodash/omit';
import pick from 'lodash/pick';
import { AuthType } from '@/stores/api/session';
import { Group } from '@/stores/api/groups';
import { dataFactory } from './@utils';
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
        additional_street: null,
        postal_code: '12340',
        administrative_area: null,
        locality: `Megacity`,
        country: 'FR',
        address: (
            `1, somewhere av.\n` +
            `12340 Megacity`
        ),
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
        additional_street: null,
        postal_code: null,
        administrative_area: null,
        locality: null,
        country: 'FR',
        address: null,
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
        additional_street: null,
        postal_code: '88080',
        administrative_area: null,
        locality: 'Wazzaville',
        country: 'FR',
        address: (
            `156 bis, avenue des tests poussés\n` +
            `88080 Wazzaville`
        ),
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
        phone: '+33794589321',
        street: null,
        additional_street: null,
        postal_code: null,
        administrative_area: null,
        locality: null,
        country: 'CH',
        address: null,
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
        additional_street: null,
        postal_code: null,
        administrative_area: null,
        locality: null,
        country: 'FR',
        address: null,
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
        'additional_street',
        'postal_code',
        'administrative_area',
        'locality',
        'country',
        'address',
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
