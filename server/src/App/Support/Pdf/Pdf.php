<?php
declare(strict_types=1);

namespace Loxya\Support\Pdf;

use Fig\Http\Message\StatusCodeInterface as StatusCode;
use Loxya\Config\Config;
use Loxya\Services\I18n;
use Loxya\Services\View;
use Loxya\Support\Str;
use Pontedilana\PhpWeasyPrint\Pdf as PdfRenderer;
use Psr\Http\Message\ResponseInterface;
use Slim\Http\Response;
use Slim\Psr7\Stream;

class Pdf implements PdfInterface
{
    /** Le nom du fichier physique du PDF. */
    protected string $name;

    /** Le contenu HTML du PDF. */
    protected string $html;

    /** La version binaire du PDF, lorsqu'elle aura été générée. */
    protected string|null $binary = null;

    final public function __construct(string $name, string $html)
    {
        $name = Str::slugify(preg_replace('/\.pdf$/i', '', $name));
        $this->name = sprintf('%s.pdf', Str::title($name));

        $this->html = $html;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function getHtml(): string
    {
        $baseTag = sprintf('<base href="%s/" />', Config::getBaseUrl());
        return str_replace('<head>', sprintf("<head>\n   %s", $baseTag), $this->html);
    }

    public function withXml(string $xml): HybridPdf
    {
        return new HybridPdf($this->getName(), $this->html, $xml);
    }

    // ------------------------------------------------------
    // -
    // -    Factory methods
    // -
    // ------------------------------------------------------

    public static function createFromTemplate(string $template, I18n $i18n, string $name, array $data): static
    {
        $html = (new View($i18n, 'pdf'))->fetch($template, array_merge($data, [
            'baseUrl' => Config::getBaseUrl(),
        ]));
        return new static($name, $html);
    }

    // ------------------------------------------------------
    // -
    // -    Output methods
    // -
    // ------------------------------------------------------

    public function asBinaryString(): string
    {
        if ($this->binary !== null) {
            return $this->binary;
        }

        $this->binary = increaseMemory('1G', function () {
            $tmpDir = TMP_FOLDER . DS . 'pdf';
            if (!is_dir($tmpDir)) {
                @mkdir($tmpDir, 0777, true);
            }

            $renderer = new PdfRenderer(
                env('WEASYPRINT_BINARY', '/usr/bin/weasyprint'),
                [
                    'pdf-variant' => 'pdf/a-3b',
                    'base-url' => PUBLIC_FOLDER,
                    'media-type' => 'print',
                    'presentational-hints' => true,
                    'optimize-images' => true,
                    'custom-metadata' => true,
                    'uncompressed-pdf' => true,
                ],
            );
            $renderer->setTimeout(60); // - Secondes.
            $renderer->setTemporaryFolder($tmpDir);

            $binary = $renderer->getOutputFromHtml($this->html);
            if (empty($binary)) {
                throw new \RuntimeException("An unknown error occurred while rendering the PDF.");
            }

            return $binary;
        });

        return $this->binary;
    }

    public function asResponse(Response $response): ResponseInterface
    {
        if (env('DEBUG_EXPORT') === true || Config::getEnv() === 'test') {
            return $this->asResponseHtml($response);
        }

        try {
            $streamHandle = fopen('php://memory', 'r+');
            fwrite($streamHandle, $this->asBinaryString());
            rewind($streamHandle);
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

    public function asResponseHtml(Response $response): ResponseInterface
    {
        $content = $this->getHtml();
        $response->getBody()->write($content);
        return $response;
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
