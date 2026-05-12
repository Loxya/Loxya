<?php
declare(strict_types=1);

namespace Loxya\Support\Pdf;

use Loxya\Config\Config;

class Document extends Pdf
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

    public function withXml(string $xml): HybridDocument
    {
        return new HybridDocument($this->getName(), $this->html, $xml);
    }
}
