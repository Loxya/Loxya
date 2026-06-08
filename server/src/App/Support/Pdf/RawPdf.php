<?php
declare(strict_types=1);

namespace Loxya\Support\Pdf;

use Fig\Http\Message\StatusCodeInterface as StatusCode;
use Loxya\Support\Assert;
use Loxya\Support\Str;
use Psr\Http\Message\ResponseInterface;
use Slim\Http\Response;
use Slim\Psr7\Stream;

final class RawPdf implements PdfInterface
{
    /** Le nom du fichier PDF. */
    private string $name;

    /** Le chemin vers le fichier "physique". */
    private string $path;

    public function __construct(string $name, string $path)
    {
        Assert::file($path, "The related file does not exist or is not a file.");

        $name = Str::slugify(preg_replace('/\.pdf$/i', '', $name));
        $this->name = sprintf('%s.pdf', Str::title($name));

        $this->path = $path;
    }

    public function getName(): string
    {
        return $this->name;
    }

    // ------------------------------------------------------
    // -
    // -    Output methods
    // -
    // ------------------------------------------------------

    public function asBinaryString(): string
    {
        $contents = @file_get_contents($this->path);
        if ($contents === false) {
            throw new \RuntimeException(sprintf(
                "Cannot read PDF file \"%s\".",
                $this->path,
            ));
        }
        return $contents;
    }

    public function asResponse(Response $response): ResponseInterface
    {
        try {
            $streamHandle = fopen($this->path, 'rb');
            if ($streamHandle === false) {
                throw new \RuntimeException('Unable to open PDF file.');
            }
            $fileStream = new Stream($streamHandle);

            return $response
                ->withHeader('Content-Type', 'application/pdf')
                ->withHeader('Content-Description', 'File Transfer')
                ->withHeader('Content-Transfer-Encoding', 'binary')
                ->withHeader('Content-Disposition', sprintf('attachment; filename="%s"', $this->getName()))
                ->withHeader('Expires', '0')
                ->withHeader('Cache-Control', 'must-revalidate, post-check=0, pre-check=0')
                ->withHeader('Pragma', 'public')
                ->withHeader('Content-Length', $fileStream->getSize())
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
            'mimeType' => 'application/pdf',
            'filename' => $this->getName(),
            'content' => $this->asBinaryString(),
        ];
    }
}
