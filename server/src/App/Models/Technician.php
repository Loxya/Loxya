<?php
declare(strict_types=1);

namespace Loxya\Models;

use Adbar\Dot as DotArray;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Loxya\Config\Enums\Feature;
use Loxya\Contracts\Serializable;
use Loxya\Errors\Exception\ValidationException;
use Loxya\Models\Traits\Serializer;
use Loxya\Support\Arr;
use Loxya\Support\Assert;
use Loxya\Support\Validation\Validator as V;

/**
 * Technicien.
 *
 * @property-read ?int $id
 * @property int $person_id
 * @property-read Person $person
 * @property-read int|null $user_id
 * @property-read User|null $user
 * @property-read string $first_name
 * @property-read string $last_name
 * @property string|null $nickname
 * @property-read string $full_name
 * @property-read string|null $email
 * @property-read string|null $phone
 * @property-read string|null $street
 * @property-read string|null $postal_code
 * @property-read string|null $locality
 * @property-read int|null $country_id
 * @property-read Country|null $country
 * @property-read string|null $full_address
 * @property string|null $note
 * @property-read CarbonImmutable $created_at
 * @property-read CarbonImmutable|null $updated_at
 * @property-read CarbonImmutable|null $deleted_at
 *
 * @property-read Collection<array-key, Role> $roles
 * @property-read Collection<array-key, EventTechnician> $assignments
 * @property-read Collection<array-key, Document> $documents
 *
 * @method static Builder|static search(string|string[] $term)
 */
final class Technician extends BaseModel implements Serializable
{
    use Serializer;
    use SoftDeletes;

    /** L'identifiant unique du modèle. */
    public const TYPE = 'technician';

    protected $table = 'technicians';

    // - Types de sérialisation.
    public const SERIALIZE_SUMMARY = 'summary';
    public const SERIALIZE_DEFAULT = 'default';
    public const SERIALIZE_DETAILS = 'details';

    public function __construct(array $attributes = [])
    {
        parent::__construct($attributes);

        $this->validation = fn () => [
            'person_id' => V::custom([$this, 'checkPersonId']),
            'nickname' => V::optional(V::length(null, 30)),
        ];
    }

    // ------------------------------------------------------
    // -
    // -    Validation
    // -
    // ------------------------------------------------------

    public function checkPersonId($value)
    {
        V::nullable(V::intVal())->check($value);

        // - L'identifiant de la personne n'est pas encore défini, on skip.
        if (!$this->exists && $value === null) {
            return true;
        }

        if (!Person::includes($value)) {
            return false;
        }

        $alreadyExists = static::query()
            ->where('person_id', $value)
            ->when($this->exists, fn (Builder $subQuery) => (
                $subQuery->where('id', '!=', $this->id)
            ))
            ->withTrashed()
            ->exists();

        return !$alreadyExists ?: 'person-already-a-technician';
    }

    // ------------------------------------------------------
    // -
    // -    Relations
    // -
    // ------------------------------------------------------

    public function person(): BelongsTo
    {
        return $this->belongsTo(Person::class);
    }

    public function assignments(): HasMany
    {
        return $this->hasMany(EventTechnician::class, 'technician_id')
            ->with('event')
            ->has('event')
            ->orderBy('start_date');
    }

    public function documents(): MorphMany
    {
        return $this->morphMany(Document::class, 'entity')
            ->orderBy('name', 'asc')
            ->orderBy('id', 'asc');
    }

    public function roles(): BelongsToMany
    {
        return $this->belongsToMany(Role::class, 'technician_roles')
            ->using(TechnicianRole::class)
            ->orderBy('name', 'asc');
    }

    // ------------------------------------------------------
    // -
    // -    Overwritten methods
    // -
    // ------------------------------------------------------

    public function save(array $options = [])
    {
        if (!isFeatureEnabled(Feature::TECHNICIANS)) {
            throw new \LogicException("Disabled feature, can't save.");
        }
        return parent::save($options);
    }

    // ------------------------------------------------------
    // -
    // -    Mutators
    // -
    // ------------------------------------------------------

    protected $appends = [
        'first_name',
        'last_name',
        'full_name',
        'email',
        'phone',
        'street',
        'postal_code',
        'locality',
        'full_address',
        'country_id',
        'user_id',
    ];

    protected $casts = [
        'nickname' => 'string',
        'person_id' => 'integer',
        'note' => 'string',
        'created_at' => 'immutable_datetime',
        'updated_at' => 'immutable_datetime',
        'deleted_at' => 'immutable_datetime',
    ];

    public function getFirstNameAttribute(): string
    {
        if (!$this->person) {
            throw new \LogicException(
                'The technician\'s related person is missing, ' .
                'this relation should always be defined.',
            );
        }
        return $this->person->first_name;
    }

