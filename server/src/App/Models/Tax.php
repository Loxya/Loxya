<?php
declare(strict_types=1);

namespace Loxya\Models;

use Adbar\Dot as DotArray;
use Brick\Math\BigDecimal as Decimal;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Collection as CoreCollection;
use Loxya\Contracts\Serializable;
use Loxya\Errors\Exception\ValidationException;
use Loxya\Models\Casts\AsDecimal;
use Loxya\Models\Traits\Serializer;
use Loxya\Support\Assert;
use Loxya\Support\Validation\Rules\SchemaStrict;
use Loxya\Support\Validation\Validator as V;
use Respect\Validation\Rules as Rule;

/**
 * Taxe (ou groupe de taxes).
 *
 * @property-read ?int $id
 * @property string $name
 * @property bool $is_group
 * @property bool|null $is_rate
 * @property-read bool $is_used
 * @property-read bool $is_default
 * @property Decimal|null $value
 *
 * @property-read Collection<array-key, TaxComponent> $components
 * @property-read Collection<array-key, Material> $materials
 */
final class Tax extends BaseModel implements Serializable
{
    use Serializer;

    protected $table = 'taxes';
    public $timestamps = false;

    public function __construct(array $attributes = [])
    {
        parent::__construct($attributes);

        $this->validation = fn () => [
            'name' => V::custom([$this, 'checkName']),
            'is_group' => V::boolType(),
            'is_rate' => V::custom([$this, 'checkIsRate']),
            'value' => V::custom([$this, 'checkValue']),
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

        $isGroup = $this->getAttributeUnsafeValue('is_group');
        if (!V::boolType()->validate($isGroup)) {
            return true;
        }

        $alreadyExistsQuery = static::query()
            ->where('name', $value)
            ->when($this->exists, fn (Builder $subQuery) => (
                $subQuery->where('id', '!=', $this->id)
            ));

        // - Si ce n'est pas un groupe, on vérifie que c'est bien
        //   la seule entrée avec ce même nom ET cette valeur.
        //   (e.g. On ne veut pas deux `TVA (5%)` par exemple)
        if (!$isGroup) {
            $isRate = $this->getAttributeUnsafeValue('is_rate');
            $rateValue = $this->getAttributeUnsafeValue('value');

            $areValidOtherFields = (
                V::boolType()->validate($isRate) &&
                V::floatVal()->validate($rateValue)
            );
            if (!$areValidOtherFields) {
                return true;
            }

            $alreadyExistsQuery = $alreadyExistsQuery
                ->where('is_rate', (bool) $isRate)
                ->where('value', $rateValue);
        }

        $alreadyExists = $alreadyExistsQuery->exists();
        return !$alreadyExists ?: 'tax-name-already-in-use';
    }

    public function checkIsRate($value)
    {
        V::nullable(V::boolType())->check($value);

        $isGroup = $this->getAttributeUnsafeValue('is_group');
        if (!V::boolType()->validate($isGroup)) {
            return true;
        }

        return $isGroup ? V::nullType() : V::boolType();
    }

    public function checkValue($value)
    {
        V::nullable(V::floatVal())->check($value);

        $isGroup = $this->getAttributeUnsafeValue('is_group');
        if (!V::boolType()->validate($isGroup)) {
            return true;
        }

        if ($isGroup) {
            return V::nullType();
        }

        V::floatVal()->check($value);
        $value = Decimal::of($value);

        $isValid = (
            $value->isGreaterThanOrEqualTo(0) &&
            $value->isLessThan(1_000_000_000_000) &&
            $value->getScale() <= 3
        );
        if (!$isValid) {
            return false;
        }

        $isRate = $this->getAttributeUnsafeValue('is_rate');
        if (!V::boolType()->validate($isRate)) {
            return true;
        }

        return $isRate
            // - Si c'est un pourcentage, il doit être inférieur ou égal à 100%.
            ? $value->isLessThanOrEqualTo(100)
            // - Sinon si ce n'est pas un pourcentage, la précision doit être à 2 décimales max.
            : $value->getScale() <= 2;
    }

    // ------------------------------------------------------
    // -
    // -    Relations
    // -
    // ------------------------------------------------------

    public function components(): HasMany
    {
        return $this->hasMany(TaxComponent::class, 'tax_id')
            ->orderBy('id');
    }

    public function materials(): HasMany
    {
        return $this->hasMany(Material::class, 'tax_id')
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
        'is_group' => 'boolean',
        'is_rate' => 'boolean',
        'value' => AsDecimal::class,
    ];

    public function getValueAttribute(string|null $value): Decimal|null
    {
        if ($value === null) {
            return null;
        }

        /** @var Decimal $value */
        $value = $this->castAttribute('value', $value);
        return $value->toScale($this->is_rate ? 3 : 2);
    }

    public function getIsUsedAttribute(): bool
    {
        return $this->exists && $this->materials->count() > 0;
    }

    public function getIsDefaultAttribute(): bool
    {
        if (!$this->exists) {
            return false;
        }

        $defaultTaxId = Setting::getWithKey('billing.defaultTax');
        return $defaultTaxId !== null && $defaultTaxId === $this->id;
    }

    /** @return Collection<array-key, TaxComponent> */
    public function getComponentsAttribute(): Collection
    {
        return $this->getRelationValue('components');
    }

    // ------------------------------------------------------
    // -
    // -    Setters
    // -
    // ------------------------------------------------------

    protected $fillable = [
        'name',
        'is_group',
        'is_rate',
        'value',
    ];

    // ------------------------------------------------------
    // -
    // -    Méthodes liées à une "entity"
    // -
    // ------------------------------------------------------

    public function edit(array $data): static
    {
        return dbTransaction(function () use ($data) {
            $this->fill($data)->save();

            // - Composants.
            $components = $this->is_group ? ($data['components'] ?? null) : [];
            if ($components !== null) {
                if (!is_array($components)) {
                    throw new \InvalidArgumentException("Invalid data format.");
                }

                try {
                    $this->syncComponents($components);
                } catch (ValidationException $e) {
                    throw new ValidationException([
                        'components' => $e->getValidationErrors(),
                    ]);
                }
            }

            return $this->refresh();
        });
    }

    public function syncComponents(array $componentsData): static
    {
        Assert::boolean($this->exists, "Unable to sync components for a non-persisted tax.");
        Assert::boolean($this->is_group || empty($componentsData), (
            "Unable to add components to a non-group tax."
        ));

        $schema = V::arrayType()->each(new SchemaStrict(
            new Rule\Key('name'),
            new Rule\Key('is_rate'),
            new Rule\Key('value'),
        ));
        if (!$schema->validate($componentsData)) {
            throw new \InvalidArgumentException("Invalid data format.");
        }

        $components = new CoreCollection(array_map(
            function ($componentData) {
                $component = new TaxComponent($componentData);
                $component->tax()->associate($this);
                return $component;
            },
            $componentsData,
        ));

        return dbTransaction(function () use ($components) {
            TaxComponent::flushForTax($this);

            if ($components->isNotEmpty()) {
                $errors = $components
                    ->filter(static fn ($component) => !$component->isValid())
                    ->map(static fn ($component) => $component->validationErrors())
                    ->all();

                if (!empty($errors)) {
                    throw new ValidationException($errors);
                }

                $this->components()->saveMany($components);
            }

            return $this->refresh();
        });
    }

    public function asFlatArray(): array
    {
        /** @var CoreCollection<array-key, Tax|TaxComponent> $taxes */
        $taxes = $this->is_group
            ? $this->components->toBase()
            : new CoreCollection([$this]);

        return $taxes
            ->map(static fn (Tax|TaxComponent $tax) => [
                'name' => $tax->name,
                'is_rate' => $tax->is_rate,
                'value' => $tax->value,
            ])
            ->all();
    }

    // ------------------------------------------------------
    // -
    // -    Overwritten methods
    // -
    // ------------------------------------------------------

    public function delete()
    {
        // - Si la taxe est utilisée, elle ne peut pas être supprimée.
        if ($this->is_used) {
            throw new \LogicException(
                sprintf("The tax #%d is used and therefore cannot be deleted.", $this->id),
            );
        }

        // - La taxe ne peut pas être supprimée si c'est la taxe par défaut.
        if ($this->is_default) {
            throw new \LogicException(
                sprintf("The tax #%d is the default one and therefore cannot be deleted.", $this->id),
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
        /** @var Tax $tax */
        $tax = tap(clone $this, static function (Tax $tax) {
            if ($tax->is_group) {
                $tax->append(['components']);
            }
        });

        $data = new DotArray($tax->attributesForSerialization());

        if ($tax->is_group) {
            $data->delete(['is_rate', 'value']);
        }

        return $data->all();
    }
}
