import Decimal from 'decimal.js';
import TaxRegime from '@/utils/invoicing/tax-regime';
import BillingFormat from '@/stores/api/@enums/billing-format';

import type { InvoiceDetails, InvoicePayment } from '@/stores/api/invoices';

export type PaymentTaxBreakdownLine = {
    rate: Decimal,
    amount: Decimal,
};

type RawBreakdownEntry = {
    rate: Decimal,
    paid: Decimal,
    target: Decimal,
};

export const computeTaxesBreakdown = (
    invoice: InvoiceDetails,
    newAmount: Decimal,
): PaymentTaxBreakdownLine[] | null => {
    // - Les factures "legacy" ne supportent pas la ventilation.
    if (invoice.format === BillingFormat.V1 || invoice.format === BillingFormat.V2) {
        return null;
    }

    // - Si le montant est nul, pas de ventilation.
    if (newAmount.isZero()) {
        return null;
    }

    const currentInvoice = (
        invoice as Exclude<InvoiceDetails, { format: BillingFormat.V1 | BillingFormat.V2 }>
    );
    const {
        total_taxes: totalTaxes,
        global_tax_regime: globalTaxRegime,
    } = currentInvoice;

    // - Les exemptions globales ne sont pas ventilées.
    if (globalTaxRegime !== null || totalTaxes === null || totalTaxes.length === 0) {
        return null;
    }

    const totalPayable = invoice.total_with_taxes.abs();
    if (totalPayable.isZero()) {
        return null;
    }

    const previousPaidTotal = invoice.payments.reduce(
        (total: Decimal, payment: InvoicePayment) => (
            total.plus(payment.amount)
        ),
        new Decimal(0),
    );
    const nextPaidTotal = previousPaidTotal.plus(newAmount);
    if (nextPaidTotal.isNegative() || nextPaidTotal.greaterThan(totalPayable)) {
        return null;
    }

    const ratio = nextPaidTotal.isZero() ? null : (
        nextPaidTotal
            .dividedBy(totalPayable)
            .toDecimalPlaces(6, Decimal.ROUND_HALF_UP)
    );

    let deducted = new Decimal(0);
    const rawBreakdown: Map<string, RawBreakdownEntry> = [...totalTaxes]
        .map((tax, originalIndex) => ({ tax, originalIndex }))
        .reverse()
        .reduce<Map<string, RawBreakdownEntry>>(
            (carry, { tax, originalIndex }) => {
                const isPrimaryTax = originalIndex === 0;

                const rate = tax.type === TaxRegime.STANDARD
                    ? tax.value.toDecimalPlaces(3)
                    : new Decimal(0);

                const rateKey = rate.toFixed(3);
                if (!carry.has(rateKey)) {
                    carry.set(rateKey, {
                        rate,
                        paid: new Decimal(0),
                        target: new Decimal(0),
                    });
                }

                // - Pas de cible à calculer si le cumul payé tombe à zéro
                //   (annulation totale des paiements précédents).
                if (ratio !== null) {
                    let rateAmount: Decimal;
                    if (!isPrimaryTax) {
                        const scaledBase = tax.base.abs()
                            .times(ratio)
                            .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

                        rateAmount = scaledBase;
                        if (tax.type === TaxRegime.STANDARD) {
                            const scaledTotal = scaledBase
                                .times(tax.value.dividedBy(100))
                                .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

                            rateAmount = rateAmount.plus(scaledTotal);
                        }
                        deducted = deducted.plus(rateAmount);
                    } else {
                        rateAmount = nextPaidTotal.minus(deducted);
                    }

                    const entry = carry.get(rateKey)!;
                    entry.target = entry.target.plus(rateAmount);
                }

                return carry;
            },
            new Map<string, RawBreakdownEntry>(),
        );

    invoice.payments.forEach((payment: InvoicePayment) => {
        (payment.taxes_breakdown ?? []).forEach((entry) => {
            const rawEntry = rawBreakdown.get(entry.rate.toFixed(3));
            if (rawEntry === undefined) {
                return;
            }
            rawEntry.paid = rawEntry.paid.plus(entry.amount);
        });
    });

    const breakdown: PaymentTaxBreakdownLine[] = Array.from(rawBreakdown.values())
        .reduce<PaymentTaxBreakdownLine[]>(
            (carry, entry): PaymentTaxBreakdownLine[] => {
                const amount = entry.target.minus(entry.paid);
                if (amount.isZero()) {
                    return carry;
                }
                return carry.concat({ rate: entry.rate, amount });
            },
            [],
        )
        .reverse();

    return breakdown.length > 0 ? breakdown : null;
};