    public function getLastNameAttribute(): string
    {
        if (!$this->person) {
            throw new \LogicException(
                'The technician\'s related person is missing, ' .
                'this relation should always be defined.',
            );
        }
        return $this->person->last_name;
    }

    public function getFullNameAttribute(): string
    {
        if (!$this->person) {
            throw new \LogicException(
                'The technician\'s related person is missing, ' .
                'this relation should always be defined.',
            );
        }
        return $this->person->full_name;
    }

    public function getEmailAttribute(): string|null
    {
        if (!$this->person) {
            throw new \LogicException(
                'The technician\'s related person is missing, ' .
                'this relation should always be defined.',
            );
        }
        return $this->person->email;
    }

    public function getPhoneAttribute(): string|null
    {
        if (!$this->person) {
            throw new \LogicException(
                'The technician\'s related person is missing, ' .
                'this relation should always be defined.',
            );
        }
        return $this->person->phone;
    }

    public function getStreetAttribute(): string|null
    {
        if (!$this->person) {
            throw new \LogicException(
                'The technician\'s related person is missing, ' .
                'this relation should always be defined.',
            );
        }
        return $this->person->street;
    }

    public function getPostalCodeAttribute(): string|null
    {
        if (!$this->person) {
            throw new \LogicException(
                'The technician\'s related person is missing, ' .
                'this relation should always be defined.',
            );
        }
        return $this->person->postal_code;
    }

    public function getLocalityAttribute(): string|null
    {
        if (!$this->person) {
            throw new \LogicException(
                'The technician\'s related person is missing, ' .
                'this relation should always be defined.',
            );
        }
        return $this->person->locality;
    }

    public function getCountryIdAttribute(): int|null
    {
        if (!$this->person) {
            throw new \LogicException(
                'The technician\'s related person is missing, ' .
                'this relation should always be defined.',
            );
        }
        return $this->person->country_id;
    }

    public function getCountryAttribute(): Country|null
    {
        if (!$this->person) {
            throw new \LogicException(
                'The technician\'s related person is missing, ' .
                'this relation should always be defined.',
            );
        }
        return $this->person->country;
    }

    public function getFullAddressAttribute(): string|null
    {
        if (!$this->person) {
            throw new \LogicException(
                'The technician\'s related person is missing, ' .
                'this relation should always be defined.',
            );
        }
        return $this->person->full_address;
    }

    public function getUserIdAttribute(): int|null
    {
        if (!$this->person) {
            throw new \LogicException(
                'The technician\'s related person is missing, ' .
                'this relation should always be defined.',
            );
        }
        return $this->person->user?->id;
    }

    public function getUserAttribute(): User|null
    {
        if (!$this->person) {
            throw new \LogicException(
                'The technician\'s related person is missing, ' .
                'this relation should always be defined.',
            );
        }
        return $this->person->user;
    }

    /** @return Collection<array-key, Role> */
    public function getRolesAttribute(): Collection
    {
        return $this->getRelationValue('roles');
    }

    // ------------------------------------------------------
    // -
    // -    Setters
    // -
    // ------------------------------------------------------

    protected $fillable = [
        'nickname',
        'person_id',
        'note',
    ];

    // ------------------------------------------------------
    // -
    // -    Query Scopes
    // -
    // ------------------------------------------------------

    protected $orderable = [
        'full_name',
        'email',
        'nickname',
    ];

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

