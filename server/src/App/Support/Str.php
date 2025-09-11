<?php
declare(strict_types=1);

namespace Loxya\Support;

use Cocur\Slugify\Slugify;
use ConsoleTVs\Profanity\Builder as Profanity;
use Hidehalo\Nanoid\Client as Nanoid;
use Illuminate\Support\Str as StrCore;

class Str extends StrCore
{
    protected static $shortidCache = [];

    protected static $shortidFactory = null;

    protected static $numericCodeFactory = null;

    /**
     * Permet de "sluggifier" une chaîne de caractères.
     *
     * @param string $string La chaîne à "sluggifier".
     * @param string $separator Le séparateur à utiliser.
     * @param string $rulesets Le groupe de règles à utiliser pour la normalisation des caractères.
     *                         (@see {@link \Cocur\Slugify\Slugify::$options})
     *
     * @return string La chaîne "sluggifiée".
     */
    public static function slugify(string $string, string $separator = '-', string $rulesets = 'default'): string
    {
        return (new Slugify())->slugify($string, [
            'separator' => $separator,
            'rulesets' => $rulesets,
        ]);
    }

    /**
     * Détecte si une chaîne contient des propos déplacés / injurieux / offensants.
     *
     * Certains chiffres, pouvant se substituer à certaines lettres (l33tsp34k)
     * sont aussi vérifiés (e.g. `1` pour `l`, `3` pour `e`).
     *
     * @param string $str La chaîne à analyser.
     *
     * @return bool `true` si la chaîne contient des propos offensants, `false` sinon.
     */
    public static function hasProfanity(string $str): bool
    {
        $normalizedStr = str_replace([' ', '.', '-', '_'], '', $str);
        $normalizedStr = static::ascii(str_ireplace(
            ['1', '3', '5', '8', '0', '4', '!', '|', '@', '$', '+'],
            ['i', 'e', 's', 'b', 'o', 'a', 'i', 'l', 'a', 's', 't'],
            $normalizedStr,
        ));

        return !Profanity::blocker($normalizedStr)
            ->strict(true)
            ->clean();
    }

    /**
     * Génère un identifiant court unique (e.g. `FC85YZ`).
     *
     * @return string L'identifiant court généré.
     */
    public static function shortid(): string
    {
        if (static::$shortidFactory) {
            return call_user_func(static::$shortidFactory);
        }

        $generator = new Nanoid();
        do {
            $shortid = $generator->formattedId('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 6);
        } while (in_array($shortid, static::$shortidCache, true) || static::hasProfanity($shortid));

        return static::$shortidCache[] = $shortid;
    }

    /**
     * Définit une fabrique personnalisée pour la génération de shortid.
     *
     * @param callable|null $factory  Une fonction de rappel qui retourne un identifiant court.
     *                                Si `null`, la fabrique sera désactivée.
     */
    public static function createShortidUsing(?callable $factory = null): void
    {
        static::$shortidFactory = $factory;
    }

    /**
     * Réinitialise la fabrique de génération de shortid pour
     * revenir au comportement par défaut.
     */
    public static function createShortidNormally(): void
    {
        static::$shortidFactory = null;
    }

    /**
     * Gèle un code numérique pour les appels suivants à `shortid()`.
     *
     * @param \Closure|null $callback Si un callback est fourni, les shortid ne seront
     *                                "gelés" que lors de l'appel du callback et "dégelés"
     *                                après.
     *
     * @return string L'identifiant court tel qu'il sera toujours retourné jusqu'à ce que
     *                les shortid soient "dégelés".
     */
    public static function freezeShortid(?\Closure $callback = null): string
    {
        $shortid = static::shortid();

        static::createShortidUsing(static fn () => $shortid);

        if ($callback !== null) {
            try {
                $callback($shortid);
            } finally {
                static::createShortidNormally();
            }
        }

        return $shortid;
    }

    /**
     * Génère un code numérique de la longueur spécifiée.
     *
     * @param int $length La longueur du code à générer.
     *
     * @return string Le code numérique généré.
     */
    public static function numericCode(?int $length = 6): string
    {
        Assert::positiveInteger($length, 'Length must be at least 1.');

        if (static::$numericCodeFactory) {
            return call_user_func(static::$numericCodeFactory, $length);
        }

        return (string) random_int(10 ** ($length - 1), (10 ** $length) - 1);
    }

    /**
     * Définit une fabrique personnalisée pour la génération de code numérique.
     *
     * @param callable|null $factory  Une fonction de rappel qui retourne un code numérique.
     *                                Si `null`, la fabrique sera désactivée.
     */
    public static function createNumericCodeUsing(?callable $factory = null): void
    {
        static::$numericCodeFactory = $factory;
    }

    /**
     * Réinitialise la fabrique de génération de code numérique
     * pour revenir au comportement par défaut.
     */
    public static function createNumericCodeNormally(): void
    {
        static::$numericCodeFactory = null;
    }

    /**
     * Gèle un code numérique pour les appels suivants à `numericCode()`.
     *
     * @param int          $length    La longueur du code gelé.
     * @param \Closure|null $callback Si un callback est fourni, les codes numériques ne seront
     *                                "gelés" que lors de l'appel du callback et "dégelés" après.
     *
     * @return string Le code numérique tel qu'il sera toujours retourné jusqu'à ce que
     *                les codes numériques soient "dégelés".
     */
    public static function freezeNumericCode(?int $length = 6, ?\Closure $callback = null): string
    {
        $code = self::numericCode($length);

        self::createNumericCodeUsing(static fn () => $code);

        if ($callback !== null) {
            try {
                $callback($code);
            } finally {
                self::createNumericCodeNormally();
            }
        }

        return $code;
    }

    /**
     * Définit une séquence de codes numériques à utiliser pour les appels successifs à `numericCode()`.
     *
     * Cette méthode est principalement destinée aux tests. Chaque appel à `numericCode()` retournera
     * un élément de la séquence fournie, dans l'ordre. Si la séquence est épuisée, la fonction
     * `$whenMissing` est appelée pour générer dynamiquement un code alternatif.
     *
     * @param array $sequence Liste de chaînes à retourner successivement lors des appels à `numericCode()`.
     *
     * @param callable|null $whenMissing Fonction appelée lorsqu'on dépasse la longueur de la séquence fournie.
     *                      Elle reçoit la longueur désirée du code et doit retourner une chaîne.
     *                      Si `null`, la génération par défaut de `numericCode()` est utilisée.
     */
    public static function createNumericCodeUsingSequence(array $sequence, ?callable $whenMissing = null): void
    {
        $iterator = 0;

        $whenMissing ??= static function ($length) use (&$iterator) {
            $factoryCache = static::$numericCodeFactory;

            static::$numericCodeFactory = null;
            try {
                $code = static::numericCode($length);
            } finally {
                static::$numericCodeFactory = $factoryCache;
            }

            $iterator++;
            return $code;
        };

        static::createNumericCodeUsing(
            static function ($length) use (&$iterator, $sequence, $whenMissing) {
                return array_key_exists($iterator, $sequence)
                    ? $sequence[$iterator++]
                    : $whenMissing($length);
            },
        );
    }

    /**
     * Réinitialise tous les générateurs personnalisés et vide les caches internes.
     *
     * Elle est principalement destinée aux tests unitaires pour garantir
     * un état propre entre plusieurs cas de test.
     */
    public static function reset(): void
    {
        static::flushCache();

        static::createNumericCodeNormally();
        static::createRandomStringsNormally();
        static::createShortidNormally();
        static::createUlidsNormally();
        static::createUuidsNormally();
    }
}
