<?php
declare(strict_types=1);

namespace Loxya\Errors\Renderer;

use Illuminate\Database\Eloquent\ModelNotFoundException;
use Loxya\Errors\Enums\ApiErrorCode;
use Loxya\Errors\Exception\ApiException;
use Loxya\Errors\Exception\HttpSpecializedException;
use Loxya\Errors\Exception\ValidationException;
use Slim\Exception\HttpException;
use Slim\Exception\HttpMethodNotAllowedException;
use Slim\Interfaces\ErrorRendererInterface;

final class JsonErrorRenderer implements ErrorRendererInterface
{
    public function __invoke(\Throwable $exception, bool $displayErrorDetails): string
    {
        $output = [
            'success' => false,
            'error' => static::format($exception, $displayErrorDetails),
        ];
        return (string) \json_encode($output, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    }

    // ------------------------------------------------------
    // -
    // -    Méthodes internes
    // -
    // ------------------------------------------------------

    private static function format(\Throwable $exception, bool $displayErrorDetails): array
    {
        $output = ['code' => ApiErrorCode::UNKNOWN->value];

        if ($exception instanceof ModelNotFoundException) {
            return $output;
        }

        if ($exception instanceof HttpException) {
            if ($displayErrorDetails) {
                $request = $exception->getRequest();
                $requestDetail = sprintf("(%s) %s", $request->getMethod(), $request->getUri());
                if ($exception instanceof HttpMethodNotAllowedException) {
                    $requestDetail = sprintf(
                        "Method must be one of: [%s]. You asked: %s",
                        implode(', ', $exception->getAllowedMethods()),
                        $requestDetail,
                    );
                }
                $output['message'] = $exception->getMessage();
                $output['debug'] = ['requested' => $requestDetail];
            }

            return $exception instanceof HttpSpecializedException
                ? array_replace($output, $exception->getMetadata())
                : $output;
        }

        if ($exception instanceof ValidationException) {
            $output['code'] = ApiErrorCode::VALIDATION_FAILED->value;
            $output['message'] = $exception->getMessage();
            $output['details'] = $exception->getValidationErrors();
            return $output;
        }

        if ($exception instanceof ApiException) {
            $output['code'] = $exception->getApiCode()->value;
            if (!empty($exception->getMessage())) {
                $output['message'] = $exception->getMessage();
            }
            return array_replace($output, $exception->getMetadata());
        }

        if ($displayErrorDetails) {
            $output['debug'] = [
                'file' => sprintf('%s, line %s.', $exception->getFile(), $exception->getLine()),
                'message' => $exception->getMessage(),
                'stackTrace' => array_slice($exception->getTrace(), 0, 2),
            ];
        }

        return $output;
    }
}
