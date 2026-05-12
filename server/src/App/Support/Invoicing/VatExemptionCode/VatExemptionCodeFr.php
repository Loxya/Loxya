<?php
declare(strict_types=1);

namespace Loxya\Support\Invoicing\VatExemptionCode;

use Loxya\Support\Invoicing\TaxRegime;

/**
 * Motifs d'exemption de TVA spécifiquement françaises.
 *
 * Attention, pour avoir la liste complète des exemptions applicables en
 * France il faut aussi utiliser les exemptions au niveau européen.
 *
 * Ces codes respectent la norme Peppol 3.0.
 * - https://docs.peppol.eu/poacc/billing/3.0/codelist/vatex/
 * - https://ec.europa.eu/digital-building-blocks/sites/spaces/DIGITAL/pages/467108957/Code+lists
 */
enum VatExemptionCodeFr: string implements VatExemptionCodeInterface
{
    /**
     * France domestic VAT franchise in base (art. 293 B of CGI)
     *
     * For domestic invoicing in France
     */
    case VATEX_FR_FRANCHISE = 'VATEX-FR-FRANCHISE';

    /**
     * France domestic Credit Notes without VAT, due to supplier forfeit of VAT for discount
     *
     * For domestic Credit Notes only in France
     */
    case VATEX_FR_CNWVAT = 'VATEX-FR-CNWVAT';

    /**
     * Exempt based on 1 of article 261 of the Code Général des Impôts
     *
     * Operations subject to other taxes
     */
    case VATEX_FR_CGI261_1 = 'VATEX-FR-CGI261-1';

    /**
     * Exempt based on 2 of article 261 of the Code Général des Impôts
     *
     * Agricultural and fisheries activities
     */
    case VATEX_FR_CGI261_2 = 'VATEX-FR-CGI261-2';

    /**
     * Exempt based on 3 of article 261 of the Code Général des Impôts
     *
     * Sales of used goods
     */
    case VATEX_FR_CGI261_3 = 'VATEX-FR-CGI261-3';

    /**
     * Exempt based on 4 of article 261 of the Code Général des Impôts
     *
     * Activities of the professions and various activities
     */
    case VATEX_FR_CGI261_4 = 'VATEX-FR-CGI261-4';

    /**
     * Exempt based on 5 of article 261 of the Code Général des Impôts
     *
     * Real-estate operations
     */
    case VATEX_FR_CGI261_5 = 'VATEX-FR-CGI261-5';

    /**
     * Exempt based on 7 of article 261 of the Code Général des Impôts
     *
     * Non-profit organizations operations
     */
    case VATEX_FR_CGI261_7 = 'VATEX-FR-CGI261-7';

    /**
     * Exempt based on 8 of article 261 of the Code Général des Impôts
     *
     * Goods/services linked to an EU-area disaster
     */
    case VATEX_FR_CGI261_8 = 'VATEX-FR-CGI261-8';

    /**
     * Exempt based on article 261 A of the Code Général des Impôts
     *
     * Free-of-charge provision of property by legal entities
     */
    case VATEX_FR_CGI261A = 'VATEX-FR-CGI261A';

    /**
     * Exempt based on article 261 B of the Code Général des Impôts
     *
     * Member services by groups carrying out exempt activities
     */
    case VATEX_FR_CGI261B = 'VATEX-FR-CGI261B';

    /**
     * Exempt based on 1° of article 261 C of the Code Général des Impôts
     *
     * Banking and financial transactions
     */
    case VATEX_FR_CGI261C_1 = 'VATEX-FR-CGI261C-1';

    /**
     * Exempt based on 2° of article 261 C of the Code Général des Impôts
     *
     * Insurance/reinsurance transactions and related services
     */
    case VATEX_FR_CGI261C_2 = 'VATEX-FR-CGI261C-2';

    /**
     * Exempt based on 3° of article 261 C of the Code Général des Impôts
     *
     * Sale of fiscal and postage stamps at their official value
     */
    case VATEX_FR_CGI261C_3 = 'VATEX-FR-CGI261C-3';

    /**
     * Exempt based on 1° of article 261 D of the Code Général des Impôts
     *
     * Rentals of land and buildings for agricultural use
     */
    case VATEX_FR_CGI261D_1 = 'VATEX-FR-CGI261D-1';

    /**
     * Exempt based on 1°bis of article 261 D of the Code Général des Impôts
     *
     * Leases of immovable property conferring a right in rem
     */
    case VATEX_FR_CGI261D_1BIS = 'VATEX-FR-CGI261D-1BIS';

    /**
     * Exempt based on 2° of article 261 D of the Code Général des Impôts
     *
     * Leases of undeveloped land or bare premises
     */
    case VATEX_FR_CGI261D_2 = 'VATEX-FR-CGI261D-2';

