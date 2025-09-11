<?php
declare(strict_types=1);

namespace Loxya\Models;

use Adbar\Dot as DotArray;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Loxya\Contracts\Serializable;
use Loxya\Models\Traits\Serializer;
use Loxya\Support\Assert;
use Loxya\Support\Validation\Validator as V;

/**
 * Pays.
 *
 * @property-read ?int $id
 * @property string $name
 * @property string $code
 * @property-read CarbonImmutable $created_at
 * @property-read CarbonImmutable|null $updated_at
 *
 * @method static Builder|static search(string|string[] $term)
 */
final class Country extends BaseModel implements Serializable
{
    use Serializer;

    public function __construct(array $attributes = [])
    {
        parent::__construct($attributes);

        $this->validation = fn () => [
            'name' => V::custom([$this, 'checkName']),
            'code' => V::custom([$this, 'checkCode']),
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
            ->stringType()
            ->length(4, 96)
            ->check($value);

        $alreadyExists = static::query()
            ->where('name', $value)
            ->when($this->exists, fn (Builder $subQuery) => (
                $subQuery->where('id', '!=', $this->id)
            ))
            ->exists();

        return !$alreadyExists ?: 'country-name-already-in-use';
    }

    public function checkCode($value)
    {
        V::notEmpty()
            ->alpha()
            ->length(4, 4)
            ->check($value);

        $alreadyExists = static::query()
            ->where('code', $value)
            ->when($this->exists, fn (Builder $subQuery) => (
                $subQuery->where('id', '!=', $this->id)
            ))
            ->exists();

        return !$alreadyExists ?: 'country-code-already-in-use';
    }

    // ------------------------------------------------------
    // -
    // -    Mutators
    // -
    // ------------------------------------------------------

    protected $casts = [
        'name' => 'string',
        'code' => 'string',
        'created_at' => 'immutable_datetime',
        'updated_at' => 'immutable_datetime',
    ];

    // ------------------------------------------------------
    // -
    // -    Setters
    // -
    // ------------------------------------------------------

    protected $fillable = ['name', 'code'];

    // ------------------------------------------------------
    // -
    // -    Query Scopes
    // -
    // ------------------------------------------------------

    protected $orderable = [
        'name',
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

        $term = sprintf('%%%s%%', addcslashes($term, '%_'));
        return $query->where('name', 'LIKE', $term);
    }

    // ------------------------------------------------------
    // -
    // -    Méthodes de "repository"
    // -
    // ------------------------------------------------------

    /**
     * Tente de retrouver un pays à partir de son code.
     *
     * @param string $code Le code du pays à rechercher.
     *
     * @return static|null Le pays correspondant, ou `null` s'il n'a pas été trouvé.
     */
    public static function tryFromCode(string $code): static|null
    {
        return static::where('code', $code)->first();
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
