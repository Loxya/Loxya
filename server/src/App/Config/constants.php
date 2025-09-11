<?php
declare(strict_types=1);

//
// - Paths
//

if (!defined('DS')) {
    define('DS', DIRECTORY_SEPARATOR);
}

if (!defined('ROOT_FOLDER')) {
    define('ROOT_FOLDER', dirname(dirname(dirname(__DIR__))));
}

if (!defined('DATA_FOLDER')) {
    define('DATA_FOLDER', ROOT_FOLDER . DS . 'data');
}

if (!defined('SRC_FOLDER')) {
    define('SRC_FOLDER', ROOT_FOLDER . DS . 'src');
}

if (!defined('LOCALES_FOLDER')) {
    define('LOCALES_FOLDER', SRC_FOLDER . DS . 'locales');
}

if (!defined('MIGRATIONS_FOLDER')) {
    define('MIGRATIONS_FOLDER', SRC_FOLDER . DS . 'migrations');
}

if (!defined('PUBLIC_FOLDER')) {
    define('PUBLIC_FOLDER', SRC_FOLDER . DS . 'public');
}

if (!defined('VAR_FOLDER')) {
    define('VAR_FOLDER', SRC_FOLDER . DS . 'var');
}

if (!defined('CACHE_FOLDER')) {
    define('CACHE_FOLDER', VAR_FOLDER . DS . 'cache');
}

if (!defined('TMP_FOLDER')) {
    define('TMP_FOLDER', VAR_FOLDER . DS . 'tmp');
}

if (!defined('LOGS_FOLDER')) {
    define('LOGS_FOLDER', VAR_FOLDER . DS . 'logs');
}

if (!defined('VIEWS_FOLDER')) {
    define('VIEWS_FOLDER', SRC_FOLDER . DS . 'views');
}

if (!defined('APP_FOLDER')) {
    define('APP_FOLDER', SRC_FOLDER . DS . 'App');
}

if (!defined('CONFIG_FOLDER')) {
    define('CONFIG_FOLDER', APP_FOLDER . DS . 'Config');
}

if (!defined('LISTENERS_FOLDER')) {
    define('LISTENERS_FOLDER', APP_FOLDER . DS . 'Listeners');
}
