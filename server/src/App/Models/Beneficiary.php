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
use Illuminate\Database\Eloquent\SoftDeletes;
use Loxya\Config\Config;
use Loxya\Contracts\Serializable;
use Loxya\Models\Enums\LegalEntityType;
use Loxya\Models\Traits\Serializer;
use Loxya\Support\Address;
use Loxya\Support\Arr;
use Loxya\Support\Assert;
use Loxya\Support\Country;
use Loxya\Support\Invoicing\BuyerInterface;
use Loxya\Support\Validation\ValidationsException;
use Loxya\Support\Validation\Validator as V;

/**
 * Bénéficiaire / emprunteur.
 *
 * @property-read ?int $id
 * @property int $person_id
 * @property-read Person $person
 * @property-read int|null $user_id
 * @property-read User|null $user
 * @property string|null $reference
 * @property-read string $first_name
 * @property-read string $last_name
 * @property-read string $full_name
 * @property int|null $company_id
 * @property-read Company|null $company
 * @property-read string|null $email
 * @property-read string|null $phone
 * @property-read string|null $street
 * @property-read string|null $additional_street
 * @property-read string|null $postal_code
 * @property-read string|null $administrative_area
 * @property-read string|null $locality
 * @property-read Address $address
 * @property-read Country $country
 * @property-read bool $is_invoiceable
 * @property-read string|null $language
 * @property string|null $note
 * @property-read array $stats
 * @property-read bool $is_deleted
 * @property-read CarbonImmutable $created_at
 * @property-read CarbonImmutable|null $updated_at
 * @property-read CarbonImmutable|null $deleted_at
 *
 * @property-read Collection<array-key, Event> $events
 * @property-read Collection<array-key, Estimate> $estimates
 * @property-read Collection<array-key, Invoice> $invoices
 *
 * @method static Builder|static search(string|string[] $term)
 */
final class Beneficiary extends BaseModel implements Serializable, BuyerInterface
{
    use Serializer;
    use SoftDeletes;

    // - Types de sérialisation.
    public const SERIALIZE_DEFAULT = 'default';
    public const SERIALIZE_SUMMARY = 'summary';
    public const SERIALIZE_DETAILS = 'details';

    protected $table = 'beneficiaries';

    public function __construct(array $attributes = [])
    {
        parent::__construct($attributes);

        $this->validation = fn () => [
            'person_id' => V::custom([$this, 'checkPersonId']),
            'reference' => V::custom([$this, 'checkReference']),
            'company_id' => V::custom([$this, 'checkCompanyId']),
        ];
    }

    // ------------------------------------------------------
    // -
    // -    Validation
    // -
    // ------------------------------------------------------

    public function checkPersonId(mixed $value)
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

