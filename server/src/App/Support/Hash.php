<?php
declare(strict_types=1);

namespace Loxya\Support;

final class Hash
{
    /**
     * Génère un hachage à partir d'une valeur donnée.
     *
     * @param mixed $value La valeur à hacher.
     *
     * @return string Le hash généré.
     *
     * @throws \RuntimeException Si Bcrypt n'est pas supporté.
     */
    public static function make(#[\SensitiveParameter] $value): string
    {
        try {
            $hash = password_hash($value, PASSWORD_BCRYPT, ['cost' => 12]);
        } catch (\Error) {
            throw new \RuntimeException('Bcrypt hashing not supported.');
        }
        return $hash;
    }

    /**
     * Vérifie si une valeur donnée est "hachée".
     *
     * @param string $value La valeur à vérifier.
     *
     * @return bool `true` si la valeur est un hachage valide, sinon `false`.
     */
    public static function isHashed(#[\SensitiveParameter] string $value): bool
    {
        return self::info($value)['algo'] === PASSWORD_BCRYPT;
    }

    /**
     * Retourne des informations sur un hachage donné.
     *
     * @param string $hashedValue Le hachage dont on veut obtenir les informations.
     *
     * @return array Un tableau contenant des informations sur l'algorithme
     *               de hachage utilisé et ses options.
     */
    public static function info(string $hashedValue): array
    {
        return password_get_info($hashedValue);
    }

    /**
     * Vérifie si une valeur correspond à un hachage donné.
     *
     * @param string $value La valeur en clair à vérifier.
     * @param string|null $hashedValue Le hachage contre lequel vérifier la valeur.
     *
     * @return bool `true` si la valeur correspond au hachage, sinon `false`.
     */
    public static function check(#[\SensitiveParameter] string $value, ?string $hashedValue): bool
    {
        if (is_null($hashedValue) || strlen($hashedValue) === 0) {
            return false;
        }
        return password_verify($value, $hashedValue);
    }
}
