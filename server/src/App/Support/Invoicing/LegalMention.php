<?php
declare(strict_types=1);

namespace Loxya\Support\Invoicing;

use horstoeko\zugferd\codelists\ZugferdTextSubjectCodeQualifiers;

/** Mention légale de devis ou facture. */
enum LegalMention: string
{
    /** Identité complète du vendeur. */
    case SELLER_IDENTITY = 'seller-identity';

    /** Mention d'immatriculation au registre du commerce. */
    case TRADE_REGISTER = 'trade-register';

    /** Mention d'option pour la "TVA sur les débits". */
    case VAT_DUE_ON_INVOICE = 'vat-due-on-invoice';

    /** Absence d'escompte pour paiement anticipé. */
    case NO_EARLY_PAYMENT_DISCOUNT = 'no-early-payment-discount';

    /** Pénalité exigible en cas de retard de paiement. */
    case LATE_PAYMENT_PENALTY = 'late-payment-penalty';

    /** Indemnité forfaitaire pour frais de recouvrement en cas de retard de paiement. */
    case LATE_PAYMENT_FEE = 'late-payment-flat-fee';

    //
    // - Méthodes
    //

    /**
     * Retourne le code UNTDID 4451 correspondant à la mention.
     *
     * @see https://service.unece.org/trade/untdid/d24a/tred/tred4451.htm
     *
     * @return string Le code UNTDID 4451.
     */
    public function getSubjectCode(): string
    {
        // phpcs:ignore PHPCompatibility.Variables.ForbiddenThisUseContexts
        return match ($this) {
            self::SELLER_IDENTITY => ZugferdTextSubjectCodeQualifiers::UNTDID_4451_REG,
            self::VAT_DUE_ON_INVOICE => ZugferdTextSubjectCodeQualifiers::UNTDID_4451_REG,
            self::TRADE_REGISTER => ZugferdTextSubjectCodeQualifiers::UNTDID_4451_ABL,
            self::NO_EARLY_PAYMENT_DISCOUNT => ZugferdTextSubjectCodeQualifiers::UNTDID_4451_AAB,
            self::LATE_PAYMENT_PENALTY =>ZugferdTextSubjectCodeQualifiers::UNTDID_4451_PMD,
            self::LATE_PAYMENT_FEE => ZugferdTextSubjectCodeQualifiers::UNTDID_4451_PMT,
        };
    }
}
