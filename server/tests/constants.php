<?php
declare(strict_types=1);

define('TEST', true);

//
// - Chemins spécifiques aux tests.
//

define('TESTS_FOLDER', dirname(__FILE__));

define('TESTS_FIXTURES_FOLDER', TESTS_FOLDER . DS . 'fixtures');

define('TESTS_FILES_FOLDER', TESTS_FIXTURES_FOLDER . DS . 'files');

define('TESTS_SNAPSHOTS_FOLDER', TESTS_FIXTURES_FOLDER . DS . 'snapshots');

//
// - Chemins core.
//

define('ROOT_FOLDER', dirname(dirname(__FILE__)));

define('VAR_FOLDER', ROOT_FOLDER . DS . 'src' . DS . 'var');

define('CACHE_FOLDER', VAR_FOLDER . DS . 'cache' . DS . 'tests');

define('TMP_FOLDER', VAR_FOLDER . DS . 'tmp' . DS . 'tests');

define('LOGS_FOLDER', VAR_FOLDER . DS . 'logs' . DS . 'tests');

define('DATA_FOLDER', TESTS_FILES_FOLDER);
