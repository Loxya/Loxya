import omit from 'lodash/omit';
import { dataFactory } from './@utils';
import countries from './countries';
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
        postal_code: '1234',
        locality: 'Megacity',
        country_id: 1,
        country: countries.default(1),
        full_address: '1, somewhere av.\n1234 Megacity',
        company_id: 1,
        company: companies.default(1),
        note: null,
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
        postal_code: null,
        locality: null,
        country_id: null,
        country: null,
        full_address: null,
        company_id: null,
        company: null,
        note: null,
        stats: {
            borrowings: 2,
        },
    },
    {
        id: 3,
        user_id: null,
        user: null,
        first_name: 'Client',
        last_name: 'Benef',
        full_name: 'Client Benef',
        reference: '0003',
        email: 'client@beneficiaires.com',
        phone: '+33123456789',
        street: '156 bis, avenue des tests poussés',
        postal_code: '88080',
        locality: 'Wazzaville',
        country_id: null,
        country: null,
        full_address: '156 bis, avenue des tests poussés\n88080 Wazzaville',
        company_id: null,
        company: null,
        note: null,
        stats: {
            borrowings: 1,
        },
    },
    {
        id: 4,
        user_id: null,
        user: null,
        first_name: 'Alphonse',
        last_name: 'Latour',
        full_name: 'Alphonse Latour',
        reference: '0004',
        email: 'alphonse@latour.test',
        phone: null,
        street: null,
        postal_code: null,
        locality: null,
        country_id: null,
        country: null,
        full_address: null,
        company_id: null,
        company: null,
        note: null,
        stats: {
            borrowings: 0,
        },
    },
];

//
// - Exports
//

/** @type {import('./@utils').FactoryReturnType} */
const asDetails = dataFactory(data);

/** @type {import('./@utils').FactoryReturnType} */
const asDefault = dataFactory(data, (beneficiary) => (
    omit(beneficiary, ['user', 'stats'])
));

export default {
    default: asDefault,
    details: asDetails,
};
