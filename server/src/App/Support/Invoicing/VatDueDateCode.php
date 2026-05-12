<?php
declare(strict_types=1);

namespace Loxya\Support\Invoicing;

use Loxya\Support\Data\ElectronicInvoiceFormat;

/**
 * Code de date d'exigibilité de la TVA.
 *
 * @see https://service.unece.org/trade/untdid/d16b/tred/tred2475.htm
 * @see https://service.unece.org/trade/untdid/d16b/tred/tred2005.htm
 */
enum VatDueDateCode: string
{
    /** Date de la facture. */
    case INVOICE_DATE = 'invoice-date';

    /** Date de livraison des marchandises à l'établissement / domicile / site. */
    case DELIVERY_DATE = 'delivery-date';

    /** Date de paiement. */
    case PAYMENT_DATE = 'payment-date';

    public function getCode(ElectronicInvoiceFormat $format): string
    {
        // phpcs:ignore PHPCompatibility.Variables.ForbiddenThisUseContexts
        $codes = match ($this) {
            self::INVOICE_DATE => [
                ElectronicInvoiceFormat::FACTURX->value => '5',
                ElectronicInvoiceFormat::UBL->value => '3',
            ],
            self::DELIVERY_DATE => [
                ElectronicInvoiceFormat::FACTURX->value => '29',
                ElectronicInvoiceFormat::UBL->value => '35',
            ],
            self::PAYMENT_DATE => [
                ElectronicInvoiceFormat::FACTURX->value => '72',
                ElectronicInvoiceFormat::UBL->value => '432',
            ],
        };
        return $codes[$format->value];
    }
}