        $term = sprintf('%%%s%%', addcslashes($term, '%_'));
        return $query->where(static fn (Builder $subQuery) => (
            $subQuery
                ->where(static fn (Builder $subSubQuery) => (
                    $subSubQuery->where('nickname', 'LIKE', $term)
                ))
                ->orWhereHas('person', static fn (Builder $subSubQuery) => (
                    $subSubQuery
                        ->where('first_name', 'LIKE', $term)
                        ->orWhere('last_name', 'LIKE', $term)
                        ->orWhereRaw('CONCAT(last_name, \' \', first_name) LIKE ?', [$term])
                        ->orWhereRaw('CONCAT(first_name, \' \', last_name) LIKE ?', [$term])
                        ->orWhere('email', 'LIKE', $term)
                ))
        ));
    }

    public function scopeCustomOrderBy(Builder $query, string $column, string $direction = 'asc'): Builder
    {
        Assert::inArray($column, ['full_name', 'email', 'nickname'], "Invalid order field.");

        if (!in_array($column, ['full_name', 'email'], true)) {
            return $query->orderBy($column, $direction);
        }

        if ($column === 'full_name') {
            $subQuery = Person::selectRaw('CONCAT(last_name, \' \', first_name) as full_name');
        } else {
            $subQuery = Person::select('email');
        }
        $subQuery = $subQuery->whereColumn('id', 'technicians.person_id');

        return $query->orderBy($subQuery, $direction);
    }

    // ------------------------------------------------------
    // -
    // -    Méthodes liées à une "entity"
    // -
    // ------------------------------------------------------

    public function edit(array $data, bool $withUser = false): static
    {
        $this->fill(Arr::except($data, ['person', 'user', 'user_id']));

        $person = $this->person ?? new Person();
        $person->fill($data['person'] ?? []);

        if (!$this->isValid() || !$person->isValid()) {
            throw new ValidationException(array_merge(
                $this->validationErrors(),
                ['person' => $person->validationErrors()],
            ));
        }

        return dbTransaction(function () use ($person, $data) {
            if (!$person->save()) {
                throw new \RuntimeException("Unable to save the technician's related person.");
            }
            $this->person()->associate($person);

            if (!$this->save()) {
                throw new \RuntimeException("Unable to save the technician.");
            }

            // - Rôles
            if (isset($data['roles'])) {
                Assert::isArray($data['roles'], "Key `roles` must be an array.");
                $this->roles()->sync($data['roles']);
            }

            return $this->refresh();
        });
    }

    /**
     * Permet de savoir si le technicien est assigné à un événement donné.
     *
     * @param Event $event L'événement à vérifier.
     * @return bool True si le technicien est assigné à l'événement.
     */
    public function isAssignedToEvent(Event $event): bool
    {
        if (!isFeatureEnabled(Feature::TECHNICIANS)) {
            return false;
        }
        return $this->assignments->containsStrict('event_id', $event->id);
    }

    // ------------------------------------------------------
    // -
    // -    Méthodes de "repository"
    // -
    // ------------------------------------------------------

    public static function new(array $data, bool $withUser = false): static
    {
        return (new static())->edit($data, $withUser);
    }

    // ------------------------------------------------------
    // -
    // -    Serialization
    // -
    // ------------------------------------------------------

    public function serialize(string $format = self::SERIALIZE_DEFAULT): array
    {
        /** @var Technician $technician */
        $technician = tap(clone $this, static function (Technician $technician) use ($format) {
            if ($format !== self::SERIALIZE_SUMMARY) {
                $technician->append(['country']);
            }
            if ($format === self::SERIALIZE_DEFAULT) {
                $technician->append(['roles']);
            }
            if ($format === self::SERIALIZE_DETAILS) {
                $technician->append(['user', 'roles']);
            }
        });

        $data = new DotArray($technician->attributesForSerialization());

        if ($format === self::SERIALIZE_SUMMARY) {
            $data->delete([
                'first_name',
                'last_name',
                'nickname',
                'phone',
                'street',
                'postal_code',
                'locality',
                'country_id',
                'country',
                'full_address',
                'user_id',
                'note',
            ]);
        }

        return $data
            ->delete([
                'person_id',
                'is_preparer',
                'created_at',
                'updated_at',
                'deleted_at',
            ])
            ->all();
    }

    public static function serializeValidation(array $data): array
    {
        $data = new DotArray($data);

        $personFields = [
            'first_name',
            'last_name',
            'email',
            'phone',
            'street',
            'postal_code',
            'locality',
            'country_id',
        ];
        foreach ($personFields as $field) {
            $originalPath = sprintf('person.%s', $field);
            if ($data->has($originalPath) && !$data->has($field)) {
                $data->set($field, $data->get($originalPath));
            }
            $data->delete($originalPath);
        }

        if ($data->isEmpty('person')) {
            $data->delete('person');
        }

        $userFields = ['pseudo', 'email', 'password', 'group'];
        foreach ($userFields as $field) {
            $originalPath = sprintf('user.%s', $field);
            if ($data->has($originalPath) && !$data->has($field)) {
                $data->set($field, $data->get($originalPath));
            }
            $data->delete($originalPath);
        }

        if ($data->isEmpty('user')) {
            $data->delete('user');
        }

        return $data->all();
    }

    public static function unserialize(array $data): array
    {
        $data = new DotArray($data);

        // - On supprime les éventuels sous-objects `person` et `user` dans le payload,
        //   non attendus sous cette forme (les données de la personne liée et de
        //   l'utilisateur lié doivent être fusionnées avec les données du bénéficiaire).
        $data->delete(['person', 'person_id', 'user']);

        if ($data->has('email')) {
            $data->set('person.email', $data->get('email'));
            $data->set('user.email', $data->get('email'));
            $data->delete('email');
        }

        $personFields = [
            'first_name',
            'last_name',
            'phone',
            'street',
            'postal_code',
            'locality',
            'country_id',
        ];
        foreach ($personFields as $field) {
            $originalPath = sprintf('person.%s', $field);
            if ($data->has($field)) {
                $data->set($originalPath, $data->get($field));
                $data->delete($field);
            }
        }

        $userFields = ['pseudo', 'password'];
        foreach ($userFields as $field) {
            $originalPath = sprintf('user.%s', $field);
            if ($data->has($field)) {
                $data->set($originalPath, $data->get($field));
                $data->delete($field);
            }
        }

        return $data->all();
    }
}
