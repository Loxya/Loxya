<?php
declare(strict_types=1);

namespace Loxya\Models\Enums;

/** Type des factures et devis. */
enum BillingType: string
{
    /** Facture ou devis portant uniquement sur des biens physiques. */
    case GOODS = 'goods';

    /** Facture ou devis portant uniquement sur des prestations de service. */
    case SERVICES = 'services';

    /** Facture ou devis mixte, combinant des biens et des prestations de service. */
    case BOTH = 'both';
}
