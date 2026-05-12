import { getLocale } from '@/globals/lang';
import Decimal from 'decimal.js';
import config from '@/globals/config';

import type Currency from '@/utils/currency';

/**
 * Formate un montant avec sa devise, selon la locale actuelle.
 *
 * @param rawAmount - Le montant à formater.
 * @param currency - La devise à utiliser.
 *
 * @returns Le montant formaté avec sa devise.
 */
const formatAmount = (rawAmount: number | Decimal = 0, currency?: Currency): string => {
    let amount = rawAmount;
    if (rawAmount instanceof Decimal) {
        amount = rawAmount.toNumber();
    }

    return amount.toLocaleString(getLocale(), {
        style: 'currency',
        currency: (currency ?? config.currency).code,
        currencyDisplay: 'symbol',
        useGrouping: true,
    });
};

export default formatAmount;
