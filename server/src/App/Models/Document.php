<?php
declare(strict_types=1);

namespace Loxya\Models;

use Adbar\Dot as DotArray;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Loxya\Config\Config;
use Loxya\Config\Enums\Feature;
use Loxya\Contracts\Serializable;
use Loxya\Models\Traits\Serializer;
use Loxya\Support\Str;
use Loxya\Support\Validation\Validator as V;
use Monolog\Level as LogLevel;
use Psr\Http\Message\UploadedFileInterface;

/**
 * Document attaché à un matériel, un événement,
 * une réservation ou à un technicien.
 *
 * @property-read ?int $id
 * @property string $entity_type
 * @property int $entity_id
 * @property-read Material|Event|Technician $entity
 * @property string $name
 * @property string $type
 * @property int $size
 * @property UploadedFileInterface|string $file
 * @property-read string|null $url
 * @property-read string $base_path
 * @property-read string $path
 * @property int|null $author_id
 * @property-read User|null $author
 * @property-read CarbonImmutable $created_at
 */
final class Document extends BaseModel implements Serializable
{
    use Serializer;

    private const FILE_BASEPATHS = [
        Material::TYPE => DATA_FOLDER . DS . 'materials' . DS . 'documents',
        Event::TYPE => DATA_FOLDER . DS . 'events' . DS . 'documents',
        Technician::TYPE => DATA_FOLDER . DS . 'technicians' . DS . 'documents',
    ];

    public const UPDATED_AT = null;

    public $table = 'documents';

    public function __construct(array $attributes = [])
    {
        parent::__construct($attributes);

        $this->validation = fn () => [
            'entity_type' => V::custom([$this, 'checkEntityType']),
            'entity_id' => V::custom([$this, 'checkEntityId']),
            'name' => V::custom([$this, 'checkName']),
            'type' => V::custom([$this, 'checkType']),
            'size' => V::custom([$this, 'checkSize']),
            'file' => V::custom([$this, 'checkFile']),
            'author_id' => V::custom([$this, 'checkAuthorId']),
        ];
    }

    // ------------------------------------------------------
    // -
    // -    Validation
    // -
    // ------------------------------------------------------

    public function checkName()
    {
        // NOTE: Utilise l'attribut calculé pour inférer la valeur depuis le
        //       fichier raw si c'est ce qui est actuellement spécifié dans
        //       le modèle.
        V::notEmpty()->length(2, 191)->check($this->name);
        return true;
    }

    public function checkType()
    {
        // NOTE: Utilise l'attribut calculé pour inférer la valeur depuis le
        //       fichier raw si c'est ce qui est actuellement spécifié dans
        //       le modèle.
        V::notEmpty()->length(2, 191)->check($this->type);
        return true;
    }

    public function checkSize()
    {
        // NOTE: Utilise l'attribut calculé pour inférer la valeur depuis le
        //       fichier raw si c'est ce qui est actuellement spécifié dans
        //       le modèle.
        V::notEmpty()->numericVal()->check($this->size);
        return true;
    }

