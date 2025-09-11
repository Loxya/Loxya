<?php
declare(strict_types=1);

namespace Loxya\Support\Storage;

use League\Flysystem\DirectoryListing;
use League\Flysystem\FilesystemOperator as StorageOperator;
use League\Flysystem\StorageAttributes;

/**
 * @method bool has(string $location)
 * @method bool fileExists(string $location)
 * @method bool directoryExists(string $location)
 * @method string read(string $location)
 * @method resource readStream(string $location);
 * @method DirectoryListing<StorageAttributes> listContents(string $location, ?bool $deep)
 * @method int lastModified(string $path)
 * @method int fileSize(string $path)
 * @method string mimeType(string $path)
 * @method string visibility(string $path)
 * @method void move(string $source, string $destination, array $config = [])
 * @method void write(string $location, string $contents, array $config = [])
 * @method void writeStream(string $location, mixed $contents, array $config = [])
 * @method void setVisibility(string $path, string $visibility)
 * @method void delete(string $location)
 * @method void deleteDirectory(string $location)
 * @method void createDirectory(string $location, array $config = [])
 * @method void move(string $source, string $destination, array $config = [])
 * @method void copy(string $source, string $destination, array $config = [])
 * @method string checksum(string $path, array $config = [])
 * @method string publicUrl(string $path, array $config = [])
 * @method string temporaryUrl(string $path, \DateTimeInterface $expiresAt, array $config = [])
 */
class Storage
{
    /** L'instance de Flysystem. */
    protected StorageOperator $driver;

    public function __construct(StorageOperator $driver)
    {
        $this->driver = $driver;
    }

    /**
     * Récupère les dossiers à l'intérieur du dossier spécifié, récursivement ou non.
     *
     * @param string $directory Le dossier dans lequel on doit récupérer les sous-dossiers.
     * @param bool   $recursive Doit-on récupérer les dossiers de manière récursive ?
     *
     * @return array La liste des chemins vers les sous-dossiers.
     */
    public function directories(?string $directory = null, bool $recursive = false): array
    {
        return $this->driver->listContents($directory ?? '', $recursive)
            ->filter(static fn (StorageAttributes $attributes) => $attributes->isDir())
            ->map(static fn (StorageAttributes $attributes) => $attributes->path())
            ->toArray();
    }

    /**
     * Transmet les appels aux méthodes non surchargées / déclarées ici au driver bas niveau.
     *
     * @param string $method     Le nom de la méthode bas-niveau à appeler.
     * @param array  $parameters Les arguments à passer à la méthode bas-niveau.
     *
     * @return mixed Le retour de la méthode bas-niveau.
     */
    public function __call($method, array $parameters): mixed
    {
        return $this->driver->{$method}(...$parameters);
    }
}
