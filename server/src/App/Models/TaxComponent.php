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
 * Une composante de taxe.
 *
 * @property-read ?int $id
 * @property int $tax_id
 * @property-read Tax $tax
 * @property string $name
 * @property bool $is_rate
 * @property Decimal $value
 */
final class TaxComponent extends BaseModel implements Serializable
{
    use Serializer;

    protected $table = 'tax_components';
    public $timestamps = false;

    public function __construct(array $attributes = [])
    {
        parent::__construct($attributes);

        $this->validation = fn () => [
            'tax_id' => V::custom([$this, 'checkTaxId']),
            'name' => V::custom([$this, 'checkName']),
            'is_rate' => V::boolType(),
            'value' => V::custom([$this, 'checkValue']),
        ];
    }

    // ------------------------------------------------------
    // -
    // -    Validation
    // -
    // ------------------------------------------------------

    public function checkTaxId($value)
    {
        V::nullable(V::intVal())->check($value);

        // - L'identifiant de la taxe n'est pas encore défini, on skip.
        if (!$this->exists && $value === null) {
            return true;
        }

        $tax = Tax::find($value);
        return $tax?->is_group ?? false;
    }

    public function checkName($value)
    {
        V::notEmpty()
            ->length(1, 30)
            ->check($value);

        $taxId = $this->getAttributeUnsafeValue('tax_id');
        if ($taxId === null || !V::numericVal()->validate($taxId)) {
            return true;
        }

        $alreadyExists = static::query()
            ->where('name', $value)
            ->where('tax_id', (int) $taxId)
            ->when($this->exists, fn (Builder $subQuery) => (
                $subQuery->where('id', '!=', $this->id)
            ))
            ->exists();

        return !$alreadyExists ?: 'tax-component-name-already-in-use';
    }

    public function checkValue($value)
    {
        V::floatVal()->check($value);
        $value = Decimal::of($value);

        $isValid = (
            $value->isGreaterThanOrEqualTo(0) &&
            $value->isLessThan(1_000_000_000_000) &&
            $value->getScale() <= 3
        );
        if (!$isValid) {
            return false;
        }

        $isRate = $this->getAttributeUnsafeValue('is_rate');
        if (!V::boolType()->validate($isRate)) {
            return true;
        }

        return $isRate
            // - Si c'est un pourcentage, il doit être inférieur ou égal à 100%.
            ? $value->isLessThanOrEqualTo(100)
            // - Sinon si ce n'est pas un pourcentage, la précision doit être à 2 décimales max.
            : $value->getScale() <= 2;
    }

    // ------------------------------------------------------
    // -
    // -    Relations
    // -
    // ------------------------------------------------------

    public function tax(): BelongsTo
    {
        return $this->belongsTo(TaxComponent::class);
    }

    // ------------------------------------------------------
    // -
    // -    Mutators
    // -
    // ------------------------------------------------------

    protected $casts = [
        'tax_id' => 'integer',
        'name' => 'string',
        'is_rate' => 'boolean',
        'value' => AsDecimal::class,
    ];

    public function getValueAttribute(string $value): Decimal
    {
        /** @var Decimal $value */
        $value = $this->castAttribute('value', $value);
        return $value->toScale($this->is_rate ? 3 : 2);
    }

    // ------------------------------------------------------
    // -
    // -    Setters
    // -
    // ------------------------------------------------------

    protected $fillable = [
        'name',
        'is_rate',
        'value',
    ];

    // ------------------------------------------------------
    // -
    // -    Méthodes de "repository"
    // -
    // ------------------------------------------------------

    public static function flushForTax(Tax $tax): void
    {
        if (!$tax->exists) {
            return;
        }

        static::whereBelongsTo($tax)
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
            ->delete(['id', 'tax_id'])
            ->all();
    }
}
