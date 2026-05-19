/* eslint-disable import/prefer-default-export */

import data from './_data';
import {
    AddressField,
    LocalityType,
    PostalCodeType,
    AdministrativeAreaType,
} from './_constants';

import type { RawAddressingData, AddressingData } from './_types';

/** Regex pour cibler les tokens dans une chaîne de formatage d'adresse. */
const TOKEN_PATTERN = new RegExp(`%(${Object.values(AddressField).join('|')})`, 'g');

const BASE_DATA: RawAddressingData = {
    format: (
        `%${AddressField.ADDRESS_LINE1}\n` +
        `%${AddressField.ADDRESS_LINE2}\n` +
        `%${AddressField.LOCALITY}`
    ),
    requiredFields: [AddressField.ADDRESS_LINE1, AddressField.LOCALITY],
    administrativeAreaType: AdministrativeAreaType.PROVINCE,
    localityType: LocalityType.CITY,
    postalCodeType: PostalCodeType.POSTAL,
};

const getGroupedFields = (formatString: string): AddressField[][] => {
    const groupedFields: AddressField[][] = [];
    formatString.split('\n').forEach((line: string, index: number) => {
        const foundTokens = [...line.matchAll(TOKEN_PATTERN)];
        foundTokens.forEach((match: RegExpExecArray) => {
            groupedFields[index] ??= [];
            groupedFields[index].push(match[1] as AddressField);
        });
    });
    return groupedFields.filter(Boolean);
};

export const getAddressingData = (countryCode: string): AddressingData => {
    countryCode = countryCode.toUpperCase();
    const rawData: RawAddressingData = { ...BASE_DATA, ...data.get(countryCode) };
    const groupedFields: AddressField[][] = getGroupedFields(rawData.format);
    const usedFields: AddressField[] = groupedFields.flat();
    return { ...rawData, groupedFields, usedFields };
};
