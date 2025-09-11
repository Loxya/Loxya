<?php
declare(strict_types=1);

namespace Loxya\Errors\Exception;

use Fig\Http\Message\StatusCodeInterface as StatusCode;

class HttpRangeNotSatisfiableException extends HttpSpecializedException
{
    protected $code = StatusCode::STATUS_RANGE_NOT_SATISFIABLE;
    protected $message = 'Range Not Satisfiable.';
}
