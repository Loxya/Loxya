<?php
declare(strict_types=1);

namespace Loxya\Models;

use Adbar\Dot as DotArray;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Str;
use Loxya\Config\Config;
use Loxya\Config\Enums\BillingMode;
use Loxya\Config\Enums\Feature;
use Loxya\Contracts\Serializable;
use Loxya\Models\Casts\AsCountry;
use Loxya\Models\Traits\Serializer;
use Loxya\Support\Address;
use Loxya\Support\Addressing\AddressField;
use Loxya\Support\Arr;
use Loxya\Support\Assert;
use Loxya\Support\Country;
use Loxya\Support\Validation\ValidationsException;
use Loxya\Support\Validation\Validator as V;

/**
 * Une personne.
 *
 * @property-read ?int $id
 * @property int|null $user_id
 * @property-read User|null $user
 * @property string $first_name
 * @property string $last_name
 * @property-read string $full_name
 * @property string|null $email
 * @property string|null $phone
 * @property string|null $street
 * @property string|null $additional_street
 * @property string|null $postal_code
 * @property string|null $administrative_area
 * @property string|null $locality
 * @property-read Address $address
 * @property Country $country
 * @property-read string|null $language
 * @property-read CarbonImmutable $created_at
 * @property-read CarbonImmutable|null $updated_at
 *
 * @property-read Beneficiary|null $beneficiary
 * @property-read Technician|null $technician
 *
 * @method static Builder|static search(string|string[] $term)
 */
final class Person extends BaseModel implements Serializable
{
    use Serializer;

    protected $table = 'persons';

    /**
     * Indique si la validation doit ajouter des règles de
     * validation spécifiques aux données requises pour les acheteurs.
     *
     * Cette valeur devrait revenir à `false` après chaque validation.
     */
    private bool $enforceBuyerValidation = false;

    public function __construct(array $attributes = [])
    {
        parent::__construct($attributes);

        $this->validation = fn () => [
            'user_id' => V::custom([$this, 'checkUserId']),
            'first_name' => V::notEmpty()->nameLike()->length(2, 35),
            'last_name' => V::notEmpty()->nameLike()->length(2, 35),
            'email' => V::nullable(V::email()),
            'phone' => V::custom([$this, 'checkPhone']),
            'street' => V::custom([$this, 'checkStreet']),
            'additional_street' => V::custom([$this, 'checkAdditionalStreet']),
            'postal_code' => V::custom([$this, 'checkPostalCode']),
            'administrative_area' => V::custom([$this, 'checkAdministrativeArea']),
            'locality' => V::custom([$this, 'checkLocality']),
            'country' => V::notEmpty()->countryCode(),
        ];
    }

    // ------------------------------------------------------
    // -
    // -    Validation
    // -
    // ------------------------------------------------------

    public function checkUserId(mixed $value)
    {
        V::nullable(V::intVal())->check($value);
        return $value === null || User::includes($value);
    }

    public function checkStreet()
    {
        return V::create()
            ->nullable(V::length(null, 191))
            ->custom(
                [$this, 'checkAddressField'],
                AddressField::ADDRESS_LINE1,
            );
    }

    public function checkAdditionalStreet()
    {
        return V::create()
            ->nullable(V::length(null, 191))
            ->custom(
                [$this, 'checkAddressField'],
                AddressField::ADDRESS_LINE2,
            );
    }

    public function checkPostalCode(mixed $value)
    {
        V::create()
            ->nullable(V::length(null, 10))
            ->custom(
                [$this, 'checkAddressField'],
                AddressField::POSTAL_CODE,
            )
            ->check($value);

        // - Si la valeur est nulle, on ne va pas plus loin.
        if ($value === null) {
            return true;
        }

        // - Si le pays n'est pas valide, on ne peut pas aller plus loin.
        $countryCode = $this->getAttributeFromArray('country');
        if (!V::countryCode()->validate($countryCode)) {
            return true;
        }

        return V::postalCode($countryCode);
    }

    public function checkAdministrativeArea()
    {
        return V::create()
            ->nullable(V::length(null, 191))
            ->custom(
                [$this, 'checkAddressField'],
                AddressField::ADMINISTRATIVE_AREA,
            );
    }

    public function checkLocality()
    {
        return V::create()
            ->nullable(V::length(null, 191))
            ->custom(
                [$this, 'checkAddressField'],
                AddressField::LOCALITY,
            );
    }

