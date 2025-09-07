<?php
declare(strict_types=1);

namespace Loxya\Models;

use Adbar\Dot as DotArray;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Loxya\Contracts\Serializable;
use Loxya\Errors\Exception\ValidationException;
use Loxya\Models\Traits\Serializer;
use Loxya\Support\Validation\Validator as V;

/**
 * Catégorie de matériel.
 *
 * @property-read ?int $id
 * @property string $name
 * @property-read bool $has_sub_categories
 * @property-read CarbonImmutable $created_at
 * @property-read CarbonImmutable|null $updated_at
 *
 * @property-read Collection<array-key, SubCategory> $subCategories
 * @property-read Collection<array-key, SubCategory> $sub_categories
 * @property-read Collection<array-key, Material> $materials
 * @property-read Collection<array-key, Property> $properties
 */
final class Category extends BaseModel implements Serializable
{
    use Serializer;

    // - Types de sérialisation.
    public const SERIALIZE_DEFAULT = 'default';
    public const SERIALIZE_DETAILS = 'details';

    public function __construct(array $attributes = [])
    {
        parent::__construct($attributes);

        $this->validation = fn () => [
            'name' => V::custom([$this, 'checkName']),
        ];
    }

    // ------------------------------------------------------
    // -
    // -    Validation
    // -
    // ------------------------------------------------------

    public function checkName($value)
    {
        V::notEmpty()
            ->length(2, 96)
            ->check($value);

        $alreadyExists = static::query()
            ->where('name', $value)
            ->when($this->exists, fn (Builder $subQuery) => (
                $subQuery->where('id', '!=', $this->id)
            ))
            ->exists();

        return !$alreadyExists ?: 'category-name-already-in-use';
    }

    // ------------------------------------------------------
    // -
    // -    Relations
    // -
    // ------------------------------------------------------

    public function subCategories(): HasMany
    {
        return $this->hasMany(SubCategory::class)
            ->orderBy('name');
    }

    public function materials(): HasMany
    {
        return $this->hasMany(Material::class)
            ->orderBy('id');
    }

    public function properties(): BelongsToMany
    {
        return $this->belongsToMany(Property::class, 'property_categories')
            ->using(PropertyCategory::class)
            ->select([
                'properties.id',
                'properties.name',
                'properties.type',
                'properties.unit',
            ])
            ->orderBy('id');
    }

    // ------------------------------------------------------
    // -
    // -    Mutators
    // -
    // ------------------------------------------------------

    protected $casts = [
        'name' => 'string',
        'created_at' => 'immutable_datetime',
        'updated_at' => 'immutable_datetime',
    ];

    /** @return Collection<array-key, SubCategory> */
    public function getSubCategoriesAttribute(): Collection
    {
        return $this->getRelationValue('subCategories');
    }

    public function getHasSubCategoriesAttribute(): bool
    {
        return $this->subCategories->isNotEmpty();
    }

    // ------------------------------------------------------
    // -
    // -    Setters
    // -
    // ------------------------------------------------------

    protected $fillable = ['name'];

    // ------------------------------------------------------
    // -
    // -    Méthodes liées à une "entity"
    // -
    // ------------------------------------------------------

    public function edit(array $data): static
    {
        return dbTransaction(function () use ($data) {
            $hasFailed = false;
            $validationErrors = [];

            try {
                $this->fill($data)->save();
            } catch (ValidationException $e) {
                $validationErrors = $e->getValidationErrors();
                $hasFailed = true;
            }

            if ($hasFailed) {
                throw new ValidationException($validationErrors);
            }

            return $this->refresh();
        });
    }

    // ------------------------------------------------------
    // -
    // -    Méthodes de "repository"
    // -
    // ------------------------------------------------------

    public static function bulkAdd(array $categoriesNames = []): array
    {
        $categories = array_map(
            static function ($categoryName) {
                $existingCategory = static::where('name', $categoryName)->first();
                if ($existingCategory) {
                    return $existingCategory;
                }

                $category = new static(['name' => trim($categoryName)]);
                return tap($category, static function ($instance) {
                    $instance->validate();
                });
            },
            $categoriesNames,
        );

        return dbTransaction(static function () use ($categories) {
            foreach ($categories as $category) {
                if (!$category->exists || $category->isDirty()) {
                    $category->save();
                    $category->refresh();
                }
            }
            return $categories;
        });
    }

    // ------------------------------------------------------
    // -
    // -    Serialization
    // -
    // ------------------------------------------------------

    public function serialize(string $format = self::SERIALIZE_DEFAULT): array
    {
        /** @var Category $category */
        $category = tap(clone $this, static function (Category $category) use ($format) {
            if ($format === self::SERIALIZE_DETAILS) {
                return $category->append('sub_categories');
            }
        });

        return (new DotArray($category->attributesForSerialization()))
            ->delete(['created_at', 'updated_at'])
            ->all();
    }
}
