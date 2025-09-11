<?php
declare(strict_types=1);

namespace Loxya\Models;

use Adbar\Dot as DotArray;
use Brick\Math\BigDecimal as Decimal;
use Brick\Math\RoundingMode;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\LazyCollection;
use Loxya\Contracts\Serializable;
use Loxya\Models\Traits\Serializer;
use Loxya\Support\Arr;
use Loxya\Support\Assert;
use Loxya\Support\Validation\Validator as V;

/**
 * Parc de matériel.
 *
 * @property-read ?int $id
 * @property string $name
 * @property string|null $street
 * @property string|null $postal_code
 * @property string|null $locality
 * @property int|null $country_id
 * @property-read Country|null $country
 * @property string|null $opening_hours
 * @property string|null $note
 * @property-read int $total_items
 * @property-read int $total_stock_quantity
 * @property-read Decimal $total_amount
 * @property-read bool $has_ongoing_booking
 * @property-read CarbonImmutable $created_at
 * @property-read CarbonImmutable|null $updated_at
 * @property-read CarbonImmutable|null $deleted_at
 *
 * @property-read Collection<array-key, Material> $materials
 *
 * @method static Builder|static search(string|string[] $term)
 */
final class Park extends BaseModel implements Serializable
{
    use Serializer;
    use SoftDeletes;

    // - Types de sérialisation.
    public const SERIALIZE_DEFAULT = 'default';
    public const SERIALIZE_SUMMARY = 'summary';
    public const SERIALIZE_DETAILS = 'details';

    public function __construct(array $attributes = [])
    {
        parent::__construct($attributes);

        $this->validation = fn () => [
            'name' => V::custom([$this, 'checkName']),
            'street' => V::optional(V::length(null, 191)),
            'postal_code' => V::optional(V::length(null, 10)),
            'locality' => V::optional(V::length(null, 191)),
            'country_id' => V::custom([$this, 'checkCountryId']),
            'opening_hours' => V::optional(V::length(null, 255)),
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
            ->withTrashed()
            ->exists();

        return !$alreadyExists ?: 'park-name-already-in-use';
    }

    public function checkCountryId($value)
    {
        V::nullable(V::intVal())->check($value);
        return $value === null || Country::includes($value);
    }

    // ------------------------------------------------------
    // -
    // -    Relations
    // -
    // ------------------------------------------------------

    public function materials(): HasMany
    {
        return $this->hasMany(Material::class)
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

    protected $casts = [
        'name' => 'string',
        'street' => 'string',
        'postal_code' => 'string',
        'locality' => 'string',
        'country_id' => 'integer',
        'opening_hours' => 'string',
        'note' => 'string',
        'created_at' => 'immutable_datetime',
        'updated_at' => 'immutable_datetime',
        'deleted_at' => 'immutable_datetime',
    ];

    public function getTotalItemsAttribute(): int
    {
        return $this->materials()->count();
    }

    public function getTotalStockQuantityAttribute(): int
    {
        $total = 0;

        $materials = $this->materials()->get(['stock_quantity']);
        foreach ($materials as $material) {
            $total += (int) $material->stock_quantity;
        }

        return $total;
    }

    public function getTotalAmountAttribute(): Decimal
    {
        return Material::getParkAll($this->id)
            ->reduce(
                static fn (Decimal $currentTotal, Material $material) => (
                    $currentTotal->plus(
                        ($material->replacement_price ?? Decimal::zero())
                            ->multipliedBy((int) $material->stock_quantity),
                    )
                ),
                Decimal::zero(),
            )
            ->toScale(2, RoundingMode::UNNECESSARY);
    }

    public function getHasOngoingBookingAttribute(): bool
    {
        if (!$this->exists || !$this->id) {
            return false;
        }

        $ongoingBookings = (new LazyCollection())
            ->concat(
                Event::inProgress()
                    ->with('materials')
                    ->lazy(100),
            );

        return $ongoingBookings->some(fn (Event $ongoingBooking) => (
            $ongoingBooking->materials->some(
                fn (EventMaterial $bookingMaterial) => (
                    $bookingMaterial->material->park_id === $this->id
                ),
            )
        ));
    }

    // ------------------------------------------------------
    // -
    // -    Setters
    // -
    // ------------------------------------------------------

    protected $fillable = [
        'name',
        'street',
        'postal_code',
        'locality',
        'country_id',
        'opening_hours',
        'note',
    ];

    public function delete()
    {
        if ($this->total_items > 0) {
            throw new \LogicException(
                sprintf("The park #%d contains material and therefore cannot be deleted.", $this->id),
            );
        }

        return parent::delete();
    }

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
    // -    Serialization
    // -
    // ------------------------------------------------------

    public function serialize(string $format = self::SERIALIZE_DEFAULT): array
    {
        /** @var Park $park */
        $park = tap(clone $this, static function (Park $park) use ($format) {
            if ($format !== self::SERIALIZE_SUMMARY) {
                $park->append([
                    'total_items',
                    'total_stock_quantity',
                ]);
            }

            if ($format === self::SERIALIZE_DETAILS) {
                $park->append([
                    'has_ongoing_booking',
                ]);
            }
        });

        $data = (new DotArray($park->attributesForSerialization()))
            ->delete(['created_at', 'updated_at', 'deleted_at'])
            ->all();

        return $format === self::SERIALIZE_SUMMARY
            ? Arr::only($data, ['id', 'name'])
            : $data;
    }
}
