<?php
declare(strict_types=1);

namespace Loxya\Config\Enums;

/** Unité de mesure du poids. */
enum WeightUnit: string
{
    /** Kilogramme */
    case KILOGRAM = 'kg';

    /** Gramme */
    case GRAM = 'g';

    /** Tonne */
    case TONNE = 't';

    /** Livre */
    case POUND = 'lb';
}
