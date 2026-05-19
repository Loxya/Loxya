<?php
declare(strict_types=1);

namespace Loxya\Support\Invoicing;

use Loxya\Support\Invoicing\VatExemptionCode\VatExemptionCodeInterface;

/**
 * Un régime de taxe complet, avec son code d'exemption.
 */
final class StrictTaxRegime
{
    public function __construct(
        public readonly TaxRegime $regime,
        public readonly VatExemptionCodeInterface $exemptionCode,
    ) {}
}
