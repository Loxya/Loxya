<?php
declare(strict_types=1);

namespace Loxya\Support\Data\CountryMetadata;

use Loxya\Config\Config;
use Loxya\Models\Enums\LegalEntityType;
use Loxya\Models\Invoice;
use Loxya\Support\Arr;
use Loxya\Support\Country;
use Loxya\Support\Data\ElectronicInvoiceFormat;
use Loxya\Support\Data\IdentifierScheme;
use Loxya\Support\Data\InvoiceRoutingIdentifierScheme;
use Loxya\Support\Data\LegalType\LegalTypeBe;
use Loxya\Support\Invoicing\BusinessProcessType\BusinessProcessTypeInterface;
use Loxya\Support\Invoicing\BuyerInterface;
use Loxya\Support\Invoicing\TaxRegime;
use Loxya\Support\Invoicing\UblSpecification;
use Loxya\Support\Invoicing\VatExemptionCode\VatExemptionCodeBe;

/**
 * Métadonnées pour la Belgique.
 */
class CountryMetadataBe implements CountryMetadataInterface
{
    public static function getCompanyIdentifiers(): array
    {
        // @see https://regex101.com/r/DMe80V/1
        $cbePattern = '/^(?:BE[.\s-]?)?(?<digits>[01]\d{3}[.\s-]?\d{3}[.\s-]?\d{3})$/i';

        return [
            [
                'isPrecise' => true,
                'scheme' => IdentifierScheme::BE_BCE,
                'pattern' => $cbePattern,
                'normalize' => static function (string $raw) use ($cbePattern): string {
                    if (!preg_match($cbePattern, $raw, $matches)) {
                        throw new \InvalidArgumentException('Invalid value.');
                    }

                    $digits = preg_replace('/[.\s-]/', '', $matches['digits']);
                    return vsprintf('%s.%s.%s', [
                        substr($digits, 0, 4),
                        substr($digits, 4, 3),
                        substr($digits, 7, 3),
                    ]);
                },
            ],
        ];
    }

