<?php
declare(strict_types=1);

namespace Loxya\Support;

use Loxya\Config\Config;
use Loxya\Console\App as CliApp;
use Symfony\Component\Console\Input\ArrayInput;
use Symfony\Component\Console\Output\StreamOutput;

final class Install
{
    protected const INSTALL_FILE = CONFIG_FOLDER . '/install.json';

    // - Voir dans `SetupController` pour les étapes d'exécution.
    public const INSTALL_STEPS = [
        'welcome',
        'coreSettings',
        'settings',
        'company',
        'database',
        'dbStructure',
        'adminUser',
        'categories',
        'end',
    ];

    public const MIN_PHP_VERSION = '8.1';
    public const MAX_PHP_VERSION = '8.3';

    public const REQUIRED_EXTENSIONS = [
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

    protected const VALUE_TYPES = [
        'enableCORS' => 'boolean',
        'displayErrorDetails' => 'boolean',
        'useRouterCache' => 'boolean',
        'sessionExpireHours' => 'integer',
        'maxItemsPerPage' => 'integer',
    ];

    protected const LEGACY_DATA = [
        'defaultTags',
        'companyData.vatRate',
        'degressiveRateFunction',
    ];

    public static function getStep(): string
    {
        $installData = static::_getInstallData();
        return $installData['step'] ?? 'welcome';
    }

    public static function setInstallProgress(string $step, ?array $stepData = null): array
    {
        if (!in_array($step, self::INSTALL_STEPS, true)) {
            throw new \InvalidArgumentException(sprintf('Unknown step: %s', $step));
        }

        $installData = static::_getInstallData();

        if ($stepData === null) {
            $installData['step'] = $step;
            $installData['data'][$step] = [];

            return static::_saveInstallData($installData);
        }

        $stepIndex = array_search($step, self::INSTALL_STEPS, true);
        $nextStep = self::INSTALL_STEPS[$stepIndex + 1] ?? 'end';

        foreach ($stepData as $key => $value) {
            $keyType = self::VALUE_TYPES[$key] ?? null;
            if ($keyType === 'boolean') {
                $stepData[$key] = (bool) $value;
            }
            if ($keyType === 'integer') {
                $stepData[$key] = (int) $value;
            }
            if ($keyType === 'float') {
                $stepData[$key] = (float) $value;
            }
        }

        $installData['step'] = $nextStep;
        $installData['data'][$step] = $stepData;

        return static::_saveInstallData($installData);
    }

    public static function getSettingsFromInstallData(): array
    {
        $installData = static::_getInstallData();

        $settings = array_merge(
            $installData['data']['coreSettings'],
            $installData['data']['settings'],
        );
        $settings['db'] = $installData['data']['database'];
        $settings['companyData'] = $installData['data']['company'];

        // - Legacy data.
        foreach (static::LEGACY_DATA as $legacyField) {
            if (!Config::has($legacyField)) {
                continue;
            }

            Arr::set(
                $settings,
                sprintf('legacy.%s', $legacyField),
                Config::get($legacyField),
            );
        }

        return $settings;
    }

    public static function getMigrationsStatus(): array
    {
        $output = self::_executePhinxCommand('status');
        return self::_formatPhinxStatusOutput($output);
    }

    public static function migrateDatabase(): array
    {
        return self::_executePhinxCommand('migrate');
    }

    public static function getAllCurrencies(): array
    {
        // @phpstan-ignore-next-line include.fileNotFound
        return require MIGRATIONS_FOLDER . DS . 'data' . DS . 'currencies.php';
    }

    public static function getAllCountries(): array
    {
        // @phpstan-ignore-next-line include.fileNotFound
        return require MIGRATIONS_FOLDER . DS . 'data' . DS . 'countries.php';
    }

    // ------------------------------------------------------
    // -
    // -    Méthodes internes
    // -
    // ------------------------------------------------------

    protected static function _getInstallData(): array
    {
        $defaultInstallData = ['step' => null, 'data' => []];

        if (!file_exists(self::INSTALL_FILE)) {
            return $defaultInstallData;
        }

        $rawInstallData = json_decode(@file_get_contents(self::INSTALL_FILE), true);
        if (!is_array($rawInstallData)) {
            return $defaultInstallData;
        }

        $installData = Arr::defaults(
            Arr::only($rawInstallData, ['step', 'data']),
            $defaultInstallData,
        );

        // - Rétro-compatibilité.
        foreach (static::INSTALL_STEPS as $step) {
            if (array_key_exists($step, $installData['data'])) {
                continue;
            }

            $stepLegacyKey = sprintf('config_%s', $step);
            if (!array_key_exists($stepLegacyKey, $rawInstallData)) {
                continue;
            }
            $installData['data'][$step] = $rawInstallData[$stepLegacyKey];
        }

        return $installData;
    }

    protected static function _saveInstallData(array $installData): array
    {
        $installDataAsJson = json_encode($installData, Config::JSON_OPTIONS);
        if (!file_put_contents(self::INSTALL_FILE, $installDataAsJson)) {
            throw new \RuntimeException(
                "Unable to write JSON install data file. Check write access to configuration folder.",
            );
        }
        return $installData;
    }

    protected static function _executePhinxCommand(string $command): array
    {
        if (!in_array($command, ['status', 'migrate', 'rollback'], true)) {
            throw new \InvalidArgumentException("Unknown migration command.", 2);
        }

        // - Permet l'exécution des longues migrations.
        set_time_limit(3600);

        $stream = fopen('php://temp', 'w+');
        $exitCode = (new CliApp())->doRun(
            new ArrayInput([sprintf('migrations:%s', $command)]),
            new StreamOutput($stream),
        );
        $output = stream_get_contents($stream, -1, 0);
        fclose($stream);

        if (!in_array($exitCode, [0, 3], true)) {
            throw new \RuntimeException($output, $exitCode);
        }

        return explode(PHP_EOL, $output);
    }

    protected static function _formatPhinxStatusOutput($output)
    {
        $start = array_search(str_repeat('-', 82), $output, true);
        $lines = array_splice($output, $start + 1);

        $status = [];
        foreach ($lines as $line) {
            if ($line === '') {
                continue;
            }
            $infos = array_filter(array_map('trim', explode('  ', trim($line))));

            $status[] = [
                'table' => end($infos),
                'state' => $infos[0],
            ];
        }

        return $status;
    }
}
