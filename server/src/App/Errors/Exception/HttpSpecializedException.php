<?php
declare(strict_types=1);

namespace Loxya\Errors\Exception;

use Psr\Http\Message\ServerRequestInterface;
use Slim\Exception\HttpSpecializedException as CoreHttpSpecializedException;

abstract class HttpSpecializedException extends CoreHttpSpecializedException
{
    private array $metadata;

    public function __construct(
        ServerRequestInterface $request,
        ?string $message = null,
        ?\Throwable $previous = null,
        array $metadata = [],
    ) {
        $this->metadata = $metadata;

        parent::__construct($request, $message, $previous);
    }

    /**
     * Retourne les méta-données liées à l'exception HTTP.
     *
     * ATTENTION: Ces données seront exposées publiquement (retour API par exemple).
     *
     * @return array Les méta-données liées à l'exception HTTP.
     */
    public function getMetadata(): array
    {
        return $this->metadata;
    }
}
