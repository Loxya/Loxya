<?php
declare(strict_types=1);

namespace Loxya\Support\Collections;

use Illuminate\Support\Collection;
use Loxya\Models\EstimateMaterial;
use Loxya\Models\EventMaterial;
use Loxya\Models\InvoiceMaterial;
use Loxya\Models\Material;

/**
 * @template T of (
 *     Material
 *     |EventMaterial
 *     |InvoiceMaterial
 *     |EstimateMaterial
 * )
 *
 * @extends Collection<array-key, T>
 */
class MaterialsCollection extends Collection
{
    public const GLOBAL_LIST = '__global__';

    /**
     * Trie une collection de matériel par catégorie.
     *
     * @return Collection<string, MaterialsCollection<T>> Une nouvelle collection avec les catégories en clé
     */
    public function byCategories(): Collection
    {
        return $this
            ->mapToGroups(static function ($entity) {
                if (
                    !$entity instanceof Material &&
                    !$entity instanceof EventMaterial &&
                    !$entity instanceof InvoiceMaterial &&
                    !$entity instanceof EstimateMaterial
                ) {
                    throw new \RuntimeException(sprintf("Material instance of `%s` not supported.", $entity::class));
                }

                /** @var Material $material */
                $material = !($entity instanceof Material)
                    ? $entity->material
                    : $entity;

                $category = $material?->category?->name ?? '__other';
                return [$category => $entity];
            })
            ->sortKeys();
    }

    /**
     * Trie une collection de materiel par sous-catégorie.
     *
     * @return Collection<string, MaterialsCollection<T>> Une nouvelle collection avec les sous-catégories en clé
     */
    public function bySubCategories(): Collection
    {
        return $this
            ->mapToGroups(static function ($entity) {
                if (
                    !$entity instanceof Material &&
                    !$entity instanceof EventMaterial &&
                    !$entity instanceof InvoiceMaterial &&
                    !$entity instanceof EstimateMaterial
                ) {
                    throw new \RuntimeException(sprintf("Material instance of `%s` not supported.", $entity::class));
                }

                /** @var Material $material */
                $material = !($entity instanceof Material)
                    ? $entity->material
                    : $entity;

                $category = $material?->category?->name;
                if (!$category) {
                    return ['--' => $entity];
                }

                $subCategory = $material?->subCategory?->name ?? '__other';
                return [sprintf('%s - %s', $category, $subCategory) => $entity];
            })
            ->sortKeys();
    }

    /**
     * Trie une collection de materiel par parc.
     *
     * @return Collection<string, MaterialsCollection<T>> Une nouvelle collection avec les parcs en clé.
     */
    public function byParks(): Collection
    {
        /** @var Collection<string, MaterialsCollection> $byParks */
        $byParks = new Collection();
        foreach ($this->items as $entity) {
            if (
                !$entity instanceof Material &&
                !$entity instanceof EventMaterial
            ) {
                throw new \RuntimeException(sprintf("Material instance of `%s` not supported.", $entity::class));
            }

            /** @var Material $material */
            $material = !($entity instanceof Material)
                ? $entity->material
                : $entity;

            $parkName = $material?->park?->name;
            if (!$byParks->has($parkName)) {
                $byParks->put($parkName, new MaterialsCollection());
            }

            /** @var MaterialsCollection $parkMaterials */
            $parkMaterials = $byParks->get($parkName);
            $parkMaterials->push($entity);
        }

        return $byParks
            ->filter(static fn ($parkMaterials) => !$parkMaterials->isEmpty())
            ->sortKeys();
    }
}