    public function checkAddressField(mixed $value, AddressField $field)
    {
        // - Si la valeur est non nulle, on est bon.
        if ($value !== null) {
            return true;
        }

        // - Si la facturation n'est pas activée, on n'impose pas le remplissage.
        if (Config::get('billingMode') === BillingMode::NONE) {
            return true;
        }

        // - Si les règles de validation liées aux acheteurs ne sont
        //   pas forcées, on n'impose pas le remplissage.
        if (!$this->enforceBuyerValidation) {
            return true;
        }

        // - Si l'adresse n'est pas requise pour les acheteur particuliers
        //   dans le pays de l'organisation, on n'impose pas le remplissage.
        $sellerCountry = Config::getOrganizationCountry();
        if (!$sellerCountry->requireBuyerAddress(false)) {
            return true;
        }

        // - Si le pays n'est pas valide, on ne peut pas aller plus loin.
        $countryCode = $this->getAttributeFromArray('country');
        if (!V::countryCode()->validate($countryCode)) {
            return true;
        }

        $country = new Country($countryCode);
        return !$country->isAddressFieldMandatory($field)
            ?: 'mandatory-field';
    }

    public function checkPhone(mixed $value)
    {
        V::nullable(V::phone())->check($value);

        if ($value === null) {
            return true;
        }

        // - Si c'est un format "national", par défaut on
        //   considère le pays de l'application.
        $mainCountryCode = Config::get('mainCountry');
        if (V::phone($mainCountryCode)->validate($value)) {
            return true;
        }

        // - Sinon, on considère le pays de la personne.
        $rawCountryCode = $this->getAttributeFromArray('country');
        $countryCode = V::countryCode()->validate($rawCountryCode)
            ? $rawCountryCode
            : null;

        return V::phone($countryCode ?? $mainCountryCode);
    }

    // ------------------------------------------------------
    // -
    // -    Relations
    // -
    // ------------------------------------------------------

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function beneficiary(): HasOne
    {
        return $this->hasOne(Beneficiary::class);
    }

    public function technician(): HasOne
    {
        return $this->hasOne(Technician::class);
    }

    // ------------------------------------------------------
    // -
    // -    Mutators
    // -
    // ------------------------------------------------------

    protected $appends = [
        'full_name',
        'address',
    ];

    protected $casts = [
        'user_id' => 'integer',
        'first_name' => 'string',
        'last_name' => 'string',
        'email' => 'string',
        'phone' => 'string',
        'street' => 'string',
        'additional_street' => 'string',
        'postal_code' => 'string',
        'administrative_area' => 'string',
        'locality' => 'string',
        'country' => AsCountry::class,
        'created_at' => 'immutable_datetime',
        'updated_at' => 'immutable_datetime',
    ];

    public function getFullNameAttribute(): string
    {
        return implode(' ', [$this->first_name, $this->last_name]);
    }

    public function getAddressAttribute(): Address
    {
        if ($this->country === null) {
            throw new \LogicException("Country should always be defined.");
        }

        return (new Address($this->country))
            ->withAddressLine1($this->street)
            ->withAddressLine2($this->additional_street)
            ->withPostalCode($this->postal_code)
            ->withAdministrativeArea($this->administrative_area)
            ->withLocality($this->locality);
    }

    public function getLanguageAttribute(): string|null
    {
        return $this->user?->language;
    }

    public function getTechnicianAttribute(): Technician|null
    {
        if (!isFeatureEnabled(Feature::TECHNICIANS)) {
            return null;
        }
        return $this->getRelationValue('technician');
    }

    // ------------------------------------------------------
    // -
    // -    Setters
    // -
    // ------------------------------------------------------

