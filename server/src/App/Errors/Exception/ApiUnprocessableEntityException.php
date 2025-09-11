<?php
declare(strict_types=1);

namespace Loxya\Errors\Exception;

use Fig\Http\Message\StatusCodeInterface as StatusCode;

class ApiUnprocessableEntityException extends ApiException
{
    protected int $statusCode = StatusCode::STATUS_UNPROCESSABLE_ENTITY;
    protected $message = 'Unprocessable Entity.';
}
