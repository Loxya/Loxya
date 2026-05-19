<?php
declare(strict_types=1);

namespace Loxya\Support\Data\CountryMetadata;

use Loxya\Config\Config;
use Loxya\Models\Enums\LegalEntityType;
use Loxya\Models\Invoice;
use Loxya\Support\Country;
use Loxya\Support\Data\IdentifierScheme;
use Loxya\Support\Data\LegalType\LegalTypeCh;
use Loxya\Support\Invoicing\BusinessProcessType\BusinessProcessTypeInterface;
use Loxya\Support\Invoicing\BuyerInterface;
use Loxya\Support\Invoicing\TaxRegime;
use Loxya\Support\Invoicing\UblSpecification;

/**
 * Métadonnées pour la Suisse.
 */
class CountryMetadataCh implements CountryMetadataInterface
{
    public static function getCompanyIdentifiers(): array
    {
        // @see https://regex101.com/r/TXtXVj/1
        $uidPattern = '/^CHE[.\s-]?(?<digits>\d{3}[.\s-]?\d{3}[.\s-]?\d{3})(?: .*)?$/i';

        return [
            [
                'isPrecise' => true,
                'scheme' => IdentifierScheme::CH_IDE,
                'pattern' => $uidPattern,
                'normalize' => static function (string $raw) use ($uidPattern): string {
                    if (!preg_match($uidPattern, $raw, $matches)) {
                        throw new \InvalidArgumentException('Invalid value.');
                    }

                    $digits = preg_replace('/[.\s-]/', '', $matches['digits']);
                    return vsprintf('CHE-%s.%s.%s', [
                        substr($digits, 0, 3),
                        substr($digits, 3, 3),
                        substr($digits, 6, 3),
                    ]);
                },
            ],
        ];
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
        // - Si Suisse => Suisse ou Liechtenstein => Oui.
        return in_array($otherCountry->getCode(), ['CH', 'LI'], true);
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
            // - Si l'entreprise cliente est aussi en Suisse ou au Liechtenstein...
            if (in_array($buyerCountry->getCode(), ['CH', 'LI'], true)) {
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

        // - Si le client est aussi en Suisse ou au Liechtenstein ou que c'est un service...
        if (in_array($buyerCountry->getCode(), ['CH', 'LI'], true) || $isService) {
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
        return '/^CHE[.\s-]?(?<digits>\d{3}[.\s-]?\d{3}[.\s-]?\d{3})\s+(?<suffix>TVA|IVA|MWST)$/i';
    }

    public static function normalizeVatNumber(string $rawValue): string
    {
        $pattern = static::getVatNumberPattern();
        if (!preg_match($pattern, $rawValue, $matches)) {
            throw new \InvalidArgumentException('Invalid value.');
        }

        $digits = preg_replace('/[.\s-]/', '', $matches['digits']);
        $suffix = strtoupper($matches['suffix'] ?? 'TVA');
        return vsprintf('CHE-%s.%s.%s %s', [
            substr($digits, 0, 3),
            substr($digits, 3, 3),
            substr($digits, 6, 3),
            $suffix,
        ]);
    }

    public static function inferVatNumberFromCompanyIdentifier(string $companyIdentifier): string|null
    {
        return static::normalizeVatNumber(sprintf('%s TVA', $companyIdentifier));
    }

    public static function inferBusinessProcessType(Invoice $invoice): ?BusinessProcessTypeInterface
    {
        return null;
    }

    public static function getActivityCodePattern(): string
    {
        return '/^(?<code>\d{6})$/'; // - NOGA 2025.
    }

    public static function normalizeActivityCode(string $rawValue): string
    {
        $pattern = static::getActivityCodePattern();
        if (!preg_match($pattern, $rawValue, $matches)) {
            throw new \InvalidArgumentException('Invalid value.');
        }
        return $rawValue;
    }

    public static function getLegalTypes(): array
    {
        return LegalTypeCh::cases();
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
            8.1, // Taux normal
            3.8, // Taux réduit
            2.6, // Taux super réduit
        ];

        return !$extended ? $baseRates : [
            ...$baseRates,

            // - Taux zéro.
            0,
        ];
    }
}
