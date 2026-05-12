<?php
declare(strict_types=1);

namespace Loxya\Models;

use Adbar\Dot as DotArray;
use Brick\Math\BigDecimal as Decimal;
use Brick\Math\RoundingMode;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\Concerns\AsPivot;
use Loxya\Config\Config;
use Loxya\Contracts\Serializable;
use Loxya\Models\Casts\AsDecimal;
use Loxya\Models\Traits\Serializer;
use Loxya\Models\Traits\TransientAttributes;
use Loxya\Support\Arr;
use Loxya\Support\Invoicing\StrictTaxRegime;
use Loxya\Support\Invoicing\TaxRegime;
use Loxya\Support\Invoicing\VatExemptionCode\VatExemptionCodeInterface;
use Loxya\Support\Validation\Validator as V;
use Respect\Validation\Rules as Rule;

/**
 * Matériel dans un événement.
 *
 * // - Tax type.
 * @phpstan-type TaxData array{
 *     name?: string,
 *     value: Decimal,
 * }
 *
 * @property-read ?int $id
 * @property int $event_id
 * @property-read Event $event
 * @property int $material_id
 * @property-read Material $material
 * @property string $name
 * @property string $reference
 * @property-read int|null $category_id
 * @property-read bool $is_discountable
 * @property int $quantity
 * @property int $quantity_missing
 * @property Decimal|null $unit_price
 * @property Decimal|null $degressive_rate
 * @property-read Decimal|null $unit_price_period
 * @property-read Decimal|null $total_without_discount
 * @property Decimal|null $discount_rate
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
 * @property Decimal|null $unit_replacement_price
 * @property-read Decimal|null $total_replacement_price
 * @property-read Decimal|null $total_weight
 * @property string|null $departure_comment
 * @property int|null $quantity_departed
 * @property int|null $quantity_returned
 * @property int|null $quantity_returned_broken
 * @property-read bool $is_departure_inventory_filled
 * @property-read bool $is_return_inventory_filled
 * @property-read bool $is_deleted
 */
final class EventMaterial extends BaseModel implements Serializable
{
    use AsPivot;
    use Serializer;
    use TransientAttributes;

    // - Types de sérialisation.
    public const SERIALIZE_DEFAULT = 'default';
    public const SERIALIZE_WITH_QUANTITY_MISSING = 'with-quantity-missing';

    protected $table = 'event_materials';
    public $timestamps = false;

    protected $attributes = [
        'departure_comment' => null,
        'quantity_departed' => null,
        'quantity_returned' => null,
        'quantity_returned_broken' => null,
    ];

    public function __construct(array $attributes = [])
    {
        parent::__construct($attributes);

        $this->validation = fn () => [
            'event_id' => V::custom([$this, 'checkEventId']),
            'material_id' => V::custom([$this, 'checkMaterialId']),
            'name' => V::notEmpty()->length(2, 191),
            'reference' => V::notEmpty()->alnum('.,-+/_ ')->length(2, 64),
            'quantity' => V::intVal()->min(1)->max(65_000),
            'unit_price' => V::custom([$this, 'checkUnitPrice']),
            'unit_replacement_price' => V::custom([$this, 'checkUnitReplacementPrice']),
            'degressive_rate' => V::custom([$this, 'checkDegressiveRate']),
            'discount_rate' => V::custom([$this, 'checkDiscountRate']),
            'tax_regime' => V::custom([$this, 'checkTaxRegime']),
            'tax_exemption_code' => V::custom([$this, 'checkTaxExemptionCode']),
            'tax_id' => V::custom([$this, 'checkTaxId']),
            'taxes' => V::custom([$this, 'checkTaxes']),
            'quantity_departed' => V::custom([$this, 'checkQuantityDeparted']),
            'quantity_returned' => V::custom([$this, 'checkQuantityReturned']),
            'quantity_returned_broken' => V::custom([$this, 'checkQuantityReturnedBroken']),
        ];
    }

    // ------------------------------------------------------
    // -
    // -    Validation
    // -
    // ------------------------------------------------------

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

    public function checkMaterialId(mixed $value)
    {
        V::notEmpty()->intVal()->check($value);

        $material = Material::withTrashed()->find($value);
        if (!$material) {
            return false;
        }

        $isValidMaterial = !$this->exists || $this->isDirty('material_id')
            ? !$material->trashed()
            : true;
        if (!$isValidMaterial) {
            return false;
        }

        // - L'identifiant de l'événement n'est pas encore défini...
        //   => On ne peut pas vérifier si le matériel est déjà utilisé dans celui-ci.
        if ($this->event_id === null) {
            return true;
        }

        $alreadyExists = static::query()
            ->where('event_id', $this->event_id)
            ->where('material_id', $value)
            ->when($this->exists, fn (Builder $subQuery) => (
                $subQuery->where('id', '!=', $this->id)
            ))
            ->exists();

        return !$alreadyExists ?: 'material-already-in-event';
    }

