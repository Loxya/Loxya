<?php
declare(strict_types=1);

namespace Loxya\Errors;

use Fig\Http\Message\StatusCodeInterface as StatusCode;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Loxya\Errors\Exception\ApiException;
use Loxya\Errors\Exception\ApiTooManyRequestsException;
use Loxya\Errors\Exception\HttpTooManyRequestsException;
use Loxya\Errors\Exception\ValidationException;
use Loxya\Errors\Renderer\HtmlErrorRenderer;
use Loxya\Errors\Renderer\JsonErrorRenderer;
use Psr\Http\Message\ResponseInterface;
use Slim\Exception\HttpException;
use Slim\Handlers\ErrorHandler as CoreErrorHandler;

class ErrorHandler extends CoreErrorHandler
{
    protected string $defaultErrorRendererContentType = 'application/json';
    protected $defaultErrorRenderer = JsonErrorRenderer::class;

    protected array $errorRenderers = [
        'application/json' => JsonErrorRenderer::class,
        'text/html' => HtmlErrorRenderer::class,
    ];

    protected function determineStatusCode(): int
    {
        if ($this->method === 'OPTIONS') {
            return StatusCode::STATUS_OK;
        }

        if ($this->exception instanceof ModelNotFoundException) {
            return StatusCode::STATUS_NOT_FOUND;
        }

        if ($this->exception instanceof HttpException) {
            return $this->exception->getCode();
        }

        if ($this->exception instanceof ValidationException) {
            return StatusCode::STATUS_BAD_REQUEST;
        }

        if ($this->exception instanceof ApiException) {
            return $this->exception->getStatusCode();
        }

        return StatusCode::STATUS_INTERNAL_SERVER_ERROR;
    }

    protected function respond(): ResponseInterface
    {
        $response = parent::respond();

        if (
            (
                $this->exception instanceof HttpTooManyRequestsException ||
                $this->exception instanceof ApiTooManyRequestsException
            ) &&
            $this->exception->getRetryAt() !== null
        ) {
            $retryAfter = $this->exception->getRetryAt()->diffInSeconds();
            if ($retryAfter > 0) {
                $response = $response->withHeader('Retry-After', $retryAfter);
            }
        }

        return $response;
    }

    protected function writeToErrorLog(): void
    {
        $isIgnoredException = (
            $this->exception instanceof ModelNotFoundException ||
            $this->exception instanceof ValidationException ||
            $this->exception instanceof ApiException ||
            (
                $this->exception instanceof HttpException &&
                $this->exception->getCode() < 500
            )
        );
        if ($isIgnoredException) {
            return;
        }
        parent::writeToErrorLog();
    }
}
