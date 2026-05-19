<?php
declare(strict_types=1);

use Symfony\Component\Yaml\Yaml;

$common = Yaml::parseFile(__DIR__ . '/common.yml');
$date = Yaml::parseFile(__DIR__ . '/date.yml');
$legals = Yaml::parseFile(__DIR__ . '/legals.yml');
$validation = Yaml::parseFile(__DIR__ . '/validation.yml');
$console = Yaml::parseFile(__DIR__ . '/console.yml');
$emails = Yaml::parseFile(__DIR__ . '/emails.yml');
$flash = Yaml::parseFile(__DIR__ . '/flash.yml');
$errors = Yaml::parseFile(__DIR__ . '/errors.yml');

return array_merge(
    $common,
    $date,
    $validation,
    $emails,
    compact(
        'errors',
        'flash',
        'legals',
        'console',
    ),
);
