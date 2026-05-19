<?php
declare(strict_types=1);

namespace Loxya\Models;

use Brick\Math\BigDecimal as Decimal;
use Carbon\Exceptions\InvalidFormatException;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\MissingAttributeException;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Query\Expression;
use Loxya\Support\Address;
use Loxya\Support\Arr;
use Loxya\Support\Assert;
use Loxya\Support\Country;
use Loxya\Support\Validation\ValidationException;
use Loxya\Support\Validation\ValidationsException;
use Loxya\Support\Validation\Validator;

/**
 * @mixin \Illuminate\Database\Eloquent\Builder
 *
 * @method null|static first($columns = ['*'])
 * @method static firstOrNew(array $attributes = [], array $values = [])
 * @method static firstOrFail($columns = ['*'])
 * @method static firstOrCreate(array $attributes, array $values = [])
 * @method static firstOr($columns = ['*'], ?\Closure $callback = null)
 * @method static firstWhere($column, $operator = null, $value = null, $boolean = 'and')
 * @method static updateOrCreate(array $attributes, array $values = [])
 *
 * @method static Builder|static query()
 * @method static Builder|static select($columns = ['*'])
 * @method static Builder|static selectRaw(string $expression, array $bindings = [])
 * @method static Builder|static orderBy($column, string $direction = 'asc')
 * @method static Builder|static where($column, $operator = null, $value = null, string $boolean = 'and')
 * @method static Builder|static whereNotIn(string $column, $values, string $boolean = 'and')
 * @method static Builder|static whereBelongsTo(\Illuminate\Database\Eloquent\Model|\Illuminate\Database\Eloquent\Collection<\Illuminate\Database\Eloquent\Model> $related, string|null $relationshipName = null, string $boolean = 'and')
 * @method static Builder|static orWhereBelongsTo(\Illuminate\Database\Eloquent\Model|\Illuminate\Database\Eloquent\Collection<\Illuminate\Database\Eloquent\Model> $related, string|null $relationshipName = null)
 * @method static Builder|static whereIn(string $column, $values, string $boolean = 'and', bool $not = false)
 *
 * @method static static make(array $attributes = [])
 * @method static static create(array $attributes = [])
 * @method static static forceCreate(array $attributes)
 * @method static static findOrFail($id, $columns = ['*'])
 * @method static static findOrNew($id, $columns = ['*'])
 * @method static static firstOrNew(array $attributes = [], array $values = [])
 * @method static static firstOrFail($columns = ['*'])
 * @method static static firstOrCreate(array $attributes, array $values = [])
 * @method static static firstOr($columns = ['*'], ?\Closure $callback = null)
 * @method static static firstWhere($column, $operator = null, $value = null, $boolean = 'and')
 * @method static static updateOrCreate(array $attributes, array $values = [])
 * @method static \Illuminate\Database\Eloquent\Collection|static[] get($columns = ['*'])
 * @method static \Illuminate\Support\Collection|static[] pluck(string|\Illuminate\Contracts\Database\Query\Expression $column, string|null $key = null)
 * @method static static|null find($id, $columns = ['*'])
 * @method static static|null first($columns = ['*'])
 * @method static int count(string $columns = '*')
 *
 * @method static Builder|static customOrderBy(string $column, string $direction = 'asc')
 * @method static Builder|static whereDatetimeRoundedMinutes(string $column, string $operator, string|\DateTimeInterface $value, int $precision = 15, string $rounding = 'round')
 */
abstract class BaseModel extends Model
{
    /** @var array<string, array> */
    private array $columns;

    protected \Closure $validation;

    // ------------------------------------------------------
    // -
    // -    Méthodes liées à une "entity"
    // -
    // ------------------------------------------------------

    public function edit(array $data): static
    {
        $this->fill($data)->save();

        return $this->refresh();
    }

    /**
     * Retire un ou plusieurs attributs de la liste `$appends` du modèle.
     *
     * @param string|string[] $attributes
     */
    public function unappend(string|array $attributes): static
    {
        $this->setAppends(array_values(array_diff(
            $this->appends,
            is_string($attributes) ? [$attributes] : $attributes,
        )));

        return $this;
    }

    // ------------------------------------------------------
    // -
    // -    Méthodes de "repository"
    // -
    // ------------------------------------------------------

    public static function new(array $data): static
    {
        // @phpstan-ignore-next-line
        return (new static())->edit($data);
    }

    public static function includes($id): bool
    {
        return static::where('id', $id)->exists();
    }

    // ------------------------------------------------------
    // -
    // -    Overwritten methods
    // -
    // ------------------------------------------------------

