<?php
declare(strict_types=1);

namespace Loxya\Models;

use Brick\Math\BigDecimal as Decimal;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Loxya\Models\Casts\AsDecimal;
use Loxya\Support\Validation\Rules\SchemaStrict;
use Loxya\Support\Validation\Validator as V;
use Respect\Validation\Rules as Rule;

/**
 * Une ligne supplémentaire sur une facture.
 *
 * @property-read ?int $id
 * @property int $invoice_id
 * @property-read Invoice $invoice
 * @property string $description
 * @property int $quantity
 * @property Decimal $unit_price
 * @property Decimal $total_without_taxes
 * @property array|null $taxes
 */
final class InvoiceExtra extends BaseModel
{
    protected $table = 'invoice_extras';
    public $timestamps = false;

    public function __construct(array $attributes = [])
    {
        parent::__construct($attributes);

        $this->validation = fn () => [
            'invoice_id' => V::custom([$this, 'checkInvoiceId']),
            'description' => V::notEmpty()->length(1, 191),
            'quantity' => V::intVal()->min(1)->max(65_000),
            'unit_price' => V::custom([$this, 'checkAmount']),
            'total_without_taxes' => V::custom([$this, 'checkAmount']),
            'taxes' => V::custom([$this, 'checkTaxes']),
        ];
    }

    // ------------------------------------------------------
    // -
    // -    Validation
    // -
    // ------------------------------------------------------

    public function checkInvoiceId($value)
    {
        V::nullable(V::intVal())->check($value);

        // - L'identifiant de la facture n'est pas encore défini, on skip.
        if (!$this->exists && $value === null) {
            return true;
        }

        $invoice = Invoice::withTrashed()->find($value);
        if (!$invoice) {
            return false;
        }

        return !$this->exists || $this->isDirty('invoice_id')
            ? !$invoice->trashed()
            : true;
    }

    public function checkAmount($value)
    {
        V::floatVal()->check($value);
        $value = Decimal::of($value);

        return (
            $value->isGreaterThan(-1_000_000_000_000) &&
            $value->isLessThan(1_000_000_000_000) &&
            $value->getScale() <= 2
        );
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

    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class)
            ->withTrashed();
    }

    // ------------------------------------------------------
    // -
    // -    Mutators
    // -
    // ------------------------------------------------------

    public $appends = [];

    protected $casts = [
        'invoice_id' => 'integer',
        'description' => 'string',
        'quantity' => 'integer',
        'unit_price' => AsDecimal::class,
        'total_without_taxes' => AsDecimal::class,
        'taxes' => 'array',
    ];

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
        'total_without_taxes',
        'taxes',
    ];

    public function setTaxesAttribute(mixed $value): void
    {
        $value = is_array($value) && empty($value) ? null : $value;
        $value = $value !== null ? $this->castAttributeAsJson('taxes', $value) : null;
        $this->attributes['taxes'] = $value;
    }
}
