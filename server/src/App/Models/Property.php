<?php
declare(strict_types=1);

namespace Loxya\Models;

use Adbar\Dot as DotArray;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Loxya\Contracts\Serializable;
use Loxya\Models\Casts\AsSet;
use Loxya\Models\Enums\CustomFieldType;
use Loxya\Models\Enums\PropertyEntity;
use Loxya\Models\Traits\Serializer;
use Loxya\Models\Traits\TransientAttributes;
use Loxya\Support\Arr;
use Loxya\Support\Assert;
use Loxya\Support\Period;
use Loxya\Support\Validation\Rules\SchemaStrict;
use Loxya\Support\Validation\Validator as V;
use Respect\Validation\Rules as Rule;

/**
 * Caractéristique de matériel personnalisée.
 *
 * @property-read ?int $id
 * @property string $name
 * @property array $entities
 * @property string $type
 * @property array $config
 * @property-read list<string> $options - Uniquement pour le type {@link CustomFieldType::LIST}.
 * @property-read bool|null $full_days - Uniquement pour le type {@link CustomFieldType::PERIOD}.
 * @property-read string|null $unit - Uniquement pour les types {@link CustomFieldType::FLOAT} et {@link CustomFieldType::INTEGER}.
 * @property-read int|null $max_length - Uniquement pour le type {@link CustomFieldType::STRING}.
 * @property bool|null $is_totalisable
 * @property mixed $value
 * @property-read CarbonImmutable $created_at
 * @property-read CarbonImmutable|null $updated_at
 *
 * @property-read Collection<array-key, Category> $categories
 * @property-read Collection<array-key, MaterialProperty> $material_properties
 * @property-read Collection<array-key, MaterialProperty> $materialProperties
 *
 * @method static Builder|static forEntity(PropertyEntity $entity)
 */
final class Property extends BaseModel implements Serializable
{
    use TransientAttributes;
    use Serializer;

    public $table = 'properties';

    // - Types de sérialisation.
    public const SERIALIZE_SUMMARY = 'summary';
    public const SERIALIZE_DEFAULT = 'default';
    public const SERIALIZE_DETAILS = 'details';

    public function __construct(array $attributes = [])
    {
        parent::__construct($attributes);

        $this->validation = fn () => [
            'name' => V::notEmpty()->stringVal(),
            'entities' => V::custom([$this, 'checkEntities']),
            'type' => V::notEmpty()->enumValue(CustomFieldType::class),
            'config' => V::custom([$this, 'checkConfig']),
            'is_totalisable' => V::custom([$this, 'checkIsTotalisable']),
        ];
    }

    // ------------------------------------------------------
    // -
    // -    Validation
    // -
    // ------------------------------------------------------

    public function checkEntities($value)
    {
        if (!is_array($value)) {
            if (!V::notEmpty()->stringType()->validate($value)) {
                return false;
            }
            $value = explode(',', $value);
        }

        return V::arrayType()
            ->each(V::enumValue(PropertyEntity::class))
            ->validate($value);
    }

    public function checkConfig($value)
    {
        if (!is_array($value)) {
            if (!V::nullable(V::json())->validate($value)) {
                return false;
            }
            $value = $value !== null ? $this->fromJson($value) : null;
        }

        $schema = new SchemaStrict(...match ($this->type) {
            CustomFieldType::INTEGER->value,
            CustomFieldType::FLOAT->value => [
                new Rule\Key('unit', V::nullable(V::length(1, 8)), false),
            ],
            CustomFieldType::STRING->value => [
                new Rule\Key('max_length', V::nullable(V::intVal()), false),
            ],
            CustomFieldType::PERIOD->value => [
                new Rule\Key('full_days', V::nullable(V::boolType()), false),
            ],
            CustomFieldType::LIST->value => [
                new Rule\Key('options', (
                    V::arrayType()
                        ->each(V::notEmpty()->stringType())
                        ->notEmpty()
                )),
            ],
            default => [],
        });

        $schema->assert($value ?? []);
        return true;
    }

    public function checkIsTotalisable()
    {
        if (!in_array($this->type, [CustomFieldType::INTEGER->value, CustomFieldType::FLOAT->value], true)) {
            return V::nullType();
        }
        return V::nullable(V::boolType());
    }

    // ------------------------------------------------------
    // -
    // -    Relations
    // -
    // ------------------------------------------------------

    public function materialProperties(): HasMany
    {
        return $this->hasMany(MaterialProperty::class, 'property_id')
            ->orderBy('id');
    }

    public function categories(): BelongsToMany
    {
        return $this->belongsToMany(Category::class, 'property_categories')
            ->using(PropertyCategory::class)
            ->orderBy('name');
    }

    // ------------------------------------------------------
    // -
    // -    Mutators
    // -
    // ------------------------------------------------------

