import { dataFactory } from './@utils';
import omit from 'lodash/omit';
import pick from 'lodash/pick';

const data = [
    {
        id: 1,
        name: 'Défaut',
        street: '10 rue des canaux',
        additional_street: 'Hangar 951',
        postal_code: '01234',
        administrative_area: null,
        locality: 'Secretville',
        country: 'FR',
        address: (
            `10 rue des canaux\n` +
            `Hangar 951\n` +
            `01234 Secretville`
        ),
        opening_hours: `Du lundi au vendredi, de 09:00 à 19:00.`,
        note: null,
        total_items: 7,
        total_stock_quantity: 87,
        has_ongoing_booking: false,
    },
    {
        id: 2,
        name: 'Spare',
        street: null,
        additional_street: null,
        postal_code: null,
        administrative_area: null,
        locality: null,
        country: 'FR',
        address: null,
        opening_hours: null,
        note: `Les bidouilles de fond de tiroir`,
        total_items: 2,
        total_stock_quantity: 3,
        has_ongoing_booking: false,
    },
];

//
// - Exports
//

/** @type {import('./@utils').FactoryReturnType} */
const asSummary = dataFactory(data, (park) => (
    pick(park, ['id', 'name'])
));

/** @type {import('./@utils').FactoryReturnType} */
const asDefault = dataFactory(data, (park) => (
    omit(park, [
        'has_ongoing_booking',
    ])
));

/** @type {import('./@utils').FactoryReturnType} */
const asDetails = dataFactory(data);

export default {
    default: asDefault,
    details: asDetails,
    summary: asSummary,
};
