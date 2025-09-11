<?php
declare(strict_types=1);

namespace Loxya\Errors\Exception;

use Fig\Http\Message\StatusCodeInterface as StatusCode;

class ApiForbiddenException extends ApiException
{
    protected int $statusCode = StatusCode::STATUS_FORBIDDEN;
    protected $message = 'Forbidden.';
}
