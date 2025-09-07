<?php
declare(strict_types=1);

namespace Loxya\Errors\Exception;

use Fig\Http\Message\StatusCodeInterface as StatusCode;

class ApiInternalServerErrorException extends ApiException
{
    protected int $statusCode = StatusCode::STATUS_INTERNAL_SERVER_ERROR;
    protected $message = 'Internal server error.';
}
