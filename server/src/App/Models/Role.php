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
use Loxya\Models\Traits\Serializer;
use Loxya\Support\Assert;
use Loxya\Support\Validation\Validator as V;

/**
 * Rôle sur un événement.
 *
 * @property-read ?int $id
 * @property string $name
 * @property-read bool $is_used
 * @property-read CarbonImmutable $created_at
 * @property-read CarbonImmutable|null $updated_at
 *
 * @property-read Collection<array-key, Technician> $technicians
 * @property-read Collection<array-key, EventTechnician> $eventAssignments
 * @property-read Collection<array-key, EventPosition> $eventPositions
 *
 * @method static Builder|static search(string|string[] $term)
 */
final class Role extends BaseModel implements Serializable
{
    use Serializer;

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
            ->length(2, 191)
            ->check($value);

        $alreadyExists = static::query()
            ->where('name', $value)
            ->when($this->exists, fn (Builder $subQuery) => (
                $subQuery->where('id', '!=', $this->id)
            ))
            ->exists();

        return !$alreadyExists ?: 'role-name-already-in-use';
    }

    // ------------------------------------------------------
    // -
    // -    Relations
    // -
    // ------------------------------------------------------

    public function technicians(): BelongsToMany
    {
        return $this->belongsToMany(Technician::class, 'technician_roles')
            ->orderBy('id');
    }

    public function eventAssignments(): HasMany
    {
        return $this->hasMany(EventTechnician::class, 'role_id')
            ->orderBy('id');
    }

    public function eventPositions(): HasMany
    {
        return $this->hasMany(EventPosition::class, 'role_id')
            ->orderBy('id');
    }

    // ------------------------------------------------------
    // -
    // -    Mutators
    // -
    // ------------------------------------------------------

    protected $appends = [
        'is_used',
    ];

    protected $casts = [
        'name' => 'string',
        'is_used' => 'boolean',
        'created_at' => 'immutable_datetime',
        'updated_at' => 'immutable_datetime',
    ];

    public function getIsUsedAttribute(): bool
    {
        if (!$this->exists) {
            return false;
        }
        return $this->technicians->isNotEmpty();
    }

    // ------------------------------------------------------
    // -
    // -    Setters
    // -
    // ------------------------------------------------------

    protected $fillable = ['name'];

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
