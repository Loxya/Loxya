<?php
declare(strict_types=1);

namespace Loxya\Models;

use Brick\Math\BigDecimal as Decimal;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Collection as CoreCollection;
use Loxya\Config\Config;
use Loxya\Contracts\Pdfable;
use Loxya\Contracts\Serializable;
use Loxya\Models\Casts\AsDecimal;
use Loxya\Models\Traits\Serializer;
use Loxya\Services\I18n;
use Loxya\Support\Arr;
use Loxya\Support\Assert;
use Loxya\Support\Collections\MaterialsCollection;
use Loxya\Support\Pdf\Pdf;
use Loxya\Support\Period;
use Loxya\Support\Str;
use Loxya\Support\Validation\Rules\SchemaStrict;
use Loxya\Support\Validation\Validator as V;
use Respect\Validation\Rules as Rule;

/**
 * Devis.
 *
 * @property-read ?int $id
 * @property CarbonImmutable $date
 * @property-read ?string $url
 * @property string $booking_type
 * @property int $booking_id
 * @property-read array $seller
 * @property-read Event $booking
 * @property string|null $booking_title
 * @property string|null $booking_reference
 * @property CarbonImmutable $booking_start_date
 * @property CarbonImmutable $booking_end_date
 * @property bool $booking_is_full_days
 * @property Period $booking_period
 * @property-read Period $booking_mobilization_period
 * @property-read string|null $booking_description
 * @property-read string|null $booking_location
 * @property int $beneficiary_id
 * @property-read Beneficiary $beneficiary
 * @property bool $is_legacy
 * @property Decimal|null $degressive_rate
 * @property Decimal|null $daily_total
 * @property Decimal $global_discount_rate
 * @property Decimal $total_without_global_discount
 * @property Decimal $total_global_discount
 * @property Decimal $total_without_taxes
 * @property array $total_taxes
 * @property Decimal $total_with_taxes
 * @property Decimal $total_replacement
 * @property string $currency
 * @property int|null $author_id
 * @property array $metadata
 * @property-read User|null $author
 * @property-read CarbonImmutable $created_at
 * @property-read CarbonImmutable|null $updated_at
 * @property-read CarbonImmutable|null $deleted_at
 *
 * @property-read Collection<array-key, EstimateMaterial> $materials
 * @property-read Collection<array-key, EstimateExtra> $extras
 * @property-read Collection<array-key, Property> $totalisable_properties
 */
final class Estimate extends BaseModel implements Serializable, Pdfable
{
    use Serializer;
    use SoftDeletes;

    protected $attributes = [
        'is_legacy' => false,
    ];

    public function __construct(array $attributes = [])
    {
        parent::__construct($attributes);

        $this->validation = fn () => [
            'date' => V::notEmpty()->dateTime(),
            'booking_type' => V::custom([$this, 'checkBookingType']),
            'booking_id' => V::custom([$this, 'checkBookingId']),
            'booking_title' => V::nullable(V::length(2, 191)),
            'booking_reference' => V::nullable(V::stringVal()),
            'booking_start_date' => V::custom([$this, 'checkBookingStartDate']),
            'booking_end_date' => V::custom([$this, 'checkBookingEndDate']),
            'booking_is_full_days' => V::boolType(),
            'beneficiary_id' => V::custom([$this, 'checkBeneficiaryId']),
            'is_legacy' => V::boolType(),
            'degressive_rate' => V::custom([$this, 'checkDegressiveRate']),
            'daily_total' => V::custom([$this, 'checkDailyTotal']),
            'global_discount_rate' => V::custom([$this, 'checkGlobalDiscountRate']),
            'total_without_global_discount' => V::custom([$this, 'checkAmount']),
            'total_global_discount' => V::custom([$this, 'checkAmount'], false),
            'total_without_taxes' => V::custom([$this, 'checkAmount']),
            'total_taxes' => V::custom([$this, 'checkTotalTaxes']),
            'total_with_taxes' => V::custom([$this, 'checkAmount']),
            'total_replacement' => V::custom([$this, 'checkAmount'], false),
            'currency' => V::custom([$this, 'checkCurrency']),
            'author_id' => V::custom([$this, 'checkAuthorId']),
            'metadata' => V::nullable(V::json()),
        ];
    }

