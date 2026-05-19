<?php
declare(strict_types=1);

namespace Loxya\Models;

use Adbar\Dot as DotArray;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;
use Loxya\Config\Config;
use Loxya\Config\Enums\BillingMode;
use Loxya\Contracts\Serializable;
use Loxya\Models\Casts\AsCountry;
use Loxya\Models\Traits\Serializer;
use Loxya\Support\Address;
use Loxya\Support\Addressing\AddressField;
use Loxya\Support\Arr;
use Loxya\Support\Assert;
use Loxya\Support\Country;
use Loxya\Support\Validation\Validator as V;

/**
 * Société.
 *
 * @property-read ?int $id
 * @property string $legal_name
 * @property bool $is_public_entity
 * @property string|null $registration_id
 * @property string|null $vat_number
 * @property string|null $service_code
 * @property string|null $invoice_identifier
 * @property string|null $phone
 * @property string|null $street
 * @property string|null $additional_street
 * @property string|null $postal_code
 * @property string|null $administrative_area
 * @property string|null $locality
 * @property-read Address $address
 * @property Country $country
 * @property string|null $note
 * @property-read CarbonImmutable $created_at
 * @property-read CarbonImmutable|null $updated_at
 * @property-read CarbonImmutable|null $deleted_at
 *
 * @property-read Collection<array-key, Beneficiary> $beneficiaries
 *
 * @method static Builder|static search(string|string[] $term)
 */
final class Company extends BaseModel implements Serializable
{
    use Serializer;
    use SoftDeletes;

    protected $attributes = [
        'is_public_entity' => false,
    ];

    public function __construct(array $attributes = [])
    {
        parent::__construct($attributes);

        $this->validation = fn () => [
            'legal_name' => V::notEmpty()->length(2, 191),
            'is_public_entity' => V::boolType(),
            'registration_id' => V::custom([$this, 'checkRegistrationId']),
            'vat_number' => V::custom([$this, 'checkVatNumber']),
            'service_code' => V::nullable(V::alnum('-_/@')->length(null, 50)),
            'invoice_identifier' => V::custom([$this, 'checkInvoiceIdentifier']),
            'street' => V::custom([$this, 'checkStreet']),
            'additional_street' => V::custom([$this, 'checkAdditionalStreet']),
            'postal_code' => V::custom([$this, 'checkPostalCode']),
            'administrative_area' => V::custom([$this, 'checkAdministrativeArea']),
            'locality' => V::custom([$this, 'checkLocality']),
            'country' => V::notEmpty()->countryCode(),
            'phone' => V::custom([$this, 'checkPhone']),
        ];
    }

    // ------------------------------------------------------
    // -
    // -    Validation
    // -
    // ------------------------------------------------------

    public function checkRegistrationId(mixed $value)
    {
        V::nullable(V::stringVal()->length(null, 50))->check($value);

        // - Si le pays n'est pas valide, on ne peut pas aller plus loin.
        $countryCode = $this->getAttributeFromArray('country');
        if (!V::countryCode()->validate($countryCode)) {
            return true;
        }

        // - Si la valeur est vide, on vérifie si elle est requise pour la facturation.
        if ($value === null) {
            // - Si la facturation n'est pas activée, on n'impose pas le remplissage.
            if (Config::get('billingMode') === BillingMode::NONE) {
                return true;
            }

            $sellerCountry = Config::getOrganizationCountry();
            return !$sellerCountry->requireBuyerRegistrationId($countryCode)
                ?: 'mandatory-field';
        }

        // - Pour une entité publique, on exige l'identifiant le
        //   plus précis (ex. SIRET en France, pas SIREN).
        $isPublicEntity = (bool) $this->getAttributeFromArray('is_public_entity');
        return V::registrationId($countryCode, preciseOnly: $isPublicEntity);
    }

    public function checkVatNumber(mixed $value)
    {
        V::nullable(V::stringVal()->length(null, 50))->check($value);

        // - Si la valeur est vide, on ne va pas plus loin.
        if ($value === null) {
            return true;
        }

        // - Si le pays n'est pas valide, on ne peut pas aller plus loin.
        $countryCode = $this->getAttributeFromArray('country');
        if (!V::countryCode()->validate($countryCode)) {
            return true;
        }

        return V::vatNumber($countryCode);
    }

