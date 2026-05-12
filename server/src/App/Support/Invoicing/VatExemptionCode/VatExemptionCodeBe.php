<?php
declare(strict_types=1);

namespace Loxya\Support\Invoicing\VatExemptionCode;

use Loxya\Support\Invoicing\TaxRegime;

/**
 * Motifs d'exemption de TVA spécifiquement belges.
 *
 * Attention, pour avoir la liste complète des exemptions applicables en
 * Belgique il faut aussi utiliser les exemptions au niveau européen.
 */
enum VatExemptionCodeBe: string implements VatExemptionCodeInterface
{
    /**
     * Régime particulier de franchise des petites entreprises – TVA non applicable
     */
    case CUSTOM_BE_FRANCHISE = 'CUSTOM-BE-FRANCHISE';

    /**
     * Co-contractor – AR CTVA n° 1, article 20
     *
     * For domestic reverse charge only in Belgium
     */
    case CUSTOM_BE_AE = 'CUSTOM-BE-AE';

    // ------------------------------------------------------
    // -
    // -    Méthodes
    // -
    // ------------------------------------------------------

    public function isCustom(): bool
    {
        $customs = [
            self::CUSTOM_BE_FRANCHISE,
            self::CUSTOM_BE_AE,
        ];

        // phpcs:ignore PHPCompatibility.Variables.ForbiddenThisUseContexts
        return in_array($this, $customs, true);
    }

    // ------------------------------------------------------
    // -
    // -    Méthodes utilitaires
    // -
    // ------------------------------------------------------

    public static function globals(): array
    {
        return [
            self::CUSTOM_BE_FRANCHISE,
            ...VatExemptionCodeEu::globals(),
        ];
    }

    public static function lines(?TaxRegime $regime = TaxRegime::EXEMPTED): array
    {
        if ($regime === TaxRegime::STANDARD) {
            throw new \LogicException("Standard regime cannot have exemption code.");
        }

        return match ($regime) {
            TaxRegime::REVERSE_CHARGE => [
                self::CUSTOM_BE_AE,
                ...VatExemptionCodeEu::lines($regime),
            ],
            default => VatExemptionCodeEu::lines($regime),
        };
    }
}
