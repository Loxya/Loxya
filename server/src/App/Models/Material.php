<?php
declare(strict_types=1);

namespace Loxya\Models;

use Brick\Math\BigDecimal as Decimal;
use Brick\Math\RoundingMode;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Database\Eloquent\Relations\MorphToMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Collection as CoreCollection;
use Illuminate\Support\LazyCollection;
use Loxya\Config\Config;
use Loxya\Config\Enums\BillingMode;
use Loxya\Contracts\PeriodInterface;
use Loxya\Contracts\Serializable;
use Loxya\Errors\Exception\ValidationException;
use Loxya\Models\Casts\AsDecimal;
use Loxya\Models\Traits\Serializer;
use Loxya\Models\Traits\TransientAttributes;
use Loxya\Support\Arr;
use Loxya\Support\Assert;
use Loxya\Support\Database\QueryAggregator;
use Loxya\Support\Period;
use Loxya\Support\Str;
use Loxya\Support\Validation\Rules\SchemaStrict;
use Loxya\Support\Validation\Validator as V;
use Psr\Http\Message\UploadedFileInterface;
use Respect\Validation\Rules as Rule;

/**
 * Matériel.
 *
 * @property-read ?int $id
 * @property string $name
 * @property UploadedFileInterface|string|null $picture
 * @property-read string|null $picture_real_path
 * @property string|null $description
 * @property string $reference
 * @property int|null $park_id
 * @property-read Park|null $park
 * @property int|null $category_id
 * @property-read Category|null $category
 * @property int|null $sub_category_id
 * @property-read SubCategory|null $sub_category
 * @property-read SubCategory|null $subCategory
 * @property Decimal|null $rental_price
 * @property int|null $degressive_rate_id
 * @property-read DegressiveRate|null $degressive_rate
 * @property-read DegressiveRate|null $degressiveRate
 * @property int|null $tax_id
 * @property-read Tax|null $tax
 * @property Decimal|null $replacement_price
 * @property int $stock_quantity
 * @property int $out_of_order_quantity
 * @property int $available_quantity
 * @property bool $is_hidden_on_bill
 * @property bool $is_discountable
 * @property-read bool $is_deleted
 * @property string|null $note
 * @property-read Event|null $departure_inventory_todo
 * @property-read Event|null $return_inventory_todo
 * @property Event|null $context
 * @property-read Decimal|null $degressive_rate_context
 * @property-read Decimal|null $rental_price_context
 * @property-read CarbonImmutable $created_at
 * @property-read CarbonImmutable|null $updated_at
 * @property-read CarbonImmutable|null $deleted_at
 *
 * @property-read Collection<array-key, MaterialProperty> $properties
 * @property-read Collection<array-key, Event> $events
 * @property-read Collection<array-key, Document> $documents
 * @property-read Collection<array-key, Tag> $tags
 *
 * @method static Builder|static search(string|string[] $term)
 * @method static Builder|static inPark(int $parkId)
 * @method static Builder|static notInPark(array $parks)
 * @method static Builder|static prepareSerialize(string $format)
 */
final class Material extends BaseModel implements Serializable
{
    use Serializer;
    use SoftDeletes;
    use TransientAttributes;

    /** L'identifiant unique du modèle. */
    public const TYPE = 'material';

    // - Types de sérialisation.
    public const SERIALIZE_DEFAULT = 'default';
    public const SERIALIZE_DETAILS = 'details';
    public const SERIALIZE_PUBLIC = 'public';
    public const SERIALIZE_WITH_AVAILABILITY = 'with-availability';
    public const SERIALIZE_WITH_CONTEXT = 'with-context';
    public const SERIALIZE_WITH_CONTEXT_EXCERPT = 'with-context-excerpt';

    private const PICTURE_BASEPATH = (
        DATA_FOLDER . DS . 'materials' . DS . 'picture'
    );

    protected $attributes = [
        'name' => null,
        'description' => null,
        'reference' => null,
        'park_id' => null,
        'category_id' => null,
        'sub_category_id' => null,
        'rental_price' => null,
        'degressive_rate_id' => null,
        'tax_id' => null,
        'stock_quantity' => null,
        'out_of_order_quantity' => null,
        'replacement_price' => null,
        'is_hidden_on_bill' => false,
        'is_discountable' => true,
        'picture' => null,
        'note' => null,
    ];

