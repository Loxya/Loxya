<?php
declare(strict_types=1);

namespace Loxya\Errors\Renderer;

use Loxya\Services\View;
use Slim\Error\Renderers\HtmlErrorRenderer as CoreHtmlErrorRenderer;

final class HtmlErrorRenderer extends CoreHtmlErrorRenderer
{
    public function __invoke(\Throwable $exception, bool $displayErrorDetails): string
    {
        try {
            /** @var View $view */
            $view = container('view');
            return $view->fetch('errors/critical.twig');
        } catch (\Throwable) {
            return parent::__invoke($exception, false);
        }
    }
}
