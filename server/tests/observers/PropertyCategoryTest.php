<?php
declare(strict_types=1);

namespace Loxya\Tests\Observers;

use Illuminate\Database\Eloquent\Collection;
use Loxya\Models\Material;
use Loxya\Models\Property;
use Loxya\Tests\TestCase;

final class PropertyCategoryTest extends TestCase
{
    public function testAttachCategoriesToProperty(): void
    {
        $property = Property::findOrFail(2);

        // Pour la caractéristique #2 ("Couleur", qui n'avait pas de limite),
        // on limite à la catégorie #2 ("Lumière").
        $property->categories()->attach(2);

        // La valeur pour cette caractéristique dans le matériel #1 doit être
        // supprimée, car il fait partie de la catégorie #1.
        /** @var Collection<array-key, Property> $properties */
        $properties = Material::findOrFail(1)->properties;
        $this->assertSame([1, 3], $properties->pluck('id')->all());
    }

    public function testDetachCategoriesFromProperty(): void
    {
        $property = Property::findOrFail(3);

        // On enlève la limite de catégorie #1 ("Son") à la caractéristique #3 ("Puissance"),
        // qui est aussi limitée à la catégorie #2 ("Lumière").
        $property->categories()->detach(1);

        //
        // - Les caractéristiques des matériels concernés doivent être supprimées.
        //

        /** @var Collection<array-key, Property> $properties */
        $properties = Material::findOrFail(1)->properties;
        $this->assertSame([2, 1], $properties->pluck('id')->all());

        /** @var Collection<array-key, Property> $properties */
        $properties = Material::findOrFail(2)->properties;
        $this->assertSame([1], $properties->pluck('id')->all());

        //
        // - Celles des matériels de la catégorie restante ne doivent pas être supprimées.
        //

        /** @var Collection<array-key, Property> $properties */
        $properties = Material::findOrFail(3)->properties;
        $this->assertSame([1, 3], $properties->pluck('id')->all());

        /** @var Collection<array-key, Property> $properties */
        $properties = Material::findOrFail(4)->properties;
        $this->assertSame([4, 1, 3], $properties->pluck('id')->all());
    }
}