    public function __construct(array $attributes = [])
    {
        parent::__construct($attributes);

        $this->validation = fn () => [
            'name' => V::notEmpty()->length(2, 191),
            'reference' => V::custom([$this, 'checkReference']),
            'picture' => V::custom([$this, 'checkPicture']),
            'park_id' => V::custom([$this, 'checkParkId']),
            'category_id' => V::custom([$this, 'checkCategoryId']),
            'sub_category_id' => V::custom([$this, 'checkSubCategoryId']),
            'rental_price' => V::custom([$this, 'checkRentalPrice']),
            'degressive_rate_id' => V::custom([$this, 'checkDegressiveRateId']),
            'tax_id' => V::custom([$this, 'checkTaxId']),
            'stock_quantity' => V::custom([$this, 'checkStockQuantity']),
            'out_of_order_quantity' => V::custom([$this, 'checkOutOfOrderQuantity']),
            'replacement_price' => V::custom([$this, 'checkReplacementPrice']),
            'is_hidden_on_bill' => V::nullable(V::boolType()),
            'is_discountable' => V::nullable(V::boolType()),
        ];
    }

    // ------------------------------------------------------
    // -
    // -    Validation
    // -
    // ------------------------------------------------------

    public function checkReference($value)
    {
        V::notEmpty()
            ->alnum('.,-+/_ ')
            ->length(2, 64)
            ->check($value);

        $alreadyExists = static::query()
            ->where('reference', $value)
            ->when($this->exists, fn (Builder $subQuery) => (
                $subQuery->where('id', '!=', $this->id)
            ))
            ->withTrashed()
            ->exists();

        return !$alreadyExists ?: 'reference-already-in-use';
    }

