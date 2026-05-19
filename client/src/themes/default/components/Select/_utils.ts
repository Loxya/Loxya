/* eslint-disable import/prefer-default-export */

import type { OptionValue } from './_types';

export const areValuesEqual = (a: OptionValue, b: OptionValue): boolean => {
    if (a === b) {
        return true;
    }

    if (a === null || a === undefined || b === null || b === undefined) {
        return false;
    }

    if (typeof a === 'object' && typeof b === 'object') {
        return JSON.stringify(a) === JSON.stringify(b);
    }

    if (typeof a !== 'object' && typeof b !== 'object') {
        return a.toString() === b.toString();
    }

    return false;
};
