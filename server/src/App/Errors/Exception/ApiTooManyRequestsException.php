<?php
declare(strict_types=1);

namespace Loxya\Errors\Exception;

use Carbon\CarbonInterface;
use Fig\Http\Message\StatusCodeInterface as StatusCode;
use Loxya\Errors\Enums\ApiErrorCode;

class ApiTooManyRequestsException extends ApiException
{
    protected int $statusCode = StatusCode::STATUS_TOO_MANY_REQUESTS;
    protected $message = 'Too Many Requests.';

    private const METADATA_RETRY_AT = 'retryAt';

    public function __construct(ApiErrorCode $code, ?string $message = null, ?CarbonInterface $retryAt = null)
    {
        $metadata = $retryAt !== null ? compact(self::METADATA_RETRY_AT) : [];
        parent::__construct($code, $message, $metadata);
    }

    public function getRetryAt(): CarbonInterface|null
    {
        return $this->getMetadata()[self::METADATA_RETRY_AT] ?? null;
    }
}
