<?php
declare(strict_types=1);

namespace Loxya\Support\Data;

/** Format des factures électroniques */
enum ElectronicInvoiceFormat: string
{
    /** Factur-X / ZUGFeRD */
    case FACTURX = 'facturx';

    /** UBL */
    case UBL = 'ubl';
}
