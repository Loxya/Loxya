<?php
declare(strict_types=1);

date_default_timezone_set('UTC');

require_once __DIR__ . '/../vendors/autoload.php';
require_once __DIR__ . '/constants.php';
require_once __DIR__ . '/../src/App/Config/constants.php';
require_once __DIR__ . '/../src/App/Config/functions.php';

use Dotenv\Dotenv;
use Loxya\Kernel;
use Loxya\Tests\Fixtures;

// - Chargement de l'environnement.
$dotenv = Dotenv::createImmutable(ROOT_FOLDER, ['.env', '.env.test'], false);
$dotenv->safeLoad();

$echoError = static function (string $msg): void {
    echo sprintf("\n\033[1;31m%s\033[0m\n\n", $msg);
    exit(1);
};

try {
    Fixtures\Fixtures::resetTestDatabase();
} catch (PDOException $e) {
    $echoError(
        "Oops ! PDO returned the following error: "
        . $e->getMessage()
        . "\nTrace:\n\n"
        . $e->getTraceAsString(),
    );
} catch (\Throwable $e) {
    $echoError("Oops ! Setting fixtures went wrong: " . $e->getMessage());
}

Kernel::boot();
