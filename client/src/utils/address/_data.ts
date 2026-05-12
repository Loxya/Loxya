import {
    AddressField,
    LocalityType,
    PostalCodeType,
    AdministrativeAreaType,
} from './_constants';

import type { RawAddressingData } from './_types';

const data: Record<string, Partial<RawAddressingData>> = {
    AC: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.LOCALITY}\n` +
            `%${AddressField.POSTAL_CODE}`
        ),
    },
    AD: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.POSTAL_CODE} %${AddressField.LOCALITY}`
        ),
    },
    AE: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.ADMINISTRATIVE_AREA}`
        ),
        requiredFields: [AddressField.ADDRESS_LINE1, AddressField.ADMINISTRATIVE_AREA],
        administrativeAreaType: AdministrativeAreaType.EMIRATE,
    },
    AF: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.LOCALITY}\n` +
            `%${AddressField.POSTAL_CODE}`
        ),
    },
    AG: {
        requiredFields: [AddressField.ADDRESS_LINE1],
    },
    AI: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.LOCALITY}\n` +
            `%${AddressField.POSTAL_CODE}`
        ),
    },
    AL: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.POSTAL_CODE}\n` +
            `%${AddressField.LOCALITY}`
        ),
    },
    AM: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.POSTAL_CODE}\n` +
            `%${AddressField.LOCALITY}\n` +
            `%${AddressField.ADMINISTRATIVE_AREA}`
        ),
    },
    AR: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.POSTAL_CODE} %${AddressField.LOCALITY}\n` +
            `%${AddressField.ADMINISTRATIVE_AREA}`
        ),
    },
    AS: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.LOCALITY} %${AddressField.POSTAL_CODE}`
        ),
        requiredFields: [AddressField.ADDRESS_LINE1, AddressField.LOCALITY, AddressField.POSTAL_CODE],
        postalCodeType: PostalCodeType.ZIP,
    },
    AT: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.POSTAL_CODE} %${AddressField.LOCALITY}`
        ),
        requiredFields: [AddressField.ADDRESS_LINE1, AddressField.LOCALITY, AddressField.POSTAL_CODE],
    },
    AU: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.LOCALITY} %${AddressField.ADMINISTRATIVE_AREA} %${AddressField.POSTAL_CODE}`
        ),
        requiredFields: [AddressField.ADDRESS_LINE1, AddressField.LOCALITY, AddressField.ADMINISTRATIVE_AREA, AddressField.POSTAL_CODE],
        administrativeAreaType: AdministrativeAreaType.STATE,
        localityType: LocalityType.SUBURB,
    },
    AX: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.POSTAL_CODE} %${AddressField.LOCALITY}`
        ),
        requiredFields: [AddressField.ADDRESS_LINE1, AddressField.LOCALITY, AddressField.POSTAL_CODE],
    },
    AZ: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.POSTAL_CODE} %${AddressField.LOCALITY}`
        ),
    },
    BA: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.POSTAL_CODE} %${AddressField.LOCALITY}`
        ),
    },
    BB: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.LOCALITY}, %${AddressField.ADMINISTRATIVE_AREA} %${AddressField.POSTAL_CODE}`
        ),
        requiredFields: [AddressField.ADDRESS_LINE1, AddressField.LOCALITY, AddressField.ADMINISTRATIVE_AREA],
        administrativeAreaType: AdministrativeAreaType.PARISH,
    },
    BD: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.LOCALITY} - %${AddressField.POSTAL_CODE}`
        ),
    },
    BE: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.POSTAL_CODE} %${AddressField.LOCALITY}`
        ),
        requiredFields: [AddressField.ADDRESS_LINE1, AddressField.LOCALITY, AddressField.POSTAL_CODE],
    },
    BF: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.LOCALITY}`
        ),
    },
    BG: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.POSTAL_CODE} %${AddressField.LOCALITY}`
        ),
    },
    BH: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.LOCALITY} %${AddressField.POSTAL_CODE}`
        ),
    },
    BL: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.POSTAL_CODE} %${AddressField.LOCALITY}`
        ),
        requiredFields: [AddressField.ADDRESS_LINE1, AddressField.LOCALITY, AddressField.POSTAL_CODE],
    },
    BM: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.LOCALITY} %${AddressField.POSTAL_CODE}`
        ),
    },
    BN: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.LOCALITY} %${AddressField.POSTAL_CODE}`
        ),
    },
    BR: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.LOCALITY}-%${AddressField.ADMINISTRATIVE_AREA}\n` +
            `%${AddressField.POSTAL_CODE}`
        ),
        requiredFields: [AddressField.ADDRESS_LINE1, AddressField.ADMINISTRATIVE_AREA, AddressField.LOCALITY, AddressField.POSTAL_CODE],
        administrativeAreaType: AdministrativeAreaType.STATE,
    },
    BS: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.LOCALITY}, %${AddressField.ADMINISTRATIVE_AREA}`
        ),
        administrativeAreaType: AdministrativeAreaType.ISLAND,
    },
    BT: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.LOCALITY} %${AddressField.POSTAL_CODE}`
        ),
    },
    BY: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.POSTAL_CODE}, %${AddressField.LOCALITY}\n` +
            `%${AddressField.ADMINISTRATIVE_AREA}`
        ),
        administrativeAreaType: AdministrativeAreaType.REGION,
    },
    CA: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.LOCALITY} %${AddressField.ADMINISTRATIVE_AREA} %${AddressField.POSTAL_CODE}`
        ),
        requiredFields: [
            AddressField.ADDRESS_LINE1,
            AddressField.LOCALITY,
            AddressField.ADMINISTRATIVE_AREA,
            AddressField.POSTAL_CODE,
        ],
    },
    CC: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.LOCALITY} %${AddressField.POSTAL_CODE}`
        ),
    },
    CH: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.POSTAL_CODE} %${AddressField.LOCALITY}`
        ),
        administrativeAreaType: AdministrativeAreaType.CANTON,
        requiredFields: [AddressField.ADDRESS_LINE1, AddressField.LOCALITY, AddressField.POSTAL_CODE],
    },
    CI: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2} %${AddressField.LOCALITY}`
        ),
    },
    CL: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.POSTAL_CODE} %${AddressField.LOCALITY}\n` +
            `%${AddressField.ADMINISTRATIVE_AREA}`
        ),
        requiredFields: [AddressField.ADDRESS_LINE1, AddressField.LOCALITY, AddressField.ADMINISTRATIVE_AREA],
        administrativeAreaType: AdministrativeAreaType.REGION,
    },
    CN: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.LOCALITY}\n` +
            `%${AddressField.ADMINISTRATIVE_AREA}, %${AddressField.POSTAL_CODE}`
        ),
        // local: {
        //     code: 'zh-Hans',
        //     format: (
        //         `%${AddressField.POSTAL_CODE}\n` +
        //         `%${AddressField.ADMINISTRATIVE_AREA}%${AddressField.LOCALITY}%${AddressField.ADDRESS_LINE1}\n` +
        //         `%${AddressField.ADDRESS_LINE2}`
        //     ),
        // },
        requiredFields: [AddressField.ADDRESS_LINE1, AddressField.LOCALITY, AddressField.ADMINISTRATIVE_AREA, AddressField.POSTAL_CODE],
    },
    CO: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.LOCALITY}, %${AddressField.ADMINISTRATIVE_AREA}, %${AddressField.POSTAL_CODE}`
        ),
        requiredFields: [AddressField.ADDRESS_LINE1, AddressField.LOCALITY, AddressField.ADMINISTRATIVE_AREA],
        administrativeAreaType: AdministrativeAreaType.DEPARTMENT,
    },
    CR: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.ADMINISTRATIVE_AREA}, %${AddressField.LOCALITY}\n` +
            `%${AddressField.POSTAL_CODE}`
        ),
        requiredFields: [AddressField.ADDRESS_LINE1, AddressField.LOCALITY, AddressField.ADMINISTRATIVE_AREA],
    },
    CU: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.LOCALITY} %${AddressField.ADMINISTRATIVE_AREA}\n` +
            `%${AddressField.POSTAL_CODE}`
        ),
    },
    CV: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.POSTAL_CODE} %${AddressField.LOCALITY}\n` +
            `%${AddressField.ADMINISTRATIVE_AREA}`
        ),
        requiredFields: [AddressField.ADDRESS_LINE1, AddressField.LOCALITY, AddressField.ADMINISTRATIVE_AREA],
        administrativeAreaType: AdministrativeAreaType.ISLAND,
    },
    CX: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.LOCALITY} %${AddressField.POSTAL_CODE}`
        ),
    },
    CY: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.POSTAL_CODE} %${AddressField.LOCALITY}`
        ),
    },
    CZ: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.POSTAL_CODE} %${AddressField.LOCALITY}`
        ),
        requiredFields: [AddressField.ADDRESS_LINE1, AddressField.LOCALITY, AddressField.POSTAL_CODE],
    },
    DE: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.POSTAL_CODE} %${AddressField.LOCALITY}`
        ),
        requiredFields: [AddressField.ADDRESS_LINE1, AddressField.LOCALITY, AddressField.POSTAL_CODE],
    },
    DK: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.POSTAL_CODE} %${AddressField.LOCALITY}`
        ),
        requiredFields: [AddressField.ADDRESS_LINE1, AddressField.LOCALITY, AddressField.POSTAL_CODE],
    },
    DO: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.POSTAL_CODE} %${AddressField.LOCALITY}`
        ),
    },
    DZ: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.POSTAL_CODE} %${AddressField.LOCALITY}`
        ),
    },
    EC: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.POSTAL_CODE}\n` +
            `%${AddressField.LOCALITY}`
        ),
    },
    EE: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.POSTAL_CODE} %${AddressField.LOCALITY} %${AddressField.ADMINISTRATIVE_AREA}`
        ),
        requiredFields: [AddressField.ADDRESS_LINE1, AddressField.LOCALITY, AddressField.POSTAL_CODE],
        administrativeAreaType: AdministrativeAreaType.COUNTY,
    },
    EG: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.LOCALITY}\n` +
            `%${AddressField.ADMINISTRATIVE_AREA}\n` +
            `%${AddressField.POSTAL_CODE}`
        ),
        requiredFields: [AddressField.ADDRESS_LINE1, AddressField.LOCALITY, AddressField.ADMINISTRATIVE_AREA],
    },
    EH: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.POSTAL_CODE} %${AddressField.LOCALITY}`
        ),
    },
    ES: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.POSTAL_CODE} %${AddressField.LOCALITY} %${AddressField.ADMINISTRATIVE_AREA}`
        ),
        requiredFields: [AddressField.ADDRESS_LINE1, AddressField.LOCALITY, AddressField.ADMINISTRATIVE_AREA, AddressField.POSTAL_CODE],
    },
    ET: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.POSTAL_CODE} %${AddressField.LOCALITY}`
        ),
    },
    FI: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.POSTAL_CODE} %${AddressField.LOCALITY}`
        ),
        requiredFields: [AddressField.ADDRESS_LINE1, AddressField.LOCALITY, AddressField.POSTAL_CODE],
    },
    FK: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.LOCALITY}\n` +
            `%${AddressField.POSTAL_CODE}`
        ),
        requiredFields: [AddressField.ADDRESS_LINE1, AddressField.LOCALITY, AddressField.POSTAL_CODE],
    },
    FM: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.LOCALITY} %${AddressField.ADMINISTRATIVE_AREA} %${AddressField.POSTAL_CODE}`
        ),
        requiredFields: [AddressField.ADDRESS_LINE1, AddressField.LOCALITY, AddressField.ADMINISTRATIVE_AREA, AddressField.POSTAL_CODE],
        administrativeAreaType: AdministrativeAreaType.STATE,
        postalCodeType: PostalCodeType.ZIP,
    },
    FO: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.POSTAL_CODE} %${AddressField.LOCALITY}`
        ),
    },
    FR: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.POSTAL_CODE} %${AddressField.LOCALITY}`
        ),
        requiredFields: [AddressField.ADDRESS_LINE1, AddressField.LOCALITY, AddressField.POSTAL_CODE],
        administrativeAreaType: AdministrativeAreaType.REGION,
    },
    GB: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.LOCALITY}\n` +
            `%${AddressField.POSTAL_CODE}`
        ),
        requiredFields: [AddressField.ADDRESS_LINE1, AddressField.LOCALITY, AddressField.POSTAL_CODE],
        localityType: LocalityType.TOWN_CITY,
    },
    GE: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.POSTAL_CODE} %${AddressField.LOCALITY}`
        ),
    },
    GF: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.POSTAL_CODE} %${AddressField.LOCALITY}`
        ),
        requiredFields: [AddressField.ADDRESS_LINE1, AddressField.LOCALITY, AddressField.POSTAL_CODE],
    },
    GG: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.LOCALITY}\n` +
            `%${AddressField.POSTAL_CODE}`
        ),
        requiredFields: [AddressField.ADDRESS_LINE1, AddressField.LOCALITY, AddressField.POSTAL_CODE],
    },
    GI: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.POSTAL_CODE}`
        ),
        requiredFields: [AddressField.ADDRESS_LINE1],
    },
    GL: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.POSTAL_CODE} %${AddressField.LOCALITY}`
        ),
        requiredFields: [AddressField.ADDRESS_LINE1, AddressField.LOCALITY, AddressField.POSTAL_CODE],
    },
    GN: {
        format: (
            `%${AddressField.POSTAL_CODE} %${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.LOCALITY}`
        ),
    },
    GP: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.POSTAL_CODE} %${AddressField.LOCALITY}`
        ),
        requiredFields: [AddressField.ADDRESS_LINE1, AddressField.LOCALITY, AddressField.POSTAL_CODE],
    },
    GR: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.POSTAL_CODE} %${AddressField.LOCALITY}`
        ),
        requiredFields: [AddressField.ADDRESS_LINE1, AddressField.LOCALITY, AddressField.POSTAL_CODE],
    },
    GS: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `\n` +
            `%${AddressField.LOCALITY}\n` +
            `%${AddressField.POSTAL_CODE}`
        ),
        requiredFields: [AddressField.ADDRESS_LINE1, AddressField.LOCALITY, AddressField.POSTAL_CODE],
    },
    GT: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.POSTAL_CODE}- %${AddressField.LOCALITY}`
        ),
    },
    GU: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.LOCALITY} %${AddressField.POSTAL_CODE}`
        ),
        requiredFields: [AddressField.ADDRESS_LINE1, AddressField.LOCALITY, AddressField.POSTAL_CODE],
        postalCodeType: PostalCodeType.ZIP,
    },
    GW: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.POSTAL_CODE} %${AddressField.LOCALITY}`
        ),
    },
    HK: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.LOCALITY}\n` +
            `%${AddressField.ADMINISTRATIVE_AREA}`
        ),
        // local: {
        //     code: 'zh-Hant',
        //     format: (
        //         `%${AddressField.ADMINISTRATIVE_AREA}\n` +
        //         `%${AddressField.LOCALITY}\n` +
        //         `%${AddressField.ADDRESS_LINE1}\n` +
        //         `%${AddressField.ADDRESS_LINE2}`
        //     ),
        // },
        requiredFields: [AddressField.ADDRESS_LINE1, AddressField.ADMINISTRATIVE_AREA],
        administrativeAreaType: AdministrativeAreaType.AREA,
        localityType: LocalityType.DISTRICT,
    },
    HM: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.LOCALITY} %${AddressField.POSTAL_CODE}`
        ),
    },
    HN: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.LOCALITY}, %${AddressField.ADMINISTRATIVE_AREA}\n` +
            `%${AddressField.POSTAL_CODE}`
        ),
        requiredFields: [AddressField.ADDRESS_LINE1, AddressField.LOCALITY, AddressField.ADMINISTRATIVE_AREA],
        administrativeAreaType: AdministrativeAreaType.DEPARTMENT,
    },
    HR: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.POSTAL_CODE} %${AddressField.LOCALITY}`
        ),
    },
    HT: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.POSTAL_CODE} %${AddressField.LOCALITY}`
        ),
    },
    HU: {
        format: (
            `%${AddressField.LOCALITY}\n` +
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.POSTAL_CODE}`
        ),
        requiredFields: [AddressField.ADDRESS_LINE1, AddressField.LOCALITY, AddressField.POSTAL_CODE],
    },
    ID: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.LOCALITY}\n` +
            `%${AddressField.ADMINISTRATIVE_AREA} %${AddressField.POSTAL_CODE}`
        ),
        requiredFields: [AddressField.ADDRESS_LINE1, AddressField.ADMINISTRATIVE_AREA],
    },
    IE: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.LOCALITY}\n` +
            `%${AddressField.ADMINISTRATIVE_AREA}\n` +
            `%${AddressField.POSTAL_CODE}`
        ),
        administrativeAreaType: AdministrativeAreaType.COUNTY,
        postalCodeType: PostalCodeType.EIR,
    },
    IL: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.LOCALITY} %${AddressField.POSTAL_CODE}`
        ),
    },
    IM: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.LOCALITY}\n` +
            `%${AddressField.POSTAL_CODE}`
        ),
        requiredFields: [AddressField.ADDRESS_LINE1, AddressField.LOCALITY, AddressField.POSTAL_CODE],
    },
    IN: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.LOCALITY} %${AddressField.POSTAL_CODE}\n` +
            `%${AddressField.ADMINISTRATIVE_AREA}`
        ),
        requiredFields: [AddressField.ADDRESS_LINE1, AddressField.LOCALITY, AddressField.ADMINISTRATIVE_AREA, AddressField.POSTAL_CODE],
        administrativeAreaType: AdministrativeAreaType.STATE,
        postalCodeType: PostalCodeType.PIN,
    },
    IO: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.LOCALITY}\n` +
            `%${AddressField.POSTAL_CODE}`
        ),
        requiredFields: [AddressField.ADDRESS_LINE1, AddressField.LOCALITY, AddressField.POSTAL_CODE],
    },
    IQ: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.LOCALITY}, %${AddressField.ADMINISTRATIVE_AREA}\n` +
            `%${AddressField.POSTAL_CODE}`
        ),
        requiredFields: [AddressField.ADDRESS_LINE1, AddressField.LOCALITY, AddressField.ADMINISTRATIVE_AREA],
    },
    IR: {
        format: (
            `%${AddressField.ADMINISTRATIVE_AREA}\n` +
            `%${AddressField.LOCALITY}, %${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.POSTAL_CODE}`
        ),
        requiredFields: [AddressField.ADDRESS_LINE1, AddressField.LOCALITY, AddressField.ADMINISTRATIVE_AREA],
    },
    IS: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.POSTAL_CODE} %${AddressField.LOCALITY}`
        ),
    },
    IT: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.POSTAL_CODE} %${AddressField.LOCALITY} %${AddressField.ADMINISTRATIVE_AREA}`
        ),
        requiredFields: [AddressField.ADDRESS_LINE1, AddressField.LOCALITY, AddressField.ADMINISTRATIVE_AREA, AddressField.POSTAL_CODE],
    },
    JE: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.LOCALITY}\n` +
            `%${AddressField.POSTAL_CODE}`
        ),
        requiredFields: [AddressField.ADDRESS_LINE1, AddressField.LOCALITY, AddressField.POSTAL_CODE],
    },
    JM: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.LOCALITY}\n` +
            `%${AddressField.ADMINISTRATIVE_AREA}`
        ),
        requiredFields: [AddressField.ADDRESS_LINE1, AddressField.LOCALITY, AddressField.ADMINISTRATIVE_AREA],
        administrativeAreaType: AdministrativeAreaType.PARISH,
    },
    JO: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.LOCALITY} %${AddressField.POSTAL_CODE}`
        ),
    },
    JP: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.LOCALITY}, %${AddressField.ADMINISTRATIVE_AREA}\n` +
            `%${AddressField.POSTAL_CODE}`
        ),
        // local: {
        //     code: 'ja',
        //     format: (
        //         `〒%${AddressField.POSTAL_CODE}\n` +
        //         `%${AddressField.ADMINISTRATIVE_AREA}%${AddressField.LOCALITY}\n` +
        //         `%${AddressField.ADDRESS_LINE1}\n` +
        //         `%${AddressField.ADDRESS_LINE2}`
        //     ),
        // },
        requiredFields: [AddressField.ADDRESS_LINE1, AddressField.ADMINISTRATIVE_AREA, AddressField.POSTAL_CODE],
        administrativeAreaType: AdministrativeAreaType.PREFECTURE,
    },
    KE: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.LOCALITY}\n` +
            `%${AddressField.POSTAL_CODE}`
        ),
    },
    KG: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.POSTAL_CODE} %${AddressField.LOCALITY}`
        ),
    },
    KH: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.LOCALITY} %${AddressField.POSTAL_CODE}`
        ),
    },
    KI: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.ADMINISTRATIVE_AREA}\n` +
            `%${AddressField.LOCALITY}`
        ),
        requiredFields: [AddressField.ADDRESS_LINE1, AddressField.LOCALITY, AddressField.ADMINISTRATIVE_AREA],
        administrativeAreaType: AdministrativeAreaType.ISLAND,
    },
    KN: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.LOCALITY}, %${AddressField.ADMINISTRATIVE_AREA}`
        ),
        requiredFields: [AddressField.ADDRESS_LINE1, AddressField.LOCALITY, AddressField.ADMINISTRATIVE_AREA],
        administrativeAreaType: AdministrativeAreaType.ISLAND,
    },
    KP: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.LOCALITY}\n` +
            `%${AddressField.ADMINISTRATIVE_AREA}, %${AddressField.POSTAL_CODE}`
        ),
        // local: {
        //     code: 'ko',
        //     format: (
        //         `%${AddressField.POSTAL_CODE}\n` +
        //         `%${AddressField.ADMINISTRATIVE_AREA}\n` +
        //         `%${AddressField.LOCALITY}\n` +
        //         `%${AddressField.ADDRESS_LINE1}\n` +
        //         `%${AddressField.ADDRESS_LINE2}`
        //     ),
        // },
    },
    KR: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.LOCALITY}\n` +
            `%${AddressField.ADMINISTRATIVE_AREA}\n` +
            `%${AddressField.POSTAL_CODE}`
        ),
        // local: {
        //     code: 'ko',
        //     format: (
        //         `%${AddressField.ADMINISTRATIVE_AREA} %${AddressField.LOCALITY}%${AddressField.ADDRESS_LINE1}\n` +
        //         `%${AddressField.ADDRESS_LINE2}\n` +
        //         `%${AddressField.POSTAL_CODE}`
        //     ),
        // },
        requiredFields: [AddressField.ADDRESS_LINE1, AddressField.LOCALITY, AddressField.ADMINISTRATIVE_AREA, AddressField.POSTAL_CODE],
        administrativeAreaType: AdministrativeAreaType.DO_SI,
    },
    KW: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.POSTAL_CODE} %${AddressField.LOCALITY}`
        ),
    },
    KY: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.ADMINISTRATIVE_AREA} %${AddressField.POSTAL_CODE}`
        ),
        requiredFields: [AddressField.ADDRESS_LINE1, AddressField.ADMINISTRATIVE_AREA],
        administrativeAreaType: AdministrativeAreaType.ISLAND,
    },
    KZ: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.POSTAL_CODE}, %${AddressField.LOCALITY}\n` +
            `%${AddressField.ADMINISTRATIVE_AREA}`
        ),
        requiredFields: [AddressField.ADDRESS_LINE1, AddressField.LOCALITY, AddressField.POSTAL_CODE],
        administrativeAreaType: AdministrativeAreaType.REGION,
    },
    LA: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.POSTAL_CODE} %${AddressField.LOCALITY}`
        ),
    },
    LB: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.LOCALITY} %${AddressField.POSTAL_CODE}`
        ),
    },
    LI: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.POSTAL_CODE} %${AddressField.LOCALITY}`
        ),
        requiredFields: [AddressField.ADDRESS_LINE1, AddressField.LOCALITY, AddressField.POSTAL_CODE],
    },
    LK: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.LOCALITY}\n` +
            `%${AddressField.POSTAL_CODE}`
        ),
    },
    LR: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.POSTAL_CODE} %${AddressField.LOCALITY}`
        ),
    },
    LS: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.LOCALITY} %${AddressField.POSTAL_CODE}`
        ),
    },
    LT: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.POSTAL_CODE} %${AddressField.LOCALITY} %${AddressField.ADMINISTRATIVE_AREA}`
        ),
        requiredFields: [AddressField.ADDRESS_LINE1, AddressField.LOCALITY, AddressField.POSTAL_CODE],
        administrativeAreaType: AdministrativeAreaType.COUNTY,
    },
    LU: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.POSTAL_CODE} %${AddressField.LOCALITY}`
        ),
        requiredFields: [AddressField.ADDRESS_LINE1, AddressField.LOCALITY, AddressField.POSTAL_CODE],
    },
    LV: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.LOCALITY}, %${AddressField.POSTAL_CODE}`
        ),
        requiredFields: [AddressField.ADDRESS_LINE1, AddressField.LOCALITY, AddressField.POSTAL_CODE],
    },
    MA: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.POSTAL_CODE} %${AddressField.LOCALITY}`
        ),
    },
    MC: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.POSTAL_CODE} %${AddressField.LOCALITY}`
        ),
    },
    MD: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.POSTAL_CODE} %${AddressField.LOCALITY}`
        ),
    },
    ME: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.POSTAL_CODE} %${AddressField.LOCALITY}`
        ),
    },
    MF: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.POSTAL_CODE} %${AddressField.LOCALITY}`
        ),
        requiredFields: [AddressField.ADDRESS_LINE1, AddressField.LOCALITY, AddressField.POSTAL_CODE],
    },
    MG: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.POSTAL_CODE} %${AddressField.LOCALITY}`
        ),
    },
    MH: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.LOCALITY} %${AddressField.ADMINISTRATIVE_AREA} %${AddressField.POSTAL_CODE}`
        ),
        requiredFields: [AddressField.ADDRESS_LINE1, AddressField.LOCALITY, AddressField.ADMINISTRATIVE_AREA, AddressField.POSTAL_CODE],
        administrativeAreaType: AdministrativeAreaType.STATE,
        postalCodeType: PostalCodeType.ZIP,
    },
    MK: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.POSTAL_CODE} %${AddressField.LOCALITY}`
        ),
    },
    MM: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.LOCALITY}, %${AddressField.POSTAL_CODE}`
        ),
    },
    MN: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.LOCALITY}\n` +
            `%${AddressField.ADMINISTRATIVE_AREA} %${AddressField.POSTAL_CODE}`
        ),
    },
    MO: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}`
        ),
        // local: {
        //     code: 'zh-Hans',
        //     format: (
        //         `%${AddressField.ADDRESS_LINE1}\n` +
        //         `%${AddressField.ADDRESS_LINE2}`
        //     ),
        // },
        requiredFields: [AddressField.ADDRESS_LINE1],
    },
    MP: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.LOCALITY} %${AddressField.POSTAL_CODE}`
        ),
        requiredFields: [AddressField.ADDRESS_LINE1, AddressField.LOCALITY, AddressField.POSTAL_CODE],
        postalCodeType: PostalCodeType.ZIP,
    },
    MQ: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.POSTAL_CODE} %${AddressField.LOCALITY}`
        ),
        requiredFields: [AddressField.ADDRESS_LINE1, AddressField.LOCALITY, AddressField.POSTAL_CODE],
    },
    MT: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.LOCALITY} %${AddressField.POSTAL_CODE}`
        ),
    },
    MU: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.POSTAL_CODE}\n` +
            `%${AddressField.LOCALITY}`
        ),
    },
    MV: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.LOCALITY} %${AddressField.POSTAL_CODE}`
        ),
    },
    MW: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.LOCALITY}`
        ),
    },
    MX: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.POSTAL_CODE} %${AddressField.LOCALITY}, %${AddressField.ADMINISTRATIVE_AREA}`
        ),
        requiredFields: [AddressField.ADDRESS_LINE1, AddressField.LOCALITY, AddressField.ADMINISTRATIVE_AREA, AddressField.POSTAL_CODE],
        administrativeAreaType: AdministrativeAreaType.STATE,
    },
    MY: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.POSTAL_CODE} %${AddressField.LOCALITY}\n` +
            `%${AddressField.ADMINISTRATIVE_AREA}`
        ),
        requiredFields: [AddressField.ADDRESS_LINE1, AddressField.LOCALITY, AddressField.ADMINISTRATIVE_AREA, AddressField.POSTAL_CODE],
        administrativeAreaType: AdministrativeAreaType.STATE,
    },
    MZ: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.POSTAL_CODE} %${AddressField.LOCALITY}%${AddressField.ADMINISTRATIVE_AREA}`
        ),
    },
    NA: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.LOCALITY}\n` +
            `%${AddressField.POSTAL_CODE}`
        ),
    },
    NC: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.POSTAL_CODE} %${AddressField.LOCALITY}`
        ),
        requiredFields: [AddressField.ADDRESS_LINE1, AddressField.LOCALITY, AddressField.POSTAL_CODE],
    },
    NE: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.POSTAL_CODE} %${AddressField.LOCALITY}`
        ),
    },
    NF: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.LOCALITY} %${AddressField.POSTAL_CODE}`
        ),
    },
    NG: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.LOCALITY} %${AddressField.POSTAL_CODE}\n` +
            `%${AddressField.ADMINISTRATIVE_AREA}`
        ),
        administrativeAreaType: AdministrativeAreaType.STATE,
    },
    NI: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.POSTAL_CODE}\n` +
            `%${AddressField.LOCALITY}, %${AddressField.ADMINISTRATIVE_AREA}`
        ),
        administrativeAreaType: AdministrativeAreaType.DEPARTMENT,
    },
    NL: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.POSTAL_CODE} %${AddressField.LOCALITY}`
        ),
        requiredFields: [AddressField.ADDRESS_LINE1, AddressField.LOCALITY, AddressField.POSTAL_CODE],
    },
    NO: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.POSTAL_CODE} %${AddressField.LOCALITY}`
        ),
        requiredFields: [AddressField.ADDRESS_LINE1, AddressField.LOCALITY, AddressField.POSTAL_CODE],
        localityType: LocalityType.POST_TOWN,
    },
    NP: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.LOCALITY} %${AddressField.POSTAL_CODE}`
        ),
    },
    NR: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.ADMINISTRATIVE_AREA}`
        ),
        requiredFields: [AddressField.ADDRESS_LINE1, AddressField.ADMINISTRATIVE_AREA],
        administrativeAreaType: AdministrativeAreaType.DISTRICT,
    },
    NZ: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.LOCALITY} %${AddressField.POSTAL_CODE}`
        ),
        requiredFields: [AddressField.ADDRESS_LINE1, AddressField.LOCALITY, AddressField.POSTAL_CODE],
        localityType: LocalityType.TOWN_CITY,
    },
    OM: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.POSTAL_CODE}\n` +
            `%${AddressField.LOCALITY}`
        ),
    },
    PA: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.LOCALITY}\n` +
            `%${AddressField.ADMINISTRATIVE_AREA}`
        ),
    },
    PE: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.LOCALITY} %${AddressField.POSTAL_CODE}\n` +
            `%${AddressField.ADMINISTRATIVE_AREA}`
        ),
        requiredFields: [AddressField.ADDRESS_LINE1, AddressField.LOCALITY, AddressField.ADMINISTRATIVE_AREA],
        localityType: LocalityType.DISTRICT,
    },
    PF: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.POSTAL_CODE} %${AddressField.LOCALITY} %${AddressField.ADMINISTRATIVE_AREA}`
        ),
        requiredFields: [AddressField.ADDRESS_LINE1, AddressField.LOCALITY, AddressField.ADMINISTRATIVE_AREA, AddressField.POSTAL_CODE],
        administrativeAreaType: AdministrativeAreaType.ISLAND,
    },
    PG: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.LOCALITY} %${AddressField.POSTAL_CODE} %${AddressField.ADMINISTRATIVE_AREA}`
        ),
        requiredFields: [AddressField.ADDRESS_LINE1, AddressField.LOCALITY, AddressField.ADMINISTRATIVE_AREA],
    },
    PH: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.LOCALITY}\n` +
            `%${AddressField.POSTAL_CODE} %${AddressField.ADMINISTRATIVE_AREA}`
        ),
    },
    PK: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.LOCALITY}-%${AddressField.POSTAL_CODE}`
        ),
    },
    PL: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.POSTAL_CODE} %${AddressField.LOCALITY}`
        ),
        requiredFields: [AddressField.ADDRESS_LINE1, AddressField.LOCALITY, AddressField.POSTAL_CODE],
    },
    PM: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.POSTAL_CODE} %${AddressField.LOCALITY}`
        ),
        requiredFields: [AddressField.ADDRESS_LINE1, AddressField.LOCALITY, AddressField.POSTAL_CODE],
    },
    PN: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.LOCALITY}\n` +
            `%${AddressField.POSTAL_CODE}`
        ),
        requiredFields: [AddressField.ADDRESS_LINE1, AddressField.LOCALITY, AddressField.POSTAL_CODE],
    },
    PR: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.LOCALITY} %${AddressField.POSTAL_CODE}`
        ),
        requiredFields: [AddressField.ADDRESS_LINE1, AddressField.LOCALITY, AddressField.POSTAL_CODE],
        postalCodeType: PostalCodeType.ZIP,
    },
    PT: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.POSTAL_CODE} %${AddressField.LOCALITY}`
        ),
        requiredFields: [AddressField.ADDRESS_LINE1, AddressField.LOCALITY, AddressField.POSTAL_CODE],
    },
    PW: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.LOCALITY} %${AddressField.ADMINISTRATIVE_AREA} %${AddressField.POSTAL_CODE}`
        ),
        requiredFields: [AddressField.ADDRESS_LINE1, AddressField.LOCALITY, AddressField.ADMINISTRATIVE_AREA, AddressField.POSTAL_CODE],
        administrativeAreaType: AdministrativeAreaType.STATE,
        postalCodeType: PostalCodeType.ZIP,
    },
    PY: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.POSTAL_CODE} %${AddressField.LOCALITY}, %${AddressField.ADMINISTRATIVE_AREA}`
        ),
    },
    RE: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.POSTAL_CODE} %${AddressField.LOCALITY}`
        ),
        requiredFields: [AddressField.ADDRESS_LINE1, AddressField.LOCALITY, AddressField.POSTAL_CODE],
    },
    RO: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.POSTAL_CODE} %${AddressField.LOCALITY}`
        ),
        requiredFields: [AddressField.ADDRESS_LINE1, AddressField.LOCALITY, AddressField.POSTAL_CODE],
    },
    RS: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.POSTAL_CODE} %${AddressField.LOCALITY}`
        ),
    },
    RU: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.LOCALITY}\n` +
            `%${AddressField.ADMINISTRATIVE_AREA}\n` +
            `%${AddressField.POSTAL_CODE}`
        ),
        requiredFields: [AddressField.ADDRESS_LINE1, AddressField.LOCALITY, AddressField.ADMINISTRATIVE_AREA, AddressField.POSTAL_CODE],
        administrativeAreaType: AdministrativeAreaType.REGION,
    },
    SA: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.LOCALITY} %${AddressField.POSTAL_CODE}`
        ),
    },
    SC: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.LOCALITY}\n` +
            `%${AddressField.ADMINISTRATIVE_AREA}`
        ),
        administrativeAreaType: AdministrativeAreaType.ISLAND,
    },
    SD: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.LOCALITY}\n` +
            `%${AddressField.POSTAL_CODE}`
        ),
        localityType: LocalityType.DISTRICT,
    },
    SE: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.POSTAL_CODE} %${AddressField.LOCALITY}`
        ),
        requiredFields: [AddressField.ADDRESS_LINE1, AddressField.LOCALITY, AddressField.POSTAL_CODE],
        localityType: LocalityType.POST_TOWN,
    },
    SG: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.LOCALITY} %${AddressField.POSTAL_CODE}`
        ),
        requiredFields: [AddressField.ADDRESS_LINE1, AddressField.LOCALITY, AddressField.POSTAL_CODE],
    },
    SH: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.LOCALITY}\n` +
            `%${AddressField.POSTAL_CODE}`
        ),
        requiredFields: [AddressField.ADDRESS_LINE1, AddressField.LOCALITY, AddressField.POSTAL_CODE],
    },
    SI: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.POSTAL_CODE} %${AddressField.LOCALITY}`
        ),
    },
    SJ: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.POSTAL_CODE} %${AddressField.LOCALITY}`
        ),
        requiredFields: [AddressField.ADDRESS_LINE1, AddressField.LOCALITY, AddressField.POSTAL_CODE],
        localityType: LocalityType.POST_TOWN,
    },
    SK: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.POSTAL_CODE} %${AddressField.LOCALITY}`
        ),
        requiredFields: [AddressField.ADDRESS_LINE1, AddressField.LOCALITY, AddressField.POSTAL_CODE],
    },
    SM: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.POSTAL_CODE} %${AddressField.LOCALITY}`
        ),
        requiredFields: [AddressField.ADDRESS_LINE1, AddressField.POSTAL_CODE],
    },
    SN: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.POSTAL_CODE} %${AddressField.LOCALITY}`
        ),
    },
    SO: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.LOCALITY}, %${AddressField.ADMINISTRATIVE_AREA} %${AddressField.POSTAL_CODE}`
        ),
        requiredFields: [AddressField.ADDRESS_LINE1, AddressField.LOCALITY, AddressField.ADMINISTRATIVE_AREA],
    },
    SR: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.LOCALITY}\n` +
            `%${AddressField.ADMINISTRATIVE_AREA}`
        ),
    },
    SV: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.POSTAL_CODE}-%${AddressField.LOCALITY}\n` +
            `%${AddressField.ADMINISTRATIVE_AREA}`
        ),
        requiredFields: [AddressField.ADDRESS_LINE1, AddressField.LOCALITY, AddressField.ADMINISTRATIVE_AREA],
    },
    SY: {
        localityType: LocalityType.DISTRICT,
    },
    SZ: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.LOCALITY}\n` +
            `%${AddressField.POSTAL_CODE}`
        ),
    },
    TA: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.LOCALITY}\n` +
            `%${AddressField.POSTAL_CODE}`
        ),
    },
    TC: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.LOCALITY}\n` +
            `%${AddressField.POSTAL_CODE}`
        ),
        requiredFields: [AddressField.ADDRESS_LINE1, AddressField.LOCALITY, AddressField.POSTAL_CODE],
    },
    TH: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.LOCALITY}\n` +
            `%${AddressField.ADMINISTRATIVE_AREA} %${AddressField.POSTAL_CODE}`
        ),
        // local: {
        //     code: 'th',
        //     format: (
        //         `%${AddressField.ADDRESS_LINE1}\n` +
        //         `%${AddressField.ADDRESS_LINE2}\n` +
        //         `%${AddressField.LOCALITY}\n` +
        //         `%${AddressField.ADMINISTRATIVE_AREA} %${AddressField.POSTAL_CODE}`
        //     ),
        // },
        requiredFields: [AddressField.ADDRESS_LINE1, AddressField.LOCALITY, AddressField.ADMINISTRATIVE_AREA],
    },
    TJ: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.POSTAL_CODE} %${AddressField.LOCALITY}`
        ),
    },
    TM: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.POSTAL_CODE} %${AddressField.LOCALITY}`
        ),
    },
    TN: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.POSTAL_CODE} %${AddressField.LOCALITY}`
        ),
    },
    TR: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.POSTAL_CODE} %${AddressField.LOCALITY}/%${AddressField.ADMINISTRATIVE_AREA}`
        ),
        requiredFields: [AddressField.ADDRESS_LINE1, AddressField.LOCALITY, AddressField.ADMINISTRATIVE_AREA, AddressField.POSTAL_CODE],
        localityType: LocalityType.DISTRICT,
    },
    TV: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.LOCALITY}\n` +
            `%${AddressField.ADMINISTRATIVE_AREA}`
        ),
        administrativeAreaType: AdministrativeAreaType.ISLAND,
    },
    TW: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.LOCALITY}, %${AddressField.ADMINISTRATIVE_AREA} %${AddressField.POSTAL_CODE}`
        ),
        // local: {
        //     code: 'zh-Hant',
        //     format: (
        //         `%${AddressField.POSTAL_CODE}\n` +
        //         `%${AddressField.ADMINISTRATIVE_AREA}%${AddressField.LOCALITY}\n` +
        //         `%${AddressField.ADDRESS_LINE1}\n` +
        //         `%${AddressField.ADDRESS_LINE2}`
        //     ),
        // },
        requiredFields: [AddressField.ADDRESS_LINE1, AddressField.LOCALITY, AddressField.ADMINISTRATIVE_AREA, AddressField.POSTAL_CODE],
        administrativeAreaType: AdministrativeAreaType.COUNTY,
    },
    TZ: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.POSTAL_CODE} %${AddressField.LOCALITY}`
        ),
    },
    UA: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.LOCALITY}\n` +
            `%${AddressField.ADMINISTRATIVE_AREA}\n` +
            `%${AddressField.POSTAL_CODE}`
        ),
        requiredFields: [AddressField.ADDRESS_LINE1, AddressField.LOCALITY, AddressField.POSTAL_CODE],
        administrativeAreaType: AdministrativeAreaType.REGION,
    },
    UM: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.LOCALITY} %${AddressField.ADMINISTRATIVE_AREA} %${AddressField.POSTAL_CODE}`
        ),
        requiredFields: [AddressField.ADDRESS_LINE1, AddressField.LOCALITY, AddressField.ADMINISTRATIVE_AREA],
        administrativeAreaType: AdministrativeAreaType.STATE,
        postalCodeType: PostalCodeType.ZIP,
    },
    US: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.LOCALITY}, %${AddressField.ADMINISTRATIVE_AREA} %${AddressField.POSTAL_CODE}`
        ),
        requiredFields: [AddressField.ADDRESS_LINE1, AddressField.LOCALITY, AddressField.ADMINISTRATIVE_AREA, AddressField.POSTAL_CODE],
        administrativeAreaType: AdministrativeAreaType.STATE,
        postalCodeType: PostalCodeType.ZIP,
    },
    UY: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.POSTAL_CODE} - %${AddressField.LOCALITY}, %${AddressField.ADMINISTRATIVE_AREA}`
        ),
    },
    UZ: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.POSTAL_CODE} %${AddressField.LOCALITY}\n` +
            `%${AddressField.ADMINISTRATIVE_AREA}`
        ),
    },
    VA: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.POSTAL_CODE} %${AddressField.LOCALITY}`
        ),
    },
    VC: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.LOCALITY} %${AddressField.POSTAL_CODE}`
        ),
    },
    VE: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.LOCALITY} %${AddressField.POSTAL_CODE}, %${AddressField.ADMINISTRATIVE_AREA}`
        ),
        requiredFields: [AddressField.ADDRESS_LINE1, AddressField.LOCALITY, AddressField.ADMINISTRATIVE_AREA],
        administrativeAreaType: AdministrativeAreaType.STATE,
    },
    VG: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.LOCALITY}\n` +
            `%${AddressField.POSTAL_CODE}`
        ),
        requiredFields: [AddressField.ADDRESS_LINE1],
    },
    VI: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.LOCALITY} %${AddressField.POSTAL_CODE}`
        ),
        requiredFields: [AddressField.ADDRESS_LINE1, AddressField.LOCALITY, AddressField.POSTAL_CODE],
        postalCodeType: PostalCodeType.ZIP,
    },
    VN: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.LOCALITY}\n` +
            `%${AddressField.ADMINISTRATIVE_AREA} %${AddressField.POSTAL_CODE}`
        ),
        requiredFields: [AddressField.ADDRESS_LINE1, AddressField.LOCALITY, AddressField.ADMINISTRATIVE_AREA],
    },
    WF: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.POSTAL_CODE} %${AddressField.LOCALITY}`
        ),
        requiredFields: [AddressField.ADDRESS_LINE1, AddressField.LOCALITY, AddressField.POSTAL_CODE],
    },
    XK: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.POSTAL_CODE} %${AddressField.LOCALITY}`
        ),
    },
    YT: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.POSTAL_CODE} %${AddressField.LOCALITY}`
        ),
        requiredFields: [AddressField.ADDRESS_LINE1, AddressField.LOCALITY, AddressField.POSTAL_CODE],
    },
    ZA: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.LOCALITY}\n` +
            `%${AddressField.POSTAL_CODE}`
        ),
        requiredFields: [AddressField.ADDRESS_LINE1, AddressField.LOCALITY, AddressField.POSTAL_CODE],
    },
    ZM: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.POSTAL_CODE} %${AddressField.LOCALITY}`
        ),
    },
    ZW: {
        format: (
            `%${AddressField.ADDRESS_LINE1}\n` +
            `%${AddressField.ADDRESS_LINE2}\n` +
            `%${AddressField.LOCALITY}\n` +
            `%${AddressField.ADMINISTRATIVE_AREA}`
        ),
    },
};

export default new Map(Object.entries(data));
