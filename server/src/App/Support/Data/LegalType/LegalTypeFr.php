<?php
declare(strict_types=1);

namespace Loxya\Support\Data\LegalType;

/** Formes juridiques françaises. */
enum LegalTypeFr: string implements LegalTypeInterface
{
    //
    // - Entreprises individuelles
    //

    /** Entreprise individuelle */
    case EI = 'FR.EI';

    /** Micro-entreprise / Auto-Entreprise */
    case MICRO = 'FR.ME';

    //
    // - SARL & variantes
    //

    /** Société à responsabilité limitée (SARL) */
    case SARL = 'FR.SARL';

    /** Entreprise unipersonnelle à responsabilité limitée (EURL) */
    case EURL = 'FR.EURL';

    //
    // - SAS & variantes
    //

    /** Société par actions simplifiée (SAS) */
    case SAS = 'FR.SAS';

    /** Société par actions simplifiée unipersonnelle (SASU) */
    case SASU = 'FR.SASU';

    //
    // - Autres sociétés privées.
    //

    /** Société anonyme (SA) */
    case SA = 'FR.SA';

    /** Société en nom collectif (SNC) */
    case SNC = 'FR.SNC';

    /** Société en commandite simple (SCS) */
    case SCS = 'FR.SCS';

    /** Société en commandite par actions (SCA) */
    case SCA = 'FR.SCA';

    //
    // - Sociétés civiles
    //

    /** Société civile - Professionnelle (SCP) */
    case SCP = 'FR.SCP';

    /** Société civile coopérative */
    case SCC = 'FR.SCC';

    /** Société civile d’exploitation agricole (SCEA) */
    case SCEA = 'FR.SCEA';

    /** Société civile Immobilière (SCI) */
    case SCI = 'FR.SCI';

    //
    // - Groupements
    //

    /** Groupement d'intérêt économique (GIE) */
    case GIE = 'FR.GIE';

    /** Coopératives (agricole / commerciales / mutualistes) */
    case COOP = 'FR.COOP';

    //
    // - Non lucratif
    //

    /** Association loi 1901 ou assimilé */
    case ASSO = 'FR.ASSO';

    /** Fondation */
    case FOND = 'FR.FOND';

    //
    // - Secteur public & assimilés
    //

    /** Collectivité territoriale (communes, départements, régions) */
    case COLL = 'FR.COLL';

    /** Établissement public administratif (hôpitaux/EHPAD, musées, ...) */
    case EPA = 'FR.EPA';

    /** Établissement public industriel et commercial */
    case EPIC = 'FR.EPIC';

    /** Établissement public local d'enseignement (EPLE) */
    case EPLE = 'FR.EPLE';

    /** Universités & grands établissements (EPSCP) */
    case EPSCP = 'FR.EPSCP';

    /** Groupement d'intérêt public */
    case GIP = 'FR.GIP';

    // ------------------------------------------------------
    // -
    // -    Méthodes
    // -
    // ------------------------------------------------------

    public function canHaveShareCapital(): bool
    {
        $withCapitals = [
            self::SARL,
            self::EURL,
            self::SAS,
            self::SASU,
            self::SA,
            self::SNC,
            self::SCS,
            self::SCA,
            self::SCP,
            self::SCC,
            self::SCEA,
            self::SCI,
            self::GIE,
            self::COOP,
        ];
        // phpcs:ignore PHPCompatibility.Variables.ForbiddenThisUseContexts
        return in_array($this, $withCapitals, true);
    }

    public function maybeExemptedFromVAT(): bool
    {
        // phpcs:ignore PHPCompatibility.Variables.ForbiddenThisUseContexts
        return $this === self::MICRO;
    }
}
