<?php
declare(strict_types=1);

namespace Loxya\Models;

use Adbar\Dot as DotArray;
use Brick\Math\BigDecimal as Decimal;
use Brick\Math\RoundingMode;
use Carbon\Carbon;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Collection as CoreCollection;
use Loxya\Config\Config;
use Loxya\Config\Enums\BillingMode;
use Loxya\Config\Enums\Feature;
use Loxya\Config\Enums\ReturnPolicy;
use Loxya\Contracts\Bookable;
use Loxya\Contracts\Pdfable;
use Loxya\Contracts\PeriodInterface;
use Loxya\Contracts\Serializable;
use Loxya\Errors\Exception\ValidationException;
use Loxya\Models\Casts\AsDecimal;
use Loxya\Models\Enums\Group;
use Loxya\Models\Traits\Caching;
use Loxya\Models\Traits\Serializer;
use Loxya\Services\Auth;
use Loxya\Services\I18n;
use Loxya\Support\Assert;
use Loxya\Support\Collections\MaterialsCollection;
use Loxya\Support\Pdf\Pdf;
use Loxya\Support\Period;
use Loxya\Support\Str;
use Loxya\Support\Validation\Rules\SchemaStrict;
use Loxya\Support\Validation\Validator as V;
use Respect\Validation\Rules as Rule;
use Symfony\Contracts\Cache\ItemInterface as CacheItemInterface;

/**
 * Événement.
 *
 * @property-read ?int $id
 * @property string $title
 * @property string|null $reference
 * @property string|null $description
 * @property string|null $location
 * @property string|null $color
 * @property string $operation_start_date
 * @property string $operation_end_date
 * @property bool $operation_is_full_days
 * @property Period $operation_period
 * @property string $mobilization_start_date
 * @property string $mobilization_end_date
 * @property Period $mobilization_period
 * @property Decimal|null $global_discount_rate
 * @property-read Decimal|null $total_without_global_discount
 * @property-read Decimal|null $total_global_discount
 * @property-read Decimal|null $total_without_taxes
 * @property-read array|null $total_taxes
 * @property-read Decimal|null $total_with_taxes
 * @property-read Decimal $total_replacement
 * @property string $currency
 * @property-read int $materials_count
 * @property-read bool $is_editable
 * @property bool $is_confirmed
 * @property bool $is_billable
 * @property bool $is_archived
 * @property-read bool $is_departure_inventory_period_open
 * @property-read bool $is_departure_inventory_period_closed
 * @property-read bool $can_finish_departure_inventory
 * @property bool $is_departure_inventory_done
 * @property string|null $departure_inventory_datetime
 * @property int|null $departure_inventory_author_id
 * @property-read User|null $departure_inventory_author
 * @property-read bool $is_return_inventory_period_open
 * @property-read bool $can_finish_return_inventory
 * @property-read bool $is_return_inventory_started
 * @property bool $is_return_inventory_done
 * @property string|null $return_inventory_datetime
 * @property int|null $return_inventory_author_id
 * @property-read User|null $return_inventory_author
 * @property-read bool $has_materials
 * @property-read bool|null $has_missing_materials
 * @property-read bool $has_deleted_materials
 * @property-read bool|null $has_not_returned_materials
 * @property-read bool|null $has_materials_returned_broken
 * @property-read bool|null $has_unassigned_mandatory_positions
 * @property-read int[] $categories
 * @property-read int[] $parks
 * @property string|null $note
 * @property int|null $manager_id
 * @property-read User|null $manager
 * @property int|null $author_id
 * @property-read User|null $author
 * @property-read CarbonImmutable $created_at
 * @property-read CarbonImmutable|null $updated_at
 * @property-read CarbonImmutable|null $deleted_at
 *
 * @property-read Collection<array-key, EventTechnician> $technicians
 * @property-read Collection<array-key, EventPosition> $positions
 * @property-read Collection<array-key, Beneficiary> $beneficiaries
 * @property-read Collection<array-key, EventMaterial> $materials
 * @property-read Collection<array-key, EventExtra> $extras
 * @property-read Collection<array-key, Estimate> $estimates
 * @property-read Collection<array-key, Invoice> $invoices
 * @property-read Collection<array-key, Document> $documents
 * @property-read Collection<array-key, Property> $totalisable_properties
 *
 * @method static Builder|static search(string|string[] $term)
 * @method static Builder|static inProgress()
 * @method static Builder|static endingToday()
 * @method static Builder|static returnInventoryTodo()
 * @method static Builder|static inPeriod(PeriodInterface $period, bool $withOverdue = false)
 * @method static Builder|static closureSameOrAfter(string|\DateTimeInterface $date)
 * @method static Builder|static havingMaterialInPark(int $parkId)
 * @method static Builder|static notReturned(PeriodInterface $period)
 * @method static Builder|static withInvolvedUser(User $user, bool $checkBeneficiaries = true)
 * @method static Builder|static onlyWithMaterialsSelectableBy(User $user)
 */
final class Event extends BaseModel implements Serializable, Bookable, Pdfable
{
    use Serializer;
    use SoftDeletes;
    use Caching;

    /** L'identifiant unique du modèle. */
    public const TYPE = 'event';

    // - Types de sérialisation.
    public const SERIALIZE_SUMMARY = 'summary';
    public const SERIALIZE_DEFAULT = 'default';
    public const SERIALIZE_DETAILS = 'details';
    public const SERIALIZE_BOOKING_EXCERPT = 'booking-excerpt';
    public const SERIALIZE_BOOKING_SUMMARY = 'booking-summary';
    public const SERIALIZE_BOOKING_DEFAULT = 'booking-default';

    // - Nombre de jours avant la date de mobilisation prévue
    //   pour qu'un inventaire de départ puisse être commencé.
    //   TODO: Permettre de configurer ça à l'avenir ?
    public const DEPARTURE_INVENTORY_DELAY = 30;

    protected $attributes = [
        'color' => null,
        'is_archived' => false,
        'is_departure_inventory_done' => false,
        'departure_inventory_datetime' => null,
        'departure_inventory_author_id' => null,
        'is_return_inventory_done' => false,
        'return_inventory_datetime' => null,
        'return_inventory_author_id' => null,
        'note' => null,
    ];

    public function __construct(array $attributes = [])
    {
        $isBillable = Config::get('billingMode') === BillingMode::ALL;
        $this->attributes = array_replace($this->attributes, [
            'is_billable' => $isBillable,
            'global_discount_rate' => $isBillable ? Decimal::zero() : null,
            'currency' => Config::get('currency'),
        ]);

        parent::__construct($attributes);

        $this->validation = fn () => [
            'title' => V::notEmpty()->length(2, 191),
            'reference' => V::custom([$this, 'checkReference']),
            'color' => V::nullable(V::custom([$this, 'checkColor'])),
            'operation_start_date' => V::custom([$this, 'checkOperationStartDate']),
            'operation_end_date' => V::custom([$this, 'checkOperationEndDate']),
            'operation_is_full_days' => V::boolType(),
            'mobilization_start_date' => V::custom([$this, 'checkMobilizationStartDate']),
            'mobilization_end_date' => V::custom([$this, 'checkMobilizationEndDate']),
            'is_confirmed' => V::boolType(),
            'is_archived' => V::custom([$this, 'checkIsArchived']),
            'is_billable' => V::boolType(),
            'global_discount_rate' => V::custom([$this, 'checkGlobalDiscountRate']),
            'currency' => V::custom([$this, 'checkCurrency']),
            'is_departure_inventory_done' => V::boolType(),
            'departure_inventory_datetime' => V::custom([$this, 'checkDepartureInventoryDatetime']),
            'departure_inventory_author_id' => V::custom([$this, 'checkDepartureInventoryAuthorId']),
            'is_return_inventory_done' => V::boolType(),
            'return_inventory_datetime' => V::custom([$this, 'checkReturnInventoryDatetime']),
            'return_inventory_author_id' => V::custom([$this, 'checkReturnInventoryAuthorId']),
            'manager_id' => V::custom([$this, 'checkManagerId']),
            'author_id' => V::custom([$this, 'checkAuthorId']),
        ];
    }

    // ------------------------------------------------------
    // -
    // -    Validation
    // -
    // ------------------------------------------------------

    public function checkReference($value)
    {
        V::create()
            ->nullable(V::alnum('.,-/_ ')->length(1, 64))
            ->check($value);

        if (!$value) {
            return true;
        }

        $alreadyExists = static::query()
            ->where('reference', $value)
            ->when($this->exists, fn (Builder $subQuery) => (
                $subQuery->where('id', '!=', $this->id)
            ))
            ->withTrashed()
            ->exists();

        return !$alreadyExists ?: 'reference-already-in-use';
    }

    public function checkOperationStartDate($value)
    {
        if (!V::notEmpty()->dateTime()->validate($value)) {
            return false;
        }

        $operationIsFullDays = $this->getAttributeUnsafeValue('operation_is_full_days');
        if (!V::boolType()->validate($operationIsFullDays)) {
            return true;
        }

        $startDate = new CarbonImmutable($value);
        return $operationIsFullDays
            ? $startDate->format('H:i:s') === '00:00:00'
            : $startDate->format('i:s') === '00:00';
    }

    public function checkOperationEndDate($value)
    {
        $dateChecker = V::notEmpty()->dateTime();
        if (!$dateChecker->validate($value)) {
            return false;
        }
        $endDate = new CarbonImmutable($value);

        $operationIsFullDays = $this->getAttributeUnsafeValue('operation_is_full_days');
        if (V::boolType()->validate($operationIsFullDays)) {
            $hasValidTimeFormat = $operationIsFullDays
                ? $endDate->format('H:i:s') === '00:00:00'
                : $endDate->format('i:s') === '00:00';

            if (!$hasValidTimeFormat) {
                return false;
            }
        }

        $startDateRaw = $this->getAttributeUnsafeValue('operation_start_date');
        if (!$dateChecker->validate($startDateRaw)) {
            return true;
        }
        return $endDate->isAfter($startDateRaw) ?: 'end-date-must-be-after-start-date';
    }

    public function checkMobilizationStartDate($value)
    {
        $dateChecker = V::notEmpty()->dateTime();
        if (!$dateChecker->validate($value)) {
            return false;
        }
        $mobilizationStartDate = new CarbonImmutable($value);

        // - La date doit être arrondie au quart d'heure le plus proche.
        if (!$mobilizationStartDate->roundMinutes(15)->eq($mobilizationStartDate)) {
            return 'date-precision-must-be-quarter';
        }

        // - La date de début de mobilisation ne peut pas être après le début de l'événement.
        $operationStartDateRaw = $this->getAttributeUnsafeValue('operation_start_date');
        if (!$dateChecker->validate($operationStartDateRaw)) {
            return true;
        }
        if ($mobilizationStartDate->isAfter($operationStartDateRaw)) {
            return 'mobilization-start-date-must-be-before-event-start-date';
        }

        // - La date de début de mobilisation ne peut pas être après la date d'inventaire de départ (arrondie à 15min).
        $isDepartureInventoryDone = $this->getAttributeUnsafeValue('is_departure_inventory_done');
        if (V::boolType()->validate($isDepartureInventoryDone) && $isDepartureInventoryDone) {
            // - Si l'inventaire de départ était déjà marqué comme effectué et que c'est
            //   toujours le cas, on empêche la modification de la date de début de mobilisation.
            $departureInventoryWasAlreadyDone = $this->getOriginal('is_departure_inventory_done', false);
            if ($this->exists && $departureInventoryWasAlreadyDone && $this->isDirty('mobilization_start_date')) {
                return 'mobilization-start-date-cannot-be-changed-after-departure-inventory';
            }

            $departureInventoryDatetimeRaw = $this->getAttributeUnsafeValue('departure_inventory_datetime');
            if (!$dateChecker->validate($departureInventoryDatetimeRaw)) {
                return true;
            }

            $roundedDepartureInventoryDatetime = CarbonImmutable::parse($departureInventoryDatetimeRaw)
                ->roundMinutes(15, 'ceil');

            return $mobilizationStartDate->lessThanOrEqualTo($roundedDepartureInventoryDatetime) ?: (
                'mobilization-start-date-must-be-before-departure-inventory-date'
            );
        }

        return true;
    }

