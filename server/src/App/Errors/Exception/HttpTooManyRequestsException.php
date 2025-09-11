<?php
declare(strict_types=1);

namespace Loxya\Errors\Exception;

use Carbon\CarbonInterface;
use Fig\Http\Message\StatusCodeInterface as StatusCode;
use Psr\Http\Message\ServerRequestInterface;

class HttpTooManyRequestsException extends HttpSpecializedException
{
    protected $code = StatusCode::STATUS_TOO_MANY_REQUESTS;
    protected $message = 'Too many requests.';

    private const METADATA_RETRY_AT = 'retryAt';

    public function __construct(
        ServerRequestInterface $request,
        ?string $message = null,
        ?CarbonInterface $retryAt = null,
        ?\Throwable $previous = null,
    ) {
        $metadata = $retryAt !== null ? compact(self::METADATA_RETRY_AT) : [];
        parent::__construct($request, $message, $previous, $metadata);
    }

    public function getRetryAt(): CarbonInterface|null
    {
        return $this->getMetadata()[self::METADATA_RETRY_AT] ?? null;
    }
}
