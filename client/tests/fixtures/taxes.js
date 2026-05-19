import { dataFactory } from './@utils';

const data = [
    {
        id: 1,
        is_group: false,
        is_used: true,
        value: '20.000',
    },
    {
        id: 2,
        is_group: false,
        is_used: false,
        value: '5.500',
    },
    {
        id: 3,
        is_group: false,
        is_used: false,
        value: '10.000',
    },
];

//
// - Exports
//

/** @type {import('./@utils').FactoryReturnType} */
const asDefault = dataFactory(data);

export default { default: asDefault };
