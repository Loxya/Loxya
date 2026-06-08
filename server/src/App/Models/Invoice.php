<?php
declare(strict_types=1);

namespace Loxya\Models;

use Adbar\Dot as DotArray;
use Brick\Math\BigDecimal as Decimal;
use Brick\Math\RoundingMode;
use Carbon\CarbonImmutable;
use horstoeko\zugferd\codelists\ZugferdAllowanceCodes;
use horstoeko\zugferd\codelists\ZugferdTextSubjectCodeQualifiers;
use horstoeko\zugferd\codelists\ZugferdUnitCodes;
use horstoeko\zugferd\codelists\ZugferdVatTypeCodes;
use horstoeko\zugferd\ZugferdProfiles;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Query\Expression;
use Illuminate\Support\Collection as CoreCollection;
use Loxya\Config\Config;
use Loxya\Contracts\Pdfable;
use Loxya\Contracts\Serializable;
use Loxya\Models\Casts\AsCountry;
use Loxya\Models\Casts\AsDecimal;
use Loxya\Models\Enums\BillingFormat;
use Loxya\Models\Enums\BillingType;
use Loxya\Models\Enums\EstimateStatus;
use Loxya\Models\Enums\InvoiceStatus;
use Loxya\Models\Enums\LegalEntityType;
use Loxya\Models\Traits\Serializer;
use Loxya\Services\I18n;
use Loxya\Support\Address;
use Loxya\Support\Addressing\AddressField;
use Loxya\Support\Arr;
use Loxya\Support\Assert;
use Loxya\Support\Collections\MaterialsCollection;
use Loxya\Support\Country;
use Loxya\Support\Data\ElectronicInvoiceFormat;
use Loxya\Support\Data\LegalType\LegalTypeFactory;
use Loxya\Support\Data\LegalType\LegalTypeInterface;
use Loxya\Support\Invoicing\BuyerInterface;
use Loxya\Support\Invoicing\FacturxBuilder;
use Loxya\Support\Invoicing\InvoiceType;
use Loxya\Support\Invoicing\LegalMention;
use Loxya\Support\Invoicing\PaymentMethod;
use Loxya\Support\Invoicing\TaxRegime;
use Loxya\Support\Invoicing\VatDueDateCode;
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
use Loxya\Support\Xml\Xml;
use Loxya\Support\Xml\XmlInterface;
use NumNum\UBL as Ubl;
use Respect\Validation\Rules as Rule;

/**
 * Facture.
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
 * @property value-of<InvoiceStatus> $status
 * @property string|null $number
 * @property string|null $order_number
 * @property CarbonImmutable|null $date
 * @property string|null $due_date
 * @property int|null $due_delay
 * @property-read ?string $path
 * @property-read ?array{ pdf: string, ubl: string|null } $url
 * @property string $seller_legal_name
 * @property string|null $seller_registration_id
 * @property string|null $seller_vat_number
 * @property string|null $seller_routing_identifier
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
 * @property string|null $buyer_routing_identifier
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
 * @property bool $is_electronic
 * @property bool $is_prepayment
 * @property-read bool $is_draft
 * @property-read bool $is_obsolete
 * @property-read bool $is_prepayment_final
 * @property-read bool $is_paid
 * @property-read bool $is_overdue
 * @property-read bool $is_cancelled
 * @property bool $is_credit_note
 * @property bool $is_vat_due_on_invoice
 * @property int|null $parent_invoice_id
 * @property-read Invoice|null $parent_invoice
 * @property-read Invoice|null $parentInvoice
 * @property int|null $parent_estimate_id
 * @property-read Estimate|null $parent_estimate
 * @property-read Estimate|null $parentEstimate
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
 * @property-read User|null $author
 * @property array $metadata
 * @property-read CarbonImmutable $created_at
 * @property-read CarbonImmutable|null $updated_at
 * @property-read CarbonImmutable|null $deleted_at
 *
 * @property-read Collection<array-key, InvoiceMaterial> $materials
 * @property-read Collection<array-key, InvoiceExtra> $extras
 * @property-read Collection<array-key, Invoice> $prepayment_invoices
 * @property-read Collection<array-key, Invoice> $prepaymentInvoices
 * @property-read Collection<array-key, InvoicePayment> $payments
 * @property-read Collection<array-key, Property> $totalisable_properties
 * @property-read Invoice|null $childInvoice
 * @property-read Invoice|null $child_invoice
 *
 * @method static Builder|static search(string|string[] $term)
 * @method static Builder|static withStatus(InvoiceStatus[] | InvoiceStatus $status)
 */
final class Invoice extends BaseModel implements Serializable, Pdfable, BuyerInterface
{
    use Serializer;
    use SoftDeletes;

    // - Types de sérialisation.
    public const SERIALIZE_EXCERPT = 'excerpt';
    public const SERIALIZE_DEFAULT = 'default';
    public const SERIALIZE_DETAILS = 'details';

    private const PDF_BASEPATH = (
        DATA_FOLDER . DS . 'invoices'
    );

    protected $attributes = [
        'is_prepayment' => false,
        'is_credit_note' => false,
    ];

