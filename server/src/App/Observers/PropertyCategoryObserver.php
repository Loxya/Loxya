<?php
declare(strict_types=1);

namespace Loxya\Observers;

use Illuminate\Database\Eloquent\Builder;
use Loxya\Models\Material;
use Loxya\Models\Property;
use Loxya\Models\PropertyCategory;

final class PropertyCategoryObserver
{
    public $afterCommit = true;

    public function created(PropertyCategory $property): void
    {
        $property = Property::find($property->property_id);
        $propertyCategoriesIds = $property->categories->pluck('id')->all();

        debug(
            "[Event] La caractéristique #%d est maintenant limitée aux catégories [%s].",
            $property->id,
            implode(', ', $propertyCategoriesIds),
        );

        //
        // - Suppression de la caractéristique pour le matériel ne faisant pas partie
        //   des nouvelles catégories limitantes.
        //

        $categoryMaterials = Material::query()
            ->whereNotIn('category_id', $propertyCategoriesIds)
            ->whereHas('properties', static fn (Builder $query) => (
                $query->where('property_id', $property->id)
            ))
            ->get();

        foreach ($categoryMaterials as $material) {
            $material->properties()->where('property_id', $property->id)->delete();
            debug(
                "-> Caractéristique supprimée pour le matériel \"%s\" (catégorie \"%s\").",
                $material->name,
                $material->category->name,
            );
        }
    }

    public function deleted(PropertyCategory $propertyCategory): void
    {
        $categoryId = $propertyCategory->category_id;
        $propertyId = $propertyCategory->property_id;
        $property = Property::find($propertyId);

        debug("[Event] La caractéristique #%d n'est plus limitée à la catégorie #%d.", $propertyId, $categoryId);

        if ($property->categories->isEmpty()) {
            debug("-> Plus aucune catégorie ne limite la caractéristique, les valeurs existantes sont conservées.");
            return;
        }

        //
        // - Suppression de la caractéristique pour le matériel faisant partie
        //   de la catégorie qui ne limite plus cette caractéristique.
        //

        $categoryMaterials = Material::where('category_id', $categoryId)
            ->whereHas('properties', static fn (Builder $query) => (
                $query->where('property_id', $propertyId)
            ))
            ->get();

        foreach ($categoryMaterials as $material) {
            $material->properties()->where('property_id', $property->id)->delete();
            debug("-> Caractéristique supprimée pour le matériel \"%s\".", $material->name);
        }
    }
}
