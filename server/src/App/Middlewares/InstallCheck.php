<?php
declare(strict_types=1);

namespace Loxya\Middlewares;

use Loxya\Errors\Exception\HttpServiceUnavailableException;
use Loxya\Services\View;
use Loxya\Support\Install;
use Psr\Http\Message\ResponseFactoryInterface;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface as RequestHandler;

final class InstallCheck implements MiddlewareInterface
{
    private ResponseFactoryInterface $responseFactory;
    private View $view;

    public function __construct(ResponseFactoryInterface $responseFactory, View $view)
    {
        $this->responseFactory = $responseFactory;
        $this->view = $view;
    }

    public function process(ServerRequestInterface $request, RequestHandler $handler): ResponseInterface
    {
        if (!($request instanceof \Loxya\Http\Request)) {
            throw new \InvalidArgumentException('Not a Loxya request.');
        }

        if (Install::isComplete()) {
            return $handler->handle($request);
        }

        // - Si on est dans un contexte d'API.
        if ($request->isApi()) {
            throw new HttpServiceUnavailableException($request, "Application not installed.");
        }

        $response = $this->responseFactory->createResponse(503);
        return $this->view->render($response, 'errors/not-installed.twig');
    }
}
