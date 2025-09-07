<?php
declare(strict_types=1);

namespace Loxya\Support\Pdf;

use Dompdf\Canvas;
use Dompdf\Dompdf;
use Dompdf\FontMetrics;
use Fig\Http\Message\StatusCodeInterface as StatusCode;
use Loxya\Config\Config;
use Loxya\Services\I18n;
use Loxya\Services\View;
use Loxya\Support\Str;
use Psr\Http\Message\ResponseInterface;
use Slim\Http\Response;
use Slim\Psr7\Stream;

final class Pdf implements PdfInterface
{
    protected string $name;

    protected string $html;

    protected I18n $i18n;

    protected string|null $binary = null;

    protected const DEFAULT_FONT = 'DejaVu Sans';

    public function __construct(string $name, string $html, I18n $i18n)
    {
        $name = Str::slugify(preg_replace('/\.pdf$/i', '', $name));
        $this->name = sprintf('%s.pdf', $name);

        $this->html = $html;
        $this->i18n = $i18n;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function getHtml(): string
    {
        return $this->html;
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
        return new static($name, $html, $i18n);
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

        $rawContent = $this->getHtml();

        $this->binary = increaseMemory('1G', function () use ($rawContent) {
            // - Font cache dir
            $cacheDir = CACHE_FOLDER . DS . 'pdf';
            if (!is_dir($cacheDir)) {
                @mkdir($cacheDir, 0777, true);
            }

            $renderer = new Dompdf([
                'tempDir' => TMP_FOLDER,
                'fontCache' => $cacheDir,
                'logOutputFile' => LOGS_FOLDER . DS . 'pdf.html',
                'defaultMediaType' => 'print',
                'defaultPaperSize' => 'a4',
                'defaultPaperOrientation' => 'portrait',
                'defaultFont' => self::DEFAULT_FONT,
                'isHtml5ParserEnabled' => true,
                'isRemoteEnabled' => true,
            ]);

            $renderer->loadHtml($rawContent);
            $renderer->render();

            $canvas = $renderer->getCanvas();
            $canvas->page_script(
                function (int $pageNumber, int $pageCount, Canvas $canvas, FontMetrics $fontMetrics) {
                    $font = $fontMetrics->getFont(self::DEFAULT_FONT);
                    $pageText = $this->i18n->translate('page-n-of-n', $pageNumber, $pageCount);
                    $canvas->text(510, 810, $pageText, $font, 8);
                },
            );

            $binary = $renderer->output();
            if ($binary === null) {
                throw new \RuntimeException('An unknown error occurred while rendering the PDF.');
            }

            return $binary;
        });

        return $this->binary;
    }

    public function asResponse(Response $response): ResponseInterface
    {
        if (env('DEBUG_EXPORT') === true && Config::getEnv() !== 'test') {
            return $this->asResponseHtml($response);
        }

        $binary = $this->asBinaryString();
        if (Config::getEnv() === 'test') {
            $binary = $this->getHtml();
        }

        try {
            $streamHandle = fopen('php://memory', 'r+');
            fwrite($streamHandle, $binary);
            rewind($streamHandle);
            $fileStream = new Stream($streamHandle);

            return $response
                ->withHeader('Content-Type', 'application/force-download')
                ->withHeader('Content-Type', 'application/octet-stream')
                ->withHeader('Content-Type', 'application/download')
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
