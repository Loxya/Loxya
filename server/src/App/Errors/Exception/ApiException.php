<?php
declare(strict_types=1);

namespace Loxya\Errors\Exception;

use Fig\Http\Message\StatusCodeInterface as StatusCode;
use Loxya\Errors\Enums\ApiErrorCode;

class ApiException extends \RuntimeException
{
    /** Le code HTTP associé à l'erreur d'API. */
    protected int $statusCode = StatusCode::STATUS_INTERNAL_SERVER_ERROR;

    /** Le code d'erreur d'API (code métier). */
    private ApiErrorCode $apiCode;

    /** Le tableau des méta-données associées à l'erreur. */
    private array $metadata;

    /**
     * @param ApiErrorCode $code     Le code d'erreur d'API.
     * @param string|null  $message  Un message personnalisé à joindre à l'erreur.
     * @param array        $metadata Des éventuelles méta-données à joindre à l'erreur.
     */
    public function __construct(ApiErrorCode $code, ?string $message = null, array $metadata = [])
    {
        $this->apiCode = $code;
        $this->metadata = $metadata;

        if ($message !== null) {
            $this->message = $message;
        }

        parent::__construct($this->message, $code->value);
    }

    /**
     * Retourne le code HTTP lié à l'erreur d'API.
     *
     * @return int Le code HTTP lié.
     */
    public function getStatusCode(): int
    {
        return $this->statusCode;
    }

    /**
     * Retourne le code d'erreur API sous forme d'enum.
     *
     * @return ApiErrorCode Le code d'erreur API sous forme d'enum.
     */
    public function getApiCode(): ApiErrorCode
    {
        return $this->apiCode;
    }

    /**
     * Retourne les méta-données liées à l'erreur API.
     *
     * ATTENTION: Ces données seront exposées publiquement (retour API).
     *
     * @return array Les méta-données liées à l'erreur API.
     */
    public function getMetadata(): array
    {
        return $this->metadata;
    }
}
