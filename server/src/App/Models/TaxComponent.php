<?php
declare(strict_types=1);

namespace Loxya\Models;

use Adbar\Dot as DotArray;
use Brick\Math\BigDecimal as Decimal;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Loxya\Config\Config;
use Loxya\Contracts\Serializable;
use Loxya\Models\Casts\AsDecimal;
use Loxya\Models\Traits\Serializer;
use Loxya\Support\Arr;
use Loxya\Support\Validation\Validator as V;

/**
 * Une composante de taxe.
 *
 * @property-read ?int $id
 * @property int $tax_id
 * @property-read Tax $tax
 * @property string $name
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
            'value' => V::custom([$this, 'checkValue']),
        ];
    }

    // ------------------------------------------------------
    // -
    // -    Validation
    // -
    // ------------------------------------------------------

    public function checkTaxId(mixed $value)
    {
        V::nullable(V::intVal())->check($value);

        // - L'identifiant de la taxe n'est pas encore défini, on skip.
        if (!$this->exists && $value === null) {
            return true;
        }

        $tax = Tax::find($value);
        return $tax?->is_group ?? false;
    }

    public function checkName(mixed $value)
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

    public function checkValue(mixed $value)
    {
        V::floatVal()->check($value);
        $value = Decimal::of($value);

        $isValid = (
            $value->isGreaterThanOrEqualTo(0) &&
            $value->isLessThanOrEqualTo(100) &&
            $value->getScale() <= 3
        );
        if (!$isValid) {
            return false;
        }

        // - Si le pays du vendeur a une liste de taux autorisés,
        //   on s'assure que le taux en fait partie.
        $organizationCountry = Config::getOrganizationCountry();
        $allowedRates = $organizationCountry->getVatRates(extended: true);
        $isAcceptableRate = (
            $allowedRates === null ||
            Arr::some($allowedRates, static fn ($allowedRate) => (
                Decimal::of($allowedRate)->isEqualTo($value)
            ))
        );
        return $isAcceptableRate ?: 'tax-rate-not-allowed-for-country';
    }

    // ------------------------------------------------------
    // -
    // -    Relations
    // -
    // ------------------------------------------------------

    public function tax(): BelongsTo
    {
        return $this->belongsTo(Tax::class);
    }

    // ------------------------------------------------------
    // -
    // -    Mutators
    // -
    // ------------------------------------------------------

    protected $casts = [
        'tax_id' => 'integer',
        'name' => 'string',
        'value' => AsDecimal::class,
    ];

    // ------------------------------------------------------
    // -
    // -    Setters
    // -
    // ------------------------------------------------------

    protected $fillable = [
        'name',
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
