<?php
declare(strict_types=1);

namespace Loxya\Models;

use Adbar\Dot as DotArray;
use Brick\Math\BigDecimal as Decimal;
use Brick\Math\RoundingMode;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Collection as CoreCollection;
use Loxya\Config\Config;
use Loxya\Contracts\Pdfable;
use Loxya\Contracts\Serializable;
use Loxya\Models\Casts\AsCountry;
use Loxya\Models\Casts\AsDecimal;
use Loxya\Models\Enums\BillingFormat;
use Loxya\Models\Enums\BillingType;
use Loxya\Models\Enums\EstimateStatus;
use Loxya\Models\Enums\LegalEntityType;
use Loxya\Models\Traits\Serializer;
use Loxya\Services\I18n;
use Loxya\Support\Address;
use Loxya\Support\Addressing\AddressField;
use Loxya\Support\Arr;
use Loxya\Support\Assert;
use Loxya\Support\Collections\MaterialsCollection;
use Loxya\Support\Country;
use Loxya\Support\Data\LegalType\LegalTypeFactory;
use Loxya\Support\Data\LegalType\LegalTypeInterface;
use Loxya\Support\Invoicing\BuyerInterface;
use Loxya\Support\Invoicing\LegalMention;
use Loxya\Support\Invoicing\PaymentMethod;
use Loxya\Support\Invoicing\TaxRegime;
use Loxya\Support\Invoicing\VatExemptionCode\VatExemptionCodeFactory;
use Loxya\Support\Invoicing\VatExemptionCode\VatExemptionCodeInterface;
use Loxya\Support\Pdf\Document as PdfDocument;
use Loxya\Support\Pdf\PdfInterface;
use Loxya\Support\Pdf\RawPdf;
use Loxya\Support\Period;
use Loxya\Support\Str;
use Loxya\Support\Validation\Rules\SchemaStrict;
use Loxya\Support\Validation\ValidationsException;
use Loxya\Support\Validation\Validator as V;
use Respect\Validation\Rules as Rule;

/**
 * Devis.
 *
 * // - Tax type.
 * @phpstan-type TaxDataSpecial array{
 *     type: value-of<TaxRegime>,
 *     reason: list<string>,
 *     base: Decimal,
 * }
 * @phpstan-type TaxDataStandard array{
 *     type: value-of<TaxRegime>,
 *     name?: string,
 *     value: Decimal,
 *     base: Decimal,
 *     total: Decimal,
 * }
 * @phpstan-type TaxDataLegacy array{
 *     name: string,
 *     is_rate: bool,
 *     value: Decimal,
 *     total: Decimal,
 * }
 * @phpstan-type TaxData TaxDataSpecial|TaxDataStandard|TaxDataLegacy
 *
 * // - Discount type.
 * @phpstan-type TaxDataSpecialDiscount array{
 *     type: value-of<TaxRegime>,
 *     reason: list<string>,
 * }
 * @phpstan-type TaxDataStandardDiscount array{
 *     type: value-of<TaxRegime>,
 *     name?: string,
 *     value: Decimal,
 * }
 * @phpstan-type TaxDataDiscount TaxDataSpecialDiscount|TaxDataStandardDiscount
 * @phpstan-type DiscountData array{
 *    base: Decimal,
 *    value: Decimal,
 *    total: Decimal,
 *    tax: TaxDataDiscount,
 * }
 *
 * @property-read ?int $id
 * @property-read string $uuid
 * @property-read BillingType $type
 * @property value-of<BillingFormat> $format
 * @property value-of<EstimateStatus> $status
 * @property string|null $number
 * @property CarbonImmutable|null $date
 * @property string|null $due_date
 * @property int|null $due_delay
 * @property-read ?string $path
 * @property-read ?string $url
 * @property string $seller_legal_name
 * @property string|null $seller_registration_id
 * @property string|null $seller_vat_number
 * @property value-of<LegalTypeInterface>|null $seller_legal_type
 * @property Decimal|null $seller_share_capital
 * @property string|null $seller_activity_code
 * @property string|null $seller_trade_registry_city
 * @property string|null $seller_street
 * @property string|null $seller_additional_street
 * @property string|null $seller_postal_code
 * @property string|null $seller_administrative_area
 * @property string|null $seller_locality
 * @property-read Address $seller_address
 * @property Country $seller_country
 * @property string|null $seller_email
 * @property string|null $seller_phone
 * @property int $buyer_id
 * @property-read Beneficiary $buyer
 * @property value-of<LegalEntityType> $buyer_type
 * @property string|null $buyer_reference
 * @property string|null $buyer_legal_name
 * @property bool $buyer_is_public_entity
 * @property string|null $buyer_registration_id
 * @property string|null $buyer_vat_number
 * @property string|null $buyer_service_code
 * @property string|null $buyer_first_name
 * @property string|null $buyer_last_name
 * @property-read string|null $buyer_full_name
 * @property string|null $buyer_street
 * @property string|null $buyer_additional_street
 * @property string|null $buyer_postal_code
 * @property string|null $buyer_administrative_area
 * @property string|null $buyer_locality
 * @property-read Address $buyer_address
 * @property Country $buyer_country
 * @property string|null $buyer_email
 * @property string|null $buyer_phone
 * @property string|null $booking_type
 * @property int|null $booking_id
 * @property-read Event|null $booking
 * @property string|null $booking_title
 * @property string|null $booking_reference
 * @property CarbonImmutable|null $booking_start_date
 * @property CarbonImmutable|null $booking_end_date
 * @property bool|null $booking_is_full_days
 * @property Period|null $booking_period
 * @property-read bool $is_draft
 * @property-read bool $is_obsolete
 * @property-read bool $has_final_invoice
 * @property bool $is_vat_due_on_invoice
 * @property Decimal|null $degressive_rate
 * @property Decimal|null $daily_total
 * @property Decimal $total_without_global_discount
 * @property Decimal $global_discount_rate
 * @property list<DiscountData> $global_discount_breakdown
 * @property Decimal $total_global_discount
 * @property Decimal $total_without_taxes
 * @property value-of<TaxRegime>|null $global_tax_regime
 * @property value-of<VatExemptionCodeInterface>|null $global_tax_exemption_code
 * @property string|null $global_tax_exemption_reason
 * @property list<TaxData>|null $total_taxes
 * @property Decimal $total_with_taxes
 * @property Decimal|null $total_replacement
 * @property string|null $special_mentions
 * @property string $currency
 * @property string $lang
 * @property int|null $author_id
 * @property array $metadata
 * @property-read bool $is_used
 * @property-read User|null $author
 * @property-read CarbonImmutable $created_at
 * @property-read CarbonImmutable|null $updated_at
 * @property-read CarbonImmutable|null $deleted_at
 *
 * @property-read Collection<array-key, EstimateMaterial> $materials
 * @property-read Collection<array-key, EstimateExtra> $extras
 * @property-read Collection<array-key, Property> $totalisable_properties
 * @property-read Collection<array-key, Invoice> $relatedInvoices
 * @property-read Collection<array-key, Invoice> $related_invoices
 *
 * @method static Builder|static search(string|string[] $term)
 * @method static Builder|static withStatus(EstimateStatus[] | EstimateStatus $status)
 */
final class Estimate extends BaseModel implements Serializable, Pdfable, BuyerInterface
{
    use Serializer;
    use SoftDeletes;

    // - Types de sérialisation.
    public const SERIALIZE_EXCERPT = 'excerpt';
    public const SERIALIZE_DEFAULT = 'default';
    public const SERIALIZE_DETAILS = 'details';

    private const PDF_BASEPATH = (
        DATA_FOLDER . DS . 'estimates'
    );

    public function __construct(array $attributes = [])
    {
        $attributes['uuid'] ??= (string) Str::uuid();
        $attributes['format'] ??= BillingFormat::current()->value;
        $attributes['status'] ??= EstimateStatus::DRAFT->value;
        parent::__construct($attributes);

        $this->validation = fn () => [
            'uuid' => V::custom([$this, 'checkUuid']),
            'format' => V::enumValue(BillingFormat::class),
            'status' => V::custom([$this, 'checkStatus']),
            'number' => V::custom([$this, 'checkNumber']),
            'date' => V::custom([$this, 'checkDate']),
            'due_date' => V::custom([$this, 'checkDueDate']),
            'due_delay' => V::custom([$this, 'checkDueDelay']),
            'seller_legal_name' => V::notEmpty()->length(2, 100),
            'seller_registration_id' => V::custom([$this, 'checkSellerRegistrationId']),
            'seller_vat_number' => V::custom([$this, 'checkSellerVatNumber']),
            'seller_legal_type' => V::custom([$this, 'checkSellerLegalType']),
            'seller_share_capital' => V::custom([$this, 'checkSellerShareCapital']),
            'seller_activity_code' => V::custom([$this, 'checkSellerActivityCode']),
            'seller_trade_registry_city' => V::nullable(V::stringVal()->length(null, 50)),
            'seller_street' => V::custom([$this, 'checkSellerStreet']),
            'seller_additional_street' => V::custom([$this, 'checkSellerAdditionalStreet']),
            'seller_postal_code' => V::custom([$this, 'checkSellerPostalCode']),
            'seller_administrative_area' => V::custom([$this, 'checkSellerAdministrativeArea']),
            'seller_locality' => V::custom([$this, 'checkSellerLocality']),
            'seller_country' => V::notEmpty()->countryCode(),
            'seller_email' => V::nullable(V::email()),
            'seller_phone' => V::custom([$this, 'checkSellerPhone']),
            'buyer_id' => V::custom([$this, 'checkBuyerId']),
            'buyer_type' => V::enumValue(LegalEntityType::class),
            'buyer_reference' => V::nullable(V::length(null, 191)),
            'buyer_legal_name' => V::custom([$this, 'checkBuyerLegalName']),
            'buyer_is_public_entity' => V::custom([$this, 'checkBuyerIsPublicEntity']),
            'buyer_registration_id' => V::custom([$this, 'checkBuyerRegistrationId']),
            'buyer_vat_number' => V::custom([$this, 'checkBuyerVatNumber']),
            'buyer_first_name' => V::custom([$this, 'checkBuyerFirstName']),
            'buyer_last_name' => V::custom([$this, 'checkBuyerLastName']),
            'buyer_street' => V::custom([$this, 'checkBuyerStreet']),
            'buyer_additional_street' => V::custom([$this, 'checkBuyerAdditionalStreet']),
            'buyer_postal_code' => V::custom([$this, 'checkBuyerPostalCode']),
            'buyer_administrative_area' => V::custom([$this, 'checkBuyerAdministrativeArea']),
            'buyer_locality' => V::custom([$this, 'checkBuyerLocality']),
            'buyer_country' => V::notEmpty()->countryCode(),
            'buyer_email' => V::nullable(V::email()),
            'buyer_phone' => V::custom([$this, 'checkBuyerPhone']),
            'booking_type' => V::custom([$this, 'checkBookingType']),
            'booking_id' => V::custom([$this, 'checkBookingId']),
            'booking_title' => V::custom([$this, 'checkBookingTitle']),
            'booking_reference' => V::custom([$this, 'checkBookingReference']),
            'booking_start_date' => V::custom([$this, 'checkBookingStartDate']),
            'booking_end_date' => V::custom([$this, 'checkBookingEndDate']),
            'booking_is_full_days' => V::custom([$this, 'checkBookingIsFullDays']),
            'is_vat_due_on_invoice' => V::boolType(),
            'degressive_rate' => V::custom([$this, 'checkDegressiveRate']),
            'daily_total' => V::custom([$this, 'checkDailyTotal']),
            'global_discount_rate' => V::custom([$this, 'checkGlobalDiscountRate']),
            'global_discount_breakdown' => V::custom([$this, 'checkGlobalDiscountBreakdown']),
            'total_without_global_discount' => V::custom([$this, 'checkAmount']),
            'total_global_discount' => V::custom([$this, 'checkAmount'], false),
            'total_without_taxes' => V::custom([$this, 'checkAmount']),
            'global_tax_regime' => V::custom([$this, 'checkGlobalTaxRegime']),
            'global_tax_exemption_code' => V::custom([$this, 'checkGlobalTaxExemptionCode']),
            'global_tax_exemption_reason' => V::custom([$this, 'checkGlobalTaxExemptionReason']),
            'total_taxes' => V::custom([$this, 'checkTotalTaxes']),
            'total_with_taxes' => V::custom([$this, 'checkAmount']),
            'total_replacement' => V::nullable(V::custom([$this, 'checkAmount'], false)),
            'special_mentions' => V::nullable(V::stringType()),
            'currency' => V::custom([$this, 'checkCurrency']),
            'lang' => V::nullable(V::in(array_keys(I18n::AVAILABLE_LANGUAGES))),
            'author_id' => V::custom([$this, 'checkAuthorId']),
            'metadata' => V::custom([$this, 'checkMetadata']),
        ];
    }

    // ------------------------------------------------------
    // -
    // -    Validation
    // -
    // ------------------------------------------------------

    public function checkUuid(mixed $value)
    {
        V::notEmpty()->uuid(4)->check($value);

        $alreadyExists = static::query()
            ->where('uuid', $value)
            ->when($this->exists, fn (Builder $subQuery) => (
                $subQuery->where('id', '!=', $this->id)
            ))
            ->exists();

        return !$alreadyExists;
    }

    public function checkStatus(mixed $value)
    {
        $isValid = V::create()
            ->in([
                EstimateStatus::DRAFT->value,
                EstimateStatus::PENDING->value,
                EstimateStatus::SENT->value,
                EstimateStatus::ACCEPTED->value,
                EstimateStatus::REJECTED->value,
            ])
            ->validate($value);

        if (!$isValid) {
            return false;
        }

        // - Si le statut n'a pas changé, on ne valide pas plus loin.
        if ($this->exists && !$this->isDirty('status')) {
            return true;
        }

        // - Une fois finalisé, un devis ne peut plus revenir à l'état "brouillon".
        if ($value === EstimateStatus::DRAFT->value && $this->exists) {
            return $this->getOriginal('status') === EstimateStatus::DRAFT->value;
        }

        // - Si le devis a des factures enfant, seul le statut "accepté" est autorisé.
        if ($this->exists && $this->related_invoices->isNotEmpty()) {
            return $value === EstimateStatus::ACCEPTED->value;
        }

        return true;
    }

    public function checkDate()
    {
        // - Un brouillon n'a pas de date d'émission.
        $statusRaw = $this->getAttributeUnsafeValue('status');
        return $statusRaw !== EstimateStatus::DRAFT->value
            ? V::notEmpty()->dateTime()
            : V::nullType();
    }

    public function checkNumber(mixed $value)
    {
        $formatRaw = $this->getAttributeUnsafeValue('format');
        $format = !V::enumValue(BillingFormat::class)->validate($formatRaw)
            ? BillingFormat::current()->value
            : $formatRaw;

        // - Les anciens formats n'ont pas de numéro de devis.
        if ($format < BillingFormat::V3->value) {
            return V::nullType();
        }

        // - Un brouillon n'a pas de numéro.
        $statusRaw = $this->getAttributeUnsafeValue('status');
        if ($statusRaw === EstimateStatus::DRAFT->value) {
            return V::nullType();
        }

        V::notEmpty()
            ->length(4, 20)
            ->check($value);

        $alreadyExists = static::query()
            ->where('number', $value)
            ->when($this->exists, fn (Builder $subQuery) => (
                $subQuery->where('id', '!=', $this->id)
            ))
            ->withTrashed()
            ->exists();

        return !$alreadyExists ?: 'estimate-number-already-in-use';
    }

    public function checkDueDate(mixed $value)
    {
        V::nullable(V::date())->check($value);

        if ($value === null) {
            $formatRaw = $this->getAttributeUnsafeValue('format');
            $format = !V::enumValue(BillingFormat::class)->validate($formatRaw)
                ? BillingFormat::current()->value
                : $formatRaw;

            // - Si c'est un ancien format, on bypass la validation stricte.
            if ($format < BillingFormat::V3->value) {
                return true;
            }

            // - Sinon, il faut au moins une des deux informations de
            //   conditions de validité (date ou délai).
            $dueDaysRaw = $this->getAttributeUnsafeValue('due_delay');
            return $dueDaysRaw !== null ?: 'due-date-or-due-delay-required';
        }
        $dueDate = (new CarbonImmutable($value))->endOfDay();

        // - Si la date du devis est absente (brouillon) ou invalide,
        //   on ne peut pas aller plus loin sur la cohérence relative.
        $dateRaw = $this->getAttributeUnsafeValue('date');
        if ($dateRaw === null || !V::datetime()->validate($dateRaw)) {
            return true;
        }

        return $dueDate->greaterThanOrEqualTo($dateRaw)
            ?: 'due-date-must-be-after-estimate-date';
    }

    public function checkDueDelay(mixed $value)
    {
        V::nullable(V::intVal()->min(1))->check($value);

        // - Si une date explicite est définie, le champ due_delay ne doit pas l'être.
        $dueDateRaw = $this->getAttributeUnsafeValue('due_date');
        return $dueDateRaw === null ?: V::nullType();
    }

    public function checkSellerRegistrationId(mixed $value)
    {
        V::nullable(V::stringVal()->length(null, 50))->check($value);

        $formatRaw = $this->getAttributeUnsafeValue('format');
        $format = !V::enumValue(BillingFormat::class)->validate($formatRaw)
            ? BillingFormat::current()->value
            : $formatRaw;

        // - Si c'est un ancien format, on bypass la validation stricte.
        if ($format < BillingFormat::V3->value) {
            return true;
        }

        // - Si le pays n'est pas valide, on ne peut pas aller plus loin.
        $sellerCountryCode = $this->getAttributeFromArray('seller_country');
        if (!V::countryCode()->validate($sellerCountryCode)) {
            return true;
        }
        $sellerCountry = new Country($sellerCountryCode);

        // - Si la valeur est `null` et que le numéro d'enregistrement n'est pas requis pour
        //   les vendeurs dans le pays de l'organisation, on n'impose pas le remplissage.
        if ($value === null && !$sellerCountry->requireSellerRegistrationId()) {
            return true;
        }

        return V::notEmpty()->registrationId($sellerCountry, preciseOnly: true);
    }

