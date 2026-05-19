<?php
declare(strict_types=1);

namespace Loxya\Tests\Fixtures;

use DI\Container;
use Illuminate\Container\Container as IlluminateContainer;
use Illuminate\Database\Connection;
use Loxya\Config\Config;
use Symfony\Component\Console\Color;

final class Fixtures
{
    /** @var array<string, int|null> */
    private static array $initialTables = [];

    public static function resetTestDatabase(): void
    {
        try {
            $connection = self::dropCreateTestDatabase();
            self::runMigrations($connection);
            self::loadData($connection);
            self::$initialTables = self::getAllTables($connection);
            static::output("\n");
            unset($connection);
        } catch (\PDOException $e) {
            self::outputCritical(vsprintf(
                "Oops ! PDO returned the following error:\n\n%s\n\nTrace:\n%s",
                [$e->getMessage(), $e->getTraceAsString()],
            ));
        } catch (\Throwable $e) {
            self::outputCritical(sprintf(
                "Oops ! Setting fixtures went wrong:\n\n%s",
                $e->getMessage(),
            ));
        }
    }

    public static function setupTestTransactions(Container $container): void
    {
        $transactionsManager = new TransactionsManager();

        $illuminateContainer = IlluminateContainer::getInstance();
        $illuminateContainer->instance('db.transactions', $transactionsManager);

        /** @var Connection $connection */
        $connection = $container->get('database')->getConnection();
        $connection->setTransactionManager($transactionsManager);

        $dispatcher = $connection->getEventDispatcher();
        $connection->unsetEventDispatcher();
        $connection->beginTransaction();
        $connection->setEventDispatcher($dispatcher);
    }

    public static function resetTestTransactions(Container $container): void
    {
        /** @var Connection $connection */
        $connection = $container->get('database')->getConnection();

        $dispatcher = $connection->getEventDispatcher();
        $connection->unsetEventDispatcher();
        $connection->rollBack();

        // - Reset the auto-increments
        $currentTables = self::getAllTables($connection->getPdo());
        foreach (self::$initialTables as $table => $expectedIncrement) {
            if ($expectedIncrement === null || ($currentTables[$table] ?? null) === $expectedIncrement) {
                continue;
            }

            $connection->unprepared(vsprintf(
                'ALTER TABLE `%s` AUTO_INCREMENT = %d',
                [$table, $expectedIncrement],
            ));
        }

        $connection->setEventDispatcher($dispatcher);
        $connection->disconnect();
    }

    // ------------------------------------------------------
    // -
    // -    Méthodes internes
    // -
    // ------------------------------------------------------

    private static function dropCreateTestDatabase(): \PDO
    {
        $dbConfig = Config::getDbConfig();

        static::output(sprintf("- Drop and re-create database `%s` ... ", $dbConfig['testDatabase']));

        $connection = Config::getPDO(withDatabase: false);
        $connection->exec(sprintf(
            'DROP DATABASE IF EXISTS `%1$s`; CREATE DATABASE `%1$s`; USE `%1$s`',
            $dbConfig['testDatabase'],
        ));

        static::output(sprintf("%s.\n", (new Color('green'))->apply("OK")));

        return $connection;
    }

    private static function runMigrations(\PDO $connection): void
    {
        $startTime = microtime(true);

        $args = ['--env=test'];
        $output = [];
        $resultCode = null;

        static::output("- Running migrations for tests ... ");

        $isVerbose = (env('SHELL_VERBOSITY') ?? 0) > 0;
        if (!$isVerbose) {
            $args[] = '--quiet';
        }

        exec(sprintf('SHELL_VERBOSITY=0 bin' . DS . 'console migrate %s', implode(' ', $args)), $output, $resultCode);
        $isSuccess = $resultCode === 0;

        if (!empty($output)) {
            static::output("\n\n" . implode("\n", $output) . "\n", stderr: !$isSuccess);
        }

        if ($isSuccess) {
            static::output(sprintf("%s.\n", (
                (new Color('green'))
                    ->apply(sprintf("OK (%s)", getExecutionTime($startTime)))
            )));
        } else {
            throw new \RuntimeException("Migrations error, see above for details.");
        }
    }

    /** @return array<string, int|null> */
    private static function getAllTables(\PDO $connection): array
    {
        $dbConfig = Config::getDbConfig();

        // - Désactive le cache des statistiques de `information_schema` (MySQL 8+ uniquement).
        try {
            $connection->query('SET SESSION information_schema_stats_expiry = 0');
        } catch (\PDOException) {
            // - Ignoré si la variable n'existe pas (MySQL 5.7).
        }

        // - Pour les auto-increments, on tente de récupérer l'information en même temps
        //   dans `information_schema.TABLES` mais il arrive que cela retourne `null`
        //   pour les tables avec auto-increment non initialisé, dans ce cas on regarde
        //   aussi dans les colonnes de la table via `information_schema.COLUMNS`.
        $query = $connection->query(sprintf(
            "SELECT
                `tables`.`TABLE_NAME`,
                CASE
                    WHEN `tables`.`AUTO_INCREMENT` IS NOT NULL THEN `tables`.`AUTO_INCREMENT`
                    WHEN EXISTS (
                        SELECT 1 FROM `information_schema`.`COLUMNS` AS `columns`
                        WHERE `columns`.`TABLE_SCHEMA` = `tables`.`TABLE_SCHEMA`
                        AND `columns`.`TABLE_NAME` = `tables`.`TABLE_NAME`
                        AND `columns`.`EXTRA` LIKE '%%auto_increment%%'
                    ) THEN 1
                    ELSE NULL
                END AS `AUTO_INCREMENT`
            FROM `information_schema`.`TABLES` AS `tables`
            WHERE `tables`.`TABLE_SCHEMA` = '%s' AND `tables`.`TABLE_NAME` != 'phinxlog';",
            $dbConfig['testDatabase'],
        ));

        return array_map(
            static fn ($increment) => $increment !== null ? (int) $increment : null,
            $query->fetchAll(\PDO::FETCH_KEY_PAIR),
        );
    }

    private static function loadData(\PDO $connection): void
    {
        $startTime = microtime(true);

        static::output("- Seeding database ... ");

        $tables = self::getAllTables($connection);
        if (empty($tables)) {
            throw new \InvalidArgumentException("No table found to seed.");
        }

        $dataseed = new Dataseed();
        foreach (array_keys($tables) as $table) {
            $dataseed->set($table);
        }
        $connection->exec($dataseed->getFinalQuery());

        static::output(sprintf("%s.\n", (
            (new Color('green'))
                ->apply(sprintf("OK (%s)", getExecutionTime($startTime)))
        )));
    }

    private static function output(string $msg, bool $stderr = false): void
    {
        fwrite($stderr ? STDERR : STDOUT, $msg);
    }

    private static function outputCritical(string $msg): void
    {
        fwrite(STDERR, sprintf("\n\n%s\n\n", (new Color('red'))->apply($msg)));
        exit(1);
    }
}
