<?php
declare(strict_types=1);

namespace Loxya\Models;

use Adbar\Dot as DotArray;
use Brick\Math\BigDecimal as Decimal;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Loxya\Contracts\Serializable;
use Loxya\Models\Casts\AsDecimal;
use Loxya\Models\Traits\Serializer;
use Loxya\Support\Validation\Validator as V;

/**
 * Palier de tarif dégressif.
 *
 * @property-read ?int $id
 * @property int $degressive_rate_id
 * @property-read DegressiveRate $degressive_rate
 * @property-read DegressiveRate $degressiveRate
 * @property int $from_day
 * @property bool $is_rate
 * @property Decimal $value
 */
final class DegressiveRateTier extends BaseModel implements Serializable
{
    use Serializer;

    protected $table = 'degressive_rate_tiers';
    public $timestamps = false;

    public function __construct(array $attributes = [])
    {
        parent::__construct($attributes);

        $this->validation = fn () => [
            'degressive_rate_id' => V::custom([$this, 'checkDegressiveRateId']),
            'from_day' => V::custom([$this, 'checkFromDay']),
            'is_rate' => V::boolType(),
            'value' => V::custom([$this, 'checkValue']),
        ];
    }

    // ------------------------------------------------------
    // -
    // -    Validation
    // -
    // ------------------------------------------------------

    public function checkDegressiveRateId($value)
    {
        V::nullable(V::intVal())->check($value);

        // - L'identifiant du tarif dégressif n'est pas encore défini, on skip.
        if (!$this->exists && $value === null) {
            return true;
        }

        return DegressiveRate::includes($value);
    }

    public function checkFromDay($value)
    {
        V::intVal()->min(1)->check($value);

        $degressiveRateId = $this->getAttributeUnsafeValue('degressive_rate_id');
        if ($degressiveRateId === null || !V::numericVal()->validate($degressiveRateId)) {
            return true;
        }

        $alreadyExists = static::query()
            ->where('from_day', $value)
            ->where('degressive_rate_id', (int) $degressiveRateId)
            ->when($this->exists, fn (Builder $subQuery) => (
                $subQuery->where('id', '!=', $this->id)
            ))
            ->exists();

        return !$alreadyExists ?: 'degressive-rate-day-already-exists';
    }

    public function checkValue($value)
    {
        V::floatVal()->check($value);
        $value = Decimal::of($value);

        $isValid = (
            $value->isGreaterThanOrEqualTo(0) &&
            $value->isLessThan(100_000) &&
            $value->getScale() <= 2
        );
        if (!$isValid) {
            return false;
        }

        $isRate = $this->getAttributeUnsafeValue('is_rate');
        if (!V::boolType()->validate($isRate) || !$isRate) {
            return true;
        }

        // - Si c'est un pourcentage, il doit être inférieur ou égal à 100%.
        return $value->isLessThanOrEqualTo(100);
    }

    // ------------------------------------------------------
    // -
    // -    Relations
    // -
    // ------------------------------------------------------

    public function degressiveRate(): BelongsTo
    {
        return $this->belongsTo(DegressiveRate::class);
    }

    // ------------------------------------------------------
    // -
    // -    Mutators
    // -
    // ------------------------------------------------------

    protected $casts = [
        'degressive_rate_id' => 'integer',
        'from_day' => 'integer',
        'is_rate' => 'boolean',
        'value' => AsDecimal::class,
    ];

    // ------------------------------------------------------
    // -
    // -    Setters
    // -
    // ------------------------------------------------------

    protected $fillable = [
        'from_day',
        'is_rate',
        'value',
    ];

    // ------------------------------------------------------
    // -
    // -    Méthodes de "repository"
    // -
    // ------------------------------------------------------

    public static function flushForDegressiveRate(DegressiveRate $degressiveRate): void
    {
        if (!$degressiveRate->exists) {
            return;
        }

        static::whereBelongsTo($degressiveRate)
            ->get()->each->delete();
    }

    // ------------------------------------------------------
    // -
    // -    Serialization
    // -
    // ------------------------------------------------------

    public function serialize(): array
    {
        return (new DotArray($this->attributesForSerialization()))
            ->delete(['id', 'degressive_rate_id'])
            ->all();
    }
}
