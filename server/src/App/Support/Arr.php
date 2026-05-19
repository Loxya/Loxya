<?php
declare(strict_types=1);

namespace Loxya\Support;

use Illuminate\Support\Arr as ArrCore;

class Arr extends ArrCore
{
    /**
     * Permet de mapper sur un tableau tout en ayant accès aux clés de celui-ci.
     *
     * @param callable $callback Un callback qui sera appelé avec la clé et la valeur
     *                           et qui devra retourner une nouvelle valeur pour cette clé.
     * @param array    $array    Le tableau à mapper.
     *
     * @return array Un nouveau tableau dont les valeurs seront celles retournées par le callback.
     *               (Les clés, elles, resteront inchangées)
     */
    public static function mapKeys(callable $callback, array $array): array
    {
        $keys = array_keys($array);
        return array_combine($keys, array_map($callback, $keys, $array));
    }

    /**
     * Vérifie si au moins un élément du tableau satisfait le callback donné.
     *
     * @param array    $array    Le tableau à tester.
     * @param callable $callback Un callback recevant la valeur et la clé, qui doit retourner un booléen.
     *
     * @return bool `true` si au moins une valeur satisfait la condition, sinon `false`.
     */
    public static function some(array $array, callable $callback): bool
    {
        foreach ($array as $key => $value) {
            if ($callback($value, $key)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Vérifie si tous les éléments du tableau satisfont le callback donné.
     *
     * @param array    $array    Le tableau à tester.
     * @param callable $callback Un callback recevant la valeur et la clé, qui doit retourner un booléen.
     *
     * @return bool `true` si toutes les valeurs satisfont la condition, sinon `false`.
     */
    public static function every(array $array, callable $callback): bool
    {
        foreach ($array as $key => $value) {
            if (!$callback($value, $key)) {
                return false;
            }
        }
        return true;
    }

    /**
     * Permet de compléter un tableau avec des valeurs par défaut si celui-ci ne les contient pas.
     *
     * @example
     * ```php
     * $array = Arr:defaults($options, ['recursive' => false]);
     * // => Si `recursive` était défini dans `$options`, sa valeur sera conservée.
     * // => Si `recursive` n'était pas défini dans `$options`, sa valeur sera `false`.
     * ```
     *
     * @param array $array - Le tableau dans lequel on doit vérifier la présence des défauts.
     * @param array $defaults - Les valeurs par défaut.
     *
     * @return array Un nouveau tableau avec les valeurs par défaut si celles-ci n'était pas déjà définies.
     */
    public static function defaults(array $array, array $defaults): array
    {
        return array_replace($defaults, $array);
    }

    /**
     * Permet de compléter un tableau de manière récursive, avec des valeurs par défaut
     * si celui-ci ne les contient pas.
     *
     * @param array $defaults - Les valeurs par défaut.
     * @param array $array - Le tableau dans lequel on doit vérifier la présence des défauts.
     *
     * @return array Un nouveau tableau avec les valeurs par défaut si celles-ci n'était pas déjà définies.
     */
    public static function defaultsRecursive(array $defaults, array $array): array
    {
        $result = $defaults;
        foreach ($array as $key => $value) {
            if (
                isset($result[$key])
                && is_array($result[$key])
                && is_array($value)
                && !static::isList($value)
            ) {
                $result[$key] = static::defaultsRecursive($result[$key], $value);
            } else {
                $result[$key] = $value;
            }
        }
        return $result;
    }

    /**
     * Retourne un sous-ensemble d'un tableau en sélectionnant uniquement
     * les clés spécifiées, avec support de la dot notation.
     *
     * @param array        $array - Le tableau source
     * @param array|string $paths - La liste de clés / chemins à conserver.
     *
     * @return array Nouveau tableau ne contenant que les chemins demandés.
     */
    public static function only($array, $paths)
    {
        // - Sentinelle unique permettant de distinguer "clé absente"
        //   d'une clé présente mais contenant `null`.
        // phpcs:ignore SlevomatCodingStandard.Classes
        $sentinel = new class {};

        $result = [];
        foreach ((array) $paths as $path) {
            $value = static::get($array, $path, $sentinel);
            if ($value !== $sentinel) {
                Arr::set($result, $path, $value);
            }
        }

        return $result;
    }

    /**
     * Récupère un élément à partir d’un tableau en utilisant la dot notation,
     * en autorisant la présence d'un '?' dans les clés sources sans avoir
     * à spécifier ce '?' dans l'élément à récupérer.
     *
     * @param \ArrayAccess|array $array Le tableau source
     * @param string|int|null $key L'élément à récupérer, en utilisant la dot notation.
     * @param mixed $default La valeur à retourner si l'élément n'existe pas.
     *
     * @return mixed
     */
    public static function getOptional($array, $key, $default = null)
    {
        if (!static::accessible($array)) {
            return value($default);
        }

        if (is_null($key)) {
            return $array;
        }

        if (static::exists($array, $key)) {
            return $array[$key];
        }

        $keyWithMark = sprintf('%s?', $key);
        if (static::exists($array, $keyWithMark)) {
            return $array[$keyWithMark];
        }

        if (!str_contains($key, '.')) {
            return $array[$key] ?? $array[$keyWithMark] ?? value($default);
        }

        foreach (explode('.', $key) as $segment) {
            if (!static::accessible($array)) {
                return value($default);
            }

            $segmentWithMark = sprintf('%s?', $segment);
            if (static::exists($array, $segment)) {
                $array = $array[$segment];
            } elseif (static::exists($array, $segmentWithMark)) {
                $array = $array[$segmentWithMark];
            } else {
                return value($default);
            }
        }

        return $array;
    }
}
