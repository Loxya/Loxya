<?php
declare(strict_types=1);

namespace Loxya\Support\Stream;

use Psr\Http\Message\StreamInterface;

/**
 * Classe représentant un flux de sortie basé sur un générateur.
 *
 * @example
 * ```php
 * $data = \Illuminate\Support\LazyCollection::times(
 *   10000 * 10000,
 *   fn () => ['name' => 'Houdini'],
 * );
 *
 * $response->withBody(new GeneratorStream(function (): \Generator {
 *     $csv = CsvWriter::createFromPath('php://output', 'w+');
 *
 *     // - Header.
 *     yield captureOutput(static fn () => (
 *         $csv->insertOne(['name'])
 *     ));
 *
 *     // - Content.
 *     foreach ($this->data->chunk(1024) as $chunk) {
 *         yield captureOutput(static fn () => (
 *             $csv->insertAll($chunk)
 *         ));
 *     }
 * }));
 * ```
 */
class GeneratorStream implements StreamInterface
{
    private ?\Closure $factory;

    private ?\Generator $generator = null;

    private string $buffer = '';

    private bool $isClosed = false;

    private int $bytesRead = 0;

    /**
     * @param (\Closure(): \Generator) $factory
     */
    public function __construct(\Closure $factory)
    {
        $this->factory = $factory;
    }

    public function getMetadata($key = null)
    {
        return null;
    }

    public function getSize(): ?int
    {
        return null;
    }

    public function tell(): int
    {
        return $this->bytesRead;
    }

    public function detach()
    {
        $this->factory = null;
        $this->generator = null;

        return null;
    }

    public function close(): void
    {
        $this->buffer = '';
        $this->isClosed = true;

        $this->detach();
    }

    public function eof(): bool
    {
        if ($this->generator === null) {
            return false;
        }
        return $this->buffer === '' && !$this->generator->valid();
    }

    public function isSeekable(): bool
    {
        return false;
    }

    public function seek($offset, $whence = SEEK_SET)
    {
        throw new \RuntimeException('Unable to seek');
    }

    public function rewind()
    {
        throw new \RuntimeException('Unable to rewind');
    }

    public function isWritable(): bool
    {
        return false;
    }

    public function write($string): int
    {
        throw new \RuntimeException('Unable to write');
    }

    public function isReadable(): bool
    {
        return true;
    }

    public function read(int $length): string
    {
        if ($this->isClosed) {
            throw new \RuntimeException('Stream is closed');
        }

        if ($this->factory === null || $length <= 0) {
            return '';
        }

        $this->generator ??= ($this->factory)();

        // - Rempli le buffer si nécessaire.
        // phpcs:ignore Squiz.PHP.DisallowSizeFunctionsInLoops
        while (strlen($this->buffer) < $length && $this->generator->valid()) {
            $this->buffer .= $this->generator->current();
            $this->generator->next();
        }

        // - On coupe la data à la taille souhaitée
        //   et on garde le reste dans un buffer interne.
        $data = mb_strcut($this->buffer, 0, $length);
        $this->buffer = mb_strcut($this->buffer, $length);
        $this->bytesRead += strlen($data);

        return $data;
    }

    public function getContents()
    {
        $content = '';
        while (!$this->eof()) {
            $content .= $this->read(1024);
        }
        return $content;
    }

    public function __toString(): string
    {
        if ($this->isClosed) {
            return '';
        }

        try {
            // - Rewind.
            $this->generator = null;
            $this->bytesRead = 0;
            $this->buffer = '';

            return $this->getContents();
        } catch (\Throwable) {
            return '';
        }
    }
}
