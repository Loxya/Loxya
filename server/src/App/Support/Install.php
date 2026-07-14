<?php
declare(strict_types=1);

namespace Loxya\Support;

use Illuminate\Database\Connection;
use Illuminate\Database\QueryException;
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
     * Indique si l'application nécessite une mise à jour :
     * - Soit la configuration n'est plus au format de la version courante,
     * - Soit des migrations de la base de données restent à appliquer.
     *
     * @return bool `true` si une mise à jour est requise, `false` sinon.
     */
    public static function isOutdated(): bool
    {
        return Config::isOutdated() || static::hasPendingMigrations();
    }

    /**
     * Indique si l'installation de l'application est complète.
     *
     * @return bool `true` si l'installation est complète, `false` sinon.
     */
    public static function isComplete(): bool
    {
        return static::isConfigured() && !static::isOutdated();
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

    /**
     * Indique si des migrations de la base de données restent à appliquer.
     *
     * @return bool `true` s'il existe des migrations non appliquées, `false` sinon.
     */
    private static function hasPendingMigrations(): bool
    {
        if (!static::isConfigured()) {
            return false;
        }

        // - Si cette version de l'application est déjà marquée
        //   comme migrée, on ne va pas plus loin.
        $cache = container('cache');
        $useCache = Config::getEnv() === 'production';
        $cacheEntry = $cache->getItem(sprintf('migrations.up-to-date.%s', Config::getVersionNumber()));
        if ($useCache && $cacheEntry->isHit()) {
            return false;
        }

        // - Récupère les migrations disponibles.
        $available = [];
        foreach (glob(MIGRATIONS_FOLDER . DS . '*.php') ?: [] as $file) {
            if (preg_match('/^(\d+)/', basename($file), $matches)) {
                $available[] = $matches[1];
            }
        }
        if (empty($available)) {
            return false;
        }

        try {
            /** @var Connection $dbConnection */
            $dbConnection = container('database')->getConnection();
            $applied = $dbConnection
                ->table('phinxlog')
                ->pluck('version')
                ->all();
        } catch (QueryException $e) {
            // - Si la table Phinx est absente (`42S02`) => Migrations en attente.
            return $e->getCode() === '42S02';
        }

        // - Une migration est en attente si elle est disponible mais absente des logs.
        $isUpToDate = array_diff($available, $applied) === [];
        if ($isUpToDate && $useCache) {
            $cache->save($cacheEntry->set(true));
        }
        return !$isUpToDate;
    }
}