    // ------------------------------------------------------
    // -
    // -    Validation
    // -
    // ------------------------------------------------------

    public function checkBookingType($value)
    {
        return V::create()
            ->notEmpty()
            ->in([
                Event::TYPE,
            ])
            ->validate($value);
    }

    public function checkBookingId($value)
    {
        V::notEmpty()->intVal()->check($value);

        return match ($this->booking_type) {
            Event::TYPE => Event::includes($value),
            default => false, // - Type inconnu.
        };
    }

    public function checkBookingStartDate($value)
    {
        V::notEmpty()->dateTime()->check($value);
        $startDate = new CarbonImmutable($value);

        $bookingIsFullDays = $this->getAttributeUnsafeValue('booking_is_full_days');
        if (!V::boolType()->validate($bookingIsFullDays)) {
            return true;
        }

        return $bookingIsFullDays
            ? $startDate->format('H:i:s') === '00:00:00'
            : $startDate->format('i:s') === '00:00';
    }

    public function checkBookingEndDate($value)
    {
        $dateChecker = V::notEmpty()->dateTime();
        $dateChecker->check($value);
        $endDate = new CarbonImmutable($value);

        $bookingIsFullDays = $this->getAttributeUnsafeValue('booking_is_full_days');
        if (V::boolType()->validate($bookingIsFullDays)) {
            $hasValidTimeFormat = $bookingIsFullDays
                ? $endDate->format('H:i:s') === '00:00:00'
                : $endDate->format('i:s') === '00:00';

            if (!$hasValidTimeFormat) {
                return false;
            }
        }

        $startDateRaw = $this->getAttributeUnsafeValue('booking_start_date');
        if (!$dateChecker->validate($startDateRaw)) {
            return true;
        }
        return $endDate->isAfter($startDateRaw) ?: 'end-date-must-be-after-start-date';
    }

    public function checkBeneficiaryId($value)
    {
        V::notEmpty()->intVal()->check($value);

        $beneficiary = Beneficiary::withTrashed()->find($value);
        if (!$beneficiary) {
            return false;
        }

        return !$this->exists || $this->isDirty('company_id')
            ? !$beneficiary->trashed()
            : true;
    }

    public function checkCurrency($value)
    {
        return V::create()
            ->notEmpty()
            ->allOf(V::uppercase(), V::length(3, 3))
            ->validate($value);
    }

    public function checkDegressiveRate($value)
    {
        V::nullable(V::floatVal())->check($value);
        $value = $value !== null ? Decimal::of($value) : null;

        // - L'état "legacy" n'est pas récupérable, on est obligé
        //   de faire une vérification peu précise.
        $isLegacyRaw = $this->getAttributeUnsafeValue('is_legacy');
        if (!($this->validation)()['is_legacy']->validate($isLegacyRaw)) {
            if ($value === null) {
                return true;
            }

        // - Sinon, seuls les devis legacy sont concernés.
        } elseif (!$isLegacyRaw) {
            return V::nullType();
        }

        return (
            $value !== null &&
            $value->isGreaterThanOrEqualTo(0) &&
            $value->isLessThan(100_000) &&
            $value->getScale() <= 2
        );
    }

    public function checkDailyTotal($value)
    {
        V::nullable(V::floatVal())->check($value);
        $value = $value !== null ? Decimal::of($value) : null;

        // - L'état "legacy" n'est pas récupérable, on est obligé
        //   de faire une vérification peu précise.
        $isLegacyRaw = $this->getAttributeUnsafeValue('is_legacy');
        if (!($this->validation)()['is_legacy']->validate($isLegacyRaw)) {
            if ($value === null) {
                return true;
            }

        // - Sinon, seuls les devis legacy sont concernés.
        } elseif (!$isLegacyRaw) {
            return V::nullType();
        }

        return (
            $value !== null &&
            $value->isGreaterThanOrEqualTo(0) &&
            $value->isLessThan(1_000_000_000_000) &&
            $value->getScale() <= 2
        );
    }

    public function checkGlobalDiscountRate($value)
    {
        V::floatVal()->check($value);
        $value = Decimal::of($value);

        return (
            $value->isGreaterThanOrEqualTo(0) &&
            $value->isLessThanOrEqualTo(100) &&
            $value->getScale() <= 4
        );
    }

