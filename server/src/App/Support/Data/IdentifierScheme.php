<?php
declare(strict_types=1);

namespace Loxya\Support\Data;

/** Identifiants légaux */
enum IdentifierScheme: string
{
    /** SIREN Français */
    case FR_SIREN = '0002';

    /** SIRET Français */
    case FR_SIRET = '0009';

    /** Code BCE Belge. */
    case BE_BCE = '0208';

    /** Code IDE Suisse. */
    case CH_IDE = '0183';
}
