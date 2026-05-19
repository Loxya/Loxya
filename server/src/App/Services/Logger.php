<?php
declare(strict_types=1);

namespace Loxya\Services;

use Loxya\Support\Str;
use Monolog\Formatter\LineFormatter;
use Monolog\Handler;
use Monolog\Level;
use Psr\Log\LoggerTrait;

final class Logger
{
    use LoggerTrait;

    private \Monolog\Logger $globalLogger;

    private $settings = [
        /**
         * Le niveau de log à utiliser, sachant que tous les niveaux
         * au-dessus de la valeur choisie seront inclus.
         *
         * Valeurs possibles :
         * - 100: DEBUG
         * - 200: INFO
         * - 250: NOTICE
         * - 300: WARNING
         * - 400: ERROR
         * - 500: CRITICAL
         * - 550: ALERT
         * - 600: EMERGENCY
         */
        'level' => Level::Notice,

        /**
         * Les fichiers de logs subissant une rotation quotidienne, le nombre
         * maximal de fichiers (et donc de jours) de logs à conserver.
         */
        'max_files' => 5,
    ];

    /**
     * Constructeur.
     *
     * @param array $settings La configuration du logger.
     */
    public function __construct(array $settings = [])
    {
        $this->settings = array_replace($this->settings, $settings);

        if (
            is_string($this->settings['level']) &&
            !in_array(strtoupper($this->settings['level']), Level::NAMES, true)
        ) {
            $this->settings['level'] = Level::Notice;
        }

        $this->globalLogger = $this->createLogger('app');
    }

    // ------------------------------------------------------
    // -
    // -    Méthodes publiques
    // -
    // ------------------------------------------------------

    /**
     * Permet de créer un logger.
     *
     * @param string $name Le nom (unique) du logger.
     *
     * @return \Monolog\Logger Une instance du logger tout juste créé.
     */
    public function createLogger(string $name): \Monolog\Logger
    {
        $logger = new \Monolog\Logger($name);
        $logger->setTimezone(new \DateTimeZone(date_default_timezone_get()));

        // - Handler
        $path = LOGS_FOLDER . DS . Str::slugify($name) . '.log';
        $handler = new Handler\RotatingFileHandler(
            $path,
            $this->settings['max_files'],
            $this->settings['level'],
        );
        $handler->setFormatter(new LineFormatter(null, null, true, true));
        $logger->pushHandler($handler);

        return $logger;
    }

    /**
     * Ajoute un message de log.
     *
     * @param int $level Le niveau de log.
     * @param string $message Le message à logger.
     * @param array $context Le contexte du log (si utile).
     */
    public function log($level, $message, array $context = []): void
    {
        $this->globalLogger->log($level, $message, $context);
    }
}