    public function checkPicture($picture)
    {
        if (empty($picture)) {
            return true;
        }

        if (is_string($picture)) {
            V::length(5, 227)->check($picture);
            return true;
        }

        if (!($picture instanceof UploadedFileInterface)) {
            return false;
        }
        /** @var UploadedFileInterface $picture */

        if (in_array($picture->getError(), [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true)) {
            return 'file-exceeds-max-size';
        }

        if ($picture->getError() === UPLOAD_ERR_NO_FILE) {
            return 'no-uploaded-files';
        }

        if ($picture->getError() !== UPLOAD_ERR_OK) {
            return 'upload-failed';
        }

        if ($picture->getSize() > Config::get('maxFileUploadSize')) {
            return 'file-exceeds-max-size';
        }

        $pictureType = $picture->getClientMediaType();
        if (!in_array($pictureType, Config::get('authorizedImageTypes'), true)) {
            return 'file-type-not-allowed';
        }

        return true;
    }

    public function checkParkId($value)
    {
        V::notEmpty()->intVal()->check($value);

        $park = Park::withTrashed()->find($value);
        if (!$park) {
            return false;
        }

        return !$this->exists || $this->isDirty('park_id')
            ? !$park->trashed()
            : true;
    }

    public function checkCategoryId($value)
    {
        V::nullable(V::intVal())->check($value);
        return $value === null || Category::includes($value);
    }

    public function checkSubCategoryId($value)
    {
        V::nullable(V::intVal())->check($value);
        return $value === null || SubCategory::includes($value);
    }

    public function checkStockQuantity()
    {
        return V::intVal()->max(100_000);
    }

    public function checkOutOfOrderQuantity()
    {
        return V::nullable(V::intVal()->max(100_000));
    }

    public function checkRentalPrice($value)
    {
        $billingMode = Config::get('billingMode');
        if ($billingMode === BillingMode::NONE) {
            return V::nullType();
        }

        V::floatVal()->check($value);
        $value = Decimal::of($value);

        $isValid = (
            $value->isGreaterThanOrEqualTo(0) &&
            $value->isLessThan(1_000_000_000_000) &&
            $value->getScale() <= 2
        );
        return $isValid ?: 'invalid-positive-amount';
    }

    public function checkReplacementPrice($value)
    {
        if ($value === null) {
            return true;
        }

        V::floatVal()->check($value);
        $value = Decimal::of($value);

        $isValid = (
            $value->isGreaterThanOrEqualTo(0) &&
            $value->isLessThan(1_000_000_000_000) &&
            $value->getScale() <= 2
        );
        return $isValid ?: 'invalid-positive-amount';
    }

    public function checkDegressiveRateId($value)
    {
        V::nullable(V::intVal())->check($value);
        return $value === null || DegressiveRate::includes($value);
    }

    public function checkTaxId($value)
    {
        V::nullable(V::intVal())->check($value);
        return $value === null || Tax::includes($value);
    }

    // ------------------------------------------------------
    // -
    // -    Relations
    // -
    // ------------------------------------------------------

    public function park(): BelongsTo
    {
        return $this->belongsTo(Park::class);
    }

    public function tax(): BelongsTo
    {
        return $this->belongsTo(Tax::class);
    }

    public function degressiveRate(): BelongsTo
    {
        return $this->belongsTo(DegressiveRate::class);
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function subCategory(): BelongsTo
    {
        return $this->belongsTo(SubCategory::class);
    }

    public function properties(): HasMany
    {
        return $this->hasMany(MaterialProperty::class, 'material_id')
            ->orderBy('id');
    }

    public function events(): BelongsToMany
    {
        return $this->belongsToMany(Event::class, 'event_materials')
            ->using(EventMaterial::class)
            ->withPivot('id', 'quantity')
            ->orderBy('mobilization_start_date', 'desc');
    }

    public function documents(): MorphMany
    {
        return $this->morphMany(Document::class, 'entity')
            ->orderBy('name', 'asc')
            ->orderBy('id', 'asc');
    }

    public function tags(): MorphToMany
    {
        return $this->morphToMany(Tag::class, 'taggable');
    }

    // ------------------------------------------------------
    // -
    // -    Mutators
    // -
    // ------------------------------------------------------

    protected $casts = [
        'name' => 'string',
        'reference' => 'string',
        'description' => 'string',
        'park_id' => 'integer',
        'category_id' => 'integer',
        'sub_category_id' => 'integer',
        'rental_price' => AsDecimal::class,
        'degressive_rate_id' => 'integer',
        'tax_id' => 'integer',
        'stock_quantity' => 'integer',
        'out_of_order_quantity' => 'integer',
        'replacement_price' => AsDecimal::class,
        'is_hidden_on_bill' => 'boolean',
        'is_discountable' => 'boolean',
        'note' => 'string',
        'created_at' => 'immutable_datetime',
        'updated_at' => 'immutable_datetime',
        'deleted_at' => 'immutable_datetime',
    ];

    public function getPictureAttribute($value): UploadedFileInterface|string|null
    {
        if (!$value || $value instanceof UploadedFileInterface) {
            return $value;
        }

        // - Le chemin ne sera disponible qu'une fois le matériel sauvegardé.
        if (!$this->exists) {
            return null;
        }

        return (string) Config::getBaseUri()
            ->withPath(sprintf('/static/materials/%s/picture', $this->id));
    }

    public function getPictureRealPathAttribute(): string|null
    {
        $picture = $this->getAttributeFromArray('picture');
        if (empty($picture)) {
            return null;
        }

        // - Dans le cas d'un fichier tout juste uploadé...
        if ($picture instanceof UploadedFileInterface) {
            throw new \LogicException("Unable to retrieve image path before having persisted it.");
        }

        return static::PICTURE_BASEPATH . DS . $picture;
    }

    public function getStockQuantityAttribute(mixed $value): int
    {
        return $this->castAttribute('stock_quantity', $value ?? 0);
    }

    public function getOutOfOrderQuantityAttribute(mixed $value): int
    {
        return $this->castAttribute('out_of_order_quantity', $value ?? 0);
    }

    public function getParkAttribute(): Park|null
    {
        return $this->getRelationValue('park');
    }

    public function getDegressiveRateAttribute(): DegressiveRate|null
    {
        return $this->getRelationValue('degressiveRate');
    }

    public function getTaxAttribute(): Tax|null
    {
        return $this->getRelationValue('tax');
    }

    public function getCategoryAttribute(): Category|null
    {
        return $this->getRelationValue('category');
    }

    public function getIsDeletedAttribute(): bool
    {
        return $this->trashed();
    }

    public function getAvailableQuantityAttribute(): int
    {
        $availableQuantity = $this->getTransientAttribute('available_quantity');
        if ($availableQuantity !== null) {
            return $availableQuantity;
        }

        $withAvailabilities = $this->withAvailabilities(
            new Period('now', 'now +1 minute'),
        );
        return $withAvailabilities->available_quantity;
    }

    /** @return Collection<array-key, Tag> */
    public function getTagsAttribute(): Collection
    {
        return $this->getRelationValue('tags');
    }

    /** @return Collection<array-key, Property> */
    public function getPropertiesAttribute(): Collection
    {
        $properties = $this->getRelationValue('properties');
        if (!$properties) {
            return new Collection();
        }

        return $properties
            ->filter(function (MaterialProperty $materialProperty) {
                $property = $materialProperty->property;
                if ($property->categories->isEmpty()) {
                    return true;
                }

                return (
                    $this->category !== null &&
                    $property->categories->contains('id', $this->category->id)
                );
            })
            ->map(static function (MaterialProperty $materialProperty) {
                $materialProperty->property->value = $materialProperty->value;
                return $materialProperty->property->append(['value']);
            })
            ->sortBy('name')
            ->values();
    }

    public function getContextAttribute(): Event|null
    {
        return $this->getTransientAttribute('context');
    }

    public function getDegressiveRateContextAttribute(): Decimal|null
    {
        if ($this->context === null) {
            return null;
        }

        $contextPeriod = $this->context->operation_period;
        $durationDays = $contextPeriod->asDays();

        // - Pas de dégressivité.
        if ($this->degressive_rate === null) {
            return Decimal::of($durationDays)
                ->toScale(2, RoundingMode::UNNECESSARY);
        }

        return $this->degressive_rate->computeForDays($durationDays);
    }

    public function getRentalPriceContextAttribute(): Decimal|null
    {
        $degressiveRate = $this->degressive_rate_context;
        if (
            $this->context === null ||
            $degressiveRate === null ||
            $this->rental_price === null
        ) {
            return null;
        }

        return $this->rental_price
            ->multipliedBy($degressiveRate)
            // @see https://wiki.dolibarr.org/index.php?title=VAT_setup,_calculation_and_rounding_rules
            ->toScale(2, RoundingMode::HALF_UP);
    }

    public function getDepartureInventoryTodoAttribute(): Event|null
    {
        $bookingsEntities = [
            Event::class => Event::query(),
        ];

        $query = new QueryAggregator();
        foreach ($bookingsEntities as $modelClass => $modelQuery) {
            $modelQuery = $modelQuery
                ->whereHas('materials', fn (Builder $bookingMaterialQuery) => (
                    $bookingMaterialQuery
                        ->where('material_id', $this->id)
                        ->where(static fn (Builder $subQuery) => (
                            $subQuery
                                ->whereNull('quantity_departed')
                                ->orWhereColumn('quantity_departed', '<', 'quantity')
                        ))
                ))
                ->departureInventoryTodo();

            $query->add($modelClass, $modelQuery);
        }

        return $query->orderBy('mobilization_start_date')->first();
    }

    public function getReturnInventoryTodoAttribute(): Event|null
    {
        $bookingsEntities = [
            Event::class => Event::query(),
        ];

        $query = new QueryAggregator();
        foreach ($bookingsEntities as $modelClass => $modelQuery) {
            $modelQuery = $modelQuery
                ->whereHas('materials', fn (Builder $bookingMaterialQuery) => (
                    $bookingMaterialQuery
                        ->where('material_id', $this->id)
                        ->where(static fn (Builder $subQuery) => (
                            $subQuery
                                ->whereNull('quantity_returned')
                                ->orWhereColumn('quantity_returned', '<', 'quantity')
                        ))
                ))
                ->returnInventoryTodo(lax: true);

            $query->add($modelClass, $modelQuery);
        }

        return $query->orderByDesc('mobilization_end_date')->first();
    }

    // ------------------------------------------------------
    // -
    // -    Setters
    // -
    // ------------------------------------------------------

    protected $fillable = [
        'name',
        'reference',
        'description',
        'park_id',
        'category_id',
        'sub_category_id',
        'rental_price',
        'degressive_rate_id',
        'tax_id',
        'stock_quantity',
        'out_of_order_quantity',
        'replacement_price',
        'is_hidden_on_bill',
        'is_discountable',
        'picture',
        'note',
    ];

    public function setAvailableQuantityAttribute(int $value): void
    {
        $this->setTransientAttribute('available_quantity', $value);
    }

    public function setContextAttribute(Event|null $value): void
    {
        $this->setTransientAttribute('context', $value);
    }

    // ------------------------------------------------------
    // -
    // -    Overwritten methods
    // -
    // ------------------------------------------------------

    public function save(array $options = [])
    {
        $hasPictureChange = $this->isDirty('picture');
        if (!$hasPictureChange) {
            return parent::save($options);
        }

        // - On valide avant d'uploader...
        if ($options['validate'] ?? true) {
            $this->validate();
        }
        $options = array_replace($options, ['validate' => false]);

        $previousPicture = $this->getOriginal('picture');
        $newPicture = $this->getAttributeFromArray('picture');

        // - Si ce n'est ni un upload de fichier, ni une "suppression" de l'image existante.
        //   On vérifie que la chaîne de caractère passée (car ça doit en être une) correspond
        //   bien à un fichier existant dans le dossier attendu, sinon on renvoi une erreur.
        $isFileUpload = $newPicture instanceof UploadedFileInterface;
        if (!empty($newPicture) && !$isFileUpload) {
            if (!is_string($newPicture)) {
                throw new \RuntimeException(
                    "An error occurred while uploading the image: " .
                    "The image format to be uploaded is not supported.",
                );
            }

            if (!@file_exists(static::PICTURE_BASEPATH . DS . $newPicture)) {
                throw new \RuntimeException(
                    "An error occurred while uploading the image: " .
                    "The string passed does not correspond to an existing file in the destination folder.",
                );
            }
        }

        // - Si on a un nouvel upload d'image, on la déplace dans le bon dossier.
        if ($isFileUpload) {
            /** @var UploadedFileInterface $newPicture */
            $extension = pathinfo($newPicture->getClientFilename(), PATHINFO_EXTENSION);
            $filename = sprintf('%s.%s', (string) Str::uuid(), $extension);

            if (!is_dir(static::PICTURE_BASEPATH)) {
                mkdir(static::PICTURE_BASEPATH, 0777, true);
            }

            try {
                $newPicture->moveTo(static::PICTURE_BASEPATH . DS . $filename);
            } catch (\Throwable) {
                throw new \Exception(
                    "An error occurred while uploading the image: " .
                    "The image could not be moved to the destination folder.",
                );
            }

            $this->picture = $filename;
        }

        $rollbackUpload = function () use ($isFileUpload, $newPicture) {
            if (!$isFileUpload) {
                return;
            }

            try {
                $filename = $this->getAttributeFromArray('picture');
                @unlink(static::PICTURE_BASEPATH . DS . $filename);
            } catch (\Throwable) {
                // NOTE: On ne fait rien si la suppression plante car de toute
                //       façon on est déjà dans un contexte d'erreur...
            }

            // - On remet l'`UploadedFile` en valeur de l'attribut `picture`.
            $this->picture = $newPicture;
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

        // - On supprime l'ancienne image...
        if ($previousPicture !== null) {
            try {
                @unlink(static::PICTURE_BASEPATH . DS . $previousPicture);
            } catch (\Throwable) {
                // NOTE: On ne fait rien si la suppression plante, le fichier sera orphelin mais le
                //       plantage de sa suppression ne justifie pas qu'on unsave le matériel, etc.
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

        $filename = $this->getAttributeFromArray('picture');
        if ($this->forceDeleting && $deleted && !empty($filename)) {
            try {
                @unlink(static::PICTURE_BASEPATH . DS . $filename);
            } catch (\Throwable) {
                // NOTE: On ne fait rien si la suppression plante, le fichier sera orphelin mais le
                //       plantage de sa suppression ne justifie pas qu'on undelete le matériel.
            }
        }

        return $deleted;
    }

    // ------------------------------------------------------
    // -
    // -    Méthodes liées à une "entity"
    // -
    // ------------------------------------------------------

    public function edit(array $data): static
    {
        if (array_key_exists('stock_quantity', $data)) {
            $stockQuantity = $data['stock_quantity'];
            if ($stockQuantity !== null && (int) $stockQuantity < 0) {
                $data['stock_quantity'] = 0;
            }
        }

        if (array_key_exists('out_of_order_quantity', $data)) {
            $stockQuantity = (int) ($data['stock_quantity'] ?? 0);
            $outOfOrderQuantity = (int) $data['out_of_order_quantity'];
            if ($outOfOrderQuantity > $stockQuantity) {
                $outOfOrderQuantity = $stockQuantity;
                $data['out_of_order_quantity'] = $outOfOrderQuantity;
            }
            if ($outOfOrderQuantity <= 0) {
                $data['out_of_order_quantity'] = null;
            }
        }

        $this->fill(Arr::except($data, ['tags', 'properties']));

        $validationErrors = [];
        if (!$this->isValid()) {
            $validationErrors = $this->validationErrors();
        }

        // - Tags
        $tags = null;
        if (array_key_exists('tags', $data)) {
            Assert::isArray($data['tags'], "Key `tags` must be an array.");

            $tags = [];
            foreach ($data['tags'] as $tagId) {
                if (empty($tagId)) {
                    continue;
                }

                $relatedTag = is_numeric($tagId) ? Tag::find($tagId) : null;
                if ($relatedTag === null) {
                    $validationErrors['tags'] = __('field-contains-invalid-values');
                    break;
                }

                $tags[] = $relatedTag->id;
            }
        }

        // - Caractéristiques spéciales
        $properties = null;
        if (array_key_exists('properties', $data)) {
            $propertiesSchema = V::arrayType()->each(new SchemaStrict(
                new Rule\Key('id'),
                new Rule\Key('value'),
            ));
            if (!$propertiesSchema->validate($data['properties'])) {
                throw new \InvalidArgumentException("Invalid data format.");
            }

            $properties = (new CoreCollection($data['properties']))
                ->filter(static fn ($propertyData) => (
                    !in_array($propertyData['value'], [null, ''], true)
                ))
                ->map(static fn ($propertyData) => (
                    new MaterialProperty([
                        'property_id' => $propertyData['id'],
                        'value' => $propertyData['value'],
                    ])
                ));

            $errors = $properties
                ->filter(static fn ($property) => !$property->isValid())
                ->map(static fn ($property) => $property->validationErrors())
                ->all();

            if (!empty($errors)) {
                $validationErrors['properties'] = $errors;
            }
        }

        if (!empty($validationErrors)) {
            throw new ValidationException($validationErrors);
        }

        return dbTransaction(function () use ($tags, $properties) {
            $this->save();

            // - Tags
            if ($tags !== null) {
                $this->tags()->sync($tags);
            }

            // - Caractéristiques spéciales
            if ($properties !== null) {
                MaterialProperty::flushForMaterial($this);
                $this->properties()->saveMany($properties);
            }

            return $this->refresh();
        });
    }

    public function withAvailabilities(?PeriodInterface $period = null): static
    {
        return static::allWithAvailabilities(new Collection([$this]), $period)->get(0);
    }

    // ------------------------------------------------------
    // -
    // -    Méthodes de "repository"
    // -
    // ------------------------------------------------------

    /**
     * @param int $parkId
     *
     * @return Collection<array-key, Material>
     */
    public static function getParkAll(int $parkId)
    {
        return static::inPark($parkId)
            ->get();
    }

    // ------------------------------------------------------
    // -
    // -    Query Scopes
    // -
    // ------------------------------------------------------

    protected $orderable = [
        'name',
        'reference',
        'rental_price',
        'stock_quantity',
        'out_of_order_quantity',
    ];

    public function scopeSearch(Builder $query, string|array $term): Builder
    {
        if (is_array($term)) {
            $query->where(static function (Builder $subQuery) use ($term) {
                foreach ($term as $singleTerm) {
                    $subQuery->orWhere(static fn (Builder $subSubQuery) => (
                        $subSubQuery->search($singleTerm)
                    ));
                }
            });
            return $query;
        }
        Assert::minLength($term, 2, "The term must contain more than two characters.");

        $safeTerm = addcslashes($term, '%_');
        $likeTerm = sprintf('%%%s%%', $safeTerm);
        return $query->where(static fn (Builder $subQuery) => (
            $subQuery
                ->orWhere('name', 'LIKE', $likeTerm)
                ->orWhere('reference', 'LIKE', $likeTerm)
        ));
    }

    /**
     * Permet de récupérer uniquement le matériel lié à un parc donné.
     *
     * @param Builder $query
     * @param int $parkId - Le parc concerné.
     */
    public function scopeInPark(Builder $query, int $parkId): Builder
    {
        return $query->where(static function (Builder $query) use ($parkId) {
            $query->where(static function ($subQuery) use ($parkId) {
                $subQuery
                    ->where('park_id', $parkId);
            });
        });
    }

    /**
     * Permet de récupérer uniquement le matériel ne faisant pas partie d'un parc donné.
     *
     * @param Builder $query
     * @param array $parks - Les identifiants des parcs dont on ne veut pas le matériel.
     */
    public function scopeNotInParks(Builder $query, array $parks): Builder
    {
        return $query
            ->where(static fn (Builder $subQuery) => (
                $subQuery
                    ->whereNotIn('park_id', $parks)
            ));
    }

    public function scopeCustomOrderBy(Builder $query, string $column, string $direction = 'asc'): Builder
    {
        if (!in_array($column, ['stock_quantity', 'out_of_order_quantity'], true)) {
            return parent::scopeCustomOrderBy($query, $column, $direction);
        }

        if ($column === 'stock_quantity') {
            return $query
                ->orderBy(
                    'stock_quantity',
                    $direction,
                );
        }

        if ($column === 'out_of_order_quantity') {
            return $query
                ->orderBy(
                    'out_of_order_quantity',
                    $direction,
                );
        }

        return $query;
    }

    public function scopePrepareSerialize(Builder $query, string $format = self::SERIALIZE_DEFAULT): Builder
    {
        $query->with([
            'tags',
            'properties' => [
                'property' => [
                    'categories',
                ],
            ],
        ]);

        return $query;
    }

    // ------------------------------------------------------
    // -
    // -    Méthodes utilitaires
    // -
    // ------------------------------------------------------

    /**
     * Permet de récupérer la collection de matériel passée en argument, dans laquelle
     * sont injectées les données de disponibilités, pour une période donnée.
     *
     * Si un événement est fourni en tant que `$context`, son propre
     * matériel sera exclu du calcul des disponibilités.
     *
     * Ces disponibilités dépendent de la valeur du paramètre `$context` qui peut contenir:
     * - Soit une instance implémentant `PeriodInterface` dont les dates seront utilisées pour les dispos.
     * - Soit `null` si les disponibilités doivent être récupérées sans prendre en compte de période.
     *
     * @template TCollection of Collection<array-key, Material>|LazyCollection<array-key, Material>
     *
     * @param TCollection $materials La liste du matériel.
     * @param PeriodInterface|null $context Le booking (ou simple Period) à utiliser comme limite de temps.
     *
     * @return TCollection
     */
    public static function allWithAvailabilities(
        Collection|LazyCollection $materials,
        ?PeriodInterface $context = null,
    ): Collection|LazyCollection {
        if ($materials->isEmpty()) {
            return new Collection([]);
        }

        $period = match (true) {
            // - Dans le cas d'un événement, on
            //   utilise la période de mobilisation car on ne veut pas
            //   considérer la période de retard dans le calcul des
            //   disponibilités de l'événement.
            $context instanceof Event => (
                $context->mobilization_period
            ),
            default => $context !== null ? new Period($context) : null,
        };

        $otherBorrowings = new Collection();
        if ($period !== null) {
            $otherBorrowingProcessor = static fn (Event $borrowing) => [
                'period' => new Period($borrowing->getStartDate(), $borrowing->getEndDate()),
                'materials' => $borrowing->materials->reduce(
                    static function ($acc, $borrowingMaterial) {
                        $acc[$borrowingMaterial->material_id] = [
                            'quantity' => $borrowingMaterial->quantity,
                        ];
                        return $acc;
                    },
                    [],
                ),
            ];

            $otherBorrowings = (new Collection())
                // - Événements.
                ->concat(
                    Event::inPeriod($period, withOverdue: true)
                        ->with([
                            'materials' => [
                                'material',
                            ],
                        ])
                        ->when(
                            $context instanceof Event && $context->exists,
                            static function (Builder $query) use ($context) {
                                /** @var Event $context */
                                $query->where('id', '!=', $context->id);
                            },
                        )
                        ->chunkMap($otherBorrowingProcessor, 500),
                );

            /** @var CoreCollection<array-key, array> $otherBorrowings */
            $otherBorrowings = $otherBorrowings
                ->sortBy(static fn ($otherBorrowing) => (
                    $otherBorrowing['period']->getStartDate()
                ))
                ->values();
        }

        // - Groupe les bookings concurrents par périodes pour pouvoir
        //   ensuite récupérer les périodes de sortie des matériels.
        $otherBorrowingsByPeriods = $otherBorrowings
            ->reduce(
                static fn ($dates, $otherBorrowing) => $dates->push(
                    $otherBorrowing['period']->getStartDate()->format('Y-m-d H:i:s'),
                    $otherBorrowing['period']->getEndDate()?->format('Y-m-d H:i:s'),
                ),
                new CoreCollection(),
            )
            ->unique()
            ->sort(static function ($a, $b) {
                if ($a === $b) {
                    return 0;
                }
                if ($a === null || $b === null) {
                    return $a === null ? 1 : -1;
                }
                return strtotime($a) < strtotime($b) ? -1 : 1;
            })
            ->values()
            ->sliding(2)
            ->mapSpread(static function ($startDate, $endDate) use ($otherBorrowings) {
                $period = new Period($startDate, $endDate);
                return $otherBorrowings->filter(static fn ($otherBorrowing) => (
                    $period->overlaps($otherBorrowing['period'])
                ));
            });

        // - Optimisation: Plus utilisé après et potentiellement volumineux.
        unset($otherBorrowings);

        // - Récupération des quantités utilisées pour chaque
        //   matériel pendant la période pour utilisation ultérieure.
        $materialsUsage = new CoreCollection();
        foreach ($otherBorrowingsByPeriods as $periodIndex => $otherBorrowingsPeriod) {
            /** @var Event $otherBorrowing */
            foreach ($otherBorrowingsPeriod as $otherBorrowing) {
                foreach ($otherBorrowing['materials'] as $materialId => $material) {
                    $quantity = $material['quantity'];

                    // - Si le matériel était déjà présent dans une autre période.
                    $existingUsage = $materialsUsage->get($materialId);
                    $quantities = $existingUsage['quantities'] ?? [];
                    if ($existingUsage !== null) {
                        $quantity += $quantities[$periodIndex] ?? 0;
                    }

                    $materialsUsage->put($materialId, [
                        'quantities' => array_replace($quantities, [$periodIndex => $quantity]),
                    ]);
                }
            }
        }

        // - Optimisation: Plus utilisé après et potentiellement volumineux.
        unset($otherBorrowingsByPeriods);

        return $materials
            ->chunk(500)
            ->flatMap(static fn (Collection|LazyCollection $chunk) => (
                (new Collection($chunk))
                    ->map(static function ($material) use ($materialsUsage) {
                        $material = clone $material;
                        $materialUsage = $materialsUsage->get($material->id, [
                            'quantities' => [0],
                        ]);

                        $usedCount = max($materialUsage['quantities']);
                        // phpcs:ignore Generic.Files.LineLength
                        $availableQuantity = (int) $material->stock_quantity - (int) $material->out_of_order_quantity;
                        $material->available_quantity = max($availableQuantity - $usedCount, 0);

                        return $material;
                    })
            ))
            ->pipe(static fn ($collection) => (
                $collection instanceof CoreCollection
                    ? new Collection($collection)
                    : $collection
            ));
    }

    // ------------------------------------------------------
    // -
    // -    Serialization
    // -
    // ------------------------------------------------------

    public function serialize(string $format = self::SERIALIZE_DEFAULT): array
    {
        $formatsWithContext = [
            self::SERIALIZE_WITH_CONTEXT,
            self::SERIALIZE_WITH_CONTEXT_EXCERPT,
            self::SERIALIZE_PUBLIC,
        ];
        if (in_array($format, $formatsWithContext, true) && $this->context === null) {
            throw new \LogicException(
                'The `context` attribute should be specified ' .
                'when using formats with contextual data.',
            );
        }

        /** @var Material $material */
        $material = tap(clone $this, static function (Material $material) use ($format) {
            $material->append(['tags', 'properties']);

            switch ($format) {
                case self::SERIALIZE_WITH_AVAILABILITY:
                case self::SERIALIZE_WITH_CONTEXT:
                    $material->append([
                        'available_quantity',
                        'is_deleted',
                    ]);
                    break;

                case self::SERIALIZE_WITH_CONTEXT_EXCERPT:
                    $material->append(['is_deleted']);
                    break;

                case self::SERIALIZE_PUBLIC:
                    $material->append(['available_quantity']);
                    break;

                case self::SERIALIZE_DETAILS:
                    $material->append(['available_quantity']);
                    break;
            }
        });

        $data = $material->attributesForSerialization();
        if (in_array($format, $formatsWithContext, true)) {
            $data['degressive_rate'] = $material->degressive_rate_context;
            $data['rental_price_period'] = $material->rental_price_context;
        }

        if ($format === self::SERIALIZE_DETAILS) {
            $data['return_inventory_todo'] = null;
            if ($material->return_inventory_todo !== null) {
                $bookingClass = $material->return_inventory_todo::class;
                $data['return_inventory_todo'] = $material
                    ->return_inventory_todo
                    ->serialize($bookingClass::SERIALIZE_BOOKING_SUMMARY);
            }

            $data['departure_inventory_todo'] = null;
            if ($material->departure_inventory_todo !== null) {
                $bookingClass = $material->departure_inventory_todo::class;
                $data['departure_inventory_todo'] = $material
                    ->departure_inventory_todo
                    ->serialize($bookingClass::SERIALIZE_BOOKING_SUMMARY);
            }
        }

        if ($format === self::SERIALIZE_PUBLIC) {
            return Arr::only($data, [
                'id',
                'name',
                'description',
                'picture',
                'degressive_rate',
                'available_quantity',
                'rental_price',
                'rental_price_period',
            ]);
        }

        return Arr::except($data, [
            'is_unitary',
            'is_reservable',
            'park_location_id',
            'deleted_at',
        ]);
    }
}
