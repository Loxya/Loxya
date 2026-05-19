<?php
declare(strict_types=1);

namespace Loxya\Support\Pdf;

use Fig\Http\Message\StatusCodeInterface as StatusCode;
use horstoeko\zugferd\ZugferdDocumentPdfMerger;
use Loxya\Config\Config;
use Loxya\Support\Str;
use Psr\Http\Message\ResponseInterface;
use Slim\Http\Response;
use Slim\Psr7\Stream;

class HybridPdf implements PdfInterface
{
    /** Le nom du fichier physique du PDF. */
    protected string $name;

    /** Le contenu HTML du PDF. */
    protected string $html;

    /** Le contenu XML du PDF. */
    protected string $xml;

    /** La version binaire du PDF, lorsqu'elle aura été générée. */
    protected string|null $binary = null;

    final public function __construct(string $name, string $html, string $xml) {
        $name = Str::slugify(preg_replace('/\.pdf$/i', '', $name));
        $this->name = sprintf('%s.pdf', $name);

        $this->html = $html;
        $this->xml = $xml;
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

    public function getXml(): string
    {
        return $this->xml;
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

        $basePdf = new Pdf($this->name, $this->html);
        $this->binary = increaseMemory('1G', function () use ($basePdf) {
            $pdf = new ZugferdDocumentPdfMerger($this->getXml(), $basePdf->asBinaryString());
            $pdf->setDeterministicModeEnabled(Config::getEnv() === 'test');
            return $pdf->generateDocument()->downloadString();
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
        if (env('DEBUG_EXPORT') === true || Config::getEnv() === 'test') {
            // - On ajoute le block XML à la fin du HTML, pour avoir un aperçu "complet" du document hybride.
            $xmlBlock = sprintf('<embedded-xml>%s</embedded-xml>', htmlspecialchars($this->getXml()));
            $content = str_ireplace('</body>', $xmlBlock . '</body>', $content);
        }

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
