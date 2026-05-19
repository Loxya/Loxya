<?php
declare(strict_types=1);

namespace Loxya\Support\Xml;

use Psr\Http\Message\ResponseInterface;
use Slim\Http\Response;

interface XmlInterface
{
    public function getName(): string;

    public function getContent(): string;

    //
    // - Output methods.
    //

    public function asResponse(Response $response): ResponseInterface;

    public function asMailAttachment(): array;
}