    public function fill(array $attributes)
    {
        $data = array_map(
            static function ($value) {
                $value = is_string($value) ? trim($value) : $value;
                return $value === '' ? null : $value;
            },
            $attributes,
        );

        return parent::fill($data);
    }

    public function fromDateTime($value)
    {
        if (empty($value)) {
            return $value;
        }

        try {
            return $this->asDateTime($value)->format($this->getDateFormat());
        } catch (InvalidFormatException $e) {
            // - On renvoi la valeur invalide pour pouvoir la valider.
            if (is_string($value)) {
                return $value;
            }
            throw $e;
        }
    }

    public function save(array $options = [])
    {
        if ($options['validate'] ?? true) {
            $this->validate();
        }

        unset($options['validate']);
        return parent::save($options);
    }

    public function syncChanges()
    {
        $this->changes = [];
        foreach (array_keys($this->getAttributes()) as $key) {
            if (!$this->originalIsEquivalent($key)) {
                $this->changes[$key] = $this->getRawOriginal($key);
            }
        }

        return $this;
    }

    public function getPrevious($key = null, $default = null)
    {
        $previousAttributes = array_replace($this->original, $this->changes);

        // @phpstan-ignore new.static (même implémentation que `static::getOriginal()`)
        return (new static())
            ->setRawAttributes($previousAttributes, true)
            ->getOriginalWithoutRewindingModel($key, $default);
    }

    public function __isset($key)
    {
        // NOTE: En temps normal, `isset($model)` retourne `true` uniquement si
        //       l'attribut existe et qu'il est non `null`. De notre côté on on
        //       considère que même s'il est `null`, l'attribut existe bien au
        //       niveau du modèle (ceci pour améliorer la prise en charge dans
        //       Twig, sans quoi il tente de passer par une méthode avec le même
        //       nom que l'attribut et se retrouve à retourner des relations).
        try {
            $this->getAttribute($key);
            return true;
        } catch (MissingAttributeException) {
            return false;
        }
    }

    public function __clone()
    {
        // - On rebind les règles de validation sur la nouvelle instance.
        $this->validation = $this->validation->bindTo($this, $this);
    }

    public function toArray()
    {
        return $this->attributesToArray();
    }

    protected function asJson($value)
    {
        return json_encode($value, \JSON_PRESERVE_ZERO_FRACTION);
    }

    protected function mutateAttributeForArray($key, $value)
    {
        $value = parent::mutateAttributeForArray($key, $value);

        $serialize = static function ($value) use (&$serialize) {
            if ($value instanceof Decimal || $value instanceof Country) {
                return (string) $value;
            }

            if ($value instanceof Address) {
                return $value->format();
            }

            if (is_array($value)) {
                return array_map(
                    static fn ($subValue) => $serialize($subValue),
                    $value,
                );
            }

            return $value;
        };

        return $serialize($value);
    }

    // ------------------------------------------------------
    // -
    // -    Other useful methods
    // -
    // ------------------------------------------------------

    /**
     * @return array<string, 'asc'|'desc'>
     */
    private function getRawOrderableColumns(): array
    {
        if (property_exists($this, 'orderable')) {
            $orderable = $this->orderable;
        } else {
            $orderable = [$this->getKey()];
            if (in_array('name', $this->getTableColumns(), true)) {
                array_unshift($orderable, 'name');
            }
        }

        return Arr::mapWithKeys($orderable, function ($direction, $column) {
            if (is_int($column)) {
                return [$direction => 'asc'];
            }

            $direction = strtolower((string) $direction);
            if (!in_array($direction, ['asc', 'desc'], true) || !is_string($column)) {
                throw new \LogicException(sprintf(
                    'Invalid column / direction in %s model `$orderable` property.',
                    class_basename($this),
                ));
            }
            return [$column => $direction];
        });
    }

    public function getOrderableColumns(): array
    {
        return array_keys($this->getRawOrderableColumns());
    }

    public function getDefaultOrderColumn(): string|null
    {
        return Arr::first($this->getOrderableColumns());
    }

    /**
     * @param string $column La colonne pour laquelle on veut la direction par défaut.
     *
     * @return 'asc'|'desc' La direction.
     */
    public function getDefaultOrderDirection(string $column): string
    {
        $orderableColumns = $this->getRawOrderableColumns();
        return $orderableColumns[$column] ?? 'asc';
    }

    public function getTableColumns(): array
    {
        if (!isset($this->columns)) {
            $this->columns = $this->getConnection()
                ->getSchemaBuilder()
                ->getColumnListing($this->getTable());
        }
        return $this->columns;
    }

