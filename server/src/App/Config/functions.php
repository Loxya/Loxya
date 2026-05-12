<?php
declare(strict_types=1);

use DI\Container;
use Illuminate\Database\Eloquent\Builder;
use Loxya\Config\Config;
use Loxya\Config\Enums\Feature;
use Loxya\Kernel;
use Monolog\Level as LogLevel;
use Slim\Interfaces\RouteParserInterface;

/**
 * Retourne le conteneur courant ou le service lié à l'id dans le conteneur si fourni.
 *
 * NOTE: À n'utiliser que dans les cas ou l'auto-wiring n'est pas disponible.
 *
 * @param string $id (optional) Un éventuel identifiant de service à retourner.
 *
 * @return mixed Le conteneur lui-même si aucun identifiant n'est passé, le service lié à l'id sinon.
 */
function container(?string $id = null): mixed
{
    /** @var Container $container */
    $container = Kernel::get()->getContainer();
    return $id ? $container->get($id) : $container;
}

/**
 * Ajoute une entrée de log de type "debug".
 *
 * Le fonctionnement de cette fonction est similaire à celui de la fonction `sprintf`.
 * (Uniquement dans le cas ou `$message` est une chaîne de caractères)
 *
 * @param mixed $message    Le message ou la variable à logger.
 * @param string[] ...$vars Les variables utilisées pour remplir les placeholders de `$message`.
 *                          Voir le fonctionnement de `sprintf()`.
 *
 * @codeCoverageIgnore
 */
function debug($message, ...$vars): void
{
    $parts = [];

    if (!is_string($message)) {
        $caller = debug_backtrace()[0];
        $parts[] = sprintf("[%s:%d]", basename($caller['file']), $caller['line']);
    }

    if (is_string($message)) {
        $message = !empty($vars) ? vsprintf($message, $vars) : $message;
    } elseif ($message instanceof Builder) {
        $message = $message->toSql();
    } else {
        $message = var_export($message, true);
    }
    $parts[] = $message;

    container('logger')->log(LogLevel::Debug, implode(' ', $parts));
}

/**
 * Récupère le temps écoulé depuis le lancement du script PHP,
 * ou depuis un timestamp de départ personnalisé.
 *
 * @param float $start Un timestamp de départ personnalisé.
 *
 * @return string Le temps écoulé, en secondes.
 */
function getExecutionTime(?float $start = null): string
{
    $start = $start ?: (float) $_SERVER['REQUEST_TIME_FLOAT'];
    $elapsedTime = microtime(true) - $start;

    return number_format($elapsedTime, 3) . 's';
}

/**
 * Pour utiliser une transaction de DB, qui rollback les requêtes SQL en cas d'exception.
 *
 * @param callable $callback Le code effectuant les opérations sur la base de données.
 *                           (et donc qui seront rollback en cas d'erreur)
 *
 * @return mixed Le retour de la fonction de callback.
 */
function dbTransaction(callable $callback): mixed
{
    $dbConnection = container('database')->getConnection();

    try {
        $dbConnection->beginTransaction();
        $result = $callback();
        $dbConnection->commit();
    } catch (\Throwable $e) {
        $dbConnection->rollBack();
        throw $e;
    }

    return $result;
}

/**
 * Traduit une clé de traduction pour la langue courante.
 *
 * ATTENTION, cette fonction n'est à utiliser que dans de rares cas, il faut
 * privilégier l'injection de dépendance quand c'est possible.
 *
 * @param string $key La clé de traduction à utiliser
 *
 * @return string - La traduction, ou la clé elle-même si non trouvée.
 */
function __(string $key): string
{
    return container('i18n')->translate($key);
}

/**
 * Retourne l'URL absolue d'une route nommée, en incluant le chemin de base.
 *
 * /!\ Attention: Cette fonction est uniquement utilisable dans un contexte
 *                d'application avec router (et donc pas dans les applications
 *                console !!)
 *
 * @param string                $routeName   Le nom de la route
 * @param array<string, string> $data        Les arguments nommés de la route.
 * @param array<string, string> $queryParams Paramètres de "query" éventuels.
 *
 * @return string L'URL absolue correspondante à la route.
 *
 * @throws RuntimeException  Si la route nommée n'existe pas.
 * @throws LogicException Si nous ne sommes pas dans un context routé (cf. description).
 * @throws InvalidArgumentException Si des données requises n'ont pas été fournies.
 */
function urlFor(string $routeName, array $data = [], array $queryParams = []): string
{
    /** @var Container $container */
    $container = container();

    if (!$container->has(RouteParserInterface::class)) {
        throw new \LogicException("`urlFor()` cannot be called in non-routed contexts.");
    }

    /** @var RouteParserInterface $routeParser */
    $routeParser = $container->get(RouteParserInterface::class);
    return $routeParser->fullUrlFor(Config::getBaseUri(), $routeName, $data, $queryParams);
}

/**
 * Pour modifier la limite de mémoire de PHP pendant l'exécution d'une partie du code.
 *
 * @param string $limit La limite de mémoire (par exemple '256M' ou '1G') à appliquer
 *                      pour exécuter le code fourni.
 * @param callable $callback Le code à exécuter avec la modification temporaire
 *                           de la limite de mémoire.
 *
 * @return mixed Le retour de la fonction de callback.
 */
function increaseMemory(string $limit, callable $callback): mixed
{
    $defaultMemoryLimit = ini_get('memory_limit');
    ini_set('memory_limit', $limit);

    $result = $callback();

    ini_set('memory_limit', $defaultMemoryLimit);

    return $result;
}

/**
 * Permet de savoir si est actuellement dans un contexte
 * d'execution en ligne de commandes.
 *
 * @return bool `true` si on est dans un contexte d'execution en
 *              ligne de commandes, `false sinon`.
 */
function isCli(): bool
{
    return strtolower(php_sapi_name()) === 'cli';
}

/**
 * Permet de savoir si on est actuellement dans un contexte
 * d'exécution de test sur un environnement d'intégration continue.
 *
 * @return bool `true` si on est en mode test sur un environnement
 *              d'intégration continue, `false` sinon.
 */
function isCI(): bool
{
    return Config::getEnv() === 'test' && !empty(env('CI'));
}

/**
 * Permet de savoir si une fonctionnalité est activée.
 *
 * @param Feature $feature La fonctionnalité à vérifier.
 *
 * @return bool `true` si la fonctionnalité est activée, `false` sinon.
 */
function isFeatureEnabled(Feature $feature): bool
{
    return Config::get(sprintf('features.%s', $feature->value), true);
}

/**
 * Capture et retourne la sortie générée par une fonction de rappel.
 *
 * Cette fonction exécute le callback donné et capture tout ce qui est envoyé
 * dans le tampon de sortie (par exemple via `echo` ou `print`). Une fois le
 * callback exécuté, elle retourne la sortie sous forme de chaîne de caractères.
 *
 * @param callable $callback La fonction à exécuter dont la sortie sera capturée.
 *
 * @return string La sortie capturée du callback.
 */
function captureOutput(callable $callback): string
{
    ob_start();
    $callback();
    return ob_get_clean();
}
