<?php
declare(strict_types=1);

namespace Loxya\Models;

use Adbar\Dot as DotArray;
use Illuminate\Support\Str;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Loxya\Contracts\Serializable;
use Loxya\Models\Traits\Serializer;
use Psr\Http\Message\UploadedFileInterface;
use Loxya\Config\Config;

use Illuminate\Database\Eloquent\SoftDeletes;
use Loxya\Support\Validation\Validator as V;

/**
 * BillingCompany
 *
 * @property-read ?int $id
 * @property string $name
 * @property UploadedFileInterface|string|null $logo
 * @property-read string|null $logo_real_path
 * @property string $street
 * @property string $postal_code
 * @property string $locality
 * @property int $country_id
 * @property string|null $phone
 * @property string|null $email
 * @property string|null $website
 * @property string|null $vat_number
 * @property string|null $code1_label
 * @property string|null $code1_value
 * @property string|null $code2_label
 * @property string|null $code2_value
 * @property-read Country $country
 * @property-read CarbonImmutable $created_at
 * @property-read CarbonImmutable|null $updated_at
 * @property-read CarbonImmutable|null $deleted_at
 *
 * @method static Builder|static search(string|string[] $term)
 */

final class BillingCompany extends BaseModel implements Serializable
{
  use Serializer;
  use SoftDeletes;

  private const LOGO_BASEPATH = (
    DATA_FOLDER . DS . 'billing_companies' . DS . 'logo'
  );

  // Build the default BillingCompany from the config file.
  public static function defaultBillingCompany(): BillingCompany
  {
    $company = Config::get('companyData');

    $country = Country::where('code', $company['country'])->first();

    $sellerInfo = [
      'name' => $company['name'],
      'street' => $company['street'],
      'zip_code' => $company['zipCode'],
      'locality' => $company['locality'],
      'country_id' => $country?->id,
      'phone' => $company['phone'] ?? null,
      'email' => $company['email'] ?? null,
      'vat_number' => $company['vatNumber'] ?? null,
      'code1_label' => count($company['legalNumbers']) > 0 ? $company['legalNumbers'][0]['name'] : null,
      'code1_value' => count($company['legalNumbers']) > 0 ? $company['legalNumbers'][0]['value'] : null,
      'code2_label' => count($company['legalNumbers']) > 1 ? $company['legalNumbers'][1]['name'] : null,
      'code2_value' => count($company['legalNumbers']) > 1 ? $company['legalNumbers'][1]['value'] : null,
    ];

    if ($company['logo']) {
      $sellerInfo['logo'] = Config::getBaseUrl() . "/img/" . $company["logo"];
    }

    return BillingCompany::make($sellerInfo);
  }

  public function __construct(array $attributes = [])
  {
    parent::__construct($attributes);

    $this->validation = fn() => [
      'name' => V::notEmpty()->length(2, 191),
      'logo' => V::custom([$this, 'checkLogo']),
      'street' => V::notEmpty()->length(2, 191),
      'postal_code' => V::notEmpty()->length(2, 10),
      'locality' => V::notEmpty()->length(2, 191),
      'country_id' => V::custom([$this, 'checkCountryId']),
      'phone' => V::optional(V::phone()),
      'email' => V::optional(V::email()->length(null, 191)),
      'website' => V::optional(V::url()->length(null, 191)),
      'vat_number' => V::optional(V::length(null, 50)),
      'code1_label' => V::optional(V::length(null, 50)),
      'code1_value' => V::optional(V::length(null, 191)),
      'code2_label' => V::optional(V::length(null, 50)),
      'code2_value' => V::optional(V::length(null, 191))
    ];
  }

  // ----------------------------------------------------------------
  // -
  // - Validations
  // -
  // ----------------------------------------------------------------

  public function checkCountryId($value): bool
  {
    V::intVal()->check($value);
    return $value !== null
      ? Country::includes(id: $value) : false;
  }

  public function checkLogo($value): bool|string
  {
    if (empty($value)) {
      return true;
    }

    if (is_string($value)) {
      V::length(5, 227)->check($value);
      return true;
    }

    if (!($value instanceof UploadedFileInterface)) {
      return false;
    }

    /** @var UploadedFileInterface $value */

    if (in_array($value->getError(), [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE])) {
      return 'file-exceeded-max-size';
    }

    if ($value->getError() == UPLOAD_ERR_NO_FILE) {
      return 'no-uploaded-file';
    }

    if ($value->getError() !== UPLOAD_ERR_OK) {
      return 'upload-failed';
    }

    if ($value->getSize() > Config::get('maxFileUploadSize')) {
      return 'file-exceeded-max-size';
    }

    $pictureType = $value->getClientMediaType();
    if (!in_array($pictureType, Config::get('authorizedImageTypes'))) {
      return 'file-type-not-allowed';
    }

    return true;
  }

  // --------------------------------------------------------------
  // -
  // - Relations
  // -
  // --------------------------------------------------------------

  public function country(): BelongsTo
  {
    return $this->belongsTo(Country::class);
  }

  // ----------------------------------------------------------------
  // -
  // - Mutators
  // -
  // ----------------------------------------------------------------

  protected $appends = [
    'full_address',
  ];

  protected $casts = [
    'name' => 'string',
    'street' => 'string',
    'postal_code' => 'string',
    'locality' => 'string',
    'country_id' => 'integer',
    'phone' => 'string',
    'email' => 'string',
    'website' => 'string',
    'vat_number' => 'string',
    'code1_label' => 'string',
    'code1_value' => 'string',
    'code2_label' => 'string',
    'code2_value' => 'string',
    'created_at' => 'immutable_datetime',
    'updated_at' => 'immutable_datetime',
    'deleted_at' => 'immutable_datetime',
  ];

