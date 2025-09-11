<?php
declare(strict_types=1);

namespace Loxya\Support\Pdf;

use Psr\Http\Message\ResponseInterface;
use Slim\Http\Response;

interface PdfInterface
{
    public function getName(): string;

    public function getHtml(): string;

    //
    // - Output methods.
    //

    public function asBinaryString(): string;

    public function asResponse(Response $response): ResponseInterface;

    public function asResponseHtml(Response $response): ResponseInterface;

    public function asMailAttachment(): array;
}
