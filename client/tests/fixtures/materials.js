import { dataFactory } from './@utils';
import omit from 'lodash/omit';
import pick from 'lodash/pick';
import properties from './properties';
import tags from './tags';

const data = [
    {
        id: 1,
        name: 'Console Yamaha CL3',
        reference: 'CL3',
        description: 'Console numérique 64 entrées / 8 sorties + Master + Sub',
        park_id: 1,
        category_id: 1,
        sub_category_id: 1,
        rental_price: '300',
        degressive_rate_id: 3,
        degressive_rate: '6.00',
        rental_price_period: '1800',
        tax_id: 1,
        stock_quantity: 5,
        out_of_order_quantity: 1,
        available_quantity: 4,
        departure_inventory_todo: null,
        return_inventory_todo: null,
        replacement_price: '19400',
        is_hidden_on_bill: false,
        is_discountable: false,
        is_deleted: false,
        picture: 'http://loxya.test/materials/1/picture',
        note: null,
        properties: [
            { ...properties.default(2), value: 'Grise' },
            { ...properties.default(1), value: 36.5 },
            { ...properties.default(3), value: 850 },
        ],
        tags: [
            tags.default(1),
        ],
        created_at: '2021-02-12 23:00:00',
        updated_at: '2021-02-12 23:00:00',
    },
    {
        id: 2,
        name: 'Processeur DBX PA2',
        reference: 'DBXPA2',
        description: 'Système de diffusion numérique',
        park_id: 1,
        category_id: 1,
        sub_category_id: 2,
        rental_price: '25.5',
        degressive_rate_id: null,
        degressive_rate: '1.00',
        rental_price_period: '25.5',
        tax_id: 1,
        stock_quantity: 2,
        out_of_order_quantity: 0,
        available_quantity: 2,
        departure_inventory_todo: null,
        return_inventory_todo: null,
        replacement_price: '349.9',
        is_hidden_on_bill: false,
        is_discountable: true,
        is_deleted: false,
        picture: null,
        note: null,
        properties: [
            { ...properties.default(1), value: 2.2 },
            { ...properties.default(3), value: 35 },
        ],
        tags: [
            tags.default(1),
        ],
        created_at: '2021-02-12 23:01:00',
        updated_at: '2021-02-12 23:02:00',
    },
    {
        id: 3,
        name: 'PAR64 LED',
        reference: 'PAR64LED',
        description: 'Projecteur PAR64 à LED, avec son set de gélatines',
        park_id: 1,
        category_id: 2,
        sub_category_id: 3,
        rental_price: '3.5',
        degressive_rate_id: 1,
        degressive_rate: '1.00',
        rental_price_period: '3.5',
        tax_id: null,
        stock_quantity: 34,
        out_of_order_quantity: 4,
        available_quantity: 30,
        departure_inventory_todo: null,
        return_inventory_todo: null,
        replacement_price: '89',
        is_hidden_on_bill: false,
        is_discountable: true,
        is_deleted: false,
        picture: null,
        note: 'Soyez délicats avec ces projos !',
        properties: [
            { ...properties.default(1), value: 0.85 },
            { ...properties.default(3), value: 150 },
        ],
        tags: [
            tags.default(1),
        ],
        created_at: '2021-02-12 23:02:00',
        updated_at: '2021-02-12 23:02:00',
    },
    {
        id: 4,
        name: 'Showtec SDS-6',
        reference: 'SDS-6-01',
        description: `Console DMX (jeu d'orgue) Showtec 6 canaux`,
        park_id: 1,
        category_id: 2,
        sub_category_id: 4,
        rental_price: '15.95',
        degressive_rate_id: 1,
        degressive_rate: '1.25',
        rental_price_period: '19.94',
        tax_id: 1,
        stock_quantity: 2,
        out_of_order_quantity: 0,
        available_quantity: 2,
        departure_inventory_todo: null,
        return_inventory_todo: null,
        replacement_price: '59',
        is_hidden_on_bill: false,
        is_discountable: true,
        is_deleted: false,
        picture: null,
        note: null,
        properties: [
            { ...properties.default(4), value: true },
            { ...properties.default(1), value: 3.15 },
            { ...properties.default(3), value: 60 },
        ],
        tags: [],
        created_at: '2021-02-12 23:03:00',
        updated_at: '2021-02-12 23:03:00',
    },
    {
        id: 5,
        name: 'Câble XLR 10m',
        reference: 'XLR10',
        description: 'Câble audio XLR 10 mètres, mâle-femelle',
        park_id: 1,
        category_id: 1,
        sub_category_id: null,
        rental_price: '0.5',
        degressive_rate_id: 3,
        degressive_rate: '1.00',
        rental_price_period: '0.5',
        tax_id: 2,
        stock_quantity: 40,
        out_of_order_quantity: 8,
        available_quantity: 32,
        departure_inventory_todo: null,
        return_inventory_todo: null,
        replacement_price: '9.5',
        is_hidden_on_bill: true,
        is_discountable: true,
        is_deleted: false,
        picture: null,
        note: null,
        properties: [],
        tags: [],
        created_at: '2021-02-12 23:14:00',
        updated_at: '2021-02-12 23:14:00',
    },
    {
        id: 6,
        name: 'Behringer X Air XR18',
        description: 'Mélangeur numérique 18 canaux',
        reference: 'XR18',
        park_id: 1,
        category_id: 1,
        sub_category_id: 1,
        rental_price: '49.99',
        degressive_rate_id: 1,
        degressive_rate: '1.50',
        rental_price_period: '74.99',
        tax_id: 1,
        stock_quantity: 3,
        out_of_order_quantity: 1,
        available_quantity: 2,
        departure_inventory_todo: null,
        return_inventory_todo: null,
        replacement_price: '419',
        is_hidden_on_bill: false,
        is_discountable: false,
        is_deleted: false,
        picture: null,
        note: null,
        tags: [],
        properties: [
            { ...properties.default(5), value: '2021-01-28' },
            { ...properties.default(7), value: `Polyvalent` },
            { ...properties.default(6), value: 250 },
        ],
        created_at: '2021-02-12 23:15:00',
        updated_at: '2021-02-12 23:15:00',
    },
    {
        id: 7,
        name: 'Volkswagen Transporter',
        description: 'Volume utile: 9.3 m3',
        reference: 'Transporter',
        park_id: 2,
        category_id: 3,
        sub_category_id: null,
        rental_price: '300',
        degressive_rate_id: 2,
        degressive_rate: '3.00',
        rental_price_period: '900.00',
        tax_id: null,
        stock_quantity: 2,
        out_of_order_quantity: 0,
        available_quantity: 2,
        departure_inventory_todo: null,
        return_inventory_todo: null,
        replacement_price: '32000',
        is_hidden_on_bill: false,
        is_discountable: false,
        is_deleted: false,
        picture: null,
        note: null,
        tags: [],
        properties: [
            { ...properties.default(7), value: `Extérieur` },
        ],
        created_at: '2021-02-12 23:16:00',
        updated_at: '2021-02-12 23:16:00',
    },
    {
        id: 8,
        name: 'Décor Thème Forêt',
        description: 'Forêt mystique, typique des récits fantastiques.',
        reference: 'Decor-Forest',
        park_id: 1,
        category_id: 4,
        sub_category_id: null,
        rental_price: '1500',
        degressive_rate_id: 3,
        degressive_rate: '1.00',
        rental_price_period: '1500.00',
        tax_id: 4,
        stock_quantity: 2,
        out_of_order_quantity: 0,
        available_quantity: 2,
        departure_inventory_todo: null,
        return_inventory_todo: null,
        replacement_price: '8500',
        is_hidden_on_bill: false,
        is_discountable: true,
        is_deleted: false,
        picture: null,
        note: null,
        tags: [],
        properties: [
            { ...properties.default(7), value: `Intérieur` },
        ],
        created_at: '2021-02-12 23:18:00',
        updated_at: '2021-02-12 23:18:00',
    },
];