    public function checkFile($file)
    {
        if (!($file instanceof UploadedFileInterface)) {
            return V::notEmpty()->length(2, 191);
        }
        /** @var UploadedFileInterface $file */

        if (in_array($file->getError(), [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true)) {
            return 'file-exceeds-max-size';
        }

        if ($file->getError() === UPLOAD_ERR_NO_FILE) {
            return 'no-uploaded-files';
        }

        if ($file->getError() !== UPLOAD_ERR_OK) {
            return 'upload-failed';
        }

        if ($file->getSize() > Config::get('maxFileUploadSize')) {
            return 'file-exceeds-max-size';
        }

        $fileType = $file->getClientMediaType();
        if (!in_array($fileType, Config::get('authorizedFileTypes'), true)) {
            return 'file-type-not-allowed';
        }

        return true;
    }

    public function checkEntityType($value)
    {
        // - Si les techniciens sont désactivés, il n'est pas possible
        //   d'assigner un document à cette entité.
        $isDirty = !$this->exists || $this->isDirty('entity_type');
        if (
            $isDirty &&
            $value === Technician::TYPE &&
            !isFeatureEnabled(Feature::TECHNICIANS)
        ) {
            return false;
        }

        return V::create()
            ->notEmpty()
            ->in([
                Material::TYPE,
                Event::TYPE,
                Technician::TYPE,
            ])
            ->validate($value);
    }

    public function checkEntityId($value)
    {
        V::notEmpty()->intVal()->check($value);

        // - Si les techniciens sont désactivés, il n'est pas possible
        //   d'assigner un document à cette entité.
        $isDirty = !$this->exists || $this->isDirty('entity_id');
        if (
            $isDirty &&
            $this->entity_type === Technician::TYPE &&
            !isFeatureEnabled(Feature::TECHNICIANS)
        ) {
            return false;
        }

        return match ($this->entity_type) {
            Event::TYPE => Event::includes($value),
            Material::TYPE => Material::includes($value),
            Technician::TYPE => Technician::includes($value),
            default => false, // - Type inconnu.
        };
    }

    public function checkAuthorId($value)
    {
        V::nullable(V::intVal())->check($value);

        if ($value === null) {
            return true;
        }

        $author = User::find($value);
        if (!$author) {
            return false;
        }

        return !$this->exists || $this->isDirty('author_id')
            ? !$author->trashed()
            : true;
    }

    // ------------------------------------------------------
    // -
    // -    Relations
    // -
    // ------------------------------------------------------

    public function entity(): MorphTo
    {
        return $this->morphTo('entity');
    }

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'author_id')
            ->withTrashed();
    }

    // ------------------------------------------------------
    // -
    // -    Mutators
    // -
    // ------------------------------------------------------

    protected $appends = [
        'url',
    ];

    protected $hidden = [
        'file',
    ];

    protected $casts = [
        'entity_type' => 'string',
        'entity_id' => 'integer',
        'name' => 'string',
        'type' => 'string',
        'size' => 'integer',
        'author_id' => 'integer',
        'created_at' => 'immutable_datetime',
    ];

    public function getNameAttribute($value): string
    {
        if ($this->file instanceof UploadedFileInterface) {
            return $this->file->getClientFilename();
        }
        return $this->castAttribute('name', $value);
    }

    public function getTypeAttribute($value): string
    {
        if (!$this->isDirty('file')) {
            return $this->castAttribute('type', $value);
        }

        if ($this->file instanceof UploadedFileInterface) {
            return $this->file->getClientMediaType();
        }

        $getValue = function () {
            if (!file_exists($this->path)) {
                return null;
            }

            try {
                return @mime_content_type($this->path) ?: null;
            } catch (\Throwable) {
                return null;
            }
        };

        return $getValue() ?? 'text/plain';
    }

    public function getSizeAttribute($value): int
    {
        if (!$this->isDirty('file')) {
            return $this->castAttribute('size', $value);
        }

        if ($this->file instanceof UploadedFileInterface) {
            return $this->file->getSize();
        }

        $getValue = function () {
            if (!file_exists($this->path)) {
                return null;
            }

            try {
                return @filesize($this->path) ?: null;
            } catch (\Throwable) {
                return null;
            }
        };

        return $getValue() ?? 0;
    }

    public function getUrlAttribute(): string|null
    {
        // - L'URL ne sera disponible qu'une fois le matériel sauvegardé.
        if (!$this->exists) {
            return null;
        }

        return (string) Config::getBaseUri()
            ->withPath(sprintf('/documents/%s', $this->id));
    }

    public function getBasePathAttribute(): string
    {
        return static::FILE_BASEPATHS[$this->entity_type] . DS . $this->entity_id;
    }

    public function getPathAttribute(): string
    {
        // - Dans le cas d'un fichier tout juste uploadé...
        if ($this->file instanceof UploadedFileInterface) {
            throw new \LogicException("Impossible de récupérer le chemin du fichier avant de l'avoir persisté.");
        }
        return $this->base_path . DS . $this->file;
    }

    // ------------------------------------------------------
    // -
    // -    Setters
    // -
    // ------------------------------------------------------

    protected $fillable = ['name', 'file'];
    protected $guarded = ['size', 'type'];

    // ------------------------------------------------------
    // -
    // -    Overwritten methods
    // -
    // ------------------------------------------------------

    public function save(array $options = [])
    {
        $hasFileChange = $this->isDirty('file');
        if (!$hasFileChange) {
            return parent::save($options);
        }

        // - On valide avant d'uploader...
        if ($options['validate'] ?? true) {
            $this->validate();
        }
        $options = array_replace($options, ['validate' => false]);

        $previousFile = $this->getOriginal('file');
        $newFile = $this->getAttributeFromArray('file');

        // - Si ce n'est pas un upload de fichier, on vérifie que la chaîne de caractère passée
        //   correspond bien à un fichier existant dans le dossier attendu, sinon on renvoi une erreur.
        $isFileUpload = $newFile instanceof UploadedFileInterface;
        if (!$isFileUpload) {
            if (!@file_exists($this->path)) {
                throw new \RuntimeException(
                    "An error occurred while uploading the file: " .
                    "The string passed does not correspond to an existing file in the destination folder.",
                );
            }

            $this->name = $this->name;
            $this->type = $this->type;
            $this->size = $this->size;
        } else {
            /** @var UploadedFileInterface $newFile */
            $extension = pathinfo($newFile->getClientFilename(), PATHINFO_EXTENSION);
            $filename = sprintf('%s.%s', (string) Str::uuid(), $extension);

            if (!is_dir($this->base_path)) {
                mkdir($this->base_path, 0777, true);
            }

            try {
                $newFile->moveTo($this->base_path . DS . $filename);
            } catch (\Throwable) {
                throw new \Exception(
                    "An error occurred while uploading the file: " .
                    "File could not be moved to destination folder.",
                );
            }

            $this->name = $this->name;
            $this->type = $this->type;
            $this->size = $this->size;
            $this->file = $filename;
        }

        $rollbackUpload = function () use ($isFileUpload, $newFile) {
            if ($isFileUpload) {
                try {
                    $filename = $this->getAttributeFromArray('file');
                    @unlink($this->base_path . DS . $filename);
                } catch (\Throwable) {
                    // NOTE: On ne fait rien si la suppression plante car de toute
                    //       façon on est déjà dans un contexte d'erreur...
                }

                // - On remet l'`UploadedFile` en valeur de l'attribut `file`.
                $this->file = $newFile;
            }

            foreach (['name', 'type', 'size'] as $cacheField) {
                $this->{$cacheField} = $this->getOriginal($cacheField);
            }
        };

        try {
            $saved = parent::save($options);
        } catch (\Throwable $e) {
            $rollbackUpload();
            throw $e;
        }

        if (!$saved) {
            $rollbackUpload();
            return false;
        }

        // - On supprime l'ancien fichier...
        if ($previousFile !== null) {
            try {
                @unlink($this->base_path . DS . $previousFile);
            } catch (\Throwable) {
                // NOTE: On ne fait rien si la suppression plante, le fichier sera orphelin mais le
                //       plantage de sa suppression ne justifie pas qu'on unsave le document, etc.
            }
        }

        return true;
    }

    public function delete()
    {
        if (!$this->exists) {
            return true;
        }
        $deleted = parent::delete();

        if ($deleted && file_exists($this->path)) {
            try {
                @unlink($this->path);
            } catch (\Throwable) {
                container('logger')->log(
                    LogLevel::Warning,
                    sprintf('Unable to delete file "%s" (path: %s)', $this->name, $this->path),
                );
            }
        }

        return $deleted;
    }

    // ------------------------------------------------------
    // -
    // -    Serialization
    // -
    // ------------------------------------------------------

    public function serialize(): array
    {
        return (new DotArray($this->attributesForSerialization()))
            ->delete(['entity_type', 'entity_id', 'file', 'author_id'])
            ->all();
    }
}
