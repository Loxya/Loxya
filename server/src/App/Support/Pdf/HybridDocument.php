<?php
declare(strict_types=1);

namespace Loxya\Support\Pdf;

use Loxya\Config\Config;
use Psr\Http\Message\ResponseInterface;
use Slim\Http\Response;

final class HybridDocument extends HybridPdf
{
    public function getHtml(): string
    {
        if (env('DEBUG_EXPORT') === true || Config::getEnv() === 'test') {
            return preg_replace(
                '/<body([^>]*)>(.*)<\/body>/is',
                sprintf("<body$1>\n    %s\n</body>", implode("\n    ", [
                    '<div class="__document">',
                    '    <div class="__document__preview">',
                    '        <div class="__document__preview__content">$2</div>',
                    '    </div>',
                    '</div>',
                ])),
                parent::getHtml(),
            );
        }
        return $this->html;
    }

    public function asResponseHtml(Response $response): ResponseInterface
    {
        $content = parent::getHtml();
        if (env('DEBUG_EXPORT') === true || Config::getEnv() === 'test') {
            $content = preg_replace(
                '/<body([^>]*)>(.*)<\/body>/is',
                sprintf("<body$1>\n    %s\n</body>", sprintf(
                    implode("\n    ", [
                        '<div class="__document">',
                        '    <div class="__document__preview">',
                        '        <div class="__document__preview__content">$2</div>',
                        '    </div>',
                        '    <embedded-xml class="__document__xml">%s</embedded-xml>',
                        '</div>',
                    ]),
                    htmlspecialchars($this->getXml()),
                )),
                $content,
            );
        }
        $response->getBody()->write($content);
        return $response;
    }
}