//
// - Exports
//

/** @type {import('./@utils').FactoryReturnType} */
const asDefault = dataFactory(data, (material) => (
    omit(material, [
        'degressive_rate',
        'rental_price_period',
        'available_quantity',
        'departure_inventory_todo',
        'return_inventory_todo',
        'is_deleted',
    ])
));

/** @type {import('./@utils').FactoryReturnType} */
const withAvailability = dataFactory(data, (material) => {
    if (material.is_unitary) {
        material.units = material.units.map((lazyUnit) => (
            units.withAvailability(lazyUnit().id)
        ));
    }
    return omit(material, [
        'degressive_rate',
        'rental_price_period',
        'departure_inventory_todo',
        'return_inventory_todo',
    ]);
});

/** @type {import('./@utils').FactoryReturnType} */
const withContext = dataFactory(data, (material) => {
    if (material.is_unitary) {
        material.units = material.units.map((lazyUnit) => (
            units.withAvailability(lazyUnit().id)
        ));
    }
    return omit(material, [
        'departure_inventory_todo',
        'return_inventory_todo',
    ]);
});

/** @type {import('./@utils').FactoryReturnType} */
const withContextExcerpt = dataFactory(data, (material) => {
    if (material.is_unitary) {
        material.units = material.units.map(
            (lazyUnit) => lazyUnit(),
        );
    }
    return omit(material, [
        'available_quantity',
        'departure_inventory_todo',
        'return_inventory_todo',
    ]);
});

/** @type {import('./@utils').FactoryReturnType} */
const asDetails = dataFactory(data, (material) => {
    if (material.is_unitary) {
        material.units = material.units.map(
            (lazyUnit) => lazyUnit(),
        );
    }
    return omit(material, [
        'degressive_rate',
        'rental_price_period',
        'is_deleted',
    ]);
});

/** @type {import('./@utils').FactoryReturnType} */
const asPublic = dataFactory(data, (material) => (
    pick(material, [
        'id',
        'name',
        'description',
        'picture',
        'degressive_rate',
        'available_quantity',
        'rental_price',
        'rental_price_period',
    ])
));

export default {
    default: asDefault,
    details: asDetails,
    public: asPublic,
    withAvailability,
    withContext,
    withContextExcerpt,
};
