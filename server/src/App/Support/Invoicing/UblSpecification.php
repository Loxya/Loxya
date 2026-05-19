<?php
declare(strict_types=1);

namespace Loxya\Support\Invoicing;

/** Spécification UBL. */
enum UblSpecification: string
{
    /** Peppol BIS Billing 3.0 */
    case PEPPOL_BIS_BILLING_3 = 'urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0';

    /** EXTENDED-CTC-FR */
    case EXTENDED_CTC_FR = 'urn:cen.eu:en16931:2017#conformant#urn.cpro.gouv.fr:1p0:extended-ctc-fr';

    /**
     * Le profil autorise-t-il plusieurs `cbc:Note` dans une facture ?
     * Si `false`, les mentions seront concaténées en une seule note.
     *
     * @return bool `true` si le profil autorise plusieurs notes, `false` sinon.
     */
    public function supportsMultipleNotes(): bool
    {
        // phpcs:ignore PHPCompatibility.Variables.ForbiddenThisUseContexts
        return match ($this) {
            self::EXTENDED_CTC_FR => true,
            self::PEPPOL_BIS_BILLING_3 => false,
        };
    }

    /**
     * Le profil autorise-t-il les raisons d'exemption à la ligne (ligne, remise globale) ?
     *
     * @return bool `true` si le profil autorise les raisons d'exemption à la ligne, `false` sinon.
     */
    public function supportsLineExemptionReason(): bool
    {
        // phpcs:ignore PHPCompatibility.Variables.ForbiddenThisUseContexts
        return match ($this) {
            self::EXTENDED_CTC_FR => true,
            self::PEPPOL_BIS_BILLING_3 => false,
        };
    }

    /**
     * Le profil autorise-t-il à préciser le type d'une facture référencée
     * (facture corrigée, facture d'acompte, etc.) ?
     *
     * @return bool `true` si le profil autorise à préciser le type, `false` sinon.
     */
    public function supportsBillingReferenceTypeCode(): bool
    {
        // phpcs:ignore PHPCompatibility.Variables.ForbiddenThisUseContexts
        return match ($this) {
            self::EXTENDED_CTC_FR => true,
            self::PEPPOL_BIS_BILLING_3 => false,
        };
    }

    /**
     * Le profil autorise-t-il à référencer une facture antérieure depuis une
     * ligne (e.g. la facture d'acompte d'origine sur une ligne de reprise) ?
     *
     * @return bool `true` si le profil autorise les références à la ligne, `false` sinon.
     */
    public function supportsLineLevelBillingReferences(): bool
    {
        // phpcs:ignore PHPCompatibility.Variables.ForbiddenThisUseContexts
        return match ($this) {
            self::EXTENDED_CTC_FR => true,
            self::PEPPOL_BIS_BILLING_3 => false,
        };
    }

    /**
     * Le profil autorise-t-il plusieurs identifiants pour une
     * même partie (vendeur, acheteur, etc.) ?
     *
     * @return bool `true` si le profil autorise plusieurs identifiants par partie, `false` sinon.
     */
    public function supportsMultiplePartyIdentification(): bool
    {
        // phpcs:ignore PHPCompatibility.Variables.ForbiddenThisUseContexts
        return match ($this) {
            self::EXTENDED_CTC_FR => true,
            self::PEPPOL_BIS_BILLING_3 => false,
        };
    }
}
