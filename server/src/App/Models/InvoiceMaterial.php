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
 * Matériel dans une facture.
 *
 * @property-read ?int $id
 * @property int $invoice_id
 * @property-read Invoice $invoice
 * @property int|null $material_id
 * @property-read Material|null $material
 * @property string $name
 * @property string $reference
 * @property int $quantity
 * @property Decimal $unit_price
 * @property Decimal|null $degressive_rate
 * @property Decimal|null $unit_price_period
 * @property Decimal $discount_rate
 * @property array|null $taxes
 * @property Decimal $total_without_discount
 * @property Decimal $total_discount
 * @property Decimal $total_without_taxes
 * @property Decimal|null $unit_replacement_price
 * @property Decimal|null $total_replacement_price
 * @property bool $is_hidden_on_bill
 */
final class InvoiceMaterial extends BaseModel
{
    protected $table = 'invoice_materials';
    public $timestamps = false;

    public function __construct(array $attributes = [])
    {
        parent::__construct($attributes);

        $this->validation = fn () => [
            'invoice_id' => V::custom([$this, 'checkInvoiceId']),
            'material_id' => V::custom([$this, 'checkMaterialId']),
            'name' => V::notEmpty()->length(2, 191),
            'reference' => V::notEmpty()->length(2, 64),
            'quantity' => V::intVal()->min(1)->max(65_000),
            'unit_price' => V::custom([$this, 'checkAmount']),
            'degressive_rate' => V::custom([$this, 'checkDegressiveRate']),
            'unit_price_period' => V::custom([$this, 'checkAmount']),
            'discount_rate' => V::custom([$this, 'checkDiscountRate']),
            'taxes' => V::custom([$this, 'checkTaxes']),
            'total_without_discount' => V::custom([$this, 'checkAmount']),
            'total_discount' => V::custom([$this, 'checkAmount']),
            'total_without_taxes' => V::custom([$this, 'checkAmount']),
            'unit_replacement_price' => V::custom([$this, 'checkReplacementPrice']),
            'total_replacement_price' => V::custom([$this, 'checkReplacementPrice']),
            'is_hidden_on_bill' => V::boolType(),
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

    public function checkMaterialId($value)
    {
        V::nullable(V::intVal())->check($value);

        if ($value === null) {
            return true;
        }

        return Material::withTrashed()->find($value) !== null;
    }

    public function checkDegressiveRate($value)
    {
        V::nullable(V::floatVal())->check($value);
        $value = $value !== null ? Decimal::of($value) : null;

        // - La facture parente n'est pas récupérable, on est obligé
        //   de faire une vérification peu précise.
        if ($this->invoice === null) {
            if ($value === null) {
                return true;
            }

        // - Sinon, seules les factures non legacy sont concernés.
        } elseif ($this->invoice->is_legacy) {
            return V::nullType();
        }

        return (
            $value->isGreaterThanOrEqualTo(0) &&
            $value->isLessThan(100_000) &&
            $value->getScale() <= 2
        );
    }

    public function checkDiscountRate($value)
    {
        V::floatVal()->check($value);
        $value = Decimal::of($value);

        return (
            $value->isGreaterThanOrEqualTo(0) &&
            $value->isLessThanOrEqualTo(100) &&
            $value->getScale() <= 4
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
                        $subValue->isGreaterThanOrEqualTo(0) &&
                        $subValue->isLessThan(1_000_000_000_000) &&
                        $subValue->getScale() <= 3
                    );
                    if (!$isValid) {
                        return false;
                    }

                    $isRate = array_key_exists('is_rate', $taxValue) ? $taxValue['is_rate'] : null;
                    if (!V::boolType()->validate($isRate)) {
                        return true;
                    }

                    return $isRate
                        // - Si c'est un pourcentage, il doit être inférieur ou égal à 100%.
                        ? $subValue->isLessThanOrEqualTo(100)
                        // - Sinon si ce n'est pas un pourcentage, la précision doit être à 2 décimales max.
                        : $subValue->getScale() <= 2;
                })),
            )
        )));
        return $schema->validate($value);
    }

    public function checkAmount($value)
    {
        V::floatVal()->check($value);
        $value = Decimal::of($value);

        $isValid = (
            $value->isGreaterThanOrEqualTo(0) &&
            $value->isLessThan(1_000_000_000_000) &&
            $value->getScale() <= 2
        );
        return $isValid ?: 'invalid-positive-amount';
    }

    public function checkReplacementPrice($value)
    {
        if ($value === null) {
            return true;
        }

        V::floatVal()->check($value);
        $value = Decimal::of($value);

        $isValid = (
            $value->isGreaterThanOrEqualTo(0) &&
            $value->isLessThan(1_000_000_000_000) &&
            $value->getScale() <= 2
        );
        return $isValid ?: 'invalid-positive-amount';
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

    public function material(): BelongsTo
    {
        return $this->belongsTo(Material::class)
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
        'material_id' => 'integer',
        'name' => 'string',
        'reference' => 'string',
        'quantity' => 'integer',
        'unit_price' => AsDecimal::class,
        'degressive_rate' => AsDecimal::class,
        'unit_price_period' => AsDecimal::class,
        'discount_rate' => AsDecimal::class,
        'taxes' => 'array',
        'total_without_discount' => AsDecimal::class,
        'total_discount' => AsDecimal::class,
        'total_without_taxes' => AsDecimal::class,
        'unit_replacement_price' => AsDecimal::class,
        'total_replacement_price' => AsDecimal::class,
        'is_hidden_on_bill' => 'boolean',
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
        'material_id',
        'name',
        'reference',
        'quantity',
        'unit_price',
        'degressive_rate',
        'unit_price_period',
        'discount_rate',
        'taxes',
        'total_without_discount',
        'total_discount',
        'total_without_taxes',
        'unit_replacement_price',
        'total_replacement_price',
        'is_hidden_on_bill',
    ];

    public function setTaxesAttribute(mixed $value): void
    {
        $value = is_array($value) && empty($value) ? null : $value;
        $value = $value !== null ? $this->castAttributeAsJson('taxes', $value) : null;
        $this->attributes['taxes'] = $value;
    }
}
