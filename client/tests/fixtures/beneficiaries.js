import omit from 'lodash/omit';
import { dataFactory } from './@utils';
import companies from './companies';
import users from './users';

const data = [
    {
        id: 1,
        user_id: 1,
        user: users.default(1),
        first_name: 'Jean',
        last_name: 'Fountain',
        full_name: 'Jean Fountain',
        reference: '0001',
        email: 'tester@loxya.com',
        phone: null,
        street: '1, somewhere av.',
        additional_street: null,
        postal_code: '12340',
        administrative_area: null,
        locality: 'Megacity',
        country: 'FR',
        address: (
            `1, somewhere av.\n` +
            `12340 Megacity`
        ),
        company_id: 1,
        company: companies.default(1),
        language: 'en',
        note: null,
        is_invoiceable: true,
        is_deleted: false,
        stats: {
            borrowings: 2,
        },
    },
    {
        id: 2,
        user_id: 2,
        user: users.default(2),
        first_name: 'Roger',
        last_name: 'Rabbit',
        full_name: 'Roger Rabbit',
        reference: '0002',
        email: 'tester2@loxya.com',
        phone: null,
        street: null,
        additional_street: null,
        postal_code: null,
        administrative_area: null,
        locality: null,
        country: 'FR',
        address: null,
        company_id: null,
        company: null,
        language: 'en',
        note: null,
        is_invoiceable: true,
        is_deleted: false,
        stats: {
            borrowings: 2,
        },
    },
    {
        id: 3,
        user_id: null,
        user: null,
        first_name: 'Élise',
        last_name: 'Faure',
        full_name: 'Élise Faure',
        reference: '0003',
        email: 'elise@loxya.fr',
        phone: '+33123456789',
        street: '156 bis, avenue des tests poussés',
        additional_street: 'Étage 3, Porte 2',
        postal_code: '88080',
        administrative_area: null,
        locality: 'Wazzaville',
        country: 'FR',
        address: (
            `156 bis, avenue des tests poussés\n` +
            `Étage 3, Porte 2\n` +
            `88080 Wazzaville`
        ),
        company_id: null,
        company: null,
        language: null,
        note: null,
        is_invoiceable: true,
        is_deleted: false,
        stats: {
            borrowings: 1,
        },
    },
    {
        id: 4,
        user_id: null,
        user: null,
        first_name: 'John',
        last_name: 'Doe',
        full_name: 'John Doe',
        reference: '0004',
        email: 'john@doe.test',
        phone: '+17705555765',
        street: `47 W 13th St`,
        additional_street: null,
        postal_code: '10011',
        administrative_area: 'NY',
        locality: `New York`,
        country: 'US',
        address: (
            `47 W 13th St\n` +
            `New York, NY 10011`
        ),
        company_id: null,
        company: null,
        language: null,
        note: null,
        is_invoiceable: true,
        is_deleted: false,
        stats: {
            borrowings: 0,
        },
    },
];

//
// - Exports
//

/** @type {import('./@utils').FactoryReturnType} */
const asSummary = dataFactory(data, (beneficiary) => (
    omit(beneficiary, [
        'user',
        'user_id',
        'phone',
        'street',
        'additional_street',
        'postal_code',
        'administrative_area',
        'locality',
        'country',
        'address',
        'company_id',
        'language',
        'note',
        'stats',
        'is_invoiceable',
        'is_deleted',
    ])
));

/** @type {import('./@utils').FactoryReturnType} */
const asDefault = dataFactory(data, (beneficiary) => (
    omit(beneficiary, ['user', 'stats'])
));

/** @type {import('./@utils').FactoryReturnType} */
const asDetails = dataFactory(data);

export default {
    default: asDefault,
    details: asDetails,
    summary: asSummary,
};
