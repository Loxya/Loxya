<?php
declare(strict_types=1);

namespace Loxya\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Loxya\Models\Enums\CustomFieldType;
use Loxya\Models\Enums\PropertyEntity;
use Loxya\Support\Period;
use Loxya\Support\Validation\Validator as V;

/**
 * Valeur d'une caractéristique spéciale pour un matériel.
 *
 * @property-read ?int $id
 * @property-read int $material_id
 * @property-read Material $material
 * @property-read int $property_id
 * @property-read Property $property
 * @property mixed $value
 */
final class MaterialProperty extends BaseModel
{
    protected $table = 'material_properties';
    public $timestamps = false;

    public function __construct(array $attributes = [])
    {
        parent::__construct($attributes);

        $this->validation = fn () => [
            'material_id' => V::custom([$this, 'checkMaterialId']),
            'property_id' => V::custom([$this, 'checkPropertyId']),
            'value' => V::custom([$this, 'checkValue']),
        ];
    }

    // ------------------------------------------------------
    // -
    // -    Validation
    // -
    // ------------------------------------------------------

    public function checkMaterialId($value)
    {
        V::nullable(V::intVal())->check($value);

        // - L'identifiant du matériel n'est pas encore défini, on skip.
        if (!$this->exists && $value === null) {
            return true;
        }

        $material = Material::withTrashed()->find($value);
        if (!$material) {
            return false;
        }

        return !$this->exists || $this->isDirty('material_id')
            ? !$material->trashed()
            : true;
    }

    public function checkPropertyId($value)
    {
        V::notEmpty()->intVal()->check($value);

        $property = Property::find($value);
        if ($property === null) {
            return false;
        }

        // - Si la valeur n'a pas changée, on ne va pas plus loin
        //   même si la valeur en base est potentiellement invalide.
        //   (car ce n'est pas la responsabilité de cette sauvegarde
        //   que de traiter le souci)
        if ($this->exists && !$this->isDirty('property_id')) {
            return true;
        }

        // - La propriété doit être assignable à un matériel.
        if (!in_array(PropertyEntity::MATERIAL->value, $property->entities, true)) {
            return false;
        }

        // - Si on a pas l'id du matériel, on ne peut pas aller plus loin.
        if ($this->material_id === null) {
            return true;
        }

        // - La propriété ne doit pas déjà avoir été assigné au matériel.
        $alreadyExists = static::query()
            ->where('material_id', $this->material_id)
            ->where('property_id', $this->property_id)
            ->when($this->exists, fn (Builder $subQuery) => (
                $subQuery->where('id', '!=', $this->id)
            ))
            ->exists();

        return !$alreadyExists;
    }

    public function checkValue($value)
    {
        // - Si la valeur est `null` ou que la propriété parente n'est
        //   pas récupérable, on laisse passer.
        if ($value === null || $this->property === null) {
            return true;
        }

        // - Si la valeur est json encodée, on décode, sinon on
        //   l'utilise telle quelle.
        $decodedValue = $this->fromJson($value);
        if (json_last_error() !== JSON_ERROR_NONE) {
            $decodedValue = $value;
        }

        switch ($this->property->type) {
            case CustomFieldType::STRING->value:
                $validation = V::stringType();
                if ($this->property->max_length !== null) {
                    $validation->length(null, $this->property->max_length);
                }
                $validation->check($decodedValue);
                break;

            case CustomFieldType::TEXT->value:
                V::stringType()->check($decodedValue);
                break;

            case CustomFieldType::INTEGER->value:
                V::intType()->check($decodedValue);
                break;

            case CustomFieldType::FLOAT->value:
                V::floatType()->check($decodedValue);
                break;

            case CustomFieldType::BOOLEAN->value:
                V::boolType()->check($decodedValue);
                break;

            case CustomFieldType::LIST->value:
                V::in($this->property->options)->check($decodedValue);
                break;

            case CustomFieldType::PERIOD->value:
                $period = Period::tryFrom($decodedValue);
                if (
                    $period === null ||
                    (
                        $this->property->full_days !== null &&
                        $this->property->full_days !== $period->isFullDays()
                    )
                ) {
                    return 'invalid-period';
                }
                break;

            case CustomFieldType::DATE->value:
                V::date()->check($decodedValue);
                break;
        }

        return true;
    }

    // ------------------------------------------------------
    // -
    // -    Relations
    // -
    // ------------------------------------------------------

    public function material(): BelongsTo
    {
        return $this->belongsTo(Material::class);
    }

    public function property(): BelongsTo
    {
        return $this->belongsTo(Property::class);
    }

    // ------------------------------------------------------
    // -
    // -    Mutators
    // -
    // ------------------------------------------------------

    protected $casts = [
        'material_id' => 'integer',
        'property_id' => 'integer',
        'value' => 'json',
    ];

    public function getValueAttribute(string|null $rawValue): mixed
    {
        $rawValue = $this->castAttribute('value', $rawValue);

        if (!$this->property) {
            throw new \LogicException(
                'The material\'s property related property is missing, ' .
                'this relation should always be defined.',
            );
        }
        return $this->property->castValue($rawValue);
    }

    // ------------------------------------------------------
    // -
    // -    Méthodes de "repository"
    // -
    // ------------------------------------------------------

    public static function flushForMaterial(Material $material): void
    {
        if (!$material->exists) {
            return;
        }

        static::whereBelongsTo($material)
            ->get()->each->delete();
    }

    // ------------------------------------------------------
    // -
    // -    Setters
    // -
    // ------------------------------------------------------

    protected $fillable = [
        'property_id',
        'value',
    ];

    public function setValueAttribute(mixed $value): void
    {
        if (!$this->property) {
            throw new \LogicException(
                'The material\'s property related property is missing, ' .
                'this relation should always be defined.',
            );
        }

        try {
            $rawValue = $this->property->castValue($value, throw: true);
        } catch (\InvalidArgumentException) {
            // - On garde la valeur invalide pour la validation.
            $rawValue = $value;
        }

        $this->attributes['value'] = $rawValue !== null
            ? $this->castAttributeAsJson('value', $rawValue)
            : null;
    }
}
