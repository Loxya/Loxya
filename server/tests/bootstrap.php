<?php
declare(strict_types=1);

date_default_timezone_set('UTC');

require_once __DIR__ . '/../vendors/autoload.php';
require_once __DIR__ . '/constants.php';
require_once __DIR__ . '/../src/App/Config/constants.php';
require_once __DIR__ . '/../src/App/Config/functions.php';

use Dotenv\Dotenv;

// - Chargement de l'environnement.
$dotenv = Dotenv::createImmutable(ROOT_FOLDER, ['.env', '.env.test'], false);
$dotenv->safeLoad();
