<?php
declare(strict_types=1);

namespace Loxya\Support;

use Loxya\Config\Config;

final class Install
{
    public const MIN_PHP_VERSION = '8.1';
    public const MAX_PHP_VERSION = '8.3';

    public const REQUIRED_PHP_EXTENSIONS = [
        'bcmath',
        'curl',
        'dom',
        'fileinfo',
        'gettext',
        'iconv',
        'intl',
        'json',
        'mbstring',
        'pcre',
        'PDO',
        'pdo_mysql',
        'openssl',
        'xml',
    ];

    /**
     * Indique si l'application a été configurée (base de données, etc) ou non.
     *
     * @return bool `true` si l'application a été configurée, `false` sinon.
     */
    public static function isConfigured(): bool
    {
        return Config::customConfigExists();
    }

    /**
     * Indique si l'installation de l'application est complète ou non.
     *
     * @return bool `true` si l'installation est complète, `false` sinon.
     */
    public static function isComplete(): bool
    {
        return static::isConfigured();
    }

    /**
     * Récupère les informations concernant la version et les
     * extensions PHP requises pour l'installation de l'application.
     *
     * @return array{
     *     isValid: bool,
     *     version: array{
     *         current: string,
     *         min: string,
     *         max: string,
     *         isValid: bool,
     *         isBelowMin: bool,
     *         isAboveMax: bool
     *     },
     *     extensions: array{
     *         current: string[],
     *         required: string[],
     *         missing: string[],
     *         isValid: bool
     *     }
     * } Les contraintes et l'état de conformité du système PHP.
     */
    public static function getPhpConstraintData(): array
    {
        $phpVersion = PHP_VERSION;
        if (str_contains(PHP_VERSION, '+')) {
            $phpVersion = substr(PHP_VERSION, 0, strpos(PHP_VERSION, '+'));
        }

        $isVersionBelowMin = version_compare(PHP_VERSION, Install::MIN_PHP_VERSION, '<');
        $isVersionAboveMax = version_compare(
            // - Réduit la version de PHP courante à la même précision que la contrainte max.
            //   (e.g. Version de PHP : `8.3.4` / Contrainte : `8.4` => `8.3`)
            implode('.', array_slice(
                explode('.', $phpVersion),
                0,
                count(explode('.', Install::MAX_PHP_VERSION)),
            )),
            Install::MAX_PHP_VERSION,
            '>',
        );

        // - Extensions.
        $loadedExtensions = get_loaded_extensions();
        $requiredExtensions = Install::REQUIRED_PHP_EXTENSIONS;
        $missingExtensions = array_diff($requiredExtensions, $loadedExtensions);

        // - L'installation respecte-t-elle les contraintes liées à PHP ?
        $isValid = !$isVersionBelowMin && !$isVersionAboveMax && empty($missingExtensions);

        return [
            'isValid' => $isValid,
            'version' => [
                'current' => $phpVersion,
                'min' => Install::MIN_PHP_VERSION,
                'max' => Install::MAX_PHP_VERSION,

                // - Checks.
                'isValid' => !$isVersionBelowMin && !$isVersionAboveMax,
                'isBelowMin' => $isVersionBelowMin,
                'isAboveMax' => $isVersionAboveMax,
            ],
            'extensions' => [
                'current' => $loadedExtensions,
                'required' => $requiredExtensions,
                'missing' => $missingExtensions,

                // - Checks
                'isValid' => empty($missingExtensions),
            ],
        ];
    }
}
