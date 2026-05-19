<?php
declare(strict_types=1);

namespace Loxya\Support\Data\CountryMetadata;

/**
 * Métadonnées pour la Martinique.
 *
 * @see https://www.impots.gouv.fr/professionnel/questions/quels-sont-les-differents-taux-de-tva-applicables-dans-les-dom
 */
final class CountryMetadataMq extends CountryMetadataFr
{
    public static function getVatRates(?bool $extended = true): array
    {
        $baseRates = [
            8.5, // Taux normal
            2.1, // Taux réduit
            1.05, // Taux super réduit
        ];

        return !$extended ? $baseRates : [
            ...$baseRates,

            // - France métropolitaine
            20,
            10,
            5.5,

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
