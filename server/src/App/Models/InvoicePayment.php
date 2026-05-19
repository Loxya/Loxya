<?php
declare(strict_types=1);

namespace Loxya\Models;

use Adbar\Dot as DotArray;
use Brick\Math\BigDecimal as Decimal;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Loxya\Contracts\Serializable;
use Loxya\Models\Casts\AsDecimal;
use Loxya\Models\Enums\BillingFormat;
use Loxya\Models\Traits\Serializer;
use Loxya\Support\Invoicing\PaymentMethod;
use Loxya\Support\Validation\Rules\SchemaStrict;
use Loxya\Support\Validation\Validator as V;
use Respect\Validation\Rules as Rule;

/**
 * Paiement d'une facture.
 *
 * @phpstan-type TaxData array{
 *     rate: Decimal,
 *     amount: Decimal,
 * }
 *
 * @property-read ?int $id
 * @property int $invoice_id
 * @property-read Invoice $invoice
 * @property CarbonImmutable $date
 * @property value-of<PaymentMethod>|null $method
 * @property list<TaxData>|null $taxes_breakdown
 * @property Decimal $amount
 * @property string|null $reference
 * @property CarbonImmutable $created_at
 */
final class InvoicePayment extends BaseModel implements Serializable
{
    use Serializer;

    public const UPDATED_AT = null;

    protected $table = 'invoice_payments';

    public function __construct(array $attributes = [])
    {
        parent::__construct($attributes);

        $this->validation = fn () => [
            'invoice_id' => V::custom([$this, 'checkInvoiceId']),
            'date' => V::notEmpty()->dateTime(),
            'method' => V::nullable(V::enumValue(PaymentMethod::class)),
            'taxes_breakdown' => V::custom([$this, 'checkTaxesBreakdown']),
            'amount' => V::custom([$this, 'checkAmount']),
            'reference' => V::nullable(V::length(1, 191)),
        ];
    }

    // ------------------------------------------------------
    // -
    // -    Validation
    // -
    // ------------------------------------------------------

    public function checkInvoiceId(mixed $value)
    {
        V::nullable(V::intVal())->check($value);

        // - L'identifiant de la facture n'est pas encore défini, on skip.
        if (!$this->exists && $value === null) {
            return true;
        }

        /** @var Invoice|null $invoice */
        $invoice = Invoice::withTrashed()->find($value);
        if ($invoice === null) {
            return false;
        }

        // - Si la valeur du champ n'a pas changée, on ne va pas plus loin.
        if ($this->exists && !$this->isDirty('invoice_id')) {
            return true;
        }

        // - On ne peut pas enregistrer de paiement pour une facture annulée.
        return !$invoice->trashed() && !$invoice->is_cancelled;
    }

    public function checkTaxesBreakdown(mixed $value)
    {
        if (!is_array($value)) {
            if (!V::nullable(V::json())->validate($value)) {
                return false;
            }
            $value = $value !== null ? $this->fromJson($value) : null;
        }

        // - S'il y a un régime d'exemption global sur la facture, pas de détails des taxes.
        if ($this->invoice?->global_tax_regime !== null) {
            return V::nullType();
        }

        // - Si c'est un ancien format, pas de détails des taxes.
        $format = $this->invoice?->format ?? BillingFormat::current()->value;
        if ($format < BillingFormat::V3->value) {
            return V::nullType();
        }

        $schema = V::arrayType()->notEmpty()->each(V::custom(static fn () => (
            new SchemaStrict(
                new Rule\Key('rate', V::custom(static function ($subValue) {
                    V::floatVal()->check($subValue);
                    $subValue = Decimal::of($subValue);

                    return (
                        $subValue->isGreaterThanOrEqualTo(0) &&
                        $subValue->isLessThanOrEqualTo(100) &&
                        $subValue->getScale() <= 3
                    );
                })),
                new Rule\Key('amount', V::custom(static function ($subValue) {
                    V::floatVal()->check($subValue);
                    $subValue = Decimal::of($subValue);

                    return (
                        $subValue->isGreaterThan(-1_000_000_000_000) &&
                        $subValue->isLessThan(1_000_000_000_000) &&
                        $subValue->getScale() <= 2
                    );
                })),
            )
        )));
        return $schema->validate($value);
    }

