import { dataFactory } from './@utils';
import omit from 'lodash/omit';
import events from './events';
import roles from './roles';

const data = [
    {
        id: 1,
        first_name: 'Roger',
        last_name: 'Rabbit',
        full_name: 'Roger Rabbit',
        nickname: 'Riri',
        email: 'tester2@loxya.com',
        phone: null,
        street: null,
        additional_street: null,
        postal_code: null,
        administrative_area: null,
        locality: null,
        country: 'FR',
        address: null,
        note: null,
        roles: [
            roles.default(1),
            roles.default(3),
        ],
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
        first_name: 'Jean',
        last_name: 'Garcia',
        full_name: 'Jean Garcia',
        nickname: null,
        email: 'jg@loxya.fr',
        phone: '+33645698520',
        street: null,
        additional_street: null,
        postal_code: null,
        administrative_area: null,
        locality: null,
        country: 'CH',
        address: null,
        note: null,
        roles: [
            roles.default(2),
        ],
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
