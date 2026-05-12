<?php
declare(strict_types=1);

namespace Loxya\Tests\Fixtures\Snapshots\Drivers;

use PHPUnit\Framework\Assert;
use Spatie\Snapshots\Driver;
use Spatie\Snapshots\Exceptions\CantBeSerialized;
use Symfony\Component\Process\Process;

class HtmlDriver implements Driver
{
    public function serialize($data): string
    {
        if (!is_string($data)) {
            throw new CantBeSerialized('Only strings can be serialized to html');
        }

        if ($data === '') {
            return "\n";
        }

        // - Extraction des blocs `embedded-xml`.
        $extractedBlocks = [];
        $data = preg_replace_callback(
            '#( *)(<embedded-xml[^>]*>\n?)(.*?)(\n? *)(</embedded-xml>)#si',
            static function (array $matches) use (&$extractedBlocks): string {
                $index = count($extractedBlocks);
                $extractedBlocks[$index] = [
                    'open' => $matches[1] . $matches[2],
                    'content' => $matches[3],
                    'close' => $matches[4] . $matches[5],
                ];
                return vsprintf(
                    '%s<embedded-xml data-placeholder="%s"></embedded-xml>',
                    [$matches[1], $index],
                );
            },
            $data,
        );

        $prettier = new Process([
            'prettier',
            '--parser', 'html',
            '--tab-width', '4',
            '--print-width', '9999',
            '--no-bracket-same-line',
        ]);
        $prettier->setInput($data);
        $prettier->mustRun();
        $output = $prettier->getOutput();

        // - Réinjection des blocs `embedded-xml`.
        $output = preg_replace_callback(
            '/^(?<indent> *)<embedded-xml data-placeholder="(?<index>\d+)"><\/embedded-xml>/m',
            static function (array $matches) use ($extractedBlocks): string {
                $baseIndent = $matches['indent'];
                $block = $extractedBlocks[(int) $matches['index']];

                // - Ré-indentation du bloc au bon niveau.
                $lines = explode("\n", $block['content']);
                $minIndent = PHP_INT_MAX;
                $indentUnit = PHP_INT_MAX;
                foreach ($lines as $line) {
                    if (trim($line) === '') {
                        continue;
                    }
                    $spaces = strlen($line) - strlen(ltrim($line));
                    $minIndent = min($minIndent, $spaces);
                }
                foreach ($lines as $line) {
                    if (trim($line) === '') {
                        continue;
                    }
                    $relativeIndent = (strlen($line) - strlen(ltrim($line))) - $minIndent;
                    if ($relativeIndent > 0) {
                        $indentUnit = min($indentUnit, $relativeIndent);
                    }
                }
                if ($indentUnit === PHP_INT_MAX) {
                    $indentUnit = 4;
                }

                return implode("\n", [
                    $baseIndent . trim($block['open']),
                    ...array_map(
                        static function (string $line) use ($minIndent, $indentUnit): string {
                            if (trim($line) === '') {
                                return '';
                            }

                            $relativeIndent = (strlen($line) - strlen(ltrim($line))) - $minIndent;
                            $indentLevel = (int) round($relativeIndent / $indentUnit);
                            return str_repeat(' ', 4 * $indentLevel) . ltrim($line);
                        },
                        $lines,
                    ),
                    $baseIndent . trim($block['close']),
                ]);
            },
            $output,
        );

        return $output;
    }

    public function extension(): string
    {
        return 'html';
    }

    public function match($expected, $actual): void
    {
        Assert::assertEquals($expected, $this->serialize($actual));
    }
}
