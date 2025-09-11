<?php
declare(strict_types=1);

namespace Loxya\Errors\Exception;

use Fig\Http\Message\StatusCodeInterface as StatusCode;

class ApiNotFoundException extends ApiException
{
    protected int $statusCode = StatusCode::STATUS_NOT_FOUND;
    protected $message = 'Not found.';
}
