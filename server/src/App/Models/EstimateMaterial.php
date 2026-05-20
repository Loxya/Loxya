<?php
declare(strict_types=1);

namespace Loxya\Models;

use Brick\Math\BigDecimal as Decimal;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Loxya\Models\Casts\AsDecimal;
use Loxya\Models\Enums\BillingFormat;
use Loxya\Support\Arr;
use Loxya\Support\Invoicing\StrictTaxRegime;
use Loxya\Support\Invoicing\TaxRegime;
use Loxya\Support\Invoicing\VatExemptionCode\VatExemptionCodeInterface;
use Loxya\Support\Validation\Rules\SchemaStrict;
use Loxya\Support\Validation\Validator as V;
use Respect\Validation\Rules as Rule;

/**
 * Matériel dans un devis.
 *
 * // - Tax type.
 * @phpstan-type TaxDataStandard array{
 *     name?: string,
 *     value: Decimal,
 * }
 * @phpstan-type TaxDataLegacy array{
 *     name: string,
 *     is_rate: bool,
 *     value: Decimal,
 * }
 * @phpstan-type TaxData TaxDataStandard|TaxDataLegacy
 *
 * @property-read ?int $id
 * @property int $estimate_id
 * @property-read Estimate $estimate
 * @property int|null $material_id
 * @property-read Material|null $material
 * @property string $name
 * @property string $reference
 * @property string|null $description
 * @property int $quantity
 * @property Decimal $unit_price
 * @property Decimal|null $degressive_rate
 * @property Decimal|null $unit_price_period
 * @property Decimal $total_without_discount
 * @property-read bool $has_discount
 * @property Decimal $discount_rate
 * @property Decimal $total_discount
 * @property Decimal $total_without_taxes
 * @property value-of<TaxRegime>|null $tax_regime
 * @property value-of<VatExemptionCodeInterface>|null $tax_exemption_code
 * @property list<TaxData>|null $taxes
 * @property Decimal|null $unit_replacement_price
 * @property Decimal|null $total_replacement_price
 * @property bool $is_hidden_on_bill
 */
final class EstimateMaterial extends BaseModel
{
    protected $table = 'estimate_materials';
    public $timestamps = false;

