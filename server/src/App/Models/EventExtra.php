<?php
declare(strict_types=1);

namespace Loxya\Models;

use Adbar\Dot as DotArray;
use Brick\Math\BigDecimal as Decimal;
use Brick\Math\RoundingMode;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Loxya\Config\Config;
use Loxya\Contracts\Serializable;
use Loxya\Models\Casts\AsDecimal;
use Loxya\Models\Traits\Serializer;
use Loxya\Support\Arr;
use Loxya\Support\Invoicing\StrictTaxRegime;
use Loxya\Support\Invoicing\TaxRegime;
use Loxya\Support\Invoicing\VatExemptionCode\VatExemptionCodeInterface;
use Loxya\Support\Str;
use Loxya\Support\Validation\Validator as V;
use Respect\Validation\Rules as Rule;

/**
 * Ligne de facturation supplémentaire dans un événement.
 *
 * // - Tax type.
 * @phpstan-type TaxData array{
 *     name?: string,
 *     value: Decimal,
 * }
 *
 * @property-read ?int $id
 * @property-read string $uuid
 * @property int $event_id
 * @property-read Event $event
 * @property bool $is_service
 * @property string $description
 * @property int $quantity
 * @property Decimal $unit_price
 * @property-read Decimal|null $total_without_discount
 * @property Decimal $discount_rate
 * @property-read Decimal|null $total_discount
 * @property-read Decimal|null $total_without_taxes
 * @property-read value-of<TaxRegime>|null $default_tax_regime
 * @property-read value-of<VatExemptionCodeInterface>|null $default_tax_exemption_code
 * @property-read int|null $default_tax_id
 * @property-read Tax|null $defaultTax
 * @property value-of<TaxRegime>|null $tax_regime
 * @property value-of<VatExemptionCodeInterface>|null $tax_exemption_code
 * @property int|null $tax_id
 * @property-read Tax|null $tax
 * @property list<TaxData>|null $taxes
 */
final class EventExtra extends BaseModel implements Serializable
{
    use Serializer;

    protected $table = 'event_extras';
    public $timestamps = false;

    public function __construct(array $attributes = [])
    {
        $attributes['uuid'] ??= (string) Str::uuid();
        parent::__construct($attributes);

        $this->validation = fn () => [
            'uuid' => V::custom([$this, 'checkUuid']),
            'event_id' => V::custom([$this, 'checkEventId']),
            'is_service' => V::custom([$this, 'checkIsService']),
            'description' => V::notEmpty()->length(1, 191),
            'quantity' => V::intVal()->min(1)->max(65_000),
            'unit_price' => V::custom([$this, 'checkUnitPrice']),
            'discount_rate' => V::custom([$this, 'checkDiscountRate']),
            'tax_regime' => V::custom([$this, 'checkTaxRegime']),
            'tax_exemption_code' => V::custom([$this, 'checkTaxExemptionCode']),
            'tax_id' => V::custom([$this, 'checkTaxId']),
            'taxes' => V::custom([$this, 'checkTaxes']),
        ];
    }

    // ------------------------------------------------------
    // -
    // -    Validation
    // -
    // ------------------------------------------------------

    public function checkUuid(mixed $value)
    {
        V::notEmpty()->uuid(4)->check($value);

        $alreadyExists = static::query()
            ->where('uuid', $value)
            ->when($this->exists, fn (Builder $subQuery) => (
                $subQuery->where('id', '!=', $this->id)
            ))
            ->exists();

        return !$alreadyExists;
    }

    public function checkEventId(mixed $value)
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

    public function checkIsService(mixed $value): bool
    {
        if (!V::boolType()->validate($value)) {
            return false;
        }

        // - Si le prix unitaire est invalide, on ne peut pas aller plus loin.
        $unitPriceRaw = $this->getAttributeUnsafeValue('unit_price');
        if (!V::floatVal()->validate($unitPriceRaw)) {
            return true;
        }

        // - Si le prix unitaire est négatif (= déduction), ça doit forcément être un service.
        return !Decimal::of($unitPriceRaw)->isNegative() || $value === true;
    }

    public function checkUnitPrice(mixed $value)
    {
        V::floatVal()->check($value);
        $value = Decimal::of($value);

        return (
            $value->isGreaterThan(-1_000_000_000_000) &&
            $value->isLessThan(1_000_000_000_000) &&
            $value->getScale() <= 2
        );
    }

    public function checkDiscountRate(mixed $value)
    {
        V::floatVal()->check($value);
        $value = Decimal::of($value);

        $isValid = (
            $value->isGreaterThanOrEqualTo(0) &&
            $value->isLessThanOrEqualTo(100) &&
            $value->getScale() <= 4
        );
        if (!$isValid) {
            return false;
        }

        // - Si le prix unitaire est négatif, il ne peut pas y avoir de remise.
        $unitPriceRaw = $this->getAttributeUnsafeValue('unit_price');
        if (V::floatVal()->validate($unitPriceRaw) && Decimal::of($unitPriceRaw)->isNegative()) {
            return $value->isZero();
        }

        return true;
    }

