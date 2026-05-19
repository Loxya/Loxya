import type { LineTax } from '../_types';

const sorter = (a: LineTax, b: LineTax): number => {
    const nameComparison = (a.name ?? '').localeCompare(b.name ?? '');
    return nameComparison !== 0 ? nameComparison : b.value.comparedTo(a.value);
};

const comparator = (a: LineTax, b: LineTax): boolean => {
    if (a.name !== b.name) {
        return false;
    }
    return a.value.equals(b.value);
};

const areLineTaxesEqualsFactory = () => (
    (a: LineTax[] | null, b: LineTax[] | null): boolean => {
        if (a === null || b === null) {
            return a === null && b === null;
        }

        if (a.length !== b.length) {
            return false;
        }

        const aSorted = a.toSorted(sorter);
        const bSorted = b.toSorted(sorter);

        return aSorted.every((_a: LineTax, index: number) => {
            const _b = bSorted[index];
            return comparator(_a, _b);
        });
    }
);

export default areLineTaxesEqualsFactory;