    public static function mustShowLegalType(): bool
    {
        return true;
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

    public static function isSameVatArea(Country $otherCountry): bool
    {
        // - Si Belgique => Belgique => Oui.
        if ($otherCountry->getCode() === 'BE') {
            return true;
        }

        // - Sinon, si c'est un pays européen => "Oui".
        return $otherCountry->isEuVatMember();
    }

    public static function requireBuyerRegistrationId(?Country $buyerCountry = null): bool
    {
        // - Si Belgique => Belgique => Requis.
        return (
            $buyerCountry === null ||
            $buyerCountry->getCode() === 'BE'
        );
    }

    public static function requireBuyerAddress(bool $isCompany): bool
    {
        return true;
    }

    public static function getLineAvailableTaxRegimes(BuyerInterface $buyer, bool $isService): array
    {
        $buyerCountry = $buyer->getBuyerAddress()?->getCountry() ?? Config::getMainCountry();
        $isCompany = $buyer->getBuyerType() === LegalEntityType::COMPANY;

        //
        // - B2B
        //

        if ($isCompany) {
            $hasVatNumber = $buyer->getBuyerVatNumber() !== null;

            // - Si l'entreprise cliente est aussi en Belgique...
            if ($buyerCountry->getCode() === 'BE') {
                // - Si c'est un service en B2B domestique, on permet l'auto-liquidation.
                if ($hasVatNumber && $isService) {
                    return [
                        TaxRegime::STANDARD,
                        TaxRegime::REVERSE_CHARGE
                            ->withExemptionCode(VatExemptionCodeBe::CUSTOM_BE_AE),
                        TaxRegime::EXEMPTED,
                    ];
                }

                return [TaxRegime::STANDARD, TaxRegime::EXEMPTED];
            }

            // - Si l'entreprise cliente est dans l'aire économique européenne...
            if ($buyerCountry->isEuVatMember()) {
                // - Si l'entreprise client a un numéro de T.V.A. valide,
                //   => On ajoute les règles d'auto-liquidation (bien / service).
                if ($hasVatNumber) {
                    return [
                        (
                            $isService
                                ? TaxRegime::REVERSE_CHARGE
                                : TaxRegime::REVERSE_CHARGE_SUPPLY
                        ),
                        TaxRegime::STANDARD,
                        TaxRegime::EXEMPTED,
                    ];
                }

                // - Sinon, si pas de numéro de T.V.A., pas d'auto-liquidation possible.
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

        // - Si le client est aussi en Belgique ou dans l'aire économique européenne...
        //   (Note: pour l'EEA il y a une limite de 10000€ pour certains services qui
        //   implique de facturer avec la T.V.A. du pays du preneur, le end-user devra
        //   gérer ce cas via ses taxes et en surchargeant les lignes)
        if ($buyerCountry->getCode() === 'BE' || $buyerCountry->isEuVatMember()) {
            return [TaxRegime::STANDARD, TaxRegime::EXEMPTED];
        }

        // - Sinon, si c'est un autre pays et que c'est un produit, export en priorité.
        if (!$isService) {
            return [
                TaxRegime::EXPORT,
                TaxRegime::STANDARD,
                TaxRegime::EXEMPTED,
            ];
        }

        // - Sinon, T.V.A. du pays du vendeur.
        return [TaxRegime::STANDARD, TaxRegime::EXEMPTED];
    }

    public static function getElectronicInvoiceFormats(): array
    {
        return [ElectronicInvoiceFormat::UBL];
    }

    public static function getUblSpecification(): ?UblSpecification
    {
        return UblSpecification::PEPPOL_BIS_BILLING_3;
    }

    public static function getInvoiceRoutingIdentifierPattern(): string|null
    {
        // - Format possible: `0208:[BCE]`.
        return '/^(?:0208:)?(?<value>[01]\d{9})$/';
    }

    public static function normalizeInvoiceRoutingIdentifier(string $rawValue): string
    {
        $pattern = static::getInvoiceRoutingIdentifierPattern();
        if (!preg_match($pattern, $rawValue, $matches)) {
            throw new \InvalidArgumentException('Invalid value.');
        }

        return vsprintf('%s:%s', [
            InvoiceRoutingIdentifierScheme::BE_BCE->value,
            $matches['value'],
        ]);
    }

    public static function canInferDefaultInvoiceRoutingIdentifier(): bool
    {
        // - En Belgique, l'identifiant peut être déduit du numéro BCE.
        return true;
    }

    public static function inferDefaultInvoiceRoutingIdentifier(string $companyIdentifier): string|null
    {
        $identifiers = self::getCompanyIdentifiers();
        $identifierMetadata = Arr::first($identifiers, static fn ($identifier) => (
            preg_match($identifier['pattern'], $companyIdentifier) > 0
        ));
        if ($identifierMetadata === null) {
            return null;
        }

        $normalized = $identifierMetadata['normalize']($companyIdentifier);
        $identifier = preg_replace('/[.\s-]/', '', (
            is_array($normalized) ? $normalized['main'] : $normalized
        ));
        return sprintf('%s:%s', InvoiceRoutingIdentifierScheme::BE_BCE->value, $identifier);
    }

    public static function getInvoiceLegalMentions(): array
    {
        return [];
    }

    public static function getVatNumberPattern(): string
    {
        return '/^BE[.\s-]?(?<digits>[01]\d{3}[.\s-]?\d{3}[.\s-]?\d{3})$/i';
    }

    public static function normalizeVatNumber(string $rawValue): string
    {
        $pattern = static::getVatNumberPattern();
        if (!preg_match($pattern, $rawValue, $matches)) {
            throw new \InvalidArgumentException('Invalid value.');
        }

        $digits = preg_replace('/[.\s-]/', '', $matches['digits']);
        return vsprintf('BE %s.%s.%s', [
            substr($digits, 0, 4),
            substr($digits, 4, 3),
            substr($digits, 7, 3),
        ]);
    }

    public static function inferVatNumberFromCompanyIdentifier(string $companyIdentifier): string|null
    {
        return static::normalizeVatNumber(sprintf('BE %s', $companyIdentifier));
    }

    public static function inferBusinessProcessType(Invoice $invoice): ?BusinessProcessTypeInterface
    {
        return null;
    }

    public static function getActivityCodePattern(): string
    {
        return '/^(?<code>\d{2}\.?\d{2,})$/'; // - Nacebel 2025.
    }

    public static function normalizeActivityCode(string $rawValue): string
    {
        $pattern = static::getActivityCodePattern();
        if (!preg_match($pattern, $rawValue, $matches)) {
            throw new \InvalidArgumentException('Invalid value.');
        }

        $code = str_replace('.', '', $matches['code']);
        return vsprintf('%s.%s', [
            substr($code, 0, 2),
            substr($code, 2),
        ]);
    }

    public static function getLegalTypes(): array
    {
        return LegalTypeBe::cases();
    }

    public static function getGlobalVatExemptionCodes(): array
    {
        return VatExemptionCodeBe::globals();
    }

    public static function getLineVatExemptionCodes(TaxRegime $regime): array
    {
        return VatExemptionCodeBe::lines();
    }

    public static function hasSimpleVatSystem(): bool
    {
        return true;
    }

    public static function getVatRates(?bool $extended = true): array
    {
        $baseRates = [
            21, // Taux normal
            12, // Taux intermédiaire
            6, // Taux réduit
        ];

        return !$extended ? $baseRates : [
            ...$baseRates,

            // - Taux zéro.
            0,
        ];
    }
}
