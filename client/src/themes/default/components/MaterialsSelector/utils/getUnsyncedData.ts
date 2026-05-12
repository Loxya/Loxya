import config from '@/globals/config';
import Decimal from 'decimal.js';

import type Currency from '@/utils/currency';
import type { SourceMaterial } from '../_types';

export type UnsyncedDataValue<T> = {
    isUnsynced: boolean,
    isResyncable: boolean,
    base: T,
    override: T | null,
    current: T,
};

/* eslint-disable @typescript-eslint/naming-convention */
type UnsyncedDataSimple = {
    name: ReturnType<typeof getNameUnsyncedData>,
    reference: ReturnType<typeof getReferenceUnsyncedData>,
    unit_replacement_price: ReturnType<typeof getUnitReplacementPriceUnsyncedData>,
};

type UnsyncedDataBilling = {
    unit_price: ReturnType<typeof getUnitPriceUnsyncedData>,
    degressive_rate: ReturnType<typeof getDegressiveRateUnsyncedData>,
};
/* eslint-enable @typescript-eslint/naming-convention */

export type UnsyncedData<WithBilling extends boolean = boolean> = WithBilling extends true
    ? (UnsyncedDataSimple & UnsyncedDataBilling)
    : (UnsyncedDataSimple & Partial<UnsyncedDataBilling>);

const getNameUnsyncedData = (material: SourceMaterial): UnsyncedDataValue<string> => {
    const base = material.name;
    const override = material.overrides !== null
        ? material.overrides.name
        : null;

    const isUnsynced = override !== null
        ? base !== override
        : false;

    return {
        base,
        override,
        isUnsynced,
        isResyncable: isUnsynced,
        current: override ?? base,
    };
};

const getReferenceUnsyncedData = (material: SourceMaterial): UnsyncedDataValue<string> => {
    const base = material.reference;
    const override = material.overrides !== null
        ? material.overrides.reference
        : null;

    const isUnsynced = override !== null
        ? base !== override
        : false;

    return {
        base,
        override,
        isUnsynced,
        isResyncable: isUnsynced,
        current: override ?? base,
    };
};

const getDegressiveRateUnsyncedData = (material: SourceMaterial): UnsyncedDataValue<Decimal> => {
    const base = 'degressive_rate' in material
        ? (material.degressive_rate ?? new Decimal(0))
        : new Decimal(0);

    const override = material.overrides !== null
        ? (material.overrides.degressive_rate ?? new Decimal(0))
        : null;

    const isUnsynced = override !== null
        ? !override.equals(base)
        : false;

    return {
        base,
        override,
        isUnsynced,
        isResyncable: isUnsynced,
        current: override ?? base,
    };
};

const getUnitPriceUnsyncedData = (material: SourceMaterial): UnsyncedDataValue<{ price: Decimal, currency: Currency }> => {
    const basePrice = 'rental_price' in material
        ? (material.rental_price ?? new Decimal(0))
        : new Decimal(0);

    const baseCurrency = config.currency;

    const overridePrice = material.overrides !== null
        ? (material.overrides.rental_price ?? new Decimal(0))
        : null;

    const overrideCurrency = material.overrides !== null
        ? material.overrides.currency
        : null;

    const hasCurrencyChanged = material.overrides !== null
        ? !overrideCurrency!.isSame(baseCurrency)
        : false;

    const isUnsynced = material.overrides === null ? false : (
        hasCurrencyChanged || !overridePrice!.equals(basePrice)
    );

    const isResyncable = isUnsynced && !hasCurrencyChanged;

    const base = { price: basePrice, currency: baseCurrency };
    const override = overridePrice !== null && overrideCurrency !== null
        ? { price: overridePrice, currency: overrideCurrency }
        : null;

    return {
        base,
        override,
        isUnsynced,
        isResyncable,
        current: override ?? base,
    };
};

const getUnitReplacementPriceUnsyncedData = (material: SourceMaterial): UnsyncedDataValue<Decimal | null> => {
    const base = material.replacement_price;
    const override = material.overrides?.replacement_price ?? null;

    // - Si l'override et la base sont `null`, alors ce n'est pas unsynced.
    //   Si l'override est non `null`, alors c'est unsynced quand la base est
    //   nulle ou qu'elle est différente de l'override.
    const isUnsynced = override !== null
        ? base === null || !base.equals(override)
        : base !== null;

    return {
        base,
        override,
        isUnsynced,
        isResyncable: isUnsynced,
        current: override,
    };
};

const getUnsyncedData = <T extends boolean>(material: SourceMaterial, withBilling: T): UnsyncedData<T> => {
    const name = getNameUnsyncedData(material);
    const reference = getReferenceUnsyncedData(material);

    if (!withBilling) {
        return { name, reference } as UnsyncedData<T>;
    }

    return {
        name,
        reference,
        unit_price: getUnitPriceUnsyncedData(material),
        unit_replacement_price: getUnitReplacementPriceUnsyncedData(material),
        degressive_rate: getDegressiveRateUnsyncedData(material),
    } as UnsyncedData<T>;
};

export default getUnsyncedData;