    protected $casts = [
        'name' => 'string',
        'entities' => AsSet::class,
        'type' => 'string',
        'config' => 'array',
        'is_totalisable' => 'boolean',
        'created_at' => 'immutable_datetime',
        'updated_at' => 'immutable_datetime',
    ];

    /** @return Collection<array-key, Category> */
    public function getCategoriesAttribute(): Collection
    {
        return $this->getRelationValue('categories');
    }

    public function getUnitAttribute(): string|null
    {
        Assert::inArray($this->type, [CustomFieldType::INTEGER->value, CustomFieldType::FLOAT->value], (
            'The `unit` field is only defined for `INTEGER` and `FLOAT` types.'
        ));

        return V::stringVal()->validate($this->config['unit'] ?? null)
            ? (string) $this->config['unit']
            : null;
    }

    /** @return list<string> */
    public function getOptionsAttribute(): array
    {
        Assert::eq($this->type, CustomFieldType::LIST->value, (
            'The `options` field is only defined for `LIST` type.'
        ));

        return is_array($this->config['options'] ?? null)
            ? $this->config['options']
            : [];
    }

    public function getMaxLengthAttribute(): int|null
    {
        Assert::eq($this->type, CustomFieldType::STRING->value, (
            'The `max_length` field is only defined for `STRING` type.'
        ));

        return V::intVal()->validate($this->config['max_length'] ?? null)
            ? abs((int) $this->config['max_length'])
            : null;
    }

    public function getFullDaysAttribute(): bool|null
    {
        Assert::eq($this->type, CustomFieldType::PERIOD->value, (
            'The `full_days` field is only defined for `PERIOD` type.'
        ));

        return is_bool($this->config['full_days'] ?? null)
            ? $this->config['full_days']
            : null;
    }

    public function getConfigAttribute($value): array
    {
        $config = $this->castAttribute('config', $value);
        return $config ?? [];
    }

    public function getValueAttribute(): mixed
    {
        return $this->getTransientAttribute('value');
    }

    // ------------------------------------------------------
    // -
    // -    Setters
    // -
    // ------------------------------------------------------

    protected $fillable = [
        'name',
        'entities',
        'type',
        'config',
        'unit',
        'options',
        'max_length',
        'full_days',
        'is_totalisable',
    ];

    public function setTypeAttribute(mixed $value): void
    {
        $this->attributes['type'] = $value;

        // - Si le type n'a pas changé ou qu'il est invalide, on ne va pas plus loin.
        if (!$this->isDirty('type') || !V::enumValue(CustomFieldType::class)->validate($value)) {
            return;
        }

        // - Si la config n'a pas changé, on la met à jour.
        if (!$this->isDirty('config')) {
            $this->config = match ($value) {
                CustomFieldType::INTEGER->value,
                CustomFieldType::FLOAT->value => (
                    Arr::only($this->config, ['unit'])
                ),
                CustomFieldType::STRING->value => (
                    Arr::only($this->config, ['max_length'])
                ),
                CustomFieldType::PERIOD->value => (
                    Arr::only($this->config, ['full_days'])
                ),
                CustomFieldType::LIST->value => (
                    Arr::only($this->config, ['options'])
                ),
                default => [],
            };
        }
    }

    public function setConfigAttribute(mixed $value): void
    {
        $value = is_array($value) && empty($value) ? null : $value;
        $value = $value !== null ? $this->castAttributeAsJson('config', $value) : null;
        $this->attributes['config'] = $value;
    }

    public function setUnitAttribute(mixed $value): void
    {
        $isValidType = in_array($this->type, [CustomFieldType::INTEGER->value, CustomFieldType::FLOAT->value], true);

        $this->config = $value !== null || $isValidType
            ? array_replace($this->config, ['unit' => $value])
            : Arr::except($this->config, ['unit']);
    }

    public function setOptionsAttribute(mixed $value): void
    {
        $this->config = $value !== null || $this->type === CustomFieldType::LIST->value
            ? array_replace($this->config, ['options' => $value])
            : Arr::except($this->config, ['options']);
    }

    public function setMaxLengthAttribute(mixed $value): void
    {
        $this->config = $value !== null || $this->type === CustomFieldType::STRING->value
            ? array_replace($this->config, ['max_length' => $value])
            : Arr::except($this->config, ['max_length']);
    }

    public function setFullDaysAttribute(mixed $value): void
    {
        $this->config = $value !== null || $this->type === CustomFieldType::PERIOD->value
            ? array_replace($this->config, ['full_days' => $value])
            : Arr::except($this->config, ['full_days']);
    }

    public function setValueAttribute(mixed $value): void
    {
        $this->setTransientAttribute('value', $value);
    }

    // ------------------------------------------------------
    // -
    // -    Query Scopes
    // -
    // ------------------------------------------------------

    protected $orderable = [
        'name',
        'type',
    ];

