<?php
declare(strict_types=1);

use Symfony\Component\Yaml\Yaml;

$common = Yaml::parseFile(__DIR__ . '/common.yml');
$date = Yaml::parseFile(__DIR__ . '/date.yml');
$install = Yaml::parseFile(__DIR__ . '/install.yml');
$validation = Yaml::parseFile(__DIR__ . '/validation.yml');
$emails = Yaml::parseFile(__DIR__ . '/emails.yml');
$flash = Yaml::parseFile(__DIR__ . '/flash.yml');

return array_merge(
    $common,
    $date,
    $install,
    $validation,
    $emails,
    compact(
        'flash',
    ),
);