        return !$alreadyExists ?: 'person-already-a-beneficiary';
    }

    public function checkReference(mixed $value)
    {
        V::nullable(V::length(null, 191))->check($value);

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

    public function checkCompanyId(mixed $value)
    {
        V::nullable(V::intVal())->check($value);

        if ($value === null) {
            return true;
        }

        $company = Company::withTrashed()->find($value);
        if (!$company) {
            return false;
        }

        return !$this->exists || $this->isDirty('company_id')
            ? !$company->trashed()
            : true;
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

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function events(): BelongsToMany
    {
        return $this->belongsToMany(Event::class, 'event_beneficiaries')
            ->using(EventBeneficiary::class)
            ->orderBy('mobilization_start_date', 'desc');
    }

    public function estimates(): HasMany
    {
        return $this->hasMany(Estimate::class, 'buyer_id')
            ->customOrderBy('date', 'desc');
    }

    public function invoices(): HasMany
    {
        return $this->hasMany(Invoice::class, 'buyer_id')
            ->customOrderBy('date', 'desc');
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
        'additional_street',
        'postal_code',
        'administrative_area',
        'locality',
        'address',
        'country',
        'language',
        'user_id',
        'is_invoiceable',
        'is_deleted',
    ];

    protected $casts = [
        'reference' => 'string',
        'person_id' => 'integer',
        'company_id' => 'integer',
        'note' => 'string',
        'created_at' => 'immutable_datetime',
        'updated_at' => 'immutable_datetime',
        'deleted_at' => 'immutable_datetime',
    ];

    public function getFirstNameAttribute(): string
    {
        if (!$this->person) {
            throw new \LogicException(
                'The beneficiary\'s related person is missing, ' .
                'this relation should always be defined.',
            );
        }
        return $this->person->first_name;
    }

    public function getLastNameAttribute(): string
    {
        if (!$this->person) {
            throw new \LogicException(
                'The beneficiary\'s related person is missing, ' .
                'this relation should always be defined.',
            );
        }
        return $this->person->last_name;
    }

    public function getFullNameAttribute(): string
    {
        if (!$this->person) {
            throw new \LogicException(
                'The beneficiary\'s related person is missing, ' .
                'this relation should always be defined.',
            );
        }
        return $this->person->full_name;
    }

    public function getCompanyAttribute(): Company|null
    {
        return $this->getRelationValue('company');
    }

    public function getEmailAttribute(): string|null
    {
        if (!$this->person) {
            throw new \LogicException(
                'The beneficiary\'s related person is missing, ' .
                'this relation should always be defined.',
            );
        }
        return $this->user?->email ?? $this->person->email;
    }

    public function getPhoneAttribute(): string|null
    {
        if (!$this->person) {
            throw new \LogicException(
                'The beneficiary\'s related person is missing, ' .
                'this relation should always be defined.',
            );
        }
        return $this->person->phone;
    }

    public function getStreetAttribute(): string|null
    {
        if (!$this->person) {
            throw new \LogicException(
                'The beneficiary\'s related person is missing, ' .
                'this relation should always be defined.',
            );
        }
        return $this->person->street;
    }

    public function getAdditionalStreetAttribute(): string|null
    {
        if (!$this->person) {
            throw new \LogicException(
                'The beneficiary\'s related person is missing, ' .
                'this relation should always be defined.',
            );
        }
        return $this->person->additional_street;
    }

    public function getPostalCodeAttribute(): string|null
    {
        if (!$this->person) {
            throw new \LogicException(
                'The beneficiary\'s related person is missing, ' .
                'this relation should always be defined.',
            );
        }
        return $this->person->postal_code;
    }

    public function getAdministrativeAreaAttribute(): string|null
    {
        if (!$this->person) {
            throw new \LogicException(
                'The beneficiary\'s related person is missing, ' .
                'this relation should always be defined.',
            );
        }
        return $this->person->administrative_area;
    }

    public function getLocalityAttribute(): string|null
    {
        if (!$this->person) {
            throw new \LogicException(
                'The beneficiary\'s related person is missing, ' .
                'this relation should always be defined.',
            );
        }
        return $this->person->locality;
    }

    public function getCountryAttribute(): Country
    {
        if (!$this->person) {
            throw new \LogicException(
                'The beneficiary\'s related person is missing, ' .
                'this relation should always be defined.',
            );
        }
        return $this->person->country;
    }

    public function getAddressAttribute(): Address
    {
        if (!$this->person) {
            throw new \LogicException(
                'The beneficiary\'s related person is missing, ' .
                'this relation should always be defined.',
            );
        }
        return $this->person->address;
    }

    public function getUserIdAttribute(): int|null
    {
        if (!$this->person) {
            throw new \LogicException(
                'The beneficiary\'s related person is missing, ' .
                'this relation should always be defined.',
            );
        }
        return $this->person->user?->id;
    }

    public function getLanguageAttribute(): string|null
    {
        if (!$this->person) {
            throw new \LogicException(
                'The beneficiary\'s related person is missing, ' .
                'this relation should always be defined.',
            );
        }
        return $this->person->language;
    }

    public function getUserAttribute(): User|null
    {
        if (!$this->person) {
            throw new \LogicException(
                'The beneficiary\'s related person is missing, ' .
                'this relation should always be defined.',
            );
        }
        return $this->person->user;
    }

    public function getStatsAttribute(): array
    {
        $events = $this->events;

        return [
            'borrowings' => $events->count(),
        ];
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

    public function getIsDeletedAttribute(): bool
    {
        return $this->trashed();
    }

    public function getIsInvoiceableAttribute(): bool
    {
        if (!$this->exists) {
            return false;
        }

        $sellerCountry = Config::getOrganizationCountry();
        return $sellerCountry->isInvoiceable($this);
    }

    // ------------------------------------------------------
    // -
    // -    Profil "acheteur" du bénéficiaire
    // -
    // ------------------------------------------------------

    public function getBuyerType(): LegalEntityType
    {
        return $this->company !== null
            ? LegalEntityType::COMPANY
            : LegalEntityType::INDIVIDUAL;
    }

    public function getBuyerFirstName(): string|null
    {
        return $this->first_name;
    }

    public function getBuyerLastName(): string|null
    {
        return $this->last_name;
    }

    public function getBuyerLegalName(): string|null
    {
        return $this->getBuyerType() === LegalEntityType::COMPANY
            ? $this->company?->legal_name
            : null;
    }

    public function getBuyerRegistrationId(): string|null
    {
        return $this->getBuyerType() === LegalEntityType::COMPANY
            ? $this->company?->registration_id
            : null;
    }

    public function isBuyerPublicEntity(): bool
    {
        return $this->getBuyerType() === LegalEntityType::COMPANY
            ? ($this->company?->is_public_entity ?? false)
            : false;
    }

    public function getBuyerVatNumber(): string|null
    {
        return $this->getBuyerType() === LegalEntityType::COMPANY
            ? $this->company?->vat_number
            : null;
    }

    public function getBuyerServiceCode(): string|null
    {
        return $this->getBuyerType() === LegalEntityType::COMPANY
            ? $this->company?->service_code
            : null;
    }

    public function getBuyerInvoiceIdentifier(): string|null
    {
        return $this->getBuyerType() === LegalEntityType::COMPANY
            ? $this->company?->invoice_identifier
            : null;
    }

    public function getBuyerAddress(): Address
    {
        return $this->getBuyerType() === LegalEntityType::COMPANY
            ? $this->company?->address
            : $this->address;
    }

    public function getBuyerPhone(): string|null
    {
        return $this->getBuyerType() === LegalEntityType::COMPANY
            ? $this->company?->phone
            : $this->phone;
    }

    public function getBuyerEmail(): string|null
    {
        return $this->email;
    }

    // ------------------------------------------------------
    // -
    // -    Setters
    // -
    // ------------------------------------------------------

    protected $fillable = [
        'reference',
        'person_id',
        'company_id',
        'note',
    ];

    public function setReferenceAttribute(mixed $value): void
    {
        $this->attributes['reference'] = $value === '' ? null : $value;
    }

    // ------------------------------------------------------
    // -
    // -    Query Scopes
    // -
    // ------------------------------------------------------

    protected array $orderable = [
        'full_name',
        'reference',
        'company',
        'email',
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
        return $query->where(static function (Builder $query) use ($term) {
            $query
                ->orWhere(static function (Builder $subQuery) use ($term) {
                    $subQuery->where('reference', 'LIKE', $term);
                })
                ->orWhereHas('person', static function (Builder $subQuery) use ($term) {
                    $subQuery
                        ->where('first_name', 'LIKE', $term)
                        ->orWhere('last_name', 'LIKE', $term)
                        ->orWhereRaw('CONCAT(last_name, \' \', first_name) LIKE ?', [$term])
                        ->orWhereRaw('CONCAT(first_name, \' \', last_name) LIKE ?', [$term])
                        ->orWhere('email', 'LIKE', $term);
                })
                ->orWhereRelation('company', 'legal_name', 'LIKE', $term);
        });
    }

    public function scopeCustomOrderBy(Builder $query, string $column, string $direction = 'asc'): Builder
    {
        Assert::inArray($column, ['full_name', 'reference', 'company', 'email'], "Invalid order field.");
        Assert::inArray($direction, ['asc', 'desc'], "Invalid direction.");

        if (!in_array($column, ['full_name', 'company', 'email'], true)) {
            return $query->orderBy($column, $direction);
        }

        $subQuery = match ($column) {
            'company' => (
                Company::select('legal_name')
                    ->whereColumn('id', 'beneficiaries.company_id')
            ),
            'full_name' => (
                Person::selectRaw('CONCAT(last_name, \' \', first_name) as full_name')
                    ->whereColumn('id', 'beneficiaries.person_id')
            ),
            'email' => (
                Person::select('email')
                    ->whereColumn('id', 'beneficiaries.person_id')
            ),
        };

        return $query->orderBy($subQuery, $direction);
    }

    // ------------------------------------------------------
    // -
    // -    Méthodes liées à une "entity"
    // -
    // ------------------------------------------------------

    /**
     * Permet de savoir si le bénéficiaire est assigné à un événement donné.
     *
     * @param Event $event L'événement à vérifier.
     * @return bool True si le bénéficiaire est assigné à l'événement.
     */
    public function isAssignedToEvent(Event $event): bool
    {
        return $this->events->contains($event->id);
    }

    public function edit(array $data): static
    {
        $this->fill(Arr::except($data, ['person', 'user', 'user_id']));
        $isIndividual = $this->company_id === null;

        $person = $this->person ?? new Person();
        $person->fill($data['person'] ?? []);

        if (
            !$this->isValid() ||
            !$person->isValid(enforceBuyerValidation: $isIndividual)
        ) {
            throw new ValidationsException(array_merge(
                $this->validationErrors(),
                ['person' => $person->validationErrors(enforceBuyerValidation: $isIndividual)],
            ));
        }

        return dbTransaction(function () use ($person, $isIndividual) {
            if (!$person->save(['enforceBuyerValidation' => $isIndividual])) {
                throw new \RuntimeException("Unable to save the beneficiary's related person.");
            }
            $this->person()->associate($person);

            if (!$this->save()) {
                throw new \RuntimeException("Unable to save the beneficiary.");
            }

            return $this->refresh();
        });
    }

    // ------------------------------------------------------
    // -
    // -    Serialization
    // -
    // ------------------------------------------------------

    public function serialize(string $format = self::SERIALIZE_DEFAULT): array
    {
        /** @var Beneficiary $beneficiary */
        $beneficiary = tap(clone $this, static function (Beneficiary $beneficiary) use ($format) {
            $beneficiary->append(['company']);

            if ($format === self::SERIALIZE_DETAILS) {
                $beneficiary->append(['user', 'stats']);
            }
        });

        $data = new DotArray($beneficiary->attributesForSerialization());

        if ($format === self::SERIALIZE_SUMMARY) {
            $data->delete([
                'user_id',
                'phone',
                'street',
                'additional_street',
                'postal_code',
                'administrative_area',
                'locality',
                'country',
                'address',
                'company_id',
                'color',
                'language',
                'note',
                'can_make_reservation',
                'is_invoiceable',
                'is_deleted',
            ]);
        }

        return $data
            ->delete([
                'color',
                'can_make_reservation',
                'person_id',
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
            'additional_street',
            'postal_code',
            'administrative_area',
            'locality',
            'country',
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

        // - On supprime les éventuels sous-object `person` et `user` dans le payload,
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
            'additional_street',
            'postal_code',
            'administrative_area',
            'locality',
            'country',
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
