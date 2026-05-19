<?php
declare(strict_types=1);

namespace Loxya\Tests\Fixtures\Snapshots\Drivers;

use PHPUnit\Framework\Assert;
use Spatie\Snapshots\Driver;

class FileDriver implements Driver
{
    private string $extension;

    public function __construct(string $extension)
    {
        $this->extension = $extension;
    }

    public function serialize($data): string
    {
        return $data;
    }

    public function extension(): string
    {
        return $this->extension;
    }

    public function match($expected, $actual)
    {
        // - Pour les PDFs, vu les différences de génération sur le CI,
        //   on vérifie uniquement que la sortie est non vide.
        if ($this->extension === 'pdf' && isCI()) {
            Assert::assertNotEmpty($actual);
            return;
        }
        Assert::assertEquals(sha1($expected), sha1($actual));
    }
}
