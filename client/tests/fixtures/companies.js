import { dataFactory } from './@utils';
import countries from './countries';

const data = [
    {
        id: 1,
        legal_name: 'Testing, Inc',
        registration_id: null,
        street: '1, company st.',
        postal_code: '1234',
        locality: 'Megacity',
        country_id: 1,
        full_address: `1, company st.\n1234 Megacity`,
        phone: '+4123456789',
        note: 'Just for tests',
        country: countries.default(1),
    },
    {
        id: 2,
        legal_name: 'Obscure',
        registration_id: '123456789',
        street: null,
        postal_code: null,
        locality: null,
        country_id: null,
        full_address: null,
        phone: null,
        note: null,
        country: null,
    },
];

//
// - Exports
//

/** @type {import('./@utils').FactoryReturnType} */
const asDefault = dataFactory(data);

export default { default: asDefault };