    public function __construct(array $attributes = [])
    {
        parent::__construct($attributes);

        $this->validation = fn () => [
            'estimate_id' => V::custom([$this, 'checkEstimateId']),
            'material_id' => V::custom([$this, 'checkMaterialId']),
            'name' => V::notEmpty()->length(2, 191),
            'reference' => V::notEmpty()->length(2, 64),
            'description' => V::nullable(V::stringType()),
            'quantity' => V::intVal()->min(1)->max(65_000),
            'unit_price' => V::custom([$this, 'checkAmount']),
            'degressive_rate' => V::custom([$this, 'checkDegressiveRate']),
            'unit_price_period' => V::custom([$this, 'checkAmount']),
            'total_without_discount' => V::custom([$this, 'checkAmount']),
            'discount_rate' => V::custom([$this, 'checkDiscountRate']),
            'total_discount' => V::custom([$this, 'checkAmount']),
            'total_without_taxes' => V::custom([$this, 'checkAmount']),
            'tax_regime' => V::custom([$this, 'checkTaxRegime']),
            'tax_exemption_code' => V::custom([$this, 'checkTaxExemptionCode']),
            'taxes' => V::custom([$this, 'checkTaxes']),
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

    public function checkEstimateId(mixed $value)
    {
        V::nullable(V::intVal())->check($value);

        // - L'identifiant du devis n'est pas encore défini, on skip.
        if (!$this->exists && $value === null) {
            return true;
        }

        $estimate = Estimate::withTrashed()->find($value);
        if (!$estimate) {
            return false;
        }

        return !$this->exists || $this->isDirty('estimate_id')
            ? !$estimate->trashed()
            : true;
    }

    public function checkMaterialId(mixed $value)
    {
        V::nullable(V::intVal())->check($value);

        if ($value === null) {
            return true;
        }

        return Material::withTrashed()->find($value) !== null;
    }

    public function checkDegressiveRate(mixed $value)
    {
        V::nullable(V::floatVal())->check($value);
        $value = $value !== null ? Decimal::of($value) : null;

        // - Le devis parent n'est pas récupérable, on est obligé
        //   de faire une vérification peu précise.
        if ($this->estimate === null) {
            if ($value === null) {
                return true;
            }

        // - Sinon, seuls les devis non V1 sont concernés.
        } elseif ($this->estimate->format === BillingFormat::V1->value) {
            return V::nullType();
        }

        return (
            $value !== null &&
            $value->isGreaterThanOrEqualTo(0) &&
            $value->isLessThan(100_000) &&
            $value->getScale() <= 2
        );
    }

    public function checkDiscountRate(mixed $value)
    {
        V::floatVal()->check($value);
        $value = Decimal::of($value);

        return (
            $value->isGreaterThanOrEqualTo(0) &&
            $value->isLessThanOrEqualTo(100) &&
            $value->getScale() <= 4
        );
    }

    public function checkTaxRegime()
    {
        // - S'il y a un régime de taxe global, il ne peut pas y avoir de taxe par ligne.
        if ($this->estimate?->global_tax_regime !== null) {
            return V::nullType();
        }

        $allowedRegimes = [
            TaxRegime::STANDARD->value,
            TaxRegime::EXEMPTED->value,
        ];

        // - Si on a les données de l'acheteur, on va récupérer les régimes applicables.
        //   Note: On utilise les données "gelées" du devis plutôt que les données "live"
        //         du bénéficiaire car le pays ou l'adresse de l'acheteur a pu changer.
        if ($this->estimate !== null) {
            $sellerCountry = $this->estimate->seller_country;
            $allowedRegimes = array_map(
                static fn (TaxRegime|StrictTaxRegime $regime) => (
                    $regime instanceof StrictTaxRegime
                        ? $regime->regime->value
                        : $regime->value
                ),
                $sellerCountry->getLineAvailableTaxRegimes($this->estimate, isService: true),
            );
        }

        return V::in($allowedRegimes);
    }

    public function checkTaxExemptionCode(mixed $value)
    {
        // - S'il y a un régime de taxe global, il ne peut pas y avoir de taxe par ligne.
        if ($this->estimate?->global_tax_regime !== null) {
            return V::nullType();
        }

        // - Si la valeur est nulle, pas de soucis.
        if ($value === null) {
            return true;
        }

        // - Si le régime de taxe est invalide, on ne peut pas aller plus loin.
        $taxRegimeRaw = $this->getAttributeUnsafeValue('tax_regime');
        if (!V::enumValue(TaxRegime::class)->validate($taxRegimeRaw)) {
            return true;
        }
        $taxRegime = TaxRegime::from($taxRegimeRaw);

        // - Si c'est le régime "standard", pas de code.
        if ($taxRegime === TaxRegime::STANDARD) {
            return V::nullType();
        }

        // - Si le pays du vendeur n'est pas disponible, on ne peut pas aller plus loin.
        $sellerCountry = $this->estimate?->seller_country;
        if ($sellerCountry === null) {
            return true;
        }

        $availableExemptionCodes = $sellerCountry->getLineVatExemptionCodes($taxRegime);
        if (empty($availableExemptionCodes)) {
            return V::nullType();
        }

        return V::in(array_map(
            static fn ($code) => $code->value,
            $availableExemptionCodes,
        ));
    }

    public function checkTaxes(mixed $value)
    {
        if (!is_array($value)) {
            if (!V::nullable(V::json())->validate($value)) {
                return false;
            }
            $value = $value !== null ? $this->fromJson($value) : null;
        }

        // - S'il y a un régime de taxe global, il ne peut pas y avoir de taxe par ligne.
        if ($this->estimate?->global_tax_regime !== null) {
            return V::nullType();
        }

        // - Si la valeur est nulle, pas de soucis.
        if ($value === null) {
            return true;
        }

        // - Si le régime de taxe est invalide, on part du principe que c'est remplissable.
        $taxRegime = $this->getAttributeUnsafeValue('tax_regime');
        $isFillable = V::enumValue(TaxRegime::class)->validate($taxRegime)
            ? $taxRegime === TaxRegime::STANDARD->value
            : true;

        if (!$isFillable) {
            return V::nullType();
        }

        // - Format "legacy".
        $format = $this->estimate?->format ?? BillingFormat::current()->value;
        if ($format < BillingFormat::V3->value) {
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

        $sellerCountry = $this->estimate?->seller_country;
        $allowedRates = $sellerCountry?->getVatRates();

        // Note: S'il n'y a pas de taxes, le champ doit être à `null` et non un tableau vide.
        $schema = V::arrayType()->notEmpty()->each(V::schemaStrict(
            (
                $sellerCountry === null || !$sellerCountry->hasSimpleVatSystem()
                    ? new Rule\Key('name', V::notEmpty()->length(1, 30), $sellerCountry !== null)
                    : null
            ),
            new Rule\Key('value', V::custom(static function ($subValue) use ($allowedRates) {
                V::floatVal()->check($subValue);
                $subValue = Decimal::of($subValue);

                $isValid = (
                    $subValue->isGreaterThanOrEqualTo(0) &&
                    $subValue->isLessThanOrEqualTo(100) &&
                    $subValue->getScale() <= 3
                );
                if (!$isValid) {
                    return false;
                }

                return (
                    $allowedRates === null ||
                    Arr::some($allowedRates, static fn ($allowedRate) => (
                        Decimal::of($allowedRate)->isEqualTo($subValue)
                    ))
                );
            })),
        ));
        return $schema->validate($value);
    }

    public function checkAmount(mixed $value)
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

    public function checkReplacementPrice(mixed $value)
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

    public function estimate(): BelongsTo
    {
        return $this->belongsTo(Estimate::class)
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

    protected $casts = [
        'estimate_id' => 'integer',
        'material_id' => 'integer',
        'name' => 'string',
        'reference' => 'string',
        'description' => 'string',
        'quantity' => 'integer',
        'unit_price' => AsDecimal::class,
        'degressive_rate' => AsDecimal::class,
        'unit_price_period' => AsDecimal::class,
        'total_without_discount' => AsDecimal::class,
        'discount_rate' => AsDecimal::class,
        'total_discount' => AsDecimal::class,
        'total_without_taxes' => AsDecimal::class,
        'tax_regime' => 'string',
        'tax_exemption_code' => 'string',
        'taxes' => 'array',
        'unit_replacement_price' => AsDecimal::class,
        'total_replacement_price' => AsDecimal::class,
        'is_hidden_on_bill' => 'boolean',
    ];

    public function getHasDiscountAttribute(): bool
    {
        return !$this->discount_rate->isZero();
    }

    /** @return value-of<TaxRegime>|null */
    public function getTaxRegimeAttribute(mixed $value): string|null
    {
        // - Si le devis a une exemption globale, pas de taxe par ligne.
        if ($this->estimate->global_tax_regime !== null) {
            return null;
        }
        return $value;
    }

    /** @return value-of<VatExemptionCodeInterface>|null */
    public function getTaxExemptionCodeAttribute(mixed $value): string|null
    {
        // - Si le devis a une exemption globale, pas de taxe par ligne.
        if ($this->estimate->global_tax_regime !== null) {
            return null;
        }

        // - Si c'est le régime "standard", pas de code d'exemption.
        if ($this->tax_regime === TaxRegime::STANDARD->value) {
            return null;
        }

        return $value;
    }

    /** @return list<TaxData>|null */
    public function getTaxesAttribute(mixed $value): array|null
    {
        // - Si le devis a une exemption globale, pas de taxe par ligne.
        if ($this->estimate->global_tax_regime !== null) {
            return null;
        }

        // - Seul le régime "standard" autorise la présence de taxes.
        if ($this->tax_regime !== TaxRegime::STANDARD->value) {
            return null;
        }

        $taxes = $this->castAttribute('taxes', $value);
        if ($taxes === null) {
            return [];
        }

        return array_map(
            function ($tax) {
                $isRate = $this->estimate->format < BillingFormat::V3->value
                    ? $tax['is_rate']
                    : true;

                return array_replace($tax, [
                    'value' => Decimal::of($tax['value'])
                        ->toScale($isRate ? 3 : 2),
                ]);
            },
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
        'description',
        'quantity',
        'unit_price',
        'degressive_rate',
        'unit_price_period',
        'total_without_discount',
        'discount_rate',
        'total_discount',
        'total_without_taxes',
        'tax_regime',
        'tax_exemption_code',
        'taxes',
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
