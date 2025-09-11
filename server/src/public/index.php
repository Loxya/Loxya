<?php
declare(strict_types=1);

use Dotenv\Dotenv;
use Loxya\App;
use Slim\HttpCache\Cache as HttpCache;

require __DIR__ . '/../../vendors/autoload.php';
require __DIR__ . '/../App/Config/constants.php';
require __DIR__ . '/../App/Config/functions.php';

// - Chargement de l'environnement.
$dotenv = Dotenv::createImmutable(ROOT_FOLDER);
$dotenv->safeLoad();

// - Timezone customisée.
$tz = env('TIMEZONE', env('TZ'));
if ($tz !== null) {
    date_default_timezone_set($tz);
}

// - Let's go !
$app = new App();
$app->add(new HttpCache('private', 0));
$app->run();
