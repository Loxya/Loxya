import { dataFactory } from './@utils';

const data = [
    {
        id: 1,
        legal_name: 'Testing, Inc',
        is_public_entity: false,
        registration_id: '12345678900001',
        vat_number: 'FR32123456789',
        invoice_identifier: '0225:123456789_LOCATION',
        service_code: null,
        street: '10 avenue de la gare',
        additional_street: 'Bâtiment D',
        postal_code: '74000',
        administrative_area: null,
        locality: 'Annecy',
        country: 'FR',
        address: (
            `10 avenue de la gare\n` +
            `Bâtiment D\n` +
            `74000 Annecy`
        ),
        phone: '+33123456789',
        note: `Anciennement Machin, Inc.`,
    },
    {
        id: 2,
        legal_name: 'Obscure',
        is_public_entity: false,
        registration_id: 'CHE-123.456.789',
        vat_number: 'CHE-123.456.789 TVA',
        invoice_identifier: null,
        service_code: null,
        street: `Rue de Cornavin, 1`,
        additional_street: null,
        postal_code: null,
        administrative_area: null,
        locality: '1000',
        country: 'CH',
        address: (
            `Rue de Cornavin, 1\n` +
            `1000 Lausanne`
        ),
        phone: '+41211234567',
        note: null,
    },
];

//
// - Exports
//

/** @type {import('./@utils').FactoryReturnType} */
const asDefault = dataFactory(data);

export default { default: asDefault };
