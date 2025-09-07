<?php
declare(strict_types=1);

namespace Loxya\Models\Enums;

/** Type de données dans un champ personnalisé. */
enum CustomFieldType: string
{
    /** Un champ permettant d'entrer une chaîne de caractère simple. */
    case STRING = 'string';

    /** Un champ permettant d'entrer du texte long. */
    case TEXT = 'text';

    /** Un champ permettant d'entrer un nombre entier. */
    case INTEGER = 'integer';

    /** Un champ permettant d'entrer un nombre décimal. */
    case FLOAT = 'float';

    /** Un champ permettant de choisir entre oui ou non. */
    case BOOLEAN = 'boolean';

    /** Un champ permettant de choisir une option dans une liste. */
    case LIST = 'list';

    /** Un champ permettant de spécifier une période. */
    case PERIOD = 'period';

    /** Un champ permettant de spécifier une date. */
    case DATE = 'date';
}