    public function checkTaxRegime()
    {
        // - S'il y a un régime de taxe global, il ne peut pas y avoir de taxe par ligne.
        if ($this->event?->global_tax_regime !== null) {
            return V::nullType();
        }

        $allowedRegimes = [
            TaxRegime::STANDARD->value,
            TaxRegime::EXEMPTED->value,
        ];

        $isServiceRaw = $this->getAttributeUnsafeValue('is_service');
        $isService = V::boolType()->validate($isServiceRaw)
            ? $isServiceRaw
            : null;

        // - Si on a le bénéficiaire, on va récupérer les régimes applicables.
        $mainBeneficiary = $this->event?->mainBeneficiary;
        if ($isService !== null && $mainBeneficiary !== null) {
            $sellerCountry = Config::getOrganizationCountry();
            $allowedRegimes = array_map(
                static fn (TaxRegime|StrictTaxRegime $regime) => (
                    $regime instanceof StrictTaxRegime
                        ? $regime->regime->value
                        : $regime->value
                ),
                $sellerCountry->getLineAvailableTaxRegimes($mainBeneficiary, $isService),
            );
        }

        return V::in($allowedRegimes);
    }

    public function checkTaxExemptionCode(mixed $value)
    {
        // - S'il y a un régime de taxe global, il ne peut pas y avoir de taxe par ligne.
        if ($this->event?->global_tax_regime !== null) {
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

        $sellerCountry = Config::getOrganizationCountry();
        $availableExemptionCodes = $sellerCountry->getLineVatExemptionCodes($taxRegime);
        if (empty($availableExemptionCodes)) {
            return V::nullType();
        }

        return V::in(array_map(
            static fn ($code) => $code->value,
            $availableExemptionCodes,
        ));
    }

    public function checkTaxId(mixed $value)
    {
        V::nullable(V::intVal())->check($value);

        // - S'il y a un régime de taxe global, il ne peut pas y avoir de taxe par ligne.
        if ($this->event?->global_tax_regime !== null) {
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

        return $isFillable ? Tax::includes($value) : V::nullType();
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
        if ($this->event?->global_tax_regime !== null) {
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

        $sellerCountry = Config::getOrganizationCountry();
        $hasSimpleVatSystem = $sellerCountry->hasSimpleVatSystem();
        $allowedRates = $sellerCountry->getVatRates();

        // Note: S'il n'y a pas de taxes, le champ doit être à `null` et non un tableau vide.
        $schema = V::arrayType()->notEmpty()->each(V::schemaStrict(
            !$hasSimpleVatSystem ? new Rule\Key('name', V::notEmpty()->length(1, 30)) : null,
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

    // ------------------------------------------------------
    // -
    // -    Relations
    // -
    // ------------------------------------------------------

    public function event(): BelongsTo
    {
        return $this->belongsTo(Event::class, 'event_id')
            ->withTrashed();
    }

    public function tax(): BelongsTo
    {
        return $this->belongsTo(Tax::class, 'tax_id');
    }

    // ------------------------------------------------------
    // -
    // -    Mutators
    // -
    // ------------------------------------------------------

    public $appends = [
        'total_without_discount',
        'total_discount',
        'total_without_taxes',
    ];

    protected $casts = [
        'uuid' => 'string',
        'event_id' => 'integer',
        'is_service' => 'boolean',
        'description' => 'string',
        'quantity' => 'integer',
        'unit_price' => AsDecimal::class,
        'discount_rate' => AsDecimal::class,
        'tax_regime' => 'string',
        'tax_exemption_code' => 'string',
        'tax_id' => 'integer',
        'taxes' => 'array',
    ];

    public function getTotalWithoutDiscountAttribute(): Decimal|null
    {
        return $this->unit_price
            ->multipliedBy($this->quantity)
            // @see https://wiki.dolibarr.org/index.php?title=VAT_setup,_calculation_and_rounding_rules
            ->toScale(2, RoundingMode::HALF_UP);
    }

    public function getTotalDiscountAttribute(): Decimal|null
    {
        return $this->total_without_discount
            ->multipliedBy($this->discount_rate->dividedBy(100, 6))
            // @see https://wiki.dolibarr.org/index.php?title=VAT_setup,_calculation_and_rounding_rules
            ->toScale(2, RoundingMode::HALF_UP);
    }

    public function getTotalWithoutTaxesAttribute(): Decimal
    {
        return $this->total_without_discount
            ->minus($this->total_discount)
            ->toScale(2, RoundingMode::UNNECESSARY);
    }

    /** @return value-of<TaxRegime>|null */
    public function getDefaultTaxRegimeAttribute(): string|null
    {
        // - Si l'événement a une exemption globale, pas de taxe par ligne.
        if ($this->event->global_tax_regime !== null) {
            return null;
        }

        $mainBeneficiary = $this->event?->mainBeneficiary;
        if ($mainBeneficiary === null) {
            return TaxRegime::STANDARD->value;
        }

        $sellerCountry = Config::getOrganizationCountry();
        $defaultTaxRegime = $sellerCountry->getLineDefaultTaxRegime($mainBeneficiary, $this->is_service);

        return $defaultTaxRegime instanceof StrictTaxRegime
            ? $defaultTaxRegime->regime->value
            : $defaultTaxRegime->value;
    }

    /** @return value-of<VatExemptionCodeInterface>|null */
    public function getDefaultTaxExemptionCodeAttribute(): string|null
    {
        // - Si l'événement a une exemption globale, pas de taxe par ligne.
        if ($this->event->global_tax_regime !== null) {
            return null;
        }

        $mainBeneficiary = $this->event?->mainBeneficiary;
        if ($mainBeneficiary === null) {
            return null;
        }

        $sellerCountry = Config::getOrganizationCountry();
        $defaultTaxRegime = $sellerCountry->getLineDefaultTaxRegime($mainBeneficiary, $this->is_service);

        return $defaultTaxRegime instanceof StrictTaxRegime
            ? $defaultTaxRegime->exemptionCode->value
            : null;
    }

    public function getDefaultTaxIdAttribute(): int|null
    {
        // - Si l'événement a une exemption globale, pas de taxe par ligne.
        if ($this->event->global_tax_regime !== null) {
            return null;
        }

        // - Seul le régime "standard" autorise la présence d'une taxe.
        if ($this->default_tax_regime !== TaxRegime::STANDARD->value) {
            return null;
        }

        // - Si une taxe a été spécifiquement choisie par l'utilisateur, on l'utilise.
        if ($this->tax_id !== null) {
            return $this->tax_id;
        }

        // - Sinon on utilise la taxe par défaut, si elle existe.
        return Setting::getWithKey('billing.defaultTax');
    }

    public function getDefaultTaxAttribute(): Tax|null
    {
        // - Si l'événement a une exemption globale, pas de taxe par ligne.
        if ($this->event->global_tax_regime !== null) {
            return null;
        }

        // - Seul le régime "standard" autorise la présence d'une taxe.
        if ($this->default_tax_regime !== TaxRegime::STANDARD->value) {
            return null;
        }

        // - Si une taxe a été spécifiquement choisie par l'utilisateur, on l'utilise.
        if ($this->tax_id !== null) {
            return $this->getRelationValue('tax');
        }

        // - Sinon on utilise la taxe par défaut des paramètres, si elle existe.
        $defaultTaxId = Setting::getWithKey('billing.defaultTax');
        return $defaultTaxId !== null ? Tax::find($defaultTaxId) : null;
    }

    /** @return value-of<TaxRegime>|null */
    public function getTaxRegimeAttribute(mixed $value): string|null
    {
        // - Si l'événement a une exemption globale, pas de taxe par ligne.
        if ($this->event->global_tax_regime !== null) {
            return null;
        }
        return $value;
    }

    /** @return value-of<VatExemptionCodeInterface>|null */
    public function getTaxExemptionCodeAttribute(mixed $value): string|null
    {
        // - Si l'événement a une exemption globale, pas de taxe par ligne.
        if ($this->event->global_tax_regime !== null) {
            return null;
        }

        // - Si c'est le régime "standard", pas de code d'exemption.
        if ($this->tax_regime === TaxRegime::STANDARD->value) {
            return null;
        }

        return $value;
    }

    public function getTaxIdAttribute(mixed $value): int|null
    {
        // - Si l'événement a une exemption globale, pas de taxe par ligne.
        if ($this->event->global_tax_regime !== null) {
            return null;
        }

        // - Seul le régime "standard" explicite autorise la présence d'une taxe explicite.
        if ($this->tax_regime !== TaxRegime::STANDARD->value) {
            return null;
        }

        return $this->castAttribute('tax_id', $value);
    }

    public function getTaxAttribute(): Tax|null
    {
        // - Si l'événement a une exemption globale, pas de taxe par ligne.
        if ($this->event->global_tax_regime !== null) {
            return null;
        }

        // - Seul le régime "standard" explicite autorise la présence d'une taxe explicite.
        if ($this->tax_regime !== TaxRegime::STANDARD->value) {
            return null;
        }

        return $this->getRelationValue('tax');
    }

    /** @return list<TaxData>|null */
    public function getTaxesAttribute(mixed $value): array|null
    {
        // - Si l'événement a une exemption globale, pas de taxe par ligne.
        if ($this->event->global_tax_regime !== null) {
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
            static fn ($tax) => array_replace($tax, [
                'value' => Decimal::of($tax['value'])->toScale(3),
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
        'uuid',
        'event_id',
        'is_service',
        'description',
        'quantity',
        'unit_price',
        'discount_rate',
        'tax_regime',
        'tax_exemption_code',
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
            ->delete(['id', 'event_id'])
            ->all();
    }
}
