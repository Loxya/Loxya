<?php
declare(strict_types=1);

namespace Loxya\Support\Data\LegalType;

/** Formes juridiques suisses. */
enum LegalTypeCh: string implements LegalTypeInterface
{
    //
    // - Entreprises individuelles
    //

    /** Raison individuelle */
    case RI = 'CH.RI';

    //
    // - Sociétés
    //

    /** Société à responsabilité limitée (SàRL) */
    case SARL = 'CH.SARL';

    /** Société anonyme (SA) */
    case SA = 'CH.SA';

    /** Société en nom collectif */
    case SNC = 'CH.SNC';

    /** Société en commandite */
    case SCM = 'CH.SCM';

    //
    // - Groupements
    //

    /** Société coopérative */
    case SC = 'CH.SC';

    //
    // - Non lucratif
    //

    /** Association */
    case ASSO = 'CH.ASSO';

    /** Fondation */
    case FOND = 'CH.FOND';

    // ------------------------------------------------------
    // -
    // -    Méthodes
    // -
    // ------------------------------------------------------

    public function canHaveShareCapital(): bool
    {
        $withCapitals = [
            self::SARL,
            self::SA,
            self::SNC,
            self::SCM,
            self::SC,
        ];
        // phpcs:ignore PHPCompatibility.Variables.ForbiddenThisUseContexts
        return in_array($this, $withCapitals, true);
    }

    public function maybeExemptedFromVAT(): bool
    {
        return false;
    }
}