    public function checkAmount(mixed $value)
    {
        V::floatVal()->check($value);
        $value = Decimal::of($value);

        // - Le paiement ne peut pas être à `0`.
        if ($value->isZero()) {
            return false;
        }

        // - Note: Les paiements négatifs sont autorisés pour
        //   les annulations d'une précédent paiement.
        $isValid = (
            $value->isGreaterThan(-1_000_000_000_000) &&
            $value->isLessThan(1_000_000_000_000) &&
            $value->getScale() <= 2
        );
        if (!$isValid) {
            return false;
        }

        // - Vérification de la cohérence avec la ventilation.
        $breakdownRaw = $this->getAttributeUnsafeValue('taxes_breakdown');
        if (V::custom([$this, 'checkTaxesBreakdown'])->validate($breakdownRaw)) {
            $breakdown = !is_array($breakdownRaw)
                ? ($breakdownRaw !== null ? $this->fromJson($breakdownRaw) : null)
                : $breakdownRaw;

            if ($breakdown !== null) {
                $breakdownTotal = collect($breakdown)->reduce(
                    static fn (Decimal $total, array $tax) => (
                        $total->plus($tax['amount'])
                    ),
                    Decimal::zero(),
                );
                if (!$breakdownTotal->isEqualTo($value)) {
                    return false;
                }
            }
        }

        // - Si on est dans un update et que le champ n'a pas changé, on laisse passer.
        if ($this->exists && !$this->isDirty('amount')) {
            return true;
        }

        // - Si la facture parente n'est pas récupérable, on ne va pas plus loin.
        if ($this->invoice === null) {
            return true;
        }

        $alreadyPaid = $this->invoice->payments
            ->filter(fn (InvoicePayment $payment) => (
                !$this->exists || $payment->id !== $this->id
            ))
            ->reduce(
                static fn (Decimal $carry, InvoicePayment $payment) => (
                    $carry->plus($payment->amount)
                ),
                Decimal::zero(),
            );

        $alreadyPaid = Decimal::max($alreadyPaid, 0);
        $dueAmount = $this->invoice->total_with_taxes->abs();
        $remaining = $dueAmount->minus($alreadyPaid);

        if ($value->isPositive()) {
            // - Une facture soldée n'accepte plus de paiement positif et
            //   un paiement positif ne peut pas dépasser le restant dû.
            if ($remaining->isNegativeOrZero() || $value->isGreaterThan($remaining)) {
                return 'payment-amount-exceeds-remaining-due';
            }
        } else {
            // - Un montant négatif (annulation) ne peut pas dépasser, en
            //   valeur absolue, ce qui a déjà été collecté.
            if ($value->abs()->isGreaterThan($alreadyPaid)) {
                return 'payment-reversal-exceeds-paid-amount';
            }
        }

        return true;
    }

    // ------------------------------------------------------
    // -
    // -    Relations
    // -
    // ------------------------------------------------------

    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class)
            ->withTrashed();
    }

    // ------------------------------------------------------
    // -
    // -    Setters
    // -
    // ------------------------------------------------------

    protected $fillable = [
        'invoice_id',
        'date',
        'method',
        'amount',
        'taxes_breakdown',
        'reference',
    ];

    public function setMethodAttribute(mixed $value): void
    {
        $value = $value instanceof PaymentMethod ? $value->value : $value;
        $this->attributes['method'] = $value;
    }

    public function setReferenceAttribute(mixed $value): void
    {
        $value = is_string($value) ? trim($value) : $value;
        $this->attributes['reference'] = empty($value) ? null : $value;
    }

    public function setTaxesBreakdownAttribute(mixed $value): void
    {
        $value = is_array($value) && empty($value) ? null : $value;
        $value = $value !== null ? $this->castAttributeAsJson('taxes_breakdown', $value) : null;
        $this->attributes['taxes_breakdown'] = $value;
    }

    // ------------------------------------------------------
    // -
    // -    Mutators
    // -
    // ------------------------------------------------------

    protected $casts = [
        'invoice_id' => 'integer',
        'date' => 'immutable_datetime',
        'method' => 'string',
        'amount' => AsDecimal::class,
        'taxes_breakdown' => 'array',
        'reference' => 'string',
        'created_at' => 'immutable_datetime',
    ];

    /** @return list<TaxData>|null */
    public function getTaxesBreakdownAttribute(mixed $value): array|null
    {
        // - Si la facture a une exemption globale, pas de détails des taxes.
        if ($this->invoice?->global_tax_regime !== null) {
            return null;
        }

        $breakdown = $this->castAttribute('taxes_breakdown', $value);
        if ($breakdown === null) {
            return null;
        }

        return array_map(
            static fn ($tax) => array_replace($tax, [
                'rate' => Decimal::of($tax['rate'])->toScale(3),
                'amount' => Decimal::of($tax['amount'])->toScale(2),
            ]),
            $breakdown,
        );
    }

    // ------------------------------------------------------
    // -
    // -    Serialization
    // -
    // ------------------------------------------------------

    public function serialize(): array
    {
        return (new DotArray($this->attributesForSerialization()))
            ->delete(['invoice_id', 'created_at'])
            ->all();
    }
}
