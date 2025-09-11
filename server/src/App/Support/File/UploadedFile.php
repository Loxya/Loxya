<?php
declare(strict_types=1);

namespace Loxya\Support\File;

use GuzzleHttp\Psr7\LazyOpenStream;
use GuzzleHttp\Psr7\UploadedFile as CoreUploadedFile;
use GuzzleHttp\Psr7\Utils as FileUtils;
use Loxya\Config\Config;

class UploadedFile extends CoreUploadedFile
{
    private $file;

    private $moved = false;

    /**
     * @inheritDoc
     */
    public function __construct(
        $streamOrFile,
        ?int $size,
        int $errorStatus,
        ?string $clientFilename = null,
        ?string $clientMediaType = null,
    ) {
        parent::__construct(
            $streamOrFile,
            $size,
            $errorStatus,
            $clientFilename,
            $clientMediaType,
        );

        if ($this->getError() === UPLOAD_ERR_OK && is_string($streamOrFile)) {
            $this->file = $streamOrFile;
        }
    }

    /**
     * @inheritDoc
     */
    public function moveTo($targetPath): void
    {
        if ($this->getError() !== UPLOAD_ERR_OK) {
            throw new \RuntimeException("Cannot retrieve stream due to upload error");
        }

        if ($this->moved) {
            throw new \RuntimeException("Cannot retrieve stream after it has already been moved");
        }

        if (!is_string($targetPath) || empty($targetPath)) {
            throw new \InvalidArgumentException(
                "Invalid path provided for move operation; must be a non-empty string",
            );
        }

        if (Config::getEnv(true) === 'test') {
            $this->moved = true;
            return;
        }

        if ($this->file) {
            $this->moved = rename($this->file, $targetPath);
        } else {
            FileUtils::copyToStream(
                $this->getStream(),
                new LazyOpenStream($targetPath, 'w'),
            );

            $this->moved = true;
        }

        if ($this->moved === false) {
            throw new \RuntimeException(
                sprintf('Uploaded file could not be moved to %s', $targetPath),
            );
        }
    }
}
