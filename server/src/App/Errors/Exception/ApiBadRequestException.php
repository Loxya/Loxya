<?php
declare(strict_types=1);

namespace Loxya\Errors\Exception;

use Fig\Http\Message\StatusCodeInterface as StatusCode;

class ApiBadRequestException extends ApiException
{
    protected int $statusCode = StatusCode::STATUS_BAD_REQUEST;
    protected $message = 'Bad request.';
}
