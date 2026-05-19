import type {
    AddressField,
    LocalityType,
    PostalCodeType,
    AdministrativeAreaType,
} from './_constants';

export type RawAddressingData = {
    format: string,
    requiredFields: AddressField[],
    administrativeAreaType: AdministrativeAreaType,
    localityType: LocalityType,
    postalCodeType: PostalCodeType,
};

export type AddressingData = RawAddressingData & {
    groupedFields: AddressField[][],
    usedFields: AddressField[],
};
