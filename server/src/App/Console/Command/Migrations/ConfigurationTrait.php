<?php
declare(strict_types=1);

namespace Loxya\Console\Command\Migrations;

use Loxya\Config\Config;
use Phinx\Config\Config as PhinxConfig;
use Phinx\Config\ConfigInterface;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;

trait ConfigurationTrait
{
    public function getConfig(): ConfigInterface
    {
        if (!$this->config) {
            $dbConfig = Config::getDbConfig();
            $env = Config::getEnv();
            $pdo = Config::getPDO();

            $this->config = new PhinxConfig([
                'paths' => [
                    'migrations' => MIGRATIONS_FOLDER,
                    'seeds' => MIGRATIONS_FOLDER . DS . 'seeds',
                ],
                'environments' => [
                    'default_environment' => $env,
                    $env => [
                        'table_prefix' => $dbConfig['prefix'],
                        'name' => $dbConfig['database'],
                        'connection' => $pdo,
                        'charset' => $dbConfig['charset'],
                        'collation' => $dbConfig['collation'],
                    ],
                ],
                'feature_flags' => [
                    // - Utilise le type `datetime` pour les champs
                    //   créés via `addTimestamps()`.
                    'add_timestamps_use_datetime' => true,
                ],
            ]);
        }
        return $this->config;
    }

    public function hasConfig(): bool
    {
        return true;
    }

    // phpcs:ignore SlevomatCodingStandard.TypeHints.ReturnTypeHint.MissingNativeTypeHint
    public function setConfig(ConfigInterface $config)
    {
        throw new \Exception('Not implemented.');
    }

    // ------------------------------------------------------
    // -
    // -    Méthodes internes
    // -
    // ------------------------------------------------------

    abstract protected function configure(): void;

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        // - Phinx utilise `environment` plutôt que `env`, donc on ajoute l'alias artificiellement.
        $this->addOption('environment', null, InputOption::VALUE_REQUIRED, '', Config::getEnv());

        return parent::execute($input, $output);
    }

    protected function getMigrationTemplateFilename(string $style): string
    {
        return __DIR__ . '/templates/Migration.php.template';
    }

    protected function getSeedTemplateFilename(): string
    {
        return __DIR__ . '/templates/Seed.php.template';
    }
}
