<?php
/* phpcs:disable PHPCompatibility.Classes.NewLateStaticBinding.OutsideClassScope */
declare(strict_types=1);

namespace Loxya\Support\Invoicing;

use Loxya\Support\Invoicing\VatExemptionCode\VatExemptionCodeEu;
use Loxya\Support\Invoicing\VatExemptionCode\VatExemptionCodeInterface;

/**
 * Régime de taxe.
 *
 * @see https://unece.org/fileadmin/DAM/trade/untdid/d16b/tred/tred5305.htm
 */
enum TaxRegime: string
{
    /** Régime standard / normal, taxes appliquées normalement. */
    case STANDARD = 'S';

    /** Taux zéro. */
    case ZERO_RATED = 'Z';

    /** Auto-liquidation, les taxes sont dues par le preneur. */
    case REVERSE_CHARGE = 'AE';

    /** Auto-liquidation pour cause de livraison intracommunautaire. */
    case REVERSE_CHARGE_SUPPLY = 'K';

    /** Export, non sujet à taxation. */
    case EXPORT = 'G';

    /** Exempté de taxe. */
    case EXEMPTED = 'E';

    /** Hors du périmètre d'application des taxes. */
    case OUT_OF_SCOPE = 'O';

    //
    // - Méthodes
    //

    public function isStandard(): bool
    {
        $list = [
            self::STANDARD,
            self::ZERO_RATED,
        ];

        // phpcs:ignore PHPCompatibility.Variables.ForbiddenThisUseContexts
        return in_array($this, $list, true);
    }

    public function isExempt(): bool
    {
        $list = [
            self::REVERSE_CHARGE,
            self::REVERSE_CHARGE_SUPPLY,
            self::EXPORT,
            self::EXEMPTED,
            self::OUT_OF_SCOPE,
        ];

        // phpcs:ignore PHPCompatibility.Variables.ForbiddenThisUseContexts
        return in_array($this, $list, true);
    }

    public function getDefaultExemptionCode(): VatExemptionCodeInterface|null
    {
        // phpcs:ignore PHPCompatibility.Variables.ForbiddenThisUseContexts
        return match ($this) {
            self::OUT_OF_SCOPE => VatExemptionCodeEu::VATEX_EU_O,
            self::REVERSE_CHARGE => VatExemptionCodeEu::VATEX_EU_AE,
            self::REVERSE_CHARGE_SUPPLY => VatExemptionCodeEu::VATEX_EU_IC,
            self::EXPORT => VatExemptionCodeEu::VATEX_EU_G,
            default => null,
        };
    }

    public function withExemptionCode(VatExemptionCodeInterface|null $exemptionCode): StrictTaxRegime|TaxRegime
    {
        // phpcs:ignore PHPCompatibility.Variables.ForbiddenThisUseContexts
        return $exemptionCode === null ? $this : new StrictTaxRegime($this, $exemptionCode);
    }
}
