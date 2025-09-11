<?php
declare(strict_types=1);

namespace Loxya\Errors\Exception;

use Fig\Http\Message\StatusCodeInterface as StatusCode;

class HttpServiceUnavailableException extends HttpSpecializedException
{
    protected $code = StatusCode::STATUS_SERVICE_UNAVAILABLE;
    protected $message = 'Service Unavailable.';
}