    public function checkSellerVatNumber(mixed $value)
    {
        V::nullable(V::stringVal()->length(null, 50))->check($value);

        if ($value === null) {
            return true;
        }

        $formatRaw = $this->getAttributeUnsafeValue('format');
        $format = !V::enumValue(BillingFormat::class)->validate($formatRaw)
            ? BillingFormat::current()->value
            : $formatRaw;

        // - Si c'est un ancien format, on bypass la validation stricte.
        if ($format < BillingFormat::V3->value) {
            return true;
        }

        // - Si le pays n'est pas valide, on ne peut pas aller plus loin.
        $sellerCountryCode = $this->getAttributeFromArray('seller_country');
        if (!V::countryCode()->validate($sellerCountryCode)) {
            return true;
        }

        return V::vatNumber($sellerCountryCode);
    }

    public function checkSellerLegalType(mixed $value)
    {
        V::nullable(V::stringVal())->check($value);

        if ($value === null) {
            return true;
        }

        $rawSellerCountryCode = $this->getAttributeFromArray('seller_country');
        $sellerCountry = V::countryCode()->validate($rawSellerCountryCode)
            ? new Country($rawSellerCountryCode)
            : null;

        // - Si le pays n'est pas valide, on ne peut pas aller plus loin.
        if ($sellerCountry === null) {
            return true;
        }

        return V::in(array_map(
            static fn ($type) => $type->value,
            $sellerCountry->getLegalTypes(),
        ));
    }

    public function checkSellerShareCapital(mixed $value)
    {
        V::nullable(V::floatVal())->check($value);
        $value = $value !== null ? Decimal::of($value) : null;

        if ($value === null) {
            return true;
        }

        return (
            $value->isGreaterThanOrEqualTo(0) &&
            $value->isLessThan(1_000_000_000_000) &&
            $value->getScale() <= 2
        );
    }

    public function checkSellerActivityCode(mixed $value)
    {
        V::nullable(V::stringVal()->length(null, 30))->check($value);

        if ($value === null) {
            return true;
        }

        // - Si le pays n'est pas valide, on ne peut pas aller plus loin.
        $sellerCountryCode = $this->getAttributeFromArray('seller_country');
        if (!V::countryCode()->validate($sellerCountryCode)) {
            return true;
        }

        return V::activityCode($sellerCountryCode);
    }

    public function checkSellerStreet()
    {
        return V::create()
            ->nullable(V::length(null, 191))
            ->custom(
                [$this, 'checkSellerAddressField'],
                AddressField::ADDRESS_LINE1,
            );
    }

    public function checkSellerAdditionalStreet()
    {
        return V::create()
            ->nullable(V::length(null, 191))
            ->custom(
                [$this, 'checkSellerAddressField'],
                AddressField::ADDRESS_LINE2,
            );
    }

    public function checkSellerPostalCode(mixed $value)
    {
        V::create()
            ->nullable(V::length(null, 10))
            ->custom(
                [$this, 'checkSellerAddressField'],
                AddressField::POSTAL_CODE,
            )
            ->check($value);

        // - Si la valeur est nulle, on ne va pas plus loin.
        if ($value === null) {
            return true;
        }

        $formatRaw = $this->getAttributeUnsafeValue('format');
        $format = !V::enumValue(BillingFormat::class)->validate($formatRaw)
            ? BillingFormat::current()->value
            : $formatRaw;

        // - Si c'est un ancien format, on bypass la validation stricte.
        if ($format < BillingFormat::V3->value) {
            return true;
        }

        // - Si le pays n'est pas valide, on ne peut pas aller plus loin.
        $sellerCountryCode = $this->getAttributeFromArray('seller_country');
        if (!V::countryCode()->validate($sellerCountryCode)) {
            return true;
        }

        return V::postalCode($sellerCountryCode);
    }

    public function checkSellerAdministrativeArea()
    {
        return V::create()
            ->nullable(V::length(null, 191))
            ->custom(
                [$this, 'checkSellerAddressField'],
                AddressField::ADMINISTRATIVE_AREA,
            );
    }

    public function checkSellerLocality()
    {
        return V::create()
            ->nullable(V::length(null, 191))
            ->custom(
                [$this, 'checkSellerAddressField'],
                AddressField::LOCALITY,
            );
    }

    public function checkSellerAddressField(mixed $value, AddressField $field)
    {
        // - Si la valeur est non nulle, on est bon.
        if ($value !== null) {
            return true;
        }

        $formatRaw = $this->getAttributeUnsafeValue('format');
        $format = !V::enumValue(BillingFormat::class)->validate($formatRaw)
            ? BillingFormat::current()->value
            : $formatRaw;

        // - Si c'est un ancien format, on bypass la validation stricte.
        if ($format < BillingFormat::V3->value) {
            return true;
        }

        // - Si le pays n'est pas valide, on ne peut pas aller plus loin.
        $sellerCountryCode = $this->getAttributeFromArray('seller_country');
        if (!V::countryCode()->validate($sellerCountryCode)) {
            return true;
        }

        $sellerCountry = new Country($sellerCountryCode);
        return !$sellerCountry->isAddressFieldMandatory($field)
            ?: 'mandatory-field';
    }

    public function checkSellerPhone(mixed $value)
    {
        V::nullable(V::phone())->check($value);

        // - Si la valeur est vide, on ne va pas plus loin.
        if ($value === null) {
            return true;
        }

        $formatRaw = $this->getAttributeUnsafeValue('format');
        $format = !V::enumValue(BillingFormat::class)->validate($formatRaw)
            ? BillingFormat::current()->value
            : $formatRaw;

        // - Si c'est un ancien format, on bypass la validation stricte.
        if ($format < BillingFormat::V3->value) {
            return true;
        }

        // - Si le pays n'est pas valide, on ne peut pas aller plus loin.
        $sellerCountryCode = $this->getAttributeFromArray('seller_country');
        if (!V::countryCode()->validate($sellerCountryCode)) {
            return true;
        }

        return V::phone($sellerCountryCode);
    }

    public function checkBuyerId(mixed $value)
    {
        V::notEmpty()->intVal()->check($value);

        $buyer = Beneficiary::withTrashed()->find($value);
        if (!$buyer) {
            return false;
        }

        return !$this->exists || $this->isDirty('buyer_id')
            ? !$buyer->trashed()
            : true;
    }

    public function checkBuyerLegalName(mixed $value)
    {
        V::nullable(V::length(2, 191))->check($value);

        // - Si le type n'est pas valide, on ne peut pas aller plus loin.
        $rawBuyerType = $this->getAttributeFromArray('buyer_type');
        if (!V::enumValue(LegalEntityType::class)->validate($rawBuyerType)) {
            return true;
        }

        // - Si c'est un particulier, il ne doit pas y avoir de raison
        //   sociale, sinon, la raison sociale est obligatoire.
        return $rawBuyerType === LegalEntityType::INDIVIDUAL->value
            ? V::nullType()
            : V::notEmpty();
    }

    public function checkBuyerIsPublicEntity(mixed $value)
    {
        V::boolType()->check($value);

        // - Si la valeur est `false`, on est de toute façon bons.
        if ($value === false) {
            return true;
        }

        // - Si le type n'est pas valide, on ne peut pas aller plus loin.
        $rawBuyerType = $this->getAttributeFromArray('buyer_type');
        if (!V::enumValue(LegalEntityType::class)->validate($rawBuyerType)) {
            return true;
        }

        // - Seules les entreprises peuvent être des entités publiques.
        return $rawBuyerType === LegalEntityType::COMPANY->value;
    }

    public function checkBuyerRegistrationId(mixed $value)
    {
        V::nullable(V::stringVal()->length(null, 50))->check($value);

        // - Si le type n'est pas valide, on ne peut pas aller plus loin.
        $rawBuyerType = $this->getAttributeFromArray('buyer_type');
        if (!V::enumValue(LegalEntityType::class)->validate($rawBuyerType)) {
            return true;
        }

        // - Si c'est un particulier, il ne doit pas y avoir
        //   de numéro d'immatriculation.
        if ($rawBuyerType === LegalEntityType::INDIVIDUAL->value) {
            return V::nullType();
        }

        $formatRaw = $this->getAttributeUnsafeValue('format');
        $format = !V::enumValue(BillingFormat::class)->validate($formatRaw)
            ? BillingFormat::current()->value
            : $formatRaw;

        // - Si c'est un ancien format, on bypass la validation stricte.
        if ($format < BillingFormat::V3->value) {
            return true;
        }

        // - Si le pays de l'acheteur n'est pas valide, on ne peut pas aller plus loin.
        $buyerCountryCode = $this->getAttributeFromArray('buyer_country');
        if (!V::countryCode()->validate($buyerCountryCode)) {
            return true;
        }

        // - On regarde si on peut bypass la validation si la valeur est `null`.
        if ($value === null) {
            // - Si le pays du vendeur n'est pas valide, on ne peut pas aller plus loin.
            $sellerCountryCode = $this->getAttributeFromArray('seller_country');
            if (V::countryCode()->validate($sellerCountryCode)) {
                return true;
            }

            // - Si le numéro d'enregistrement n'est pas requis pour les acheteur de
            //   ce pays dans le pays de l'organisation, on n'impose pas le remplissage.
            if (!(new Country($sellerCountryCode))->requireBuyerRegistrationId($buyerCountryCode)) {
                return true;
            }
        }

        // - Pour une entité publique, on exige l'identifiant le
        //   plus précis (ex. SIRET en France, pas SIREN).
        $buyerIsPublicEntity = (bool) $this->getAttributeFromArray('buyer_is_public_entity');
        return V::notEmpty()->registrationId($buyerCountryCode, preciseOnly: $buyerIsPublicEntity);
    }

    public function checkBuyerVatNumber(mixed $value)
    {
        V::nullable(V::stringVal()->length(null, 50))->check($value);

        // - Si la valeur est vide, on ne va pas plus loin.
        if ($value === null) {
            return true;
        }

        // - Si le type n'est pas valide, on ne peut pas aller plus loin.
        $rawBuyerType = $this->getAttributeFromArray('buyer_type');
        if (!V::enumValue(LegalEntityType::class)->validate($rawBuyerType)) {
            return true;
        }

        // - Si c'est un particulier, il ne doit pas y avoir de numéro de T.V.A.
        if ($rawBuyerType === LegalEntityType::INDIVIDUAL->value) {
            return V::nullType();
        }

        $formatRaw = $this->getAttributeUnsafeValue('format');
        $format = !V::enumValue(BillingFormat::class)->validate($formatRaw)
            ? BillingFormat::current()->value
            : $formatRaw;

        // - Si c'est un ancien format, on bypass la validation stricte.
        if ($format < BillingFormat::V3->value) {
            return true;
        }

        // - Si le pays de l'acheteur n'est pas valide, on ne peut pas aller plus loin.
        $buyerCountryCode = $this->getAttributeFromArray('buyer_country');
        if (!V::countryCode()->validate($buyerCountryCode)) {
            return true;
        }

        return V::vatNumber($buyerCountryCode);
    }

    public function checkBuyerFirstName(mixed $value)
    {
        V::nullable(V::nameLike()->length(2, 35))->check($value);

        // - Si la valeur est non nulle, on est bon.
        if ($value !== null) {
            return true;
        }

        // - Si le type n'est pas valide, on ne peut pas aller plus loin.
        $rawBuyerType = $this->getAttributeFromArray('buyer_type');
        if (!V::enumValue(LegalEntityType::class)->validate($rawBuyerType)) {
            return true;
        }

        // - Si c'est un particulier, le prénom de l'acheteur est obligatoire.
        $isIndividual = $rawBuyerType === LegalEntityType::INDIVIDUAL->value;
        return !$isIndividual ?: V::notEmpty();
    }

    public function checkBuyerLastName(mixed $value)
    {
        V::nullable(V::nameLike()->length(2, 35))->check($value);

        // - Si la valeur est non nulle, on est bon.
        if ($value !== null) {
            return true;
        }

        // - Si le type n'est pas valide, on ne peut pas aller plus loin.
        $rawBuyerType = $this->getAttributeFromArray('buyer_type');
        if (!V::enumValue(LegalEntityType::class)->validate($rawBuyerType)) {
            return true;
        }

        // - Si c'est un particulier, le nom de l'acheteur est obligatoire.
        $isIndividual = $rawBuyerType === LegalEntityType::INDIVIDUAL->value;
        return !$isIndividual ?: V::notEmpty();
    }

    public function checkBuyerStreet()
    {
        return V::create()
            ->nullable(V::length(null, 191))
            ->custom(
                [$this, 'checkBuyerAddressField'],
                AddressField::ADDRESS_LINE1,
            );
    }

    public function checkBuyerAdditionalStreet()
    {
        return V::create()
            ->nullable(V::length(null, 191))
            ->custom(
                [$this, 'checkBuyerAddressField'],
                AddressField::ADDRESS_LINE2,
            );
    }

    public function checkBuyerPostalCode(mixed $value)
    {
        V::create()
            ->nullable(V::length(null, 10))
            ->custom(
                [$this, 'checkBuyerAddressField'],
                AddressField::POSTAL_CODE,
            )
            ->check($value);

        // - Si la valeur est nulle, on ne va pas plus loin.
        if ($value === null) {
            return true;
        }

        $formatRaw = $this->getAttributeUnsafeValue('format');
        $format = !V::enumValue(BillingFormat::class)->validate($formatRaw)
            ? BillingFormat::current()->value
            : $formatRaw;

        // - Si c'est un ancien format, on bypass la validation stricte.
        if ($format < BillingFormat::V3->value) {
            return true;
        }

        // - Si le pays n'est pas valide, on ne peut pas aller plus loin.
        $buyerCountryCode = $this->getAttributeFromArray('buyer_country');
        if (!V::countryCode()->validate($buyerCountryCode)) {
            return true;
        }

        return V::postalCode($buyerCountryCode);
    }

    public function checkBuyerAdministrativeArea()
    {
        return V::create()
            ->nullable(V::length(null, 191))
            ->custom(
                [$this, 'checkBuyerAddressField'],
                AddressField::ADMINISTRATIVE_AREA,
            );
    }

    public function checkBuyerLocality()
    {
        return V::create()
            ->nullable(V::length(null, 191))
            ->custom(
                [$this, 'checkBuyerAddressField'],
                AddressField::LOCALITY,
            );
    }

    public function checkBuyerAddressField(mixed $value, AddressField $field)
    {
        // - Si la valeur est non nulle, on est bon.
        if ($value !== null) {
            return true;
        }

        $formatRaw = $this->getAttributeUnsafeValue('format');
        $format = !V::enumValue(BillingFormat::class)->validate($formatRaw)
            ? BillingFormat::current()->value
            : $formatRaw;

        // - Si c'est un ancien format, on bypass la validation stricte.
        if ($format < BillingFormat::V3->value) {
            return true;
        }

        // - Si le type d'acheteur n'est pas valide, on ne peut pas aller plus loin.
        $rawBuyerType = $this->getAttributeFromArray('buyer_type');
        if (!V::enumValue(LegalEntityType::class)->validate($rawBuyerType)) {
            return true;
        }
        $isCompany = $rawBuyerType === LegalEntityType::COMPANY->value;

        // - Si le pays du vendeur n'est pas valide, on ne peut pas aller plus loin.
        $sellerCountryCode = $this->getAttributeFromArray('seller_country');
        if (!V::countryCode()->validate($sellerCountryCode)) {
            return true;
        }

        // - Si l'adresse n'est pas requise pour les acheteur particuliers
        //   dans le pays de l'organisation, on n'impose pas le remplissage.
        if (!(new Country($sellerCountryCode))->requireBuyerAddress($isCompany)) {
            return true;
        }

        // - Si le pays de l'acheteur n'est pas valide, on ne peut pas aller plus loin.
        $buyerCountryCode = $this->getAttributeFromArray('buyer_country');
        if (!V::countryCode()->validate($buyerCountryCode)) {
            return true;
        }

        $buyerCountry = new Country($buyerCountryCode);
        return !$buyerCountry->isAddressFieldMandatory($field)
            ?: 'mandatory-field';
    }

    public function checkBuyerPhone(mixed $value)
    {
        V::nullable(V::phone())->check($value);

        // - Si la valeur est nulle, on ne va pas plus loin.
        if ($value === null) {
            return true;
        }

        $formatRaw = $this->getAttributeUnsafeValue('format');
        $format = !V::enumValue(BillingFormat::class)->validate($formatRaw)
            ? BillingFormat::current()->value
            : $formatRaw;

        // - Si c'est un ancien format, on bypass la validation stricte.
        if ($format < BillingFormat::V3->value) {
            return true;
        }

        // - Si c'est un format "national", par défaut on
        //   considère le pays de l'application.
        $mainCountryCode = Config::get('mainCountry');
        if (V::phone($mainCountryCode)->validate($value)) {
            return true;
        }

        // - Sinon, on considère le pays de la personne.
        $rawBuyerCountryCode = $this->getAttributeFromArray('buyer_country');
        $buyerCountryCode = V::countryCode()->validate($rawBuyerCountryCode)
            ? $rawBuyerCountryCode
            : null;

        return V::phone($buyerCountryCode ?? $mainCountryCode);
    }

