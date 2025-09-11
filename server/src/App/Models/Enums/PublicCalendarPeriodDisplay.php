<?php
declare(strict_types=1);

namespace Loxya\Models\Enums;

/**
 * Période affichée dans le calendrier public.
 */
enum PublicCalendarPeriodDisplay: string
{
    /** Les périodes d'opération uniquement sont affichées. */
    case OPERATION = 'operation';

    /** Les périodes de mobilisation uniquement sont affichées. */
    case MOBILIZATION = 'mobilization';

    /** Les périodes de mobilisation et d'opération sont affichées. */
    case BOTH = 'both';
}