    public function getAttributeUnsafeValue($key)
    {
        return $this->isDirty($key)
            ? $this->getAttributeFromArray($key)
            : $this->getAttributeValue($key);
    }

    // ------------------------------------------------------
    // -
    // -    Validation related
    // -
    // ------------------------------------------------------

    public function validationErrors(): array
    {
        /** @var array<string, Validator> $rules */
        $rules = ($this->validation)();
        if (empty($rules)) {
            throw new \RuntimeException("Validation rules cannot be empty.");
        }

        // - Récupère les attributs du modèle, castés (sauf les données tout juste ajoutées).
        $data = $this->addCastAttributesToArray(
            $this->getAttributes(),
            array_keys($this->getDirty()),
        );

        foreach ($data as $field => $value) {
            $castType = $this->getCasts()[$field] ?? null;
            if (is_array($value) && $castType === null && Arr::isAssoc($value)) {
                unset($data[$field]);
            }
        }

        // - Validation
        $errors = [];
        foreach ($rules as $field => $rule) {
            try {
                $rule->setName($field)->assert($data[$field] ?? null, normalized: true);
            } catch (ValidationsException $e) {
                $errors[$field] = $e->getValidationErrors();
            } catch (ValidationException $e) {
                $errors[$field] = $e->getMessage();
            }
        }

        return $errors;
    }

    public function isValid(): bool
    {
        return count($this->validationErrors()) === 0;
    }

    public function validate(): static
    {
        $errors = $this->validationErrors();
        if (count($errors) > 0) {
            throw new ValidationsException($errors);
        }
        return $this;
    }

    // ------------------------------------------------------
    // -
    // -    Query Scopes
    // -
    // ------------------------------------------------------

    public function scopeCustomOrderBy(Builder $query, string $column, string $direction = 'asc'): Builder
    {
        Assert::inArray($column, $this->getTableColumns(), "Invalid order field.");
        Assert::inArray($direction, ['asc', 'desc'], "Invalid direction.");

        return $query->orderBy($column, $direction);
    }

    public function scopeWhereDatetimeRoundedMinutes(
        Builder $query,
        string $column,
        string $operator,
        string|\DateTimeInterface $value,
        int $precision = 15,
        string $rounding = 'round',
    ): Builder {
        Assert::greaterThan($precision, 0, 'Invalid precision, must be superior to 0.');
        Assert::lessThanEq($precision, 60, 'Invalid precision, must be inferior or equal to 60.');
        Assert::true(60 % $precision === 0, 'Invalid precision, must be a divisor of 60.');
        Assert::oneOf(strtolower($rounding), ['floor', 'round', 'ceil']);

        // - On récupère l'heure "de base", et on y ajoute le temps nécessaire
        //   pour atteindre la précision choisie :
        //   - 1. On récupère l'heure de base (e.g. 14:35:40 => 14:00:00)
        //   - 2. On récupère le temps (minutes, secondes) en minutes (e.g. `35:40` => `35.666...`)
        //   - 3. On divise ceci par la précision et on arrondi suivant le rounding choisi.
        //        (e.g. `35.666` pour 15 de précision => ROUND('2.3777...') => `2`)
        //   - 4. On multiplie par la précision en minutes (e.g. `2` * 15 => `30`)
        //   - 5. On convertie ça en secondes et on récupère un TIME correspond.
        //        (e.g. `30` minutes => `1800` secondes => `00:30:00`)
        //   - 6. On ajoute ce temps à l'heure de base.
        //        (e.g. `14:00:00` + `00:30:00` => `14:30:00`)
        $rawColumn = new Expression(vsprintf(
            'ADDTIME(
                DATE_FORMAT(%1$s, \'%%Y-%%m-%%d %%H:00:00\'),
                SEC_TO_TIME(
                    %3$s((MINUTE(%1$s) + (SECOND(%1$s) / 60)) / %2$s) * %2$s * 60
                )
            )',
            [$column, $precision, strtoupper($rounding)],
        ));

        return $query->where($rawColumn, $operator, $value);
    }

    // ------------------------------------------------------
    // -
    // -    Internal Methods
    // -
    // ------------------------------------------------------

    public function jsonSerialize(): mixed
    {
        if (method_exists($this, 'serialize')) {
            return $this->serialize();
        }
        return parent::jsonSerialize();
    }

    // @see https://laravel.com/docs/8.x/eloquent-serialization#customizing-the-default-date-format
    protected function serializeDate(\DateTimeInterface $date)
    {
        return $date->format('Y-m-d H:i:s');
    }
}
