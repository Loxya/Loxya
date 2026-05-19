/** Champs d'adresse */
export enum AddressField {
    /** Première ligne d'adresse (généralement "Numéro et rue") */
    ADDRESS_LINE1 = 'address_line_1',

    /** Seconde ligne d'adresse (généralement "Complément d'adresse") */
    ADDRESS_LINE2 = 'address_line_2',

    /** Code postal */
    POSTAL_CODE = 'postal_code',

    /** Zone administrative (e.g. Canton, État, ...) */
    ADMINISTRATIVE_AREA = 'administrative_area',

    /** Localité (e.g. Ville, District, ...) */
    LOCALITY = 'locality',
}

/** Types de localités */
export enum LocalityType {
    CITY = 'city',
    DISTRICT = 'district',
    POST_TOWN = 'post_town',
    SUBURB = 'suburb',
    TOWN_CITY = 'town_city',
}

/** Types de code postaux */
export enum PostalCodeType {
    EIR = 'eircode',
    PIN = 'pin',
    POSTAL = 'postal',
    ZIP = 'zip',
}

/** Zones administratives */
export enum AdministrativeAreaType {
    AREA = 'area',
    CANTON = 'canton',
    COUNTY = 'county',
    DEPARTMENT = 'department',
    DISTRICT = 'district',
    DO_SI = 'do_si',
    EMIRATE = 'emirate',
    ISLAND = 'island',
    PARISH = 'parish',
    PREFECTURE = 'prefecture',
    PROVINCE = 'province',
    REGION = 'region',
    STATE = 'state',
}
