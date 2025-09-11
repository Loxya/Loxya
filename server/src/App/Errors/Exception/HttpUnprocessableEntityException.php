<?php
declare(strict_types=1);

namespace Loxya\Errors\Exception;

use Fig\Http\Message\StatusCodeInterface as StatusCode;

class HttpUnprocessableEntityException extends HttpSpecializedException
{
    protected $code = StatusCode::STATUS_UNPROCESSABLE_ENTITY;
    protected $message = 'Unprocessable Entity.';
}
