<?php
declare(strict_types=1);

namespace Loxya\Support\Data\CountryMetadata;

use Loxya\Config\Config;
use Loxya\Models\Enums\BillingType;
use Loxya\Models\Enums\LegalEntityType;
use Loxya\Models\Invoice;
use Loxya\Support\Arr;
use Loxya\Support\Country;
use Loxya\Support\Data\ElectronicInvoiceFormat;
use Loxya\Support\Data\IdentifierScheme;
use Loxya\Support\Data\InvoiceRoutingIdentifierScheme;
use Loxya\Support\Data\LegalType\LegalTypeFr;
use Loxya\Support\Invoicing\BusinessProcessType\BusinessProcessTypeFr;
use Loxya\Support\Invoicing\BuyerInterface;
use Loxya\Support\Invoicing\LegalMention;
use Loxya\Support\Invoicing\TaxRegime;
use Loxya\Support\Invoicing\UblSpecification;
use Loxya\Support\Invoicing\VatExemptionCode\VatExemptionCodeFr;

/**
 * Métadonnées pour la France.
 */
class CountryMetadataFr implements CountryMetadataInterface
{
    public static function getCompanyIdentifiers(): array
    {
        $sirenPattern = '/^\d{3}\s?\d{3}\s?\d{3}$/i';
        $siretPattern = '/^\d{3}\s?\d{3}\s?\d{3}\s?\d{5}$/i';

        return [
            [
                'isPrecise' => false,
                'scheme' => IdentifierScheme::FR_SIREN,
                'pattern' => $sirenPattern,
                'normalize' => static function (string $raw) use ($sirenPattern): string {
                    if (!preg_match($sirenPattern, $raw)) {
                        throw new \InvalidArgumentException('Invalid value.');
                    }
                    return str_replace(' ', '', $raw);
                },
            ],
            [
                'isPrecise' => true,
                'scheme' => IdentifierScheme::FR_SIRET,
                'pattern' => $siretPattern,
                'normalize' => static function (string $raw) use ($siretPattern): array {
                    if (!preg_match($siretPattern, $raw)) {
                        throw new \InvalidArgumentException('Invalid value.');
                    }
                    $normalized = str_replace(' ', '', $raw);
                    return [
                        'current' => $normalized,
                        'main' => substr($normalized, 0, 9),
                    ];
                },
            ],
        ];
    }

    public static function getCurrencies(): array
    {
        return ['EUR'];
    }

    public static function mustShowLegalType(): bool
    {
        return true;
    }

    public static function mustShowShareCapital(): bool
    {
        return true;
    }

    public static function mustShowTradeRegister(): bool
    {
        return true;
    }

    public static function canShowActivityCode(): bool
    {
        return true;
    }

    public static function isSameVatArea(Country $otherCountry): bool
    {
        // - Si France => France => Oui.
        if ($otherCountry->getCode() === 'FR') {
            return true;
        }

        // - Sinon, si c'est un pays européen => "Oui".
        return $otherCountry->isEuVatMember();
    }

    public static function requireSellerRegistrationId(): bool
    {
        return true;
    }

    public static function requireBuyerRegistrationId(?Country $buyerCountry = null): bool
    {
        // - Si France => France => Requis.
        if ($buyerCountry === null || $buyerCountry->getCode() === 'FR') {
            return true;
        }

        // - Si c'est un DROM => requis, sinon non requis.
        return in_array($buyerCountry->getCode(), ['GP', 'MQ', 'GF', 'YT', 'RE'], true);
    }

