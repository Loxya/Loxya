<?php
declare(strict_types=1);

namespace Loxya\Support\Invoicing\VatExemptionCode;

use Loxya\Support\Invoicing\TaxRegime;

interface VatExemptionCodeInterface extends \BackedEnum
{
    // ------------------------------------------------------
    // -
    // -    Méthodes
    // -
    // ------------------------------------------------------

    /**
     * Indique s'il s'agit d'un code custom qui n'est pas à transmettre en l'état.
     *
     * Ce genre de code est utilisé pour représenter une raison textuelle.
     */
    public function isCustom(): bool;

    // ------------------------------------------------------
    // -
    // -    Méthodes utilitaires
    // -
    // ------------------------------------------------------

    /**
     * @return list<VatExemptionCodeInterface>
     */
    public static function globals(): array;

    /**
     * @return list<VatExemptionCodeInterface>
     */
    public static function lines(?TaxRegime $regime): array;
}
