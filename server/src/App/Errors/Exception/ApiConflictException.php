<?php
declare(strict_types=1);

namespace Loxya\Errors\Exception;

use Fig\Http\Message\StatusCodeInterface as StatusCode;

class ApiConflictException extends ApiException
{
    protected int $statusCode = StatusCode::STATUS_CONFLICT;
    protected $message = 'Conflict.';
}
