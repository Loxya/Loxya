<?php
declare(strict_types=1);

namespace Loxya\Tests\Fixtures;

use Ifsnop\Mysqldump as IMysqldump;
use Loxya\Config\Config;

final class Fixtures
{
    protected const DATA_DUMP_FILE = TMP_FOLDER . DS . 'data.sql';
    protected const SCHEMA_DUMP_FILE = TMP_FOLDER . DS . 'schema.sql';

    protected static $alreadyCreated = false;

    public static function getConnection(bool $withDatabase = true): \PDO
    {
        return Config::getPDO(withDatabase: $withDatabase);
    }

    public static function resetTestDatabase(): void
    {
        self::dropCreateTestDatabase();
        self::runMigrations();

        self::dumpTestSchema();
        self::dumpTestData();
    }

    public static function dropCreateTestDatabase(): void
    {
        $dbConfig = Config::getDbConfig();

        static::_log(sprintf("Drop and re-create database `%s`...", $dbConfig['testDatabase']));

        $sqlRecreate = sprintf(
            'DROP DATABASE IF EXISTS `%1$s`; CREATE DATABASE `%1$s`;',
            $dbConfig['testDatabase'],
        );

        $pdo = self::getConnection(withDatabase: false);
        $pdo->prepare($sqlRecreate)->execute();
        unset($pdo);

        static::_log("\nOK.\n\n");
    }

    public static function runMigrations(): void
    {
        $args = ['--env=test'];
        $output = [];

        $isVerbose = (env('SHELL_VERBOSITY') ?? 0) > 0;
        if (!$isVerbose) {
            $args[] = '--quiet';
        }

        exec(sprintf('SHELL_VERBOSITY=0 bin' . DS . 'console migrate %s', implode(' ', $args)), $output);

        $hasOutput = !empty($output);
        static::_log("Running migrations for tests...\n", $hasOutput);
        static::_log(implode("\n", $output) . "\n\n", $hasOutput);
    }

    public static function getAllTables(): array
    {
        $dbConfig = Config::getDbConfig();

        $query = sprintf("
            SELECT `TABLE_NAME` FROM `information_schema`.`TABLES`
            WHERE `TABLE_SCHEMA` = '%s' AND `TABLE_NAME` != 'phinxlog';
        ", $dbConfig['testDatabase']);

        $pdo = self::getConnection();
        $stmt = $pdo->prepare($query);
        $stmt->execute();
        unset($pdo);

        return $stmt->fetchAll(\PDO::FETCH_COLUMN);
    }

    public static function dumpTestSchema(): void
    {
        if (!is_dir(dirname(self::DATA_DUMP_FILE))) {
            mkdir(dirname(self::DATA_DUMP_FILE), 0755, true);
            static::_log("Temporary dump directory created.\n");
        }

        $dbConfig = Config::getDbConfig(['noCharset' => true]);
        static::_log(sprintf("Dumping test database `%s`...\n", $dbConfig['testDatabase']));

        $dump = new IMysqldump\Mysqldump(
            $dbConfig['dsn'],
            $dbConfig['username'],
            $dbConfig['password'],
            [
                'add-drop-table' => true,
                'skip-comments' => true,
                'no-data' => true,
                'reset-auto-increment' => true,
            ],
        );

        $dumpFile = self::SCHEMA_DUMP_FILE;
        $dump->start($dumpFile);

        $dumpContent = sprintf("USE `%s`;\n", $dbConfig['testDatabase']);
        $dumpContent .= file_get_contents($dumpFile) . "\n\n";

        $prefixedTable = sprintf('CREATE TABLE `%s`.', $dbConfig['testDatabase']);
        $dumpContent = str_replace('CREATE TABLE ', $prefixedTable, $dumpContent);

        file_put_contents($dumpFile, $dumpContent);

        static::_log("OK.\n\n");
    }

    public static function dumpTestData(): void
    {
        $startTime = microtime(true);

        $tables = self::getAllTables();
        if (empty($tables)) {
            throw new \InvalidArgumentException("No table found to seed.");
        }

        static::_log("Creating data SQL dump...\n");

        $dataseed = new Dataseed();
        foreach ($tables as $table) {
            $dataseed->set($table);
        }

        file_put_contents(self::DATA_DUMP_FILE, $dataseed->getFinalQuery());

        static::_log(sprintf("OK, done in %s.\n\n", getExecutionTime($startTime)));
    }

    public static function resetDataWithDump(): void
    {
        try {
            $pdo = self::getConnection();

            if (!static::$alreadyCreated) {
                $querySchema = file_get_contents(self::SCHEMA_DUMP_FILE);
                $pdo->prepare($querySchema)->execute();
                static::$alreadyCreated = true;
            }

            $queryData = file_get_contents(self::DATA_DUMP_FILE);
            $pdo->prepare($queryData)->execute();
            unset($pdo);
        } catch (\Throwable $e) {
            echo "\033[91m\n\nThere is an SQL error in fixtures data.\n";
            echo "Please check `src/var/tmp/tests/data.sql` and all seed files you have modified.\n";
            echo "Here is the detailed SQL error message:\n\n";
            echo $e->getMessage();
            echo "\033[0m\n\n";
            exit(1);
        }
    }

    protected static function _log(string $msg, bool $force = false): void
    {
        $isVerbose = (env('SHELL_VERBOSITY') ?? 0) > 0;
        if ($isVerbose || $force) {
            echo $msg;
        }
    }
}
