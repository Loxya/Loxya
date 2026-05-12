<?php
declare(strict_types=1);

namespace Loxya\Services\View;

use Symfony\Component\Filesystem\Path;
use Twig\Error\LoaderError;
use Twig\Loader\FilesystemLoader;

class Loader extends FilesystemLoader
{
    protected function findTemplate(string $name, bool $throw = true): ?string
    {
        // - Résolution des chemins relatifs (e.g. `./index.scss`) par rapport au template appelant.
        if (str_starts_with($name, './') || str_starts_with($name, '../')) {
            $callingTemplateName = null;
            foreach (debug_backtrace(\DEBUG_BACKTRACE_PROVIDE_OBJECT, 10) as $frame) {
                if (isset($frame['object']) && $frame['object'] instanceof \Twig\Template) {
                    $callingTemplateName = $frame['object']->getTemplateName();
                    break;
                }
            }
            if ($callingTemplateName !== null) {
                $callingDir = str_ends_with($callingTemplateName, '.twig')
                    ? dirname($callingTemplateName)
                    : $callingTemplateName;

                $name = Path::canonicalize($callingDir . '/' . $name);
            }
        }

        $result = null;
        $exception = null;

        // - Tente d'abord la résolution standard.
        try {
            $result = parent::findTemplate($name, $throw);
            if ($result !== null) {
                return $result;
            }
        } catch (\Throwable $e) {
            $exception = $e;
        }

        // - Sinon on tente l'import via dossier.
        //   (e.g. `{% extends 'my/dir' %}` => `{% extends 'my/dir/index.twig' %}`)
        if (!str_ends_with($name, '.twig')) {
            $indexName = rtrim($name, '/') . '/index.twig';
            $result = parent::findTemplate($indexName, false);
        }

        if ($result !== null || !$throw) {
            return $result;
        }

        throw $exception ?? (
            new LoaderError(sprintf('Unable to find template "%s".', $name))
        );
    }
}
