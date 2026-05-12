<?php
declare(strict_types=1);

namespace Loxya\Support\Xml;

use Fig\Http\Message\StatusCodeInterface as StatusCode;
use Loxya\Support\Str;
use Psr\Http\Message\ResponseInterface;
use Slim\Http\Response;
use Slim\Psr7\Stream;

class Xml implements XmlInterface
{
    /** Le nom du fichier physique du XML. */
    protected string $name;

    /** Le contenu XML. */
    protected string $content;

    final public function __construct(string $name, string $content)
    {
        $name = Str::slugify(preg_replace('/\.xml$/i', '', $name));
        $this->name = sprintf('%s.xml', $name);

        $this->content = $content;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function getContent(): string
    {
        return $this->content;
    }

    // ------------------------------------------------------
    // -
    // -    Output methods
    // -
    // ------------------------------------------------------

    public function asResponse(Response $response): ResponseInterface
    {
        try {
            $streamHandle = fopen('php://memory', 'r+');
            fwrite($streamHandle, $this->content);
            rewind($streamHandle);
            $fileStream = new Stream($streamHandle);

            return $response
                ->withHeader('Content-Type', 'application/xml; charset=utf-8')
                ->withHeader('Content-Description', 'File Transfer')
                ->withHeader('Content-Disposition', sprintf('attachment; filename="%s"', $this->getName()))
                ->withHeader('Expires', '0')
                ->withHeader('Cache-Control', 'must-revalidate, post-check=0, pre-check=0')
                ->withHeader('Pragma', 'public')
                ->withHeader('Content-Length', (string) $fileStream->getSize())
                ->withStatus(StatusCode::STATUS_OK)
                ->withBody($fileStream);
        } catch (\Throwable $e) {
            throw new \RuntimeException(sprintf(
                "Cannot send the file \"%s\". Details: %s",
                $this->getName(),
                $e->getMessage(),
            ));
        }
    }

    public function asMailAttachment(): array
    {
        return [
            'mimeType' => 'application/xml',
            'filename' => $this->getName(),
            'content' => $this->content,
        ];
    }
}
