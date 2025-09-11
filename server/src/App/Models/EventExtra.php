<?php
declare(strict_types=1);

namespace Loxya\Models;

use Adbar\Dot as DotArray;
use Brick\Math\BigDecimal as Decimal;
use Brick\Math\RoundingMode;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Loxya\Contracts\Serializable;
use Loxya\Models\Casts\AsDecimal;
use Loxya\Models\Traits\Serializer;
use Loxya\Support\Validation\Rules\SchemaStrict;
use Loxya\Support\Validation\Validator as V;
use Respect\Validation\Rules as Rule;

/**
 * Ligne de facturation supplémentaire dans un événement.
 *
 * @property-read ?int $id
 * @property int $event_id
 * @property-read Event $event
 * @property string $description
 * @property int $quantity
 * @property Decimal $unit_price
 * @property-read Decimal $total_without_taxes
 * @property int|null $tax_id
 * @property-read Tax|null $liveTax
 * @property array|null $taxes
 */
final class EventExtra extends BaseModel implements Serializable
{
    use Serializer;

    protected $table = 'event_extras';
    public $timestamps = false;

    public function __construct(array $attributes = [])
    {
        parent::__construct($attributes);

        $this->validation = fn () => [
            'event_id' => V::custom([$this, 'checkEventId']),
            'description' => V::notEmpty()->length(1, 191),
            'quantity' => V::intVal()->min(1)->max(65_000),
            'unit_price' => V::custom([$this, 'checkUnitPrice']),
            'tax_id' => V::custom([$this, 'checkTaxId']),
            'taxes' => V::custom([$this, 'checkTaxes']),
        ];
    }

    // ------------------------------------------------------
    // -
    // -    Validation
    // -
    // ------------------------------------------------------

    public function checkEventId($value)
    {
        V::nullable(V::intVal())->check($value);

        // - L'identifiant de l'événement n'est pas encore défini, on skip.
        if (!$this->exists && $value === null) {
            return true;
        }

        $event = Event::withTrashed()->find($value);
        if (!$event) {
            return false;
        }

        return !$this->exists || $this->isDirty('event_id')
            ? !$event->trashed()
            : true;
    }

    public function checkUnitPrice($value)
    {
        V::floatVal()->check($value);
        $value = Decimal::of($value);

        return (
            $value->isGreaterThan(-1_000_000_000_000) &&
            $value->isLessThan(1_000_000_000_000) &&
            $value->getScale() <= 2
        );
    }

    public function checkTaxId($value)
    {
        V::nullable(V::intVal())->check($value);
        return $value === null || Tax::includes($value);
    }

    public function checkTaxes($value)
    {
        if (!is_array($value)) {
            if (!V::nullable(V::json())->validate($value)) {
                return false;
            }
            $value = $value !== null ? $this->fromJson($value) : null;
        }

        if ($value === null) {
            return true;
        }

        // Note: S'il n'y a pas de taxes, le champ doit être à `null` et non un tableau vide.
        $schema = V::arrayType()->notEmpty()->each(V::custom(static fn ($taxValue) => (
            new SchemaStrict(
                new Rule\Key('name', V::notEmpty()->length(1, 30)),
                new Rule\Key('is_rate', V::boolType()),
                new Rule\Key('value', V::custom(static function ($subValue) use ($taxValue) {
                    V::floatVal()->check($subValue);
                    $subValue = Decimal::of($subValue);

                    $isValid = (
                        $subValue->isGreaterThan(-1_000_000_000_000) &&
                        $subValue->isLessThan(1_000_000_000_000) &&
                        $subValue->getScale() <= 3
                    );
                    if (!$isValid) {
                        return false;
                    }

                    $isRate = array_key_exists('is_rate', $taxValue) ? $taxValue['is_rate'] : null;
                    if (!V::boolType()->validate($isRate) || !$isRate) {
                        return true;
                    }

                    // - Si c'est un pourcentage, il doit être inférieur ou égal à 100%.
                    return (
                        $subValue->isGreaterThanOrEqualTo(0) &&
                        $subValue->isLessThanOrEqualTo(100)
                    );
                })),
            )
        )));
        return $schema->validate($value);
    }

    // ------------------------------------------------------
    // -
    // -    Relations
    // -
    // ------------------------------------------------------

    public function event(): BelongsTo
    {
        return $this->belongsTo(Event::class)
            ->withTrashed();
    }

    public function liveTax(): BelongsTo
    {
        return $this->belongsTo(Tax::class, 'tax_id');
    }

    // ------------------------------------------------------
    // -
    // -    Mutators
    // -
    // ------------------------------------------------------

    public $appends = [
        'total_without_taxes',
    ];

    protected $casts = [
        'event_id' => 'integer',
        'description' => 'string',
        'quantity' => 'integer',
        'unit_price' => AsDecimal::class,
        'tax_id' => 'integer',
        'taxes' => 'array',
    ];

    public function getTotalWithoutTaxesAttribute(): Decimal
    {
        return $this->unit_price
            ->multipliedBy($this->quantity)
            // @see https://wiki.dolibarr.org/index.php?title=VAT_setup,_calculation_and_rounding_rules
            ->toScale(2, RoundingMode::HALF_UP);
    }

    public function getTaxesAttribute($value): array
    {
        $taxes = $this->castAttribute('taxes', $value);
        if ($taxes === null) {
            return [];
        }

        return array_map(
            static fn ($tax) => array_replace($tax, [
                'value' => Decimal::of($tax['value'])
                    ->toScale($tax['is_rate'] ? 3 : 2),
            ]),
            $taxes,
        );
    }

    // ------------------------------------------------------
    // -
    // -    Setters
    // -
    // ------------------------------------------------------

    protected $fillable = [
        'description',
        'quantity',
        'unit_price',
        'tax_id',
        'taxes',
    ];

    public function setTaxesAttribute(mixed $value): void
    {
        $value = is_array($value) && empty($value) ? null : $value;
        $value = $value !== null ? $this->castAttributeAsJson('taxes', $value) : null;
        $this->attributes['taxes'] = $value;
    }

    // ------------------------------------------------------
    // -
    // -    Serialization
    // -
    // ------------------------------------------------------

    public function serialize(): array
    {
        return (new DotArray($this->attributesForSerialization()))
            ->delete(['event_id'])
            ->all();
    }
}