    public function checkBookingTitle(mixed $value)
    {
        // - Si pas de type de booking, le champ doit être `null`.
        $bookingType = $this->getAttributeUnsafeValue('booking_type');
        if ($bookingType === null) {
            return V::nullType();
        }
        return V::nullable(V::length(2, 191));
    }

    public function checkBookingReference(mixed $value)
    {
        // - Si pas de type de booking, le champ doit être `null`.
        $bookingType = $this->getAttributeUnsafeValue('booking_type');
        if ($bookingType === null) {
            return V::nullType();
        }
        return V::nullable(V::stringVal());
    }

    public function checkBookingType(mixed $value)
    {
        if ($value === null) {
            return true;
        }

        return V::create()
            ->notEmpty()
            ->in([Event::TYPE])
            ->validate($value);
    }

    public function checkBookingId(mixed $value)
    {
        // - Si pas de type de booking, l'id doit être `null`.
        $bookingType = $this->getAttributeUnsafeValue('booking_type');
        if ($bookingType === null) {
            return V::nullType();
        }

        // - Le booking_id peut être `null` si le booking a été supprimé.
        if ($value === null) {
            return true;
        }

        V::notEmpty()->intVal()->check($value);

        return match ($bookingType) {
            Event::TYPE => Event::includes($value, withTrashed: true),
            default => false, // - Type inconnu.
        };
    }

    public function checkBookingStartDate(mixed $value)
    {
        // - Si pas de type de booking, la date de début doit être `null`.
        $bookingType = $this->getAttributeUnsafeValue('booking_type');
        if ($bookingType === null) {
            return V::nullType();
        }

        V::notEmpty()->dateTime()->check($value);
        $startDate = new CarbonImmutable($value);

        $bookingIsFullDays = $this->getAttributeUnsafeValue('booking_is_full_days');
        if (!V::boolType()->validate($bookingIsFullDays)) {
            return true;
        }

        return $bookingIsFullDays
            ? $startDate->format('H:i:s') === '00:00:00'
            : $startDate->format('i:s') === '00:00';
    }

    public function checkBookingEndDate(mixed $value)
    {
        // - Si pas de type de booking, la date de fin doit être `null`.
        $bookingType = $this->getAttributeUnsafeValue('booking_type');
        if ($bookingType === null) {
            return V::nullType();
        }

        $dateChecker = V::notEmpty()->dateTime();
        $dateChecker->check($value);
        $endDate = new CarbonImmutable($value);

        $bookingIsFullDays = $this->getAttributeUnsafeValue('booking_is_full_days');
        if (V::boolType()->validate($bookingIsFullDays)) {
            $hasValidTimeFormat = $bookingIsFullDays
                ? $endDate->format('H:i:s') === '00:00:00'
                : $endDate->format('i:s') === '00:00';

            if (!$hasValidTimeFormat) {
                return false;
            }
        }

        $startDateRaw = $this->getAttributeUnsafeValue('booking_start_date');
        if (!$dateChecker->validate($startDateRaw)) {
            return true;
        }
        return $endDate->isAfter($startDateRaw) ?: 'end-date-must-be-after-start-date';
    }

    public function checkBookingIsFullDays()
    {
        // - Si pas de type de booking, le champ doit être `null`.
        $bookingType = $this->getAttributeUnsafeValue('booking_type');
        return $bookingType === null ? V::nullType() : V::boolType();
    }

    public function checkCurrency(mixed $value)
    {
        $isValid = V::create()
            ->notEmpty()
            ->allOf(V::uppercase(), V::length(3, 3))
            ->validate($value);

        if (!$isValid) {
            return false;
        }

        $formatRaw = $this->getAttributeUnsafeValue('format');
        $format = !V::enumValue(BillingFormat::class)->validate($formatRaw)
            ? BillingFormat::current()->value
            : $formatRaw;

        // - Si c'est un ancien format, on ne va pas plus loin.
        if ($format < BillingFormat::V3->value) {
            return true;
        }

        $rawSellerCountryCode = $this->getAttributeFromArray('seller_country');
        $sellerCountry = V::countryCode()->validate($rawSellerCountryCode)
            ? new Country($rawSellerCountryCode)
            : null;

        // - Si le pays du vendeur est invalide, on ne peut pas aller plus loin.
        if ($sellerCountry === null) {
            return true;
        }

        // - Si on ne peut pas récupérer les devises du pays du
        //   vendeur, on ne peut pas aller plus loin.
        $sellerCountryCurrencies = $sellerCountry->getCurrencies();
        if (empty($sellerCountryCurrencies)) {
            return true;
        }

        // - Sinon, elle doit correspondre à l'une des devises
        //   supportées par le pays du vendeur.
        return in_array($value, $sellerCountryCurrencies, true);
    }

    public function checkDegressiveRate(mixed $value)
    {
        V::nullable(V::floatVal())->check($value);
        $value = $value !== null ? Decimal::of($value) : null;

        $formatRaw = $this->getAttributeUnsafeValue('format');
        $format = !V::enumValue(BillingFormat::class)->validate($formatRaw)
            ? BillingFormat::current()->value
            : $formatRaw;

        // - Seuls les devis V1 sont concernés.
        if ($format !== BillingFormat::V1->value) {
            return V::nullType();
        }

        return (
            $value !== null &&
            $value->isGreaterThanOrEqualTo(0) &&
            $value->isLessThan(100_000) &&
            $value->getScale() <= 2
        );
    }

    public function checkDailyTotal(mixed $value)
    {
        V::nullable(V::floatVal())->check($value);
        $value = $value !== null ? Decimal::of($value) : null;

        $formatRaw = $this->getAttributeUnsafeValue('format');
        $format = !V::enumValue(BillingFormat::class)->validate($formatRaw)
            ? BillingFormat::current()->value
            : $formatRaw;

        // - Seuls les devis V1 sont concernés.
        if ($format !== BillingFormat::V1->value) {
            return V::nullType();
        }

        return (
            $value !== null &&
            $value->isGreaterThanOrEqualTo(0) &&
            $value->isLessThan(1_000_000_000_000) &&
            $value->getScale() <= 2
        );
    }

    public function checkGlobalDiscountRate(mixed $value)
    {
        V::floatVal()->check($value);
        $value = Decimal::of($value);

        return (
            $value->isGreaterThanOrEqualTo(0) &&
            $value->isLessThanOrEqualTo(100) &&
            $value->getScale() <= 4
        );
    }

    public function checkAmount(mixed $value, bool $signed = true)
    {
        V::floatVal()->check($value);
        $value = Decimal::of($value);

        return (
            $value->isGreaterThanOrEqualTo($signed ? -1_000_000_000_000 : 0) &&
            $value->isLessThan(1_000_000_000_000) &&
            $value->getScale() <= 2
        );
    }

    public function checkGlobalTaxRegime()
    {
        return V::nullable(V::in([
            TaxRegime::EXEMPTED->value,
            TaxRegime::OUT_OF_SCOPE->value,
        ]));
    }

    public function checkGlobalTaxExemptionCode(mixed $value)
    {
        // - Si le régime de taxe est invalide, on ne peut pas aller plus loin.
        $globalTaxRegime = $this->getAttributeUnsafeValue('global_tax_regime');
        if (!V::nullable(V::enumValue(TaxRegime::class))->validate($globalTaxRegime)) {
            return true;
        }

        // - Si le régime n'est pas "exempté", pas de code.
        if ($globalTaxRegime === null || $globalTaxRegime === TaxRegime::OUT_OF_SCOPE->value) {
            return V::nullType();
        }

        // - S'il y a une raison textuelle, ce champ peut être `null`.
        $globalTaxExemptionReasonRaw = $this->getAttributeUnsafeValue('global_tax_exemption_reason');
        if ($globalTaxExemptionReasonRaw !== null && $value === null) {
            return true;
        }

        $rawSellerCountryCode = $this->getAttributeFromArray('seller_country');
        $sellerCountry = V::countryCode()->validate($rawSellerCountryCode)
            ? new Country($rawSellerCountryCode)
            : null;

        // - Si le pays du vendeur est invalide, on ne peut pas aller plus loin.
        if ($sellerCountry === null) {
            return true;
        }

        $availableExemptionCodes = $sellerCountry->getGlobalVatExemptionCodes();
        if (empty($availableExemptionCodes)) {
            return V::nullType();
        }

        return V::in(array_map(
            static fn ($code) => $code->value,
            $availableExemptionCodes,
        ));
    }

    public function checkGlobalTaxExemptionReason(mixed $value)
    {
        // - Si le régime de taxe est invalide, on ne peut pas aller plus loin.
        $globalTaxRegime = $this->getAttributeUnsafeValue('global_tax_regime');
        if (!V::nullable(V::enumValue(TaxRegime::class))->validate($globalTaxRegime)) {
            return true;
        }

        // - Si la valeur est `null`, on est bon.
        if ($value === null) {
            return true;
        }

        // - Si le régime n'est pas "exempté", pas de raison d'exemption.
        if ($globalTaxRegime === null || $globalTaxRegime === TaxRegime::OUT_OF_SCOPE->value) {
            return V::nullType();
        }

        // - S'il y a une raison via un code, ce champ doit être `null`.
        $globalTaxExemptionCodeRaw = $this->getAttributeUnsafeValue('global_tax_exemption_code');
        if ($globalTaxExemptionCodeRaw !== null) {
            return V::nullType();
        }

        return V::stringType();
    }

    public function checkTotalTaxes(mixed $value)
    {
        if (!is_array($value)) {
            if (!V::nullable(V::json())->validate($value)) {
                return false;
            }
            $value = $value !== null ? $this->fromJson($value) : null;
        }

        // - Si le régime de taxe est invalide, on part du principe que c'est remplissable.
        $globalTaxRegime = $this->getAttributeUnsafeValue('global_tax_regime');
        $isFillable = V::nullable(V::enumValue(TaxRegime::class))->validate($globalTaxRegime)
            ? $globalTaxRegime === null
            : true;

        if (!$isFillable) {
            return V::nullType();
        }

        $amountCheck = static function ($subValue) {
            V::floatVal()->check($subValue);
            $subValue = Decimal::of($subValue);

            return (
                $subValue->isGreaterThan(-1_000_000_000_000) &&
                $subValue->isLessThan(1_000_000_000_000) &&
                $subValue->getScale() <= 2
            );
        };

        $formatRaw = $this->getAttributeUnsafeValue('format');
        $format = !V::enumValue(BillingFormat::class)->validate($formatRaw)
            ? BillingFormat::current()->value
            : $formatRaw;

        // - Format "legacy".
        if ($format < BillingFormat::V3->value) {
            // - Si la valeur est `null`, on est bon.
            if ($value === null) {
                return true;
            }

            // Note: S'il n'y a pas de taxes, le champ doit être à `null` et non un tableau vide.
            $schema = V::arrayType()->notEmpty()->each(V::custom(static fn ($taxValue) => (
                V::schemaStrict(
                    new Rule\Key('name', V::notEmpty()->length(1, 30)),
                    new Rule\Key('is_rate', V::boolType()),
                    new Rule\Key('value', V::custom(static function ($subValue) use ($taxValue) {
                        V::floatVal()->check($subValue);
                        $subValue = Decimal::of($subValue);

                        $isValid = (
                            $subValue->isGreaterThan(-1_000_000_000_000) &&
                            $subValue->isLessThan(1_000_000_000_000) &&
                            $subValue->getScale() <= 3
                        );
                        if (!$isValid) {
                            return false;
                        }

                        $isRate = array_key_exists('is_rate', $taxValue) ? $taxValue['is_rate'] : null;
                        if (!V::boolType()->validate($isRate)) {
                            return true;
                        }

                        return !$isRate
                            // - Si ce n'est pas un pourcentage, la précision doit être à 2 décimales max.
                            ? $subValue->getScale() <= 2
                            // - Sinon si c'est un pourcentage, il doit être inférieur ou égal à 100%.
                            : (
                                $subValue->isGreaterThanOrEqualTo(0) &&
                                $subValue->isLessThanOrEqualTo(100)
                            );
                    })),
                    new Rule\Key('total', V::custom($amountCheck)),
                )
            )));
            return $schema->validate($value);
        }

        $rawSellerCountryCode = $this->getAttributeFromArray('seller_country');
        $sellerCountry = V::countryCode()->validate($rawSellerCountryCode)
            ? new Country($rawSellerCountryCode)
            : null;

        $allowedRates = $sellerCountry?->getVatRates();

        // Note: S'il n'y a pas de taxes, le champ doit être à `null` et non un tableau vide.
        $schema = V::arrayType()->notEmpty()->each(V::custom(static fn ($taxValue) => V::anyOf(
            // - Régime standard.
            new SchemaStrict(
                new Rule\Key('type', V::equals(TaxRegime::STANDARD->value)),
                (
                    $sellerCountry === null || !$sellerCountry->hasSimpleVatSystem()
                        ? new Rule\Key('name', V::notEmpty()->length(1, 30), $sellerCountry !== null)
                        : null
                ),
                new Rule\Key('value', V::custom(static function ($subValue) use ($allowedRates) {
                    V::floatVal()->check($subValue);
                    $subValue = Decimal::of($subValue);

                    $isValid = (
                        $subValue->isGreaterThanOrEqualTo(0) &&
                        $subValue->isLessThanOrEqualTo(100) &&
                        $subValue->getScale() <= 3
                    );
                    if (!$isValid) {
                        return false;
                    }

                    return (
                        $allowedRates === null ||
                        Arr::some($allowedRates, static fn ($allowedRate) => (
                            Decimal::of($allowedRate)->isEqualTo($subValue)
                        ))
                    );
                })),
                new Rule\Key('base', V::custom($amountCheck)),
                new Rule\Key('total', V::custom($amountCheck)),
            ),
            // - Exemption / régime non-standard.
            new SchemaStrict(
                new Rule\Key('type', V::enumValue(TaxRegime::class)),
                new Rule\Key('reason', V::arrayType()->each(V::stringType())),
                new Rule\Key('base', V::custom($amountCheck)),
            ),
        )));
        return $schema->validate($value);
    }

    public function checkGlobalDiscountBreakdown(mixed $value)
    {
        if (!is_array($value)) {
            if (!V::nullable(V::json())->validate($value)) {
                return false;
            }
            $value = $value !== null ? $this->fromJson($value) : null;
        }

        $formatRaw = $this->getAttributeUnsafeValue('format');
        $format = !V::enumValue(BillingFormat::class)->validate($formatRaw)
            ? BillingFormat::current()->value
            : $formatRaw;

        // - Si c'est un ancien format, le champ doit être à `null`.
        if ($format < BillingFormat::V3->value) {
            return V::nullType();
        }

        // - S'il n'y a pas de remise globale, le champ doit être à `null`.
        $globalDiscountRateRaw = $this->getAttributeUnsafeValue('global_discount_rate');
        $globalDiscountRate = V::floatVal()->validate($globalDiscountRateRaw)
            ? Decimal::of($globalDiscountRateRaw)
            : null;
        if ($globalDiscountRate === null || $globalDiscountRate->isZero()) {
            return V::nullType();
        }

        $rawSellerCountryCode = $this->getAttributeFromArray('seller_country');
        $sellerCountry = V::countryCode()->validate($rawSellerCountryCode)
            ? new Country($rawSellerCountryCode)
            : null;

        $amountCheck = static function ($subValue) {
            V::floatVal()->check($subValue);
            $subValue = Decimal::of($subValue);

            return (
                $subValue->isGreaterThan(-1_000_000_000_000) &&
                $subValue->isLessThan(1_000_000_000_000) &&
                $subValue->getScale() <= 2
            );
        };

        // Note: S'il n'y a pas de taxes, le champ doit être à `null` et non un tableau vide.
        $schema = V::arrayType()->notEmpty()->each(V::custom(static fn () => V::anyOf(
            // - Taxe standard (avec nom et taux).
            new SchemaStrict(
                new Rule\Key('base', V::custom($amountCheck)),
                new Rule\Key('value', V::custom($amountCheck)),
                new Rule\Key('total', V::custom($amountCheck)),
                new Rule\Key('tax', V::schemaStrict(
                    new Rule\Key('type', V::equals(TaxRegime::STANDARD->value)),
                    (
                        $sellerCountry === null || !$sellerCountry->hasSimpleVatSystem()
                            ? new Rule\Key('name', V::notEmpty()->length(1, 30), $sellerCountry !== null)
                            : null
                    ),
                    new Rule\Key('value', V::custom(static function ($subValue) {
                        V::floatVal()->check($subValue);
                        $subValue = Decimal::of($subValue);

                        return (
                            $subValue->isGreaterThanOrEqualTo(0) &&
                            $subValue->isLessThanOrEqualTo(100) &&
                            $subValue->getScale() <= 3
                        );
                    }),),
                )),
            ),
            // - Exemption / régime non-standard.
            new SchemaStrict(
                new Rule\Key('base', V::custom($amountCheck)),
                new Rule\Key('value', V::custom($amountCheck)),
                new Rule\Key('total', V::custom($amountCheck)),
                new Rule\Key('tax', V::schemaStrict(
                    new Rule\Key('type', V::enumValue(TaxRegime::class)),
                    new Rule\Key('reason', V::arrayType()->each(V::stringType())),
                )),
            ),
        )));
        return $schema->validate($value);
    }

    public function checkAuthorId(mixed $value)
    {
        V::nullable(V::intVal())->check($value);

        if ($value === null) {
            return true;
        }

        $author = User::withTrashed()->find($value);
        if (!$author) {
            return false;
        }

        return !$this->exists || $this->isDirty('author_id')
            ? !$author->trashed()
            : true;
    }

    public function checkMetadata(mixed $value)
    {
        return V::create()
            ->anyOf(
                V::json(),
                V::arrayType(),
                V::nullType(),
            )
            ->validate($value);
    }

