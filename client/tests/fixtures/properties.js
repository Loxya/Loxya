import omit from 'lodash/omit';
import categories from './categories';
import { CustomFieldType } from '@/stores/api/@types';
import { PropertyEntity } from '@/stores/api/properties';
import { dataFactory } from './@utils';

const data = [
    {
        id: 1,
        name: `Poids`,
        entities: [PropertyEntity.MATERIAL],
        type: CustomFieldType.FLOAT,
        unit: 'kg',
        is_totalisable: true,
        categories: [
            categories.default(2),
            categories.default(1),
        ],
    },
    {
        id: 2,
        name: `Couleur`,
        entities: [
            PropertyEntity.MATERIAL,
        ],
        type: CustomFieldType.STRING,
        max_length: null,
        categories: [],
    },
    {
        id: 3,
        name: `Puissance`,
        entities: [PropertyEntity.MATERIAL],
        type: CustomFieldType.INTEGER,
        unit: 'W',
        is_totalisable: true,
        categories: [
            categories.default(2),
            categories.default(1),
        ],
    },
    {
        id: 4,
        name: `Conforme`,
        entities: [PropertyEntity.MATERIAL],
        type: CustomFieldType.BOOLEAN,
        categories: [],
    },
    {
        id: 5,
        name: `Date d'achat`,
        entities: [
            PropertyEntity.MATERIAL,
        ],
        type: CustomFieldType.DATE,
        categories: [],
    },
    {
        id: 6,
        name: `Prix d'achat`,
        entities: [
            PropertyEntity.MATERIAL,
        ],
        type: CustomFieldType.FLOAT,
        unit: '€',
        is_totalisable: true,
        categories: [],
    },
    {
        id: 7,
        name: `Lieu d'usage`,
        entities: [
            PropertyEntity.MATERIAL,
        ],
        type: CustomFieldType.LIST,
        options: [`Intérieur`, `Extérieur`, `Polyvalent`],
        categories: [],
    },
];

//
// - Exports
//

/** @type {import('./@utils').FactoryReturnType} */
const asSummary = dataFactory(data, (property) => (
    omit(property, ['entities', 'categories', 'is_totalisable'])
));

/** @type {import('./@utils').FactoryReturnType} */
const asDefault = dataFactory(data, (property) => (
    omit(property, ['categories'])
));

/** @type {import('./@utils').FactoryReturnType} */
const asDetails = dataFactory(data);

export default {
    summary: asSummary,
    default: asDefault,
    details: asDetails,
};