    public function checkMobilizationEndDate($value)
    {
        $dateChecker = V::notEmpty()->dateTime();
        if (!$dateChecker->validate($value)) {
            return false;
        }
        $mobilizationEndDate = new CarbonImmutable($value);

        // - La date doit être arrondie au quart d'heure le plus proche.
        if (!$mobilizationEndDate->roundMinutes(15)->eq($mobilizationEndDate)) {
            return 'date-precision-must-be-quarter';
        }

        // - La date de fin de mobilisation doit être après la date de début de mobilisation.
        $mobilizationStartDateRaw = $this->getAttributeUnsafeValue('mobilization_start_date');
        if (!$dateChecker->validate($mobilizationStartDateRaw)) {
            return true;
        }
        if (!$mobilizationEndDate->isAfter($mobilizationStartDateRaw)) {
            return 'end-date-must-be-after-start-date';
        }

        // - La date de fin de mobilisation doit être après le début de l'événement.
        $operationStartDateRaw = $this->getAttributeUnsafeValue('operation_start_date');
        if (!$dateChecker->validate($operationStartDateRaw)) {
            return true;
        }
        if (!$mobilizationEndDate->isAfter($operationStartDateRaw)) {
            return 'mobilization-end-date-must-be-after-event-start-date';
        }

        // - La date de fin de mobilisation ne peut pas être après la date d'inventaire de retour (arrondie à 15min).
        $isReturnInventoryDone = $this->getAttributeUnsafeValue('is_return_inventory_done');
        if (V::boolType()->validate($isReturnInventoryDone) && $isReturnInventoryDone) {
            // - Si l'inventaire de retour était déjà marqué comme effectué et que c'est
            //   toujours le cas, on empêche la modification de la date de fin de mobilisation.
            $returnInventoryWasAlreadyDone = $this->getOriginal('is_return_inventory_done', false);
            if ($this->exists && $returnInventoryWasAlreadyDone && $this->isDirty('mobilization_end_date')) {
                return 'mobilization-end-date-cannot-be-changed-after-return-inventory';
            }

            $returnInventoryDatetimeRaw = $this->getAttributeUnsafeValue('return_inventory_datetime');
            if (!$dateChecker->validate($returnInventoryDatetimeRaw)) {
                return true;
            }

            $roundedReturnInventoryDatetime = CarbonImmutable::parse($returnInventoryDatetimeRaw)
                ->roundMinutes(15, 'ceil');

            return $mobilizationEndDate->lessThanOrEqualTo($roundedReturnInventoryDatetime) ?: (
                'mobilization-end-date-must-be-before-return-inventory-date'
            );
        }

        return true;
    }

    public function checkColor($value)
    {
        $colorChecker = V::regex('/^#?[0-9a-f]{6}$/i');
        return $colorChecker->validate($value) ?: 'invalid-hexadecimal-color';
    }

    public function checkGlobalDiscountRate($value)
    {
        if (!$this->is_billable) {
            return V::nullType();
        }

        V::floatVal()->check($value);
        $value = Decimal::of($value);

        return (
            $value->isGreaterThanOrEqualTo(0) &&
            $value->isLessThanOrEqualTo(100) &&
            $value->getScale() <= 4
        );
    }

    public function checkCurrency($value)
    {
        return V::create()
            ->notEmpty()
            ->allOf(V::uppercase(), V::length(3, 3))
            ->validate($value);
    }

    public function checkIsArchived($value)
    {
        V::boolType()->check($value);

        // - Pas archivé, on s'arrête là.
        if (!$value) {
            return true;
        }

        $mobilizationEndDateRaw = $this->getAttributeUnsafeValue('mobilization_end_date');
        if (!V::dateTime()->validate($mobilizationEndDateRaw)) {
            return true;
        }

        $isReturnInventoryDone = $this->getAttributeUnsafeValue('is_return_inventory_done');
        if (!V::boolType()->validate($isReturnInventoryDone)) {
            return true;
        }

        $isPastAndInventoryDone = (
            !Carbon::parse($mobilizationEndDateRaw)->isFuture()
            && $isReturnInventoryDone
        );

        return $isPastAndInventoryDone ?: 'event-cannot-be-archived';
    }

    public function checkDepartureInventoryAuthorId($value)
    {
        V::nullable(V::intVal())->check($value);

        if (!$this->is_departure_inventory_done) {
            return V::nullType();
        }

        // - Si le champ est vide ou qu'on est dans un update et que le
        //   champ n'a pas changé, on laisse passer.
        if ($value === null || ($this->exists && !$this->isDirty('departure_inventory_author_id'))) {
            return true;
        }

        return User::includes($value);
    }

    public function checkDepartureInventoryDatetime($value)
    {
        $dateChecker = V::nullable(V::dateTime());
        if (!$dateChecker->validate($value)) {
            return 'invalid-date';
        }

        return !$this->is_departure_inventory_done
            ? V::nullType()
            : true;
    }

    public function checkReturnInventoryAuthorId($value)
    {
        V::nullable(V::intVal())->check($value);

        if (!$this->is_return_inventory_done) {
            return V::nullType();
        }

        // - Si le champ est vide ou qu'on est dans un update et que le
        //   champ n'a pas changé, on laisse passer.
        if ($value === null || ($this->exists && !$this->isDirty('return_inventory_author_id'))) {
            return true;
        }

        return User::includes($value);
    }

    public function checkReturnInventoryDatetime($value)
    {
        $dateChecker = V::nullable(V::dateTime());
        if (!$dateChecker->validate($value)) {
            return 'invalid-date';
        }

        return !$this->is_return_inventory_done
            ? V::nullType()
            : true;
    }

    public function checkManagerId($value)
    {
        V::nullable(V::intVal())->check($value);

        // - Si le champ est vide ou qu'on est dans un update et que le
        //   champ n'a pas changé, on laisse passer.
        if ($value === null || ($this->exists && !$this->isDirty('manager_id'))) {
            return true;
        }

        return User::includes($value);
    }

    public function checkAuthorId($value)
    {
        V::nullable(V::intVal())->check($value);

        // - Si le champ est vide ou qu'on est dans un update et que le
        //   champ n'a pas changé, on laisse passer.
        if ($value === null || ($this->exists && !$this->isDirty('author_id'))) {
            return true;
        }

        return User::includes($value);
    }

    // ------------------------------------------------------
    // -
    // -    Relations
    // -
    // ------------------------------------------------------

    public function technicians(): HasMany
    {
        return $this->hasMany(EventTechnician::class, 'event_id')
            ->orderBy('start_date')
            ->orderBy('id');
    }

    public function positions(): HasMany
    {
        return $this->hasMany(EventPosition::class, 'event_id')
            ->orderBy('id');
    }

    public function beneficiaries(): BelongsToMany
    {
        return $this->belongsToMany(Beneficiary::class, 'event_beneficiaries')
            ->using(EventBeneficiary::class)
            ->orderByPivot('id');
    }

    public function materials(): HasMany
    {
        return $this->hasMany(EventMaterial::class, 'event_id')
            ->orderBy('name')
            ->orderBy('id');
    }

    public function extras(): HasMany
    {
        return $this->hasMany(EventExtra::class, 'event_id')
            ->orderBy('id');
    }

    public function invoices(): MorphMany
    {
        return $this->morphMany(Invoice::class, 'booking')
            ->orderBy('date', 'desc')
            ->orderBy('id', 'desc');
    }

    public function estimates(): MorphMany
    {
        return $this->morphMany(Estimate::class, 'booking')
            ->orderBy('date', 'desc')
            ->orderBy('id', 'desc');
    }

    public function documents(): MorphMany
    {
        return $this->morphMany(Document::class, 'entity')
            ->orderBy('name')
            ->orderBy('id');
    }