    // ------------------------------------------------------
    // -
    // -    Relations
    // -
    // ------------------------------------------------------

    protected $with = ['relatedInvoices'];

    public function booking(): MorphTo
    {
        return $this->morphTo('booking')
            ->withTrashed();
    }

    public function materials(): HasMany
    {
        return $this->hasMany(EstimateMaterial::class, 'estimate_id')
            ->orderBy('id');
    }

    public function extras(): HasMany
    {
        return $this->hasMany(EstimateExtra::class, 'estimate_id')
            ->orderBy('id');
    }

    public function relatedInvoices(): HasMany
    {
        return $this->hasMany(Invoice::class, 'parent_estimate_id')
            ->customOrderBy('date', 'desc')
            ->withTrashed();
    }

    public function buyer(): BelongsTo
    {
        return $this->belongsTo(Beneficiary::class, 'buyer_id')
            ->withTrashed();
    }

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'author_id')
            ->withTrashed();
    }

    // ------------------------------------------------------
    // -
    // -    Mutators
    // -
    // ------------------------------------------------------

    protected $appends = [
        'url',
        'has_final_invoice',
    ];

    protected $casts = [
        'uuid' => 'string',
        'format' => 'integer',
        'status' => 'string',
        'number' => 'string',
        'date' => 'immutable_datetime',
        'due_date' => 'string',
        'due_delay' => 'integer',
        'seller_legal_name' => 'string',
        'seller_registration_id' => 'string',
        'seller_vat_number' => 'string',
        'seller_legal_type' => 'string',
        'seller_share_capital' => AsDecimal::class,
        'seller_activity_code' => 'string',
        'seller_trade_registry_city' => 'string',
        'seller_street' => 'string',
        'seller_additional_street' => 'string',
        'seller_postal_code' => 'string',
        'seller_administrative_area' => 'string',
        'seller_locality' => 'string',
        'seller_country' => AsCountry::class,
        'seller_email' => 'string',
        'seller_phone' => 'string',
        'buyer_id' => 'integer',
        'buyer_type' => 'string',
        'buyer_reference' => 'string',
        'buyer_legal_name' => 'string',
        'buyer_is_public_entity' => 'boolean',
        'buyer_registration_id' => 'string',
        'buyer_vat_number' => 'string',
        'buyer_service_code' => 'string',
        'buyer_first_name' => 'string',
        'buyer_last_name' => 'string',
        'buyer_street' => 'string',
        'buyer_additional_street' => 'string',
        'buyer_postal_code' => 'string',
        'buyer_administrative_area' => 'string',
        'buyer_locality' => 'string',
        'buyer_country' => AsCountry::class,
        'buyer_email' => 'string',
        'buyer_phone' => 'string',
        'booking_type' => 'string',
        'booking_id' => 'integer',
        'booking_title' => 'string',
        'booking_reference' => 'string',
        'booking_start_date' => 'immutable_datetime',
        'booking_end_date' => 'immutable_datetime',
        'booking_is_full_days' => 'boolean',
        'is_vat_due_on_invoice' => 'boolean',
        'degressive_rate' => AsDecimal::class,
        'global_discount_rate' => AsDecimal::class,
        'global_discount_breakdown' => 'array',
        'total_without_global_discount' => AsDecimal::class,
        'total_global_discount' => AsDecimal::class,
        'total_without_taxes' => AsDecimal::class,
        'global_tax_regime' => 'string',
        'global_tax_exemption_code' => 'string',
        'global_tax_exemption_reason' => 'string',
        'total_taxes' => 'array',
        'total_with_taxes' => AsDecimal::class,
        'total_replacement' => AsDecimal::class,
        'special_mentions' => 'string',
        'currency' => 'string',
        'lang' => 'string',
        'author_id' => 'integer',
        'metadata' => 'array',
        'created_at' => 'immutable_datetime',
        'updated_at' => 'immutable_datetime',
        'deleted_at' => 'immutable_datetime',
    ];

    public function getTypeAttribute(): BillingType
    {
        // - Les lignes extras avec un prix unitaire négatif sont considérés
        //   comme des déductions et ne doivent donc pas être prises en compte
        //   pour déterminer le type de facturation.
        $extras = $this->extras->reject(static fn ($extra) => (
            $extra->unit_price->isNegative()
        ));

        $hasGoods = $extras->contains('is_service', false);
        $hasServices = $this->materials->isNotEmpty() || $extras->contains('is_service', true);

        return match (true) {
            $hasServices && $hasGoods => BillingType::BOTH,
            $hasGoods => BillingType::GOODS,
            default => BillingType::SERVICES,
        };
    }

    public function getStatusAttribute(string $value): string
    {
        if ($value === EstimateStatus::DRAFT->value) {
            return $this->is_obsolete
                ? EstimateStatus::OBSOLETE->value
                : EstimateStatus::DRAFT->value;
        }

        // - Statuts "(partiellement) facturé".
        $relatedInvoices = collect($this->exists ? $this->related_invoices : []);
        if ($relatedInvoices->isNotEmpty()) {
            $billedTotal = $relatedInvoices->reduce(
                static fn (Decimal $carry, Invoice $invoice) => (
                    $invoice->is_credit_note
                        ? $carry->minus($invoice->total_with_taxes)
                        : $carry->plus($invoice->total_with_taxes)
                ),
                Decimal::zero(),
            );

            $isTotalBilled = !$this->total_with_taxes->isNegative()
                ? $billedTotal->isGreaterThanOrEqualTo($this->total_with_taxes)
                : $billedTotal->isLessThanOrEqualTo($this->total_with_taxes);

            return !$isTotalBilled
                ? EstimateStatus::PARTIALLY_INVOICED->value
                : EstimateStatus::INVOICED->value;
        }

        if (!in_array($value, [EstimateStatus::PENDING->value, EstimateStatus::SENT->value], true)) {
            return $value;
        }

        // - Calcul de la date d'échéance effective.
        $dueDate = null;
        if ($this->due_date !== null) {
            $dueDate = CarbonImmutable::parse($this->due_date);
        } elseif ($this->due_delay !== null) {
            $dueDate = $this->date->addDays($this->due_delay);
        }

        // - Si on a pas l'information de la date d'échéance,
        //   le devis ne peut pas être expiré.
        if ($dueDate === null) {
            return $value;
        }

        $today = CarbonImmutable::now()->startOfDay();
        $isPast = $dueDate->isBefore($today);
        return $isPast ? EstimateStatus::EXPIRED->value : $value;
    }

    public function getPathAttribute(): ?string
    {
        // - Pas de stockage physique pour les brouillons.
        if ($this->is_draft) {
            return null;
        }

        return $this->uuid !== null
            ? static::PDF_BASEPATH . DS . sprintf('%s.pdf', $this->uuid)
            : null;
    }

    public function getUrlAttribute(): ?string
    {
        if (!$this->exists) {
            return null;
        }

        return (string) Config::getBaseUri()
            ->withPath(sprintf('/estimates/%s/pdf', $this->id));
    }

    public function getIsDraftAttribute(): bool
    {
        $rawStatus = $this->getAttributeFromArray('status');
        return $rawStatus === EstimateStatus::DRAFT->value;
    }

    public function getIsObsoleteAttribute(): bool
    {
        if (!$this->is_draft) {
            return false;
        }

        // - Un brouillon devient "obsolète" lorsqu'une date d'échéance fixe a été
        //   définie et qu'elle est désormais dépassée (un délai n'entre pas en jeu
        //   tant que le devis n'a pas été finalisé et donc daté).
        if ($this->due_date === null) {
            return false;
        }

        $today = CarbonImmutable::now()->startOfDay();
        $dueDate = CarbonImmutable::parse($this->due_date);
        return $dueDate->isBefore($today);
    }

    public function getSellerAddressAttribute(): Address
    {
        return (new Address($this->seller_country))
            ->withAddressLine1($this->seller_street)
            ->withAddressLine2($this->seller_additional_street)
            ->withPostalCode($this->seller_postal_code)
            ->withAdministrativeArea($this->seller_administrative_area)
            ->withLocality($this->seller_locality);
    }

    public function getBuyerFullNameAttribute(): string|null
    {
        if ($this->buyer_first_name === null && $this->buyer_last_name === null) {
            return null;
        }
        return implode(' ', array_filter([$this->buyer_first_name, $this->buyer_last_name]));
    }

    public function getBuyerAddressAttribute(): Address
    {
        return (new Address($this->buyer_country))
            ->withAddressLine1($this->buyer_street)
            ->withAddressLine2($this->buyer_additional_street)
            ->withPostalCode($this->buyer_postal_code)
            ->withAdministrativeArea($this->buyer_administrative_area)
            ->withLocality($this->buyer_locality);
    }

    public function getBookingPeriodAttribute(): Period|null
    {
        if ($this->booking_start_date === null || $this->booking_end_date === null) {
            return null;
        }

        return new Period(
            $this->booking_start_date,
            $this->booking_end_date,
            $this->booking_is_full_days,
        );
    }

    /** @return Collection<array-key, Invoice> */
    public function getRelatedInvoicesAttribute(): Collection
    {
        return $this->getRelationValue('relatedInvoices');
    }

    /** @return Collection<array-key, EstimateMaterial> */
    public function getMaterialsAttribute(): Collection
    {
        return $this->getRelationValue('materials');
    }

    /** @return Collection<array-key, EstimateExtra> */
    public function getExtrasAttribute(): Collection
    {
        return $this->getRelationValue('extras');
    }

    /** @return list<DiscountData> */
    public function getGlobalDiscountBreakdownAttribute(mixed $value): array
    {
        $breakdown = $this->castAttribute('global_discount_breakdown', $value);
        if ($breakdown === null) {
            return [];
        }

        return array_map(
            static function (array $item) {
                $tax = $item['tax'];
                if ($tax['type'] === TaxRegime::STANDARD->value) {
                    $tax['value'] = Decimal::of($tax['value'])->toScale(3);
                }

                return [
                    'base' => Decimal::of($item['base'])->toScale(2),
                    'value' => Decimal::of($item['value'])->toScale(2),
                    'total' => Decimal::of($item['total'])->toScale(2),
                    'tax' => $tax,
                ];
            },
            $breakdown,
        );
    }

    /** @return list<TaxData>|null */
    public function getTotalTaxesAttribute(mixed $value): array|null
    {
        // - Seul l'absence de régime global autorise les taxes par ligne.
        if ($this->global_tax_regime !== null) {
            return null;
        }

        $totalTaxes = $this->castAttribute('total_taxes', $value);
        if ($totalTaxes === null) {
            return [];
        }

        return array_map(
            function (array $tax) {
                $type = array_key_exists('type', $tax)
                    ? TaxRegime::from($tax['type'])
                    : TaxRegime::STANDARD;

                $isRate = $this->format < BillingFormat::V3->value
                    ? $tax['is_rate']
                    : true;

                $normalizedValues = [];
                if (array_key_exists('base', $tax)) {
                    $normalizedValues['base'] = Decimal::of($tax['base'])->toScale(2);
                }
                if ($type === TaxRegime::STANDARD) {
                    $normalizedValues = array_merge($normalizedValues, [
                        'value' => Decimal::of($tax['value'])
                            ->toScale($isRate ? 3 : 2),
                        'total' => Decimal::of($tax['total'])
                            ->toScale(2),
                    ]);
                }
                return array_replace($tax, $normalizedValues);
            },
            $totalTaxes,
        );
    }

    public function getMetadataAttribute(mixed $value): array
    {
        return $this->castAttribute('metadata', $value) ?? [];
    }

    /** @return CoreCollection<array-key, Property> */
    public function getTotalisablePropertiesAttribute(): CoreCollection
    {
        return new CoreCollection($this->metadata['properties'] ?? []);
    }

    public function getIsUsedAttribute(): bool
    {
        if (!$this->exists) {
            return false;
        }
        return $this->related_invoices->isNotEmpty();
    }

    public function getHasFinalInvoiceAttribute(): bool
    {
        if (!$this->exists) {
            return false;
        }

        return $this->related_invoices->contains(
            static fn (Invoice $invoice) => (
                !$invoice->is_prepayment &&
                !$invoice->is_credit_note &&
                !$invoice->is_cancelled
            ),
        );
    }

    // ------------------------------------------------------
    // -
    // -    Profil de l'acheteur de la facture
    // -
    // ------------------------------------------------------

    public function getBuyerType(): LegalEntityType
    {
        return LegalEntityType::from($this->buyer_type);
    }

    public function getBuyerFirstName(): string|null
    {
        return $this->buyer_first_name;
    }

    public function getBuyerLastName(): string|null
    {
        return $this->buyer_last_name;
    }

    public function getBuyerLegalName(): string|null
    {
        return $this->getBuyerType() === LegalEntityType::COMPANY
            ? $this->buyer_legal_name
            : null;
    }

    public function getBuyerRegistrationId(): string|null
    {
        return $this->getBuyerType() === LegalEntityType::COMPANY
            ? $this->buyer_registration_id
            : null;
    }

    public function isBuyerPublicEntity(): bool
    {
        return $this->getBuyerType() === LegalEntityType::COMPANY
            ? $this->buyer_is_public_entity
            : false;
    }

    public function getBuyerVatNumber(): string|null
    {
        return $this->getBuyerType() === LegalEntityType::COMPANY
            ? $this->buyer_vat_number
            : null;
    }

    public function getBuyerServiceCode(): string|null
    {
        return $this->getBuyerType() === LegalEntityType::COMPANY
            ? $this->buyer_service_code
            : null;
    }

    public function getBuyerInvoiceIdentifier(): string|null
    {
        // NOTE: Le devis ne stocke pas l'identifiant de routing,
        //       celui-ci est résolu à la création de la facture.
        return null;
    }

    public function getBuyerAddress(): Address
    {
        return $this->buyer_address;
    }

    public function getBuyerPhone(): string|null
    {
        return $this->buyer_phone;
    }

    public function getBuyerEmail(): string|null
    {
        return $this->buyer_email;
    }

    // ------------------------------------------------------
    // -
    // -    PDF Related
    // -
    // ------------------------------------------------------

    public function toPdf(): PdfInterface
    {
        if (!$this->exists) {
            throw new \LogicException("Please persist the estimate before retrieving its associated PDF.");
        }

        // - Pour un brouillon, on régénère systématiquement le PDF en mémoire
        //   (pas de stockage physique tant que le devis n'est pas finalisé).
        if ($this->is_draft) {
            return $this->generatePdf();
        }

        // - Si le fichier n'existe plus ou qu'on est en mode debug, on régénère.
        $isDebug = env('DEBUG_EXPORT') === true || in_array(Config::getEnv(), ['test', 'development'], true);
        if ($isDebug || !is_file($this->path)) {
            if ($isDebug) {
                return $this->generatePdf();
            }
            $this->generatePdfFile();
        }

        $name = $this->getPdfName();
        return new RawPdf($name, $this->path);
    }

    private function generatePdf(): PdfInterface
    {
        $i18n = new I18n($this->lang);

        $isLegacy = $this->format < BillingFormat::V3->value;
        return PdfDocument::createFromTemplate(
            sprintf('estimate/%s', $isLegacy ? 'legacy' : 'index'),
            $i18n,
            $this->getPdfName($i18n),
            $this->getPdfData($i18n),
        );
    }

    private function generatePdfFile(): void
    {
        // - Pas de fichier physique pour les brouillons.
        if ($this->is_draft) {
            return;
        }

        // - Si on est dans des tests unitaires, on ne génère pas le fichier.
        if (env('DEBUG_EXPORT') === true || in_array(Config::getEnv(), ['test', 'development'], true)) {
            return;
        }

        if (file_exists($this->path)) {
            @unlink($this->path);
        }

        if (!is_dir(static::PDF_BASEPATH)) {
            mkdir(static::PDF_BASEPATH, 0777, true);
        }

        $pdf = $this->generatePdf();
        if (@file_put_contents($this->path, $pdf->asBinaryString()) === false) {
            throw new \RuntimeException(sprintf(
                "Unable to persist estimate PDF into \"%s\".",
                $this->path,
            ));
        }
    }

    private function getPdfName(?I18n $i18n = null): string
    {
        $i18n ??= new I18n($this->lang);

        return sprintf('%s.pdf', Str::slugify(implode('-', array_filter([
            $i18n->translate('estimate'),
            $this->seller_legal_name,
            (
                $this->format < BillingFormat::V3->value
                    ? $this->date->format('Ymd-Hi')
                    : $this->number
            ),
            (
                $this->buyer_type === LegalEntityType::COMPANY
                    ? $this->buyer_legal_name
                    : $this->buyer_full_name
            ),
        ]))));
    }

    private function getPdfData(?I18n $i18n = null): array
    {
        $i18n ??= new I18n($this->lang);
        $settings = Setting::getWithKey('estimates');

        // - Vendeur.
        $sellerCountry = $this->seller_country;
        $seller = [
            'logo' => Config::get('organization.logo'),
            'name' => $this->seller_legal_name,
            'identifier' => $this->seller_registration_id,
            'vatNumber' => $this->seller_vat_number,
            'address' => $this->seller_address,
            'country' => $sellerCountry,
            'phone' => $this->seller_phone,
            'email' => $this->seller_email,
            'legalType' => (
                $this->seller_legal_type !== null
                    ? LegalTypeFactory::tryFrom($this->seller_legal_type)
                    : null
            ),
            'shareCapital' => $this->seller_share_capital,
            'activityCode' => $this->seller_activity_code,
            'tradeRegistryCity' => $this->seller_trade_registry_city,
        ];

        if ($this->format < BillingFormat::V3->value) {
            $categoriesTotals = [];
            $categories = Category::get()->keyBy('id');
            foreach ($this->materials as $line) {
                if ($line->is_hidden_on_bill && $line->total_without_taxes->isZero()) {
                    continue;
                }

                /** @var Category|null $category */
                $category = $line->material?->category_id !== null
                    ? $categories->get($line->material->category_id)
                    : null;

                $categoryIdentifier = $category?->id ?? '__UNCATEGORIZED__';
                if (!array_key_exists($categoryIdentifier, $categoriesTotals)) {
                    $categoriesTotals[$categoryIdentifier] = [
                        'id' => $categoryIdentifier,
                        'name' => $category?->name,
                        'quantity' => 0,
                        'subTotal' => Decimal::zero(),
                    ];
                }

                $categoriesTotals[$categoryIdentifier]['quantity'] += $line->quantity;
                $categoriesTotals[$categoryIdentifier]['subTotal'] = (
                    $categoriesTotals[$categoryIdentifier]['subTotal']
                        ->plus($line->total_without_taxes)
                );
            }
            foreach ($this->extras as $line) {
                if (!array_key_exists('__OTHER__', $categoriesTotals)) {
                    $categoriesTotals['__OTHER__'] = [
                        'id' => '__OTHER__',
                        'name' => null,
                        'quantity' => 0,
                        'subTotal' => Decimal::zero(),
                    ];
                }

                $categoriesTotals['__OTHER__']['quantity'] += $line->quantity;
                $categoriesTotals['__OTHER__']['subTotal'] = (
                    $categoriesTotals['__OTHER__']['subTotal']
                        ->plus($line->total_without_taxes)
                );
            }

            $categoriesTotals = (new Collection($categoriesTotals))
                ->sort(static function ($a, $b) {
                    foreach (['__OTHER__', '__UNCATEGORIZED__'] as $specialGroup) {
                        $isAInGroup = $a['id'] === $specialGroup;
                        $isBInGroup = $b['id'] === $specialGroup;
                        if ($isAInGroup || $isBInGroup) {
                            if (!$isAInGroup || !$isBInGroup) {
                                return $isAInGroup ? 1 : -1;
                            }
                            return strcasecmp($a['name'], $b['name']);
                        }
                    }
                    return strcasecmp($a['name'], $b['name']);
                })
                ->values()
                ->all();

            $hasMaterialDiscount = $this->materials->some(
                static fn ($material) => !$material->discount_rate->isZero(),
            );

            return [
                'date' => $this->date,
                'seller' => array_replace($seller, [
                    'isVatExempted' => empty($this->seller_vat_number),
                ]),
                'beneficiary' => $this->buyer,
                'currency' => $this->currency,
                'booking' => [
                    'entity' => $this->booking_type,
                    'title' => $this->booking_title,
                    'reference' => $this->booking_reference,
                    'period' => $this->booking_period,
                    'location' => (
                        $this->booking instanceof Event
                            ? $this->booking->location
                            : null
                    ),
                ],
                'isLegacy' => $this->format === BillingFormat::V1->value,
                'hasTaxes' => !empty($this->total_taxes),
                'hasMaterialDiscount' => $hasMaterialDiscount,
                'degressiveRate' => $this->degressive_rate,
                'dailyTotal' => $this->daily_total,
                'hasGlobalDiscount' => !$this->global_discount_rate->isZero(),
                'globalDiscountRate' => $this->global_discount_rate->dividedBy(100, 6),
                'totalWithoutGlobalDiscount' => $this->total_without_global_discount,
                'totalGlobalDiscount' => $this->total_global_discount,
                'totalWithoutTaxes' => $this->total_without_taxes,
                'totalTaxes' => array_map(
                    static fn ($tax) => array_replace($tax, [
                        'value' => $tax['is_rate']
                            ? $tax['value']->dividedBy(100, 5)
                            : $tax['value'],
                    ]),
                    $this->total_taxes,
                ),
                'totalWithTaxes' => $this->total_with_taxes,
                'totalReplacement' => $this->total_replacement,
                'categoriesSubTotals' => $categoriesTotals,
                'materials' => (
                    (new MaterialsCollection($this->materials))
                        ->bySubCategories()
                ),
                'extras' => $this->extras,
                'totalisableProperties' => $this->totalisable_properties,
                'specialMentions' => $settings['specialMentions'],
                'showDescriptions' => $settings['showDescriptions'],
                'showTotalReplacementPrice' => $settings['showTotalReplacementPrice'],
                'showTotalisableProperties' => $settings['showTotalisableProperties'],
                'showReplacementPrices' => $settings['showReplacementPrices'],
            ];
        }

        // - Acheteur.
        $buyerCountry = $this->buyer_country;
        $buyerIsCompany = $this->buyer_type === LegalEntityType::COMPANY->value;
        $buyer = [
            'name' => (
                $buyerIsCompany
                    ? $this->buyer_legal_name
                    : $this->buyer_full_name
            ),
            'isCompany' => $buyerIsCompany,
            'isSameVatArea' => $sellerCountry->isSameVatArea($buyerCountry),
            'identifier' => $this->buyer_registration_id,
            'vatNumber' => $this->buyer_vat_number,
            'address' => $this->buyer_address,
            'country' => $buyerCountry,
            'serviceCode' => $this->buyer_service_code,
            'reference' => $this->buyer_reference,
            'contactName' => (
                $buyerIsCompany
                    ? $this->buyer_full_name
                    : null
            ),
        ];

        // - Booking lié au devis (événement ou réservation).
        $booking = null;
        if ($this->booking_type !== null) {
            $booking = [
                'type' => $this->booking_type,
                'title' => $this->booking_title,
                'reference' => $this->booking_reference,
                'period' => $this->booking_period,
            ];
        }

        //
        // - Exemption globale
        //

        $globalTaxRegime = $this->global_tax_regime !== null
            ? TaxRegime::from($this->global_tax_regime)
            : null;

        $globalTaxExemptionReason = null;
        if ($globalTaxRegime !== null) {
            $globalTaxExemptionReason = $this->global_tax_exemption_reason;
            if (empty($globalTaxExemptionReason) && $this->global_tax_exemption_code !== null) {
                $exemptionReasonKey = sprintf('legals.vat-exemptions.%s.mention', $this->global_tax_exemption_code);
                $globalTaxExemptionReason = $i18n->translate($exemptionReasonKey, null, '') ?: null;
            }
        }

        //
        // - Lignes du devis
        //

        $rawMaterials = (new MaterialsCollection($this->materials))->reject(
            static fn (EstimateMaterial $material) => (
                $material->unit_price->isZero() &&
                $material->total_without_taxes->isZero() &&
                $material->is_hidden_on_bill
            ),
        );
        $rawExtras = $this->extras;

        $isSimpleVatSystem = $sellerCountry->hasSimpleVatSystem();
        $hasLineDiscount = (new CoreCollection())
            ->concat($rawMaterials)
            ->concat($rawExtras)
            ->some(
                static fn (EstimateMaterial|EstimateExtra $line) => (
                    !$line->discount_rate->isZero()
                ),
            );

        $taxFootnotes = [];
        $taxFootnoteMap = [];
        $getLineTaxData = static function (EstimateMaterial|EstimateExtra $line) use (
            $i18n,
            &$taxFootnotes,
            &$taxFootnoteMap,
            $globalTaxRegime,
        ): ?array {
            if ($globalTaxRegime !== null || $line->tax_regime === null) {
                return null;
            }
            $taxRegime = TaxRegime::from($line->tax_regime);

            if ($taxRegime === TaxRegime::ZERO_RATED) {
                return ['regime' => TaxRegime::ZERO_RATED];
            }

            if ($taxRegime === TaxRegime::STANDARD) {
                if (empty($line->taxes)) {
                    return ['regime' => TaxRegime::EXEMPTED];
                }

                return [
                    'regime' => TaxRegime::STANDARD,
                    'taxes' => $line->taxes,
                ];
            }

            /** @var value-of<VatExemptionCodeInterface>|null $exemptionCode */
            $exemptionCode = $line->tax_exemption_code ?? (
                $taxRegime->getDefaultExemptionCode()?->value
            );
            if ($exemptionCode === null) {
                return ['regime' => $taxRegime];
            }

            if (array_key_exists($exemptionCode, $taxFootnoteMap)) {
                return [
                    'regime' => $taxRegime,
                    'footnote' => $taxFootnoteMap[$exemptionCode],
                ];
            }

            $exemptionReasonKey = sprintf('legals.vat-exemptions.%s.mention', $exemptionCode);
            $exemptionReason = $i18n->translate($exemptionReasonKey, null, '') ?: null;
            if ($exemptionReason === null) {
                return ['regime' => $taxRegime];
            }

            $index = count($taxFootnotes) + 1;
            $taxFootnoteMap[$exemptionCode] = $index;
            $taxFootnotes[$index] = [
                'index' => $index,
                'reason' => $exemptionReason,
            ];

            return [
                'regime' => $taxRegime,
                'footnote' => $index,
            ];
        };

        $materials = $rawMaterials
            ->byCategories()
            ->map(
                static fn (MaterialsCollection $subCatMaterials) => (
                    $subCatMaterials
                        ->map(
                            static fn (EstimateMaterial $material) => [
                                'name' => $material->name,
                                'reference' => $material->reference,
                                'description' => $material->description,
                                'quantity' => $material->quantity,
                                'unit_price_period' => $material->unit_price_period,
                                'unit_replacement_price' => $material->unit_replacement_price,
                                'total_without_taxes' => $material->total_without_taxes,
                                'has_discount' => $material->has_discount,
                                'discount_rate' => $material->discount_rate,
                                'tax' => $getLineTaxData($material),
                            ],
                        )
                        ->all()
                ),
            );

        $extras = $rawExtras->map(
            static fn (EstimateExtra $extra) => [
                'description' => $extra->description,
                'quantity' => $extra->quantity,
                'unit_price' => $extra->unit_price,
                'total_without_taxes' => $extra->total_without_taxes,
                'has_discount' => $extra->has_discount,
                'discount_rate' => $extra->discount_rate,
                'tax' => $getLineTaxData($extra),
            ],
        );

        //
        // - Taxes au niveau du document
        //

        $totalTaxesAmount = Decimal::zero()->toScale(2);
        $totalTaxes = $globalTaxRegime !== null ? null : array_map(
            static function ($tax) use ($i18n, &$taxFootnotes, &$taxFootnoteMap, &$totalTaxesAmount) {
                $tax['type'] = TaxRegime::from($tax['type']);

                // - Si c'est une taxe standard, pas de note de bas de page.
                if (in_array($tax['type'], [TaxRegime::STANDARD, TaxRegime::ZERO_RATED], true)) {
                    $totalTaxesAmount = $totalTaxesAmount->plus($tax['total'] ?? 0);
                    return $tax;
                }

                $exemptionCodes = (array) ($tax['reason'] ?? []);
                if (empty($exemptionCodes)) {
                    $exemptionCodes = with(
                        $tax['type']->getDefaultExemptionCode()?->value,
                        static fn ($code) => $code !== null ? [$code] : [],
                    );
                }

                $currentFootNotes = [];
                foreach ($exemptionCodes as $exemptionCode) {
                    if (array_key_exists($exemptionCode, $taxFootnoteMap)) {
                        $currentFootNotes[] = $taxFootnoteMap[$exemptionCode];
                        continue;
                    }

                    $exemptionReasonKey = sprintf('legals.vat-exemptions.%s.mention', $exemptionCode);
                    $exemptionReason = $i18n->translate($exemptionReasonKey, null, '') ?: null;
                    if ($exemptionReason === null) {
                        continue;
                    }

                    $index = count($taxFootnotes) + 1;
                    $taxFootnoteMap[$exemptionCode] = $index;
                    $taxFootnotes[$index] = [
                        'index' => $index,
                        'reason' => $exemptionReason,
                    ];

                    $currentFootNotes[] = $index;
                }
                if (!empty($currentFootNotes)) {
                    $tax['footnotes'] = $currentFootNotes;
                }

                return $tax;
            },
            $this->total_taxes ?? [],
        );

        //
        // - Moyens de paiement
        //

        $paymentMethods = [];
        $bankTransferData = null;
        if ($this->total_with_taxes->isGreaterThan(0)) {
            $methodsConfig = Config::get('invoices.paymentMethods');
            if (is_array($methodsConfig)) {
                foreach (PaymentMethod::cases() as $method) {
                    $methodConfig = $methodsConfig[$method->value] ?? null;
                    if ($methodConfig === null || $methodConfig === false) {
                        continue;
                    }

                    if ($method === PaymentMethod::TRANSFER) {
                        if (is_array($methodConfig) && !empty($methodConfig['iban'])) {
                            $bankTransferData = [
                                'iban' => $methodConfig['iban'],
                                'bic' => $methodConfig['bic'] ?? null,
                                'holder' => $methodConfig['holder'] ?? $this->seller_legal_name,
                            ];
                        }
                    }
                    $paymentMethods[] = $method;
                }
            }
        }

        //
        // - Mentions légales
        //

        $legalMentions = [];
        $mentionsOverride = Config::get('invoices.mentions', []);
        foreach ($sellerCountry->getInvoiceLegalMentions() as $mention) {
            // - `SELLER_IDENTITY` et `TRADE_REGISTER` sont déjà dans le footer.
            if (in_array($mention, [LegalMention::SELLER_IDENTITY, LegalMention::TRADE_REGISTER], true)) {
                continue;
            }

            $mentionText = $mentionsOverride[$mention->value] ?? null;
            if (empty($mentionText)) {
                $mentionKey = vsprintf('legals.mentions.%s.%s', [
                    $sellerCountry->getCode(),
                    $mention->value,
                ]);

                $mentionText = match ($mention) {
                    LegalMention::VAT_DUE_ON_INVOICE => (
                        $this->is_vat_due_on_invoice
                            ? ($i18n->translate($mentionKey, null, '') ?: null)
                            : null
                    ),
                    LegalMention::NO_EARLY_PAYMENT_DISCOUNT,
                    LegalMention::LATE_PAYMENT_PENALTY,
                    LegalMention::LATE_PAYMENT_FEE => (
                        $i18n->translate($mentionKey, null, '') ?: null
                    ),
                    default => null,
                };
            }
            if ($mentionText !== null) {
                $legalMentions[] = $mentionText;
            }
        }

        return [
            'date' => $this->date,
            'number' => $this->number,
            'isDraft' => $this->is_draft,
            'dueDate' => (
                $this->due_date !== null
                    ? CarbonImmutable::parse($this->due_date)
                    : null
            ),
            'dueDelay' => $this->due_delay,
            'seller' => $seller,
            'buyer' => $buyer,
            'booking' => $booking,
            'billingType' => $this->type,
            'isDomestic' => $sellerCountry->isSame($buyerCountry),
            'isSimpleVatSystem' => $isSimpleVatSystem,
            'globalTaxRegime' => $globalTaxRegime,
            'globalTaxExemptionReason' => $globalTaxExemptionReason,
            'materials' => $materials,
            'extras' => $extras,
            'taxFootnotes' => $taxFootnotes,
            'hasLineDiscount' => $hasLineDiscount,
            'totalReplacement' => $this->total_replacement,
            'hasGlobalDiscount' => !$this->total_global_discount->isZero(),
            'globalDiscountRate' => $this->global_discount_rate,
            'totalWithoutGlobalDiscount' => $this->total_without_global_discount,
            'totalGlobalDiscount' => $this->total_global_discount,
            'totalWithoutTaxes' => $this->total_without_taxes,
            'totalTaxes' => $totalTaxes,
            'totalTaxesAmount' => $totalTaxesAmount,
            'totalWithTaxes' => $this->total_with_taxes,
            'showDescriptions' => $settings['showDescriptions'],
            'showReplacementPrices' => $settings['showReplacementPrices'],
            'showTotalReplacementPrice' => $settings['showTotalReplacementPrice'],
            'showTotalisableProperties' => $settings['showTotalisableProperties'],
            'totalisableProperties' => $this->totalisable_properties,
            'paymentMethods' => $paymentMethods,
            'bankTransferData' => $bankTransferData,
            'legalMentions' => $legalMentions,
            'specialMentions' => $this->special_mentions,
        ];
    }

    // ------------------------------------------------------
    // -
    // -    Autres méthodes liées à une "entity"
    // -
    // ------------------------------------------------------

    /**
     * Finalise un brouillon de devis.
     *
     * @return static Le devis, finalisé.
     */
    public function finalize(): static
    {
        if (!$this->is_draft) {
            throw new \DomainException("Only draft estimates can be finalized.");
        }

        // - Un brouillon devenu obsolète ne peut plus être finalisé.
        if ($this->is_obsolete) {
            throw new \DomainException("Cannot finalize an obsolete draft estimate.");
        }

        return dbTransaction(function () {
            $this->date = CarbonImmutable::now();
            $this->number = static::getNextNumber();
            $this->status = EstimateStatus::PENDING->value;

            if (!$this->save()) {
                throw new \RuntimeException("Unable to finalize the estimate.");
            }

            return $this->refresh();
        });
    }

    // ------------------------------------------------------
    // -
    // -    Setters
    // -
    // ------------------------------------------------------

    protected $fillable = [
        'uuid',
        'format',
        'status',
        'number',
        'date',
        'due_date',
        'due_delay',
        'seller_legal_name',
        'seller_registration_id',
        'seller_vat_number',
        'seller_legal_type',
        'seller_share_capital',
        'seller_activity_code',
        'seller_trade_registry_city',
        'seller_street',
        'seller_additional_street',
        'seller_postal_code',
        'seller_administrative_area',
        'seller_locality',
        'seller_country',
        'seller_email',
        'seller_phone',
        'buyer_type',
        'buyer_reference',
        'buyer_legal_name',
        'buyer_is_public_entity',
        'buyer_registration_id',
        'buyer_vat_number',
        'buyer_service_code',
        'buyer_first_name',
        'buyer_last_name',
        'buyer_street',
        'buyer_additional_street',
        'buyer_postal_code',
        'buyer_administrative_area',
        'buyer_locality',
        'buyer_country',
        'buyer_email',
        'buyer_phone',
        'booking_title',
        'booking_period',
        'booking_reference',
        'booking_start_date',
        'booking_end_date',
        'booking_is_full_days',
        'is_vat_due_on_invoice',
        'global_discount_rate',
        'global_discount_breakdown',
        'total_without_global_discount',
        'total_global_discount',
        'total_without_taxes',
        'global_tax_regime',
        'global_tax_exemption_code',
        'global_tax_exemption_reason',
        'total_taxes',
        'total_with_taxes',
        'total_replacement',
        'special_mentions',
        'currency',
        'lang',
        'metadata',
    ];

    public function setStatusAttribute(mixed $value): void
    {
        $value = $value instanceof EstimateStatus ? $value->value : $value;
        $this->attributes['status'] = $value;
    }

    public function setSellerRegistrationIdAttribute(mixed $rawValue): void
    {
        // - Si ce n'est pas une chaîne (`null` ou valeur invalide) => On ne va pas plus loin.
        if (!is_string($rawValue)) {
            $this->attributes['seller_registration_id'] = $rawValue;
            return;
        }
        $rawValue = trim($rawValue);

        // - Si la valeur est vide, on ne va pas plus loin.
        if ($rawValue === '') {
            $this->attributes['seller_registration_id'] = null;
            return;
        }

        $rawSellerCountryCode = $this->getAttributeFromArray('seller_country');
        $sellerCountry = V::countryCode()->validate($rawSellerCountryCode)
            ? new Country($rawSellerCountryCode)
            : null;

        // - Si le pays n'est pas défini, on ne peut pas normaliser.
        if ($sellerCountry === null) {
            $this->attributes['seller_registration_id'] = $rawValue;
            return;
        }

        $this->attributes['seller_registration_id'] = (
            $sellerCountry->isValidCompanyIdentifier($rawValue)
                ? $sellerCountry->normalizeCompanyIdentifier($rawValue)
                : $rawValue
        );
    }

    public function setSellerVatNumberAttribute(mixed $rawValue): void
    {
        // - Si ce n'est pas une chaîne (`null` ou valeur invalide) => On ne va pas plus loin.
        if (!is_string($rawValue)) {
            $this->attributes['seller_vat_number'] = $rawValue;
            return;
        }
        $rawValue = trim($rawValue);

        // - Si la valeur est vide, on ne va pas plus loin.
        if ($rawValue === '') {
            $this->attributes['seller_vat_number'] = null;
            return;
        }

        $rawSellerCountryCode = $this->getAttributeFromArray('seller_country');
        $sellerCountry = V::countryCode()->validate($rawSellerCountryCode)
            ? new Country($rawSellerCountryCode)
            : null;

        // - Si le pays n'est pas défini, on ne peut pas normaliser.
        if ($sellerCountry === null) {
            $this->attributes['seller_vat_number'] = $rawValue;
            return;
        }

        $this->attributes['seller_vat_number'] = (
            $sellerCountry->isValidVatNumber($rawValue)
                ? $sellerCountry->normalizeVatNumber($rawValue)
                : $rawValue
        );
    }

    public function setSellerCountryAttribute(mixed $rawValue): void
    {
        $this->attributes['seller_country'] = $rawValue instanceof Country
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

        // - Numéro d'enregistrement de l'entreprise (le cas échéant)
        $rawSellerRegistrationId = $this->getAttributeFromArray('seller_registration_id');
        if ($rawSellerRegistrationId !== null) {
            $this->attributes['seller_registration_id'] = (
                $country->isValidCompanyIdentifier($rawSellerRegistrationId)
                    ? $country->normalizeCompanyIdentifier($rawSellerRegistrationId)
                    : $rawSellerRegistrationId
            );
        }

        // - Numéro de T.V.A. de l'entreprise (le cas échéant)
        $rawSellerVatNumber = $this->getAttributeFromArray('seller_vat_number');
        if ($rawSellerVatNumber !== null) {
            $this->attributes['seller_vat_number'] = (
                $country->isValidVatNumber($rawSellerVatNumber)
                    ? $country->normalizeVatNumber($rawSellerVatNumber)
                    : $rawSellerVatNumber
            );
        }
    }

    public function setBuyerTypeAttribute(mixed $type): void
    {
        $this->attributes['buyer_type'] = $type;

        if ($type === LegalEntityType::INDIVIDUAL->value && $this->exists) {
            if (!$this->isDirty('buyer_legal_name')) {
                $this->buyer_legal_name = null;
            }
            if (!$this->isDirty('buyer_registration_id')) {
                $this->buyer_registration_id = null;
            }
            if (!$this->isDirty('buyer_vat_number')) {
                $this->buyer_vat_number = null;
            }
        }
    }

    public function setBuyerRegistrationIdAttribute(mixed $rawValue): void
    {
        // - Si ce n'est pas une chaîne (`null` ou valeur invalide) => On ne va pas plus loin.
        if (!is_string($rawValue)) {
            $this->attributes['buyer_registration_id'] = $rawValue;
            return;
        }
        $rawValue = trim($rawValue);

        // - Si la valeur est vide, on ne va pas plus loin.
        if ($rawValue === '') {
            $this->attributes['buyer_registration_id'] = null;
            return;
        }

        $rawBuyerCountryCode = $this->getAttributeFromArray('buyer_country');
        $country = V::countryCode()->validate($rawBuyerCountryCode)
            ? new Country($rawBuyerCountryCode)
            : null;

        // - Si le pays n'est pas défini, on ne peut pas normaliser.
        if ($country === null) {
            $this->attributes['buyer_registration_id'] = $rawValue;
            return;
        }

        $this->attributes['buyer_registration_id'] = (
            $country->isValidCompanyIdentifier($rawValue)
                ? $country->normalizeCompanyIdentifier($rawValue)
                : $rawValue
        );
    }

    public function setBuyerVatNumberAttribute(mixed $rawValue): void
    {
        // - Si ce n'est pas une chaîne (`null` ou valeur invalide) => On ne va pas plus loin.
        if (!is_string($rawValue)) {
            $this->attributes['buyer_vat_number'] = $rawValue;
            return;
        }
        $rawValue = trim($rawValue);

        // - Si la valeur est vide, on ne va pas plus loin.
        if ($rawValue === '') {
            $this->attributes['buyer_vat_number'] = null;
            return;
        }

        $rawBuyerCountryCode = $this->getAttributeFromArray('buyer_country');
        $buyerCountry = V::countryCode()->validate($rawBuyerCountryCode)
            ? new Country($rawBuyerCountryCode)
            : null;

        // - Si le pays n'est pas défini, on ne peut pas normaliser.
        if ($buyerCountry === null) {
            $this->attributes['buyer_vat_number'] = $rawValue;
            return;
        }

        $this->attributes['buyer_vat_number'] = (
            $buyerCountry->isValidVatNumber($rawValue)
                ? $buyerCountry->normalizeVatNumber($rawValue)
                : $rawValue
        );
    }

    public function setBuyerCountryAttribute(mixed $rawValue): void
    {
        $this->attributes['buyer_country'] = $rawValue instanceof Country
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

        // - Numéro d'enregistrement de l'entreprise (le cas échéant)
        $rawBuyerRegistrationId = $this->getAttributeFromArray('buyer_registration_id');
        if ($rawBuyerRegistrationId !== null) {
            $this->attributes['buyer_registration_id'] = (
                $country->isValidCompanyIdentifier($rawBuyerRegistrationId)
                    ? $country->normalizeCompanyIdentifier($rawBuyerRegistrationId)
                    : $rawBuyerRegistrationId
            );
        }

        // - Numéro de T.V.A. de l'entreprise (le cas échéant)
        $rawBuyerVatNumber = $this->getAttributeFromArray('buyer_vat_number');
        if ($rawBuyerVatNumber !== null) {
            $this->attributes['buyer_vat_number'] = (
                $country->isValidVatNumber($rawBuyerVatNumber)
                    ? $country->normalizeVatNumber($rawBuyerVatNumber)
                    : $rawBuyerVatNumber
            );
        }
    }

    public function setBookingPeriodAttribute(mixed $rawPeriod): void
    {
        if ($rawPeriod === null) {
            $this->booking_start_date = null;
            $this->booking_end_date = null;
            $this->booking_is_full_days = null;
            return;
        }

        $period = Period::tryFrom($rawPeriod);
        $this->booking_start_date = $period?->getStartDate();
        $this->booking_end_date = $period?->getEndDate();
        $this->booking_is_full_days = $period?->isFullDays() ?? false;
    }

    public function setGlobalDiscountBreakdownAttribute(mixed $value): void
    {
        $value = is_array($value) && empty($value) ? null : $value;
        $value = $value !== null ? $this->castAttributeAsJson('global_discount_breakdown', $value) : null;
        $this->attributes['global_discount_breakdown'] = $value;
    }

    public function setTotalTaxesAttribute(mixed $value): void
    {
        $value = is_array($value) && empty($value) ? null : $value;
        $value = $value !== null ? $this->castAttributeAsJson('total_taxes', $value) : null;
        $this->attributes['total_taxes'] = $value;
    }

    public function setMetadataAttribute(mixed $value): void
    {
        $value = is_array($value) && empty($value) ? null : $value;
        $value = $value !== null ? $this->castAttributeAsJson('metadata', $value) : null;
        $this->attributes['metadata'] = $value;
    }

    // ------------------------------------------------------
    // -
    // -    Query Scopes
    // -
    // ------------------------------------------------------

    protected array $orderable = [
        'date' => 'desc',
        'number' => 'desc',
        'status' => 'asc',
        'due_date' => 'desc',
        'total_without_taxes',
        'total_with_taxes',
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

        $safeTerm = sprintf('%%%s%%', addcslashes($term, '%_'));
        return $query->where(static fn (Builder $subQuery) => (
            $subQuery
                ->orWhere('number', 'LIKE', $safeTerm)
                ->orWhereHas('buyer', static fn (Builder $buyerQuery) => (
                    // - Ici on passe `$term` car `Beneficiary::search()` se charge de l'échappement.
                    $buyerQuery->search($term)
                ))
        ));
    }

    public function scopeWithStatus(Builder $query, EstimateStatus|array $status): Builder
    {
        $statuses = !is_array($status) ? [$status] : $status;
        Assert::allIsInstanceOf($statuses, EstimateStatus::class);

        $now = CarbonImmutable::now();
        $includeExpired = in_array(EstimateStatus::EXPIRED, $statuses, true);
        $includeObsolete = in_array(EstimateStatus::OBSOLETE, $statuses, true);
        $includePartiallyInvoiced = in_array(EstimateStatus::PARTIALLY_INVOICED, $statuses, true);
        $includeTotallyInvoiced = in_array(EstimateStatus::INVOICED, $statuses, true);
        $rawStatuses = array_filter($statuses, static function (EstimateStatus $status) {
            $statuses = [
                EstimateStatus::DRAFT,
                EstimateStatus::PENDING,
                EstimateStatus::SENT,
                EstimateStatus::ACCEPTED,
                EstimateStatus::REJECTED,
            ];
            return in_array($status, $statuses, true);
        });

        return $query->where(
            static function (Builder $subQuery) use (
                $now,
                $rawStatuses,
                $includeExpired,
                $includeObsolete,
                $includeTotallyInvoiced,
                $includePartiallyInvoiced,
            ) {
                $obsoleteCondition = static fn (Builder $subQuery) => (
                    $subQuery
                        ->where('status', EstimateStatus::DRAFT->value)
                        ->whereNotNull('due_date')
                        ->where('due_date', '<', $now->startOfDay())
                );
                $totallyInvoicedCondition = static function (Builder $subQuery) {
                    // - Sous-requête de calcul du total facturé à partir des factures liées.
                    $billedTotalSubQuery = Invoice::query()
                        ->selectRaw(
                            <<<'SQL'
                            COALESCE(
                                SUM(
                                    CASE
                                        WHEN invoices.is_credit_note THEN -invoices.total_with_taxes
                                        ELSE invoices.total_with_taxes
                                    END
                                ),
                                0
                            )
                            SQL,
                        )
                        ->whereColumn('invoices.parent_estimate_id', 'estimates.id')
                        ->withTrashed();

                    return (
                        $subQuery
                            ->whereHas('relatedInvoices')
                            ->where(static fn (Builder $subSubQuery) => (
                                $subSubQuery
                                    ->orWhere(static fn (Builder $subSubSubQuery) => (
                                        $subSubSubQuery
                                            ->where('total_with_taxes', '>=', 0)
                                            ->where('total_with_taxes', '<=', $billedTotalSubQuery)
                                    ))
                                    ->orWhere(static fn (Builder $subSubSubQuery) => (
                                        $subSubSubQuery
                                            ->where('total_with_taxes', '<', 0)
                                            ->where('total_with_taxes', '>=', $billedTotalSubQuery)
                                    ))
                            ))
                    );
                };
                $partiallyInvoicedCondition = static fn (Builder $subQuery) => (
                    $subQuery
                        ->whereNot($totallyInvoicedCondition)
                        ->whereHas('relatedInvoices')
                );
                $expiredCondition = static fn (Builder $subQuery) => (
                    $subQuery
                        ->whereNot($totallyInvoicedCondition)
                        ->whereNot($partiallyInvoicedCondition)
                        ->whereIn('status', [
                            EstimateStatus::PENDING->value,
                            EstimateStatus::SENT->value,
                        ])
                        ->where(static fn (Builder $subSubQuery) => (
                            $subSubQuery
                                ->orWhere(static fn (Builder $subSubSubQuery) => (
                                    $subSubSubQuery
                                        ->whereNotNull('due_date')
                                        ->where('due_date', '<', $now->startOfDay())
                                ))
                                ->orWhere(static fn (Builder $subSubSubQuery) => (
                                    $subSubSubQuery
                                        ->whereNotNull('date')
                                        ->whereNull('due_date')
                                        ->whereNotNull('due_delay')
                                        ->whereRaw('DATE_ADD(date, INTERVAL due_delay DAY) < ?', [$now->startOfDay()])
                                ))
                        ))
                );

                $subQuery
                    ->when(!empty($rawStatuses), static fn (Builder $subSubQuery) => (
                        $subSubQuery->orWhere(static fn (Builder $q) => (
                            $q
                                ->whereNot($totallyInvoicedCondition)
                                ->whereNot($partiallyInvoicedCondition)
                                ->whereNot($expiredCondition)
                                ->whereNot($obsoleteCondition)
                                ->whereIn('status', array_map(
                                    static fn (EstimateStatus $estimateStatus) => $estimateStatus->value,
                                    $rawStatuses,
                                ))
                        ))
                    ))
                    ->when($includeExpired, static fn (Builder $subSubQuery) => (
                        $subSubQuery->orWhere($expiredCondition)
                    ))
                    ->when($includeObsolete, static fn (Builder $subSubQuery) => (
                        $subSubQuery->orWhere($obsoleteCondition)
                    ))
                    ->when($includeTotallyInvoiced, static fn (Builder $subSubQuery) => (
                        $subSubQuery->orWhere($totallyInvoicedCondition)
                    ))
                    ->when($includePartiallyInvoiced, static fn (Builder $subSubQuery) => (
                        $subSubQuery->orWhere($partiallyInvoicedCondition)
                    ));
            },
        );
    }

    public function scopeCustomOrderBy(Builder $query, string $column, string $direction = 'asc'): Builder
    {
        Assert::inArray($column, $this->getOrderableColumns(), "Invalid order field.");
        Assert::inArray($direction, ['asc', 'desc'], "Invalid direction.");

        if (!in_array($column, ['status', 'date', 'due_date'], true)) {
            return $query->orderBy($column, $direction);
        }

        if ($column === 'date') {
            return $query
                ->orderByRaw(sprintf(
                    '`date` IS NULL %s',
                    $direction === 'asc' ? 'asc' : 'desc',
                ))
                ->orderBy($column, $direction)
                ->orderBy('id', $direction);
        }

        if ($column === 'due_date') {
            return $query
                ->orderByRaw(sprintf(
                    "COALESCE(due_date, DATE_ADD(date, INTERVAL due_delay DAY)) %s",
                    $direction,
                ))
                ->orderBy('id', $direction);
        }

        $orderedStatuses = [
            EstimateStatus::DRAFT->value,
            EstimateStatus::PENDING->value,
            EstimateStatus::SENT->value,
            EstimateStatus::ACCEPTED->value,
            EstimateStatus::PARTIALLY_INVOICED->value,
            EstimateStatus::INVOICED->value,
            EstimateStatus::OBSOLETE->value,
            EstimateStatus::EXPIRED->value,
            EstimateStatus::REJECTED->value,
        ];
        if (strtolower($direction) === 'desc') {
            $orderedStatuses = array_reverse($orderedStatuses);
        }

        $isObsoleteCondition = vsprintf(
            <<<'SQL'
                status = '%s'
                AND due_date IS NOT NULL
                AND due_date < '%s'
            SQL,
            [
                EstimateStatus::DRAFT->value,
                CarbonImmutable::now()->format('Y-m-d'),
            ],
        );
        $isTotallyBilledCondition = (static function () {
            // - Sous-requête de calcul du total facturé à partir des factures liées.
            $billedTotalSubQuery = <<<'SQL'
                (
                    SELECT COALESCE(
                        SUM(
                            CASE
                                WHEN invoices.is_credit_note THEN -invoices.total_with_taxes
                                ELSE invoices.total_with_taxes
                            END
                        ),
                        0
                    )
                    FROM invoices invoices
                    WHERE invoices.parent_estimate_id = estimates.id
                )
            SQL;

            return vsprintf(
                <<<'SQL'
                (
                    EXISTS (
                        SELECT 1
                        FROM invoices invoices
                        WHERE invoices.parent_estimate_id = estimates.id
                    )
                    AND (
                        (total_with_taxes >= 0 AND total_with_taxes <= %1$s)
                        OR
                        (total_with_taxes < 0 AND total_with_taxes >= %1$s)
                    )
                )
                SQL,
                [$billedTotalSubQuery],
            );
        })();
        $isPartiallyBilledCondition = <<<'SQL'
            EXISTS (
                SELECT 1
                FROM invoices i
                WHERE i.parent_estimate_id = estimates.id
            )
        SQL;
        $isExpiredCondition = vsprintf(
            <<<'SQL'
                status IN ('%s', '%s')
                AND (
                    (due_date IS NOT NULL AND due_date < '%3$s')
                    OR (
                        due_date IS NULL
                        AND date IS NOT NULL
                        AND due_delay IS NOT NULL
                        AND DATE_ADD(date, INTERVAL due_delay DAY) < '%3$s'
                    )
                )
            SQL,
            [
                EstimateStatus::PENDING->value,
                EstimateStatus::SENT->value,
                CarbonImmutable::now()->format('Y-m-d'),
            ],
        );

        $placeholders = implode(',', array_fill(0, count($orderedStatuses), '?'));
        return $query
            ->orderByRaw(
                vsprintf(
                    <<<'SQL'
                    FIELD(
                        CASE
                            WHEN %1$s THEN ?
                            WHEN %2$s THEN ?
                            WHEN %3$s THEN ?
                            WHEN %4$s THEN ?
                            ELSE status
                        END,
                        %5$s
                    )
                    SQL,
                    [
                        $isObsoleteCondition,
                        $isTotallyBilledCondition,
                        $isPartiallyBilledCondition,
                        $isExpiredCondition,
                        $placeholders,
                    ],
                ),
                [
                    EstimateStatus::OBSOLETE->value,
                    EstimateStatus::INVOICED->value,
                    EstimateStatus::PARTIALLY_INVOICED->value,
                    EstimateStatus::EXPIRED->value,
                    ...$orderedStatuses,
                ],
            )
            ->orderByRaw(sprintf(
                '`date` IS NULL %s',
                $direction === 'asc' ? 'asc' : 'desc',
            ))
            ->orderBy('date', $direction)
            ->orderBy('id', $direction);
    }

    // ------------------------------------------------------
    // -
    // -    Overwritten methods
    // -
    // ------------------------------------------------------

    public function save(array $options = [])
    {
        // - Si le fichier existe déjà ou que la création est by-passée, on ne fait rien.
        $shouldGenerateFile = $options['generateFile'] ?? (
            $this->format === BillingFormat::current()->value
        );
        if (!$shouldGenerateFile || ($this->path !== null && is_file($this->path))) {
            return parent::save($options);
        }

        // - On valide avant d'uploader...
        if ($options['validate'] ?? true) {
            $this->validate();
        }
        $options = array_replace($options, ['validate' => false]);

        // - Génération du fichier PDF "physique".
        $this->generatePdfFile();

        $rollbackUpload = function () {
            try {
                $uuid = $this->getAttributeFromArray('uuid');
                @unlink(static::PDF_BASEPATH . DS . sprintf('%s.pdf', $uuid));
            } catch (\Throwable) {
                // NOTE: On ne fait rien si la suppression plante car de toute
                //       façon on est déjà dans un contexte d'erreur...
            }
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

        return true;
    }

    public function delete()
    {
        if (!$this->exists) {
            return true;
        }

        // - Un devis utilisé ne peut pas être supprimé.
        if ($this->is_used) {
            throw new \LogicException(
                sprintf("The estimate #%d is used and therefore cannot be deleted.", $this->id),
            );
        }

        $deleted = parent::delete();

        $uuid = $this->getAttributeFromArray('uuid');
        if ($this->forceDeleting && $deleted) {
            try {
                @unlink(static::PDF_BASEPATH . DS . sprintf('%s.pdf', $uuid));
            } catch (\Throwable) {
                // NOTE: On ne fait rien si la suppression plante, le fichier sera orphelin mais le
                //       plantage de sa suppression ne justifie pas qu'on undelete le matériel.
            }
        }

        return $deleted;
    }

    // ------------------------------------------------------
    // -
    // -    Méthodes de "repository"
    // -
    // ------------------------------------------------------

    /**
     * Crée un devis à partir d'un événement.
     *
     * @param Event  $booking        L'événement pour lequel le devis doit être créé.
     * @param User   $creator        L'utilisateur à l'origine de la création.
     * @param array  $additionalData Les données additionnelles utilisées pour la création.
     *
     * @return Estimate Le devis créé.
     */
    public static function createFromBooking(
        Event $booking,
        User $creator,
        array $additionalData = [],
    ): Estimate {
        Assert::true($booking->is_billable, "Booking is not billable.");

        $organization = Config::get('organization');
        $buyer = $booking instanceof Event
            ? $booking->mainBeneficiary
            : $booking->borrower;

        Assert::notNull($buyer, (
            "A beneficiary must be defined in the booking to be able to generate an estimate."
        ));
        Assert::false($buyer->trashed(), (
            "Cannot generate an estimate for a deleted beneficiary."
        ));
        Assert::true($buyer->is_invoiceable, (
            "Some required information is missing for the beneficiary, the estimate cannot be generated."
        ));

        // - S'il n'y a pas au moins une ligne "normale", la facture ne peut pas être générée.
        $hasBillableMaterial = $booking->materials->some(
            static function (EventMaterial $bookingMaterial) {
                if ($bookingMaterial->material->is_hidden_on_bill) {
                    $isFree = (
                        $bookingMaterial->unit_price->isZero() &&
                        $bookingMaterial->total_without_taxes->isZero()
                    );
                    if ($isFree) {
                        return false;
                    }
                }
                return true;
            },
        );
        $hasBillableExtra = $booking->extras->isNotEmpty();
        Assert::true($hasBillableMaterial || $hasBillableExtra, (
            "The booking must contain at least one material or line for an estimate to be generated."
        ));

        return dbTransaction(static function () use ($organization, $booking, $buyer, $creator, $additionalData) {
            $estimate = new static([
                'status' => EstimateStatus::DRAFT->value,

                // - Vendeur.
                'seller_legal_name' => $organization['name'],
                'seller_registration_id' => $organization['registrationId'],
                'seller_vat_number' => (
                    !$organization['isVatExempted']
                        ? $organization['vatNumber']
                        : null
                ),
                'seller_legal_type' => $organization['legalType']?->value,
                'seller_share_capital' => $organization['shareCapital'],
                'seller_activity_code' => $organization['activityCode'],
                'seller_trade_registry_city' => $organization['tradeRegistryCity'],
                'seller_street' => $organization['street'][0] ?? null,
                'seller_additional_street' => $organization['street'][1] ?? null,
                'seller_postal_code' => $organization['postalCode'],
                'seller_administrative_area' => $organization['administrativeArea'],
                'seller_locality' => $organization['locality'],
                'seller_country' => $organization['country'],
                'seller_email' => $organization['email'],
                'seller_phone' => $organization['phone'],

                // - Acheteur.
                'buyer_type' => $buyer->getBuyerType()->value,
                'buyer_reference' => $buyer->reference,
                'buyer_legal_name' => $buyer->getBuyerLegalName(),
                'buyer_is_public_entity' => $buyer->isBuyerPublicEntity(),
                'buyer_registration_id' => $buyer->getBuyerRegistrationId(),
                'buyer_vat_number' => $buyer->getBuyerVatNumber(),
                'buyer_service_code' => $buyer->getBuyerServiceCode(),
                'buyer_first_name' => $buyer->getBuyerFirstName(),
                'buyer_last_name' => $buyer->getBuyerLastName(),
                'buyer_street' => $buyer->getBuyerAddress()->getAddressLine1(),
                'buyer_additional_street' => $buyer->getBuyerAddress()->getAddressLine2(),
                'buyer_postal_code' => $buyer->getBuyerAddress()->getPostalCode(),
                'buyer_administrative_area' => $buyer->getBuyerAddress()->getAdministrativeArea(),
                'buyer_locality' => $buyer->getBuyerAddress()->getLocality(),
                'buyer_country' => $buyer->getBuyerAddress()->getCountry(),
                'buyer_email' => $buyer->getBuyerEmail(),
                'buyer_phone' => $buyer->getBuyerPhone(),

                // - Booking.
                'booking_title' => $booking instanceof Event ? $booking->title : null,
                'booking_reference' => $booking->reference,
                'booking_period' => $booking->operation_period,

                // - Remise.
                'total_without_global_discount' => $booking->total_without_global_discount,
                'global_discount_rate' => $booking->global_discount_rate,
                'global_discount_breakdown' => $booking->global_discount_breakdown,
                'total_global_discount' => $booking->total_global_discount,

                // - Régime de taxe global.
                'global_tax_regime' => $booking->global_tax_regime,
                'global_tax_exemption_code' => $booking->global_tax_exemption_code,
                'global_tax_exemption_reason' => $booking->global_tax_exemption_reason,

                // - Totaux.
                'total_without_taxes' => $booking->total_without_taxes,
                'total_taxes' => $booking->total_taxes,
                'total_with_taxes' => $booking->total_with_taxes,

                'is_vat_due_on_invoice' => $organization['isVatDueOnInvoice'] ?? false,
                'total_replacement' => $booking->total_replacement,
                'currency' => $booking->currency,
                'lang' => (
                    $buyer->user?->language
                        ?? Config::get('defaultLang')
                ),

                // - Métadonnées.
                'metadata' => [
                    'properties' => $booking->totalisable_properties
                        ->map(static fn (Property $property) => (
                            $property->serialize(Property::SERIALIZE_SUMMARY)
                        ))
                        ->values(),
                ],

                // - Données personnalisables.
                ...Arr::only($additionalData, [
                    'lang',
                    'due_date',
                    'special_mentions',
                ]),
            ]);

            // - Si aucune date d'échéance n'est définie, on fige les
            //   conditions de validité globales dans le devis.
            if ($estimate->due_date === null) {
                $estimate->due_delay = Config::get('estimates.validityDays') ?? 90;
            }

            $estimate->booking()->associate($booking);
            $estimate->buyer()->associate($buyer);
            $estimate->author()->associate($creator);

            if (!$estimate->save(['generateFile' => false])) {
                return false;
            }

            // - Attache le matériel au devis.
            foreach ($booking->materials as $bookingMaterial) {
                $material = $bookingMaterial->material;
                $estimateMaterial = new EstimateMaterial([
                    'material_id' => $bookingMaterial->material_id,
                    'name' => $bookingMaterial->name,
                    'reference' => $bookingMaterial->reference,
                    'description' => $material->description,
                    'quantity' => $bookingMaterial->quantity,
                    'unit_price' => $bookingMaterial->unit_price,
                    'degressive_rate' => $bookingMaterial->degressive_rate,
                    'unit_price_period' => $bookingMaterial->unit_price_period,
                    'total_without_discount' => $bookingMaterial->total_without_discount,
                    'discount_rate' => $bookingMaterial->discount_rate,
                    'total_discount' => $bookingMaterial->total_discount,
                    'total_without_taxes' => $bookingMaterial->total_without_taxes,
                    'tax_regime' => $bookingMaterial->tax_regime,
                    'tax_exemption_code' => $bookingMaterial->tax_exemption_code,
                    'taxes' => $bookingMaterial->taxes,
                    'unit_replacement_price' => $bookingMaterial->unit_replacement_price,
                    'total_replacement_price' => $bookingMaterial->total_replacement_price,
                    'is_hidden_on_bill' => $material->is_hidden_on_bill,
                ]);
                $estimate->materials()->save($estimateMaterial);
            }

            // - Attache les lignes extras au devis.
            foreach ($booking->extras as $bookingExtraLine) {
                $estimateExtraLine = new EstimateExtra([
                    'description' => $bookingExtraLine->description,
                    'is_service' => $bookingExtraLine->is_service,
                    'quantity' => $bookingExtraLine->quantity,
                    'unit_price' => $bookingExtraLine->unit_price,
                    'total_without_discount' => $bookingExtraLine->total_without_discount,
                    'discount_rate' => $bookingExtraLine->discount_rate,
                    'total_discount' => $bookingExtraLine->total_discount,
                    'total_without_taxes' => $bookingExtraLine->total_without_taxes,
                    'tax_regime' => $bookingExtraLine->tax_regime,
                    'tax_exemption_code' => $bookingExtraLine->tax_exemption_code,
                    'taxes' => $bookingExtraLine->taxes,
                ]);
                $estimate->extras()->save($estimateExtraLine);
            }

            // - On génère le PDF lié.
            $estimate->generatePdfFile();

            return $estimate->refresh();
        });
    }

    /**
     * Crée un devis "from scratch" (sans booking lié).
     *
     * @param Beneficiary $buyer   Le bénéficiaire / acheteur du devis.
     * @param array       $data    Les données du devis (lignes, dates, etc.).
     * @param User        $creator L'utilisateur à l'origine de la création.
     *
     * @return Estimate Le devis créé.
     */
    public static function createFromScratch(Beneficiary $buyer, array $data, User $creator): Estimate
    {
        $organization = Config::get('organization');

        Assert::false($buyer->trashed(), (
            "Cannot generate an estimate for a deleted beneficiary."
        ));
        Assert::true($buyer->is_invoiceable, (
            "Some required information is missing for the beneficiary, the estimate cannot be generated."
        ));

        // - Validation de la structure des données.
        $amountCheck = static function (mixed $value): bool {
            if (!V::floatVal()->validate($value)) {
                return false;
            }
            $value = Decimal::of($value);
            return (
                $value->isGreaterThan(-1_000_000_000_000) &&
                $value->isLessThan(1_000_000_000_000) &&
                $value->getScale() <= 2
            );
        };
        $rateCheck = static function (mixed $value, int $precision = 4): bool {
            if (!V::floatVal()->validate($value)) {
                return false;
            }
            $value = Decimal::of($value);
            return (
                $value->isGreaterThanOrEqualTo(0) &&
                $value->isLessThanOrEqualTo(100) &&
                $value->getScale() <= $precision
            );
        };
        $schema = V::schemaStrict(
            new Rule\Key('lang', null, false),
            new Rule\Key('due_date', null, false),
            new Rule\Key('lines', (
                V::arrayType()->notEmpty()->each(V::schemaStrict(
                    new Rule\Key('uuid', V::uuid()),
                    new Rule\Key('is_service', V::boolType()),
                    new Rule\Key('description'),
                    new Rule\Key('quantity', V::intVal()->min(1)),
                    new Rule\Key('unit_price', V::custom($amountCheck)),
                    new Rule\Key('discount_rate', V::custom($rateCheck)),
                    new Rule\Key('tax_regime', V::nullable(V::enumValue(TaxRegime::class))),
                    new Rule\Key('tax_exemption_code', V::nullable(V::custom(static fn ($value) => (
                        V::stringType()->validate($value) &&
                        VatExemptionCodeFactory::tryFrom($value) !== null
                    )))),
                    new Rule\Key('tax_id', V::nullable(V::custom(static fn ($value) => (
                        V::intVal()->validate($value) &&
                        Tax::includes($value)
                    )))),
                    new Rule\Key('taxes', ...[
                        V::nullable(V::arrayType()->each(V::schemaStrict(
                            new Rule\Key('name', V::notEmpty()->length(1, 30), false),
                            new Rule\Key('value', V::custom($rateCheck, 3)),
                        ))),
                        false,
                    ]),
                ))
            )),
            new Rule\Key('global_discount_rate', V::custom($rateCheck)),
            new Rule\Key('special_mentions', null, false),
        );
        $schema->assert($data, true);

        // - Régime de taxe global.
        $isVatExempted = (bool) ($organization['isVatExempted'] ?? false);
        $hasGlobalExemptionReason = (
            ($organization['vatExemptionCode'] ?? null) !== null ||
            ($organization['vatExemptionReason'] ?? null) !== null
        );
        $globalTaxRegime = !$isVatExempted ? null : (
            $hasGlobalExemptionReason
                ? TaxRegime::EXEMPTED->value
                : TaxRegime::OUT_OF_SCOPE->value
        );
        $globalTaxExemptionCode = $isVatExempted
            ? ($organization['vatExemptionCode']?->value ?? null)
            : null;
        $globalTaxExemptionReason = $isVatExempted
            ? ($organization['vatExemptionReason'] ?? null)
            : null;

        // - Lignes du devis.
        $linesData = collect($data['lines'])->map(
            static function (array $datum) use ($globalTaxRegime): array {
                $totalWithoutDiscount = Decimal::of($datum['unit_price'])
                    ->multipliedBy((int) $datum['quantity'])
                    ->toScale(2, RoundingMode::HALF_UP);

                $totalDiscount = $totalWithoutDiscount
                    ->multipliedBy(Decimal::of($datum['discount_rate'])->dividedBy(100, 6))
                    ->toScale(2, RoundingMode::HALF_UP);

                $totalWithoutTaxes = $totalWithoutDiscount
                    ->minus($totalDiscount)
                    ->toScale(2, RoundingMode::UNNECESSARY);

                // - Détails des taxes.
                if (array_key_exists('taxes', $datum)) {
                    $taxes = $datum['taxes'] === null ? null : (
                        array_map(
                            static fn (array $tax) => array_replace($tax, [
                                'value' => Decimal::of($tax['value']),
                            ]),
                            $datum['taxes'],
                        )
                    );
                } elseif ($globalTaxRegime === null && $datum['tax_regime'] === TaxRegime::STANDARD->value) {
                    $taxes = $datum['tax_id'] !== null
                        ? Tax::find($datum['tax_id'])?->asFlatArray()
                        : null;
                } else {
                    $taxes = null;
                }

                return array_replace($datum, [
                    'total_without_discount' => $totalWithoutDiscount,
                    'total_discount' => $totalDiscount,
                    'total_without_taxes' => $totalWithoutTaxes,
                    'taxes' => $taxes,
                ]);
            },
        );

        $totalWithoutGlobalDiscount = $linesData
            ->reduce(
                static fn (Decimal $currentTotal, array $line) => (
                    // NOTE: On prend bien ici le total AVEC remise de chaque ligne car
                    //       cet attribut retourne le total sans remise GLOBALE uniquement.
                    $currentTotal->plus($line['total_without_taxes'])
                ),
                Decimal::zero(),
            )
            ->toScale(2, RoundingMode::UNNECESSARY);

        $globalDiscountRate = Decimal::of($data['global_discount_rate']);
        if ($globalTaxRegime !== null) {
            if ($totalWithoutGlobalDiscount->isLessThanOrEqualTo(0) || $globalDiscountRate->isZero()) {
                $globalDiscountBreakdown = [];
            } else {
                $globalDiscountValue = $totalWithoutGlobalDiscount
                    ->multipliedBy($globalDiscountRate->dividedBy(100, 6))
                    ->toScale(2, RoundingMode::HALF_UP);

                $globalDiscountTotal = $totalWithoutGlobalDiscount
                    ->minus($globalDiscountValue)
                    ->toScale(2, RoundingMode::UNNECESSARY);

                $globalDiscountBreakdown = [[
                    'base' => $totalWithoutGlobalDiscount,
                    'value' => $globalDiscountValue,
                    'total' => $globalDiscountTotal,
                    'tax' => [
                        'type' => $globalTaxRegime,
                        'reason' => $globalTaxExemptionCode !== null
                            ? [$globalTaxExemptionCode]
                            : [],
                    ],
                ]];
            }
            $totalTaxes = null;
        } else {
            $buildBreakdown = static function (bool $raw) use ($linesData, $globalDiscountRate): array {
                if (!$raw && $globalDiscountRate->isZero()) {
                    return [];
                }
                $globalDiscountRateRatio = $globalDiscountRate->dividedBy(100, 6);

                $groups = [];
                foreach ($linesData as $line) {
                    // - Pas de remise sur une ligne négative.
                    if (!$raw && $line['total_without_taxes']->isLessThanOrEqualTo(0)) {
                        continue;
                    }

                    //
                    // -- Discount breakdown
                    //

                    $taxes = collect($line['taxes'] ?? [])
                        ->sort(static fn ($a, $b) => (
                            Decimal::of($a['value'])->compareTo($b['value'])
                        ))
                        ->values()
                        ->all();

                    // - Exemptions "explicites" ou la ligne n'a pas de taxe à taux définie
                    //   avec un régime standard, si c'est le cas, la remise globale s'applique
                    //   sur une exemption.
                    if ($line['tax_regime'] !== TaxRegime::STANDARD->value || empty($taxes)) {
                        [$regime, $exemptionCode] = $line['tax_regime'] !== TaxRegime::STANDARD->value
                            ? [$line['tax_regime'] ?? TaxRegime::EXEMPTED->value, $line['tax_exemption_code']]
                            : [TaxRegime::EXEMPTED->value, null];

                        if (!array_key_exists($regime, $groups)) {
                            $groups[$regime] = [
                                'base' => Decimal::zero(),
                                'tax' => [
                                    'type' => $regime,
                                    'reason' => [],
                                ],
                            ];
                        }
                        if (
                            $exemptionCode !== null
                            && !in_array($exemptionCode, $groups[$regime]['tax']['reason'], true)
                        ) {
                            $groups[$regime]['tax']['reason'][] = $exemptionCode;
                        }

                        /** @var Decimal $currentBase */
                        $currentBase = &$groups[$regime]['base'];
                        $currentBase = $currentBase->plus($line['total_without_taxes']);

                        continue;
                    }

                    $taxesCount = count($taxes);
                    $distributedBase = $line['total_without_taxes']
                        ->dividedBy($taxesCount, 8, RoundingMode::DOWN);

                    $allocatedBase = Decimal::zero();
                    foreach ($taxes as $index => $tax) {
                        $isLast = $index === $taxesCount - 1;

                        $identifier = md5(serialize([
                            $line['tax_regime'],
                            $tax['name'] ?? null,
                            (string) $tax['value']->toScale(3, RoundingMode::UNNECESSARY),
                        ]));
                        if (!array_key_exists($identifier, $groups)) {
                            $groups[$identifier] = [
                                'base' => Decimal::zero(),
                                'tax' => array_merge($tax, [
                                    'type' => $line['tax_regime'],
                                ]),
                            ];
                        }

                        /** @var Decimal $currentBase */
                        $currentBase = &$groups[$identifier]['base'];
                        $currentBase = $currentBase->plus($distributedBase);
                        $allocatedBase = $allocatedBase->plus($distributedBase);

                        // - Reliquat ajouté au groupe du plus gros taux (qui est le dernier vu le tri plus haut).
                        if ($isLast) {
                            $baseRemainder = $line['total_without_taxes']->minus($allocatedBase);
                            $currentBase = $currentBase->plus($baseRemainder);
                        }
                    }
                }

                $groups = collect($groups)
                    ->map(static function (array $group) use ($globalDiscountRateRatio) {
                        $base = $group['base']->toScale(2, RoundingMode::UNNECESSARY);

                        $value = Decimal::max($group['base'], 0)
                            ->multipliedBy($globalDiscountRateRatio)
                            ->toScale(2, RoundingMode::HALF_UP);

                        $total = $base
                            ->minus($value)
                            ->toScale(2, RoundingMode::UNNECESSARY);

                        return [
                            'base' => $base,
                            'value' => $value,
                            'total' => $total,
                            'tax' => $group['tax'],
                        ];
                    })
                    ->sort(static fn ($a, $b) => (
                        Decimal::of($b['value'])->compareTo($a['value'])
                    ));

                return !$raw
                    ? $groups->values()->all()
                    : $groups->all();
            };
            $globalDiscountBreakdown = $buildBreakdown(false);

            $rawDiscountBreakdown = $buildBreakdown(true);
            $rawTaxes = $linesData->reduce(
                static function (array $currentTaxes, array $line) use ($rawDiscountBreakdown) {
                    // - Exemptions "explicites" ou la ligne n'a pas de taxe définie
                    //   avec un régime standard, si c'est le cas, elle est exemptée sans motif.
                    if ($line['tax_regime'] !== TaxRegime::STANDARD->value || empty($line['taxes'])) {
                        $regime = $line['tax_regime'] !== TaxRegime::STANDARD->value
                            ? ($line['tax_regime'] ?? TaxRegime::EXEMPTED->value)
                            : TaxRegime::EXEMPTED->value;

                        if (array_key_exists($regime, $currentTaxes)) {
                            return $currentTaxes;
                        }

                        if (!array_key_exists($regime, $rawDiscountBreakdown)) {
                            throw new \LogicException("Unexpected missing discount entry for a billing line.");
                        }
                        $discountData = $rawDiscountBreakdown[$regime];

                        $currentTaxes[$regime] = [
                            'type' => $discountData['tax']['type'],
                            'reason' => $discountData['tax']['reason'],
                            'base' => $discountData['total'],
                        ];

                        return $currentTaxes;
                    }

                    // - Taxes normales.
                    foreach ($line['taxes'] as $tax) {
                        $identifier = md5(serialize([
                            $line['tax_regime'],
                            $tax['name'] ?? null,
                            (string) $tax['value']->toScale(3, RoundingMode::UNNECESSARY),
                        ]));
                        if (array_key_exists($identifier, $currentTaxes)) {
                            continue;
                        }

                        if (!array_key_exists($identifier, $rawDiscountBreakdown)) {
                            throw new \LogicException("Unexpected missing discount entry for a billing line.");
                        }
                        $discountData = $rawDiscountBreakdown[$identifier];

                        $currentTaxes[$identifier] = array_merge($tax, [
                            'type' => $line['tax_regime'],
                            'base' => $discountData['total'],
                        ]);
                    }

                    return $currentTaxes;
                },
                [],
            );

            $collator = new \Collator(container('i18n')->getLocale());
            $totalTaxes = collect($rawTaxes)
                ->map(static function (array $rawTax) {
                    if ($rawTax['type'] === TaxRegime::STANDARD->value) {
                        $rawTax['total'] = $rawTax['base']
                            ->multipliedBy(Decimal::of($rawTax['value'])->dividedBy(100, 5))
                            ->toScale(2, RoundingMode::HALF_UP);
                    }
                    return $rawTax;
                })
                ->sort(static function ($a, $b) use ($collator) {
                    $aIsExemption = $a['type'] !== TaxRegime::STANDARD->value;
                    $bIsExemption = $b['type'] !== TaxRegime::STANDARD->value;
                    if ($aIsExemption || $bIsExemption) {
                        if ($aIsExemption xor $bIsExemption) {
                            return $aIsExemption ? 1 : -1;
                        }
                        return $a['type'] <=> $b['type'];
                    }

                    $result = $collator->compare($a['name'] ?? '', $b['name'] ?? '');
                    return $result === 0
                        ? Decimal::of($b['value'])->compareTo($a['value'])
                        : $result;
                })
                ->values()
                ->all();
        }

        $totalGlobalDiscount = collect($globalDiscountBreakdown)
            ->reduce(
                static fn (Decimal $total, array $item) => (
                    $total->plus($item['value'])
                ),
                Decimal::zero(),
            )
            ->toScale(2, RoundingMode::UNNECESSARY);

        $totalWithoutTaxes = $totalWithoutGlobalDiscount
            ->minus($totalGlobalDiscount)
            ->toScale(2, RoundingMode::UNNECESSARY);

        $totalWithTaxes = collect($totalTaxes ?? [])
            ->reduce(
                static fn (Decimal $current, array $tax) => (
                    $tax['type'] === TaxRegime::STANDARD->value
                        ? $current->plus($tax['total'])
                        : $current
                ),
                $totalWithoutTaxes,
            )
            ->toScale(2, RoundingMode::UNNECESSARY);

        return dbTransaction(static function () use (
            $buyer,
            $organization,
            $creator,
            $data,
            $linesData,
            $globalDiscountRate,
            $globalTaxRegime,
            $globalTaxExemptionCode,
            $globalTaxExemptionReason,
            $totalWithoutGlobalDiscount,
            $globalDiscountBreakdown,
            $totalGlobalDiscount,
            $totalWithoutTaxes,
            $totalTaxes,
            $totalWithTaxes,
        ) {
            $estimate = new static([
                'status' => EstimateStatus::DRAFT->value,
                'due_date' => $data['due_date'] ?? null,

                // - Vendeur.
                'seller_legal_name' => $organization['name'],
                'seller_registration_id' => $organization['registrationId'],
                'seller_vat_number' => (
                    !$organization['isVatExempted']
                        ? $organization['vatNumber']
                        : null
                ),
                'seller_legal_type' => $organization['legalType']?->value,
                'seller_share_capital' => $organization['shareCapital'],
                'seller_activity_code' => $organization['activityCode'],
                'seller_trade_registry_city' => $organization['tradeRegistryCity'],
                'seller_street' => $organization['street'][0] ?? null,
                'seller_additional_street' => $organization['street'][1] ?? null,
                'seller_postal_code' => $organization['postalCode'],
                'seller_administrative_area' => $organization['administrativeArea'],
                'seller_locality' => $organization['locality'],
                'seller_country' => $organization['country'],
                'seller_email' => $organization['email'],
                'seller_phone' => $organization['phone'],

                // - Acheteur.
                'buyer_type' => $buyer->getBuyerType()->value,
                'buyer_reference' => $buyer->reference,
                'buyer_legal_name' => $buyer->getBuyerLegalName(),
                'buyer_is_public_entity' => $buyer->isBuyerPublicEntity(),
                'buyer_registration_id' => $buyer->getBuyerRegistrationId(),
                'buyer_vat_number' => $buyer->getBuyerVatNumber(),
                'buyer_service_code' => $buyer->getBuyerServiceCode(),
                'buyer_first_name' => $buyer->getBuyerFirstName(),
                'buyer_last_name' => $buyer->getBuyerLastName(),
                'buyer_street' => $buyer->getBuyerAddress()->getAddressLine1(),
                'buyer_additional_street' => $buyer->getBuyerAddress()->getAddressLine2(),
                'buyer_postal_code' => $buyer->getBuyerAddress()->getPostalCode(),
                'buyer_administrative_area' => $buyer->getBuyerAddress()->getAdministrativeArea(),
                'buyer_locality' => $buyer->getBuyerAddress()->getLocality(),
                'buyer_country' => $buyer->getBuyerAddress()->getCountry(),
                'buyer_email' => $buyer->getBuyerEmail(),
                'buyer_phone' => $buyer->getBuyerPhone(),

                // - Remise.
                'total_without_global_discount' => $totalWithoutGlobalDiscount,
                'global_discount_rate' => $globalDiscountRate,
                'global_discount_breakdown' => $globalDiscountBreakdown,
                'total_global_discount' => $totalGlobalDiscount,

                // - Régime de taxe global.
                'global_tax_regime' => $globalTaxRegime,
                'global_tax_exemption_code' => $globalTaxExemptionCode,
                'global_tax_exemption_reason' => $globalTaxExemptionReason,

                // - Totaux.
                'total_without_taxes' => $totalWithoutTaxes,
                'total_taxes' => $totalTaxes,
                'total_with_taxes' => $totalWithTaxes,

                'is_vat_due_on_invoice' => $organization['isVatDueOnInvoice'] ?? false,
                'special_mentions' => $data['special_mentions'] ?? null,
                'currency' => Config::get('currency'),
                'lang' => $data['lang'] ?? (
                    $buyer->user?->language
                        ?? Config::get('defaultLang')
                ),
            ]);

            // - Si aucune date d'échéance n'est définie, on fige les
            //   conditions de validité globales dans le devis.
            if ($estimate->due_date === null) {
                $estimate->due_delay = Config::get('estimates.validityDays') ?? 90;
            }

            $estimate->buyer()->associate($buyer);
            $estimate->author()->associate($creator);

            if (!$estimate->save(['generateFile' => false])) {
                return false;
            }
            $lines = $estimate->extras()->makeMany($linesData);

            $lineErrors = $lines
                ->filter(static fn ($line) => !$line->isValid())
                ->map(static fn ($line) => $line->validationErrors())
                ->all();

            if (!empty($lineErrors)) {
                throw new ValidationsException(['lines' => $lineErrors]);
            }

            // - Attache les lignes au devis.
            $estimate->extras()->saveMany($lines);

            // - On génère le PDF lié.
            $estimate->generatePdfFile();

            return $estimate->refresh();
        });
    }

    public static function getLastNumber(?int $year = null): ?string
    {
        $year = (int) ($year ?? CarbonImmutable::now()->format('Y'));

        $numbers = static::query()
            ->whereRaw(sprintf('YEAR(date) = %s', $year))
            ->whereNotNull('number')
            ->withTrashed()
            ->lockForUpdate()
            ->pluck('number');

        $last = null;
        foreach ($numbers as $number) {
            $numericNumber = (int) Arr::last(explode('-', $number));
            if ($last === null || $numericNumber > $last['numericNumber']) {
                $last = compact('number', 'numericNumber');
            }
        }

        return $last['number'] ?? null;
    }

    public static function getNextNumber(?int $year = null): string
    {
        $year = (int) ($year ?? CarbonImmutable::now()->format('Y'));

        $lastNumber = static::getLastNumber($year);
        if ($lastNumber !== null) {
            $lastNumber = (int) Arr::last(explode('-', $lastNumber));
        }

        return sprintf('D-%s-%05d', $year, ($lastNumber ?? 0) + 1);
    }

    // ------------------------------------------------------
    // -
    // -    Serialization
    // -
    // ------------------------------------------------------

    public function serialize(string $format = self::SERIALIZE_DEFAULT): array
    {
        $data = new DotArray($this->attributesForSerialization());

        // - La numérotation n'existe que sur les formats V3+.
        if ($this->format < BillingFormat::V3->value) {
            $data->delete('number');
        }

        // - Un brouillon n'a pas encore de numéro, ni de date d'émission.
        if ($this->is_draft) {
            $data->delete(['number', 'date']);
        }

        if ($format === self::SERIALIZE_EXCERPT) {
            return Arr::only($data->all(), [
                'id',
                'format',
                'status',
                'number',
                'date',
                'url',
                'has_final_invoice',
                'total_without_taxes',
                'global_tax_regime',
                'global_tax_exemption_code',
                'global_tax_exemption_reason',
                'total_taxes',
                'total_with_taxes',
                'currency',
                'created_at',
            ]);
        }

        // - Client
        $data['buyer'] = $this->buyer->serialize(
            $format === self::SERIALIZE_DETAILS
                ? Beneficiary::SERIALIZE_DEFAULT
                : Beneficiary::SERIALIZE_SUMMARY,
        );

        // - Factures liées (acomptes, solde ou simple facture directe)
        $data['related_invoices'] = $this->related_invoices
            ->map(static fn (Invoice $invoice) => (
                $invoice->serialize(Invoice::SERIALIZE_EXCERPT)
            ))
            ->values()
            ->all();

        return Arr::only($data->all(), [
            'id',
            'format',
            'status',
            'number',
            'date',
            'due_date',
            'due_delay',
            'url',
            'buyer',
            'has_final_invoice',
            'total_without_taxes',
            'global_tax_regime',
            'global_tax_exemption_code',
            'global_tax_exemption_reason',
            'total_taxes',
            'total_with_taxes',
            'related_invoices',
            'currency',
            'lang',
            'created_at',
        ]);
    }
}
