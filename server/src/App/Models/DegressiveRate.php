<?php
declare(strict_types=1);

namespace Loxya\Models;

use Brick\Math\BigDecimal as Decimal;
use Brick\Math\RoundingMode;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Collection as CoreCollection;
use Loxya\Contracts\Serializable;
use Loxya\Errors\Exception\ValidationException;
use Loxya\Models\Traits\Serializer;
use Loxya\Support\Arr;
use Loxya\Support\Assert;
use Loxya\Support\Validation\Rules\SchemaStrict;
use Loxya\Support\Validation\Validator as V;
use Respect\Validation\Rules as Rule;

/**
 * Tarif dégressif.
 *
 * @property-read ?int $id
 * @property string $name
 * @property-read bool $is_used
 * @property-read bool $is_default
 *
 * @property-read Collection<array-key, DegressiveRateTier> $tiers
 * @property-read Collection<array-key, Material> $materials
 */
final class DegressiveRate extends BaseModel implements Serializable
{
    use Serializer;

    protected $table = 'degressive_rates';
    public $timestamps = false;

    public function __construct(array $attributes = [])
    {
        parent::__construct($attributes);

        $this->validation = fn () => [
            'name' => V::custom([$this, 'checkName']),
        ];
    }

    // ------------------------------------------------------
    // -
    // -    Validation
    // -
    // ------------------------------------------------------

    public function checkName($value)
    {
        V::notEmpty()
            ->length(1, 30)
            ->check($value);

        $alreadyExists = static::query()
            ->where('name', $value)
            ->when($this->exists, fn (Builder $subQuery) => (
                $subQuery->where('id', '!=', $this->id)
            ))
            ->exists();

        return !$alreadyExists ?: 'degressive-rate-name-already-in-use';
    }

    // ------------------------------------------------------
    // -
    // -    Relations
    // -
    // ------------------------------------------------------

    public function tiers(): HasMany
    {
        return $this->hasMany(DegressiveRateTier::class, 'degressive_rate_id')
            ->orderBy('from_day');
    }

    public function materials(): HasMany
    {
        return $this->hasMany(Material::class, 'degressive_rate_id')
            ->orderBy('id');
    }

    // ------------------------------------------------------
    // -
    // -    Mutators
    // -
    // ------------------------------------------------------

    protected $appends = [
        'is_used',
    ];

    protected $casts = [
        'name' => 'string',
    ];

    public function getIsUsedAttribute(): bool
    {
        return $this->exists && $this->materials->count() > 0;
    }

    public function getIsDefaultAttribute(): bool
    {
        if (!$this->exists) {
            return false;
        }

        $defaultDegressiveRateId = Setting::getWithKey('billing.defaultDegressiveRate');
        return $defaultDegressiveRateId !== null && $defaultDegressiveRateId === $this->id;
    }

    /** @return Collection<array-key, DegressiveRateTier> */
    public function getTiersAttribute(): Collection
    {
        return $this->getRelationValue('tiers');
    }

    // ------------------------------------------------------
    // -
    // -    Setters
    // -
    // ------------------------------------------------------

    protected $fillable = [
        'name',
    ];

    // ------------------------------------------------------
    // -
    // -    Méthodes liées à une "entity"
    // -
    // ------------------------------------------------------

    public function edit(array $data): static
    {
        return dbTransaction(function () use ($data) {
            $this->fill(Arr::except($data, ['tiers']))->save();

            // - Paliers
            if (isset($data['tiers'])) {
                Assert::isArray($data['tiers'], "Key `tiers` must be an array.");

                try {
                    $this->syncTiers($data['tiers']);
                } catch (ValidationException $e) {
                    throw new ValidationException([
                        'tiers' => $e->getValidationErrors(),
                    ]);
                }
            }

            return $this->refresh();
        });
    }

    public function syncTiers(array $tiersData): static
    {
        Assert::boolean($this->exists, "Unable to sync tiers for a non-persisted degressive-rate.");

        $schema = V::arrayType()->each(new SchemaStrict(
            new Rule\Key('from_day'),
            new Rule\Key('is_rate'),
            new Rule\Key('value'),
        ));
        if (!$schema->validate($tiersData)) {
            throw new \InvalidArgumentException("Invalid data format.");
        }

        $tiers = new CoreCollection(array_map(
            function ($tierData) {
                $tier = new DegressiveRateTier($tierData);
                $tier->degressiveRate()->associate($this);
                return $tier;
            },
            $tiersData,
        ));

        return dbTransaction(function () use ($tiers) {
            DegressiveRateTier::flushForDegressiveRate($this);

            if ($tiers->isNotEmpty()) {
                $errors = $tiers
                    ->filter(static fn ($tier) => !$tier->isValid())
                    ->map(static fn ($tier) => $tier->validationErrors())
                    ->all();

                if (!empty($errors)) {
                    throw new ValidationException($errors);
                }

                $this->tiers()->saveMany($tiers);
            }

            return $this->refresh();
        });
    }

    /**
     * Permet de calculer le tarif dégressif pour un nombre donné de jours.
     *
     * @param int $days Le nombre de jours pour lequel on veut récupérer le tarif dégressif.
     *
     * @return Decimal Le tarif dégressif pour le nombre de jours.
     */
    public function computeForDays(int $days): Decimal
    {
        $tier = $this->tiers->last(
            static fn (DegressiveRateTier $tier) => (
                $tier->from_day <= $days
            ),
        );
        if ($tier === null) {
            return Decimal::of($days)
                ->toScale(2, RoundingMode::UNNECESSARY);
        }

        if (!$tier->is_rate) {
            return $tier->value
                ->toScale(2, RoundingMode::UNNECESSARY);
        }

        return Decimal::of($days)
            ->multipliedBy($tier->value->dividedBy(100, 4))
            ->toScale(2, RoundingMode::UP);
    }

    // ------------------------------------------------------
    // -
    // -    Overwritten methods
    // -
    // ------------------------------------------------------

    public function delete()
    {
        // - Si le tarif dégressif est utilisé, il ne peut pas être supprimé.
        if ($this->is_used) {
            throw new \LogicException(
                sprintf("The degressive rate #%d is used and therefore cannot be deleted.", $this->id),
            );
        }

        // - Le tarif dégressif ne peut pas être supprimé si c'est le tarif dégressif par défaut.
        if ($this->is_default) {
            throw new \LogicException(
                sprintf("The degressive rate #%d is the default one and therefore cannot be deleted.", $this->id),
            );
        }

        return parent::delete();
    }

    // ------------------------------------------------------
    // -
    // -    Serialization
    // -
    // ------------------------------------------------------

    public function serialize(): array
    {
        /** @var DegressiveRate $degressiveRate */
        $degressiveRate = tap(clone $this, static function (DegressiveRate $degressiveRate) {
            $degressiveRate->append(['tiers']);
        });

        // - Si le premier palier ne commence pas au jour 1, on ajouter un palier "artificiel".
        if ($degressiveRate->tiers->first()?->from_day !== 1) {
            $firstTier = new DegressiveRateTier([
                'from_day' => 1,
                'is_rate' => true,
                'value' => '100',
            ]);
            $firstTier->degressiveRate()->associate($degressiveRate);
            $degressiveRate->tiers->prepend($firstTier);
        }

        return $degressiveRate->attributesForSerialization();
    }
}