    public function checkAmount(mixed $value, bool $signed = true)
    {
        V::floatVal()->check($value);
        $value = Decimal::of($value);

        return (
            $value->isGreaterThanOrEqualTo($signed ? -1_000_000_000_000 : 0) &&
            $value->isLessThan(1_000_000_000_000) &&
            $value->getScale() <= 2
        );
    }

    public function checkTotalTaxes($value)
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
                    if (!V::boolType()->validate($isRate)) {
                        return true;
                    }

                    return !$isRate
                        // - Si ce n'est pas un pourcentage, la précision doit être à 2 décimales max.
                        ? $subValue->getScale() <= 2
                        // - Sinon si c'est un pourcentage, il doit être inférieur ou égal à 100%.
                        : (
                            $subValue->isGreaterThanOrEqualTo(0) &&
                            $subValue->isLessThanOrEqualTo(100)
                        );
                })),
                new Rule\Key('total', V::custom(static function ($subValue) {
                    V::floatVal()->check($subValue);
                    $subValue = Decimal::of($subValue);

                    return (
                        $subValue->isGreaterThan(-1_000_000_000_000) &&
                        $subValue->isLessThan(1_000_000_000_000) &&
                        $subValue->getScale() <= 2
                    );
                })),
            )
        )));
        return $schema->validate($value);
    }

    public function checkAuthorId($value)
    {
        V::nullable(V::intVal())->check($value);

        if ($value === null) {
            return true;
        }

        $author = User::withTrashed()->find($value);
        if (!$author) {
            return false;
        }

        return !$this->exists || $this->isDirty('author_id')
            ? !$author->trashed()
            : true;
    }

    // ------------------------------------------------------
    // -
    // -    Relations
    // -
    // ------------------------------------------------------

    public function booking(): MorphTo
    {
        return $this->morphTo('booking');
    }

    public function materials(): HasMany
    {
        return $this->hasMany(EstimateMaterial::class, 'estimate_id')
            ->orderBy('id');
    }

    public function extras(): HasMany
    {
        return $this->hasMany(EstimateExtra::class, 'estimate_id')
            ->orderBy('id');
    }

    public function beneficiary(): BelongsTo
    {
        return $this->belongsTo(Beneficiary::class)
            ->withTrashed();
    }

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'author_id')
            ->withTrashed();
    }

    // ------------------------------------------------------
    // -
    // -    Mutators
    // -
    // ------------------------------------------------------

    protected $appends = [
        'url',
    ];

    protected $casts = [
        'date' => 'immutable_datetime',
        'booking_type' => 'string',
        'booking_id' => 'integer',
        'booking_title' => 'string',
        'booking_reference' => 'string',
        'booking_start_date' => 'immutable_datetime',
        'booking_end_date' => 'immutable_datetime',
        'booking_is_full_days' => 'boolean',
        'beneficiary_id' => 'integer',
        'is_legacy' => 'boolean',
        'degressive_rate' => AsDecimal::class,
        'discount_rate' => AsDecimal::class,
        'global_discount_rate' => AsDecimal::class,
        'total_without_global_discount' => AsDecimal::class,
        'total_global_discount' => AsDecimal::class,
        'total_without_taxes' => AsDecimal::class,
        'total_taxes' => 'array',
        'total_with_taxes' => AsDecimal::class,
        'total_replacement' => AsDecimal::class,
        'currency' => 'string',
        'author_id' => 'integer',
        'metadata' => 'array',
        'created_at' => 'immutable_datetime',
        'updated_at' => 'immutable_datetime',
        'deleted_at' => 'immutable_datetime',
    ];

    public function getUrlAttribute(): ?string
    {
        if (!$this->exists) {
            return null;
        }

        return (string) Config::getBaseUri()
            ->withPath(sprintf('/estimates/%s/pdf', $this->id));
    }

    public function getBookingPeriodAttribute(): Period
    {
        return new Period(
            $this->booking_start_date,
            $this->booking_end_date,
            $this->booking_is_full_days,
        );
    }

    public function getBookingMobilizationPeriodAttribute(): Period
    {
        return $this->booking->mobilization_period;
    }

    public function getBookingDescriptionAttribute(): string|null
    {
        return $this->booking instanceof Event
            ? $this->booking->description
            : null;
    }

    public function getBookingLocationAttribute(): string|null
    {
        return $this->booking instanceof Event
            ? $this->booking->location
            : null;
    }

    public function getSellerAttribute(): array
    {
        $company = Config::get('companyData');

        return array_replace($company, [
            'country' => ($company['country'] ?? null) !== null
                ? Country::tryFromCode($company['country'])
                : null,
        ]);
    }

    /** @return Collection<array-key, EstimateMaterial> */
    public function getMaterialsAttribute(): Collection
    {
        return $this->getRelationValue('materials');
    }

    /** @return Collection<array-key, EstimateExtra> */
    public function getExtrasAttribute(): Collection
    {
        return $this->getRelationValue('extras');
    }

    public function getTotalTaxesAttribute($value): array
    {
        $totalTaxes = $this->castAttribute('total_taxes', $value);
        if ($totalTaxes === null) {
            return [];
        }

        return array_map(
            static fn ($tax) => array_replace($tax, [
                'value' => Decimal::of($tax['value'])
                    ->toScale($tax['is_rate'] ? 3 : 2),
                'total' => Decimal::of($tax['total'])
                    ->toScale(2),
            ]),
            $totalTaxes,
        );
    }

    public function getMetadataAttribute($value): array
    {
        return $this->castAttribute('metadata', $value) ?? [];
    }

    /** @return CoreCollection<array-key, Property> */
    public function getTotalisablePropertiesAttribute(): CoreCollection
    {
        return new CoreCollection($this->metadata['properties'] ?? []);
    }

    // ------------------------------------------------------
    // -
    // -    PDF Related
    // -
    // ------------------------------------------------------

    public function toPdf(I18n $i18n): Pdf
    {
        $filename = Str::slugify(implode('-', [
            $i18n->translate('estimate'),
            $this->seller['name'],
            $this->date->format('Ymd-Hi'),
            $this->beneficiary->full_name,
        ]));

        return Pdf::createFromTemplate('estimate', $i18n, $filename, $this->getPdfData());
    }

    protected function getPdfData(): array
    {
        $settings = Setting::getWithKey('estimates');
        $categories = Category::get()->keyBy('id');

        $categoriesTotals = [];
        foreach ($this->materials as $line) {
            if ($line->is_hidden_on_bill && $line->total_without_taxes->isZero()) {
                continue;
            }

            /** @var Category|null $category */
            $category = $line->material?->category_id !== null
                ? $categories->get($line->material->category_id)
                : null;

            $categoryIdentifier = $category?->id ?? '__UNCATEGORIZED__';
            if (!array_key_exists($categoryIdentifier, $categoriesTotals)) {
                $categoriesTotals[$categoryIdentifier] = [
                    'id' => $categoryIdentifier,
                    'name' => $category?->name,
                    'quantity' => 0,
                    'subTotal' => Decimal::zero(),
                ];
            }

            $categoriesTotals[$categoryIdentifier]['quantity'] += $line->quantity;
            $categoriesTotals[$categoryIdentifier]['subTotal'] = (
                $categoriesTotals[$categoryIdentifier]['subTotal']
                    ->plus($line->total_without_taxes)
            );
        }
        foreach ($this->extras as $line) {
            if (!array_key_exists('__OTHER__', $categoriesTotals)) {
                $categoriesTotals['__OTHER__'] = [
                    'id' => '__OTHER__',
                    'name' => null,
                    'quantity' => 0,
                    'subTotal' => Decimal::zero(),
                ];
            }

            $categoriesTotals['__OTHER__']['quantity'] += $line->quantity;
            $categoriesTotals['__OTHER__']['subTotal'] = (
                $categoriesTotals['__OTHER__']['subTotal']
                    ->plus($line->total_without_taxes)
            );
        }

        $categoriesTotals = (new Collection($categoriesTotals))
            ->sort(static function ($a, $b) {
                foreach (['__OTHER__', '__UNCATEGORIZED__'] as $specialGroup) {
                    $isAInGroup = $a['id'] === $specialGroup;
                    $isBInGroup = $b['id'] === $specialGroup;
                    if ($isAInGroup || $isBInGroup) {
                        if (!$isAInGroup || !$isBInGroup) {
                            return $isAInGroup ? 1 : -1;
                        }
                        return strcasecmp($a['name'], $b['name']);
                    }
                }
                return strcasecmp($a['name'], $b['name']);
            })
            ->values()
            ->all();

        $hasMaterialDiscount = $this->materials->some(
            static fn ($material) => !$material->discount_rate->isZero(),
        );

        return [
            'date' => $this->date,
            'seller' => $this->seller,
            'beneficiary' => $this->beneficiary,
            'currency' => $this->currency,
            'booking' => [
                'entity' => $this->booking_type,
                'title' => $this->booking_title,
                'reference' => $this->booking_reference,
                'period' => $this->booking_period,
                'mobilizationPeriod' => $this->booking_mobilization_period,
                'description' => $this->booking_description,
                'location' => $this->booking_location,
            ],
            'isLegacy' => $this->is_legacy,
            'hasTaxes' => !empty($this->total_taxes),
            'hasMaterialDiscount' => $hasMaterialDiscount,
            'degressiveRate' => $this->degressive_rate,
            'dailyTotal' => $this->daily_total,
            'hasGlobalDiscount' => !$this->global_discount_rate->isZero(),
            'globalDiscountRate' => $this->global_discount_rate->dividedBy(100, 6),
            'totalWithoutGlobalDiscount' => $this->total_without_global_discount,
            'totalGlobalDiscount' => $this->total_global_discount,
            'totalWithoutTaxes' => $this->total_without_taxes,
            'totalTaxes' => array_map(
                static fn ($tax) => array_replace($tax, [
                    'value' => $tax['is_rate']
                        ? $tax['value']->dividedBy(100, 5)
                        : $tax['value'],
                ]),
                $this->total_taxes,
            ),
            'totalWithTaxes' => $this->total_with_taxes,
            'totalReplacement' => $this->total_replacement,
            'categoriesSubTotals' => $categoriesTotals,
            'materials' => (
                (new MaterialsCollection($this->materials))
                    ->bySubCategories()
            ),
            'extras' => $this->extras,
            'totalisableProperties' => $this->totalisable_properties,
            'customText' => $settings['customText'],
            'showBookingDescription' => $settings['showBookingDescription'],
            'showMobilizationPeriod' => (
                !$this->booking_mobilization_period->isSame($this->booking_period) &&
                $settings['showMobilizationPeriod']
            ),
            'showTotalReplacementPrice' => $settings['showTotalReplacementPrice'],
            'showTotalisableProperties' => $settings['showTotalisableProperties'],
            'showPictures' => $settings['showPictures'],
            'showDescriptions' => $settings['showDescriptions'],
            'showReplacementPrices' => $settings['showReplacementPrices'],
            'showUnitPrices' => $settings['showUnitPrices'],
        ];
    }

    // ------------------------------------------------------
    // -
    // -    Setters
    // -
    // ------------------------------------------------------

    protected $fillable = [
        'date',
        'booking_title',
        'booking_reference',
        'booking_start_date',
        'booking_end_date',
        'booking_is_full_days',
        'booking_period',
        'global_discount_rate',
        'total_without_global_discount',
        'total_global_discount',
        'total_without_taxes',
        'total_taxes',
        'total_with_taxes',
        'total_replacement',
        'currency',
        'metadata',
    ];

    public function setBookingPeriodAttribute(mixed $rawPeriod): void
    {
        $period = Period::tryFrom($rawPeriod);

        $this->booking_start_date = $period?->getStartDate();
        $this->booking_end_date = $period?->getEndDate();
        $this->booking_is_full_days = $period?->isFullDays() ?? false;
    }

    public function setTotalTaxesAttribute(mixed $value): void
    {
        $value = is_array($value) && empty($value) ? null : $value;
        $value = $value !== null ? $this->castAttributeAsJson('total_taxes', $value) : null;
        $this->attributes['total_taxes'] = $value;
    }

    public function setMetadataAttribute(mixed $value): void
    {
        $value = is_array($value) && empty($value) ? null : $value;
        $value = $value !== null ? $this->castAttributeAsJson('metadata', $value) : null;
        $this->attributes['metadata'] = $value;
    }

    // ------------------------------------------------------
    // -
    // -    Méthodes de "repository"
    // -
    // ------------------------------------------------------

    public static function createFromBooking(Event $booking, User $creator): Estimate
    {
        Assert::true($booking->is_billable, "Booking is not billable.");

        $beneficiary = $booking instanceof Event
            ? $booking->beneficiaries->first()
            : $booking->borrower;

        Assert::notNull($beneficiary, (
            "A beneficiary must be defined in the booking to be able to generate an estimate."
        ));

        Assert::notEmpty($booking->materials, (
            "The booking must contain at least one material or line for an estimate to be generated from a booking."
        ));

        return dbTransaction(static function () use ($booking, $beneficiary, $creator) {
            $estimate = new static([
                'date' => CarbonImmutable::now(),

                'booking_title' => $booking instanceof Event ? $booking->title : null,
                'booking_reference' => $booking->reference,
                'booking_period' => $booking->operation_period,

                // - Remise.
                'total_without_global_discount' => $booking->total_without_global_discount,
                'global_discount_rate' => $booking->global_discount_rate,
                'total_global_discount' => $booking->total_global_discount,

                // - Totaux.
                'total_without_taxes' => $booking->total_without_taxes,
                'total_taxes' => $booking->total_taxes,
                'total_with_taxes' => $booking->total_with_taxes,

                'total_replacement' => $booking->total_replacement,
                'currency' => $booking->currency,

                // - Métadonnées.
                'metadata' => [
                    'properties' => $booking->totalisable_properties
                        ->map(static fn (Property $property) => (
                            $property->serialize(Property::SERIALIZE_SUMMARY)
                        ))
                        ->values(),
                ],
            ]);
            $estimate->booking()->associate($booking);
            $estimate->beneficiary()->associate($beneficiary);
            $estimate->author()->associate($creator);

            if (!$estimate->save()) {
                return false;
            }

            // - Attache le matériel au devis.
            foreach ($booking->materials as $bookingMaterial) {
                $material = $bookingMaterial->material;
                $estimateMaterial = new EstimateMaterial([
                    'material_id' => $bookingMaterial->material_id,
                    'name' => $bookingMaterial->name,
                    'reference' => $bookingMaterial->reference,
                    'quantity' => $bookingMaterial->quantity,
                    'unit_price' => $bookingMaterial->unit_price,
                    'degressive_rate' => $bookingMaterial->degressive_rate,
                    'unit_price_period' => $bookingMaterial->unit_price_period,
                    'discount_rate' => $bookingMaterial->discount_rate,
                    'taxes' => $bookingMaterial->taxes,
                    'total_without_discount' => $bookingMaterial->total_without_discount,
                    'total_discount' => $bookingMaterial->total_discount,
                    'total_without_taxes' => $bookingMaterial->total_without_taxes,
                    'unit_replacement_price' => $bookingMaterial->unit_replacement_price,
                    'total_replacement_price' => $bookingMaterial->total_replacement_price,
                    'is_hidden_on_bill' => $material->is_hidden_on_bill,
                ]);
                $estimate->materials()->save($estimateMaterial);
            }

            // - Attache les lignes extras au devis.
            foreach ($booking->extras as $bookingExtraLine) {
                $estimateExtraLine = new EstimateExtra([
                    'description' => $bookingExtraLine->description,
                    'quantity' => $bookingExtraLine->quantity,
                    'unit_price' => $bookingExtraLine->unit_price,
                    'taxes' => $bookingExtraLine->taxes,
                    'total_without_taxes' => $bookingExtraLine->total_without_taxes,
                ]);
                $estimate->extras()->save($estimateExtraLine);
            }

            return $estimate->refresh();
        });
    }

    // ------------------------------------------------------
    // -
    // -    Serialization
    // -
    // ------------------------------------------------------

    public function serialize(): array
    {
        $data = $this->attributesForSerialization();
        return Arr::only($data, [
            'id',
            'date',
            'url',
            'total_without_taxes',
            'total_taxes',
            'total_with_taxes',
            'currency',
        ]);
    }
}
