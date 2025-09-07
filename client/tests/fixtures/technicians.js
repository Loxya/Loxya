import { dataFactory } from './@utils';
import omit from 'lodash/omit';
import countries from './countries';
import users from './users';
import events from './events';
import roles from './roles';

const data = [
    {
        id: 1,
        user_id: 2,
        first_name: 'Roger',
        last_name: 'Rabbit',
        full_name: 'Roger Rabbit',
        nickname: 'Riri',
        email: 'tester2@loxya.com',
        phone: null,
        street: null,
        postal_code: null,
        locality: null,
        country_id: null,
        full_address: null,
        country: null,
        note: null,
        roles: [
            roles.default(1),
            roles.default(3),
        ],
        user: users.default(2),
        events: [
            {
                id: 1,
                event_id: 1,
                technician_id: 1,
                period: {
                    start: '2018-12-17 09:00:00',
                    end: '2018-12-18 22:00:00',
                    isFullDays: false,
                },
                role: roles.default(1),
                event: () => events.default(1),
            },
        ],
    },
    {
        id: 2,
        user_id: null,
        first_name: 'Jean',
        last_name: 'Technicien',
        full_name: 'Jean Technicien',
        nickname: null,
        email: 'client@technicien.com',
        phone: '+33645698520',
        street: null,
        postal_code: null,
        locality: null,
        country_id: 2,
        full_address: null,
        country: countries.default(2),
        note: null,
        roles: [
            roles.default(2),
        ],
        user: null,
        events: [
            {
                id: 2,
                event_id: 1,
                technician_id: 2,
                period: {
                    start: '2018-12-18 14:00:00',
                    end: '2018-12-18 18:00:00',
                    isFullDays: false,
                },
                role: roles.default(2),
                event: () => events.default(1),
            },
            {
                id: 3,
                event_id: 7,
                technician_id: 2,
                period: {
                    start: '2023-05-25 00:00:00',
                    end: '2023-05-29 00:00:00',
                    isFullDays: false,
                },
                role: roles.default(3),
                event: () => events.default(7),
            },
        ],
    },
];

//
// - Exports
//

/** @type {import('./@utils').FactoryReturnType} */
const asDefault = dataFactory(data, (technician) => (
    omit(technician, ['events', 'user'])
));

/** @type {import('./@utils').FactoryReturnType} */
const asDetails = dataFactory(data, (technician) => (
    omit(technician, ['events'])
));

/** @type {import('./@utils').FactoryReturnType} */
const withEvents = dataFactory(data, (technician) => ({
    ...omit(technician, ['user']),
    events: technician.events.map((event) => (
        { ...event, event: event.event() }
    )),
}));

export default {
    default: asDefault,
    details: asDetails,
    withEvents,
};
