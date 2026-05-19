<?php
declare(strict_types=1);

namespace Loxya\Support\Addressing;

/** Types de code postaux */
enum PostalCodeType: string
{
    case EIR = 'eircode';
    case PIN = 'pin';
    case POSTAL = 'postal';
    case ZIP = 'zip';
}
