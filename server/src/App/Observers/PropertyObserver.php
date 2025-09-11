<?php
declare(strict_types=1);

namespace Loxya\Observers;

use Loxya\Models\Enums\CustomFieldType;
use Loxya\Models\Enums\PropertyEntity;
use Loxya\Models\Material;
use Loxya\Models\MaterialProperty;
use Loxya\Models\Property;
use Loxya\Support\Period;
use Loxya\Support\Str;

final class PropertyObserver
{
    public $afterCommit = true;

    public function updated(Property $property): void
    {
        if ($property->wasChanged('entities')) {
            $this->handleChangeEntities($property);
        }

        if ($property->wasChanged('config')) {
            $this->handleChangeConfig($property);
        }
    }

    // ------------------------------------------------------
    // -
    // -    Méthodes internes
    // -
    // ------------------------------------------------------

    protected function handleChangeEntities(Property $property): void
    {
        debug(
            "[Event] La caractéristique #%d est maintenant liée aux entités [%s].",
            $property->id,
            implode(', ', $property->entities),
        );

        //
        // - Si la caractéristique n'est plus liée au matériel,
        //   on supprime les valeurs pour le matériel.
        //

        if (!in_array(PropertyEntity::MATERIAL->value, $property->entities, true)) {
            $materials = Material::query()
                ->whereHas('properties', static fn ($query) => (
                    $query->where('property_id', $property->id)
                ))
                ->get();

            foreach ($materials as $material) {
                $material->properties()->where('property_id', $property->id)->delete();
                debug("-> Caractéristique supprimée pour le matériel \"%s\".", $material->name);
            }
        }
    }

    protected function handleChangeConfig(Property $property): void
    {
        $prevConfig = $property->getPrevious('config');

        $doUpdate = static function (callable $callback) use ($property) {
            if (in_array(PropertyEntity::MATERIAL->value, $property->entities, true)) {
                $materialProperties = MaterialProperty::query()
                    ->where('property_id', $property->id)
                    ->get();

                foreach ($materialProperties as $materialProperty) {
                    $value = $materialProperty->getAttributes()['value'];
                    $value = !in_array($value, [null, ''], true) ? json_decode($value, true) : null;
                    $newValue = $value !== null ? $callback($value) : null;
                    if ($newValue === null) {
                        $materialProperty->delete();
                        continue;
                    }
                    $materialProperty->value = $newValue;
                    $materialProperty->save();
                }
            }
        };

        // - Si c'est un changement dans la configuration d'une propriété de type
        //   "Période" et que la précision a changé, on met à jour les matériels
        //   et unités en conséquence.
        if ($property->type === CustomFieldType::PERIOD->value) {
            // - Si la nouvelle précision de la période est libre, on skip.
            if ($property->full_days === null) {
                return;
            }

            $prevFullDays = is_bool($prevConfig['full_days'] ?? null)
                ? $prevConfig['full_days']
                : null;

            // - Si la configuration de la précision de la période n'a pas changé, on skip.
            if ($property->full_days === $prevFullDays) {
                return;
            }

            $doUpdate(static fn (array $value) => (
                Period::tryFrom($value)->setFullDays($property->full_days)
            ));
            return;
        }

        // - Si c'est un changement dans la configuration d'une propriété de type
        //   "Liste" et que les options ont changés, on met à jour les matériels
        //   et unités en conséquence.
        if ($property->type === CustomFieldType::LIST->value) {
            $prevOptions = is_array($prevConfig['options'] ?? null)
                ? $prevConfig['options']
                : [];

            // - Si les options précédente sont encores disponibles, on skip.
            if (empty(array_diff($prevOptions, $property->options))) {
                return;
            }

            $doUpdate(static function (string $value) use ($property) {
                // - Valeur exacte encore présente ?
                if (in_array($value, $property->options, true)) {
                    return $value;
                }

                // - Tentative de correspondance insensible à la casse et aux accents.
                $normalizedValue = Str::ascii(Str::lower($value));
                foreach ($property->options as $option) {
                    if (Str::ascii(Str::lower($option)) === $normalizedValue) {
                        return $option;
                    }
                }

                return null;
            });
            return;
        }
    }
}
