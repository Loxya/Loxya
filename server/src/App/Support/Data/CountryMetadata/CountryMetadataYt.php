<?php
declare(strict_types=1);

namespace Loxya\Support\Data\CountryMetadata;

use Loxya\Support\Country;
use Loxya\Support\Invoicing\BuyerInterface;
use Loxya\Support\Invoicing\TaxRegime;
use Loxya\Support\Invoicing\VatExemptionCode\VatExemptionCodeFr;

/**
 * Métadonnées pour Mayotte.
 *
 * @see https://www.impots.gouv.fr/professionnel/questions/quels-sont-les-differents-taux-de-tva-applicables-dans-les-dom
 */
final class CountryMetadataYt extends CountryMetadataFr
{
    public static function isSameVatArea(Country $otherCountry): bool
    {
        return $otherCountry->getCode() === 'YT';
    }

    public static function getElectronicInvoiceFormats(): array
    {
        // - Hors du périmètre de la facturation électronique française.
        return [];
    }

    public static function getLineAvailableTaxRegimes(BuyerInterface $buyer, bool $isService): array
    {
        // - La T.V.A. n'étant pas applicable, toutes les opérations sont
        //   exemptées avec le code "DROM" (article 294 du CGI).
        return [
            TaxRegime::EXEMPTED->withExemptionCode(VatExemptionCodeFr::CUSTOM_FR_DROM),
            TaxRegime::EXEMPTED,
        ];
    }

    public static function getVatRates(?bool $extended = true): array
    {
        // - T.V.A. non applicable (article 294-1 du Code général des impôts).
        return [0];
    }
}
