<?php
declare(strict_types=1);

use Loxya\Config\Config;
use Loxya\Console\Command;
use Loxya\Services;
use Loxya\Support\Install;
use Odan\Session\FlashInterface;
use Odan\Session\MemorySession;
use Odan\Session\PhpSession;
use Odan\Session\SessionInterface;
use Odan\Session\SessionManagerInterface;
use Psr\Container\ContainerInterface;

return [
    'logger' => static function () {
        $settings = Config::get('logger', []);
        return new Services\Logger($settings);
    },

    'auth' => static function (ContainerInterface $container) {
        $authenticators = $container->get('auth.authenticators');
        return new Services\Auth($authenticators);
    },

    'events' => static fn (ContainerInterface $container) => (
        new Services\Dispatcher($container)
    ),

    'session' => static function () {
        $shouldSecureCookie = Config::isSslEnabled();
        $sessionClass = Config::getEnv() !== 'test'
            ? PhpSession::class
            : MemorySession::class;

        return new $sessionClass([
            'name' => 'LOXYA_SESSION',
            'lifetime' => 0,
            'path' => '/',
            'httponly' => true,
            'secure' => $shouldSecureCookie,
            'cache_limiter' => 'nocache',

            // - Note: Permet la création de cookies lorsque Loxya est
            //   intégré dans des systèmes tiers (e.g. Notion).
            'cookie_samesite' => $shouldSecureCookie ? 'None' : 'Lax',
        ]);
    },

    'auth.authenticators' => static function (ContainerInterface $container) {
        $authenticators = [
            $container->get(Services\Auth\JWT::class),
        ];

        if (Config::getEnv() === 'test') {
            $authenticators[] = $container->get(Services\Auth\Test::class);
        }

        return $authenticators;
    },

    'flash' => static fn (ContainerInterface $container) => (
        $container->get(SessionInterface::class)->getFlash()
    ),

    'console.commands' => static function (ContainerInterface $container) {
        $isTest = Config::getEnv() === 'test';
        $isDev = Config::getEnv() === 'development';
        $isConfigured = Install::isConfigured() || $isTest;
        $isInstallComplete = Install::isComplete() || $isTest;

        $allCommands = [
            Command\Setup\InstallCommand::class => true,
            Command\Cleanup\CacheCommand::class => $isConfigured,
            Command\Cleanup\DataCommand::class => $isInstallComplete,
            Command\Migrations\MigrateCommand::class => $isConfigured,
            Command\Migrations\StatusCommand::class => $isConfigured,
            Command\Migrations\RollbackCommand::class => $isInstallComplete,
            Command\Migrations\CreateCommand::class => $isDev && $isConfigured,
            Command\Test\EmailCommand::class => $isInstallComplete,
        ];

        $commands = [];
        foreach ($allCommands as $class => $enabled) {
            if ($enabled) {
                $commands[] = $container->get($class);
            }
        }

        return $commands;
    },

    //
    // - Aliases
    //

    'i18n' => DI\get(Services\I18n::class),
    'view' => DI\get(Services\View::class),
    'mailer' => DI\get(Services\Mailer::class),
    'cache' => DI\get(Services\Cache::class),
    'httpCache' => DI\get(\Slim\HttpCache\CacheProvider::class),

    Services\Auth::class => DI\get('auth'),
    Services\Logger::class => DI\get('logger'),
    Services\Dispatcher::class => DI\get('events'),
    SessionManagerInterface::class => DI\get('session'),
    SessionInterface::class => DI\get('session'),
    FlashInterface::class => DI\get('flash'),
];
