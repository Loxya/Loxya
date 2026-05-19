import { getLocale } from '@/globals/lang';
import Decimal from 'decimal.js';

/**
 * Formate un nombre selon la locale actuelle.
 *
 * @param rawNumber - Le nombre à formater.
 * @param precision - Le nombre de décimales à afficher.
 *
 * @returns Le nombre formaté.
 */
const formatNumber = (rawNumber: number | Decimal, precision?: number): string => {
    let number = rawNumber;
    if (rawNumber instanceof Decimal) {
        number = rawNumber.toNumber();
    }

    return number.toLocaleString(getLocale(), {
        style: 'decimal',
        useGrouping: true,
        minimumFractionDigits: precision,
        maximumFractionDigits: precision,
    });
};

export default formatNumber;