    protected $fillable = [
        'user_id',
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

    public function setPhoneAttribute(mixed $rawValue): void
    {
        // - Si ce n'est pas une chaîne (`null` ou valeur invalide) => On ne va pas plus loin.
        if (!is_string($rawValue)) {
            $this->attributes['phone'] = $rawValue;
            return;
        }
        $rawValue = Str::remove([' ', '-', '.'], trim($rawValue));

        // - Si la valeur est vide, on ne va pas plus loin.
        if ($rawValue === '') {
            $this->attributes['phone'] = null;
            return;
        }

        // - Si c'est un format "national", par défaut on
        //   considère le pays de l'application.
        $mainCountry = Config::getMainCountry();
        if ($mainCountry->isValidPhoneNumber($rawValue, strict: false)) {
            $this->attributes['phone'] = $mainCountry->normalizePhoneNumber($rawValue);
            return;
        }

        // - Sinon, on considère le pays de l'entreprise.
        $rawCountryCode = $this->getAttributeFromArray('country');
        $country = V::countryCode()->validate($rawCountryCode)
            ? new Country($rawCountryCode)
            : null;

        // - Si le pays n'est pas défini, on ne peut pas normaliser.
        if ($country === null) {
            $this->attributes['phone'] = $rawValue;
            return;
        }

        $this->attributes['phone'] = (
            $country->isValidPhoneNumber($rawValue, strict: false)
                ? $country->normalizePhoneNumber($rawValue)
                : $rawValue
        );
    }

    public function setCountryAttribute(mixed $rawValue): void
    {
        $this->attributes['country'] = $rawValue instanceof Country
            ? $rawValue->getCode()
            : $rawValue;

        $country = null;
        if (V::countryCode()->validate($rawValue) || $rawValue instanceof Country) {
            $country = !($rawValue instanceof Country)
                ? new Country($rawValue)
                : $rawValue;
        }

        // - Si le pays n'est pas valide, on ne va pas plus loin.
        if ($country === null) {
            return;
        }

        // - Numéro de téléphone
        $mainCountry = Config::getMainCountry();
        $rawPhone = $this->getAttributeFromArray('phone');
        if ($rawPhone !== null && !$mainCountry->isValidPhoneNumber($rawPhone, strict: false)) {
            $this->attributes['phone'] = (
                $country->isValidPhoneNumber($rawPhone, strict: false)
                    ? $country->normalizePhoneNumber($rawPhone)
                    : $rawPhone
            );
        }
    }

    // ------------------------------------------------------
    // -
    // -    Overwritten methods
    // -
    // ------------------------------------------------------

    public function fill(array $attributes)
    {
        // - On met le pays en premier dans la liste des attributs,
        //   s'il est présent, car il est utilisé par les setters
        //   de plusieurs autres champs.
        if (array_key_exists('country', $attributes)) {
            $countryCode = Arr::pull($attributes, 'country');
            $attributes = ['country' => $countryCode] + $attributes;
        }

        return parent::fill($attributes);
    }

    public function save(array $options = [])
    {
        if ($options['validate'] ?? true) {
            $enforceBuyerValidation = $options['enforceBuyerValidation'] ?? false;
            $this->validate($enforceBuyerValidation);
        }

        return parent::save(array_replace($options, [
            'validate' => false,
        ]));
    }

    public function validationErrors(bool $enforceBuyerValidation = false): array
    {
        try {
            $this->enforceBuyerValidation = $enforceBuyerValidation;
            return parent::validationErrors();
        } finally {
            $this->enforceBuyerValidation = false;
        }
    }

    public function isValid(bool $enforceBuyerValidation = false): bool
    {
        return count($this->validationErrors($enforceBuyerValidation)) === 0;
    }

    public function validate(bool $enforceBuyerValidation = false): static
    {
        $errors = $this->validationErrors($enforceBuyerValidation);
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

    protected array $orderable = [
        'full_name',
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
                ->orWhere('last_name', 'LIKE', $term)
                ->orWhere('first_name', 'LIKE', $term)
                ->orWhereRaw('CONCAT(last_name, \' \', first_name) LIKE ?', [$term])
                ->orWhereRaw('CONCAT(first_name, \' \', last_name) LIKE ?', [$term])
        ));
    }

    public function scopeCustomOrderBy(Builder $query, string $column, string $direction = 'asc'): Builder
    {
        Assert::inArray($direction, ['asc', 'desc'], "Invalid direction.");

        if ($column !== 'full_name') {
            return parent::scopeCustomOrderBy($query, $column, $direction);
        }

        return $query
            ->orderBy('last_name', $direction)
            ->orderBy('first_name', $direction);
    }

    // ------------------------------------------------------
    // -
    // -    Custom Methods
    // -
    // ------------------------------------------------------

    /**
     * Supprime la personne si celle-ci est "orpheline", c'est à dire sans bénéficiaire,
     * sans technicien ni utilisateur (sauf si $checkUser est passé à `false`).
     *
     * @param bool $checkUser Est-ce qu'on veut vérifier que la personne a un utilisateur lié ?
     *                        Dans le cas de la suppression d'un utilisateur, passer ce paramètre
     *                        à `false` pour pouvoir supprimer également son profil.
     */
    public function deleteIfOrphan(bool $checkUser = true): void
    {
        $BeneficiaryExists = $this->beneficiary()->withTrashed()->exists();
        $technicienExists = $this->technician()->withTrashed()->exists();
        $isOrphan = !$BeneficiaryExists && !$technicienExists;

        if ($checkUser) {
            $isOrphan = $isOrphan && $this->user_id === null;
        }

        if (!$isOrphan) {
            return;
        }

        $this->delete();
    }

    // ------------------------------------------------------
    // -
    // -    Serialization
    // -
    // ------------------------------------------------------

    public function serialize(): array
    {
        return (new DotArray($this->attributesForSerialization()))
            ->delete(['created_at', 'updated_at'])
            ->all();
    }
}