    public function scopeForEntity(Builder $query, PropertyEntity $entity): Builder
    {
        return $query->whereRaw("FIND_IN_SET(?, entities)", [$entity->value]);
    }

    // ------------------------------------------------------
    // -
    // -    Méthodes liées à une "entity"
    // -
    // ------------------------------------------------------

    public function edit(array $data): static
    {
        if ($this->exists) {
            // - À l'édition on ne permet pas le changement de type
            unset($data['type']);
        }

        return dbTransaction(function () use ($data) {
            $this->fill(Arr::except($data, ['categories']))->save();

            // - Catégories
            if (isset($data['categories'])) {
                Assert::isArray($data['categories'], "Key `categories` must be an array.");

                // Si on enlève toutes les catégories (= pas de limite par catégorie),
                // on veut conserver les valeurs existantes des caractéristiques du matériel,
                // donc on ne déclenche pas les events du model `PropertyCategory`.
                if (empty($data['categories'])) {
                    static::withoutEvents(function () use ($data) {
                        $this->categories()->sync($data['categories']);
                    });
                } else {
                    $this->categories()->sync($data['categories']);
                }
            }

            return $this->refresh();
        });
    }

    public function castValue(mixed $rawValue, bool $throw = false): mixed
    {
        if ($rawValue === null) {
            return $rawValue;
        }

        switch ($this->type) {
            case CustomFieldType::STRING->value:
            case CustomFieldType::TEXT->value:
                $value = V::oneOf(V::stringType(), V::number())->validate($rawValue)
                    ? (string) $rawValue
                    : null;
                break;

            case CustomFieldType::INTEGER->value:
                $value = filter_var($rawValue, \FILTER_VALIDATE_INT, (
                    \FILTER_NULL_ON_FAILURE | \FILTER_REQUIRE_SCALAR
                ));
                break;

            case CustomFieldType::FLOAT->value:
                $value = filter_var($rawValue, \FILTER_VALIDATE_FLOAT, (
                    \FILTER_NULL_ON_FAILURE | \FILTER_REQUIRE_SCALAR
                ));
                break;

            case CustomFieldType::PERIOD->value:
                $period = Period::tryFrom($rawValue);
                $value = $period !== null && $this->full_days !== null
                    ? $period->setFullDays($this->full_days)
                    : $period;
                break;

            case CustomFieldType::BOOLEAN->value:
                $value = filter_var($rawValue, \FILTER_VALIDATE_BOOL, (
                    \FILTER_NULL_ON_FAILURE | \FILTER_REQUIRE_SCALAR
                ));
                break;

            case CustomFieldType::LIST->value:
                $value = V::stringVal()->in($this->options)->validate($rawValue)
                    ? (string) $rawValue
                    : null;
                break;

            case CustomFieldType::DATE->value:
                $value = V::date()->validate($rawValue)
                    ? $rawValue
                    : null;
                break;

            default:
                $value = null;
        }

        // - Note: Si la valeur est `null` ici c'est que le filtrage ci-dessous s'est
        //         mal passé (`\FILTER_NULL_ON_FAILURE`) et que la data est invalide.
        if ($throw && $value === null) {
            throw new \InvalidArgumentException('Invalid value');
        }

        return $value;
    }

    // ------------------------------------------------------
    // -
    // -    Serialization
    // -
    // ------------------------------------------------------

    public function serialize(string $format = self::SERIALIZE_DEFAULT): array
    {
        /** @var static $property */
        $property = tap(clone $this, static function (Property $property) use ($format) {
            if ($format === self::SERIALIZE_DETAILS) {
                $property->append(['categories']);
            }
        });

        $data = new DotArray($property->attributesForSerialization());
        $data->delete([
            'config',
            'is_totalisable',
            'created_at',
            'updated_at',
        ]);

        if ($format === self::SERIALIZE_SUMMARY) {
            $data->delete(['entities']);
        }

        switch ($this->type) {
            case CustomFieldType::INTEGER->value:
            case CustomFieldType::FLOAT->value:
                $data->set('unit', $this->unit);

                if ($format !== self::SERIALIZE_SUMMARY) {
                    $data->set('is_totalisable', $this->is_totalisable);
                }
                break;

            case CustomFieldType::LIST->value:
                $data->set('options', $this->options);
                break;

            case CustomFieldType::PERIOD->value:
                $data->set('full_days', $this->full_days);
                break;

            case CustomFieldType::STRING->value:
                $data->set('max_length', $this->max_length);
                break;
        }

        return $data->all();
    }

    public static function serializeValidation(array $data): array
    {
        $data = new DotArray($data);

        // - Config.
        $configErrors = $data->get('config');
        if (!empty($configErrors) && is_array($configErrors)) {
            $data->set($configErrors);
        }
        $data->delete('config');

        return $data->all();
    }
}
