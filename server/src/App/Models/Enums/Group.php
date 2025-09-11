<?php
declare(strict_types=1);

namespace Loxya\Models\Enums;

/**
 * Groupes des utilisateurs de l'application.
 *
 * #TODO: Migrer vers un `enum`.
 */
final class Group
{
    /** Représente le groupe des administrateurs. */
    public const ADMINISTRATION = 'administration';

    /** Représente le groupe des superviseurs. */
    public const SUPERVISION = 'supervision';

    /** Représente le groupe des opérateurs, membres de l'équipe. */
    public const OPERATION = 'operation';

    /**
     * Représente le groupe des utilisateurs ayant accès au
     * planning général, en lecture seule.
     */
    public const READONLY_PLANNING_GENERAL = 'readonly-planning-general';

    /**
     * Représente le groupe des utilisateurs anonymes, non authentifiés.
     *
     * Ceci est un groupe spécial, il n'est pas retourné par {@link Group::all()}.
     */
    public const ANONYMOUS = 'anonymous';

    // ------------------------------------------------------
    // -
    // -    Méthodes publiques
    // -
    // ------------------------------------------------------

    public static function all(): array
    {
        return [
            Group::READONLY_PLANNING_GENERAL,
            Group::OPERATION,
            Group::SUPERVISION,
            Group::ADMINISTRATION,
        ];
    }
}
