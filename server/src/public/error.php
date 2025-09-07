<?php
declare(strict_types=1);

use Twig\Environment as TwigEnvironment;
use Twig\Loader\FilesystemLoader as TwigFilesystemLoader;

$code = (int) ($code ?? -1);
$message ??= null;

require_once __DIR__ . '/../../vendors/autoload.php';
require_once __DIR__ . '/../App/Config/constants.php';

$isCli = php_sapi_name() === 'cli';

//
// - Gestion de l'erreur.
//

// TODO: Gérer le CLI pour la sortie.
// TODO: Prendre en charge les versions de démonstration avec des templates spécifiques.
$vars = [];
switch ($code) {
    // - Missing PHP loader.
    case 0:
        $phpVersion = phpversion();
        $phpVersionParts = explode('.', $phpVersion);
        $isPHPThreadSafe = @constant('PHP_ZTS') || @constant('ZEND_THREAD_SAFE');

        // - Nom du loader à charger.
        $loader = vsprintf('ixed.%s%s.%s', [
            $phpVersionParts[0] . '.' . (int) $phpVersionParts[1],
            ($isPHPThreadSafe ? 'ts' : ''),
            strtolower(substr(php_uname(), 0, 3)),
        ]);

        // - Chemin vers le fichier de configuration PHP.
        $phpConfPath = null;
        if (function_exists('php_ini_loaded_file')) {
            $phpConfPath = php_ini_loaded_file() ?: null;
        }

        // - Dossier des extensions de PHP.
        $phpExtensionDir = @ini_get('extension_dir') ?: null;
        if ($phpExtensionDir) {
            $phpExtensionDir = @realpath($phpExtensionDir) ?: $phpExtensionDir;
        }

        $template = 'missing-loader';
        $vars = [
            'loader' => [
                'name' => $loader,
                'url' => vsprintf('https://client.loxya.com/loaders/%d/%s', [
                    @constant('PHP_INT_SIZE') === 4 ? '32' : '64',
                    $loader,
                ]),
            ],
            'php' => [
                'confPath' => $phpConfPath,
                'extensionDir' => $phpExtensionDir,
            ],
        ];
        break;

    case 1: // - Wrong machine: IP.
    case 2: // - Wrong machine: Domain.
    case 3: // - Wrong machine: Mac address.
    case 4: // - Wrong machine: Machine ID.
    case 5: // - Wrong machine: Remote verification URL locking.
        $domain = !$isCli ? $_SERVER['SERVER_NAME'] ?? $_SERVER['HTTP_HOST'] ?? null : null;
        if ($domain === 'localhost') {
            $domain = null;
        }

        $ip = !$isCli ? $_SERVER['SERVER_ADDR'] ?? $_SERVER['LOCAL_ADDR'] ?? null : null;
        if (in_array($ip, ['::1', '127.0.0.1'], true)) {
            $ip = null;
        }

        // - On en prend en charge *précisément* que les erreurs IPs / domaine.
        $code = in_array($code, [3, 4, 5], true) ? 3 : $code;
        if (($code === 1 && empty($ip)) || ($code === 2 && empty($domain))) {
            $code = 3;
        }

        $template = 'wrong-machine';
        $vars = compact('domain', 'ip');
        break;

    // - Invalid license file.
    case 6:
        $template = 'invalid-license';
        break;

    // - Expired license.
    case 9:
        $template = 'expired-license';
        break;

    // - Missing license file.
    case 13:
        $template = 'missing-license';
        break;

    // - No internet connection (required for time / licence checks).
    case 20:
        $template = 'missing-internet-connection';
        break;

    // - Unknown license error.
    default:
        $template = 'unknown';
}

//
// - Rendering.
//

$loader = new TwigFilesystemLoader(VIEWS_FOLDER);
$twig = new TwigEnvironment($loader, ['cache' => false]);
$viewPath = sprintf('errors/license/%s.twig', $template);
echo $twig->render($viewPath, array_replace(compact('code', 'message'), $vars));
exit(1);