  public function getFullAddressAttribute(): string
  {
    $addressParts = [];

    $addressParts[] = trim($this->street ?? '');
    $addressParts[] = implode(' ', array_filter([
      trim($this->postal_code ?? ''),
      trim($this->locality ?? '')
    ]));

    $addressParts = array_filter($addressParts);
    return !empty($addressParts) ? implode("\n", $addressParts) : null;
  }

  public function getCountryAttribute(): Country|null
  {
    return $this->getRelationValue('country');
  }

  public function getLogoAttribute($value): UploadedFileInterface|string|null
  {
    if (!$value || $value instanceof UploadedFileInterface) {
      return $value;
    }

    if (!$this->exists) { // If the company is not saved yet, the logo cannot exist.
      return null;
    }

    // If the logo starts with Config::getBaseUrl() return the url as is.
    if (str_starts_with($value, Config::getBaseUrl())) {
      return $value;
    }

    // If the logo is not a valid URL, return the local path.
    return (string) Config::getBaseUri()->withPath(sprintf("/static/billing-companies/%s/logo", $this->id));
  }

  public function getLogoRealPathAttribute(): string|null
  {
    $logo = $this->getAttributeFromArray('logo');
    if (empty($logo)) {
      return null;
    }

    // If the logo was just uploaded, it is not yet moved to its final location.
    if ($logo instanceof UploadedFileInterface) {
      throw new \LogicException("Unable to retrieve logo path before having persisted it.");
    }

    return static::LOGO_BASEPATH . DS . $logo;
  }

  // --------------------------------------------------------------
  // -
  // - Setters
  // -
  // --------------------------------------------------------------

  protected $fillable = [
    'name',
    'street',
    'postal_code',
    'locality',
    'country_id',
    'phone',
    'email',
    'website',
    'vat_number',
    'code1_label',
    'code1_value',
    'code2_label',
    'code2_value',
    'logo',
  ];

  public function setPhoneAttribute(string|null $value): void
  {
    $value = !empty($value) && is_string($value)
      ? Str::remove(' ', trim($value))
      : $value;

    $this->attributes['phone'] = $value === '' ? null : $value;
  }

  // --------------------------------------------------------------
  // -
  // - Serialization
  // -
  // --------------------------------------------------------------

  public function serialize(): array
  {
    $company = tap(clone $this, static function (BillingCompany $company): void {
      $company->append(['country']);
    });
    return (new DotArray($company->attributesForSerialization()))
      ->delete(['created_at', 'updated_at', 'deleted_at'])
      ->all();
  }

  // --------------------------------------------------------------
  // -
  // -  Overwitten methods
  // -
  // --------------------------------------------------------------
  public function save(array $options = []): bool
  {
    $hasLogoChanged = $this->isDirty('logo');

    if (!$hasLogoChanged) {
      return parent::save($options);
    }

    if ($options['validate'] ?? true) {
      $this->validate();
    }

    $options = array_replace($options, ['validate' => false]);

    $previousLogo = $this->getOriginal('logo');
    $newLogo = $this->getAttributeFromArray('logo');

    $isFileUpload = $newLogo instanceof UploadedFileInterface;

    // If this is not a file upload nor a picture deletion, check that the file exists.
    if (!empty($newLogo) && !$isFileUpload) {
      if (!is_string($newLogo)) {
        throw new \RuntimeException(
          "An error occured while uploading the image:" .
          "The image format to be uploaded is not supported",
        );
      }

      if (!@file_exists(static::LOGO_BASEPATH . DS . $newLogo)) {
        throw new \RuntimeException(
          "An error occured while uploading the image:" .
          "The string passed does not correspond to an existing file in the destination folder",
        );
      }
    }

    // If it's an upload, move it to the correct path
    if ($isFileUpload) {
      /** @var UploadedFileInterface $newLogo */
      $extension = pathinfo($newLogo->getClientFilename(), PATHINFO_EXTENSION);
      $filename = sprintf("%s.%s", (string) Str::uuid(), $extension);

      if (!is_dir(static::LOGO_BASEPATH)) {
        mkdir(static::LOGO_BASEPATH, 0777, true);
      }

      try {
        $newLogo->moveTo(static::LOGO_BASEPATH . DS . $filename);
      } catch (\Throwable) {
        throw new \Exception(
          "An error occured while uploading the image: " .
          "The image could not be moved to the destination folder.",
        );
      }

      $this->logo = $filename;
    }

    $rollbackUpload = function () use ($isFileUpload, $newLogo): void {
      if (!$isFileUpload) {
        return;
      }

      try {
        $filename = $this->getAttributeFromArray('logo');
        @unlink(static::LOGO_BASEPATH . DS . $filename);
      } catch (\Throwable) {
        // We do not care if the unlink fails.
      }

      $this->logo = $newLogo;
    };

    try {
      $saved = parent::save($options);
    } catch (\Throwable $e) {
      $rollbackUpload();
      throw $e;
    }

    if (!$saved) {
      $rollbackUpload();
      return false;
    }

    // The upload worked, delete the old picture if it exists.

    if ($previousLogo !== null) {
      try {
        @unlink(static::LOGO_BASEPATH . DS . $previousLogo);
      } catch (\Throwable) {
        // We do not care if the unlink fails.
      }
    }

    return true;
  }

  public function delete(): bool
  {
    if (!$this->exists) {
      return true;
    }

    $deleted = parent::delete();
    $filename = $this->getAttributeFromArray('logo');

    if ($this->forceDeleting && $deleted && !empty($filename)) {
      try {
        @unlink(static::LOGO_BASEPATH . DS . $filename);
      } catch (\Throwable) {
        // We do not care if the unlink fails.
      }
    }

    return $deleted;
  }
}
