<?php
declare(strict_types=1);

namespace Loxya\Support\Data\CountryMetadata;

use Loxya\Config\Config;
use Loxya\Models\Enums\LegalEntityType;
use Loxya\Models\Invoice;
use Loxya\Support\Country;
use Loxya\Support\Data\IdentifierScheme;
use Loxya\Support\Invoicing\BusinessProcessType\BusinessProcessTypeInterface;
use Loxya\Support\Invoicing\BuyerInterface;
use Loxya\Support\Invoicing\TaxRegime;
use Loxya\Support\Invoicing\UblSpecification;

/**
 * Métadonnées pour la République Démocratique du Congo.
 */
class CountryMetadataCd implements CountryMetadataInterface
{
    public static function getCompanyIdentifiers(): array
    {
        // - RCCM: "CD/<VILLE>/RCCM/<ANNÉE>-<TYPE>-<NUMÉRO>" (e.g. "CD/KIN/RCCM/14-B-00123").
        $rccmPattern = '/^CD\/[A-Z]{2,4}\/RCCM\/\d{2,4}-?[A-Z]{1,2}-?\d{1,8}$/i';

        return [
            [
                'isPrecise' => true,
                'scheme' => IdentifierScheme::CD_RCCM,
                'pattern' => $rccmPattern,
                'normalize' => static function (string $raw) use ($rccmPattern): string {
                    if (!preg_match($rccmPattern, $raw)) {
                        throw new \InvalidArgumentException('Invalid value.');
                    }
                    return strtoupper($raw);
                },
            ],
        ];
    }

    public static function getCurrencies(): array
    {
        // - Le franc congolais est la devise officielle, mais le dollar
        //   américain est largement utilisé dans les transactions commerciales.
        return ['CDF', 'USD'];
    }

    public static function requireSellerRegistrationId(): bool
    {
        return true;
    }

    public static function mustShowLegalType(): bool
    {
        return false;
    }

    public static function mustShowShareCapital(): bool
    {
        return false;
    }

    public static function mustShowTradeRegister(): bool
    {
        return false;
    }

    public static function canShowActivityCode(): bool
    {
        return false;
    }

    public static function requireBuyerRegistrationId(?Country $buyerCountry = null): bool
    {
        return false;
    }

    public static function isSameVatArea(Country $otherCountry): bool
    {
        return $otherCountry->getCode() === 'CD';
    }

    public static function requireBuyerAddress(bool $isCompany): bool
    {
        return false;
    }

    public static function getLineAvailableTaxRegimes(BuyerInterface $buyer, bool $isService): array
    {
        $buyerCountry = $buyer->getBuyerAddress()?->getCountry() ?? Config::getMainCountry();
        $isCompany = $buyer->getBuyerType() === LegalEntityType::COMPANY;

        //
        // - B2B
        //

        if ($isCompany) {
            // - Si l'entreprise cliente est aussi en R.D. du Congo...
            if ($buyerCountry->getCode() === 'CD') {
                return [TaxRegime::STANDARD, TaxRegime::EXEMPTED];
            }

            // - Sinon, si c'est un autre pays...
            return [
                TaxRegime::EXPORT,
                TaxRegime::EXEMPTED,
                TaxRegime::STANDARD,
            ];
        }

        //
        // - B2C.
        //

        // - Si le client est aussi en R.D. du Congo ou que c'est un service...
        if ($buyerCountry->getCode() === 'CD' || $isService) {
            return [TaxRegime::STANDARD, TaxRegime::EXEMPTED];
        }

        // - Sinon, si c'est un autre pays et que c'est un produit, export en priorité.
        return [
            TaxRegime::EXPORT,
            TaxRegime::STANDARD,
            TaxRegime::EXEMPTED,
        ];
    }

    public static function getElectronicInvoiceFormats(): array
    {
        return [];
    }

    public static function getUblSpecification(): ?UblSpecification
    {
        return null;
    }

    public static function getInvoiceRoutingIdentifierPattern(): string|null
    {
        return null;
    }

    public static function normalizeInvoiceRoutingIdentifier(string $rawValue): string
    {
        return $rawValue;
    }

    public static function canInferDefaultInvoiceRoutingIdentifier(): bool
    {
        return false;
    }

    public static function inferDefaultInvoiceRoutingIdentifier(string $companyIdentifier): string|null
    {
        return null;
    }

    public static function getInvoiceLegalMentions(): array
    {
        return [];
    }

    public static function getVatNumberPattern(): string
    {
        // - N.I.F. (Numéro d'Identification Fiscale) : entre 8 et 15 chiffres.
        return '/^\d{8,15}$/';
    }

    public static function normalizeVatNumber(string $rawValue): string
    {
        $pattern = static::getVatNumberPattern();
        if (!preg_match($pattern, $rawValue)) {
            throw new \InvalidArgumentException('Invalid value.');
        }
        return $rawValue;
    }

    public static function inferVatNumberFromCompanyIdentifier(string $companyIdentifier): string|null
    {
        return null;
    }

    public static function inferBusinessProcessType(Invoice $invoice): ?BusinessProcessTypeInterface
    {
        return null;
    }

    public static function getActivityCodePattern(): string
    {
        return '/^.+$/';
    }

    public static function normalizeActivityCode(string $rawValue): string
    {
        return $rawValue;
    }

    public static function getLegalTypes(): array
    {
        return [];
    }

    public static function getGlobalVatExemptionCodes(): array
    {
        return [];
    }

    public static function getLineVatExemptionCodes(TaxRegime $regime): array
    {
        return [];
    }

    public static function hasSimpleVatSystem(): bool
    {
        return true;
    }

    public static function getVatRates(?bool $extended = true): array
    {
        $baseRates = [
            16.0, // - Taux normal.
            8.0, // - Taux réduit (produits de première nécessité, livres, etc.).
        ];

        return !$extended ? $baseRates : [
            ...$baseRates,

            // - Taux zéro (exportations).
            0,
        ];
    }
}