    public function checkUnitPrice(mixed $value)
    {
        // - L'événement parent n'est pas récupérable, on est obligé
        //   de faire une vérification peu précise.
        if ($this->event === null) {
            if ($value === null) {
                return true;
            }

        // - Sinon, seuls les événements avec facturation activée
        //   peuvent contenir des montants.
        } elseif (!$this->event->is_billable) {
            return V::nullType();
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

    public function checkUnitReplacementPrice(mixed $value)
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

    public function checkDegressiveRate(mixed $value)
    {
        // - L'événement parent n'est pas récupérable, on est obligé
        //   de faire une vérification peu précise.
        if ($this->event === null) {
            if ($value === null) {
                return true;
            }

        // - Sinon, seules les réservations avec facturation activée sont concernées.
        } elseif (!$this->event->is_billable) {
            return V::nullType();
        }

        V::floatVal()->check($value);
        $value = Decimal::of($value);

        return (
            $value->isGreaterThanOrEqualTo(0) &&
            $value->isLessThan(100_000) &&
            $value->getScale() <= 2
        );
    }

    public function checkDiscountRate(mixed $value)
    {
        // - L'événement parent n'est pas récupérable, on est obligé
        //   de faire une vérification peu précise.
        if ($this->event === null) {
            if ($value === null) {
                return true;
            }

        // - Sinon, seules les réservations avec facturation activée sont concernées.
        } elseif (!$this->event->is_billable) {
            return V::nullType();
        }

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

        // - Si on est dans une édition, on laisse passer, peu importe si
        //   le matériel est remisable ou non.
        if ($this->exists) {
            return true;
        }

        // - Si l'id du matériel est invalide, on ne peut pas checker son état "remisable" ou non.
        $materialId = $this->getAttributeUnsafeValue('material_id');
        if (!V::notEmpty()->intVal()->validate($materialId)) {
            return true;
        }

        /** @var Material $material */
        $material = Material::withTrashed()->find($materialId);

        // - Si le matériel est introuvable, on ne peut pas checker son état "remisable" ou non.
        if (!$material) {
            return true;
        }

        // - Sinon, soit la remise est de `0`, soit le matériel doit être remisable.
        return $value->isZero() || $material->is_discountable;
    }

    public function checkTaxRegime()
    {
        // - Les événements avec facturation désactivée ou avec régime de
        //   taxe global ne peuvent pas avoir de taxe par ligne.
        $allowLineTax = $this->event === null || (
            $this->event->is_billable &&
            $this->event->global_tax_regime === null
        );
        if (!$allowLineTax) {
            return V::nullType();
        }

        $allowedRegimes = [
            TaxRegime::STANDARD->value,
            TaxRegime::EXEMPTED->value,
        ];

        // - Si on a le bénéficiaire, on va récupérer les régimes applicables.
        $mainBeneficiary = $this->event?->mainBeneficiary;
        if ($mainBeneficiary !== null) {
            $sellerCountry = Config::getOrganizationCountry();
            $allowedRegimes = array_map(
                static fn (TaxRegime|StrictTaxRegime $regime) => (
                    $regime instanceof StrictTaxRegime
                        ? $regime->regime->value
                        : $regime->value
                ),
                $sellerCountry->getLineAvailableTaxRegimes($mainBeneficiary, isService: true),
            );
        }

        return V::in($allowedRegimes);
    }

    public function checkTaxExemptionCode(mixed $value)
    {
        // - Les événements avec facturation désactivée ou avec régime de
        //   taxe global ne peuvent pas avoir de taxe par ligne.
        $allowLineTax = $this->event === null || (
            $this->event->is_billable &&
            $this->event->global_tax_regime === null
        );
        if (!$allowLineTax) {
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

        // - Les événements avec facturation désactivée ou avec régime de
        //   taxe global ne peuvent pas avoir de taxe par ligne.
        $allowLineTax = $this->event === null || (
            $this->event->is_billable &&
            $this->event->global_tax_regime === null
        );
        if (!$allowLineTax) {
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

        // - Les événements avec facturation désactivée ou avec régime de
        //   taxe global ne peuvent pas avoir de taxe par ligne.
        $allowLineTax = $this->event === null || (
            $this->event->is_billable &&
            $this->event->global_tax_regime === null
        );
        if (!$allowLineTax) {
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

    public function checkQuantityDeparted(mixed $value)
    {
        $quantityChecker = V::intVal()->min(0);

        $quantity = $this->getAttributeUnsafeValue('quantity');
        $isValidQuantity = V::intVal()->min(1)->validate($quantity);
        if ($isValidQuantity) {
            $quantityChecker->max($quantity);
        }

        if (!V::anyOf(V::nullType(), $quantityChecker)->validate($value)) {
            return false;
        }

        // - L'événement courant n'est pas récupérable...
        //   => On ne peut pas vérifier son statut, on s'arrête là.
        if ($this->event === null) {
            return true;
        }

        // - Si la valeur n'a pas changée, on ne va pas plus loin
        //   même si la valeur en base est potentiellement invalide.
        //   (car ce n'est pas la responsabilité de cette sauvegarde
        //   que de traiter le souci)
        if ($this->exists && !$this->isDirty('quantity_departed')) {
            return true;
        }

        // NOTE: On pourrait être tenté de checker que, lorsque l'inventaire de départ
        //       est marqué comme effectué, la quantité de ce champ (`quantity_departed`)
        //       correspond bien à la quantité totale (`quantity`).
        //       Mais ceci ne doit pas être fait car on autorise la modification du matériel
        //       après la réalisation de l'inventaire de départ et ceci impliquerait de mettre
        //       automatiquement les nouvelles quantités dans ce champ lors des modifications,
        //       comme si cela avait été fait manuellement lors de l'inventaire de départ, ce
        //       qui n'est pas le cas.
        return !$this->event->is_departure_inventory_period_open
            ? V::nullType()
            : true;
    }

    public function checkQuantityReturned(mixed $value)
    {
        $quantityChecker = V::intVal()->min(0);
        if (V::intVal()->min(1)->validate($this->getAttributeUnsafeValue('quantity'))) {
            $quantityChecker->max($this->getAttributeUnsafeValue('quantity'));
        }
        return V::anyOf(V::nullType(), $quantityChecker)->validate($value);
    }

    public function checkQuantityReturnedBroken(mixed $value)
    {
        $quantityChecker = V::intVal()->min(0);
        if (V::intVal()->min(1)->validate($this->getAttributeUnsafeValue('quantity'))) {
            $quantityChecker->max($this->getAttributeUnsafeValue('quantity'));
        }

        $looseQuantityChecker = V::anyOf(V::nullType(), $quantityChecker);
        if (!$looseQuantityChecker->validate($value)) {
            return false;
        }

        // - Le champ `quantity_returned` n'est pas valide, on ne peut pas aller plus loin.
        $quantityReturned = $this->getAttributeUnsafeValue('quantity_returned');
        if (!$looseQuantityChecker->validate($quantityReturned)) {
            return true;
        }

        // - Il ne peut pas y avoir plus de matériels retournés
        //   cassés que de matériels retournés tout court.
        return $quantityReturned === null || $value <= $quantityReturned;
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

    public function material(): BelongsTo
    {
        return $this->belongsTo(Material::class)
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
        'category_id',
        'unit_price_period',
        'total_without_discount',
        'total_discount',
        'total_without_taxes',
        'total_replacement_price',
    ];

    protected $casts = [
        'event_id' => 'integer',
        'material_id' => 'integer',
        'name' => 'string',
        'reference' => 'string',
        'quantity' => 'integer',
        'unit_price' => AsDecimal::class,
        'degressive_rate' => AsDecimal::class,
        'discount_rate' => AsDecimal::class,
        'tax_regime' => 'string',
        'tax_exemption_code' => 'string',
        'tax_id' => 'integer',
        'taxes' => 'array',
        'unit_replacement_price' => AsDecimal::class,
        'quantity_departed' => 'integer',
        'quantity_returned' => 'integer',
        'quantity_returned_broken' => 'integer',
        'departure_comment' => 'string',
    ];

    public function getIsDiscountableAttribute(): bool
    {
        // - S'il y a déjà une remise enregistrée pour ce matériel d'événement, on
        //   considère qu'il est remisable (peu importe que le matériel d'origine ait
        //   été mis à jour depuis à ce niveau)
        if ($this->discount_rate !== null && !$this->discount_rate->isZero()) {
            return true;
        }

        if (!$this->material) {
            throw new \LogicException(
                'The event material\'s related material is missing, ' .
                'this relation should always be defined.',
            );
        }
        return $this->material->is_discountable;
    }

    public function getCategoryIdAttribute(): int|null
    {
        if (!$this->material) {
            throw new \LogicException(
                'The event material\'s related material is missing, ' .
                'this relation should always be defined.',
            );
        }
        return $this->material->category_id;
    }

    public function getUnitPricePeriodAttribute(): Decimal|null
    {
        if (!$this->event->is_billable) {
            return null;
        }

        return $this->unit_price
            ->multipliedBy($this->degressive_rate)
            // @see https://wiki.dolibarr.org/index.php?title=VAT_setup,_calculation_and_rounding_rules
            ->toScale(2, RoundingMode::HALF_UP);
    }

    public function getTotalWithoutDiscountAttribute(): Decimal|null
    {
        if (!$this->event->is_billable) {
            return null;
        }

        return $this->unit_price_period
            ->multipliedBy($this->quantity)
            // @see https://wiki.dolibarr.org/index.php?title=VAT_setup,_calculation_and_rounding_rules
            ->toScale(2, RoundingMode::HALF_UP);
    }

    public function getTotalDiscountAttribute(): Decimal|null
    {
        if (!$this->event->is_billable) {
            return null;
        }

        return $this->total_without_discount
            ->multipliedBy($this->discount_rate->dividedBy(100, 6))
            // @see https://wiki.dolibarr.org/index.php?title=VAT_setup,_calculation_and_rounding_rules
            ->toScale(2, RoundingMode::HALF_UP);
    }

    public function getTotalWithoutTaxesAttribute(): Decimal|null
    {
        if (!$this->event->is_billable) {
            return null;
        }

        return $this->total_without_discount
            ->minus($this->total_discount)
            ->toScale(2, RoundingMode::UNNECESSARY);
    }

    /** @return value-of<TaxRegime>|null */
    public function getDefaultTaxRegimeAttribute(): string|null
    {
        if (!$this->event->is_billable || $this->event->global_tax_regime !== null) {
            return null;
        }

        $mainBeneficiary = $this->event?->mainBeneficiary;
        if ($mainBeneficiary === null) {
            return TaxRegime::STANDARD->value;
        }

        $sellerCountry = Config::getOrganizationCountry();
        $defaultTaxRegime = $sellerCountry->getLineDefaultTaxRegime($mainBeneficiary, isService: true);

        return $defaultTaxRegime instanceof StrictTaxRegime
            ? $defaultTaxRegime->regime->value
            : $defaultTaxRegime->value;
    }

    /** @return value-of<VatExemptionCodeInterface>|null */
    public function getDefaultTaxExemptionCodeAttribute(): string|null
    {
        if (!$this->event->is_billable || $this->event->global_tax_regime !== null) {
            return null;
        }

        $mainBeneficiary = $this->event?->mainBeneficiary;
        if ($mainBeneficiary === null) {
            return null;
        }

        $sellerCountry = Config::getOrganizationCountry();
        $defaultTaxRegime = $sellerCountry->getLineDefaultTaxRegime($mainBeneficiary, isService: true);

        return $defaultTaxRegime instanceof StrictTaxRegime
            ? $defaultTaxRegime->exemptionCode->value
            : null;
    }

    public function getDefaultTaxIdAttribute(): int|null
    {
        if (!$this->event->is_billable || $this->event->global_tax_regime !== null) {
            return null;
        }

        // - Seul le régime "standard" autorise la présence d'une taxe.
        if ($this->default_tax_regime !== TaxRegime::STANDARD->value) {
            return null;
        }

        return $this->material->tax?->id;
    }

    public function getDefaultTaxAttribute(): Tax|null
    {
        if (!$this->event->is_billable || $this->event->global_tax_regime !== null) {
            return null;
        }

        // - Seul le régime "standard" autorise la présence d'une taxe.
        if ($this->default_tax_regime !== TaxRegime::STANDARD->value) {
            return null;
        }

        return $this->material->tax;
    }

    /** @return value-of<TaxRegime>|null */
    public function getTaxRegimeAttribute(mixed $value): string|null
    {
        // - Si l'événement a une exemption globale, pas de taxe par ligne.
        if (!$this->event->is_billable || $this->event->global_tax_regime !== null) {
            return null;
        }
        return $value;
    }

    /** @return value-of<VatExemptionCodeInterface>|null */
    public function getTaxExemptionCodeAttribute(mixed $value): string|null
    {
        // - Si l'événement a une exemption globale, pas de taxe par ligne.
        if (!$this->event->is_billable || $this->event->global_tax_regime !== null) {
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
        if (!$this->event->is_billable || $this->event->global_tax_regime !== null) {
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
        if (!$this->event->is_billable || $this->event->global_tax_regime !== null) {
            return null;
        }

        // - Seul le régime "standard" custom autorise la présence d'une taxe explicite.
        if ($this->tax_regime !== TaxRegime::STANDARD->value) {
            return null;
        }

        return $this->getRelationValue('tax');
    }

    /** @return list<TaxData>|null */
    public function getTaxesAttribute(mixed $value): array|null
    {
        // - Si l'événement a une exemption globale, pas de taxe par ligne.
        if (!$this->event->is_billable || $this->event->global_tax_regime !== null) {
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

    public function getTotalReplacementPriceAttribute(): Decimal|null
    {
        if ($this->unit_replacement_price === null) {
            return null;
        }

        return $this->unit_replacement_price
            ->multipliedBy($this->quantity)
            ->toScale(2, RoundingMode::UNNECESSARY);
    }

    public function getTotalWeightAttribute(): Decimal|null
    {
        if (!$this->material) {
            throw new \LogicException(
                'The event material\'s related material is missing, ' .
                'this relation should always be defined.',
            );
        }

        $quantity = $this->quantity;
        $totalWeight = Decimal::zero();

        $materialWeight = $this->material->weight ?? Decimal::zero();
        $totalWeight = $totalWeight->plus($materialWeight->multipliedBy(max($quantity, 0)));

        return $totalWeight->toScale(3, RoundingMode::UNNECESSARY);
    }

    public function getMaterialAttribute(): Material
    {
        return $this->getRelationValue('material');
    }

    public function getQuantityDepartedAttribute(mixed $value): int|null
    {
        // - Si l'inventaire de départ est marqué comme terminé, on
        //   considère que tout est parti, même si `quantity_departed`
        //   n'est pas à jour (ne devrait toutefois pas arriver).
        return !$this->event?->is_departure_inventory_done
            ? $this->castAttribute('quantity_departed', $value)
            : $this->quantity;
    }

    public function getQuantityMissingAttribute(): int
    {
        if (!$this->hasTransientAttribute('quantity_missing')) {
            throw new \LogicException(
                'The `quantity_missing` attribute should be set ' .
                'by the parent event before being accessed.',
            );
        }
        return $this->getTransientAttribute('quantity_missing');
    }

    public function getIsDepartureInventoryFilledAttribute(): bool
    {
        return $this->quantity_departed === $this->quantity;
    }

    public function getIsReturnInventoryFilledAttribute(): bool
    {
        return (
            $this->quantity_returned !== null &&
            $this->quantity_returned_broken !== null
        );
    }

    public function getIsDeletedAttribute(): bool
    {
        if (!$this->material) {
            throw new \LogicException(
                'The event material\'s related material is missing, ' .
                'this relation should always be defined.',
            );
        }
        return $this->material->is_deleted;
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
        'discount_rate',
        'tax_regime',
        'tax_exemption_code',
        'tax_id',
        'taxes',
        'unit_replacement_price',
        'quantity_departed',
        'quantity_returned',
        'quantity_returned_broken',
        'departure_comment',
    ];

    public function setTaxesAttribute(mixed $value): void
    {
        $value = is_array($value) && empty($value) ? null : $value;
        $value = $value !== null ? $this->castAttributeAsJson('taxes', $value) : null;
        $this->attributes['taxes'] = $value;
    }

    public function setQuantityMissingAttribute(int $value): void
    {
        $this->setTransientAttribute('quantity_missing', $value);
    }

    // ------------------------------------------------------
    // -
    // -    Serialization
    // -
    // ------------------------------------------------------

    public function serialize(string $format = self::SERIALIZE_DEFAULT): array
    {
        /** @var static $eventMaterial */
        $eventMaterial = tap(
            clone $this,
            static function (EventMaterial $eventMaterial) use ($format) {
                if ($format === self::SERIALIZE_WITH_QUANTITY_MISSING) {
                    $eventMaterial->append(['quantity_missing']);
                }
            },
        );

        $data = new DotArray($eventMaterial->attributesForSerialization());

        if (!$eventMaterial->event->is_billable) {
            $data->delete([
                'unit_price',
                'degressive_rate',
                'unit_price_period',
                'total_without_discount',
                'discount_rate',
                'total_discount',
                'total_without_taxes',
                'tax_regime',
                'tax_exemption_code',
                'tax_id',
                'taxes',
            ]);
        }

        // - Matériel avec contexte.
        $material = tap(clone $this->material, function (Material $material) {
            $material->context = $this->event;
        });
        $data['material'] = $material->serialize(Material::SERIALIZE_WITH_CONTEXT_EXCERPT);

        return $data
            ->set('id', $eventMaterial->material_id)
            ->delete(['event_id', 'material_id'])
            ->all();
    }
}
