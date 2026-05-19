<?php
declare(strict_types=1);

namespace Loxya\Models;

use Adbar\Dot as DotArray;
use Brick\Math\BigDecimal as Decimal;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Collection as CoreCollection;
use Loxya\Config\Config;
use Loxya\Contracts\Serializable;
use Loxya\Models\Casts\AsDecimal;
use Loxya\Models\Traits\Serializer;
use Loxya\Support\Arr;
use Loxya\Support\Assert;
use Loxya\Support\Validation\Rules\SchemaStrict;
use Loxya\Support\Validation\ValidationsException;
use Loxya\Support\Validation\Validator as V;
use Respect\Validation\Rules as Rule;

/**
 * Taxe (ou groupe de taxes).
 *
 * @property-read ?int $id
 * @property string|null $name
 * @property bool $is_group
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

    protected $attributes = [
        'name' => null,
        'is_group' => false,
    ];

    public function __construct(array $attributes = [])
    {
        parent::__construct($attributes);

        $this->validation = fn () => [
            'name' => V::custom([$this, 'checkName']),
            'is_group' => V::custom([$this, 'checkIsGroup']),
            'value' => V::custom([$this, 'checkValue']),
        ];
    }

    // ------------------------------------------------------
    // -
    // -    Validation
    // -
    // ------------------------------------------------------

    public function checkName(mixed $value)
    {
        // - Pour les pays avec TVA simple, le nom DOIT être `null`.
        //   (il sera généré à la volée à l'affichage)
        $organizationCountry = Config::getOrganizationCountry();
        if ($organizationCountry->hasSimpleVatSystem()) {
            return V::nullType();
        }

        // - Pour les autres pays ou les groupes, le nom est obligatoire.
        V::notEmpty()->length(1, 30)->check($value);

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
        //   (e.g. On ne veut pas deux `Taxe (5%)` par exemple)
        $rateValue = $this->getAttributeUnsafeValue('value');
        if (!$isGroup && V::floatVal()->validate($rateValue)) {
            $alreadyExistsQuery = $alreadyExistsQuery
                ->where('value', $rateValue);
        }

        $alreadyExists = $alreadyExistsQuery->exists();
        return !$alreadyExists ?: 'tax-name-already-in-use';
    }

    public function checkIsGroup(mixed $value)
    {
        V::boolType()->check($value);

        // - Pour les pays avec TVA simple, on interdit les groupes de taxes.
        $organizationCountry = Config::getOrganizationCountry();
        return !$organizationCountry->hasSimpleVatSystem() || !$value;
    }

    public function checkValue(mixed $value)
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
            $value->isLessThanOrEqualTo(100) &&
            $value->getScale() <= 3
        );
        if (!$isValid) {
            return false;
        }

        // - Si le pays du vendeur a une liste de taux autorisés,
        //   on s'assure que le taux en fait partie.
        $organizationCountry = Config::getOrganizationCountry();
        $allowedRates = $organizationCountry->getVatRates(extended: true);
        $isAcceptableRate = (
            $allowedRates === null ||
            Arr::some($allowedRates, static fn ($allowedRate) => (
                Decimal::of($allowedRate)->isEqualTo($value)
            ))
        );
        if (!$isAcceptableRate) {
            return 'tax-rate-not-allowed-for-country';
        }

        // - Si on est dans un système de T.V.A. non simple (avec nom), on est bons.
        $organizationCountry = Config::getOrganizationCountry();
        if (!$organizationCountry->hasSimpleVatSystem()) {
            return true;
        }

        // - Pour les pays avec TVA simple, le taux doit être unique.
        $alreadyExists = static::query()
            ->where('is_group', false)
            ->where('value', (string) $value)
            ->when($this->exists, fn (Builder $subQuery) => (
                $subQuery->where('id', '!=', $this->id)
            ))
            ->exists();

        return !$alreadyExists ?: 'tax-rate-already-in-use';
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
        'value' => AsDecimal::class,
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
                } catch (ValidationsException $e) {
                    throw new ValidationsException([
                        'components' => $e->getValidationErrors(),
                    ]);
                }
            }

            return $this->refresh();
        });
    }

    public function syncComponents(array $componentsData): static
    {
        Assert::boolean($this->exists, (
            "Unable to sync components for a non-persisted tax."
        ));
        Assert::boolean($this->is_group || empty($componentsData), (
            "Unable to add components to a non-group tax."
        ));

        $schema = V::arrayType()->each(new SchemaStrict(
            new Rule\Key('name'),
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
                    throw new ValidationsException($errors);
                }

                $this->components()->saveMany($components);
            }

            return $this->refresh();
        });
    }

    /** @return list<array{ name?: string, value: Decimal }> */
    public function asFlatArray(): array
    {
        $organizationCountry = Config::getOrganizationCountry();
        $hasSimpleVatSystem = $organizationCountry->hasSimpleVatSystem();

        /** @var CoreCollection<array-key, Tax|TaxComponent> $taxes */
        $taxes = $this->is_group
            ? $this->components->toBase()
            : new CoreCollection([$this]);

        return $taxes
            ->map(fn (Tax|TaxComponent $tax) => (
                $this->is_group || !$hasSimpleVatSystem
                    ? ['name' => $tax->name, 'value' => $tax->value]
                    : ['value' => $tax->value]
            ))
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
            $data->delete(['value']);
        } else {
            $organizationCountry = Config::getOrganizationCountry();
            $hasSimpleVatSystem = $organizationCountry->hasSimpleVatSystem();
            if ($hasSimpleVatSystem) {
                $data->delete(['name']);
            }
        }

        return $data->all();
    }
}
