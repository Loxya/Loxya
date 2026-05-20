<?php
declare(strict_types=1);

namespace Loxya\Support\Data\CountryMetadata;

use Loxya\Support\Country;
use Loxya\Support\Invoicing\BuyerInterface;
use Loxya\Support\Invoicing\TaxRegime;

/**
 * Métadonnées pour Wallis-et-Futuna.
 */
final class CountryMetadataWf extends CountryMetadataFr
{
    public static function getCurrencies(): array
    {
        return ['XPF'];
    }

    public static function isSameVatArea(Country $otherCountry): bool
    {
        return $otherCountry->getCode() === 'WF';
    }

    public static function getLineAvailableTaxRegimes(BuyerInterface $buyer, bool $isService): array
    {
        // - Hors du champ d'application de la T.V.A. française.
        return [TaxRegime::EXEMPTED];
    }

    public static function getElectronicInvoiceFormats(): array
    {
        // - Hors du périmètre de la facturation électronique française.
        return [];
    }

    public static function getVatRates(?bool $extended = true): array
    {
        // - T.V.A. non applicable.
        return [0];
    }
}