    public function departureInventoryAuthor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'departure_inventory_author_id')
            ->withTrashed();
    }

    public function returnInventoryAuthor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'return_inventory_author_id')
            ->withTrashed();
    }

    public function manager(): BelongsTo
    {
        return $this->belongsTo(User::class)
            ->withTrashed();
    }

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class)
            ->withTrashed();
    }

    // ------------------------------------------------------
    // -
    // -    Mutators
    // -
    // ------------------------------------------------------

    public $appends = [
        'total_without_global_discount',
        'total_global_discount',
        'total_without_taxes',
        'total_taxes',
        'total_with_taxes',
        'materials_count',
    ];

    protected $casts = [
        'reference' => 'string',
        'title' => 'string',
        'description' => 'string',
        'color' => 'string',
        'location' => 'string',
        'operation_start_date' => 'string',
        'operation_end_date' => 'string',
        'operation_is_full_days' => 'boolean',
        'mobilization_start_date' => 'string',
        'mobilization_end_date' => 'string',
        'is_confirmed' => 'boolean',
        'is_archived' => 'boolean',
        'is_billable' => 'boolean',
        'global_discount_rate' => AsDecimal::class,
        'currency' => 'string',
        'is_departure_inventory_done' => 'boolean',
        'departure_inventory_datetime' => 'string',
        'departure_inventory_author_id' => 'integer',
        'is_return_inventory_done' => 'boolean',
        'return_inventory_datetime' => 'string',
        'return_inventory_author_id' => 'integer',
        'manager_id' => 'integer',
        'author_id' => 'integer',
        'note' => 'string',
        'created_at' => 'immutable_datetime',
        'updated_at' => 'immutable_datetime',
        'deleted_at' => 'immutable_datetime',
    ];

    public function getMobilizationPeriodAttribute(): Period
    {
        return new Period(
            $this->mobilization_start_date,
            $this->mobilization_end_date,
        );
    }

    public function getOperationPeriodAttribute(): Period
    {
        return new Period(
            $this->operation_start_date,
            $this->operation_end_date,
            $this->operation_is_full_days,
        );
    }

    public function getMaterialsCountAttribute(): int
    {
        return $this->materials->sum(
            static fn (EventMaterial $material) => $material->quantity,
        );
    }

    /** @return Collection<array-key, Beneficiary> */
    public function getBeneficiariesAttribute(): Collection
    {
        return $this->getRelationValue('beneficiaries');
    }

    /** @return Collection<array-key, EventTechnician> */
    public function getTechniciansAttribute(): Collection
    {
        if (!isFeatureEnabled(Feature::TECHNICIANS)) {
            return new Collection([]);
        }

        return $this->getRelationValue('technicians');
    }

    /** @return Collection<array-key, EventPosition> */
    public function getPositionsAttribute(): Collection
    {
        if (!isFeatureEnabled(Feature::TECHNICIANS)) {
            return new Collection([]);
        }

        return $this->getRelationValue('positions');
    }

    /** @return Collection<array-key, EventMaterial> */
    public function getMaterialsAttribute(): Collection
    {
        return $this->getRelationValue('materials');
    }

    /** @return Collection<array-key, EventExtra> */
    public function getExtrasAttribute(): Collection
    {
        return $this->getRelationValue('extras');
    }

    public function getManagerAttribute(): User|null
    {
        return $this->getRelationValue('manager');
    }

    public function getAuthorAttribute(): User|null
    {
        return $this->getRelationValue('author');
    }

    public function getDepartureInventoryAuthorAttribute(): User|null
    {
        return $this->getRelationValue('departureInventoryAuthor');
    }

    public function getReturnInventoryAuthorAttribute(): User|null
    {
        return $this->getRelationValue('returnInventoryAuthor');
    }

    /** @return int[] */
    public function getParksAttribute(): array
    {
        return $this->materials
            ->reduce(
                static function (CoreCollection $parkIds, EventMaterial $eventMaterial) {
                    $material = $eventMaterial->material;
                    $parkIds[] = $material->park_id;
                    return $parkIds;
                },
                new CoreCollection(),
            )
            ->unique()
            ->sort(SORT_NUMERIC)
            ->values()
            ->all();
    }

    /** @return int[] */
    public function getCategoriesAttribute(): array
    {
        return $this->materials
            ->pluck('category_id')
            ->filter(static fn ($categoryId) => $categoryId !== null)
            ->unique()
            ->sort(SORT_NUMERIC)
            ->values()
            ->all();
    }

    /** @return Collection<array-key, Estimate> */
    public function getEstimatesAttribute(): Collection
    {
        return $this->getRelationValue('estimates');
    }

    /** @return Collection<array-key, Invoice> */
    public function getInvoicesAttribute(): Collection
    {
        return $this->getRelationValue('invoices');
    }

    /** @return Collection<array-key, Property> */
    public function getTotalisablePropertiesAttribute(): Collection
    {
        $totalisableProperties = Property::query()
            ->where('is_totalisable', true)
            ->get();

        $results = $totalisableProperties->reduce(
            function (Collection $totals, Property $property) {
                $propertyTotal = 0;
                foreach ($this->materials as $eventMaterial) {
                    $quantity = $eventMaterial->quantity;

                    $material = $eventMaterial->material;
                    $materialProperty = $material->properties->find($property->id);
                    if (!$materialProperty || $quantity === 0) {
                        continue;
                    }

                    $propertyTotal += $quantity * $materialProperty->value;

                    // - Ajoute ou met à jour la caractéristique dans la liste.
                    $materialProperty = clone $materialProperty;
                    $materialProperty->value = $propertyTotal;
                    $totals->put($property->id, $materialProperty);
                }
                return $totals;
            },
            new Collection(),
        );

        return $results->append('value')->sortBy('name');
    }

    public function getTotalWithoutGlobalDiscountAttribute(): Decimal|null
    {
        if (!$this->is_billable) {
            return null;
        }

        /** @var CoreCollection<array-key, EventMaterial|EventExtra> $lines */
        $lines = (new CoreCollection())
            ->concat($this->materials)
            ->concat($this->extras);

        return $lines
            ->reduce(
                static fn (Decimal $currentTotal, EventMaterial|EventExtra $line) => (
                    // NOTE: On prend bien ici le total AVEC remise de chaque ligne car
                    //       cet attribut retourne le total sans remise GLOBALE uniquement.
                    $currentTotal->plus($line->total_without_taxes)
                ),
                Decimal::zero(),
            )
            ->toScale(2, RoundingMode::UNNECESSARY);
    }

    public function getTotalGlobalDiscountAttribute(): Decimal|null
    {
        if (!$this->is_billable) {
            return null;
        }

        if ($this->total_without_global_discount->isLessThanOrEqualTo(0)) {
            return Decimal::zero()->toScale(2);
        }

        return $this->total_without_global_discount
            ->multipliedBy($this->global_discount_rate->dividedBy(100, 6))
            // @see https://wiki.dolibarr.org/index.php?title=VAT_setup,_calculation_and_rounding_rules
            ->toScale(2, RoundingMode::HALF_UP);
    }

    public function getTotalWithoutTaxesAttribute(): Decimal|null
    {
        if (!$this->is_billable) {
            return null;
        }

        return $this->total_without_global_discount
            ->minus($this->total_global_discount)
            // @see https://wiki.dolibarr.org/index.php?title=VAT_setup,_calculation_and_rounding_rules
            ->toScale(2, RoundingMode::HALF_UP);
    }

    public function getTotalTaxesAttribute(): array|null
    {
        if (!$this->is_billable) {
            return null;
        }

        /** @var CoreCollection<array-key, EventMaterial|EventExtra> $lines */
        $lines = (new CoreCollection())
            ->concat($this->materials)
            ->concat($this->extras);

        $rawTaxes = $lines->reduce(
            static function (array $currentTaxes, EventMaterial|EventExtra $line) {
                if ($line->taxes === null) {
                    return $currentTaxes;
                }

                foreach ($line->taxes as $tax) {
                    $identifier = md5(serialize([$tax['name'], $tax['is_rate'], $tax['value']]));
                    if (!array_key_exists($identifier, $currentTaxes)) {
                        $currentTaxes[$identifier] = array_merge($tax, [
                            'total' => Decimal::zero(),
                        ]);
                    }

                    /** @var Decimal $currentTaxAmount */
                    $currentTaxAmount = &$currentTaxes[$identifier]['total'];
                    $currentTaxAmount = $currentTaxAmount->plus(
                        !$tax['is_rate']
                            ? Decimal::of($tax['value'])->multipliedBy($line->quantity)
                            : $line->total_without_taxes->multipliedBy(
                                Decimal::of($tax['value'])->dividedBy(100, 5),
                            ),
                    );
                }

                return $currentTaxes;
            },
            [],
        );

        $taxes = [];
        foreach ($rawTaxes as $rawTax) {
            /** @var Decimal $total */
            $total = $rawTax['total']->toScale(2, RoundingMode::HALF_UP);

            if ($rawTax['is_rate']) {
                /** @var Decimal $totalGlobalDiscount */
                $totalGlobalDiscount = $total
                    ->multipliedBy($this->global_discount_rate->dividedBy(100, 6))
                    ->toScale(2, RoundingMode::HALF_UP);

                $total = $total
                    ->minus($totalGlobalDiscount)
                    ->toScale(2, RoundingMode::HALF_UP);
            }

            if ($total->isZero()) {
                continue;
            }

            $taxes[] = array_replace($rawTax, compact('total'));
        }

        $collator = new \Collator(container('i18n')->getLocale());
        usort($taxes, static function ($a, $b) use ($collator) {
            if ($a['is_rate'] xor $b['is_rate']) {
                return $a['is_rate'] ? -1 : 1;
            }

            $result = $collator->compare($a['name'], $b['name']);
            if ($result !== 0 || !$a['is_rate'] || !$b['is_rate']) {
                return $result;
            }

            return Decimal::of($a['value'])->compareTo($b['value']);
        });

        return $taxes;
    }

    public function getTotalWithTaxesAttribute(): Decimal|null
    {
        if (!$this->is_billable) {
            return null;
        }

        return (new CoreCollection($this->total_taxes))
            ->reduce(
                static fn (Decimal $currentTotal, array $tax) => (
                    $currentTotal->plus($tax['total'])
                ),
                $this->total_without_taxes,
            )
            // @see https://wiki.dolibarr.org/index.php?title=VAT_setup,_calculation_and_rounding_rules
            ->toScale(2, RoundingMode::HALF_UP);
    }

    public function getTotalReplacementAttribute(): Decimal
    {
        return $this->materials
            ->reduce(
                static fn (Decimal $currentTotal, EventMaterial $material) => (
                    $currentTotal->plus($material->total_replacement_price ?? Decimal::zero())
                ),
                Decimal::zero(),
            )
            ->toScale(2, RoundingMode::UNNECESSARY);
    }

    public function getIsEditableAttribute(): bool
    {
        return (
            // - Un événement archivé n'est pas modifiable.
            !$this->is_archived &&

            // - Un événement ne peut être modifié que si son inventaire de retour
            //   n'a pas été effectué (sans quoi celui-ci n'aurait plus aucun sens,
            //   d'autant que le stock global a pu être impacté suite à cet inventaire).
            !$this->is_return_inventory_done
        );
    }

    public function getHasMaterialsAttribute(): bool
    {
        return !$this->materials->isEmpty();
    }

    public function getHasMissingMaterialsAttribute(): bool|null
    {
        if (!$this->exists || $this->is_archived) {
            return null;
        }

        // - Si l'événement est passé ET que l'inventaire de retour est fait,
        //   la disponibilité du matériel n'est pas calculée.
        if ($this->mobilization_period->isPast() && $this->is_return_inventory_done) {
            return null;
        }

        return $this->cacheGet(
            'has_missing_materials',
            function (?CacheItemInterface $cacheItem) {
                if ($cacheItem) {
                    $cacheItem->expiresAfter(new \DateInterval('P1D'));
                }
                return $this->missingMaterials()->isNotEmpty();
            },
        );
    }

    public function getHasDeletedMaterialsAttribute(): bool
    {
        return $this->materials->some(
            static fn (EventMaterial $material) => $material->is_deleted,
        );
    }

    public function getHasUnassignedMandatoryPositionsAttribute(): bool|null
    {
        if (!isFeatureEnabled(Feature::TECHNICIANS) || !$this->exists || $this->is_archived) {
            return null;
        }

        return $this->positions->some(static fn (EventPosition $position) => (
            // Note: `$position->is_assigned` peut être à `null`
            //       si l'information n'est pas disponible.
            $position->is_mandatory && $position->is_assigned === false
        ));
    }

    public function getIsDepartureInventoryPeriodOpenAttribute(): bool
    {
        return $this->mobilization_period->getStartDate()
            ->subDays(self::DEPARTURE_INVENTORY_DELAY)
            ->isPast();
    }

    public function getIsDepartureInventoryPeriodClosedAttribute(): bool
    {
        // - Si l'inventaire de retour est fait, la période de réalisation
        //   des inventaires de départ est forcément fermée.
        if ($this->is_return_inventory_done) {
            return true;
        }

        // NOTE: On laisse un délai de 1 jour après la date de début de mobilisation
        //       pour faire l'inventaire de départ (mais en ne dépassant jamais la date
        //       de fin de mobilisation).
        $inventoryPeriodCloseDate = $this->mobilization_period->getStartDate()->addDay();
        if ($inventoryPeriodCloseDate->isAfter($this->mobilization_period->getEndDate())) {
            $inventoryPeriodCloseDate = $this->mobilization_period->getEndDate();
        }

        return $inventoryPeriodCloseDate->isPast();
    }

    public function getCanFinishDepartureInventoryAttribute(): bool
    {
        if ($this->is_archived) {
            return false;
        }

        if ($this->is_departure_inventory_done) {
            return false;
        }

        if (!$this->is_departure_inventory_period_open) {
            return false;
        }

        if ($this->is_departure_inventory_period_closed) {
            return false;
        }

        if ($this->materials->isEmpty() || $this->has_missing_materials) {
            return false;
        }

        return $this->materials->every(
            static fn (EventMaterial $material) => (
                $material->is_departure_inventory_filled
            ),
        );
    }

    public function getIsReturnInventoryPeriodOpenAttribute(): bool
    {
        // NOTE: C'est la date de début d'événement qui fait foi pour permettre
        //       le retour, pas la date de début de mobilisation.
        //       (sans quoi on pourrait faire le retour d'un événement avant même
        //       qu'il ait réellement commencé, ce qui n'a pas de sens).
        return $this->operation_period->isPastOrOngoing();
    }

    public function getCanFinishReturnInventoryAttribute(): bool
    {
        if ($this->is_archived) {
            return false;
        }

        if ($this->is_return_inventory_done) {
            return false;
        }

        if (!$this->is_return_inventory_period_open) {
            return false;
        }

        if ($this->materials->isEmpty() || $this->has_missing_materials) {
            return false;
        }

        return $this->materials->every(
            static fn (EventMaterial $material) => (
                $material->is_return_inventory_filled
            ),
        );
    }

    public function getIsReturnInventoryStartedAttribute(): bool
    {
        // - Si l'inventaire de retour est terminé, c'est qu'il a forcément commencé.
        if ($this->is_return_inventory_done) {
            return true;
        }

        // - Si l'inventaire de retour ne peut pas être réalisé, il ne peut pas avoir commencé.
        if (!$this->is_return_inventory_period_open) {
            return false;
        }

        // - S'il existe au moins une quantité retournée non nulle,
        //   c'est que l'inventaire de retour a été sauvegardé au moins une fois.
        return $this->materials->whereNotNull('quantity_returned')->isNotEmpty();
    }

    public function getHasNotReturnedMaterialsAttribute(): bool|null
    {
        // - Pas de calcul pour les événements archivés (ou pas encore persisté).
        if (!$this->exists || $this->is_archived) {
            return null;
        }

        // - Si l'inventaire n'a pas encore été effectué, on a pas l'information.
        if (!$this->is_return_inventory_done) {
            return null;
        }

        // - S'il n'y a pas de material dans l'événement, il ne peut pas y avoir de manque.
        if ($this->materials->isEmpty()) {
            return false;
        }

        return $this->cacheGet(
            'has_not_returned_materials',
            function (?CacheItemInterface $cacheItem) {
                if ($cacheItem) {
                    $cacheItem->expiresAfter(new \DateInterval('P1D'));
                }

                return $this->materials->some(
                    static fn (EventMaterial $material) => (
                        ($material->quantity - ($material->quantity_returned ?? 0)) > 0
                    ),
                );
            },
        );
    }

    public function getHasMaterialsReturnedBrokenAttribute(): bool|null
    {
        // - Pas de calcul pour les événements archivés (ou pas encore persisté).
        if (!$this->exists || $this->is_archived) {
            return null;
        }

        // - Si l'inventaire n'a pas encore été effectué, on a pas l'information.
        if (!$this->is_return_inventory_done) {
            return null;
        }

        // - S'il n'y a pas de material dans l'événement, il ne peut pas y
        //   avoir de matériel retourné cassé.
        if ($this->materials->isEmpty()) {
            return false;
        }

        return $this->materials->some(
            static fn (EventMaterial $material) => (
                ($material->quantity_returned_broken ?? 0) > 0
            ),
        );
    }

    // ------------------------------------------------------
    // -
    // -    Getters
    // -
    // ------------------------------------------------------

    public function getStartDate(): CarbonImmutable
    {
        return $this->mobilization_period->getStartDate();
    }

    public function getEndDate(): CarbonImmutable|null
    {
        // - Si la gestion manuelle des retours est activé, que
        //   la mobilisation est terminée et qu'on a du matériel,
        //   on considère l'éventuel retard.
        $useManualReturn = Config::get('returnPolicy') === ReturnPolicy::MANUAL;
        if (
            $useManualReturn &&
            $this->mobilization_period->isPast() &&
            !$this->materials->isEmpty()
        ) {
            // - Si l'inventaire de retour est fait et que la date
            //   d'inventaire est postérieure à la fin de la mobilisation,
            //   il y a eu un retard.
            if (
                $this->is_return_inventory_done &&
                $this->return_inventory_datetime !== null &&
                $this->mobilization_period->getEndDate()->isBefore(
                    $this->return_inventory_datetime,
                )
            ) {
                return CarbonImmutable::parse($this->return_inventory_datetime)
                    ->roundMinutes(15, 'ceil');
            }

            // - Sinon, si l'événement n'est pas archivé et qu'il n'a pas
            //   d'inventaire de retour, on ne connaît pas la date de fin.
            if (!$this->is_archived && !$this->is_return_inventory_done) {
                return null;
            }
        }

        // - Sinon, si l'événement est en cours ou que le mode manuel n'est
        //   pas activé, ou encore qu'il n'y a pas de matériel, on utilise
        //   la date de fin de mobilisation.
        return $this->mobilization_period->getEndDate();
    }

    // ------------------------------------------------------
    // -
    // -    Setters
    // -
    // ------------------------------------------------------

    protected $fillable = [
        'reference',
        'title',
        'description',
        'operation_start_date',
        'operation_end_date',
        'operation_is_full_days',
        'operation_period',
        'mobilization_start_date',
        'mobilization_end_date',
        'mobilization_period',
        'color',
        'is_confirmed',
        'location',
        'is_billable',
        'global_discount_rate',
        'currency',
        'author_id',
        'manager_id',
        'note',
    ];

    public function setOperationPeriodAttribute(mixed $rawPeriod): void
    {
        $period = Period::tryFrom($rawPeriod);

        $this->operation_start_date = $period?->getStartDate()->format('Y-m-d H:i:s');
        $this->operation_end_date = $period?->getEndDate()?->format('Y-m-d H:i:s');
        $this->operation_is_full_days = $period?->isFullDays() ?? false;
    }

    public function setMobilizationPeriodAttribute(mixed $rawPeriod): void
    {
        $period = Period::tryFrom($rawPeriod);

        $this->mobilization_start_date = $period?->getStartDate()->format('Y-m-d H:i:s');
        $this->mobilization_end_date = $period?->getEndDate()?->format('Y-m-d H:i:s');
    }

    public function setReferenceAttribute(mixed $value): void
    {
        $value = is_string($value) ? trim($value) : $value;
        $this->attributes['reference'] = $value;
    }

    public function setIsBillableAttribute(mixed $isBillable): void
    {
        $this->attributes['is_billable'] = $isBillable;

        // - Si c'est une valeur invalide, on ne va pas plus loin.
        if (!is_bool($isBillable)) {
            return;
        }

        // - Lorsque l'on change le `is_billable` et que le `global_discount_rate`
        //   était à une valeur équivalente à `null`, on l'ajuste automatiquement.
        if ($this->global_discount_rate === null || $this->global_discount_rate->isZero()) {
            $this->global_discount_rate = $isBillable ? Decimal::zero() : null;
        }
    }

    public function setNoteAttribute(mixed $value): void
    {
        $value = is_string($value) ? trim($value) : $value;
        $this->attributes['note'] = $value === '' ? null : $value;
    }

    // ------------------------------------------------------
    // -
    // -    Méthodes liées à une "entity"
    // -
    // ------------------------------------------------------

    public function edit(array $data): static
    {
        $oldOperationPeriod = $this->exists ? $this->operation_period : null;
        $oldMobilizationPeriod = $this->exists ? $this->mobilization_period : null;

        // - Si la facturabilité est désactivée, on s'assure que la remise globale est annulée.
        if (array_key_exists('is_billable', $data) && $data['is_billable'] === false) {
            $data['global_discount_rate'] = null;
        }

        $this->fill($data);

        $validationErrors = [];
        if (!$this->isValid()) {
            $validationErrors = $this->validationErrors();
        }

        $hasPeriodChanged = (
            !($oldOperationPeriod?->isSame($this->operation_period) ?? true) ||
            !($oldMobilizationPeriod?->isSame($this->mobilization_period) ?? true)
        );

        if (!empty($validationErrors)) {
            throw new ValidationException($validationErrors);
        }
        $this->save();

        // - Bénéficiaires
        if (isset($data['beneficiaries'])) {
            Assert::isArray($data['beneficiaries'], "Key `beneficiaries` must be an array.");

            try {
                $this->syncBeneficiaries($data['beneficiaries']);
            } catch (ValidationException $e) {
                throw new ValidationException([
                    'beneficiaries' => $e->getValidationErrors(),
                ]);
            }
        }

        // - Techniciens
        if (isFeatureEnabled(Feature::TECHNICIANS)) {
            $technicians = null;
            if (isset($data['technicians'])) {
                Assert::isArray($data['technicians'], "Key `technicians` must be an array.");
                $technicians = $data['technicians'];
            } elseif ($hasPeriodChanged) {
                $assignationPeriod = $this->mobilization_period->merge($this->operation_period);
                $technicians = $this->technicians->reduce(
                    static function ($assignments, $oldAssignment) use ($assignationPeriod) {
                        $newPeriod = $oldAssignment->computeNewPeriod($assignationPeriod);
                        if ($newPeriod !== null) {
                            $assignments[] = [
                                'id' => $oldAssignment->technician_id,
                                'role_id' => $oldAssignment->role_id,
                                'period' => $newPeriod,
                            ];
                        }
                        return $assignments;
                    },
                    [],
                );
            }
            if ($technicians !== null) {
                try {
                    $this->syncTechnicians($technicians);
                } catch (ValidationException $e) {
                    throw new ValidationException([
                        'technicians' => $e->getValidationErrors(),
                    ]);
                }
            }
        } elseif ($hasPeriodChanged) {
            $this->technicians()->delete();
        }

        // - Matériels
        if (isset($data['materials'])) {
            Assert::isArray($data['materials'], "Key `materials` must be an array.");

            try {
                $this->syncMaterials($data['materials']);
            } catch (ValidationException $e) {
                throw new ValidationException([
                    'materials' => $e->getValidationErrors(),
                ]);
            }
        }

        // - Extras
        if (isset($data['extras'])) {
            Assert::isArray($data['extras'], "Key `extras` must be an array.");

            try {
                $this->syncExtras($data['extras']);
            } catch (ValidationException $e) {
                throw new ValidationException([
                    'extras' => $e->getValidationErrors(),
                ]);
            }
        }

        return $this->refresh();
    }

    /** @return Collection<array-key, EventMaterial> */
    public function missingMaterials(): Collection
    {
        return $this->withAvailabilities()->materials
            ->filter(static fn (EventMaterial $material) => (
                $material->quantity_missing > 0
            ))
            ->sortBy('name')
            ->values();
    }

    public function syncBeneficiaries(array $beneficiariesIds): static
    {
        $this->beneficiaries()->sync($beneficiariesIds);
        return $this->refresh();
    }

    public function syncTechnicians(array $techniciansData): static
    {
        if (!isFeatureEnabled(Feature::TECHNICIANS)) {
            throw new \LogicException(
                "Technicians feature is disabled, this method " .
                "should not have been called.",
            );
        }

        $schema = V::arrayType()->each(new SchemaStrict(
            new Rule\Key('id'),
            new Rule\Key('role_id'),
            new Rule\Key('period'),
        ));
        if (!$schema->validate($techniciansData)) {
            throw new \InvalidArgumentException("Invalid data format.");
        }

        /** @var CoreCollection<int, EventTechnician> $savedEventTechnicians */
        $savedEventTechnicians = $this->technicians()->get()->toBase()
            ->keyBy('technician_id');

        $technicians = new CoreCollection(array_map(
            function ($technicianData) use ($savedEventTechnicians) {
                $savedEventTechnician = $savedEventTechnicians->get($technicianData['id']);
                return ($savedEventTechnician ?? new EventTechnician())->fill([
                    'event_id' => $this->id,
                    'technician_id' => $technicianData['id'],
                    'role_id' => $technicianData['role_id'],
                    'period' => $technicianData['period'],
                ]);
            },
            $techniciansData,
        ));

        return dbTransaction(function () use ($technicians) {
            $outdatedTechnicians = $this->technicians->diff($technicians);
            EventTechnician::destroy($outdatedTechnicians);

            $errors = $technicians
                ->filter(static fn ($technician) => !$technician->isValid())
                ->keyBy('technician_id')
                ->map(static fn ($technician) => $technician->validationErrors())
                ->all();

            if (!empty($errors)) {
                throw new ValidationException($errors);
            }

            $this->technicians()->saveMany($technicians);
            return $this->refresh();
        });
    }

    public function syncMaterials(array $materialsData): static
    {
        $schema = V::arrayType()->each(new SchemaStrict(
            new Rule\Key('id'),
            new Rule\Key('quantity', V::intVal()->min(0)),
            new Rule\Key('unit_price', null, false),
            new Rule\Key('discount_rate', null, false),
            new Rule\Key('degressive_rate', null, false),
            new Rule\Key('taxes', null, false),
        ));
        if (!$schema->validate($materialsData)) {
            throw new \InvalidArgumentException("Invalid data format.");
        }

        /** @var CoreCollection<int, EventMaterial> $savedEventMaterials */
        $savedEventMaterials = $this->materials()->get()->toBase()
            ->keyBy('material_id');

        $data = [];
        foreach ($materialsData as $materialData) {
            $quantity = (int) $materialData['quantity'];
            if ($quantity <= 0) {
                continue;
            }

            $savedEventMaterial = $savedEventMaterials->get($materialData['id']);
            $eventMaterialHasReturnData = $savedEventMaterial?->quantity_returned !== null;

            // - On ne peut ajouter un matériel à un événement dont la devise est différente de la devise
            //   globale courante car il va être impossible de récupérer le prix de remplacement du matériel
            //   dans la devise de l'événement (ainsi que les informations de facturation si non fournies).
            if ($savedEventMaterial === null && $this->currency !== Config::get('currency')) {
                throw new \LogicException(
                    "Unable to add material to an event whose currency is " .
                    "different from the current global currency.",
                );
            }

            /** @var Material $material */
            $material = Material::withTrashed()->find($materialData['id']);
            if ($material === null || ($savedEventMaterial === null && $material->is_deleted)) {
                throw new \InvalidArgumentException(
                    "One or more materials added to the event does not exist.",
                );
            }

            $name = $savedEventMaterial?->name ?? $material->name;
            $reference = $savedEventMaterial?->reference ?? $material->reference;

            $unitPrice = null;
            $degressiveRate = null;
            $discountRate = null;
            $taxes = null;
            if ($this->is_billable) {
                $unitPrice = $materialData['unit_price']
                    ?? $savedEventMaterial?->unit_price
                    ?? $material->rental_price
                    ?? Decimal::zero();

                $discountRate = $materialData['discount_rate']
                    ?? $savedEventMaterial?->discount_rate
                    ?? Decimal::zero();

                // - Récupération du tarif dégressif à persister pour le matériel d'événement.
                $degressiveRate = $materialData['degressive_rate'] ?? $savedEventMaterial?->degressive_rate;
                if ($degressiveRate === null) {
                    $durationDays = $this->operation_period->asDays();
                    $degressiveRate = $material->degressive_rate?->computeForDays($durationDays)
                        // - Pas de dégressivité.
                        ?? $durationDays;
                }

                // - Récupération des taxes à persister pour le matériel d'événement.
                //   Note: Vu que la valeur enregistrée peut-être `null` pour signifier
                //   l'absence de taxe, on vérifie l'existence de la données plutôt ue
                //   la valeur `null`.
                if (array_key_exists('taxes', $materialData)) {
                    $taxes = $materialData['taxes'];
                } elseif ($savedEventMaterial !== null) {
                    $taxes = $savedEventMaterial?->taxes;
                } else {
                    $taxes = $material->tax?->asFlatArray();
                }
            }

            $unitReplacementPrice = $savedEventMaterial?->unit_replacement_price
                ?? $material->replacement_price;

            $quantityDeparted = (
                $savedEventMaterial?->quantity_departed !== null
                    ? min($savedEventMaterial->quantity_departed, $quantity)
                    : null
            );

            $quantityReturned = (
                $savedEventMaterial?->quantity_returned !== null
                    ? min($savedEventMaterial->quantity_returned, $quantity)
                    : ($eventMaterialHasReturnData ? 0 : null)
            );

            $quantityReturnedBroken = (
                $savedEventMaterial?->quantity_returned_broken !== null
                    ? min($savedEventMaterial->quantity_returned_broken, $quantity)
                    : ($eventMaterialHasReturnData ? 0 : null)
            );

            $eventMaterial = ($savedEventMaterial ?? new EventMaterial())->fill([
                'material_id' => $material->id,
                'name' => $name,
                'reference' => $reference,
                'quantity' => $quantity,
                'unit_price' => $unitPrice,
                'discount_rate' => $discountRate,
                'degressive_rate' => $degressiveRate,
                'taxes' => $taxes,
                'unit_replacement_price' => $unitReplacementPrice,
                'quantity_departed' => $quantityDeparted,
                'quantity_returned' => $quantityReturned,
                'quantity_returned_broken' => $quantityReturnedBroken,
            ]);

            // - Quand on ajoute un matériel qui n'existe pas encore dans la liste, il faut définir
            //   le prix unitaire du matériel (obligatoire quand la réservation est facturable).
            if ($this->is_billable && $eventMaterial->unit_price === null) {
                $eventMaterial->unit_price = $material->rental_price;
            }

            $data[] = [
                'material' => $eventMaterial,
            ];
        }

        dbTransaction(function () use ($data) {
            // - On supprime le matériel obsolète.
            $outdatedMaterials = $this->materials->diff(array_column($data, 'material'));

            EventMaterial::destroy($outdatedMaterials);

            foreach ($data as $currentData) {
                /** @var EventMaterial $material */
                $material = $currentData['material'];
                $this->materials()->save($material);
            }
        });

        return $this->refresh();
    }

    public function syncExtras(array $extraLinesData): static
    {
        if (!$this->is_billable) {
            throw new \LogicException("Unable to add extra lines to a non billable event.");
        }

        $schema = V::arrayType()->each(new SchemaStrict(
            new Rule\Key('id', null, false),
            new Rule\Key('description'),
            new Rule\Key('quantity', V::intVal()->min(1)),
            new Rule\Key('unit_price', null, false),
            new Rule\Key('tax_id', null, false),
            new Rule\Key('taxes', null, false),
        ));
        if (!$schema->validate($extraLinesData)) {
            throw new \InvalidArgumentException("Invalid data format.");
        }

        /** @var Collection<int, EventExtra> $savedExtraLines */
        $savedExtraLines = $this->extras()->get()
            ->keyBy('id');

        $extraLines = new CoreCollection();
        foreach ($extraLinesData as $index => $extraLineData) {
            $savedExtraLine = isset($extraLineData['id'])
                ? $savedExtraLines->get($extraLineData['id'])
                : null;

            $unitPrice = null;
            $liveTax = null;
            $taxes = null;
            if ($this->is_billable) {
                $unitPrice = $extraLineData['unit_price']
                    ?? $savedExtraLine?->unit_price
                    ?? Decimal::zero();

                $liveTax = $savedExtraLine?->liveTax;
                if (array_key_exists('tax_id', $extraLineData)) {
                    $liveTax = $extraLineData['tax_id'] !== null
                        ? Tax::find($extraLineData['tax_id'])
                        : null;
                }

                if (array_key_exists('taxes', $extraLineData)) {
                    $taxes = $extraLineData['taxes'];
                } elseif ($savedExtraLine !== null) {
                    $taxes = $savedExtraLine?->taxes;
                } else {
                    $taxes = $liveTax?->asFlatArray();
                }
            }

            $extraLines->put($index, tap(
                $savedExtraLine ?? new EventExtra(),
                static function (EventExtra $extraLine) use ($extraLineData, $unitPrice, $liveTax, $taxes) {
                    $extraLine->fill([
                        'description' => $extraLineData['description'],
                        'quantity' => $extraLineData['quantity'],
                        'unit_price' => $unitPrice,
                        'taxes' => $taxes,
                    ]);

                    if ($liveTax !== null) {
                        $extraLine->liveTax()->associate($liveTax);
                    } else {
                        $extraLine->liveTax()->dissociate();
                    }
                },
            ));
        }

        return dbTransaction(function () use ($extraLines) {
            // - On supprime les lignes obsolètes.
            $outdatedLines = $this->extras->diff($extraLines);
            EventExtra::destroy($outdatedLines);

            $errors = $extraLines
                ->filter(static fn ($extraLine) => !$extraLine->isValid())
                ->map(static fn ($extraLine) => $extraLine->validationErrors())
                ->all();

            if (!empty($errors)) {
                throw new ValidationException($errors);
            }

            $this->extras()->saveMany($extraLines);
            return $this->refresh();
        });
    }

    public function syncBilling(array $billingData): static
    {
        if (!$this->is_billable) {
            throw new \LogicException("Unable to update billing data of a non billable event.");
        }

        $schema = new SchemaStrict(
            new Rule\Key(
                'materials',
                V::arrayType()->each(new SchemaStrict(
                    new Rule\Key('id'),
                    new Rule\Key('unit_price'),
                    new Rule\Key('discount_rate'),
                )),
            ),
            new Rule\Key(
                'extras',
                V::arrayType()->each(new SchemaStrict(
                    new Rule\Key('id', null, false),
                    new Rule\Key('description'),
                    new Rule\Key('quantity', V::intVal()->min(1)),
                    new Rule\Key('unit_price'),
                    new Rule\Key('tax_id'),
                    new Rule\Key('taxes', null, false),
                )),
            ),
            new Rule\Key('global_discount_rate'),
        );
        if (!$schema->validate($billingData)) {
            throw new \InvalidArgumentException("Invalid data format.");
        }

        /** @var CoreCollection<int, EventMaterial> $savedEventMaterials */
        $savedEventMaterials = $this->materials()->get()->toBase()
            ->keyBy('material_id');

        $allMaterialsFilled = $savedEventMaterials->pluck('material_id')
            ->diff(array_column($billingData['materials'], 'id'))
            ->isEmpty();

        if (!$allMaterialsFilled) {
            throw new \InvalidArgumentException("The billing data for some materials are missing.");
        }

        return dbTransaction(function () use ($billingData, $savedEventMaterials) {
            // - Lignes de matériel.
            foreach ($billingData['materials'] as $materialData) {
                $savedEventMaterial = $savedEventMaterials->get($materialData['id']);

                $savedEventMaterial->unit_price = $materialData['unit_price'];
                $savedEventMaterial->discount_rate = $materialData['discount_rate'];

                $this->materials()->save($savedEventMaterial);
            }

            // - Lignes extras.
            try {
                $this->syncExtras($billingData['extras']);
            } catch (ValidationException $e) {
                throw new ValidationException([
                    'extras' => $e->getValidationErrors(),
                ]);
            }

            // - Remise globale.
            $this->global_discount_rate = $billingData['global_discount_rate'];
            $this->save();

            return $this->refresh();
        });
    }

    public function updateDepartureInventory(array $inventoryData): static
    {
        if ($this->is_archived) {
            throw new \LogicException("This event is archived.");
        }

        // - Si l'inventaire de départ est déjà terminé.
        if ($this->is_departure_inventory_done) {
            throw new \LogicException("This event's departure inventory is already done.");
        }

        // - Si l'inventaire de départ ne peut pas encore être commencé.
        if (!$this->is_departure_inventory_period_open) {
            throw new \LogicException("This event's departure inventory can't be done yet.");
        }

        // - Si la période de réalisation de l'inventaire est dépassée.
        if ($this->is_departure_inventory_period_closed) {
            throw new \LogicException("This event's departure inventory cannot be done anymore.");
        }

        // - Si l'événement ne contient pas de matériel, il n'y a pas d'inventaire à faire.
        if ($this->materials->isEmpty()) {
            throw new \LogicException("This event contains no material, so there can be no inventory.");
        }

        // - S'il y a du matériel manquant, on ne peut pas faire l'inventaire de départ.
        if ($this->has_missing_materials) {
            throw new \LogicException("This event contains shortage that should be fixed.");
        }

        $schema = V::arrayType()->each(new SchemaStrict(
            new Rule\Key('id'),
            new Rule\Key('actual', V::intVal()->min(0)),
            new Rule\Key('comment', V::anyOf(V::nullType(), V::stringType()), false),
        ));
        if (!$schema->validate($inventoryData)) {
            throw new \InvalidArgumentException("Invalid data format.");
        }
        $inventoryData = (new CoreCollection($inventoryData))->keyBy('id');

        $errors = [];
        foreach ($this->materials as $eventMaterial) {
            $material = $eventMaterial->material;
            $addError = static function ($message) use ($material, &$errors) {
                $errors[] = ['id' => $material->id, 'message' => __($message)];
            };

            $materialInventory = $inventoryData->get($material->id);
            if ($materialInventory === null) {
                $addError('missing-outgoing-quantity');
                continue;
            }

            // - Quantité effectivement partie.
            $quantityDeparted = (int) $materialInventory['actual'];

            if ($quantityDeparted > $eventMaterial->quantity) {
                $addError('outgoing-quantity-cannot-be-greater-than-planned-quantity');
                continue;
            }

            $eventMaterial->quantity_departed = $quantityDeparted;
            $eventMaterial->departure_comment = $materialInventory['comment'] ?? null;
        }

        if (!empty($errors)) {
            $this->refresh();
            throw new ValidationException($errors);
        }

        try {
            dbTransaction(function () {
                foreach ($this->materials as $eventMaterial) {
                    $eventMaterial->save();
                }
            });
        } catch (ValidationException) {
            // - Les erreurs de validation sont censées être gérées pour chaque matériel dans le code au-dessus.
            //   On ne peut pas laisser passer des erreurs de validation non formatées.
            throw new \LogicException("Unexpected validation errors occurred while saving the departure inventory.");
        } finally {
            $this->refresh();
        }

        return $this->refresh();
    }

    public function finishDepartureInventory(User $author): static
    {
        if ($this->is_archived) {
            throw new \LogicException("This event is archived.");
        }

        // - Si l'inventaire de départ est déjà terminé.
        if ($this->is_departure_inventory_done) {
            throw new \LogicException("This event's departure inventory is already done.");
        }

        // - Si l'inventaire de départ ne peut pas encore être commencé.
        if (!$this->is_departure_inventory_period_open) {
            throw new \LogicException("This event's departure inventory can't be done yet.");
        }

        // - Si la période de réalisation de l'inventaire est dépassée.
        if ($this->is_departure_inventory_period_closed) {
            throw new \LogicException("This event's departure inventory cannot be done anymore.");
        }

        // - Si l'événement ne contient pas de matériel, il n'y a pas d'inventaire à faire.
        if ($this->materials->isEmpty()) {
            throw new \LogicException("This event contains no material, so there can be no inventory.");
        }

        // - S'il y a du matériel manquant, on ne peut pas faire l'inventaire de départ.
        if ($this->has_missing_materials) {
            throw new \LogicException("This event contains shortage that should be fixed.");
        }

        if (!$this->can_finish_departure_inventory) {
            throw new \LogicException("This event's departure inventory cannot be finished.");
        }

        return dbTransaction(function () use ($author) {
            $this->is_confirmed = true;
            $this->is_departure_inventory_done = true;

            $departureInventoryDate = CarbonImmutable::now();
            $this->departure_inventory_datetime = (
                $departureInventoryDate->format('Y-m-d H:i:s')
            );

            // - On déplace la date de début de mobilisation si l'inventaire de départ
            //   est réalisé avant la date de début de mobilisation prévue.
            $roundedDepartureInventoryDate = $departureInventoryDate->roundMinutes(15, 'ceil');
            $shouldMoveMobilizationStartDate = (
                $roundedDepartureInventoryDate->isBefore($this->mobilization_start_date)
            );
            if ($shouldMoveMobilizationStartDate) {
                // Note: On ne décale pas pour autant les assignations technicien car
                //       ce n'est pas parce que l'inventaire de départ a été fait avant
                //       que cela remet en cause la planification initialement prévue.
                //       => S'ils veulent modifier ça ils iront donc à l'étape de
                //          planification des techniciens dans l'edition de l'événement)
                $this->mobilization_start_date = (
                    $roundedDepartureInventoryDate->format('Y-m-d H:i:s')
                );
            }

            $this->departureInventoryAuthor()->associate($author);
            $this->save();

            return $this->refresh();
        });
    }

    public function cancelDepartureInventory()
    {
        if ($this->is_archived) {
            throw new \LogicException("This event is archived.");
        }

        // - Si l'inventaire de départ n'est pas terminé, il n'y a rien à annuler.
        if (!$this->is_departure_inventory_done) {
            throw new \LogicException("This event's departure inventory is not done.");
        }

        // - Si l'inventaire de retour est déjà terminé, on ne peut plus annuler l'inventaire de départ.
        if ($this->is_return_inventory_done) {
            throw new \LogicException(
                "This event's return inventory is already done, the departure " .
                "inventory can no longer be cancelled.",
            );
        }

        // - Si le début de l'événement est dans le passé, on ne peut plus annuler l'inventaire de départ.
        if ($this->operation_period->isPastOrOngoing()) {
            throw new \LogicException(
                "This event has already started, the departure inventory can no " .
                "longer be cancelled.",
            );
        }

        return dbTransaction(function () {
            $this->is_departure_inventory_done = false;
            $this->departure_inventory_author_id = null;
            $this->departure_inventory_datetime = null;

            // - Si la période de réalisation de l'inventaire de départ est terminée mais que la date
            //   de début d'opération est dans le futur, on reset la date de début de mobilisation.
            $shouldMoveMobilizationStartDate = (
                $this->is_departure_inventory_period_closed &&
                $this->operation_period->getStartDate()->isFuture()
            );
            if ($shouldMoveMobilizationStartDate) {
                $this->mobilization_start_date = $this->operation_start_date;
            }

            $this->save();
            return $this->refresh();
        });
    }

    public function updateReturnInventory(array $inventoryData): static
    {
        if ($this->is_archived) {
            throw new \LogicException("This event is archived.");
        }

        // - Si l'inventaire de retour est déjà terminé.
        if ($this->is_return_inventory_done) {
            throw new \LogicException("This event's return inventory is already done.");
        }

        // - Si l'inventaire de retour ne peut pas encore être commencé.
        if (!$this->is_return_inventory_period_open) {
            throw new \LogicException("This event's return inventory can't be done yet.");
        }

        // - Si l'événement ne contient pas de matériel, il n'y a pas d'inventaire à faire.
        if ($this->materials->isEmpty()) {
            throw new \LogicException("This event contains no material, so there can be no inventory.");
        }

        // - S'il y a du matériel manquant, on ne peut pas faire l'inventaire de retour.
        if ($this->has_missing_materials) {
            throw new \LogicException("This event contains shortage that should be fixed.");
        }

        $schema = V::arrayType()->each(new SchemaStrict(
            new Rule\Key('id'),
            new Rule\Key('actual', V::intVal()->min(0)),
            new Rule\Key('broken', V::intVal()->min(0)),
        ));
        if (!$schema->validate($inventoryData)) {
            throw new \InvalidArgumentException("Invalid data format.");
        }
        $inventoryData = (new CoreCollection($inventoryData))->keyBy('id');

        $errors = [];
        foreach ($this->materials as $eventMaterial) {
            $material = $eventMaterial->material;
            $addError = static function ($message) use ($material, &$errors) {
                $errors[] = ['id' => $material->id, 'message' => __($message)];
            };

            $materialInventory = $inventoryData->get($material->id);
            if ($materialInventory === null) {
                $addError('missing-returned-quantity');
                continue;
            }

            // - Quantité effectivement retournée.
            $quantityReturned = (int) $materialInventory['actual'];

            // - Quantité retournée cassée.
            $quantityReturnedBroken = (int) $materialInventory['broken'];

            if ($quantityReturned > $eventMaterial->quantity) {
                $addError('returned-quantity-cannot-be-greater-than-output-quantity');
                continue;
            }

            if ($quantityReturnedBroken > $quantityReturned) {
                $addError('broken-quantity-cannot-be-greater-than-returned-quantity');
                continue;
            }

            $eventMaterial->quantity_returned = $quantityReturned;
            $eventMaterial->quantity_returned_broken = $quantityReturnedBroken;
        }

        if (!empty($errors)) {
            $this->refresh();
            throw new ValidationException($errors);
        }

        try {
            dbTransaction(function () {
                foreach ($this->materials as $eventMaterial) {
                    $eventMaterial->save();
                }
            });
        } catch (ValidationException) {
            // - Ls erreurs de validation sont censées être gérées pour chaque matériel dans le code au-dessus.
            //   On ne peut pas laisser passer des erreurs de validation non formatées.
            throw new \LogicException("Unexpected validation errors occurred while saving the return inventory.");
        } finally {
            $this->refresh();
        }

        return $this->refresh();
    }

    public function finishReturnInventory(User $author, ?CarbonInterface $date = null): static
    {
        if ($this->is_archived) {
            throw new \LogicException("This event is archived.");
        }

        // - Si l'inventaire de retour est déjà terminé.
        if ($this->is_return_inventory_done) {
            throw new \LogicException("This event's return inventory is already done.");
        }

        // - Si l'inventaire de retour ne peut pas encore être commencé.
        if (!$this->is_return_inventory_period_open) {
            throw new \LogicException("This event's return inventory can't be done yet.");
        }

        // - Si l'événement ne contient pas de matériel, il n'y a pas d'inventaire à faire.
        if ($this->materials->isEmpty()) {
            throw new \LogicException("This event contains no material, so there can be no inventory.");
        }

        // - S'il y a du matériel manquant, on ne peut pas faire l'inventaire de retour.
        if ($this->has_missing_materials) {
            throw new \LogicException("This event contains shortage that should be fixed.");
        }

        if (!$this->can_finish_return_inventory) {
            throw new \LogicException("This event's return inventory cannot be finished.");
        }

        // - Date de l'inventaire.
        if ($date !== null) {
            if ($date->isFuture()) {
                throw new \InvalidArgumentException(
                    'The return inventory date cannot be in the future.',
                );
            }
            if (
                !$this->operation_period->getStartDate()->isBefore($date) ||
                !$this->mobilization_period->getStartDate()->isBefore($date)
            ) {
                throw new \InvalidArgumentException(
                    'The return inventory date cannot be before the ' .
                    'operation / mobilization start date.',
                );
            }
        } else {
            $date = CarbonImmutable::now();
        }

        return dbTransaction(function () use ($author, $date) {
            $this->is_confirmed = true;
            $this->is_return_inventory_done = true;
            $this->return_inventory_datetime = $date->format('Y-m-d H:i:s');

            // - On déplace la date de fin de mobilisation si l'inventaire de retour
            //   est réalisé avant la date de fin de mobilisation prévue.
            $roundedDate = $date->roundMinutes(15, 'ceil');
            $shouldMoveMobilizationEndDate = $roundedDate->isBefore($this->mobilization_end_date);
            if ($shouldMoveMobilizationEndDate) {
                $this->mobilization_end_date = $roundedDate->format('Y-m-d H:i:s');
            }

            $this->returnInventoryAuthor()->associate($author);
            $this->save();

            // NOTE: À ne pas remonter avant le `$this->save()` car contient un `$this->refresh()`
            //       qui ferait un reset sur les données actuellement en cours d'edition.
            if ($shouldMoveMobilizationEndDate) {
                if (isFeatureEnabled(Feature::TECHNICIANS)) {
                    $assignationPeriod = $this->mobilization_period->merge($this->operation_period);
                    $this->syncTechnicians($this->technicians->reduce(
                        static function ($assignments, $oldAssignment) use ($assignationPeriod) {
                            $newPeriod = $oldAssignment->computeNewPeriod($assignationPeriod);
                            if ($newPeriod !== null) {
                                $assignments[] = [
                                    'id' => $oldAssignment->technician_id,
                                    'role_id' => $oldAssignment->role_id,
                                    'period' => $newPeriod,
                                ];
                            }
                            return $assignments;
                        },
                        [],
                    ));
                } else {
                    $this->technicians()->delete();
                }
            }

            // - Met à jour les quantités cassés dans le stock.
            foreach ($this->materials as $eventMaterial) {
                if ($eventMaterial->quantity_returned_broken === 0) {
                    continue;
                }

                $material = $eventMaterial->material;
                $material->out_of_order_quantity += $eventMaterial->quantity_returned_broken;
                $material->save();
            }

            return $this->refresh();
        });
    }

    public function cancelReturnInventory()
    {
        if ($this->is_archived) {
            throw new \LogicException("This event is archived.");
        }

        // - Si l'inventaire de retour n'est pas terminé, il n'y a rien à annuler.
        if (!$this->is_return_inventory_done) {
            throw new \LogicException("This event's return inventory is not done.");
        }

        // - S'il n'y a pas de matériel cassé, on permet l'annulation de
        //   l'inventaire quelque soit le moment ou il a été terminé.
        //   Sinon, l'inventaire est annulable pendant 1 semaine après
        //   l'avoir marqué comme terminé.
        if ($this->has_materials_returned_broken) {
            $isCancellable = (
                $this->return_inventory_datetime !== null &&
                CarbonImmutable::parse($this->return_inventory_datetime)
                    ->isAfter(Carbon::now()->subWeek())
            );
            if (!$isCancellable) {
                throw new \LogicException(
                    "This event's return inventory can no longer been cancelled.",
                );
            }
        }

        return dbTransaction(function () {
            // - On annule l'inventaire lui-même.
            $this->is_return_inventory_done = false;
            $this->return_inventory_author_id = null;
            $this->return_inventory_datetime = null;
            $this->save();

            // - Met à jour les quantités cassés dans le stock.
            foreach ($this->materials as $eventMaterial) {
                if ($eventMaterial->quantity_returned_broken === 0) {
                    continue;
                }

                $material = $eventMaterial->material;
                $material->out_of_order_quantity = max(0, (
                    $material->out_of_order_quantity - $eventMaterial->quantity_returned_broken
                ));
                $material->save();
            }

            return $this->refresh();
        });
    }

    /**
     * Permet de dupliquer un événement.
     *
     * @param array     $newEventData    Données personnalisées pour le nouvel événement.
     * @param bool      $keepBillingData Les données de facturation doivent-elles aussi être copiées depuis l'événement dupliqué ?
     *                                   Si `false` (défaut), les données live seront utilisées.
     * @param User|null $author          L'auteur de la duplication.
     *
     * @return static L'instance du nouvel événement.
     */
    public function duplicate(array $newEventData, bool $keepBillingData = false, ?User $author = null): static
    {
        if ($this->has_deleted_materials) {
            throw new \LogicException("Cannot duplicate an event with deleted material.");
        }

        // - On ne peut pas dupliquer un événement dans une devise différente de la devise globale
        //   actuelle en conservant les données de facturation de l'ancien événement car il va être
        //   impossible de récupérer les prix de remplacement dans la devise de l'événement d'origine.
        //   (et les prix de remplacement ne sont pas conservés d'une duplication à une autre, ces
        //   données doivent toujours être à jour)
        if ($this->is_billable && $keepBillingData && $this->currency !== Config::get('currency')) {
            throw new \LogicException(
                "Cannot duplicate an event with a currency other than the current global currency, " .
                "while retaining the billing data of the original event.",
            );
        }

        return dbTransaction(function () use ($newEventData, $keepBillingData, $author) {
            $globalDiscountRate = !$this->is_billable || !$keepBillingData
                ? ($this->is_billable ? Decimal::zero() : null)
                : $this->global_discount_rate;

            $newEvent = self::create([
                'title' => $this->title,
                'description' => $this->description,
                'manager_id' => $this->manager_id,
                'color' => $this->color,
                'operation_period' => $newEventData['operation_period'] ?? null,
                'mobilization_period' => $newEventData['mobilization_period'] ?? null,
                'is_confirmed' => false,
                'location' => $this->location,
                'is_billable' => $this->is_billable,
                'currency' => Config::get('currency'),
                'global_discount_rate' => $globalDiscountRate,
                'note' => $this->note,
                'author_id' => $author?->id,
            ]);

            //
            // - Bénéficiaires
            //

            $beneficiaries = $this->beneficiaries->pluck('id')->all();
            $newEvent->syncBeneficiaries($beneficiaries);

            //
            // - Matériels
            //

            $materials = $this->materials
                ->map(function (EventMaterial $eventMaterial) use ($keepBillingData) {
                    $materialData = [
                        'id' => $eventMaterial->material_id,
                        'quantity' => $eventMaterial->quantity,
                    ];

                    if ($this->is_billable && $keepBillingData) {
                        $materialData = array_merge($materialData, [
                            'unit_price' => $eventMaterial->unit_price,
                            'discount_rate' => $eventMaterial->discount_rate,
                        ]);
                    }

                    return $materialData;
                })
                ->all();

            $newEvent->syncMaterials($materials);

            //
            // - Postes des techniciens
            //

            if (isFeatureEnabled(Feature::TECHNICIANS) && $this->positions->isNotEmpty()) {
                $positions = $this->positions
                    ->map(static fn (EventPosition $position) => [
                        'role_id' => $position->role_id,
                        'is_mandatory' => $position->is_mandatory,
                    ])
                    ->all();

                $newEvent->positions()->createMany($positions);
            }

            //
            // - Lignes de facturation.
            //

            if ($this->is_billable && $keepBillingData) {
                $extraLines = $this->extras
                    ->map(static fn (EventExtra $extraLine) => [
                        'description' => $extraLine->description,
                        'quantity' => $extraLine->quantity,
                        'unit_price' => $extraLine->unit_price,
                        'tax_id' => $extraLine->tax_id,
                        'taxes' => $extraLine->taxes,
                    ])
                    ->all();

                $newEvent->syncExtras($extraLines);
            }

            return $newEvent->refresh();
        });
    }

    public function withAvailabilities(): static
    {
        $rawMaterials = $this->materials->map(static fn (EventMaterial $material) => $material->material);
        $rawMaterials = Material::allWithAvailabilities($rawMaterials, $this)->keyBy('id');

        $materialsWithAvailabilities = $this->materials->map(
            static function (EventMaterial $material) use ($rawMaterials) {
                /** @var Material $rawMaterial */
                $rawMaterial = $rawMaterials->get($material->material_id);

                $availableQuantity = $rawMaterial->available_quantity;

                $missingQuantity = $material->quantity - $availableQuantity;
                $missingQuantity = min($missingQuantity, $material->quantity);

                return tap(clone $material, static function (EventMaterial $material) use ($missingQuantity) {
                    $material->quantity_missing = $missingQuantity;
                });
            },
        );

        return tap(clone $this, static function (Event $event) use ($materialsWithAvailabilities) {
            $event->setRelation('materials', $materialsWithAvailabilities);
        });
    }

    // ------------------------------------------------------
    // -
    // -    Query Scopes
    // -
    // ------------------------------------------------------

    public function scopeSearch(Builder $query, string|array $term): Builder
    {
        if (is_array($term)) {
            $query->where(static function (Builder $subQuery) use ($term) {
                foreach ($term as $singleTerm) {
                    $subQuery->orWhere(static fn (Builder $subSubQuery) => (
                        $subSubQuery->search($singleTerm)
                    ));
                }
            });
            return $query;
        }
        Assert::minLength($term, 2, "The term must contain more than two characters.");

        $safeTerm = sprintf('%%%s%%', addcslashes($term, '%_'));
        return $query->where(static fn (Builder $subQuery) => (
            $subQuery
                ->orWhere('title', 'LIKE', $safeTerm)
                ->orWhere('location', 'LIKE', $safeTerm)
                ->orWhereHas('beneficiaries', static fn (Builder $beneficiariesQuery) => (
                    // - Ici on passe `$term` et non `$safeTerm`, car `Beneficiary::search()`
                    //   se chargera de l'échappement.
                    $beneficiariesQuery->search($term)
                ))
                ->orWhereHas('manager', static fn (Builder $managerQuery) => (
                    // - Ici on passe `$term` et non `$safeTerm`, car `User::search()`
                    //   se chargera de l'échappement.
                    $managerQuery->search($term)
                ))
                ->orWhereHas('author', static fn (Builder $authorQuery) => (
                    // - Ici on passe `$term` et non `$safeTerm`, car `User::search()`
                    //   se chargera de l'échappement.
                    $authorQuery->search($term)
                ))
        ));
    }

    public function scopeInProgress(Builder $rootQuery): Builder
    {
        $useManualReturn = Config::get('returnPolicy') === ReturnPolicy::MANUAL;
        $now = CarbonImmutable::now();

        return $rootQuery
            ->where(static fn (Builder $query) => (
                $query
                    ->where('mobilization_start_date', '<=', $now)
                    ->where(static fn (Builder $subQuery) => (
                        $subQuery
                            ->orWhere('mobilization_end_date', '>', $now)
                            ->when($useManualReturn, static fn (Builder $subSubQuery) => (
                                // - Bookings non retourné actuellement.
                                $subSubQuery->orWhere(static fn (Builder $subSubSubQuery) => (
                                    $subSubSubQuery
                                        ->where('is_archived', false)
                                        ->where('is_return_inventory_done', false)
                                        ->whereHas('materials')
                                ))
                            ))
                    ))
            ))
            ->orderBy('mobilization_start_date', 'asc');
    }

    public function scopeInPeriod(Builder $rootQuery, PeriodInterface $period, bool $withOverdue = false): Builder
    {
        $useManualReturn = Config::get('returnPolicy') === ReturnPolicy::MANUAL;
        $now = CarbonImmutable::now();
        $start = $period->getStartDate();
        $end = $period->getEndDate();

        return $rootQuery
            ->where(static fn (Builder $query) => (
                $query
                    ->when($end !== null, static fn (Builder $subQuery) => (
                        $subQuery->where('mobilization_start_date', '<', $end)
                    ))
                    ->where(static fn (Builder $subQuery) => (
                        $subQuery
                            ->orWhere('mobilization_end_date', '>', $start)
                            ->when(
                                $withOverdue && $useManualReturn,
                                static fn (Builder $subSubQuery) => (
                                    $subSubQuery
                                        // - Événements en retard actuellement.
                                        ->orWhere(static fn (Builder $subSubQuery) => (
                                            $subSubQuery
                                                // - On part du principe que les événements en cours ou
                                                //   à venir ne vont pas être retournés en retard, donc
                                                //   on ne garde que les éléments normalement terminés.
                                                ->where('mobilization_end_date', '<=', $now)
                                                ->where('is_archived', false)
                                                ->where('is_return_inventory_done', false)
                                                ->whereHas('materials')
                                        ))
                                        // - Événements qui n'étaient pas retournés avant la date spécifiée.
                                        ->orWhere(static fn (Builder $subSubQuery) => (
                                            $subSubQuery
                                                ->where('is_return_inventory_done', true)
                                                ->whereNotNull('return_inventory_datetime')
                                                // phpcs:ignore Generic.Files.LineLength
                                                ->whereDatetimeRoundedMinutes('return_inventory_datetime', '>', $start, 15, 'ceil')
                                        ))
                                ),
                            )
                    ))
            ))
            ->orderBy('mobilization_start_date', 'asc');
    }

    public function scopeHavingMaterialInPark(Builder $query, int $parkId): Builder
    {
        return $query->whereHas('materials', static fn (Builder $eventMaterialQuery) => (
            $eventMaterialQuery->whereHas('material', static fn (Builder $materialQuery) => (
                $materialQuery
                    ->where(static fn (Builder $subQuery) => (
                        $subQuery
                            ->where('park_id', $parkId)
                    ))
            ))
        ));
    }

    public function scopeNotReturned(Builder $query, PeriodInterface $period): Builder
    {
        $start = $period->getStartDate();
        $end = $period->getEndDate();

        return $query
            ->where('is_archived', false)
            ->where('is_return_inventory_done', false)
            ->where(static fn (Builder $subQuery) => (
                $subQuery
                    ->where('mobilization_end_date', '>', $start)
                    ->when($end !== null, static fn (Builder $subSubQuery) => (
                        $subSubQuery->where('mobilization_end_date', '<=', $end)
                    ))
            ))
            ->whereHas('materials', static function (Builder $subQuery) {
                $subQuery->whereRaw('`quantity` > COALESCE(`quantity_returned`, 0)');
            });
    }

    public function scopeEndingToday(Builder $query): Builder
    {
        return $query
            ->where('mobilization_end_date', '>', Carbon::today()->startOfDay())
            ->where('mobilization_end_date', '<=', Carbon::tomorrow()->startOfDay());
    }

    public function scopeDepartureInventoryTodo(Builder $query): Builder
    {
        return $query
            ->where('is_departure_inventory_done', false)
            ->where('mobilization_start_date', '<=', (Carbon::now()->addDays(self::DEPARTURE_INVENTORY_DELAY)))
            ->where('mobilization_start_date', '>=', (Carbon::now()->startOfDay()));
    }

    /**
     * Permet de ne récupérer que les événements pour lesquels un inventaire de retour
     * est à faire.
     *
     * @param bool $lax Est-ce qu'il faut limiter la récupération aux 30 derniers jours ?
     */
    public function scopeReturnInventoryTodo(Builder $query, bool $lax = false): Builder
    {
        return $query
            ->where('mobilization_end_date', '<=', Carbon::now())
            ->where('is_return_inventory_done', false)
            ->when($lax, static fn (Builder $subQuery) => (
                $subQuery->where('mobilization_end_date', '>=', Carbon::now()->subDays(30))
            ));
    }

    public function scopeClosureSameOrAfter(Builder $rootQuery, string|\DateTimeInterface $date): Builder
    {
        $useManualReturn = Config::get('returnPolicy') === ReturnPolicy::MANUAL;

        return $rootQuery->where(static fn (Builder $query) => (
            $query
                ->orWhere('mobilization_end_date', '>=', $date)
                ->when($useManualReturn, static fn (Builder $subQuery) => (
                    $subQuery
                        // - Bookings non retourné actuellement.
                        ->orWhere(static fn (Builder $subSubQuery) => (
                            $subSubQuery
                                ->where('is_archived', false)
                                ->where('is_return_inventory_done', false)
                                ->whereHas('materials')
                        ))
                        // - Bookings qui n'étaient pas retournés avant la date spécifiée.
                        ->orWhere(static fn (Builder $subSubQuery) => (
                            $subSubQuery
                                ->where('is_return_inventory_done', true)
                                ->whereNotNull('return_inventory_datetime')
                                ->whereDatetimeRoundedMinutes(
                                    'return_inventory_datetime',
                                    '>=',
                                    $date,
                                    15,
                                    'ceil',
                                )
                        ))
                ))
        ));
    }

    /**
     * Permet de ne récupérer que les événements dans lesquels un utilisateur
     * donné est impliqué (bénéficiaire, technicien,
     * chef de projet).
     */
    public function scopeWithInvolvedUser(Builder $query, User $user, bool $checkBeneficiaries = true): Builder
    {
        return $query->where(static function (Builder $query) use ($user, $checkBeneficiaries) {
            $query->whereBelongsTo($user, 'manager');

            if ($user->person) {
                if ($checkBeneficiaries) {
                    $query->orWhereHas('beneficiaries', static fn (Builder $beneficiariesQuery) => (
                        $beneficiariesQuery->whereBelongsTo($user->person)
                    ));
                }

                if (isFeatureEnabled(Feature::TECHNICIANS)) {
                    $query
                        ->orWhereHas('technicians', static fn (Builder $eventTechniciansQuery) => (
                            $eventTechniciansQuery->whereHas('technician', static fn (Builder $technician) => (
                                $technician->whereBelongsTo($user->person)
                            ))
                        ));
                }
            }

            return $query;
        });
    }

    // ------------------------------------------------------
    // -
    // -    PDF Related
    // -
    // ------------------------------------------------------

    public function toPdf(I18n $i18n, string $sortedBy = 'lists'): Pdf
    {
        $supportedSorts = ['lists', 'parks'];
        if (!in_array($sortedBy, $supportedSorts, true)) {
            throw new \InvalidArgumentException(vsprintf(
                "Unsupported release sheet sort \"%s\". Valid values are: \"%s\".",
                [$sortedBy, join('", "', $supportedSorts)],
            ));
        }

        // - Société.
        $company = Config::get('companyData');
        $company = array_replace($company, [
            'country' => ($company['country'] ?? null) !== null
                ? Country::tryFromCode($company['country'])
                : null,
        ]);

        $pdfName = Str::slugify(implode('-', [
            $i18n->translate('release-sheet'),
            $company['name'],
            $this->title ?: $this->id,
        ]));

        $displayMode = Setting::getWithKey('eventSummary.materialDisplayMode');
        $materials = new MaterialsCollection($this->materials);
        $materialsSorted = new Collection();

        if ($sortedBy === 'lists') {
            $listMaterials = $materials->sortBy('reference', SORT_NATURAL);
            $listMaterials = match ($displayMode) {
                'categories' => $listMaterials->byCategories(),
                'sub-categories' => $listMaterials->bySubCategories(),
                'parks' => $listMaterials->byParks(),
                default => $listMaterials,
            };
            $materialsSorted->put(null, $listMaterials);
        }
        if ($sortedBy === 'parks') {
            $parks = $materials->byParks();
            foreach ($parks as $parkName => $parkMaterials) {
                $materialsSorted->put($parkName, $parkMaterials->sortBy('reference', SORT_NATURAL));
            }
        }

        $data = [
            'now' => CarbonImmutable::now(),
            'event' => $this,
            'beneficiaries' => $this->beneficiaries,
            'company' => $company,
            'sortedBy' => $sortedBy,
            'materialsSorted' => $materialsSorted,
            'materialDisplayMode' => $displayMode,
            'totalisableProperties' => $this->totalisable_properties,
            'customText' => Setting::getWithKey('eventSummary.customText'),
            'showLegalNumbers' => Setting::getWithKey('eventSummary.showLegalNumbers'),
            'showMobilizationPeriod' => !$this->mobilization_period->isSame($this->operation_period),
            'showReplacementPrices' => Setting::getWithKey('eventSummary.showReplacementPrices'),
            'showDescriptions' => Setting::getWithKey('eventSummary.showDescriptions'),
            'showTags' => Setting::getWithKey('eventSummary.showTags'),
            'showUnitsSerialNumbers' => Setting::getWithKey('eventSummary.showUnitsSerialNumbers'),
            'showPictures' => Setting::getWithKey('eventSummary.showPictures'),
        ];

        if (isFeatureEnabled(Feature::TECHNICIANS)) {
            $technicians = [];
            foreach ($this->technicians as $eventTechnician) {
                $technician = $eventTechnician->technician;

                if (!array_key_exists($technician->id, $technicians)) {
                    $technicians[$technician->id] = [
                        'id' => $technician->id,
                        'name' => $technician->full_name,
                        'phone' => $technician->phone,
                        'assignments' => [],
                    ];
                }

                $technicians[$technician->id]['assignments'][] = [
                    'period' => $eventTechnician->period,
                    'position' => $eventTechnician->role?->name,
                ];
            }
            $data['technicians'] = array_values($technicians);
        }

        return Pdf::createFromTemplate('event-summary', $i18n, $pdfName, $data);
    }

    // ------------------------------------------------------
    // -
    // -    Serialization
    // -
    // ------------------------------------------------------

    public function serialize(string $format = self::SERIALIZE_DEFAULT): array
    {
        /** @var Event $event */
        $event = tap(clone $this, static function (Event $event) use ($format) {
            $event->append(['operation_period', 'mobilization_period']);

            switch ($format) {
                case self::SERIALIZE_DETAILS:
                    $event->append([
                        'manager',
                        'beneficiaries',
                        'technicians',
                        'positions',
                        'total_replacement',
                        'materials',
                        'departure_inventory_author',
                        'return_inventory_author',
                        'is_return_inventory_started',
                        'has_materials',
                        'has_not_returned_materials',
                        'has_missing_materials',
                        'has_deleted_materials',
                        'has_unassigned_mandatory_positions',
                        'author',
                    ]);
                    if ($event->is_billable) {
                        $event->append(['extras', 'estimates', 'invoices']);
                    }
                    break;

                case self::SERIALIZE_DEFAULT:
                    $event->append([
                        'beneficiaries',
                        'has_materials',
                    ]);
                    break;

                case self::SERIALIZE_BOOKING_EXCERPT:
                    $event->append([
                        'manager',
                        'beneficiaries',
                        'technicians',
                        'has_materials',
                        'has_not_returned_materials',
                        'has_unassigned_mandatory_positions',
                        'categories',
                        'parks',
                        'author',
                    ]);
                    break;

                case self::SERIALIZE_BOOKING_SUMMARY:
                    $event->append([
                        'manager',
                        'beneficiaries',
                        'technicians',
                        'has_materials',
                        'has_not_returned_materials',
                        'has_missing_materials',
                        'has_unassigned_mandatory_positions',
                        'categories',
                        'parks',
                        'author',
                    ]);
                    break;

                case self::SERIALIZE_BOOKING_DEFAULT:
                    $event->append([
                        'manager',
                        'beneficiaries',
                        'technicians',
                        'materials',
                        'positions',
                        'departure_inventory_author',
                        'return_inventory_author',
                        'is_return_inventory_started',
                        'has_materials',
                        'has_not_returned_materials',
                        'has_missing_materials',
                        'has_deleted_materials',
                        'has_unassigned_mandatory_positions',
                        'total_replacement',
                        'author',
                    ]);
                    if ($event->is_billable) {
                        $event->append(['extras', 'estimates', 'invoices']);
                    }
                    break;
            }
        });

        $data = new DotArray($event->attributesForSerialization());

        switch ($format) {
            case self::SERIALIZE_SUMMARY:
                $data->delete([
                    'reference',
                    'description',
                    'color',
                    'is_confirmed',
                    'is_billable',
                    'is_archived',
                    'is_departure_inventory_done',
                    'departure_inventory_datetime',
                    'is_return_inventory_done',
                    'return_inventory_datetime',
                    'materials_count',
                    'currency',
                    'global_discount_rate',
                    'total_without_global_discount',
                    'total_global_discount',
                    'total_without_taxes',
                    'total_taxes',
                    'total_with_taxes',
                    'note',
                    'created_at',
                    'updated_at',
                ]);
                break;

            case self::SERIALIZE_DEFAULT:
                $data->delete([
                    'currency',
                    'departure_inventory_datetime',
                    'global_discount_rate',
                    'total_without_global_discount',
                    'total_global_discount',
                    'total_without_taxes',
                    'total_taxes',
                    'total_with_taxes',
                ]);
                break;

            case self::SERIALIZE_BOOKING_EXCERPT:
                $data
                    ->set('entity', static::TYPE)
                    ->delete([
                        'reference',
                        'description',
                        'departure_inventory_datetime',
                        'materials_count',
                        'currency',
                        'is_billable',
                        'global_discount_rate',
                        'total_without_global_discount',
                        'total_global_discount',
                        'total_without_taxes',
                        'total_taxes',
                        'total_with_taxes',
                        'note',
                        'updated_at',
                    ]);
                break;

            case self::SERIALIZE_BOOKING_SUMMARY:
                $data
                    ->set('entity', static::TYPE)
                    ->delete([
                        'departure_inventory_datetime',
                        'currency',
                        'global_discount_rate',
                        'total_without_global_discount',
                        'total_global_discount',
                        'total_without_taxes',
                        'total_taxes',
                        'total_with_taxes',
                        'note',
                        'updated_at',
                    ]);
                break;

            case self::SERIALIZE_BOOKING_DEFAULT:
                $data->set('entity', static::TYPE);
                break;
        }

        // - Si l'utilisateur n'est pas un membre de l'équipe, et qu'il
        //   n'est pas bénéficiaire de l'événement, on enlève les devis
        //   et les factures du payload.
        $user = Auth::user();
        $canSeeBilling = (
            Auth::is([Group::ADMINISTRATION, Group::SUPERVISION, Group::OPERATION]) ||
            (
                $user !== null &&
                Auth::is([
                    Group::READONLY_PLANNING_GENERAL,
                ]) &&
                $user->beneficiary?->isAssignedToEvent($event)
            )
        );
        if (!$canSeeBilling) {
            $data->delete(['estimates', 'invoices']);
        }

        // - Si l'utilisateur n'est pas un membre de l'équipe, qu'il
        //   n'est pas le chef de projet, ou un technicien assigné à l'événement,
        //   on enlève les notes du payload.
        $canSeeNotes = (
            Auth::is([Group::ADMINISTRATION, Group::SUPERVISION, Group::OPERATION]) ||
            (
                $user !== null &&
                Auth::is([
                    Group::READONLY_PLANNING_GENERAL,
                ]) &&
                $event->manager?->is($user) ||
                (
                    isFeatureEnabled(Feature::TECHNICIANS) &&
                    (
                        $user->technician?->isAssignedToEvent($event)
                    )
                )
            )
        );
        if (!$canSeeNotes) {
            $data->delete('note');
        }

        if (!$event->is_billable) {
            $data->delete([
                'global_discount_rate',
                'total_without_global_discount',
                'total_global_discount',
                'total_without_taxes',
                'total_taxes',
                'total_with_taxes',
            ]);
        }

        return $data
            ->delete([
                'author_id',
                'preparer_id',
                'manager_id',
                'request_id',
                'operation_start_date',
                'operation_end_date',
                'operation_is_full_days',
                'mobilization_start_date',
                'mobilization_end_date',
                'departure_inventory_author_id',
                'return_inventory_author_id',
                'deleted_at',
            ])
            ->all();
    }

    public static function serializeValidation(array $data): array
    {
        $data = new DotArray($data);

        // - Période de mobilization.
        $mobilizationPeriodErrors = array_unique(array_filter([
            $data->get('mobilization_start_date'),
            $data->get('mobilization_end_date'),
        ]));
        if (!empty($mobilizationPeriodErrors)) {
            $data->set('mobilization_period', (
                count($mobilizationPeriodErrors) === 1
                    ? current($mobilizationPeriodErrors)
                    : implode("\n", array_map(
                        static fn ($message) => sprintf('- %s', $message),
                        $mobilizationPeriodErrors,
                    ))
            ));
        }
        $data->delete('mobilization_start_date');
        $data->delete('mobilization_end_date');

        // - Période d'opération.
        $operationPeriodErrors = array_unique(array_filter([
            $data->get('operation_start_date'),
            $data->get('operation_end_date'),
        ]));
        if (!empty($operationPeriodErrors)) {
            $data->set('operation_period', (
                count($operationPeriodErrors) === 1
                    ? current($operationPeriodErrors)
                    : implode("\n", array_map(
                        static fn ($message) => sprintf('- %s', $message),
                        $operationPeriodErrors,
                    ))
            ));
        }
        $data->delete('operation_start_date');
        $data->delete('operation_end_date');

        return $data->all();
    }
}
