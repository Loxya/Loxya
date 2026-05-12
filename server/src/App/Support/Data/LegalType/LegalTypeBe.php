<?php
declare(strict_types=1);

namespace Loxya\Support\Data\LegalType;

/** Formes juridiques belges. */
enum LegalTypeBe: string implements LegalTypeInterface
{
    //
    // - Entreprises individuelles
    //

    /** Indépendant / Entreprise individuelle */
    case EI = 'BE.EI';

    //
    // - Sociétés
    //

    /** Société à responsabilité limitée (SRL) */
    case SRL = 'BE.SRL';

    /** Société anonyme (SA) */
    case SA = 'BE.SA';

    /** Société coopérative (SC) */
    case SC = 'BE.SC';

    /** Société en nom collectif */
    case SNC = 'BE.SNC';

    /** Société en commandite (simple / par actions) */
    case SCOMM = 'BE.SCOMM';

    //
    // - Non lucratif
    //

    /** Association sans but lucratif */
    case ASBL = 'BE.ASBL';

    /** Association internationale sans but lucratif */
    case AISBL = 'BE.AISBL';

    /** Fondation privée */
    case FP = 'BE.FP';

    /** Fondation d'utilité publique */
    case FUP = 'BE.FUP';

    // ------------------------------------------------------
    // -
    // -    Méthodes
    // -
    // ------------------------------------------------------

    public function canHaveShareCapital(): bool
    {
        $withCapitals = [
            self::SRL,
            self::SA,
            self::SC,
            self::SNC,
            self::SCOMM,
        ];
        // phpcs:ignore PHPCompatibility.Variables.ForbiddenThisUseContexts
        return in_array($this, $withCapitals, true);
    }

    public function maybeExemptedFromVAT(): bool
    {
        return false;
    }
}