    public function __construct(array $attributes = [])
    {
        $attributes['uuid'] ??= (string) Str::uuid();
        $attributes['format'] ??= BillingFormat::current()->value;
        $attributes['status'] ??= InvoiceStatus::DRAFT->value;
        parent::__construct($attributes);

        $this->validation = fn () => [
            'uuid' => V::custom([$this, 'checkUuid']),
            'format' => V::enumValue(BillingFormat::class),
            'status' => V::custom([$this, 'checkStatus']),
            'number' => V::custom([$this, 'checkNumber']),
            'order_number' => V::nullable(V::length(2, 50)),
            'date' => V::custom([$this, 'checkDate']),
            'due_date' => V::custom([$this, 'checkDueDate']),
            'due_delay' => V::custom([$this, 'checkDueDelay']),
            'seller_legal_name' => V::notEmpty()->length(2, 100),
            'seller_registration_id' => V::custom([$this, 'checkSellerRegistrationId']),
            'seller_vat_number' => V::custom([$this, 'checkSellerVatNumber']),
            'seller_routing_identifier' => V::custom([$this, 'checkSellerRoutingIdentifier']),
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
            'buyer_routing_identifier' => V::custom([$this, 'checkBuyerRoutingIdentifier']),
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
            'is_electronic' => V::boolType(),
            'is_prepayment' => V::custom([$this, 'checkIsPrepayment']),
            'is_credit_note' => V::custom([$this, 'checkIsCreditNote']),
            'is_vat_due_on_invoice' => V::boolType(),
            'parent_estimate_id' => V::custom([$this, 'checkParentEstimateId']),
            'parent_invoice_id' => V::custom([$this, 'checkParentInvoiceId']),
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
        V::create()
            ->in([
                InvoiceStatus::DRAFT->value,
                InvoiceStatus::PENDING->value,
                InvoiceStatus::SENT->value,
            ])
            ->check($value);

        // - Si on est dans un update et que le champ n'a pas changé, on laisse passer.
        if ($this->exists && !$this->isDirty('status')) {
            return true;
        }

        if ($value === InvoiceStatus::DRAFT->value) {
            // - Une fois finalisé, une facture ne peut plus revenir à l'état "brouillon".
            if ($this->exists && $this->getOriginal('status') !== InvoiceStatus::DRAFT->value) {
                return false;
            }

            // - Les factures d'acompte et les avoirs ne passent pas par l'état "brouillon".
            $isPrepaymentRaw = $this->getAttributeUnsafeValue('is_prepayment');
            $isPrepayment = V::boolType()->validate($isPrepaymentRaw) ? $isPrepaymentRaw : false;
            $isCreditNoteRaw = $this->getAttributeUnsafeValue('is_credit_note');
            $isCreditNote = V::boolType()->validate($isCreditNoteRaw) ? $isCreditNoteRaw : false;
            return !$isPrepayment && !$isCreditNote;
        }

        // - On ne peut pas remettre une facture en "en attente d'envoi"
        //   si des paiements ont déjà été enregistrés dessus.
        $payments = collect($this->exists ? $this->payments : []);
        return $value !== InvoiceStatus::PENDING->value || $payments->isEmpty();
    }

    public function checkDate()
    {
        // - Un brouillon n'a pas de date d'émission.
        $statusRaw = $this->getAttributeUnsafeValue('status');
        return $statusRaw !== InvoiceStatus::DRAFT->value
            ? V::notEmpty()->dateTime()
            : V::nullType();
    }

    public function checkNumber(mixed $value)
    {
        // - Un brouillon n'a pas de numéro.
        $statusRaw = $this->getAttributeUnsafeValue('status');
        if ($statusRaw === InvoiceStatus::DRAFT->value) {
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

        return !$alreadyExists ?: 'invoice-number-already-in-use';
    }

    public function checkDueDate(mixed $value)
    {
        V::nullable(V::date())->check($value);

        // - Si c'est un avoir, pas de délai de paiement.
        $isCreditNoteRaw = $this->getAttributeUnsafeValue('is_credit_note');
        $isCreditNote = V::boolType()->validate($isCreditNoteRaw) ? $isCreditNoteRaw : false;
        if ($isCreditNote) {
            return V::nullType();
        }

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
            //   conditions de paiement (date ou délai)
            $dueDaysRaw = $this->getAttributeUnsafeValue('due_delay');
            return $dueDaysRaw !== null ?: 'due-date-or-due-delay-required';
        }
        $dueDate = (new CarbonImmutable($value))->endOfDay();

        // - Si la date de la facture est absente (brouillon) ou invalide,
        //   on ne peut pas aller plus loin sur la cohérence relative.
        $dateRaw = $this->getAttributeUnsafeValue('date');
        if ($dateRaw === null || !V::datetime()->validate($dateRaw)) {
            return true;
        }

        return $dueDate->greaterThanOrEqualTo($dateRaw)
            ?: 'due-date-must-be-after-invoice-date';
    }

    public function checkDueDelay(mixed $value)
    {
        V::nullable(V::intVal()->min(0))->check($value);

        // - Si c'est un avoir, pas de délai de paiement.
        $isCreditNoteRaw = $this->getAttributeUnsafeValue('is_credit_note');
        $isCreditNote = V::boolType()->validate($isCreditNoteRaw) ? $isCreditNoteRaw : false;
        if ($isCreditNote) {
            return V::nullType();
        }

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

    public function checkSellerRoutingIdentifier(mixed $value)
    {
        V::nullable(V::stringVal())->check($value);

        // - Si la facture n'est pas électronique, pas d'identifiant de routage.
        $isElectronic = (bool) $this->getAttributeUnsafeValue('is_electronic');
        if (!$isElectronic) {
            return V::nullType();
        }

        // - Si le pays du vendeur n'est pas valide, on ne peut pas aller plus loin.
        $rawSellerCountryCode = $this->getAttributeFromArray('seller_country');
        $sellerCountry = V::countryCode()->validate($rawSellerCountryCode)
            ? new Country($rawSellerCountryCode)
            : null;

        if ($sellerCountry === null) {
            return true;
        }

        // - S'il n'y a pas de facturation électronique prise en charge
        //   dans le pays du vendeur, le champ doit être à `null`.
        if (!$sellerCountry->useElectronicInvoices()) {
            return V::nullType();
        }

        // - Si la facture est hors du champ d'application de la
        //   T.V.A., on exige pas de valeur.
        if ($value === null) {
            $globalTaxRegime = $this->getAttributeUnsafeValue('global_tax_regime');
            if (!V::nullable(V::enumValue(TaxRegime::class))->validate($globalTaxRegime)) {
                return true;
            }
            return $globalTaxRegime === TaxRegime::OUT_OF_SCOPE->value ?: 'mandatory-field';
        }

        return V::notEmpty()->invoiceRoutingIdentifier($sellerCountry);
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

        /** @var Beneficiary|null $buyer */
        $buyer = Beneficiary::withTrashed()->find($value);
        if ($buyer === null) {
            return false;
        }

        return !$this->exists || $this->isDirty('buyer_id')
            ? ($buyer->is_invoiceable && !$buyer->trashed())
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

    public function checkBuyerRoutingIdentifier(mixed $value)
    {
        V::nullable(V::stringVal())->check($value);

        // - Si la facture n'est pas électronique, pas d'identifiant de routage.
        $isElectronic = (bool) $this->getAttributeUnsafeValue('is_electronic');
        if (!$isElectronic) {
            return V::nullType();
        }

        // - Si le type n'est pas valide, on ne peut pas aller plus loin.
        $rawBuyerType = $this->getAttributeFromArray('buyer_type');
        if (!V::enumValue(LegalEntityType::class)->validate($rawBuyerType)) {
            return true;
        }

        // - Si c'est un particulier, il ne doit pas y avoir d'identifiant de routage.
        if ($rawBuyerType === LegalEntityType::INDIVIDUAL->value) {
            return V::nullType();
        }

        // - Si le pays du vendeur n'est pas valide, on ne peut pas aller plus loin.
        $rawSellerCountryCode = $this->getAttributeFromArray('seller_country');
        $sellerCountry = V::countryCode()->validate($rawSellerCountryCode)
            ? new Country($rawSellerCountryCode)
            : null;

        if ($sellerCountry === null) {
            return true;
        }

        // - S'il n'y a pas de facturation électronique prise en charge
        //   dans le pays du vendeur, le champ doit être à `null`.
        if (!$sellerCountry->useElectronicInvoices()) {
            return V::nullType();
        }

        // - Si le pays de l'acheteur n'est pas valide, on ne peut pas aller plus loin.
        $rawBuyerCountryCode = $this->getAttributeFromArray('buyer_country');
        $buyerCountry = V::countryCode()->validate($rawBuyerCountryCode)
            ? new Country($rawBuyerCountryCode)
            : null;

        if ($buyerCountry === null) {
            return true;
        }

        // - Si la valeur est vide, on vérifie si elle est requise.
        if ($value === null) {
            // - Si l'acheteur n'est pas dans le même pays, pas d'identifiant requis.
            if (!$sellerCountry->isSame($buyerCountry, withInherited: true)) {
                return true;
            }

            // - Si la facture est hors du champ d'application de la T.V.A., on exige pas de valeur.
            $globalTaxRegime = $this->getAttributeUnsafeValue('global_tax_regime');
            if (!V::nullable(V::enumValue(TaxRegime::class))->validate($globalTaxRegime)) {
                return true;
            }
            return $globalTaxRegime === TaxRegime::OUT_OF_SCOPE->value ?: 'mandatory-field';
        }

        return V::notEmpty()->invoiceRoutingIdentifier($buyerCountry);
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

        return match ($this->booking_type) {
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

    public function checkBookingIsFullDays(mixed $value)
    {
        // - Si pas de type de booking, le champ doit être `null`.
        $bookingType = $this->getAttributeUnsafeValue('booking_type');
        return $bookingType === null ? V::nullType() : V::boolType();
    }

    public function checkIsPrepayment(mixed $value)
    {
        V::boolType()->check($value);

        // - Si ce n'est pas une facture d'acompte, on est bon.
        if ($value === false) {
            return true;
        }

        $formatRaw = $this->getAttributeUnsafeValue('format');
        $format = !V::enumValue(BillingFormat::class)->validate($formatRaw)
            ? BillingFormat::current()->value
            : $formatRaw;

        // - Pas de support des factures d'acompte dans les anciennes factures.
        if ($format < BillingFormat::V3->value) {
            return false;
        }

        // - Pas de support des factures d'acompte pour les entités publiques (B2G).
        $buyerIsPublicEntity = (bool) $this->getAttributeUnsafeValue('buyer_is_public_entity');
        if ($buyerIsPublicEntity === true) {
            return false;
        }

        // - La facture d'acompte doit impérativement être liée à un devis parent.
        $parentEstimateId = $this->getAttributeUnsafeValue('parent_estimate_id');
        return $parentEstimateId !== null;
    }

    public function checkIsCreditNote(mixed $value)
    {
        V::boolType()->check($value);

        $formatRaw = $this->getAttributeUnsafeValue('format');
        $format = !V::enumValue(BillingFormat::class)->validate($formatRaw)
            ? BillingFormat::current()->value
            : $formatRaw;

        // - Si c'est une ancienne facture ou que ce n'est pas une facture d'avoir, on est bon.
        if ($format < BillingFormat::V3->value || $value === false) {
            return true;
        }

        // - La facture d'avoir doit impérativement être liée à une facture parente.
        $parentInvoiceId = $this->getAttributeUnsafeValue('parent_invoice_id');
        return $parentInvoiceId !== null;
    }

    public function checkParentEstimateId(mixed $value)
    {
        V::nullable(V::intVal())->check($value);

        $formatRaw = $this->getAttributeUnsafeValue('format');
        $format = !V::enumValue(BillingFormat::class)->validate($formatRaw)
            ? BillingFormat::current()->value
            : $formatRaw;

        if ($format < BillingFormat::V3->value) {
            return V::nullType();
        }

        // - La facture d'acompte doit impérativement référencer un devis parent.
        $isPrepaymentRaw = $this->getAttributeUnsafeValue('is_prepayment');
        $isPrepayment = V::boolType()->validate($isPrepaymentRaw) ? $isPrepaymentRaw : false;
        if ($isPrepayment && $value === null) {
            return false;
        }

        // - Si pas de devis parent, rien de plus à vérifier.
        if ($value === null) {
            return true;
        }

        /** @var Estimate|null $estimate */
        $estimate = Estimate::withTrashed()->find($value);
        if ($estimate === null) {
            return false;
        }

        // - On ne peut pas générer d'acompte pour un devis dans un ancien format.
        if ($estimate->format < BillingFormat::V3->value) {
            return false;
        }

        // - Le devis parent ne doit pas être un brouillon.
        if ($estimate->is_draft) {
            return false;
        }

        // - Si la date est valide, elle doit être postérieure à la date du devis parent.
        $dateRaw = $this->getAttributeUnsafeValue('date');
        if (
            $dateRaw !== null
            && V::datetime()->validate($dateRaw)
            && !$estimate->date->isBefore($dateRaw)
        ) {
            return false;
        }

        // - Si on est dans un update et que le champ n'a pas changé, on laisse passer.
        if ($this->exists && !$this->isDirty('parent_estimate_id')) {
            return true;
        }

        // - Si ce n'est pas un avoir, on vérifie le solde du devis.
        $isCreditNoteRaw = $this->getAttributeUnsafeValue('is_credit_note');
        $isCreditNote = V::boolType()->validate($isCreditNoteRaw) ? $isCreditNoteRaw : false;
        if (!$isCreditNote) {
            $totalWithTaxesRaw = $this->getAttributeUnsafeValue('total_with_taxes');
            $totalWithTaxes = V::floatVal()->validate($totalWithTaxesRaw)
                ? Decimal::of($totalWithTaxesRaw)
                : null;

            if ($totalWithTaxes !== null) {
                $relatedInvoices = $estimate
                    ->relatedInvoices()
                    ->when($this->exists, fn (Builder $subQuery) => (
                        $subQuery->where('id', '!=', $this->id)
                    ))
                    ->get();

                $billedTotal = $relatedInvoices->reduce(
                    static fn (Decimal $carry, Invoice $invoice) => (
                        $invoice->is_credit_note
                            ? $carry->minus($invoice->total_with_taxes)
                            : $carry->plus($invoice->total_with_taxes)
                    ),
                    Decimal::zero(),
                );

                $hasActiveInvoices = $relatedInvoices->contains(
                    static fn (Invoice $invoice) => (
                        !$invoice->is_credit_note &&
                        !$invoice->is_cancelled
                    ),
                );

                // - S'il n'y a plus rien à facturer, on ne peut pas lier le devis.
                $remainingAmount = $estimate->total_with_taxes->minus($billedTotal);
                $hasRemainingAmount = (
                    $estimate->total_with_taxes->isZero()
                        ? ($remainingAmount->isZero() && !$hasActiveInvoices)
                        : (
                            $estimate->total_with_taxes->isPositive()
                                ? $remainingAmount->isGreaterThan(0)
                                : $remainingAmount->isLessThan(0)
                        )
                );
                if (!$hasRemainingAmount) {
                    return false;
                }

                if ($isPrepayment) {
                    // - Pas d'acompte si une facture finale (non-acompte, non-avoir, non-annulée) existe déjà.
                    $hasFinalInvoice = $relatedInvoices->contains(
                        static fn (Invoice $invoice) => (
                            !$invoice->is_prepayment &&
                            !$invoice->is_credit_note &&
                            !$invoice->is_cancelled
                        ),
                    );
                    if ($hasFinalInvoice) {
                        return false;
                    }

                    // - Pas d'acompte pour un devis négatif.
                    if ($estimate->total_with_taxes->isNegativeOrZero()) {
                        return false;
                    }

                    // - Un acompte ne doit pas être négatif.
                    if (!$totalWithTaxes->isPositive()) {
                        return false;
                    }

                    // - Un acompte ne doit pas solder le devis.
                    if ($totalWithTaxes->isGreaterThanOrEqualTo($remainingAmount)) {
                        return false;
                    }
                } else {
                    // - La facture de solde doit exactement solder l'entièreté du devis.
                    $expectedTotal = $estimate->total_with_taxes->minus($billedTotal);
                    if (!$totalWithTaxes->isEqualTo($expectedTotal)) {
                        return false;
                    }
                }
            }
        }

        return !$estimate->trashed();
    }

    public function checkParentInvoiceId(mixed $value)
    {
        V::nullable(V::intVal())->check($value);

        $formatRaw = $this->getAttributeUnsafeValue('format');
        $format = !V::enumValue(BillingFormat::class)->validate($formatRaw)
            ? BillingFormat::current()->value
            : $formatRaw;

        if ($format < BillingFormat::V3->value) {
            return V::nullType();
        }

        // - Si ce n'est pas une facture d'avoir, il ne peut pas y avoir de facture parente.
        $isCreditNoteRaw = $this->getAttributeUnsafeValue('is_credit_note');
        $isCreditNote = V::boolType()->validate($isCreditNoteRaw) ? $isCreditNoteRaw : false;
        if (!$isCreditNote) {
            return V::nullType();
        }

        // - La facture d'avoir doit impérativement référencer sa facture
        //   parent, mais il ne peut pas être lui-même son parent.
        if ($value === null || ($this->exists && $value === $this->id)) {
            return false;
        }

        /** @var Invoice|null $invoice */
        $invoice = Invoice::withTrashed()->find($value);
        if ($invoice === null) {
            return false;
        }

        // - On ne peut pas créer d'avoir à partir d'un autre avoir ou d'une facture négative.
        if ($invoice->is_credit_note || $invoice->total_with_taxes->isNegative()) {
            return false;
        }

        // - La facture parente ne doit pas être un brouillon.
        if ($invoice->is_draft) {
            return false;
        }

        // - Si la date est valide, elle doit être postérieure à la date de la facture parente.
        $dateRaw = $this->getAttributeUnsafeValue('date');
        if (
            $dateRaw !== null
            && V::datetime()->validate($dateRaw)
            && !$invoice->date->isBefore($dateRaw)
        ) {
            return false;
        }

        // - Si on est dans un update et que le champ n'a pas changé, on laisse passer.
        if ($this->exists && !$this->isDirty('parent_invoice_id')) {
            return true;
        }

        // - On ne peut pas créer un avoir pour une facture ayant déjà un avoir.
        if ($invoice->child_invoice !== null) {
            return false;
        }

        // - On ne peut pas créer un avoir d'une facture d'acompte pour
        //   lequel le devis a eu une facture finale.
        if ($invoice->is_prepayment && $invoice->parent_estimate?->has_final_invoice) {
            return false;
        }

        // - L'avoir doit annuler l'entièreté du solde de la facture parente.
        $totalWithTaxesRaw = $this->getAttributeUnsafeValue('total_with_taxes');
        $totalWithTaxes = V::floatVal()->validate($totalWithTaxesRaw)
            ? Decimal::of($totalWithTaxesRaw)
            : null;
        if ($totalWithTaxes !== null && !$totalWithTaxes->isEqualTo($invoice->total_with_taxes)) {
            return false;
        }

        return !$invoice->trashed();
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

        // - Seules les factures V1 sont concernées.
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

        // - Seules les factures V1 sont concernées.
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
                    })),
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

    protected $with = [
        'payments',
        'childInvoice',
    ];

    public function booking(): MorphTo
    {
        return $this->morphTo('booking')
            ->withTrashed();
    }

    public function materials(): HasMany
    {
        return $this->hasMany(InvoiceMaterial::class, 'invoice_id')
            ->orderBy('id');
    }

    public function extras(): HasMany
    {
        return $this->hasMany(InvoiceExtra::class, 'invoice_id')
            ->orderBy('id');
    }

    public function prepaymentInvoices(): BelongsToMany
    {
        return $this
            ->belongsToMany(
                Invoice::class,
                'invoice_prepayments',
                'invoice_id',
                'prepayment_invoice_id',
            )
            ->using(InvoicePrepayment::class)
            ->withTrashed()
            ->customOrderBy('date', 'asc');
    }

    public function buyer(): BelongsTo
    {
        return $this->belongsTo(Beneficiary::class, 'buyer_id')
            ->withTrashed();
    }

    public function parentEstimate(): BelongsTo
    {
        return $this->belongsTo(Estimate::class, 'parent_estimate_id')
            ->withTrashed();
    }

    public function parentInvoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class, 'parent_invoice_id')
            ->withTrashed();
    }

    public function childInvoice(): HasOne
    {
        return $this->hasOne(Invoice::class, 'parent_invoice_id')
            ->customOrderBy('date', 'desc')
            ->withTrashed();
    }

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'author_id')
            ->withTrashed();
    }

    public function payments(): HasMany
    {
        return $this->hasMany(InvoicePayment::class, 'invoice_id')
            ->orderBy('date')
            ->orderBy('id');
    }

    // ------------------------------------------------------
    // -
    // -    Mutators
    // -
    // ------------------------------------------------------

    protected $appends = [
        'url',
        'is_overdue',
        'is_cancelled',
    ];

    protected $casts = [
        'uuid' => 'string',
        'format' => 'integer',
        'number' => 'string',
        'order_number' => 'string',
        'status' => 'string',
        'date' => 'immutable_datetime',
        'due_date' => 'string',
        'due_delay' => 'integer',
        'seller_legal_name' => 'string',
        'seller_registration_id' => 'string',
        'seller_vat_number' => 'string',
        'seller_routing_identifier' => 'string',
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
        'buyer_routing_identifier' => 'string',
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
        'is_electronic' => 'boolean',
        'is_prepayment' => 'boolean',
        'is_credit_note' => 'boolean',
        'is_vat_due_on_invoice' => 'boolean',
        'parent_invoice_id' => 'integer',
        'parent_estimate_id' => 'integer',
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

    public function getIsPaidAttribute(): bool
    {
        $absTotalWithTaxes = $this->total_with_taxes->abs();
        if (!$this->exists || $absTotalWithTaxes->isZero()) {
            return false;
        }

        $totalPaid = $this->payments->reduce(
            static fn (Decimal $carry, InvoicePayment $payment) => (
                $carry->plus($payment->amount)
            ),
            Decimal::zero(),
        );
        return $totalPaid->isGreaterThanOrEqualTo($absTotalWithTaxes);
    }

    public function getIsOverdueAttribute(): bool
    {
        // - Un brouillon ne peut donc pas être considéré comme "en retard".
        if ($this->is_draft) {
            return false;
        }

        // - Si la facture est annulée ou déjà payée, elle n'est pas en retard.
        if ($this->is_cancelled || $this->is_paid) {
            return false;
        }

        // - Calcul de la date d'échéance effective.
        $dueDate = null;
        if ($this->due_date !== null) {
            $dueDate = CarbonImmutable::parse($this->due_date);
        } elseif ($this->due_delay !== null) {
            $dueDate = $this->date->addDays($this->due_delay);
        }

        // - Si on a pas l'information de la date d'échéance,
        //   le paiement de la facture ne peut pas être en retard.
        if ($dueDate === null) {
            return false;
        }

        $today = CarbonImmutable::now()->startOfDay();
        return $dueDate->isBefore($today);
    }

    public function getStatusAttribute(string $value): string
    {
        if ($value === InvoiceStatus::DRAFT->value) {
            return $this->is_obsolete
                ? InvoiceStatus::OBSOLETE->value
                : InvoiceStatus::DRAFT->value;
        }

        if ($this->is_cancelled) {
            return InvoiceStatus::CANCELLED->value;
        }

        // - Statuts "partiellement payée" /  "payée".
        $absTotalWithTaxes = $this->total_with_taxes->abs();
        if (!$absTotalWithTaxes->isZero() && $this->payments->isNotEmpty()) {
            $totalPaid = $this->payments->reduce(
                static fn (Decimal $carry, InvoicePayment $payment) => (
                    $carry->plus($payment->amount)
                ),
                Decimal::zero(),
            );

            if ($totalPaid->isGreaterThanOrEqualTo($absTotalWithTaxes)) {
                return InvoiceStatus::PAID->value;
            }
            if ($totalPaid->isGreaterThan(0)) {
                return InvoiceStatus::PARTIALLY_PAID->value;
            }
        }

        // - Le paiement de la facture est-il en retard ?
        if ($value === InvoiceStatus::SENT->value && $this->is_overdue) {
            return InvoiceStatus::OVERDUE->value;
        }

        return $value;
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

    /** @return ?array{pdf: string, ubl: string|null} */
    public function getUrlAttribute(): ?array
    {
        if (!$this->exists) {
            return null;
        }

        $baseUri = Config::getBaseUri();
        return [
            'pdf' => (string) $baseUri->withPath(sprintf('/invoices/%s/pdf', $this->id)),
            'ubl' => $this->supportsUbl()
                ? (string) $baseUri->withPath(sprintf('/invoices/%s/ubl', $this->id))
                : null,
        ];
    }

    public function getIsDraftAttribute(): bool
    {
        $rawStatus = $this->getAttributeFromArray('status');
        return $rawStatus === InvoiceStatus::DRAFT->value;
    }

    public function getIsObsoleteAttribute(): bool
    {
        if (!$this->is_draft) {
            return false;
        }

        // - Un brouillon devient "obsolète" lorsqu'une date d'échéance fixe a été
        //   définie et qu'elle est désormais dépassée (un délai n'entre pas en jeu
        //   tant que la facture n'a pas été finalisée et donc datée).
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

    public function getIsPrepaymentFinalAttribute(): bool
    {
        if ($this->is_prepayment || $this->parent_estimate_id === null) {
            return false;
        }
        return $this->prepaymentInvoices->isNotEmpty();
    }

    public function getIsCancelledAttribute(): bool
    {
        return $this->child_invoice !== null;
    }

    public function getParentEstimateAttribute(): Estimate|null
    {
        return $this->getRelationValue('parentEstimate');
    }

    public function getParentInvoiceAttribute(): Invoice|null
    {
        return $this->getRelationValue('parentInvoice');
    }

    /** @return Collection<array-key, InvoiceMaterial> */
    public function getMaterialsAttribute(): Collection
    {
        return $this->getRelationValue('materials');
    }

    /** @return Collection<array-key, InvoiceExtra> */
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
            function ($tax) {
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

    /** @return Collection<array-key, InvoicePayment> */
    public function getPaymentsAttribute(): Collection
    {
        return $this->getRelationValue('payments');
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

    public function getChildInvoiceAttribute(): Invoice|null
    {
        return $this->getRelationValue('childInvoice');
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
        return $this->getBuyerType() === LegalEntityType::COMPANY
            ? $this->buyer_routing_identifier
            : null;
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

    private function generatePdfXml(?I18n $i18n = null): string|null
    {
        $i18n ??= new I18n($this->lang);

        // - Si la facture n'est pas une facture électronique ou
        //   que c'est un brouillon, on ne va pas plus loin.
        if ($this->is_draft || !$this->is_electronic) {
            return null;
        }

        // - Si c'est une ancienne facture, il n'y a pas de e-invoice possible.
        if ($this->format < BillingFormat::V3->value) {
            return null;
        }

        // - Si on a n'a pas de numéro d'enregistrement pour le vendeur,
        //   on ne peut pas générer de facture électronique en son nom.
        if ($this->seller_registration_id === null) {
            return null;
        }

        // - Si le client est une entité publique, on ne peut pas générer de Factur-X
        //   tant que les cadres de facturation ne sont pas normalisés sur Chorus Pro.
        //   TODO: Supprimer cette exception quand Chorus Pro prendra en charge les
        //         cadres de facturation prévus dans la norme.
        if ($this->buyer_is_public_entity) {
            return null;
        }

        $sellerCountry = $this->seller_country;
        $sellerMainIdentifier = $sellerCountry->inferMainCompanyIdentifier($this->seller_registration_id);
        $sellerMainIdentifierRaw = preg_replace('/[.\s-]/', '', $sellerMainIdentifier);
        $sellerLegalType = $this->seller_legal_type !== null
            ? LegalTypeFactory::tryFrom($this->seller_legal_type)
            : null;

        $sellerFullIdentity = null;
        $sellerLegalDescription = null;
        if ($sellerLegalType !== null) {
            $sellerLegalTypeShort = $i18n->translate(
                sprintf('legals.legal-types.%s.short', $sellerLegalType->value),
                null,
                '',
            );
            if (!empty($sellerLegalTypeShort)) {
                $sellerLegalDescription = $sellerLegalTypeShort;
                if (
                    $sellerLegalType->canHaveShareCapital() &&
                    $this->seller_share_capital !== null &&
                    !$this->seller_share_capital->isZero()
                ) {
                    $formatter = new \NumberFormatter($i18n->getLocale(), \NumberFormatter::CURRENCY);
                    $formatter->setAttribute(\NumberFormatter::MIN_FRACTION_DIGITS, 0);
                    $formattedCapital = $formatter->formatCurrency(
                        $this->seller_share_capital->toFloat(),
                        $this->currency,
                    );
                    $sellerLegalDescription = $i18n->translate(
                        'legals.mentions.global.share-capital.short',
                        [$sellerLegalTypeShort, $formattedCapital],
                    );
                    $sellerFullIdentity = $i18n->translate(
                        'legals.mentions.global.share-capital.full',
                        [$this->seller_legal_name, $sellerLegalTypeShort, $formattedCapital],
                    );
                }
            }
        }

        // - Si Factur-X n'est pas supporté dans le pays du vendeur, on ne va pas plus loin.
        $invoiceFormats = $sellerCountry->getElectronicInvoiceFormats();
        if (!in_array(ElectronicInvoiceFormat::FACTURX, $invoiceFormats, true)) {
            return null;
        }

        // - Type de facture.
        $type = match (true) {
            $this->is_prepayment &&
            $this->is_credit_note => (
                InvoiceType::PREPAYMENT_CREDIT_NOTE
            ),
            $this->is_credit_note => (
                InvoiceType::CREDIT_NOTE
            ),
            $this->is_prepayment => (
                InvoiceType::PREPAYMENT_INVOICE
            ),
            default => InvoiceType::INVOICE,
        };

        // - Les factures d'acompte ne sont pas supportées pour les entités publiques (B2G).
        if (($this->is_prepayment || $this->is_prepayment_final) && $this->buyer_is_public_entity) {
            throw new \LogicException(sprintf(
                "Cannot generate XML for a prepayment invoice targeting a public entity (B2G) (#%d).",
                $this->id,
            ));
        }

        // - Type de processus métier.
        $businessProcessType = $sellerCountry->inferBusinessProcessType($this);
        if ($businessProcessType === null) {
            throw new \LogicException(sprintf(
                "Unable to infer the business process while generating the #%d XML part.",
                $this->id,
            ));
        }

        $xmlBuilder = FacturxBuilder::createNew(ZugferdProfiles::PROFILE_EXTENDED);
        $xmlBuilder->setDocumentInformation($this->number, $type->value, $this->date, $this->currency);
        $xmlBuilder->setDocumentBusinessProcess($businessProcessType->value);

        if ($this->booking_period !== null) {
            $xmlBuilder->setDocumentBillingPeriod(
                $this->booking_period->getStartDate(),
                $this->booking_period->getEndDate(),
                null,
            );
        } else {
            $xmlBuilder->setDocumentSupplyChainEvent($this->date);
        }

        //
        // - Références & Mentions
        //

        // - Note B2G pour les factures à destination d'entités publiques.
        if ($this->buyer_is_public_entity) {
            $xmlBuilder->addDocumentNote('B2G', null, (
                ZugferdTextSubjectCodeQualifiers::UNTDID_4451_ADN
            ));
        }

        $mentionsOverride = Config::get('invoices.mentions', []);
        foreach ($sellerCountry->getInvoiceLegalMentions() as $mention) {
            $mentionText = $mentionsOverride[$mention->value] ?? null;
            if (empty($mentionText)) {
                $mentionKey = vsprintf('legals.mentions.%s.%s', [
                    $sellerCountry->getCode(),
                    $mention->value,
                ]);

                $mentionText = match ($mention) {
                    LegalMention::SELLER_IDENTITY => $sellerFullIdentity,
                    LegalMention::TRADE_REGISTER => (
                        $this->seller_trade_registry_city === null ? null : (
                            $i18n->translate(
                                [
                                    sprintf('business-registration-id-full.%s', $sellerCountry->getCode()),
                                    'business-registration-id-full.generic',
                                ],
                                [$this->seller_trade_registry_city, $sellerMainIdentifier],
                                '',
                            ) ?: null
                        )
                    ),
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
                $xmlBuilder->addDocumentNote(Str::limit($mentionText, 1024), null, (
                    $mention->getSubjectCode()
                ));
            }
        }

        // - Mentions spéciales.
        if ($this->special_mentions !== null) {
            $specialMention = mb_trim(str_replace(["\r\n", "\r", "\n"], ' ', $this->special_mentions));
            $xmlBuilder->addDocumentNote(Str::limit($specialMention, 1024), null, (
                ZugferdTextSubjectCodeQualifiers::UNTDID_4451_ZZZ
            ));
        }

        // - Bon de commande.
        if ($this->order_number !== null) {
            $xmlBuilder->setDocumentBuyerOrderReferencedDocument($this->order_number);
        }

        // - Référence à la facture parente, si nécessaire.
        $isCorrectionType = (
            $type === InvoiceType::CREDIT_NOTE ||
            $type === InvoiceType::PREPAYMENT_CREDIT_NOTE ||
            $type === InvoiceType::CORRECTION
        );
        if ($isCorrectionType) {
            $parentInvoice = $this->parent_invoice;
            if ($parentInvoice === null) {
                throw new \LogicException("Missing parent invoice for a correction invoice.");
            }

            $parentInvoiceType = match (true) {
                $parentInvoice->is_prepayment &&
                $parentInvoice->is_credit_note => (
                    InvoiceType::PREPAYMENT_CREDIT_NOTE
                ),
                $parentInvoice->is_credit_note => (
                    InvoiceType::CREDIT_NOTE
                ),
                $parentInvoice->is_prepayment => (
                    InvoiceType::PREPAYMENT_INVOICE
                ),
                default => InvoiceType::INVOICE,
            };

            $xmlBuilder->setDocumentInvoiceReferencedDocument(
                $parentInvoice->number,
                $parentInvoiceType->value,
                $parentInvoice->date,
            );
        }

        // - Références aux acomptes pour les factures de solde.
        if ($this->is_prepayment_final) {
            foreach ($this->prepaymentInvoices as $prepaymentInvoice) {
                $xmlBuilder->addDocumentInvoiceReferencedDocument(
                    $prepaymentInvoice->number,
                    InvoiceType::PREPAYMENT_INVOICE->value,
                    $prepaymentInvoice->date,
                );
            }
        }

        //
        // - Identification du vendeur
        //

        $xmlBuilder->setDocumentSeller($this->seller_legal_name, null, $sellerLegalDescription);

        // - Numéro d'enregistrement du vendeur (e.g. SIREN en France)
        $sellerMainIdentifierScheme = $sellerCountry->getCompanyIdentifierScheme($sellerMainIdentifier);
        if ($sellerMainIdentifierScheme === null) {
            throw new \LogicException("Unable to retrieve the seller company identifier scheme.");
        }
        $xmlBuilder->setDocumentSellerLegalOrganisation(
            $sellerMainIdentifierRaw,
            $sellerMainIdentifierScheme->value,
            null,
        );

        // - Identifiant secondaire si différent de l'identifiant principal.
        $sellerSecondaryIdentifierScheme = $sellerCountry->getCompanyIdentifierScheme($this->seller_registration_id);
        if (
            $sellerSecondaryIdentifierScheme !== null &&
            $sellerSecondaryIdentifierScheme !== $sellerMainIdentifierScheme
        ) {
            $sellerSecondaryIdentifierRaw = preg_replace('/[.\s-]/', '', $this->seller_registration_id);
            $xmlBuilder->addDocumentSellerGlobalId(
                $sellerSecondaryIdentifierRaw,
                $sellerSecondaryIdentifierScheme->value,
            );
        }

        // - Numéro de T.V.A. du vendeur.
        if ($this->global_tax_regime !== TaxRegime::OUT_OF_SCOPE->value) {
            if ($this->seller_vat_number !== null) {
                $sellerVatNumberRaw = preg_replace('/[.\s-]/', '', $this->seller_vat_number);
                $xmlBuilder->addDocumentSellerVATRegistrationNumber($sellerVatNumberRaw);
            } else {
                $xmlBuilder->addDocumentSellerTaxNumber($sellerMainIdentifierRaw);
            }
        }

        $xmlBuilder
            ->setDocumentSellerAddress(
                $this->seller_street,
                $this->seller_additional_street,
                null,
                $this->seller_postal_code,
                $this->seller_locality,
                $sellerCountry->getCode(),
                $this->seller_administrative_area,
            )
            ->setDocumentSellerContact(
                null,
                null,
                $this->seller_phone,
                null,
                $this->seller_email,
            )
        ;

        // - Identifiant de routage e-invoicing du vendeur.
        if ($this->seller_routing_identifier !== null) {
            $sellerRoutingMetadata = $sellerCountry->getInvoiceRoutingIdentifierMetadata(
                $this->seller_routing_identifier,
            );
            $xmlBuilder->setDocumentSellerCommunication(
                $sellerRoutingMetadata['scheme']->value,
                $sellerRoutingMetadata['value'],
            );
        }

        //
        // - Identification de l'acheteur
        //

        $buyerCountry = $this->buyer_country;
        $buyerIsCompany = $this->buyer_type === LegalEntityType::COMPANY->value;
        $buyerName = $buyerIsCompany ? $this->buyer_legal_name : $this->buyer_full_name;

        $xmlBuilder
            ->setDocumentBuyer($buyerName)
            ->setDocumentBuyerAddress(
                $this->buyer_street,
                $this->buyer_additional_street,
                null,
                $this->buyer_postal_code,
                $this->buyer_locality,
                $buyerCountry->getInheritedCode(),
                $this->buyer_administrative_area,
            )
        ;

        if ($this->buyer_reference !== null) {
            $xmlBuilder->setDocumentBuyerReference($this->buyer_reference);
        }

        if ($buyerIsCompany) {
            $xmlBuilder->setDocumentBuyerContact($this->buyer_full_name, null, null, null, null);

            // - Si l'acheteur est dans le même pays, on ajoute son numéro
            //   d'enregistrement et identifiant de routage.
            if ($buyerCountry->isSame($sellerCountry, true)) {
                $buyerMainIdentifier = $buyerCountry->inferMainCompanyIdentifier($this->buyer_registration_id);
                $buyerMainIdentifierScheme = $buyerCountry->getCompanyIdentifierScheme($buyerMainIdentifier);
                $buyerMainIdentifierRaw = preg_replace('/[.\s-]/', '', $buyerMainIdentifier);
                if ($buyerMainIdentifierScheme === null) {
                    throw new \LogicException("Unable to retrieve the buyer company identifier scheme.");
                }
                $xmlBuilder->setDocumentBuyerLegalOrganisation(
                    $buyerMainIdentifierRaw,
                    $buyerMainIdentifierScheme->value,
                    null,
                );

                // - Identifiant secondaire si différent de l'identifiant principal.
                $buyerSecondaryIdentifierScheme = $buyerCountry->getCompanyIdentifierScheme(
                    $this->buyer_registration_id,
                );
                if (
                    $buyerSecondaryIdentifierScheme !== null &&
                    $buyerSecondaryIdentifierScheme !== $buyerMainIdentifierScheme
                ) {
                    $buyerSecondaryIdentifierRaw = preg_replace('/[.\s-]/', '', $this->buyer_registration_id);
                    $xmlBuilder->addDocumentBuyerGlobalId(
                        $buyerSecondaryIdentifierRaw,
                        $buyerSecondaryIdentifierScheme->value,
                    );
                }

                // - Code routage : Pour les entités publiques, on utilise le code de service de la société.
                if ($this->buyer_is_public_entity && $this->buyer_service_code !== null) {
                    $xmlBuilder->addDocumentBuyerGlobalId(
                        $this->buyer_service_code,
                        '0224', // - Code routage.
                    );
                }
            }

            // - Si l'acheteur est dans la même zone T.V.A., on ajoute son numéro s'il existe.
            if (
                $this->global_tax_regime !== TaxRegime::OUT_OF_SCOPE->value &&
                $this->buyer_vat_number !== null &&
                $sellerCountry->isSameVatArea($buyerCountry)
            ) {
                $buyerRawVatNumber = preg_replace('/[.\s-]/', '', $this->buyer_vat_number);
                $xmlBuilder->addDocumentBuyerVATRegistrationNumber($buyerRawVatNumber);
            }
        }

        // - Identifiant de routage e-invoicing de l'acheteur.
        if ($this->buyer_routing_identifier !== null) {
            $buyerRoutingMetadata = $buyerCountry->getInvoiceRoutingIdentifierMetadata(
                $this->buyer_routing_identifier,
            );
            $xmlBuilder->setDocumentBuyerCommunication(
                $buyerRoutingMetadata['scheme']->value,
                $buyerRoutingMetadata['value'],
            );
        }

        //
        // - Livraison
        //

        $xmlBuilder
            ->setDocumentShipTo($buyerName)
            ->setDocumentShipToAddress(
                $this->buyer_street,
                $this->buyer_additional_street,
                null,
                $this->buyer_postal_code,
                $this->buyer_locality,
                $buyerCountry->getInheritedCode(),
                $this->buyer_administrative_area,
            )
        ;

        //
        // - Lignes de facture
        //

        $lineIndex = 0;

        $getExemptionData = static function (
            string $taxRegime,
            array|string|null $taxExemptionCodes,
            array|string|null $taxExemptionReasons = null,
        ) use ($i18n) {
            $taxRegime = TaxRegime::from($taxRegime);
            if ($taxRegime === TaxRegime::STANDARD) {
                return ['code' => null, 'reason' => null];
            }

            // - Codes d'exemption.
            $taxExemptionCodes = array_map(
                static fn ($code) => VatExemptionCodeFactory::from($code),
                (array) ($taxExemptionCodes ?? []),
            );
            if (empty($taxExemptionCodes)) {
                $taxExemptionCodes = with(
                    $taxRegime->getDefaultExemptionCode(),
                    static fn ($regime) => $regime !== null ? [$regime] : [],
                );
            }

            // - Raisons (textuelle) d'exemption.
            $taxExemptionReasons ??= [];
            if (!empty($taxExemptionCodes) && empty($taxExemptionReasons)) {
                $taxExemptionReasons = array_filter(array_map(
                    static fn ($code) => (
                        $i18n->translate(
                            sprintf('legals.vat-exemptions.%s.mention', $code->value),
                            null,
                            '',
                        )
                    ),
                    $taxExemptionCodes,
                ));
            }

            // - Il ne peut pas y avoir plusieurs codes d'exemptions, s'il y en a
            //   qu'un seul, on l'utilise, sinon, on ne le passe pas et ce sera
            //   une raison textuelle.
            $taxExemptionCode = count($taxExemptionCodes) === 1
                ? current($taxExemptionCodes)
                : null;

            // - Si c'est un code custom, il n'y a pas de véritable code.
            if ($taxExemptionCode?->isCustom()) {
                $taxExemptionCode = null;
            }
            $taxExemptionCode ??= $taxRegime->getDefaultExemptionCode();

            // - S'il n'y a pas de raison à une exemption, on utilise un message de base.
            if (
                $taxRegime === TaxRegime::EXEMPTED &&
                $taxExemptionCode === null &&
                empty($taxExemptionReasons)
            ) {
                $taxExemptionReasons = [$i18n->translate('exempted')];
            }

            return [
                'code' => $taxExemptionCode?->value,
                'reason' => (
                    !empty($taxExemptionReasons)
                        ? Str::limit(implode('; ', $taxExemptionReasons), 1024)
                        : null
                ),
            ];
        };

        $globalTaxRegime = $this->global_tax_regime;
        $globalTaxExemptionData = $globalTaxRegime === null ? null : (
            $getExemptionData(
                $globalTaxRegime,
                $this->global_tax_exemption_code,
                $this->global_tax_exemption_reason,
            )
        );

        /** @return array{ regime: string, percent: float, reason: string|null, code: string|null } */
        $getPositionTaxData = static function (
            string|null $taxRegime,
            string|null $taxExemptionCode,
            array|null $taxes,
        ) use (
            $globalTaxRegime,
            $globalTaxExemptionData,
            $getExemptionData,
        ) {
            // - Régime fiscal global: Les lignes héritent du régime de la facture.
            if ($globalTaxRegime !== null) {
                if ($taxes !== null) {
                    throw new \LogicException("Line taxes should be `null` when a global tax regime is applied.");
                }

                return [
                    'regime' => $globalTaxRegime,
                    'percent' => $globalTaxRegime !== TaxRegime::OUT_OF_SCOPE->value ? 0 : null,
                    'reason' => $globalTaxExemptionData['reason'],
                    'code' => $globalTaxExemptionData['code'],
                ];
            }

            if ($taxRegime === null) {
                throw new \LogicException(
                    "Line tax regime should always be defined where " .
                    "there is no global tax regime applied.",
                );
            }

            if ($taxRegime === TaxRegime::STANDARD->value) {
                if (count($taxes) > 1) {
                    throw new \LogicException("Only one tax per line is allowed.");
                }

                // - Si pas de taxe pour la ligne, on part du principe qu'elle
                //   est exemptée sans raison spécifique.
                if (empty($taxes)) {
                    $exemptionData = $getExemptionData(TaxRegime::EXEMPTED->value, null);
                    return [
                        'regime' => TaxRegime::EXEMPTED->value,
                        'percent' => 0,
                        'reason' => $exemptionData['reason'],
                        'code' => $exemptionData['code'],
                    ];
                }

                /** @var TaxDataStandard $tax */
                $tax = current($taxes);
                return [
                    'regime' => (
                        !$tax['value']->isZero()
                            ? TaxRegime::STANDARD->value
                            : TaxRegime::ZERO_RATED->value
                    ),
                    'percent' => $tax['value']->toFloat(),
                    'reason' => null,
                    'code' => null,
                ];
            }

            // - Exempté, auto-liquidation, etc.
            $taxExemptionData = $getExemptionData($taxRegime, $taxExemptionCode);
            return [
                'regime' => $taxRegime,
                'percent' => $taxRegime !== TaxRegime::OUT_OF_SCOPE->value ? 0 : null,
                'reason' => $taxExemptionData['reason'],
                'code' => $taxExemptionData['code'],
            ];
        };

        $showDescriptions = Setting::getWithKey('invoices.showDescriptions');
        $showReplacementPrices = Setting::getWithKey('invoices.showReplacementPrices');
        foreach ($this->materials as $material) {
            if ($material->is_hidden_on_bill) {
                $isFree = (
                    $material->unit_price->isZero() &&
                    $material->total_without_taxes->isZero()
                );
                if ($isFree) {
                    continue;
                }
            }

            $xmlBuilder->addNewPosition((string) ++$lineIndex);
            $xmlBuilder->setDocumentPositionProductDetails(
                $material->name,
                (
                    $showDescriptions && $material->description !== null
                        ? Str::limit($material->description, 1024)
                        : null
                ),
                $material->reference,
            );
            $xmlBuilder->setDocumentPositionPrice($material->unit_price_period->toFloat());
            $xmlBuilder->setDocumentPositionQuantity($material->quantity, ZugferdUnitCodes::REC20_ONE);

            // - Remise sur la ligne.
            if ($material->has_discount) {
                $xmlBuilder->addDocumentPositionAllowanceCharge(
                    $material->total_discount->toFloat(),
                    false,
                    $material->discount_rate->toFloat(),
                    $material->total_without_discount->toFloat(),
                    ZugferdAllowanceCodes::DISCOUNT,
                );
            }

            // - Taxes sur la ligne.
            $tax = $getPositionTaxData(
                $material->tax_regime,
                $material->tax_exemption_code,
                $material->taxes,
            );
            $xmlBuilder->addDocumentPositionTax(
                $tax['regime'],
                ZugferdVatTypeCodes::VALUE_ADDED_TAX,
                $tax['percent'],
                null,
                $tax['reason'],
                $tax['code'],
            );

            $xmlBuilder->setDocumentPositionLineSummation(
                $material->total_without_taxes->toFloat(),
            );

            // - Prix de remplacement.
            if ($showReplacementPrices && $material->unit_replacement_price !== null) {
                $xmlBuilder->addDocumentPositionProductCharacteristic(
                    sprintf(
                        '%s (%s)',
                        $i18n->translate('unit-replacement-value'),
                        strtoupper($this->currency),
                    ),
                    (string) $material->unit_replacement_price,
                );
            }
        }

        foreach ($this->extras as $extra) {
            $isNegativeLine = $extra->unit_price->isLessThan(0);
            if ($isNegativeLine && $extra->has_discount) {
                throw new \LogicException(sprintf(
                    "Cannot generate the #%d invoice XML: Negative extra cannot have discount.",
                    $this->id,
                ));
            }

            $xmlBuilder->addNewPosition((string) ++$lineIndex);
            $xmlBuilder->setDocumentPositionProductDetails($extra->description);
            $xmlBuilder->setDocumentPositionPrice(
                $extra->unit_price->abs()->toFloat(),
            );
            $xmlBuilder->setDocumentPositionQuantity(
                $isNegativeLine ? -$extra->quantity : $extra->quantity,
                ZugferdUnitCodes::REC20_ONE,
            );

            // - Remise sur la ligne.
            if ($extra->has_discount) {
                $xmlBuilder->addDocumentPositionAllowanceCharge(
                    $extra->total_discount->toFloat(),
                    false,
                    $extra->discount_rate->toFloat(),
                    $extra->total_without_discount->toFloat(),
                    ZugferdAllowanceCodes::DISCOUNT,
                );
            }

            // - Taxes sur la ligne.
            $tax = $getPositionTaxData(
                $extra->tax_regime,
                $extra->tax_exemption_code,
                $extra->taxes,
            );
            $xmlBuilder->addDocumentPositionTax(
                $tax['regime'],
                ZugferdVatTypeCodes::VALUE_ADDED_TAX,
                $tax['percent'],
                null,
                $tax['reason'],
                $tax['code'],
            );

            $xmlBuilder->setDocumentPositionLineSummation(
                $extra->total_without_taxes->toFloat(),
            );
        }

        //
        // - Lignes de reprise d'acompte.
        //

        $prepaymentTotal = Decimal::zero()->toScale(2);
        if ($this->prepaymentInvoices->isNotEmpty()) {
            $dateFormatter = new \IntlDateFormatter(
                $i18n->getLocale(),
                \IntlDateFormatter::SHORT,
                \IntlDateFormatter::NONE,
                $this->date->getTimezone(),
                \IntlDateFormatter::GREGORIAN,
            );

            foreach ($this->prepaymentInvoices as $index => $prepaymentInvoice) {
                $isValidPrepaymentInvoice = (
                    $prepaymentInvoice->materials->isEmpty() &&
                    $prepaymentInvoice->global_discount_rate->isZero() &&
                    $prepaymentInvoice->extras->every(static fn ($line) => (
                        $line->total_without_taxes->isEqualTo($line->unit_price) &&
                        $line->discount_rate->isZero()
                    ))
                );
                if (!$isValidPrepaymentInvoice) {
                    throw new \LogicException(sprintf(
                        'The prepayment #%d invoice contains invalid data.',
                        $prepaymentInvoice->id,
                    ));
                }

                foreach ($prepaymentInvoice->extras as $prepaymentLineIndex => $prepaymentLine) {
                    $isNegativeLine = $prepaymentLine->total_without_taxes->isNegative();

                    $xmlBuilder->addNewPosition((string) ++$lineIndex);
                    $xmlBuilder->setDocumentPositionProductDetails(
                        $i18n->translate('prepayment-reprise-line.details', [
                            'index' => $index + 1,
                            'number' => $prepaymentInvoice->number,
                            'date' => $dateFormatter->format($prepaymentInvoice->date),
                        ]),
                    );
                    $xmlBuilder->setDocumentPositionPrice(
                        $prepaymentLine->total_without_taxes->abs()->toFloat(),
                    );
                    $xmlBuilder->setDocumentPositionQuantity(
                        $isNegativeLine ? 1 : -1,
                        ZugferdUnitCodes::REC20_ONE,
                    );

                    // - Référence à la facture d'acompte.
                    $xmlBuilder->addDocumentPositionInvoiceReferencedDocument(
                        $prepaymentInvoice->number,
                        (string) ($prepaymentLineIndex + 1),
                        InvoiceType::PREPAYMENT_INVOICE->value,
                        $prepaymentInvoice->date,
                    );

                    // - Taxes sur la ligne de reprise.
                    $tax = $getPositionTaxData(
                        $prepaymentLine->tax_regime,
                        $prepaymentLine->tax_exemption_code,
                        $prepaymentLine->taxes,
                    );
                    $xmlBuilder->addDocumentPositionTax(
                        $tax['regime'],
                        ZugferdVatTypeCodes::VALUE_ADDED_TAX,
                        $tax['percent'],
                        null,
                        $tax['reason'],
                        $tax['code'],
                    );

                    $xmlBuilder->setDocumentPositionLineSummation(
                        $prepaymentLine->total_without_taxes->negated()->toFloat(),
                    );
                }

                $prepaymentTotal = $prepaymentTotal->plus($prepaymentInvoice->total_without_taxes);
            }
        }

        if ($lineIndex === 0) {
            throw new \LogicException(sprintf(
                "Cannot generate the #%d invoice XML: No billable line items.",
                $this->id,
            ));
        }

        //
        // - Remise globale
        //

        if (!$this->total_global_discount->isZero()) {
            $discountBreakdown = $this->global_discount_breakdown;
            foreach ($discountBreakdown as $discount) {
                if ($discount['value']->isZero()) {
                    continue;
                }

                if ($discount['tax']['type'] === TaxRegime::STANDARD->value) {
                    $tax = [
                        'regime' => (
                            !$discount['tax']['value']->isZero()
                                ? TaxRegime::STANDARD->value
                                : TaxRegime::ZERO_RATED->value
                        ),
                        'percent' => $discount['tax']['value']->toFloat(),
                        'reason' => null,
                        'code' => null,
                    ];
                } else {
                    $tax = [
                        'regime' => $discount['tax']['type'],
                        'percent' => $discount['tax']['type'] !== TaxRegime::OUT_OF_SCOPE->value ? 0 : null,
                        ...$getExemptionData($discount['tax']['type'], $discount['tax']['reason'] ?? null),
                    ];
                }

                $xmlBuilder->addDocumentAllowanceChargeExtended(
                    $discount['value']->toFloat(),
                    false,
                    $tax['regime'],
                    ZugferdVatTypeCodes::VALUE_ADDED_TAX,
                    $tax['percent'],
                    $tax['reason'],
                    $tax['code'],
                    null,
                    $this->global_discount_rate->toFloat(),
                    $discount['base']->toFloat(),
                    null,
                    null,
                    ZugferdAllowanceCodes::DISCOUNT,
                );
            }
        }

        //
        // - Taxes au niveau du document
        //

        $totalTaxesAmount = Decimal::zero()->toScale(2);
        if ($globalTaxRegime !== null) {
            $xmlBuilder->addDocumentTax(
                $this->global_tax_regime,
                ZugferdVatTypeCodes::VALUE_ADDED_TAX,
                $this->total_without_taxes->toFloat(),
                0,
                $globalTaxRegime !== TaxRegime::OUT_OF_SCOPE->value ? 0 : null,
                $globalTaxExemptionData['reason'],
                $globalTaxExemptionData['code'],
                null,
                null,
                null,
                !$this->is_vat_due_on_invoice ? null : (
                    VatDueDateCode::INVOICE_DATE
                        ->getCode(ElectronicInvoiceFormat::FACTURX)
                ),
            );
        } else {
            if (empty($this->total_taxes)) {
                throw new \LogicException(sprintf(
                    "Cannot generate the #%d invoice XML: Missing taxes.",
                    $this->id,
                ));
            }

            foreach ($this->total_taxes as $tax) {
                if ($tax['type'] === TaxRegime::STANDARD->value) {
                    $tax = [
                        'regime' => (
                            !$tax['value']->isZero()
                                ? TaxRegime::STANDARD->value
                                : TaxRegime::ZERO_RATED->value
                        ),
                        'base' => $tax['base']->toFloat(),
                        'percent' => $tax['value']->toFloat(),
                        'total' => $tax['total']->toFloat(),
                        'reason' => null,
                        'code' => null,
                    ];
                } else {
                    $tax = [
                        'regime' => $tax['type'],
                        'base' => $tax['base']->toFloat(),
                        'percent' => $tax['type'] !== TaxRegime::OUT_OF_SCOPE->value ? 0 : null,
                        'total' => 0,
                        ...$getExemptionData($tax['type'], $tax['reason']),
                    ];
                }

                $xmlBuilder->addDocumentTax(
                    $tax['regime'],
                    ZugferdVatTypeCodes::VALUE_ADDED_TAX,
                    $tax['base'],
                    $tax['total'],
                    $tax['percent'],
                    $tax['reason'],
                    $tax['code'],
                    null,
                    null,
                    null,
                    !$this->is_vat_due_on_invoice ? null : (
                        VatDueDateCode::INVOICE_DATE
                            ->getCode(ElectronicInvoiceFormat::FACTURX)
                    ),
                );

                $totalTaxesAmount = $totalTaxesAmount->plus($tax['total']);
            }
        }

        //
        // - Totaux
        //

        $linesTotal = $this->total_without_global_discount
            ->minus($prepaymentTotal);

        $allowancesTotal = $this->total_global_discount;

        $xmlBuilder->setDocumentSummation(
            $this->total_with_taxes->toFloat(),
            $this->total_with_taxes->toFloat(),
            $linesTotal->toFloat(),
            null,
            !$allowancesTotal->isZero() ? $allowancesTotal->toFloat() : null,
            $this->total_without_taxes->toFloat(),
            $totalTaxesAmount->toFloat(),
        );

        //
        // - Conditions de paiement
        //

        if ($this->total_with_taxes->isGreaterThan(0)) {
            $dueDate = $this->due_date !== null
                ? CarbonImmutable::parse($this->due_date)
                : null;

            if ($dueDate === null) {
                $paymentTermDays = $this->due_delay
                    ?? Config::get('invoices.paymentTermDays');

                $xmlBuilder->addDocumentPaymentTerm(Str::limit(
                    (
                        ($paymentTermDays ?? 0) > 0
                            ? $i18n->plural('payment-terms.with-delay', $paymentTermDays)
                            : $i18n->translate('payment-terms.immediately')
                    ),
                    1024,
                ));
            } else {
                $xmlBuilder->addDocumentPaymentTerm(null, $dueDate);
            }

            // - Moyens de paiement.
            $paymentMethods = Config::get('invoices.paymentMethods');
            if (!$this->is_credit_note && is_array($paymentMethods)) {
                foreach (PaymentMethod::cases() as $method) {
                    $methodConfig = $paymentMethods[$method->value] ?? null;
                    if ($methodConfig === null || $methodConfig === false) {
                        continue;
                    }

                    if ($method === PaymentMethod::TRANSFER) {
                        if (is_array($methodConfig) && !empty($methodConfig['iban'])) {
                            $xmlBuilder->addDocumentPaymentMeanToCreditTransfer(
                                $methodConfig['iban'],
                                $methodConfig['holder'] ?? $this->seller_legal_name,
                                null,
                                $methodConfig['bic'] ?? null,
                                null,
                            );
                        }
                    } else {
                        $xmlBuilder->addDocumentPaymentMean($method->getCode());
                    }
                }
            }
        }

        return $xmlBuilder->getContent();
    }

    public function toPdf(): PdfInterface
    {
        if (!$this->exists) {
            throw new \LogicException("Please persist the invoice before retrieving its associated PDF.");
        }

        // - Pour un brouillon, on régénère systématiquement le PDF en mémoire
        //   (pas de stockage physique tant que la facture n'est pas finalisée).
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
        $pdf = PdfDocument::createFromTemplate(
            sprintf('invoice/%s', $isLegacy ? 'legacy' : 'index'),
            $i18n,
            $this->getPdfName($i18n),
            $this->getPdfData($i18n),
        );

        $xml = $this->generatePdfXml();
        return $xml !== null
            ? $pdf->withXml($xml)
            : $pdf;
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
                "Unable to persist invoice PDF into \"%s\".",
                $this->path,
            ));
        }
    }

    private function getPdfName(?I18n $i18n = null): string
    {
        $i18n ??= new I18n($this->lang);

        return sprintf('%s.pdf', Str::slugify(implode('-', array_filter([
            $i18n->translate($this->is_credit_note ? 'credit-note' : 'invoice'),
            $this->seller_legal_name,
            $this->number,
            (
                $this->buyer_type === LegalEntityType::COMPANY->value
                    ? $this->buyer_legal_name
                    : $this->buyer_full_name
            ),
        ]))));
    }

    private function getPdfData(?I18n $i18n = null): array
    {
        $i18n ??= new I18n($this->lang);
        $settings = Setting::getWithKey('invoices');

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
                'number' => $this->number,
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

        // - Facture parente (en cas d'avoir notamment)
        $parentInvoice = null;
        if ($this->is_credit_note && $this->parentInvoice !== null) {
            $parentInvoice = [
                'date' => $this->parentInvoice->date,
                'number' => $this->parentInvoice->number,
            ];
        }

        // - Devis parent (en cas de facture d'acompte, facture de solde)
        $parentEstimate = null;
        if ($this->parentEstimate !== null) {
            $parentEstimate = [
                'date' => $this->parentEstimate->date,
                'number' => $this->parentEstimate->number,
            ];
        }

        // - Booking lié à la facture (événement ou réservation).
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
        // - Lignes de la facture
        //

        $rawMaterials = (new MaterialsCollection($this->materials))->reject(
            static fn (InvoiceMaterial $material) => (
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
                static fn (InvoiceMaterial|InvoiceExtra $line) => (
                    !$line->discount_rate->isZero()
                ),
            );

        $taxFootnotes = [];
        $taxFootnoteMap = [];
        $getLineTaxData = static function (InvoiceMaterial|InvoiceExtra $line) use (
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
                            static fn (InvoiceMaterial $material) => [
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
            static fn (InvoiceExtra $extra) => [
                'description' => $extra->description,
                'quantity' => $extra->quantity,
                'unit_price' => $extra->unit_price,
                'total_without_taxes' => $extra->total_without_taxes,
                'has_discount' => $extra->has_discount,
                'discount_rate' => $extra->discount_rate,
                'tax' => $getLineTaxData($extra),
            ],
        );

        $totalPrepayments = Decimal::zero()->toScale(2);
        $prepayments = new CoreCollection();
        foreach ($this->prepaymentInvoices as $index => $prepaymentInvoice) {
            $isValidPrepaymentInvoice = (
                $prepaymentInvoice->materials->isEmpty() &&
                $prepaymentInvoice->global_discount_rate->isZero() &&
                $prepaymentInvoice->extras->every(static fn ($line) => (
                    $line->total_without_taxes->isEqualTo($line->unit_price) &&
                    $line->discount_rate->isZero()
                ))
            );
            if (!$isValidPrepaymentInvoice) {
                throw new \LogicException(sprintf(
                    'The prepayment #%d invoice contains invalid data.',
                    $prepaymentInvoice->id,
                ));
            }

            foreach ($prepaymentInvoice->extras as $prepaymentLine) {
                $prepayments->add([
                    'index' => $index + 1,
                    'number' => $prepaymentInvoice->number,
                    'date' => $prepaymentInvoice->date,
                    'amount' => (
                        $prepaymentInvoice->is_credit_note
                            ? $prepaymentLine->total_without_taxes->negated()
                            : $prepaymentLine->total_without_taxes
                    ),
                    'tax' => $getLineTaxData($prepaymentLine),
                ]);
            }

            $totalPrepayments = $totalPrepayments->plus($prepaymentInvoice->total_without_taxes);
        }

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
        if (!$this->is_credit_note && $this->total_with_taxes->isGreaterThan(0)) {
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
            'orderNumber' => $this->order_number,
            'parentInvoice' => $parentInvoice,
            'parentEstimate' => $parentEstimate,
            'isDomestic' => $sellerCountry->isSame($buyerCountry),
            'isSimpleVatSystem' => $isSimpleVatSystem,
            'isPrepayment' => $this->is_prepayment,
            'isCreditNote' => $this->is_credit_note,
            'globalTaxRegime' => $globalTaxRegime,
            'globalTaxExemptionReason' => $globalTaxExemptionReason,
            'materials' => $materials,
            'extras' => $extras,
            'prepayments' => $prepayments,
            'taxFootnotes' => $taxFootnotes,
            'hasLineDiscount' => $hasLineDiscount,
            'totalPrepayments' => $totalPrepayments,
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
    // -    UBL related
    // -
    // ------------------------------------------------------

    /**
     * Indique si la facture est éligible à la génération d'un
     * XML au format UBL (Peppol BIS Billing 3.0).
     *
     * @return bool `true` si UBL est supporté, `false` sinon.
     */
    public function supportsUbl(): bool
    {
        // - Si la facture n'est pas une facture électronique ou
        //   que c'est un brouillon, UBL n'est pas supporté.
        if ($this->is_draft || !$this->is_electronic) {
            return false;
        }

        // - Si c'est une ancienne facture, UBL n'est pas supporté.
        if ($this->format < BillingFormat::V3->value) {
            return false;
        }

        // - UBL est uniquement supporté pour les clients B2B.
        if ($this->buyer_type !== LegalEntityType::COMPANY->value) {
            return false;
        }

        // - Pas d'UBL si l'acheteur entreprise se trouve dans un
        //   pays différent de celui du vendeur.
        if (!$this->seller_country->isSame($this->buyer_country, withInherited: true)) {
            return false;
        }

        // - Si UBL n'est pas supporté dans le pays du vendeur, pas d'UBL.
        $invoiceFormats = $this->seller_country->getElectronicInvoiceFormats();
        return in_array(ElectronicInvoiceFormat::UBL, $invoiceFormats, true);
    }

    public function toUbl(): XmlInterface|null
    {
        if (!$this->supportsUbl()) {
            return null;
        }

        $i18n = new I18n($this->lang);

        $content = $this->generateUblXml($i18n);
        if ($content === null) {
            return null;
        }

        $name = $this->getUblName($i18n);
        return new Xml($name, $content);
    }

    private function generateUblXml(?I18n $i18n = null): string|null
    {
        $i18n ??= new I18n($this->lang);

        // - Si la facture n'est pas une facture électronique ou
        //   que c'est un brouillon, on ne va pas plus loin.
        if ($this->is_draft || !$this->is_electronic) {
            return null;
        }

        // - Si c'est une ancienne facture, il n'y a pas de e-invoice possible.
        if ($this->format < BillingFormat::V3->value) {
            return null;
        }

        // - UBL est uniquement supporté pour les clients B2B.
        if ($this->buyer_type !== LegalEntityType::COMPANY->value) {
            return null;
        }

        // - Si on a n'a pas de numéro d'enregistrement pour le vendeur,
        //   on ne peut pas générer de facture électronique en son nom.
        if ($this->seller_registration_id === null) {
            return null;
        }

        $sellerCountry = $this->seller_country;
        $sellerMainIdentifier = $sellerCountry->inferMainCompanyIdentifier($this->seller_registration_id);
        $sellerMainIdentifierRaw = preg_replace('/[.\s-]/', '', $sellerMainIdentifier);
        $sellerLegalType = $this->seller_legal_type !== null
            ? LegalTypeFactory::tryFrom($this->seller_legal_type)
            : null;

        $sellerFullIdentity = null;
        $sellerLegalDescription = null;
        if ($sellerLegalType !== null) {
            $sellerLegalTypeShort = $i18n->translate(
                sprintf('legals.legal-types.%s.short', $sellerLegalType->value),
                null,
                '',
            );
            if (!empty($sellerLegalTypeShort)) {
                $sellerLegalDescription = $sellerLegalTypeShort;
                if (
                    $sellerLegalType->canHaveShareCapital() &&
                    $this->seller_share_capital !== null &&
                    !$this->seller_share_capital->isZero()
                ) {
                    $formatter = new \NumberFormatter($i18n->getLocale(), \NumberFormatter::CURRENCY);
                    $formatter->setAttribute(\NumberFormatter::MIN_FRACTION_DIGITS, 0);
                    $formattedCapital = $formatter->formatCurrency(
                        $this->seller_share_capital->toFloat(),
                        $this->currency,
                    );
                    $sellerLegalDescription = $i18n->translate(
                        'legals.mentions.global.share-capital.short',
                        [$sellerLegalTypeShort, $formattedCapital],
                    );
                    $sellerFullIdentity = $i18n->translate(
                        'legals.mentions.global.share-capital.full',
                        [$this->seller_legal_name, $sellerLegalTypeShort, $formattedCapital],
                    );
                }
            }
        }

        // - Si UBL n'est pas supporté dans le pays du vendeur, on ne va pas plus loin.
        $invoiceFormats = $sellerCountry->getElectronicInvoiceFormats();
        if (!in_array(ElectronicInvoiceFormat::UBL, $invoiceFormats, true)) {
            return null;
        }

        $specification = $sellerCountry->getUblSpecification();
        if ($specification === null) {
            throw new \LogicException("Unexpected missing UBL specification.");
        }

        // - Type de facture.
        $type = match (true) {
            $this->is_credit_note => (
                InvoiceType::CREDIT_NOTE
            ),
            $this->is_prepayment => (
                InvoiceType::PREPAYMENT_INVOICE
            ),
            default => InvoiceType::INVOICE,
        };

        // - Les factures d'acompte ne sont pas supportées pour les entités publiques (B2G).
        if (($this->is_prepayment || $this->is_prepayment_final) && $this->buyer_is_public_entity) {
            throw new \LogicException(sprintf(
                "Cannot generate XML for a prepayment invoice targeting a public entity (B2G) (#%d).",
                $this->id,
            ));
        }

        $document = $this->is_credit_note ? new Ubl\CreditNote() : new Ubl\Invoice();
        $document
            ->setCustomizationId($specification->value)
            ->setProfileId((
                $sellerCountry->inferBusinessProcessType($this)?->value
                    ?? 'urn:fdc:peppol.eu:2017:poacc:billing:01:1.0'
            ))
            ->setId($this->number)
            ->setInvoiceTypeCode((int) $type->value)
            ->setIssueDate($this->date->toDateTime())
            ->setDocumentCurrencyCode($this->currency);

        $invoicePeriod = null;
        if ($this->booking_period !== null) {
            $invoicePeriod = (new Ubl\InvoicePeriod())
                ->setStartDate($this->booking_period->getStartDate()->toDateTime())
                ->setEndDate($this->booking_period->getEndDate()?->toDateTime())
                ->setDescriptionCode((
                    !$this->is_vat_due_on_invoice ? null : (
                        (int) VatDueDateCode::INVOICE_DATE
                            ->getCode(ElectronicInvoiceFormat::UBL)
                    )
                ));
        } elseif ($this->is_vat_due_on_invoice) {
            $invoicePeriod = (new Ubl\InvoicePeriod())
                ->setDescriptionCode((
                    (int) VatDueDateCode::INVOICE_DATE
                        ->getCode(ElectronicInvoiceFormat::UBL)
                ));
        }
        $document->setInvoicePeriod($invoicePeriod);

        //
        // - Références & Mentions
        //

        /** @var list<array{string, string}> $mentions */
        $mentions = [];

        // - Note B2G pour les factures à destination d'entités publiques.
        if ($this->buyer_is_public_entity && $specification->supportsMultipleNotes()) {
            $mentions[] = [ZugferdTextSubjectCodeQualifiers::UNTDID_4451_ADN, 'B2G'];
        }

        $mentionsOverride = Config::get('invoices.mentions', []);
        foreach ($sellerCountry->getInvoiceLegalMentions() as $mention) {
            $mentionText = $mentionsOverride[$mention->value] ?? null;
            if (empty($mentionText)) {
                $mentionKey = vsprintf('legals.mentions.%s.%s', [
                    $sellerCountry->getCode(),
                    $mention->value,
                ]);

                $mentionText = match ($mention) {
                    LegalMention::SELLER_IDENTITY => $sellerFullIdentity,
                    LegalMention::TRADE_REGISTER => (
                        $this->seller_trade_registry_city === null ? null : (
                            $i18n->translate(
                                [
                                    sprintf('business-registration-id-full.%s', $sellerCountry->getCode()),
                                    'business-registration-id-full.generic',
                                ],
                                [$this->seller_trade_registry_city, $sellerMainIdentifier],
                                '',
                            ) ?: null
                        )
                    ),
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
                $mentions[] = [$mention->getSubjectCode(), Str::limit($mentionText, 1024)];
            }
        }

        // - Mentions spéciales.
        if ($this->special_mentions !== null) {
            $specialMention = mb_trim(str_replace(["\r\n", "\r", "\n"], ' ', $this->special_mentions));
            $mentions[] = [ZugferdTextSubjectCodeQualifiers::UNTDID_4451_ZZZ, Str::limit($specialMention, 1024)];
        }

        if ($specification->supportsMultipleNotes()) {
            foreach ($mentions as [$subjectCode, $mention]) {
                $document->addNote($mention, $subjectCode);
            }
        } elseif (!empty($mentions)) {
            $document->setNote(implode("\n", array_column($mentions, 1)));
        }

        // - Bon de commande.
        if ($this->order_number !== null) {
            $document->setOrderReference((
                (new Ubl\OrderReference())
                    ->setId($this->order_number)
            ));
        }

        // - Référence à la facture parente, si nécessaire.
        $isCorrectionType = (
            $type === InvoiceType::CREDIT_NOTE ||
            $type === InvoiceType::PREPAYMENT_CREDIT_NOTE ||
            $type === InvoiceType::CORRECTION
        );
        if ($isCorrectionType) {
            $parentInvoice = $this->parent_invoice;
            if ($parentInvoice === null) {
                throw new \LogicException("Missing parent invoice for a correction invoice.");
            }

            $parentInvoiceType = match (true) {
                $parentInvoice->is_credit_note => (
                    InvoiceType::CREDIT_NOTE
                ),
                $parentInvoice->is_prepayment => (
                    InvoiceType::PREPAYMENT_INVOICE
                ),
                default => InvoiceType::INVOICE,
            };

            $parentInvoiceReference = (new Ubl\InvoiceDocumentReference())
                ->setOriginalInvoiceId($parentInvoice->number)
                ->setIssueDate($parentInvoice->date->toDateTime());

            if ($specification->supportsBillingReferenceTypeCode()) {
                $parentInvoiceReference->setDocumentTypeCode((
                    (int) $parentInvoiceType->value
                ));
            }

            $document->addBillingReference((
                (new Ubl\BillingReference())
                    ->setInvoiceDocumentReference($parentInvoiceReference)
            ));
        }

        // - Références aux acomptes pour les factures de solde.
        if ($this->is_prepayment_final) {
            foreach ($this->prepaymentInvoices as $prepaymentInvoice) {
                $prepaymentInvoiceReference = (new Ubl\InvoiceDocumentReference())
                    ->setOriginalInvoiceId($prepaymentInvoice->number)
                    ->setIssueDate($prepaymentInvoice->date->toDateTime());

                if ($specification->supportsBillingReferenceTypeCode()) {
                    $prepaymentInvoiceReference->setDocumentTypeCode((
                        (int) InvoiceType::PREPAYMENT_INVOICE->value
                    ));
                }

                $document->addBillingReference((
                    (new Ubl\BillingReference())
                        ->setInvoiceDocumentReference($prepaymentInvoiceReference)
                ));
            }
        }

        //
        // - Identification du vendeur
        //

        // - Numéro d'enregistrement du vendeur (e.g. SIREN en France)
        $sellerMainIdentifierScheme = $sellerCountry->getCompanyIdentifierScheme($sellerMainIdentifier);
        if ($sellerMainIdentifierScheme === null) {
            throw new \LogicException("Unable to retrieve the seller company identifier scheme.");
        }

        $seller = (new Ubl\Party())
            ->setLegalEntity((
                (new Ubl\LegalEntity())
                    ->setRegistrationName($this->seller_legal_name)
                    ->setCompanyId($sellerMainIdentifierRaw, $sellerMainIdentifierScheme->value)
                    ->setCompanyLegalForm($sellerLegalDescription)
            ))
            ->setPostalAddress((
                (new Ubl\Address())
                    ->setStreetName($this->seller_street)
                    ->setAdditionalStreetName($this->seller_additional_street)
                    ->setPostalZone($this->seller_postal_code)
                    ->setCityName($this->seller_locality)
                    ->setCountrySubentity($this->seller_administrative_area)
                    ->setCountry((
                        (new Ubl\Country())
                            ->setIdentificationCode($sellerCountry->getCode())
                    ))
            ))
            ->setContact((
                (new Ubl\Contact())
                    ->setElectronicMail($this->seller_email)
                    ->setTelephone($this->seller_phone)
            ));

        // - Identifiant secondaire si différent de l'identifiant principal.
        $sellerSecondaryIdentifierScheme = $sellerCountry->getCompanyIdentifierScheme($this->seller_registration_id);
        if (
            $sellerSecondaryIdentifierScheme !== null &&
            $sellerSecondaryIdentifierScheme !== $sellerMainIdentifierScheme
        ) {
            $sellerSecondaryIdentifierRaw = preg_replace('/[.\s-]/', '', $this->seller_registration_id);
            $seller->addPartyIdentification((
                (new Ubl\PartyIdentification())
                    ->setId($sellerSecondaryIdentifierRaw)
                    ->setSchemeId($sellerSecondaryIdentifierScheme->value)
            ));
        }

        // - Numéro de T.V.A. du vendeur.
        if ($this->global_tax_regime !== TaxRegime::OUT_OF_SCOPE->value) {
            if ($this->seller_vat_number !== null) {
                $sellerVatNumberRaw = preg_replace('/[.\s-]/', '', $this->seller_vat_number);
                $seller->setPartyTaxScheme((
                    (new Ubl\PartyTaxScheme())
                        ->setCompanyId($sellerVatNumberRaw)
                        ->setTaxScheme(((new Ubl\TaxScheme())->setId('VAT')))
                ));
            } else {
                $seller->setPartyTaxScheme((
                    (new Ubl\PartyTaxScheme())
                        ->setCompanyId($sellerMainIdentifierRaw)
                        ->setTaxScheme(((new Ubl\TaxScheme())->setId('LOC')))
                ));
            }
        }

        // - Identifiant de routage e-invoicing du vendeur.
        if ($this->seller_routing_identifier !== null) {
            $sellerRoutingMetadata = $sellerCountry->getInvoiceRoutingIdentifierMetadata(
                $this->seller_routing_identifier,
            );
            $seller->setEndpointId(
                $sellerRoutingMetadata['value'],
                $sellerRoutingMetadata['scheme']->value,
            );
        }

        $document->setAccountingSupplierParty((
            (new Ubl\AccountingParty())
                ->setParty($seller)
        ));

        //
        // - Identification de l'acheteur
        //

        $buyerCountry = $this->buyer_country;

        $buyerLegalEntity = (new Ubl\LegalEntity())
            ->setRegistrationName($this->buyer_legal_name);

        $buyer = (new Ubl\Party())
            ->setLegalEntity($buyerLegalEntity)
            ->setPostalAddress((
                (new Ubl\Address())
                    ->setStreetName($this->buyer_street)
                    ->setAdditionalStreetName($this->buyer_additional_street)
                    ->setPostalZone($this->buyer_postal_code)
                    ->setCityName($this->buyer_locality)
                    ->setCountrySubentity($this->buyer_administrative_area)
                    ->setCountry((
                        (new Ubl\Country())
                            ->setIdentificationCode($buyerCountry->getInheritedCode())
                    ))
            ))
            ->setContact((
                (new Ubl\Contact())
                    ->setName($this->buyer_full_name)
            ));

        if ($this->buyer_reference !== null) {
            $document->setBuyerReference($this->buyer_reference);
        }

        // - Si l'acheteur est dans le même pays, on ajoute son numéro
        //   d'enregistrement et identifiant de routage.
        if ($buyerCountry->isSame($sellerCountry, true)) {
            $buyerMainIdentifier = $buyerCountry->inferMainCompanyIdentifier($this->buyer_registration_id);
            $buyerMainIdentifierScheme = $buyerCountry->getCompanyIdentifierScheme($buyerMainIdentifier);
            $buyerMainIdentifierRaw = preg_replace('/[.\s-]/', '', $buyerMainIdentifier);
            if ($buyerMainIdentifierScheme === null) {
                throw new \LogicException("Unable to retrieve the buyer company identifier scheme.");
            }
            $buyerLegalEntity->setCompanyId($buyerMainIdentifierRaw, $buyerMainIdentifierScheme->value);

            /** @var Ubl\PartyIdentification[] $buyerIdentifications */
            $buyerIdentifications = [];

            // - Code routage : Pour les entités publiques, on utilise le code de service de la société.
            if ($this->buyer_is_public_entity && $this->buyer_service_code !== null) {
                $buyerIdentifications[] = (new Ubl\PartyIdentification())
                    ->setId($this->buyer_service_code)
                    ->setSchemeId('0224'); // - Code routage.
            }

            // - Identifiant secondaire si différent de l'identifiant principal.
            $buyerSecondaryIdentifierScheme = $buyerCountry->getCompanyIdentifierScheme(
                $this->buyer_registration_id,
            );
            if (
                $buyerSecondaryIdentifierScheme !== null &&
                $buyerSecondaryIdentifierScheme !== $buyerMainIdentifierScheme
            ) {
                $buyerSecondaryIdentifierRaw = preg_replace('/[.\s-]/', '', $this->buyer_registration_id);
                $buyerIdentifications[] = (new Ubl\PartyIdentification())
                    ->setId($buyerSecondaryIdentifierRaw)
                    ->setSchemeId($buyerSecondaryIdentifierScheme->value);
            }

            // - Si la specification n'autorise qu'un identifiant par partie, on ne
            //   garde que le premier (priorité au code routage des entités publiques).
            if (!$specification->supportsMultiplePartyIdentification()) {
                $buyerIdentifications = array_slice($buyerIdentifications, 0, 1);
            }
            $buyer->setPartyIdentifications($buyerIdentifications);
        }

        // - Si l'acheteur est dans la même zone T.V.A., on ajoute son numéro s'il existe.
        if (
            $this->global_tax_regime !== TaxRegime::OUT_OF_SCOPE->value &&
            $this->buyer_vat_number !== null &&
            $sellerCountry->isSameVatArea($buyerCountry)
        ) {
            $buyerRawVatNumber = preg_replace('/[.\s-]/', '', $this->buyer_vat_number);
            $buyer->setPartyTaxScheme((
                (new Ubl\PartyTaxScheme())
                    ->setCompanyId($buyerRawVatNumber)
                    ->setTaxScheme(((new Ubl\TaxScheme())->setId('VAT')))
            ));
        }

        // - Identifiant de routage e-invoicing de l'acheteur.
        if ($this->buyer_routing_identifier !== null) {
            $buyerRoutingMetadata = $buyerCountry->getInvoiceRoutingIdentifierMetadata(
                $this->buyer_routing_identifier,
            );
            $buyer->setEndpointId(
                $buyerRoutingMetadata['value'],
                $buyerRoutingMetadata['scheme']->value,
            );
        }

        $document->setAccountingCustomerParty((
            (new Ubl\AccountingParty())
                ->setParty($buyer)
        ));

        //
        // - Livraison
        //

        $delivery = (new Ubl\Delivery())
            ->setDeliveryParty((
                (new Ubl\Party())
                    ->setName($this->buyer_legal_name)
            ))
            ->setDeliveryLocation((
                (new Ubl\Address())
                    ->setStreetName($this->buyer_street)
                    ->setAdditionalStreetName($this->buyer_additional_street)
                    ->setPostalZone($this->buyer_postal_code)
                    ->setCityName($this->buyer_locality)
                    ->setCountrySubentity($this->buyer_administrative_area)
                    ->setCountry((
                        (new Ubl\Country())
                            ->setIdentificationCode($buyerCountry->getInheritedCode())
                    ))
            ));

        if ($this->booking_period === null) {
            $delivery->setActualDeliveryDate($this->date->toDateTime());
        }

        $document->setDelivery($delivery);

        //
        // - Lignes de facture
        //

        $lines = [];
        $lineIndex = 0;

        $getExemptionData = static function (
            string $taxRegime,
            array|string|null $taxExemptionCodes,
            array|string|null $taxExemptionReasons = null,
        ) use ($i18n) {
            $taxRegime = TaxRegime::from($taxRegime);
            if ($taxRegime === TaxRegime::STANDARD) {
                return ['code' => null, 'reason' => null];
            }

            // - Codes d'exemption.
            $taxExemptionCodes = array_map(
                static fn ($code) => VatExemptionCodeFactory::from($code),
                (array) ($taxExemptionCodes ?? []),
            );
            if (empty($taxExemptionCodes)) {
                $taxExemptionCodes = with(
                    $taxRegime->getDefaultExemptionCode(),
                    static fn ($regime) => $regime !== null ? [$regime] : [],
                );
            }

            // - Raisons (textuelle) d'exemption.
            $taxExemptionReasons ??= [];
            if (!empty($taxExemptionCodes) && empty($taxExemptionReasons)) {
                $taxExemptionReasons = array_filter(array_map(
                    static fn ($code) => (
                        $i18n->translate(
                            sprintf('legals.vat-exemptions.%s.mention', $code->value),
                            null,
                            '',
                        )
                    ),
                    $taxExemptionCodes,
                ));
            }

            // - Il ne peut pas y avoir plusieurs codes d'exemptions, s'il y en a
            //   qu'un seul, on l'utilise, sinon, on ne le passe pas et ce sera
            //   une raison textuelle.
            $taxExemptionCode = count($taxExemptionCodes) === 1
                ? current($taxExemptionCodes)
                : null;

            // - Si c'est un code custom, il n'y a pas de véritable code.
            if ($taxExemptionCode?->isCustom()) {
                $taxExemptionCode = null;
            }
            $taxExemptionCode ??= $taxRegime->getDefaultExemptionCode();

            // - S'il n'y a pas de raison à une exemption, on utilise un message de base.
            if (
                $taxRegime === TaxRegime::EXEMPTED &&
                $taxExemptionCode === null &&
                empty($taxExemptionReasons)
            ) {
                $taxExemptionReasons = [$i18n->translate('exempted')];
            }

            return [
                'code' => $taxExemptionCode?->value,
                'reason' => (
                    !empty($taxExemptionReasons)
                        ? Str::limit(implode('; ', $taxExemptionReasons), 1024)
                        : null
                ),
            ];
        };

        $globalTaxRegime = $this->global_tax_regime;
        $globalTaxExemptionData = $globalTaxRegime === null ? null : (
            $getExemptionData(
                $globalTaxRegime,
                $this->global_tax_exemption_code,
                $this->global_tax_exemption_reason,
            )
        );

        /** @return array{ regime: string, percent: float, reason: string|null, code: string|null } */
        $getPositionTaxData = static function (
            string|null $taxRegime,
            string|null $taxExemptionCode,
            array|null $taxes,
        ) use (
            $globalTaxRegime,
            $globalTaxExemptionData,
            $getExemptionData,
        ) {
            // - Régime fiscal global: Les lignes héritent du régime de la facture.
            if ($globalTaxRegime !== null) {
                if ($taxes !== null) {
                    throw new \LogicException("Line taxes should be `null` when a global tax regime is applied.");
                }

                return [
                    'regime' => $globalTaxRegime,
                    'percent' => $globalTaxRegime !== TaxRegime::OUT_OF_SCOPE->value ? 0 : null,
                    'reason' => $globalTaxExemptionData['reason'],
                    'code' => $globalTaxExemptionData['code'],
                ];
            }

            if ($taxRegime === null) {
                throw new \LogicException(
                    "Line tax regime should always be defined where " .
                    "there is no global tax regime applied.",
                );
            }

            if ($taxRegime === TaxRegime::STANDARD->value) {
                if (count($taxes) > 1) {
                    throw new \LogicException("Only one tax per line is allowed.");
                }

                // - Si pas de taxe pour la ligne, on part du principe qu'elle
                //   est exemptée sans raison spécifique.
                if (empty($taxes)) {
                    $exemptionData = $getExemptionData(TaxRegime::EXEMPTED->value, null);
                    return [
                        'regime' => TaxRegime::EXEMPTED->value,
                        'percent' => 0,
                        'reason' => $exemptionData['reason'],
                        'code' => $exemptionData['code'],
                    ];
                }

                /** @var TaxDataStandard $tax */
                $tax = current($taxes);
                return [
                    'regime' => (
                        !$tax['value']->isZero()
                            ? TaxRegime::STANDARD->value
                            : TaxRegime::ZERO_RATED->value
                    ),
                    'percent' => $tax['value']->toFloat(),
                    'reason' => null,
                    'code' => null,
                ];
            }

            // - Exempté, auto-liquidation, etc.
            $taxExemptionData = $getExemptionData($taxRegime, $taxExemptionCode);
            return [
                'regime' => $taxRegime,
                'percent' => $taxRegime !== TaxRegime::OUT_OF_SCOPE->value ? 0 : null,
                'reason' => $taxExemptionData['reason'],
                'code' => $taxExemptionData['code'],
            ];
        };

        $showDescriptions = Setting::getWithKey('invoices.showDescriptions');
        $showReplacementPrices = Setting::getWithKey('invoices.showReplacementPrices');
        foreach ($this->materials as $material) {
            if ($material->is_hidden_on_bill) {
                $isFree = (
                    $material->unit_price->isZero() &&
                    $material->total_without_taxes->isZero()
                );
                if ($isFree) {
                    continue;
                }
            }

            // - Produit de la ligne.
            $lineItem = (new Ubl\Item())
                ->setName($material->name)
                ->setDescription((
                    $showDescriptions && $material->description !== null
                        ? Str::limit($material->description, 1024)
                        : null
                ))
                ->setSellersItemIdentification($material->reference);

            /** @var Ubl\AdditionalItemProperty[] $lineProperties */
            $lineProperties = [];

            // - Prix de remplacement.
            if ($showReplacementPrices && $material->unit_replacement_price !== null) {
                $lineProperties[] = (new Ubl\AdditionalItemProperty())
                    ->setName(sprintf(
                        '%s (%s)',
                        $i18n->translate('unit-replacement-value'),
                        strtoupper($this->currency),
                    ))
                    ->setValue((string) $material->unit_replacement_price);
            }
            if (!empty($lineProperties)) {
                $lineItem->setAdditionalItemProperties($lineProperties);
            }

            // - Taxes sur la ligne.
            $tax = $getPositionTaxData(
                $material->tax_regime,
                $material->tax_exemption_code,
                $material->taxes,
            );
            $lineTax = (new Ubl\ClassifiedTaxCategory())
                ->setTaxScheme((
                    (new Ubl\TaxScheme())
                        ->setId(ZugferdVatTypeCodes::VALUE_ADDED_TAX)
                ))
                ->setId($tax['regime'])
                ->setPercent($tax['percent']);
            if ($specification->supportsLineExemptionReason()) {
                $lineTax
                    ->setTaxExemptionReasonCode($tax['code'])
                    ->setTaxExemptionReason($tax['reason']);
            }
            $lineItem->setClassifiedTaxCategory($lineTax);

            $line = ($this->is_credit_note ? new Ubl\CreditNoteLine() : new Ubl\InvoiceLine())
                ->setId((string) ++$lineIndex)
                ->setItem($lineItem)
                ->setPrice((
                    (new Ubl\Price())
                        ->setPriceAmount($material->unit_price_period->toFloat())
                ))
                ->setUnitCode(Ubl\UnitCode::UNIT)
                ->setInvoicedQuantity($material->quantity)
                ->setLineExtensionAmount($material->total_without_taxes->toFloat());

            // - Remise sur la ligne.
            if ($material->has_discount) {
                $lineDiscount = (new Ubl\AllowanceCharge())
                    ->setChargeIndicator(false)
                    ->setBaseAmount($material->total_without_discount->toFloat())
                    ->setMultiplierFactorNumeric($material->discount_rate->toFloat())
                    ->setAllowanceChargeReasonCode(ZugferdAllowanceCodes::DISCOUNT)
                    ->setAmount($material->total_discount->toFloat())
                ;
                $line->setAllowanceCharges([$lineDiscount]);
            }

            $lines[] = $line;
        }

        foreach ($this->extras as $extra) {
            $isNegativeLine = $extra->unit_price->isLessThan(0);
            if ($isNegativeLine && $extra->has_discount) {
                throw new \LogicException(sprintf(
                    "Cannot generate the #%d invoice XML: Negative extra cannot have discount.",
                    $this->id,
                ));
            }

            // - Taxes sur la ligne.
            $tax = $getPositionTaxData(
                $extra->tax_regime,
                $extra->tax_exemption_code,
                $extra->taxes,
            );
            $lineTax = (new Ubl\ClassifiedTaxCategory())
                ->setTaxScheme((
                    (new Ubl\TaxScheme())
                        ->setId(ZugferdVatTypeCodes::VALUE_ADDED_TAX)
                ))
                ->setId($tax['regime'])
                ->setPercent($tax['percent']);

            if ($specification->supportsLineExemptionReason()) {
                $lineTax
                    ->setTaxExemptionReasonCode($tax['code'])
                    ->setTaxExemptionReason($tax['reason']);
            }

            $line = ($this->is_credit_note ? new Ubl\CreditNoteLine() : new Ubl\InvoiceLine())
                ->setId((string) ++$lineIndex)
                ->setItem((
                    (new Ubl\Item())
                        ->setName($extra->description)
                        ->setClassifiedTaxCategory($lineTax)
                ))
                ->setPrice((
                    (new Ubl\Price())
                        ->setPriceAmount($extra->unit_price->abs()->toFloat())
                ))
                ->setUnitCode(Ubl\UnitCode::UNIT)
                ->setInvoicedQuantity($isNegativeLine ? -$extra->quantity : $extra->quantity)
                ->setLineExtensionAmount($extra->total_without_taxes->toFloat());

            // - Remise sur la ligne.
            if ($extra->has_discount) {
                $lineDiscount = (new Ubl\AllowanceCharge())
                    ->setChargeIndicator(false)
                    ->setBaseAmount($extra->total_without_discount->toFloat())
                    ->setMultiplierFactorNumeric($extra->discount_rate->toFloat())
                    ->setAllowanceChargeReasonCode(ZugferdAllowanceCodes::DISCOUNT)
                    ->setAmount($extra->total_discount->toFloat())
                ;
                $line->setAllowanceCharges([$lineDiscount]);
            }

            $lines[] = $line;
        }

        //
        // - Lignes de reprise d'acompte.
        //

        $prepaymentTotal = Decimal::zero()->toScale(2);
        if ($this->prepaymentInvoices->isNotEmpty()) {
            $dateFormatter = new \IntlDateFormatter(
                $i18n->getLocale(),
                \IntlDateFormatter::SHORT,
                \IntlDateFormatter::NONE,
                $this->date->getTimezone(),
                \IntlDateFormatter::GREGORIAN,
            );

            foreach ($this->prepaymentInvoices as $index => $prepaymentInvoice) {
                $isValidPrepaymentInvoice = (
                    $prepaymentInvoice->materials->isEmpty() &&
                    $prepaymentInvoice->global_discount_rate->isZero() &&
                    $prepaymentInvoice->extras->every(static fn ($line) => (
                        $line->total_without_taxes->isEqualTo($line->unit_price) &&
                        $line->discount_rate->isZero()
                    ))
                );
                if (!$isValidPrepaymentInvoice) {
                    throw new \LogicException(sprintf(
                        'The prepayment #%d invoice contains invalid data.',
                        $prepaymentInvoice->id,
                    ));
                }

                foreach ($prepaymentInvoice->extras as $prepaymentLineIndex => $prepaymentLine) {
                    $isNegativeLine = $prepaymentLine->total_without_taxes->isNegative();

                    // - Taxes sur la ligne.
                    $tax = $getPositionTaxData(
                        $prepaymentLine->tax_regime,
                        $prepaymentLine->tax_exemption_code,
                        $prepaymentLine->taxes,
                    );
                    $lineTax = (new Ubl\ClassifiedTaxCategory())
                        ->setTaxScheme((
                            (new Ubl\TaxScheme())
                                ->setId(ZugferdVatTypeCodes::VALUE_ADDED_TAX)
                        ))
                        ->setId($tax['regime'])
                        ->setPercent($tax['percent']);

                    if ($specification->supportsLineExemptionReason()) {
                        $lineTax
                            ->setTaxExemptionReasonCode($tax['code'])
                            ->setTaxExemptionReason($tax['reason']);
                    }

                    $line = ($this->is_credit_note ? new Ubl\CreditNoteLine() : new Ubl\InvoiceLine())
                        ->setId((string) ++$lineIndex)
                        ->setItem((
                            (new Ubl\Item())
                                ->setName((
                                    $i18n->translate('prepayment-reprise-line.details', [
                                        'index' => $index + 1,
                                        'number' => $prepaymentInvoice->number,
                                        'date' => $dateFormatter->format($prepaymentInvoice->date),
                                    ])
                                ))
                                ->setClassifiedTaxCategory($lineTax)
                        ))
                        ->setPrice((
                            (new Ubl\Price())
                                ->setPriceAmount($prepaymentLine->total_without_taxes->abs()->toFloat())
                        ))
                        ->setUnitCode(Ubl\UnitCode::UNIT)
                        ->setInvoicedQuantity($isNegativeLine ? 1 : -1)
                        ->setLineExtensionAmount($prepaymentLine->total_without_taxes->negated()->toFloat());

                    // - Référence à la facture d'acompte.
                    if ($specification->supportsLineLevelBillingReferences()) {
                        $prepaymentLineReference = (new Ubl\InvoiceDocumentReference())
                            ->setOriginalInvoiceId($prepaymentInvoice->number)
                            ->setIssueDate($prepaymentInvoice->date->toDateTime());

                        if ($specification->supportsBillingReferenceTypeCode()) {
                            $prepaymentLineReference->setDocumentTypeCode((
                                (int) InvoiceType::PREPAYMENT_INVOICE->value
                            ));
                        }

                        $line->setBillingReference((
                            (new Ubl\BillingReference())
                                ->setInvoiceDocumentReference($prepaymentLineReference)
                                ->setLineId((string) ($prepaymentLineIndex + 1))
                        ));
                    }

                    $lines[] = $line;
                }

                $prepaymentTotal = $prepaymentTotal->plus($prepaymentInvoice->total_without_taxes);
            }
        }

        if (empty($lines)) {
            throw new \LogicException(sprintf(
                "Cannot generate the #%d invoice XML: No billable line items.",
                $this->id,
            ));
        }

        if ($this->is_credit_note) {
            /** @var Ubl\CreditNote $document */
            $document->setCreditNoteLines($lines);
        } else {
            /** @var Ubl\Invoice $document */
            $document->setInvoiceLines($lines);
        }

        //
        // - Remise globale
        //

        if (!$this->total_global_discount->isZero()) {
            $globalDiscounts = [];
            $discountBreakdown = $this->global_discount_breakdown;
            foreach ($discountBreakdown as $discount) {
                if ($discount['value']->isZero()) {
                    continue;
                }

                if ($discount['tax']['type'] === TaxRegime::STANDARD->value) {
                    $tax = [
                        'regime' => (
                            !$discount['tax']['value']->isZero()
                                ? TaxRegime::STANDARD->value
                                : TaxRegime::ZERO_RATED->value
                        ),
                        'percent' => $discount['tax']['value']->toFloat(),
                        'reason' => null,
                        'code' => null,
                    ];
                } else {
                    $tax = [
                        'regime' => $discount['tax']['type'],
                        'percent' => $discount['tax']['type'] !== TaxRegime::OUT_OF_SCOPE->value ? 0 : null,
                        ...$getExemptionData($discount['tax']['type'], $discount['tax']['reason'] ?? null),
                    ];
                }

                $discountTax = (new Ubl\TaxCategory())
                    ->setTaxScheme((
                        (new Ubl\TaxScheme())
                            ->setId(ZugferdVatTypeCodes::VALUE_ADDED_TAX)
                    ))
                    ->setId($tax['regime'])
                    ->setPercent($tax['percent']);

                if ($specification->supportsLineExemptionReason()) {
                    $discountTax
                        ->setTaxExemptionReasonCode($tax['code'])
                        ->setTaxExemptionReason($tax['reason']);
                }

                $globalDiscounts[] = (new Ubl\AllowanceCharge())
                    ->setChargeIndicator(false)
                    ->setAllowanceChargeReasonCode(ZugferdAllowanceCodes::DISCOUNT)
                    ->setMultiplierFactorNumeric($this->global_discount_rate->toFloat())
                    ->setBaseAmount($discount['base']->toFloat())
                    ->setTaxCategory($discountTax)
                    ->setAmount($discount['value']->toFloat());
            }
            if (!empty($globalDiscounts)) {
                $document->setAllowanceCharges($globalDiscounts);
            }
        }

        //
        // - Taxes au niveau du document
        //

        $taxSubTotals = [];
        $totalTaxesAmount = Decimal::zero()->toScale(2);
        if ($globalTaxRegime !== null) {
            $taxSubTotals[] = (new Ubl\TaxSubTotal())
                ->setTaxCategory((
                    (new Ubl\TaxCategory())
                        ->setTaxScheme((
                            (new Ubl\TaxScheme())
                                ->setId(ZugferdVatTypeCodes::VALUE_ADDED_TAX)
                        ))
                        ->setId($this->global_tax_regime)
                        ->setPercent($globalTaxRegime !== TaxRegime::OUT_OF_SCOPE->value ? 0 : null)
                        ->setTaxExemptionReasonCode($globalTaxExemptionData['code'])
                        ->setTaxExemptionReason($globalTaxExemptionData['reason'])
                ))
                ->setTaxableAmount($this->total_without_taxes->toFloat())
                ->setTaxAmount(0);
        } else {
            if (empty($this->total_taxes)) {
                throw new \LogicException(sprintf(
                    "Cannot generate the #%d invoice XML: Missing taxes.",
                    $this->id,
                ));
            }

            foreach ($this->total_taxes as $tax) {
                if ($tax['type'] === TaxRegime::STANDARD->value) {
                    $tax = [
                        'regime' => (
                            !$tax['value']->isZero()
                                ? TaxRegime::STANDARD->value
                                : TaxRegime::ZERO_RATED->value
                        ),
                        'base' => $tax['base']->toFloat(),
                        'percent' => $tax['value']->toFloat(),
                        'total' => $tax['total']->toFloat(),
                        'reason' => null,
                        'code' => null,
                    ];
                } else {
                    $tax = [
                        'regime' => $tax['type'],
                        'base' => $tax['base']->toFloat(),
                        'percent' => $tax['type'] !== TaxRegime::OUT_OF_SCOPE->value ? 0 : null,
                        'total' => 0,
                        ...$getExemptionData($tax['type'], $tax['reason']),
                    ];
                }

                $taxSubTotals[] = (new Ubl\TaxSubTotal())
                    ->setTaxCategory((
                        (new Ubl\TaxCategory())
                            ->setTaxScheme((
                                (new Ubl\TaxScheme())
                                    ->setId(ZugferdVatTypeCodes::VALUE_ADDED_TAX)
                            ))
                            ->setId($tax['regime'])
                            ->setPercent($tax['percent'])
                            ->setTaxExemptionReasonCode($tax['code'])
                            ->setTaxExemptionReason($tax['reason'])
                    ))
                    ->setTaxableAmount($tax['base'])
                    ->setTaxAmount($tax['total']);

                $totalTaxesAmount = $totalTaxesAmount->plus($tax['total']);
            }
        }

        $document->setTaxTotal((
            (new Ubl\TaxTotal())
                ->setTaxAmount($totalTaxesAmount->toFloat())
                ->setTaxSubTotals($taxSubTotals)
        ));

        //
        // - Totaux
        //

        $linesTotal = $this->total_without_global_discount
            ->minus($prepaymentTotal);

        $allowancesTotal = $this->total_global_discount;

        $document->setLegalMonetaryTotal((
            (new Ubl\LegalMonetaryTotal())
                ->setLineExtensionAmount($linesTotal->toFloat())
                ->setTaxExclusiveAmount($this->total_without_taxes->toFloat())
                ->setAllowanceTotalAmount($allowancesTotal->toFloat())
                ->setChargeTotalAmount(0)
                ->setTaxInclusiveAmount($this->total_with_taxes->toFloat())
                ->setPayableAmount($this->total_with_taxes->toFloat())
        ));

        //
        // - Conditions de paiement
        //

        if ($this->total_with_taxes->isGreaterThan(0)) {
            $dueDate = $this->due_date !== null
                ? CarbonImmutable::parse($this->due_date)
                : null;

            if ($dueDate === null) {
                $paymentTermDays = $this->due_delay
                    ?? Config::get('invoices.paymentTermDays');

                $document->setPaymentTerms((
                    (new Ubl\PaymentTerms())->setNote(Str::limit(
                        (
                            ($paymentTermDays ?? 0) > 0
                                ? $i18n->plural('payment-terms.with-delay', $paymentTermDays)
                                : $i18n->translate('payment-terms.immediately')
                        ),
                        1024,
                    ))
                ));
            } else {
                $document->setDueDate($dueDate->toDateTime());
            }

            // - Moyens de paiement.
            $paymentMeans = [];
            $rawPaymentMethods = Config::get('invoices.paymentMethods');
            if (!$this->is_credit_note && is_array($rawPaymentMethods)) {
                foreach (PaymentMethod::cases() as $method) {
                    $methodConfig = $rawPaymentMethods[$method->value] ?? null;
                    if ($methodConfig === null || $methodConfig === false) {
                        continue;
                    }

                    if ($method === PaymentMethod::TRANSFER) {
                        if (is_array($methodConfig) && !empty($methodConfig['iban'])) {
                            $paymentMeans[] = (new Ubl\PaymentMeans())
                                ->setPaymentMeansCode($method->getCode())
                                ->setPayeeFinancialAccount((
                                    (new Ubl\PayeeFinancialAccount())
                                        ->setId($methodConfig['iban'])
                                        ->setName($methodConfig['holder'] ?? $this->seller_legal_name)
                                        ->setFinancialInstitutionBranch($methodConfig['bic'] === null ? null : (
                                            (new Ubl\FinancialInstitutionBranch())
                                                ->setId($methodConfig['bic'])
                                        ))
                                ));
                        }
                    } else {
                        $paymentMeans[] = (new Ubl\PaymentMeans())
                            ->setPaymentMeansCode($method->getCode());
                    }

                    // TODO: À supprimer lorsque plus d'un moyen de paiement sera
                    //       supporté par la norme (cf. UBL-SR-47).
                    break;
                }
            }
            if (!empty($paymentMeans)) {
                $document->setPaymentMeans($paymentMeans);
            }
        }

        $generator = new Ubl\Generator();
        return $this->is_credit_note
            ? $generator->creditNote($document, $this->currency)
            : $generator->invoice($document, $this->currency);
    }

    private function getUblName(?I18n $i18n = null): string
    {
        $i18n ??= new I18n($this->lang);

        return sprintf('%s.xml', Str::slugify(implode('-', array_filter([
            $i18n->translate($this->is_credit_note ? 'credit-note' : 'invoice'),
            $this->seller_legal_name,
            $this->number,
            (
                $this->buyer_type === LegalEntityType::COMPANY->value
                    ? $this->buyer_legal_name
                    : $this->buyer_full_name
            ),
        ]))));
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
        'order_number',
        'date',
        'due_date',
        'due_delay',
        'seller_legal_name',
        'seller_registration_id',
        'seller_vat_number',
        'seller_routing_identifier',
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
        'buyer_routing_identifier',
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
        'is_electronic',
        'is_prepayment',
        'is_credit_note',
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
        $value = $value instanceof InvoiceStatus ? $value->value : $value;
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

    public function setSellerRoutingIdentifierAttribute(mixed $rawValue): void
    {
        // - Si ce n'est pas une chaîne (`null` ou valeur invalide) => On ne va pas plus loin.
        if (!is_string($rawValue)) {
            $this->attributes['seller_routing_identifier'] = $rawValue;
            return;
        }
        $rawValue = trim($rawValue);

        // - Si la valeur est vide, on ne va pas plus loin.
        if ($rawValue === '') {
            $this->attributes['seller_routing_identifier'] = null;
            return;
        }

        $rawSellerCountryCode = $this->getAttributeFromArray('seller_country');
        $sellerCountry = V::countryCode()->validate($rawSellerCountryCode)
            ? new Country($rawSellerCountryCode)
            : null;

        // - Si le pays n'est pas défini, on ne peut pas normaliser.
        if ($sellerCountry === null) {
            $this->attributes['seller_routing_identifier'] = $rawValue;
            return;
        }

        $this->attributes['seller_routing_identifier'] = (
            $sellerCountry->isValidInvoiceRoutingIdentifier($rawValue)
                ? $sellerCountry->normalizeInvoiceRoutingIdentifier($rawValue)
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

    public function setBuyerRoutingIdentifierAttribute(mixed $rawValue): void
    {
        // - Si ce n'est pas une chaîne (`null` ou valeur invalide) => On ne va pas plus loin.
        if (!is_string($rawValue)) {
            $this->attributes['buyer_routing_identifier'] = $rawValue;
            return;
        }
        $rawValue = trim($rawValue);

        // - Si la valeur est vide, on ne va pas plus loin.
        if ($rawValue === '') {
            $this->attributes['buyer_routing_identifier'] = null;
            return;
        }

        $rawBuyerCountryCode = $this->getAttributeFromArray('buyer_country');
        $buyerCountry = V::countryCode()->validate($rawBuyerCountryCode)
            ? new Country($rawBuyerCountryCode)
            : null;

        // - Si le pays n'est pas défini, on ne peut pas normaliser.
        if ($buyerCountry === null) {
            $this->attributes['buyer_routing_identifier'] = $rawValue;
            return;
        }

        $this->attributes['buyer_routing_identifier'] = (
            $buyerCountry->isValidInvoiceRoutingIdentifier($rawValue)
                ? $buyerCountry->normalizeInvoiceRoutingIdentifier($rawValue)
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
                ->orWhere('order_number', 'LIKE', $safeTerm)
                ->orWhereHas('buyer', static fn (Builder $buyerQuery) => (
                    // - Ici on passe `$term` car `Beneficiary::search()` se charge de l'échappement.
                    $buyerQuery->search($term)
                ))
        ));
    }

    public function scopeWithStatus(Builder $query, InvoiceStatus|array $status): Builder
    {
        $statuses = !is_array($status) ? [$status] : $status;
        Assert::allIsInstanceOf($statuses, InvoiceStatus::class);

        $now = CarbonImmutable::now();
        $includePaid = in_array(InvoiceStatus::PAID, $statuses, true);
        $includeLate = in_array(InvoiceStatus::OVERDUE, $statuses, true);
        $includeObsolete = in_array(InvoiceStatus::OBSOLETE, $statuses, true);
        $includeCancelled = in_array(InvoiceStatus::CANCELLED, $statuses, true);
        $includePartiallyPaid = in_array(InvoiceStatus::PARTIALLY_PAID, $statuses, true);
        $rawStatuses = array_filter($statuses, static function (InvoiceStatus $status) {
            $statuses = [
                InvoiceStatus::DRAFT,
                InvoiceStatus::PENDING,
                InvoiceStatus::SENT,
            ];
            return in_array($status, $statuses, true);
        });

        return $query->where(
            static function (Builder $subQuery) use (
                $now,
                $rawStatuses,
                $includePaid,
                $includeLate,
                $includeObsolete,
                $includeCancelled,
                $includePartiallyPaid,
            ) {
                $obsoleteCondition = static fn (Builder $subQuery) => (
                    $subQuery
                        ->where('status', InvoiceStatus::DRAFT->value)
                        ->whereNotNull('due_date')
                        ->where('due_date', '<', $now->startOfDay())
                );
                $cancelledCondition = static fn (Builder $subQuery) => (
                    $subQuery->whereHas('childInvoice')
                );
                $paidCondition = static fn (Builder $subQuery) => (
                    $subQuery
                        ->whereNot($cancelledCondition)
                        ->whereRaw('ABS(total_with_taxes) > 0')
                        ->where(
                            InvoicePayment::query()
                                ->selectRaw('COALESCE(SUM(amount), 0)')
                                ->whereColumn('invoice_id', 'invoices.id'),
                            '>=',
                            new Expression('ABS(total_with_taxes)'),
                        )
                );
                $partiallyPaidCondition = static fn (Builder $subQuery) => (
                    $subQuery
                        ->whereNot($cancelledCondition)
                        ->whereNot($paidCondition)
                        ->whereRaw('ABS(total_with_taxes) > 0')
                        ->where(
                            InvoicePayment::query()
                                ->selectRaw('COALESCE(SUM(amount), 0)')
                                ->whereColumn('invoice_id', 'invoices.id'),
                            '>',
                            0,
                        )
                );
                $overdueCondition = static fn (Builder $subQuery) => (
                    $subQuery
                        ->whereNot($paidCondition)
                        ->whereNot($cancelledCondition)
                        ->where('status', InvoiceStatus::SENT->value)
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
                        $subSubQuery->orWhere(static fn (Builder $subSubQuery) => (
                            $subSubQuery
                                ->whereNot($paidCondition)
                                ->whereNot($overdueCondition)
                                ->whereNot($cancelledCondition)
                                ->whereNot($partiallyPaidCondition)
                                ->whereNot($obsoleteCondition)
                                ->whereIn('status', array_map(
                                    static fn (InvoiceStatus $status) => $status->value,
                                    $rawStatuses,
                                ))
                        ))
                    ))
                    ->when($includeLate, static fn (Builder $subSubQuery) => (
                        $subSubQuery->orWhere($overdueCondition)
                    ))
                    ->when($includeObsolete, static fn (Builder $subSubQuery) => (
                        $subSubQuery->orWhere($obsoleteCondition)
                    ))
                    ->when($includePaid, static fn (Builder $subSubQuery) => (
                        $subSubQuery->orWhere($paidCondition)
                    ))
                    ->when($includePartiallyPaid, static fn (Builder $subSubQuery) => (
                        $subSubQuery->orWhere($partiallyPaidCondition)
                    ))
                    ->when($includeCancelled, static fn (Builder $subSubQuery) => (
                        $subSubQuery->orWhere($cancelledCondition)
                    ));
            },
        );
    }

    public function scopeCustomOrderBy(Builder $query, string $column, string $direction = 'asc'): Builder
    {
        Assert::inArray($column, $this->getOrderableColumns(), "Invalid order field.");
        Assert::inArray($direction, ['asc', 'desc'], "Invalid direction.");

        $customOrderFields = [
            'status',
            'date',
            'due_date',
            'total_without_taxes',
            'total_with_taxes',
        ];
        if (!in_array($column, $customOrderFields, true)) {
            return $query->orderBy($column, $direction);
        }

        if (in_array($column, ['total_without_taxes', 'total_with_taxes'], true)) {
            return $query->orderByRaw(vsprintf(
                "IF(is_credit_note, -%s, %s) %s",
                [$column, $column, $direction],
            ));
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
            InvoiceStatus::DRAFT->value,
            InvoiceStatus::OVERDUE->value,
            InvoiceStatus::PENDING->value,
            InvoiceStatus::SENT->value,
            InvoiceStatus::PARTIALLY_PAID->value,
            InvoiceStatus::PAID->value,
            InvoiceStatus::OBSOLETE->value,
            InvoiceStatus::CANCELLED->value,
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
                InvoiceStatus::DRAFT->value,
                CarbonImmutable::now()->format('Y-m-d'),
            ],
        );
        $isCancelledCondition = <<<'SQL'
            EXISTS (
                SELECT 1
                FROM invoices AS child
                WHERE child.parent_invoice_id = invoices.id
            )
        SQL;
        $isPaidCondition = <<<'SQL'
            ABS(total_with_taxes) > 0
            AND (
                SELECT COALESCE(SUM(payments.amount), 0)
                FROM invoice_payments AS payments
                WHERE payments.invoice_id = invoices.id
            ) >= ABS(total_with_taxes)
        SQL;
        $isPartiallyPaidCondition = <<<'SQL'
            ABS(total_with_taxes) > 0
            AND (
                SELECT COALESCE(SUM(payments.amount), 0)
                FROM invoice_payments AS payments
                WHERE payments.invoice_id = invoices.id
            ) > 0
        SQL;
        $isOverdueCondition = vsprintf(
            <<<'SQL'
                status = '%s'
                AND (
                    (due_date IS NOT NULL AND due_date < '%2$s')
                    OR (
                        due_date IS NULL
                        AND date IS NOT NULL
                        AND due_delay IS NOT NULL
                        AND DATE_ADD(date, INTERVAL due_delay DAY) < '%2$s'
                    )
                )
            SQL,
            [
                InvoiceStatus::SENT->value,
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
                            WHEN %5$s THEN ?
                            ELSE status
                        END,
                        %6$s
                    )
                    SQL,
                    [
                        $isObsoleteCondition,
                        $isCancelledCondition,
                        $isPaidCondition,
                        $isOverdueCondition,
                        $isPartiallyPaidCondition,
                        $placeholders,
                    ],
                ),
                [
                    InvoiceStatus::OBSOLETE->value,
                    InvoiceStatus::CANCELLED->value,
                    InvoiceStatus::PAID->value,
                    InvoiceStatus::OVERDUE->value,
                    InvoiceStatus::PARTIALLY_PAID->value,
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
    // -    Méthodes liées à une "entity"
    // -
    // ------------------------------------------------------

    /**
     * Enregistre un paiement sur la facture courante.
     *
     * @param array $data Les données du paiement.
     *
     * @return InvoicePayment Le paiement créé.
     */
    public function addPayment(array $data): InvoicePayment
    {
        // - Les factures "legacy" ne gèrent pas les paiements.
        if ($this->format < BillingFormat::V3->value) {
            throw new \DomainException("Payments are not supported for legacy invoices.");
        }

        // - Les brouillons ne peuvent pas recevoir de paiements.
        if ($this->is_draft) {
            throw new \DomainException("Payments cannot be recorded for a draft invoice.");
        }

        // - Les factures annulées n'acceptent plus de paiements.
        if ($this->is_cancelled) {
            throw new \DomainException("Payments cannot be recorded for a cancelled invoice.");
        }

        // - Validation de la structure des données.
        $schema = V::schemaStrict(
            new Rule\Key('amount', V::custom(static function (mixed $value): bool {
                if (!V::floatVal()->validate($value)) {
                    return false;
                }
                $value = Decimal::of($value);
                return (
                    !$value->isZero() &&
                    $value->isGreaterThan(-1_000_000_000_000) &&
                    $value->isLessThan(1_000_000_000_000) &&
                    $value->getScale() <= 2
                );
            })),
            new Rule\Key('method', null, false),
            new Rule\Key('reference', null, false),
        );
        $schema->assert($data, true);

        return dbTransaction(function () use ($data): InvoicePayment {
            // - Verrou exclusif sur la facture afin de sérialiser les ajouts /
            //   annulations de paiements concurrents et éviter qu'un appel
            //   parallèle ne dépasse le total dû ou ne sur-annule.
            static::lockForUpdate()->find($this->id);

            // - Recharge les paiements à partir des données verrouillées.
            $this->unsetRelation('payments');

            $amount = Decimal::of($data['amount']);
            $totalPayable = $this->total_with_taxes->abs();

            $previousPaidTotal = $this->payments->reduce(
                static fn (Decimal $carry, InvoicePayment $payment) => (
                    $carry->plus($payment->amount)
                ),
                Decimal::zero(),
            );
            $nextPaidTotal = $previousPaidTotal->plus($amount);
            if ($nextPaidTotal->isNegative()) {
                throw new ValidationsException(['amount' => __('payment-reversal-exceeds-paid-amount')]);
            }
            if ($nextPaidTotal->isGreaterThan($totalPayable)) {
                throw new ValidationsException(['amount' => __('payment-amount-exceeds-remaining-due')]);
            }

            // - Ventilation du paiement.
            $breakdown = null;
            if ($this->global_tax_regime === null && !empty($this->total_taxes)) {
                $ratio = !$nextPaidTotal->isZero()
                    ? $nextPaidTotal->dividedBy($totalPayable, 6, RoundingMode::HALF_UP)
                    : null;

                $deducted = Decimal::zero()->toScale(2);
                $rawBreakdown = collect($this->total_taxes)->values()->reverse()
                    ->reduce(
                        static function (
                            array $carry,
                            array $tax,
                            int $originalIndex,
                        ) use (
                            $nextPaidTotal,
                            $ratio,
                            &$deducted,
                        ): array {
                            $isPrimaryTax = $originalIndex === 0;

                            $rate = $tax['type'] === TaxRegime::STANDARD->value
                                ? Decimal::of($tax['value'])->toScale(3)
                                : Decimal::zero()->toScale(3);

                            $key = (string) $rate;
                            if (!array_key_exists($key, $carry)) {
                                $carry[$key] = [
                                    'rate' => $rate,
                                    'paid' => Decimal::zero()->toScale(2),
                                    'target' => Decimal::zero()->toScale(2),
                                ];
                            }

                            // - Pas de cible à calculer si le cumul payé tombe à zéro
                            //   (annulation totale des paiements précédents).
                            if ($ratio !== null) {
                                if (!$isPrimaryTax) {
                                    $scaledBase = $tax['base']->abs()
                                        ->multipliedBy($ratio)
                                        ->toScale(2, RoundingMode::HALF_UP);

                                    $rateAmount = $scaledBase;
                                    if ($tax['type'] === TaxRegime::STANDARD->value) {
                                        $scaledTotal = $scaledBase
                                            ->multipliedBy(Decimal::of($tax['value'])->dividedBy(100, 5))
                                            ->toScale(2, RoundingMode::HALF_UP);

                                        $rateAmount = $rateAmount->plus($scaledTotal);
                                    }
                                    $deducted = $deducted->plus($rateAmount);
                                } else {
                                    $rateAmount = $nextPaidTotal->minus($deducted);
                                }
                                $carry[$key]['target'] = $carry[$key]['target']->plus($rateAmount);
                            }

                            return $carry;
                        },
                        [],
                    );

                foreach ($this->payments as $payment) {
                    foreach ($payment->taxes_breakdown ?? [] as $entry) {
                        if (!array_key_exists((string) $entry['rate'], $rawBreakdown)) {
                            throw new \LogicException("Unexpected missing rate entry for a payment tax.");
                        }

                        $rawBreakdownEntry = &$rawBreakdown[(string) $entry['rate']];
                        $rawBreakdownEntry['paid'] = $rawBreakdownEntry['paid']->plus($entry['amount']);
                    }
                }

                $breakdown = [];
                foreach ($rawBreakdown as $entry) {
                    $currentAmount = $entry['target']->minus($entry['paid']);
                    if ($currentAmount->isZero()) {
                        continue;
                    }

                    $breakdown[] = [
                        'rate' => $entry['rate'],
                        'amount' => $currentAmount,
                    ];
                }
                $breakdown = array_reverse($breakdown);
            }

            return $this->payments()->create([
                'amount' => $amount,
                'date' => CarbonImmutable::now(),
                'method' => $data['method'] ?? null,
                'taxes_breakdown' => $breakdown,
                'reference' => $data['reference'] ?? null,
            ]);
        });
    }

    /**
     * Finalise un brouillon de facture.
     *
     * @return static La facture, finalisée.
     */
    public function finalize(): static
    {
        if (!$this->is_draft) {
            throw new \DomainException("Only draft invoices can be finalized.");
        }

        // - Un brouillon devenu obsolète ne peut plus être finalisé.
        if ($this->is_obsolete) {
            throw new \DomainException("Cannot finalize an obsolete draft invoice.");
        }

        return dbTransaction(function () {
            $this->date = CarbonImmutable::now();
            $this->number = static::getNextNumber();
            $this->status = InvoiceStatus::PENDING->value;

            if (!$this->save()) {
                throw new \RuntimeException("Unable to finalize the invoice.");
            }

            return $this->refresh();
        });
    }

    // ------------------------------------------------------
    // -
    // -    Méthodes de "repository"
    // -
    // ------------------------------------------------------

    /**
     * Crée un avoir à partir d'une facture existante.
     *
     * @param Invoice $invoice La facture d'origine.
     * @param User    $creator L'utilisateur à l'origine de la création.
     *
     * @return Invoice L'avoir créé.
     */
    public static function createCreditNote(Invoice $invoice, User $creator): Invoice
    {
        $organization = Config::get('organization');

        Assert::true(
            $invoice->format >= BillingFormat::V3->value,
            "Cannot generate a credit note for a legacy invoice.",
        );
        Assert::false($invoice->trashed(), (
            "Cannot generate a credit note for a deleted invoice."
        ));
        Assert::false($invoice->is_draft, (
            "Cannot generate a credit note for a draft invoice."
        ));
        Assert::false(
            $invoice->is_credit_note || $invoice->total_with_taxes->isNegative(),
            "Cannot create a credit note from another credit note or negative invoice.",
        );
        Assert::null(
            $invoice->child_invoice,
            "Cannot create a credit note for an invoice that already has a credit note.",
        );

        // - On ne peut pas créer un avoir d'une facture d'acompte
        //   pour lequel le devis a eu une facture finale.
        Assert::true(
            !$invoice->is_prepayment || !$invoice->parent_estimate?->has_final_invoice,
            "Cannot create a credit note for a prepayment invoice when the estimate has been settled.",
        );

        $buyer = $invoice->buyer;
        Assert::false($buyer->trashed(), (
            "Cannot generate a credit note for a deleted beneficiary."
        ));
        Assert::true($buyer->is_invoiceable, (
            "Some required information is missing for the beneficiary, the credit note cannot be generated."
        ));

        return dbTransaction(static function () use ($organization, $buyer, $invoice, $creator) {
            $creditNote = new static([
                'number' => static::getNextNumber(),
                'order_number' => $invoice->order_number,
                'status' => InvoiceStatus::PENDING->value,
                'date' => CarbonImmutable::now(),
                'lang' => $invoice->lang,
                'special_mentions' => $invoice->special_mentions,

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
                'seller_routing_identifier' => (static function () use ($organization, $invoice) {
                    // - Si le pays du vendeur n'utilise pas la facturation électronique, pas d'identifiant.
                    $sellerCountry = new Country($organization['country']);
                    if (!$sellerCountry->useElectronicInvoices()) {
                        return null;
                    }

                    // - Si la transaction est hors-champ d'application de la T.V.A., pas de e-invoicing.
                    if ($invoice->global_tax_regime === TaxRegime::OUT_OF_SCOPE->value) {
                        return null;
                    }

                    // - S'il y a un identifiant explicite, on l'utilise.
                    $identifier = Config::get('invoices.routingIdentifier');
                    if ($identifier !== null) {
                        return $identifier;
                    }

                    // - Sinon, si c'est possible on déduit l'identifiant.
                    //   (Note: ce cas n'est pas censé arriver, l'identifiant est obligatoire).
                    $registrationId = $organization['registrationId'];
                    if ($sellerCountry->canInferDefaultInvoiceRoutingIdentifier() && $registrationId !== null) {
                        $identifier = $sellerCountry->inferDefaultInvoiceRoutingIdentifier($registrationId);
                        if ($identifier !== null) {
                            return $identifier;
                        }
                    }

                    // - Sinon, il y a un souci dans les données.
                    throw new \Exception("Missing expected seller invoice routing identifier.");
                })(),

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
                'buyer_routing_identifier' => (static function () use ($organization, $buyer, $invoice) {
                    // - Si ce n'est pas une entreprise, pas d'identifiant.
                    if ($buyer->getBuyerType() !== LegalEntityType::COMPANY) {
                        return null;
                    }

                    // - Si le pays du vendeur n'utilise pas la facturation électronique, pas d'identifiant.
                    $sellerCountry = new Country($organization['country']);
                    if (!$sellerCountry->useElectronicInvoices()) {
                        return null;
                    }

                    // - Si la transaction est hors-champ d'application de la T.V.A., pas de e-invoicing.
                    if ($invoice->global_tax_regime === TaxRegime::OUT_OF_SCOPE->value) {
                        return null;
                    }

                    // - Si ce n'est pas une transaction domestique, pas d'e-invoicing.
                    $buyerCountry = $buyer->getBuyerAddress()->getCountry();
                    if (!$sellerCountry->isSame($buyerCountry, withInherited: true)) {
                        return null;
                    }

                    // - S'il y a un identifiant explicite, on l'utilise.
                    $identifier = $buyer->getBuyerInvoiceIdentifier();
                    if ($identifier !== null) {
                        return $identifier;
                    }

                    // - Sinon, si c'est possible on déduit l'identifiant.
                    $registrationId = $buyer->getBuyerRegistrationId();
                    if ($buyerCountry->canInferDefaultInvoiceRoutingIdentifier() && $registrationId !== null) {
                        $identifier = $buyerCountry->inferDefaultInvoiceRoutingIdentifier($registrationId);
                        if ($identifier !== null) {
                            return $identifier;
                        }
                    }

                    // - Sinon, il y a un souci dans les données.
                    throw new \Exception("Missing expected buyer invoice routing identifier.");
                })(),

                // - Booking (repris de la facture d'origine).
                'booking_type' => $invoice->booking_type,
                'booking_title' => $invoice->booking_title,
                'booking_reference' => $invoice->booking_reference,
                'booking_period' => $invoice->booking_period,

                // - Remise (reprise de la facture d'origine).
                'total_without_global_discount' => $invoice->total_without_global_discount,
                'global_discount_rate' => $invoice->global_discount_rate,
                'global_discount_breakdown' => $invoice->global_discount_breakdown,
                'total_global_discount' => $invoice->total_global_discount,

                // - Régime de taxe global (repris de la facture d'origine).
                'global_tax_regime' => $invoice->global_tax_regime,
                'global_tax_exemption_code' => $invoice->global_tax_exemption_code,
                'global_tax_exemption_reason' => $invoice->global_tax_exemption_reason,

                // - Totaux (repris de la facture d'origine).
                'total_without_taxes' => $invoice->total_without_taxes,
                'total_taxes' => $invoice->total_taxes,
                'total_with_taxes' => $invoice->total_with_taxes,

                'is_credit_note' => true,
                'is_prepayment' => $invoice->is_prepayment,
                'is_electronic' => (new Country($organization['country']))->useElectronicInvoices(),
                'is_vat_due_on_invoice' => $organization['isVatDueOnInvoice'] ?? false,
                'total_replacement' => $invoice->total_replacement,
                'currency' => $invoice->currency,

                // - Métadonnées.
                'metadata' => $invoice->metadata,
            ]);
            $creditNote->parentInvoice()->associate($invoice);
            $creditNote->buyer()->associate($buyer);
            $creditNote->author()->associate($creator);

            if ($invoice->booking !== null) {
                $creditNote->booking()->associate($invoice->booking);
            }

            if ($invoice->parent_estimate !== null) {
                $creditNote->parentEstimate()->associate($invoice->parent_estimate);
            }

            if (!$creditNote->save(['generateFile' => false])) {
                return false;
            }

            // - Attache le matériel à l'avoir.
            foreach ($invoice->materials as $originMaterial) {
                $invoiceMaterial = new InvoiceMaterial([
                    'material_id' => $originMaterial->material_id,
                    'name' => $originMaterial->name,
                    'reference' => $originMaterial->reference,
                    'description' => $originMaterial->description,
                    'quantity' => $originMaterial->quantity,
                    'unit_price' => $originMaterial->unit_price,
                    'degressive_rate' => $originMaterial->degressive_rate,
                    'unit_price_period' => $originMaterial->unit_price_period,
                    'total_without_discount' => $originMaterial->total_without_discount,
                    'discount_rate' => $originMaterial->discount_rate,
                    'total_discount' => $originMaterial->total_discount,
                    'total_without_taxes' => $originMaterial->total_without_taxes,
                    'tax_regime' => $originMaterial->tax_regime,
                    'tax_exemption_code' => $originMaterial->tax_exemption_code,
                    'taxes' => $originMaterial->taxes,
                    'unit_replacement_price' => $originMaterial->unit_replacement_price,
                    'total_replacement_price' => $originMaterial->total_replacement_price,
                    'is_hidden_on_bill' => $originMaterial->is_hidden_on_bill,
                ]);
                $creditNote->materials()->save($invoiceMaterial);
            }

            // - Attache les lignes extras à l'avoir.
            foreach ($invoice->extras as $originExtraLine) {
                $invoiceExtraLine = new InvoiceExtra([
                    'description' => $originExtraLine->description,
                    'is_service' => $originExtraLine->is_service,
                    'quantity' => $originExtraLine->quantity,
                    'unit_price' => $originExtraLine->unit_price,
                    'total_without_discount' => $originExtraLine->total_without_discount,
                    'discount_rate' => $originExtraLine->discount_rate,
                    'total_discount' => $originExtraLine->total_discount,
                    'total_without_taxes' => $originExtraLine->total_without_taxes,
                    'tax_regime' => $originExtraLine->tax_regime,
                    'tax_exemption_code' => $originExtraLine->tax_exemption_code,
                    'taxes' => $originExtraLine->taxes,
                ]);
                $creditNote->extras()->save($invoiceExtraLine);
            }

            // - Rattache les factures d'acompte de la facture d'origine à l'avoir.
            if ($invoice->prepaymentInvoices->isNotEmpty()) {
                $creditNote->prepaymentInvoices()->attach(
                    $invoice->prepaymentInvoices->pluck('id'),
                );
            }

            // - On génère le PDF lié.
            $creditNote->generatePdfFile();

            return $creditNote->refresh();
        });
    }

    /**
     * Crée une facture (potentiellement d'acompte) à partir d'un devis.
     *
     * @param Estimate               $estimate       Le devis de référence.
     * @param Decimal|int|float|null $amount         L'éventuel montant TTC à facturer, permettant ainsi de
     *                                               générer une facture d'acompte, ou `null` pour facturer
     *                                               le solde restant en totalité.
     * @param User                   $creator        L'utilisateur à l'origine de la création.
     * @param array                  $additionalData Les données additionnelles utilisées pour la création.
     *
     * @return Invoice La facture (potentiellement d'acompte) créée.
     */
    public static function createFromEstimate(
        Estimate $estimate,
        Decimal|int|float|null $amount,
        User $creator,
        array $additionalData = [],
    ): Invoice {
        $i18n = new I18n($estimate->lang);
        $organization = Config::get('organization');

        Assert::true(
            $estimate->format >= BillingFormat::V3->value,
            "Cannot generate an invoice for a legacy estimate.",
        );
        Assert::false($estimate->trashed(), (
            "Cannot generate an invoice for a deleted estimate."
        ));
        Assert::false($estimate->is_draft, (
            "Cannot generate an invoice for a draft estimate."
        ));
        Assert::true($estimate->status !== EstimateStatus::REJECTED->value, (
            "Cannot generate an invoice for a rejected estimate."
        ));

        $buyer = $estimate->buyer;
        Assert::false($buyer->trashed(), (
            "Cannot generate an invoice for a deleted beneficiary."
        ));
        Assert::true($buyer->is_invoiceable, (
            "Some required information is missing for the beneficiary, the invoice cannot be generated."
        ));

        // - Récupération du solde du devis.
        $billedTotal = $estimate->related_invoices->reduce(
            static fn (Decimal $carry, Invoice $invoice) => (
                $invoice->is_credit_note
                    ? $carry->minus($invoice->total_with_taxes)
                    : $carry->plus($invoice->total_with_taxes)
            ),
            Decimal::zero(),
        );

        $hasActiveInvoices = $estimate->related_invoices->contains(
            static fn (Invoice $invoice) => (
                !$invoice->is_credit_note &&
                !$invoice->is_cancelled
            ),
        );

        // - S'il n'y a plus rien à facturer, on ne peut pas lier le devis.
        $remainingAmount = $estimate->total_with_taxes->minus($billedTotal);
        Assert::true(
            (
                $estimate->total_with_taxes->isZero()
                    ? ($remainingAmount->isZero() && !$hasActiveInvoices)
                    : (
                        $estimate->total_with_taxes->isPositive()
                            ? $remainingAmount->isGreaterThan(0)
                            : $remainingAmount->isLessThan(0)
                    )
            ),
            "Cannot create an invoice for a estimate with nothing left to bill.",
        );

        $isPrepayment = $amount !== null;
        Assert::false(
            $isPrepayment && $buyer->isBuyerPublicEntity(),
            "Cannot create a prepayment invoice for a public entity (B2G).",
        );
        Assert::false(
            $isPrepayment && $estimate->total_with_taxes->isNegativeOrZero(),
            "Cannot create a prepayment invoice for a negative or zero estimate.",
        );
        Assert::false(
            $isPrepayment && $estimate->has_final_invoice,
            "Cannot create a prepayment invoice for an estimate that already has a final invoice.",
        );

        $amount = $amount !== null ? Decimal::of($amount) : null;
        Assert::true(!$isPrepayment || $amount->isPositive(), (
            "The prepaid amount cannot be negative."
        ));
        Assert::true(!$isPrepayment || $amount->isLessThan($remainingAmount), (
            "The prepaid amount cannot exceed the remaining amount, the invoice cannot be generated."
        ));

        return dbTransaction(static function () use (
            $i18n,
            $buyer,
            $estimate,
            $amount,
            $creator,
            $isPrepayment,
            $organization,
            $additionalData,
        ) {
            $prepaymentInvoices = collect(
                $isPrepayment ? [] : $estimate->related_invoices->filter(
                    static fn (Invoice $invoice) => (
                        $invoice->is_prepayment &&
                        !$invoice->is_credit_note &&
                        !$invoice->is_cancelled
                    ),
                ),
            );

            // - Si c'est une facture d'acompte, on réparti le montant
            //   de l'acompte entres les différents taux de T.V.A.
            if ($isPrepayment) {
                $totalTaxes = [];
                $totalWithTaxes = $amount->toScale(2, RoundingMode::HALF_UP);
                $totalWithoutTaxes = $totalWithTaxes;

                if (!empty($estimate->total_taxes)) {
                    // - Calcul du ratio de l'acompte sur le devis (e.g. `0.8` pour 80€ TTC sur 100€ TTC).
                    $ratio = $amount->dividedBy($estimate->total_with_taxes, 6, RoundingMode::HALF_UP);

                    $scaledTaxes = collect($estimate->total_taxes)->values()->reverse()->reduce(
                        static function (array $carry, array $tax, int $originalIndex) use ($ratio, $amount): array {
                            $isPrimaryTax = $originalIndex === 0;

                            if (!$isPrimaryTax) {
                                $tax['base'] = $tax['base']
                                    ->multipliedBy($ratio)
                                    ->toScale(2, RoundingMode::HALF_UP);

                                $carry['base'] = $carry['base']->plus($tax['base']);

                                if ($tax['type'] === TaxRegime::STANDARD->value) {
                                    $tax['total'] = $tax['base']
                                        ->multipliedBy(Decimal::of($tax['value'])->dividedBy(100, 5))
                                        ->toScale(2, RoundingMode::HALF_UP);

                                    $carry['total'] = $carry['total']->plus($tax['total']);
                                }
                            } else {
                                $remainder = $amount
                                    ->minus($carry['base'])
                                    ->minus($carry['total']);

                                if ($tax['type'] === TaxRegime::STANDARD->value) {
                                    $tax['base'] = $remainder->dividedBy(
                                        Decimal::one()->plus(Decimal::of($tax['value'])->dividedBy(100, 5)),
                                        2,
                                        RoundingMode::HALF_UP,
                                    );
                                    $tax['total'] = $remainder->minus($tax['base']);

                                    $carry['total'] = $carry['total']->plus($tax['total']);
                                } else {
                                    $tax['base'] = $remainder
                                        ->toScale(2, RoundingMode::HALF_UP);
                                }

                                $carry['base'] = $carry['base']->plus($tax['base']);
                            }

                            if (!$tax['base']->isZero()) {
                                $carry['taxes'][] = $tax;
                            }

                            return $carry;
                        },
                        [
                            'taxes' => [],
                            'base' => Decimal::zero(),
                            'total' => Decimal::zero(),
                        ],
                    );

                    $totalTaxes = array_reverse($scaledTaxes['taxes']);
                    $totalWithoutTaxes = $scaledTaxes['base'];
                    $totalWithTaxes = array_reduce(
                        $totalTaxes,
                        static fn (Decimal $carry, array $tax): Decimal => (
                            $tax['type'] === TaxRegime::STANDARD->value
                                ? $carry->plus($tax['total'])
                                : $carry
                        ),
                        $totalWithoutTaxes,
                    );
                }

            // - Sinon, si c'est une facture de solde après acompte ou une facture directe...
            } else {
                $totalTaxes = $estimate->total_taxes;
                $totalWithoutTaxes = $estimate->total_without_taxes;
                $totalWithTaxes = $estimate->total_with_taxes;

                // - .. si c'est une facture de solde après acomptes, on calcul les totaux nets.
                //   (montants du devis diminués des montants déjà facturés en acompte)
                if ($prepaymentInvoices->isNotEmpty()) {
                    $prepaidTotalWithoutTaxes = $prepaymentInvoices->reduce(
                        static fn (Decimal $carry, Invoice $invoice) => (
                            $carry->plus($invoice->total_without_taxes)
                        ),
                        Decimal::zero(),
                    );
                    $totalWithoutTaxes = $estimate->total_without_taxes
                        ->minus($prepaidTotalWithoutTaxes)
                        ->toScale(2);

                    if (!empty($estimate->total_taxes)) {
                        $prepaidTaxesByKey = [];
                        foreach ($prepaymentInvoices as $prepaymentInvoice) {
                            foreach ($prepaymentInvoice->total_taxes ?? [] as $tax) {
                                $identifier = $tax['type'] !== TaxRegime::STANDARD->value ? $tax['type'] : (
                                    md5(serialize([
                                        $tax['type'],
                                        $tax['name'] ?? null,
                                        (string) $tax['value']->toScale(3),
                                    ]))
                                );
                                if (!array_key_exists($identifier, $prepaidTaxesByKey)) {
                                    $prepaidTaxesByKey[$identifier] = $tax;
                                } else {
                                    /** @var Decimal $currentBase */
                                    $currentBase = &$prepaidTaxesByKey[$identifier]['base'];
                                    $currentBase = $currentBase->plus($tax['base']);

                                    if ($tax['type'] === TaxRegime::STANDARD->value) {
                                        /** @var Decimal $currentTotal */
                                        $currentTotal = &$prepaidTaxesByKey[$identifier]['total'];
                                        $currentTotal = $currentTotal->plus($tax['total']);
                                    }
                                }
                            }
                        }

                        $totalTaxes = array_values(array_filter(array_map(
                            static function (array $tax) use ($prepaidTaxesByKey): ?array {
                                $identifier = $tax['type'] !== TaxRegime::STANDARD->value ? $tax['type'] : (
                                    md5(serialize([
                                        $tax['type'],
                                        $tax['name'] ?? null,
                                        (string) $tax['value']->toScale(3),
                                    ]))
                                );

                                // - Si cette taxe n'a pas été prépayée, on garde sa valeur originale.
                                $prepaymentTax = $prepaidTaxesByKey[$identifier] ?? null;
                                if ($prepaymentTax === null) {
                                    return $tax;
                                }

                                // - Sinon, on diminue les montants des valeurs déjà payées.
                                $tax['base'] = $tax['base']
                                    ->minus($prepaymentTax['base'])
                                    ->toScale(2);

                                if ($tax['type'] === TaxRegime::STANDARD->value) {
                                    $tax['total'] = $tax['total']
                                        ->minus($prepaymentTax['total'])
                                        ->toScale(2);
                                }

                                // - Si la taxe a été intégralement prépayée, on la retire.
                                $isNull = (
                                    $tax['base']->isZero() &&
                                    (
                                        $tax['type'] !== TaxRegime::STANDARD->value ||
                                        $tax['total']->isZero()
                                    )
                                );
                                return !$isNull ? $tax : null;
                            },
                            $estimate->total_taxes,
                        )));
                    }

                    $totalWithTaxes = array_reduce(
                        $totalTaxes ?? [],
                        static fn (Decimal $carry, array $tax): Decimal => (
                            $tax['type'] === TaxRegime::STANDARD->value
                                ? $carry->plus($tax['total'])
                                : $carry
                        ),
                        $totalWithoutTaxes,
                    );
                }
            }

            $invoice = new static([
                'number' => static::getNextNumber(),
                'status' => InvoiceStatus::PENDING->value,
                'date' => CarbonImmutable::now(),
                'lang' => $estimate->lang,
                'special_mentions' => $estimate->special_mentions,

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
                'seller_routing_identifier' => (static function () use ($organization, $estimate) {
                    // - Si le pays du vendeur n'utilise pas la facturation électronique, pas d'identifiant.
                    $sellerCountry = new Country($organization['country']);
                    if (!$sellerCountry->useElectronicInvoices()) {
                        return null;
                    }

                    // - Si la transaction est hors-champ d'application de la T.V.A., pas de e-invoicing.
                    if ($estimate->global_tax_regime === TaxRegime::OUT_OF_SCOPE->value) {
                        return null;
                    }

                    // - S'il y a un identifiant explicite, on l'utilise.
                    $identifier = Config::get('invoices.routingIdentifier');
                    if ($identifier !== null) {
                        return $identifier;
                    }

                    // - Sinon, si c'est possible on déduit l'identifiant.
                    //   (Note: ce cas n'est pas censé arriver, l'identifiant est obligatoire).
                    $registrationId = $organization['registrationId'];
                    if ($sellerCountry->canInferDefaultInvoiceRoutingIdentifier() && $registrationId !== null) {
                        $identifier = $sellerCountry->inferDefaultInvoiceRoutingIdentifier($registrationId);
                        if ($identifier !== null) {
                            return $identifier;
                        }
                    }

                    // - Sinon, il y a un souci dans les données.
                    throw new \Exception("Missing expected seller invoice routing identifier.");
                })(),

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
                'buyer_routing_identifier' => (static function () use ($organization, $buyer, $estimate) {
                    // - Si ce n'est pas une entreprise, pas d'identifiant.
                    if ($buyer->getBuyerType() !== LegalEntityType::COMPANY) {
                        return null;
                    }

                    // - Si le pays du vendeur n'utilise pas la facturation électronique, pas d'identifiant.
                    $sellerCountry = new Country($organization['country']);
                    if (!$sellerCountry->useElectronicInvoices()) {
                        return null;
                    }

                    // - Si la transaction est hors-champ d'application de la T.V.A., pas de e-invoicing.
                    if ($estimate->global_tax_regime === TaxRegime::OUT_OF_SCOPE->value) {
                        return null;
                    }

                    // - Si ce n'est pas une transaction domestique, pas d'e-invoicing.
                    $buyerCountry = $buyer->getBuyerAddress()->getCountry();
                    if (!$sellerCountry->isSame($buyerCountry, withInherited: true)) {
                        return null;
                    }

                    // - S'il y a un identifiant explicite, on l'utilise.
                    $identifier = $buyer->getBuyerInvoiceIdentifier();
                    if ($identifier !== null) {
                        return $identifier;
                    }

                    // - Sinon, si c'est possible on déduit l'identifiant.
                    $registrationId = $buyer->getBuyerRegistrationId();
                    if ($buyerCountry->canInferDefaultInvoiceRoutingIdentifier() && $registrationId !== null) {
                        $identifier = $buyerCountry->inferDefaultInvoiceRoutingIdentifier($registrationId);
                        if ($identifier !== null) {
                            return $identifier;
                        }
                    }

                    // - Sinon, il y a un souci dans les données.
                    throw new \Exception("Missing expected buyer invoice routing identifier.");
                })(),

                // - Booking (repris du devis).
                'booking_type' => $estimate->booking_type,
                'booking_title' => $estimate->booking_title,
                'booking_reference' => $estimate->booking_reference,
                'booking_period' => $estimate->booking_period,

                // - Remise globale.
                'total_without_global_discount' => (
                    !$isPrepayment
                        ? $estimate->total_without_global_discount
                        : $totalWithoutTaxes
                ),
                'global_discount_rate' => (
                    !$isPrepayment
                        ? $estimate->global_discount_rate
                        : Decimal::zero()
                ),
                'global_discount_breakdown' => (
                    !$isPrepayment
                        ? $estimate->global_discount_breakdown
                        : null
                ),
                'total_global_discount' => (
                    !$isPrepayment
                        ? $estimate->total_global_discount
                        : Decimal::zero()
                ),

                // - Régime de taxe global (repris du devis).
                'global_tax_regime' => $estimate->global_tax_regime,
                'global_tax_exemption_code' => $estimate->global_tax_exemption_code,
                'global_tax_exemption_reason' => $estimate->global_tax_exemption_reason,

                // - Totaux.
                'total_without_taxes' => $totalWithoutTaxes,
                'total_taxes' => !empty($totalTaxes) ? $totalTaxes : null,
                'total_with_taxes' => $totalWithTaxes,

                'is_prepayment' => $isPrepayment,
                'is_credit_note' => false,
                'is_electronic' => (new Country($organization['country']))->useElectronicInvoices(),
                'is_vat_due_on_invoice' => $organization['isVatDueOnInvoice'] ?? false,
                'total_replacement' => !$isPrepayment ? $estimate->total_replacement : null,
                'currency' => $estimate->currency,

                // - Métadonnées.
                'metadata' => !$isPrepayment ? $estimate->metadata : null,

                // - Données personnalisables.
                ...Arr::only($additionalData, [
                    'lang',
                    'due_date',
                    'order_number',
                    'special_mentions',
                ]),
            ]);

            // - Si aucune date d'échéance n'est définie, on fige les
            //   conditions de paiement globales dans la facture.
            if ($invoice->due_date === null) {
                $invoice->due_delay = Config::get('invoices.paymentTermDays') ?? 0;
            }

            $invoice->parentEstimate()->associate($estimate);
            $invoice->buyer()->associate($buyer);
            $invoice->author()->associate($creator);

            if ($estimate->booking !== null) {
                $invoice->booking()->associate($estimate->booking);
            }

            if (!$invoice->save(['generateFile' => false])) {
                return false;
            }

            // - Si c'est une facture de solde, on reprend l'intégralité du devis,
            //   sinon on utilise des lignes d'acompte synthétiques.
            if (!$isPrepayment) {
                // - Attache le matériel à la facture.
                foreach ($estimate->materials as $estimateMaterial) {
                    $invoiceMaterial = new InvoiceMaterial([
                        'material_id' => $estimateMaterial->material_id,
                        'name' => $estimateMaterial->name,
                        'reference' => $estimateMaterial->reference,
                        'description' => $estimateMaterial->description,
                        'quantity' => $estimateMaterial->quantity,
                        'unit_price' => $estimateMaterial->unit_price,
                        'degressive_rate' => $estimateMaterial->degressive_rate,
                        'unit_price_period' => $estimateMaterial->unit_price_period,
                        'total_without_discount' => $estimateMaterial->total_without_discount,
                        'discount_rate' => $estimateMaterial->discount_rate,
                        'total_discount' => $estimateMaterial->total_discount,
                        'total_without_taxes' => $estimateMaterial->total_without_taxes,
                        'tax_regime' => $estimateMaterial->tax_regime,
                        'tax_exemption_code' => $estimateMaterial->tax_exemption_code,
                        'taxes' => $estimateMaterial->taxes,
                        'unit_replacement_price' => $estimateMaterial->unit_replacement_price,
                        'total_replacement_price' => $estimateMaterial->total_replacement_price,
                        'is_hidden_on_bill' => $estimateMaterial->is_hidden_on_bill,
                    ]);
                    $invoice->materials()->save($invoiceMaterial);
                }

                // - Attache les lignes extras à la facture.
                foreach ($estimate->extras as $estimateExtra) {
                    $invoiceExtraLine = new InvoiceExtra([
                        'description' => $estimateExtra->description,
                        'is_service' => $estimateExtra->is_service,
                        'quantity' => $estimateExtra->quantity,
                        'unit_price' => $estimateExtra->unit_price,
                        'total_without_discount' => $estimateExtra->total_without_discount,
                        'discount_rate' => $estimateExtra->discount_rate,
                        'total_discount' => $estimateExtra->total_discount,
                        'total_without_taxes' => $estimateExtra->total_without_taxes,
                        'tax_regime' => $estimateExtra->tax_regime,
                        'tax_exemption_code' => $estimateExtra->tax_exemption_code,
                        'taxes' => $estimateExtra->taxes,
                    ]);
                    $invoice->extras()->save($invoiceExtraLine);
                }

                // - Rattachement des factures d'acompte.
                if (!$isPrepayment && $prepaymentInvoices->isNotEmpty()) {
                    $invoice->prepaymentInvoices()->attach($prepaymentInvoices->pluck('id'));
                }
            } else {
                $description = $i18n->translate('prepayment-line', ['number' => $estimate->number]);
                if ($estimate->global_tax_regime !== null) {
                    $invoiceExtraLine = new InvoiceExtra([
                        'description' => $description,
                        'is_service' => true,
                        'quantity' => 1,
                        'unit_price' => $totalWithoutTaxes,
                        'total_without_discount' => $totalWithoutTaxes,
                        'discount_rate' => Decimal::zero(),
                        'total_discount' => Decimal::zero(),
                        'total_without_taxes' => $totalWithoutTaxes,
                        'tax_regime' => null,
                        'tax_exemption_code' => null,
                        'taxes' => null,
                    ]);
                    $invoice->extras()->save($invoiceExtraLine);
                } else {
                    foreach ($totalTaxes as $tax) {
                        $invoiceExtraLine = new InvoiceExtra([
                            'description' => $description,
                            'is_service' => true,
                            'quantity' => 1,
                            'unit_price' => $tax['base'],
                            'total_without_discount' => $tax['base'],
                            'discount_rate' => Decimal::zero(),
                            'total_discount' => Decimal::zero(),
                            'total_without_taxes' => $tax['base'],
                            'tax_regime' => $tax['type'],
                            'tax_exemption_code' => (
                                $tax['type'] !== TaxRegime::STANDARD->value
                                    ? (count($tax['reason'] ?? []) === 1 ? current($tax['reason']) : null)
                                    : null
                            ),
                            'taxes' => $tax['type'] !== TaxRegime::STANDARD->value ? null : [
                                array_key_exists('name', $tax)
                                    ? ['name' => $tax['name'], 'value' => $tax['value']]
                                    : ['value' => $tax['value']],
                            ],
                        ]);
                        $invoice->extras()->save($invoiceExtraLine);
                    }
                }
            }

            // - On génère le PDF lié.
            $invoice->generatePdfFile();

            $estimate->unsetRelation('relatedInvoices');
            return $invoice->refresh();
        });
    }

    /**
     * Crée une facture "from scratch" (sans booking lié).
     *
     * @param Beneficiary $buyer   Le bénéficiaire / acheteur de la facture.
     * @param array       $data    Les données de la facture (lignes, dates, etc.).
     * @param User        $creator L'utilisateur à l'origine de la création.
     *
     * @return Invoice La facture créée.
     */
    public static function createFromScratch(Beneficiary $buyer, array $data, User $creator): Invoice
    {
        $organization = Config::get('organization');

        Assert::false($buyer->trashed(), (
            "Cannot generate an invoice for a deleted beneficiary."
        ));
        Assert::true($buyer->is_invoiceable, (
            "Some required information is missing for the beneficiary, the invoice cannot be generated."
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
            new Rule\Key('order_number', null, false),
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

        // - Lignes de la facture.
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
            $invoice = new static([
                'status' => InvoiceStatus::DRAFT->value,
                'due_date' => $data['due_date'] ?? null,
                'order_number' => $data['order_number'] ?? null,

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
                'seller_routing_identifier' => (static function () use ($organization, $globalTaxRegime) {
                    // - Si le pays du vendeur n'utilise pas la facturation électronique, pas d'identifiant.
                    $sellerCountry = new Country($organization['country']);
                    if (!$sellerCountry->useElectronicInvoices()) {
                        return null;
                    }

                    // - Si la transaction est hors-champ d'application de la T.V.A., pas de e-invoicing.
                    if ($globalTaxRegime === TaxRegime::OUT_OF_SCOPE->value) {
                        return null;
                    }

                    // - S'il y a un identifiant explicite, on l'utilise.
                    $identifier = Config::get('invoices.routingIdentifier');
                    if ($identifier !== null) {
                        return $identifier;
                    }

                    // - Sinon, si c'est possible on déduit l'identifiant.
                    //   (Note: ce cas n'est pas censé arriver, l'identifiant est obligatoire).
                    $registrationId = $organization['registrationId'];
                    if ($sellerCountry->canInferDefaultInvoiceRoutingIdentifier() && $registrationId !== null) {
                        $identifier = $sellerCountry->inferDefaultInvoiceRoutingIdentifier($registrationId);
                        if ($identifier !== null) {
                            return $identifier;
                        }
                    }

                    // - Sinon, il y a un souci dans les données.
                    throw new \Exception("Missing expected seller invoice routing identifier.");
                })(),

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
                'buyer_routing_identifier' => (static function () use ($organization, $buyer, $globalTaxRegime) {
                    // - Si ce n'est pas une entreprise, pas d'identifiant.
                    if ($buyer->getBuyerType() !== LegalEntityType::COMPANY) {
                        return null;
                    }

                    // - Si le pays du vendeur n'utilise pas la facturation électronique, pas d'identifiant.
                    $sellerCountry = new Country($organization['country']);
                    if (!$sellerCountry->useElectronicInvoices()) {
                        return null;
                    }

                    // - Si la transaction est hors-champ d'application de la T.V.A., pas de e-invoicing.
                    if ($globalTaxRegime === TaxRegime::OUT_OF_SCOPE->value) {
                        return null;
                    }

                    // - Si ce n'est pas une transaction domestique, pas d'e-invoicing.
                    $buyerCountry = $buyer->getBuyerAddress()->getCountry();
                    if (!$sellerCountry->isSame($buyerCountry, withInherited: true)) {
                        return null;
                    }

                    // - S'il y a un identifiant explicite, on l'utilise.
                    $identifier = $buyer->getBuyerInvoiceIdentifier();
                    if ($identifier !== null) {
                        return $identifier;
                    }

                    // - Sinon, si c'est possible on déduit l'identifiant.
                    $registrationId = $buyer->getBuyerRegistrationId();
                    if ($buyerCountry->canInferDefaultInvoiceRoutingIdentifier() && $registrationId !== null) {
                        $identifier = $buyerCountry->inferDefaultInvoiceRoutingIdentifier($registrationId);
                        if ($identifier !== null) {
                            return $identifier;
                        }
                    }

                    // - Sinon, il y a un souci dans les données.
                    throw new \Exception("Missing expected buyer invoice routing identifier.");
                })(),

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

                'is_prepayment' => false,
                'is_credit_note' => false,
                'is_electronic' => (new Country($organization['country']))->useElectronicInvoices(),
                'is_vat_due_on_invoice' => $organization['isVatDueOnInvoice'] ?? false,
                'special_mentions' => $data['special_mentions'] ?? null,
                'currency' => Config::get('currency'),
                'lang' => $data['lang'] ?? (
                    $buyer->user?->language
                        ?? Config::get('defaultLang')
                ),
            ]);

            // - Si aucune date d'échéance n'est définie, on fige les
            //   conditions de paiement globales dans la facture.
            if ($invoice->due_date === null) {
                $invoice->due_delay = Config::get('invoices.paymentTermDays') ?? 0;
            }

            $invoice->buyer()->associate($buyer);
            $invoice->author()->associate($creator);

            if (!$invoice->save(['generateFile' => false])) {
                return false;
            }
            $lines = $invoice->extras()->makeMany($linesData);

            $lineErrors = $lines
                ->filter(static fn ($line) => !$line->isValid())
                ->map(static fn ($line) => $line->validationErrors())
                ->all();

            if (!empty($lineErrors)) {
                throw new ValidationsException(['lines' => $lineErrors]);
            }

            // - Attache les lignes à la facture.
            $invoice->extras()->saveMany($lines);

            // - On génère le PDF lié.
            $invoice->generatePdfFile();

            return $invoice->refresh();
        });
    }

    /**
     * Crée une facture à partir d'un événement.
     *
     * @param Event  $booking        L'événement à facturer.
     * @param User   $creator        L'utilisateur à l'origine de la création.
     * @param array  $additionalData Les données additionnelles utilisées pour la création.
     *
     * @return Invoice La facture créée.
     */
    public static function createFromBooking(
        Event $booking,
        User $creator,
        array $additionalData = [],
    ): Invoice {
        Assert::true($booking->is_billable, "Booking is not billable.");

        $organization = Config::get('organization');
        $buyer = $booking instanceof Event
            ? $booking->mainBeneficiary
            : $booking->borrower;

        Assert::notNull($buyer, (
            "A beneficiary must be defined in the booking to be able to generate an invoice."
        ));
        Assert::false($buyer->trashed(), (
            "Cannot generate an invoice for a deleted beneficiary."
        ));
        Assert::true($buyer->is_invoiceable, (
            "Some required information is missing for the beneficiary, the invoice cannot be generated."
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
            "The booking must contain at least one material or line for an invoice to be generated."
        ));

        return dbTransaction(static function () use ($organization, $booking, $buyer, $creator, $additionalData) {
            $invoice = new static([
                'status' => InvoiceStatus::DRAFT->value,

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
                'seller_routing_identifier' => (static function () use ($organization, $booking) {
                    // - Si le pays du vendeur n'utilise pas la facturation électronique, pas d'identifiant.
                    $sellerCountry = new Country($organization['country']);
                    if (!$sellerCountry->useElectronicInvoices()) {
                        return null;
                    }

                    // - Si la transaction est hors-champ d'application de la T.V.A., pas de e-invoicing.
                    if ($booking->global_tax_regime === TaxRegime::OUT_OF_SCOPE->value) {
                        return null;
                    }

                    // - S'il y a un identifiant explicite, on l'utilise.
                    $identifier = Config::get('invoices.routingIdentifier');
                    if ($identifier !== null) {
                        return $identifier;
                    }

                    // - Sinon, si c'est possible on déduit l'identifiant.
                    //   (Note: ce cas n'est pas censé arriver, l'identifiant est obligatoire).
                    $registrationId = $organization['registrationId'];
                    if ($sellerCountry->canInferDefaultInvoiceRoutingIdentifier() && $registrationId !== null) {
                        $identifier = $sellerCountry->inferDefaultInvoiceRoutingIdentifier($registrationId);
                        if ($identifier !== null) {
                            return $identifier;
                        }
                    }

                    // - Sinon, il y a un souci dans les données.
                    throw new \Exception("Missing expected seller invoice routing identifier.");
                })(),

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
                'buyer_routing_identifier' => (static function () use ($organization, $buyer, $booking) {
                    // - Si ce n'est pas une entreprise, pas d'identifiant.
                    if ($buyer->getBuyerType() !== LegalEntityType::COMPANY) {
                        return null;
                    }

                    // - Si le pays du vendeur n'utilise pas la facturation électronique, pas d'identifiant.
                    $sellerCountry = new Country($organization['country']);
                    if (!$sellerCountry->useElectronicInvoices()) {
                        return null;
                    }

                    // - Si la transaction est hors-champ d'application de la T.V.A., pas de e-invoicing.
                    if ($booking->global_tax_regime === TaxRegime::OUT_OF_SCOPE->value) {
                        return null;
                    }

                    // - Si ce n'est pas une transaction domestique, pas d'e-invoicing.
                    $buyerCountry = $buyer->getBuyerAddress()->getCountry();
                    if (!$sellerCountry->isSame($buyerCountry, withInherited: true)) {
                        return null;
                    }

                    // - S'il y a un identifiant explicite, on l'utilise.
                    $identifier = $buyer->getBuyerInvoiceIdentifier();
                    if ($identifier !== null) {
                        return $identifier;
                    }

                    // - Sinon, si c'est possible on déduit l'identifiant.
                    $registrationId = $buyer->getBuyerRegistrationId();
                    if ($buyerCountry->canInferDefaultInvoiceRoutingIdentifier() && $registrationId !== null) {
                        $identifier = $buyerCountry->inferDefaultInvoiceRoutingIdentifier($registrationId);
                        if ($identifier !== null) {
                            return $identifier;
                        }
                    }

                    // - Sinon, il y a un souci dans les données.
                    throw new \Exception("Missing expected buyer invoice routing identifier.");
                })(),

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

                'is_prepayment' => false,
                'is_credit_note' => false,
                'is_electronic' => (new Country($organization['country']))->useElectronicInvoices(),
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
                    'order_number',
                    'special_mentions',
                ]),
            ]);

            // - Si aucune date d'échéance n'est définie, on fige les
            //   conditions de paiement globales dans la facture.
            if ($invoice->due_date === null) {
                $invoice->due_delay = Config::get('invoices.paymentTermDays') ?? 0;
            }

            $invoice->booking()->associate($booking);
            $invoice->buyer()->associate($buyer);
            $invoice->author()->associate($creator);

            if (!$invoice->save(['generateFile' => false])) {
                return false;
            }

            // - Attache le matériel à la facture.
            foreach ($booking->materials as $bookingMaterial) {
                $material = $bookingMaterial->material;
                $invoiceMaterial = new InvoiceMaterial([
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
                $invoice->materials()->save($invoiceMaterial);
            }

            // - Attache les lignes extras à la facture.
            foreach ($booking->extras as $bookingExtraLine) {
                $invoiceExtraLine = new InvoiceExtra([
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
                $invoice->extras()->save($invoiceExtraLine);
            }

            // - On génère le PDF lié.
            $invoice->generatePdfFile();

            return $invoice->refresh();
        });
    }

    public static function getLastNumber(?int $year = null): ?string
    {
        $year = (int) ($year ?? CarbonImmutable::now()->format('Y'));

        $numbers = static::query()
            ->without(['payments', 'childInvoice'])
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

        return sprintf('%s-%05d', $year, ($lastNumber ?? 0) + 1);
    }

    // ------------------------------------------------------
    // -
    // -    Serialization
    // -
    // ------------------------------------------------------

    public function serialize(string $format = self::SERIALIZE_DEFAULT): array
    {
        $data = new DotArray($this->attributesForSerialization());

        // - Un brouillon n'a pas encore de numéro, ni de date d'émission.
        if ($this->is_draft) {
            $data->delete(['number', 'date']);
        }

        if ($format === self::SERIALIZE_EXCERPT) {
            return Arr::only($data->all(), [
                'id',
                'format',
                'number',
                'status',
                'date',
                'url',
                'total_without_taxes',
                'global_tax_regime',
                'global_tax_exemption_code',
                'global_tax_exemption_reason',
                'total_taxes',
                'total_with_taxes',
                'is_prepayment',
                'is_credit_note',
                'is_overdue',
                'is_cancelled',
                'currency',
                'created_at',
            ]);
        }

        $data = Arr::only($data->all(), [
            'id',
            'format',
            'number',
            'order_number',
            'status',
            'date',
            'due_date',
            'due_delay',
            'url',
            'buyer',
            'total_without_taxes',
            'global_tax_regime',
            'global_tax_exemption_code',
            'global_tax_exemption_reason',
            'total_taxes',
            'total_with_taxes',
            'is_electronic',
            'is_prepayment',
            'is_credit_note',
            'is_overdue',
            'is_cancelled',
            'currency',
            'lang',
            'created_at',
        ]);

        // - Client
        $data['buyer'] = $this->buyer->serialize(
            $format === self::SERIALIZE_DETAILS
                ? Beneficiary::SERIALIZE_DEFAULT
                : Beneficiary::SERIALIZE_SUMMARY,
        );

        // - Devis lié.
        $data['parent_estimate'] = $this->parentEstimate?->serialize(Estimate::SERIALIZE_EXCERPT);

        // - Facture parente (e.g. facture d'origine d'un avoir).
        $data['parent_invoice'] = $this->parentInvoice?->serialize(self::SERIALIZE_EXCERPT);

        // - Facture enfant (e.g. avoir lié à cette facture).
        $data['child_invoice'] = $this->childInvoice?->serialize(self::SERIALIZE_EXCERPT);

        if ($format === self::SERIALIZE_DETAILS) {
            $data['is_prepayment_final'] = $this->is_prepayment_final;

            // - Factures d'acomptes liées (uniquement pour les factures de solde).
            if ($this->is_prepayment_final) {
                $data['prepayment_invoices'] = $this->prepaymentInvoices
                    ->map(static fn (Invoice $prepayment) => (
                        $prepayment->serialize(self::SERIALIZE_EXCERPT)
                    ))
                    ->all();
            }

            // - Paiements.
            $data['payments'] = $this->payments;
        }

        return $data;
    }
}
