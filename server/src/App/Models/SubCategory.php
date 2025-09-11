<?php
declare(strict_types=1);

namespace Loxya\Models;

use Adbar\Dot as DotArray;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Loxya\Contracts\Serializable;
use Loxya\Models\Traits\Serializer;
use Loxya\Support\Assert;
use Loxya\Support\Validation\Validator as V;

/**
 * Sous-catégorie de matériel.
 *
 * @property-read ?int $id
 * @property string $name
 * @property int $category_id
 * @property-read Category $category
 * @property-read CarbonImmutable $created_at
 * @property-read CarbonImmutable|null $updated_at
 *
 * @property-read Collection<array-key, Material> $materials
 *
 * @method static Builder|static search(string|string[] $term)
 */
final class SubCategory extends BaseModel implements Serializable
{
    use Serializer;

    public function __construct(array $attributes = [])
    {
        parent::__construct($attributes);

        $this->validation = fn () => [
            'name' => V::custom([$this, 'checkName']),
            'category_id' => V::custom([$this, 'checkCategoryId']),
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

        if (empty($this->category_id)) {
            return true;
        }

        $alreadyExists = static::query()
            ->where('name', $value)
            ->where('category_id', $this->category_id)
            ->when($this->exists, fn (Builder $subQuery) => (
                $subQuery->where('id', '!=', $this->id)
            ))
            ->exists();

        return !$alreadyExists ?: 'subcategory-already-in-use-for-this-category';
    }

    public function checkCategoryId($value)
    {
        V::notEmpty()->intVal()->check($value);
        return Category::includes($value);
    }

    // ------------------------------------------------------
    // -
    // -    Relations
    // -
    // ------------------------------------------------------

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function materials(): HasMany
    {
        $fields = [
            'id',
            'name',
            'description',
            'reference',
            'park_id',
            'rental_price',
            'stock_quantity',
            'out_of_order_quantity',
            'replacement_price',
        ];

        return $this->hasMany(Material::class)
            ->select($fields)
            ->orderBy('id');
    }

    // ------------------------------------------------------
    // -
    // -    Mutators
    // -
    // ------------------------------------------------------

    protected $casts = [
        'name' => 'string',
        'category_id' => 'integer',
        'created_at' => 'immutable_datetime',
        'updated_at' => 'immutable_datetime',
    ];

    // ------------------------------------------------------
    // -
    // -    Setters
    // -
    // ------------------------------------------------------

    protected $fillable = [
        'name',
        'category_id',
    ];

    // ------------------------------------------------------
    // -
    // -    Query Scopes
    // -
    // ------------------------------------------------------

    protected $orderable = ['name'];

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

        $term = sprintf('%%%s%%', addcslashes($term, '%_'));
        return $query->where('name', 'LIKE', $term);
    }

    // ------------------------------------------------------
    // -
    // -    Serialization
    // -
    // ------------------------------------------------------

    public function serialize(): array
    {
        return (new DotArray($this->attributesForSerialization()))
            ->delete(['created_at', 'updated_at'])
            ->all();
    }
}