    /**
     * Exempt based on 3° of article 261 D of the Code Général des Impôts
     *
     * Rights/leases relating to real-estate portfolio management
     */
    case VATEX_FR_CGI261D_3 = 'VATEX-FR-CGI261D-3';

    /**
     * Exempt based on 4° of article 261 D of the Code Général des Impôts
     *
     * Rentals of furnished accommodation for residential use
     */
    case VATEX_FR_CGI261D_4 = 'VATEX-FR-CGI261D-4';

    /**
     * Exempt based on 1° of article 261 E of the Code Général des Impôts
     *
     * Organisation of games of chance subject to levies
     */
    case VATEX_FR_CGI261E_1 = 'VATEX-FR-CGI261E-1';

    /**
     * Exempt based on 2° of article 261 E of the Code Général des Impôts
     *
     * Proceeds from lotteries, horse/sports betting and online circle games
     */
    case VATEX_FR_CGI261E_2 = 'VATEX-FR-CGI261E-2';

    /**
     * Exempt based on article 277 A of the Code Général des Impôts
     *
     * VAT suspensive scheme
     */
    case VATEX_FR_CGI277A = 'VATEX-FR-CGI277A';

    /**
     * Exempt based on article 275 of the Code Général des Impôts
     *
     * VAT-free purchases of goods intended for export or exempt supplies
     */
    case VATEX_FR_CGI275 = 'VATEX-FR-CGI275';

    /**
     * Exempt based on article 298 sexdecies A of the Code Général des Impôts
     *
     * Investment gold
     */
    case VATEX_FR_298SEXDECIESA = 'VATEX-FR-298SEXDECIESA';

    /**
     * Exempt based on article 295 of the Code Général des Impôts
     *
     * French territories under Arts. 349 and 355(1) TFEU
     */
    case VATEX_FR_CGI295 = 'VATEX-FR-CGI295';

    /**
     * Exempt based on 2 of article 283 of the Code Général des Impôts
     *
     * For domestic reverse charge only in France
     */
    case VATEX_FR_AE = 'VATEX-FR-AE';

    //
    // - Codes customs.
    //

    /**
     * Exempt based on 1 of article 259 of the Code Général des Impôts
     *
     * For outside-EU service export in France
     */
    case CUSTOM_FR_G_SERVICE = 'CUSTOM-FR-G-SERVICE';

    /**
     * Exempt based on article 294 of the Code Général des Impôts
     *
     * For delivery to the French overseas territories
     */
    case CUSTOM_FR_DROM = 'CUSTOM-FR-DROM';

    // ------------------------------------------------------
    // -
    // -    Méthodes
    // -
    // ------------------------------------------------------

    public function isCustom(): bool
    {
        $customs = [
            self::CUSTOM_FR_G_SERVICE,
            self::CUSTOM_FR_DROM,
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
            self::VATEX_FR_FRANCHISE,
            self::VATEX_FR_CGI261_1,
            // self::VATEX_FR_CGI261_2,
            self::VATEX_FR_CGI261_3,
            self::VATEX_FR_CGI261_4,
            self::VATEX_FR_CGI261_7,
            self::VATEX_FR_CGI261A,
            self::VATEX_FR_CGI261B,
            // self::VATEX_FR_CGI261C_1,
            self::VATEX_FR_CGI261D_1,
            self::VATEX_FR_CGI261D_1BIS,
            self::VATEX_FR_CGI261D_2,
            self::VATEX_FR_CGI261D_3,
            self::VATEX_FR_CGI261D_4,
            // self::VATEX_FR_CGI261E_1,
            // self::VATEX_FR_CGI261E_2,
            self::VATEX_FR_CGI277A,
            // self::VATEX_FR_298SEXDECIESA,
            self::VATEX_FR_CGI295,
            ...VatExemptionCodeEu::globals(),
        ];
    }

    public static function lines(?TaxRegime $regime = TaxRegime::EXEMPTED): array
    {
        if ($regime === TaxRegime::STANDARD) {
            throw new \LogicException("Standard regime cannot have exemption code.");
        }

        return match ($regime) {
            TaxRegime::EXEMPTED => [
                // self::VATEX_FR_CGI261_8,
                // self::VATEX_FR_CGI261C_1,
                // self::VATEX_FR_CGI261C_2,
                // self::VATEX_FR_CGI261C_3,
                // self::VATEX_FR_CGI261E_1,
                // self::VATEX_FR_CGI261E_2,
                self::CUSTOM_FR_DROM,
                ...VatExemptionCodeEu::lines($regime),
            ],
            TaxRegime::REVERSE_CHARGE => [
                self::VATEX_FR_AE,
                ...VatExemptionCodeEu::lines($regime),
            ],
            TaxRegime::EXPORT => [
                self::CUSTOM_FR_G_SERVICE,
                ...VatExemptionCodeEu::lines($regime),
            ],
            default => VatExemptionCodeEu::lines($regime),
        };
    }
}
