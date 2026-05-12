<?php
declare(strict_types=1);

namespace Loxya\Support\Addressing;

/** Champs d'adresse */
enum AddressField: string
{
    /** Première ligne d'adresse (généralement "Numéro et rue") */
    case ADDRESS_LINE1 = 'address_line_1';

    /** Seconde ligne d'adresse (généralement "Complément d'adresse") */
    case ADDRESS_LINE2 = 'address_line_2';

    /** Code postal */
    case POSTAL_CODE = 'postal_code';

    /** Zone administrative (e.g. Canton, État, ...) */
    case ADMINISTRATIVE_AREA = 'administrative_area';

    /** Localité (e.g. Ville, District, ...) */
    case LOCALITY = 'locality';
}