    public function checkInvoiceIdentifier(mixed $value)
    {
        V::nullable(V::stringVal())->check($value);

        // - Si la facturation est désactivée, ce champ doit être à `null`.
        $isBillingEnabled = Config::get('billingMode') !== BillingMode::NONE;
        if (!$isBillingEnabled) {
            return V::nullType();
        }

        // - S'il n'y a pas de facturation électronique prise en charge, le champ doit être à `null`.
        $sellerCountry = Config::getOrganizationCountry();
        if (!$sellerCountry->useElectronicInvoices()) {
            return V::nullType();
        }

        // - Si le pays n'est pas valide, on ne peut pas aller plus loin.
        $rawCountryCode = $this->getAttributeFromArray('country');
        $country = V::countryCode()->validate($rawCountryCode)
            ? new Country($rawCountryCode)
            : null;

        if ($country === null) {
            return true;
        }

        // - Si la valeur est vide, on vérifie si elle est requise.
        if ($value === null) {
            // - Si l'acheteur n'est pas dans le même pays, pas d'identifiant requis.
            if (!$sellerCountry->isSame($country, withInherited: true)) {
                return true;
            }

            // - Si l'identifiant ne peut pas être déduit, le champ est obligatoire.
            return $country->canInferDefaultInvoiceRoutingIdentifier() ?: 'mandatory-field';
        }

        return V::invoiceRoutingIdentifier($country);
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

        // - Si l'adresse n'est pas requise pour les acheteur dans le pays de
        //   l'organisation, on n'impose pas le remplissage.
        $sellerCountry = Config::getOrganizationCountry();
        if (!$sellerCountry->requireBuyerAddress(true)) {
            return true;
        }

        // - Si le pays n'est pas valide, on ne peut pas aller plus loin.
        $countryCode = $this->getAttributeFromArray('country');
        if (!V::countryCode()->validate($countryCode)) {
            return true;
        }

        $country = new Country($countryCode);
        return !($country)->isAddressFieldMandatory($field)
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

        // - Sinon, on considère le pays de l'entreprise.
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

    public function beneficiaries(): HasMany
    {
        return $this->hasMany(Beneficiary::class)
            ->orderBy('id');
    }

    // ------------------------------------------------------
    // -
    // -    Mutators
    // -
    // ------------------------------------------------------

    protected $appends = [
        'address',
    ];

    protected $casts = [
        'legal_name' => 'string',
        'is_public_entity' => 'boolean',
        'registration_id' => 'string',
        'vat_number' => 'string',
        'service_code' => 'string',
        'invoice_identifier' => 'string',
        'street' => 'string',
        'additional_street' => 'string',
        'postal_code' => 'string',
        'administrative_area' => 'string',
        'locality' => 'string',
        'country' => AsCountry::class,
        'phone' => 'string',
        'note' => 'string',
        'created_at' => 'immutable_datetime',
        'updated_at' => 'immutable_datetime',
        'deleted_at' => 'immutable_datetime',
    ];

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

    // ------------------------------------------------------
    // -
    // -    Setters
    // -
    // ------------------------------------------------------

    protected $fillable = [
        'legal_name',
        'is_public_entity',
        'registration_id',
        'vat_number',
        'service_code',
        'invoice_identifier',
        'street',
        'additional_street',
        'postal_code',
        'administrative_area',
        'locality',
        'country',
        'phone',
        'note',
    ];

    public function setRegistrationIdAttribute(mixed $rawValue): void
    {
        // - Si ce n'est pas une chaîne (`null` ou valeur invalide) => On ne va pas plus loin.
        if (!is_string($rawValue)) {
            $this->attributes['registration_id'] = $rawValue;
            return;
        }
        $rawValue = trim($rawValue);

        // - Si la valeur est vide, on ne va pas plus loin.
        if ($rawValue === '') {
            $this->attributes['registration_id'] = null;
            return;
        }

        $rawCountryCode = $this->getAttributeFromArray('country');
        $country = V::countryCode()->validate($rawCountryCode)
            ? new Country($rawCountryCode)
            : null;

        // - Si le pays n'est pas défini, on ne peut pas normaliser.
        if ($country === null) {
            $this->attributes['registration_id'] = $rawValue;
            return;
        }

        $this->attributes['registration_id'] = (
            $country->isValidCompanyIdentifier($rawValue)
                ? $country->normalizeCompanyIdentifier($rawValue)
                : $rawValue
        );
    }

    public function setVatNumberAttribute(mixed $rawValue): void
    {
        // - Si ce n'est pas une chaîne (`null` ou valeur invalide) => On ne va pas plus loin.
        if (!is_string($rawValue)) {
            $this->attributes['vat_number'] = $rawValue;
            return;
        }
        $rawValue = trim($rawValue);

        // - Si la valeur est vide, on ne va pas plus loin.
        if ($rawValue === '') {
            $this->attributes['vat_number'] = null;
            return;
        }

        $rawCountryCode = $this->getAttributeFromArray('country');
        $country = V::countryCode()->validate($rawCountryCode)
            ? new Country($rawCountryCode)
            : null;

        // - Si le pays n'est pas défini, on ne peut pas normaliser.
        if ($country === null) {
            $this->attributes['vat_number'] = $rawValue;
            return;
        }

        $this->attributes['vat_number'] = (
            $country->isValidVatNumber($rawValue)
                ? $country->normalizeVatNumber($rawValue)
                : $rawValue
        );
    }

    public function setInvoiceIdentifierAttribute(mixed $rawValue): void
    {
        // - Si ce n'est pas une chaîne (`null` ou valeur invalide) => On ne va pas plus loin.
        if (!is_string($rawValue)) {
            $this->attributes['invoice_identifier'] = $rawValue;
            return;
        }
        $rawValue = trim($rawValue);

        // - Si la valeur est vide, on ne va pas plus loin.
        if ($rawValue === '') {
            $this->attributes['invoice_identifier'] = null;
            return;
        }

        $rawCountryCode = $this->getAttributeFromArray('country');
        $country = V::countryCode()->validate($rawCountryCode)
            ? new Country($rawCountryCode)
            : null;

        // - Si le pays n'est pas défini, on ne peut pas normaliser.
        if ($country === null) {
            $this->attributes['invoice_identifier'] = $rawValue;
            return;
        }

        $this->attributes['invoice_identifier'] = (
            $country->isValidInvoiceRoutingIdentifier($rawValue)
                ? $country->normalizeInvoiceRoutingIdentifier($rawValue)
                : $rawValue
        );
    }

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

        // - Numéro d'enregistrement
        $rawRegistrationId = $this->getAttributeFromArray('registration_id');
        if ($rawRegistrationId !== null) {
            $this->attributes['registration_id'] = (
                $country->isValidCompanyIdentifier($rawRegistrationId)
                    ? $country->normalizeCompanyIdentifier($rawRegistrationId)
                    : $rawRegistrationId
            );
        }

        // - Numéro de T.V.A.
        $rawVatNumber = $this->getAttributeFromArray('vat_number');
        if ($rawVatNumber !== null) {
            $this->attributes['vat_number'] = (
                $country->isValidVatNumber($rawVatNumber)
                    ? $country->normalizeVatNumber($rawVatNumber)
                    : $rawVatNumber
            );
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

    // ------------------------------------------------------
    // -
    // -    Query Scopes
    // -
    // ------------------------------------------------------

    protected array $orderable = [
        'legal_name',
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

        $safeTerm = addcslashes($term, '%_');
        $normalizedTerm = Str::remove([' ', '-', '.'], $safeTerm);
        return $query->where(static fn (Builder $subQuery) => (
            $subQuery
                ->orWhere('legal_name', 'LIKE', sprintf('%%%s%%', $safeTerm))
                ->when(!empty($normalizedTerm), static fn (Builder $subQuery) => (
                    $subQuery
                        ->orWhereRaw(
                            "REPLACE(REPLACE(REPLACE(registration_id, ' ', ''), '-', ''), '.', '') LIKE ?",
                            [sprintf('%s%%', $normalizedTerm)],
                        )
                        ->orWhereRaw(
                            "REPLACE(REPLACE(REPLACE(vat_number, ' ', ''), '-', ''), '.', '') LIKE ?",
                            [sprintf('%s%%', $normalizedTerm)],
                        )
                ))
        ));
    }

    // ------------------------------------------------------
    // -
    // -    Serialization
    // -
    // ------------------------------------------------------

    public function serialize(): array
    {
        return (new DotArray($this->attributesForSerialization()))
            ->delete(['created_at', 'updated_at', 'deleted_at'])
            ->all();
    }
}