    public static function requireBuyerAddress(bool $isCompany): bool
    {
        // - L'adresse est en principe toujours obligatoires mais
        //   les particuliers peuvent s'y opposer.
        return $isCompany;
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

            // - Si l'entreprise cliente est aussi en France...
            if ($buyerCountry->getCode() === 'FR') {
                // - Si c'est un service en B2B domestique, on permet l'auto-liquidation.
                if ($hasVatNumber && $isService) {
                    return [
                        TaxRegime::STANDARD,
                        TaxRegime::REVERSE_CHARGE
                            ->withExemptionCode(VatExemptionCodeFr::VATEX_FR_AE),
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

            // - Si le pays de l'entreprise cliente est dans les DROM...
            //   See https://www.impots.gouv.fr/professionnel/questions/quels-sont-les-differents-taux-de-tva-applicables-dans-les-dom
            $isDrom = in_array($buyerCountry->getCode(), ['GP', 'MQ', 'GF', 'YT', 'RE'], true);
            if ($isDrom) {
                // - Si c'est la Guyane et Mayotte (qui sont exemptés de T.V.A. pour le moment) ou un produit...
                //   => Code d'exemption spécifique pour les DROM en priorité.
                $isExemptedDrom = in_array($buyerCountry->getCode(), ['GF', 'YT'], true);
                if ($isExemptedDrom || !$isService) {
                    return [
                        TaxRegime::EXEMPTED
                            ->withExemptionCode(VatExemptionCodeFr::CUSTOM_FR_DROM),
                        TaxRegime::STANDARD,
                        TaxRegime::EXEMPTED,
                    ];
                }

                // - Sinon si c'est un service dans un DROM non exempté, T.V.A standard en priorité.
                //   Note: C'est censé être la T.V.A. du pays du preneur, l'utilisateur devra
                //         gérer ceci via ses taux de T.V.A. enregistrés.
                return [TaxRegime::STANDARD, TaxRegime::EXEMPTED];
            }

            // - Sinon, si c'est un autre pays...
            return [
                TaxRegime::EXPORT->withExemptionCode(
                    $isService
                        ? VatExemptionCodeFr::CUSTOM_FR_G_SERVICE
                        : null,
                ),
                TaxRegime::EXEMPTED,
                TaxRegime::STANDARD,
            ];
        }

        //
        // - B2C.
        //

        // - Si le client est aussi en France ou dans l'aire économique européenne...
        //   (Note: pour l'EEA il y a une limite de 10000€ pour certains services qui
        //   implique de facturer avec la T.V.A. du pays du preneur, le end-user devra
        //   gérer ce cas via ses taxes et en surchargeant les lignes)
        if ($buyerCountry->getCode() === 'FR' || $buyerCountry->isEuVatMember()) {
            return [TaxRegime::STANDARD, TaxRegime::EXEMPTED];
        }

        // - Si le pays du client est dans les DROM...
        //   See https://www.impots.gouv.fr/professionnel/questions/quels-sont-les-differents-taux-de-tva-applicables-dans-les-dom
        $isDrom = in_array($buyerCountry->getCode(), ['GP', 'MQ', 'GF', 'YT', 'RE'], true);
        if ($isDrom) {
            // - Si c'est un produit, code d'exemption spécifique pour les DROM en priorité.
            if (!$isService) {
                return [
                    TaxRegime::EXEMPTED
                        ->withExemptionCode(VatExemptionCodeFr::CUSTOM_FR_DROM),
                    TaxRegime::STANDARD,
                    TaxRegime::EXEMPTED,
                ];
            }

            // - Sinon si c'est un service dans un DROM non exempté, T.V.A. standard en priorité.
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
        return [
            ElectronicInvoiceFormat::FACTURX,
            ElectronicInvoiceFormat::UBL,
        ];
    }

    public static function getUblSpecification(): ?UblSpecification
    {
        return UblSpecification::EXTENDED_CTC_FR;
    }

    public static function getInvoiceRoutingIdentifierPattern(): string|null
    {
        // - Formats possibles:
        //   - `0225:[SIREN]`
        //   - `0225:[SIREN]_[SIRET]`
        //   - `0225:[SIREN]_[SUFFIX]`
        //   - `0225:[SIREN]_[SIRET]_[CODE_ROUTAGE]`
        return '/^(?:0225:)?(?<value>\d{9}(?:_[A-Za-z0-9]+(?:_[A-Za-z0-9]+)?)?)$/';
    }

    public static function normalizeInvoiceRoutingIdentifier(string $rawValue): string
    {
        $pattern = static::getInvoiceRoutingIdentifierPattern();
        if (!preg_match($pattern, $rawValue, $matches)) {
            throw new \InvalidArgumentException('Invalid value.');
        }

        return vsprintf('%s:%s', [
            InvoiceRoutingIdentifierScheme::FR_CTC->value,
            $matches['value'],
        ]);
    }

    public static function canInferDefaultInvoiceRoutingIdentifier(): bool
    {
        // - En France, l'identifiant peut être déduit du SIREN.
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
        return sprintf('%s:%s', InvoiceRoutingIdentifierScheme::FR_CTC->value, $identifier);
    }

    public static function getInvoiceLegalMentions(): array
    {
        return [
            LegalMention::SELLER_IDENTITY,
            LegalMention::VAT_DUE_ON_INVOICE,
            LegalMention::TRADE_REGISTER,
            LegalMention::NO_EARLY_PAYMENT_DISCOUNT,
            LegalMention::LATE_PAYMENT_PENALTY,
            LegalMention::LATE_PAYMENT_FEE,
        ];
    }

    public static function getVatNumberPattern(): string
    {
        return '/^FR(?<digits>\d{11})$/i';
    }

    public static function normalizeVatNumber(string $rawValue): string
    {
        $pattern = static::getVatNumberPattern();
        if (!preg_match($pattern, $rawValue, $matches)) {
            throw new \InvalidArgumentException('Invalid value.');
        }
        return sprintf('FR%s', $matches['digits']);
    }

    public static function inferVatNumberFromCompanyIdentifier(string $companyIdentifier): string|null
    {
        $siren = substr($companyIdentifier, 0, 9);
        $vatNumberKey = (12 + 3 * ((int) $siren % 97)) % 97;
        $vatNumberKeyStr = str_pad((string) $vatNumberKey, 2, '0', STR_PAD_LEFT);
        return static::normalizeVatNumber(sprintf('FR%s%s', $vatNumberKeyStr, $siren));
    }

    public static function inferBusinessProcessType(Invoice $invoice): BusinessProcessTypeFr
    {
        // - En cas d'acompte, le type de facturation doit être hérité du devis
        //   parent afin d'être cohérent avec la facture de solde correspondante.
        $type = $invoice->is_prepayment && $invoice->parent_estimate !== null
            ? $invoice->parent_estimate->type
            : $invoice->type;

        return match ($type) {
            BillingType::GOODS => (
                $invoice->is_prepayment_final
                    ? BusinessProcessTypeFr::GOODS_FINAL_INVOICE
                    : BusinessProcessTypeFr::GOODS_INVOICE
            ),
            BillingType::SERVICES => (
                $invoice->is_prepayment_final
                    ? BusinessProcessTypeFr::SERVICES_FINAL_INVOICE
                    : BusinessProcessTypeFr::SERVICES_INVOICE
            ),
            BillingType::BOTH => (
                $invoice->is_prepayment_final
                    ? BusinessProcessTypeFr::MIXED_FINAL_INVOICE
                    : BusinessProcessTypeFr::MIXED_INVOICE
            ),
        };
    }

    public static function getActivityCodePattern(): string
    {
        return '/^(?<code>\d{2}\.?\d{2}[A-Z])$/'; // - APE / NAF.
    }

    public static function normalizeActivityCode(string $rawValue): string
    {
        $pattern = static::getActivityCodePattern();
        if (!preg_match($pattern, $rawValue, $matches)) {
            throw new \InvalidArgumentException('Invalid value.');
        }

        $code = strtoupper(str_replace('.', '', $matches['code']));
        return vsprintf('%s.%s', [
            substr($code, 0, 2),
            substr($code, 2),
        ]);
    }

    public static function getLegalTypes(): array
    {
        return LegalTypeFr::cases();
    }

    public static function getGlobalVatExemptionCodes(): array
    {
        return VatExemptionCodeFr::globals();
    }

    public static function getLineVatExemptionCodes(TaxRegime $regime): array
    {
        return VatExemptionCodeFr::lines($regime);
    }

    public static function hasSimpleVatSystem(): bool
    {
        return true;
    }

    public static function getVatRates(?bool $extended = true): array
    {
        $baseRates = [
            20, // Taux normal
            10, // Taux intermédiaire
            5.5, // Taux réduit
            2.1, // Taux super réduit
        ];

        return !$extended ? $baseRates : [
            ...$baseRates,

            // - DROM
            8.5,
            1.05,

            // - Corse
            13,
            0.9,
            1.75,

            // - Autres taux (cf. BR-FR-16)
            19.6, 7, 20.6, 1.05, 1.75, 9.2, 9.6,

            // - Taux zéro.
            0,
        ];
    }
}
