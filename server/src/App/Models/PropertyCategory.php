<?php
declare(strict_types=1);

namespace Loxya\Models;

/**
 * Catégorie pour laquelle une caractéristique de matériel est limitée.
 *
 * @property-read int $property_id
 * @property-read int $category_id
 */
final class PropertyCategory extends BasePivot
{
    protected $table = 'property_categories';

    // ------------------------------------------------------
    // -
    // -    Mutators
    // -
    // ------------------------------------------------------

    protected $casts = [
        'property_id' => 'integer',
        'category_id' => 'integer',
    ];
}
