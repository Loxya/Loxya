<?php
declare(strict_types=1);

namespace Loxya\Models;

use Adbar\Dot as DotArray;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;
use Loxya\Contracts\Serializable;
use Loxya\Models\Traits\Serializer;
use Loxya\Support\Assert;
use Loxya\Support\Validation\Validator as V;

/**
 * Société.
 *
 * @property-read ?int $id
 * @property string $legal_name
 * @property string $registration_id
 * @property string|null $phone
 * @property string|null $street
 * @property string|null $postal_code
 * @property string|null $locality
 * @property int|null $country_id
 * @property-read Country|null $country
 * @property-read string|null $full_address
 * @property string|null $note
 * @property-read CarbonImmutable $created_at
 * @property-read CarbonImmutable|null $updated_at
 * @property-read CarbonImmutable|null $deleted_at
 *
 * @property-read Collection<array-key, Beneficiary> $beneficiaries
 *
 * @method static Builder|static search(string|string[] $term)
 */
final class Company extends BaseModel implements Serializable
{
    use Serializer;
    use SoftDeletes;

    public function __construct(array $attributes = [])
    {
        parent::__construct($attributes);

        $this->validation = fn () => [
            'legal_name' => V::notEmpty()->length(2, 191),
            'registration_id' => V::nullable(V::alnum()->length(null, 50)),
            'street' => V::optional(V::length(null, 191)),
            'postal_code' => V::optional(V::length(null, 10)),
            'locality' => V::optional(V::length(null, 191)),
            'country_id' => V::custom([$this, 'checkCountryId']),
            'phone' => V::optional(V::phone()),
        ];
    }

    // ------------------------------------------------------
    // -
    // -    Validation
    // -
    // ------------------------------------------------------

    public function checkCountryId($value)
    {
        V::nullable(V::intVal())->check($value);

        return $value !== null
            ? Country::includes($value)
            : true;
    }

    // ------------------------------------------------------
    // -
    // -    Relations
    // -
    // ------------------------------------------------------

    public function beneficiaries(): HasMany
    {
        return $this->hasMany(Beneficiary::class)
            ->orderBy('id');
    }

    public function country(): BelongsTo
    {
        return $this->belongsTo(Country::class);
    }

    // ------------------------------------------------------
    // -
    // -    Mutators
    // -
    // ------------------------------------------------------

    protected $appends = [
        'full_address',
    ];

    protected $casts = [
        'legal_name' => 'string',
        'registration_id' => 'string',
        'street' => 'string',
        'postal_code' => 'string',
        'locality' => 'string',
        'country_id' => 'integer',
        'phone' => 'string',
        'note' => 'string',
        'created_at' => 'immutable_datetime',
        'updated_at' => 'immutable_datetime',
        'deleted_at' => 'immutable_datetime',
    ];

    public function getFullAddressAttribute(): string|null
    {
        $addressParts = [];

        $addressParts[] = trim($this->street ?? '');
        $addressParts[] = implode(' ', array_filter([
            trim($this->postal_code ?? ''),
            trim($this->locality ?? ''),
        ]));

        $addressParts = array_filter($addressParts);
        return !empty($addressParts) ? implode("\n", $addressParts) : null;
    }

    public function getCountryAttribute(): Country|null
    {
        return $this->getRelationValue('country');
    }

    // ------------------------------------------------------
    // -
    // -    Setters
    // -
    // ------------------------------------------------------

    protected $fillable = [
        'legal_name',
        'registration_id',
        'street',
        'postal_code',
        'locality',
        'country_id',
        'phone',
        'note',
    ];

    public function setRegistrationIdAttribute(mixed $value): void
    {
        $value = !empty($value) && is_string($value)
            ? Str::remove([' ', '-', '.', '/'], trim($value))
            : $value;

        $this->attributes['registration_id'] = $value === '' ? null : $value;
    }

    public function setPhoneAttribute(mixed $value): void
    {
        $value = !empty($value) && is_string($value)
            ? Str::remove(' ', trim($value))
            : $value;

        $this->attributes['phone'] = $value === '' ? null : $value;
    }

    // ------------------------------------------------------
    // -
    // -    Query Scopes
    // -
    // ------------------------------------------------------

    protected $orderable = [
        'legal_name',
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
        return $query->where(static fn (Builder $subQuery) => (
            $subQuery
                ->orWhere('legal_name', 'LIKE', sprintf('%%%s%%', $safeTerm))
                ->orWhere('registration_id', 'LIKE', vsprintf('%s%%', [
                    Str::remove([' ', '-', '.', '/'], $safeTerm),
                ]))
        ));
    }

    // ------------------------------------------------------
    // -
    // -    Serialization
    // -
    // ------------------------------------------------------

    public function serialize(): array
    {
        /** @var Company $company */
        $company = tap(clone $this, static function (Company $company) {
            $company->append(['country']);
        });

        return (new DotArray($company->attributesForSerialization()))
            ->delete(['created_at', 'updated_at', 'deleted_at'])
            ->all();
    }
}
