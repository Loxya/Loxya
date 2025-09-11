<?php
declare(strict_types=1);

namespace Loxya\Models\Enums;

/**
 * Type d'entité légale pour une personne.
 */
enum LegalEntityType: string
{
    /**
     * Personne morale, par exemple une société ou une organisation.
     */
    case COMPANY = 'company';

    /**
     * Personne physique, un particulier.
     */
    case INDIVIDUAL = 'individual';
}
