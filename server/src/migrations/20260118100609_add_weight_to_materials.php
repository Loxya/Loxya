<?php
declare(strict_types=1);

use Loxya\Config\Config;
use Loxya\Config\Enums\WeightUnit;
use Loxya\Models\Enums\CustomFieldType;
use Loxya\Models\Enums\PropertyEntity;
use Loxya\Services\I18n;
use Loxya\Support\Validation\Validator as V;
use Phinx\Migration\AbstractMigration;

final class AddWeightToMaterials extends AbstractMigration
{
    public function up(): void
    {
        $prefix = Config::get('db.prefix');

        $materials = $this->table('materials');
        $materials
            ->addColumn('weight', 'decimal', [
                'precision' => 10,
                'scale' => 3,
                'default' => null,
                'null' => true,
                'after' => 'replacement_price',
            ])
            ->addColumn('origin_country', 'char', [
                'length' => 2,
                'null' => true,
                'after' => 'weight',
            ])
            ->update();

        $materialUnits = $this->table('material_units');
        $materialUnits
            ->addColumn('weight', 'decimal', [
                'precision' => 10,
                'scale' => 3,
                'default' => null,
                'null' => true,
                'after' => 'purchase_date',
            ])
            ->update();

        /**
         * Récupération des éventuelles caractéristiques spéciales existantes (poids et
         * pays d'origine), pour les transférer dans les nouveaux champs du matériel.
         */

        $numericFieldTypes = [CustomFieldType::INTEGER->value, CustomFieldType::FLOAT->value];
        $stringFieldTypes = [CustomFieldType::STRING->value, CustomFieldType::TEXT->value];

        $weightNames = ["weight", "poids"];
        $originCountryNames = [
            "made in",
            "country of origin",
            "origin country",
            "pays d'origine",
            "pays de fabrication",
        ];

        $propertiesData = $this->getSelectBuilder()
            ->select('*')
            ->from(sprintf('%sproperties', $prefix))
            ->execute()->fetchAll('assoc');

        $weightPropertyId = null;
        $originCountryPropertyId = null;
        foreach ($propertiesData as $property) {
            $entities = explode(',', $property['entities']);
            if (!in_array(PropertyEntity::MATERIAL->value, $entities)) {
                continue;
            }

            $name = mb_strtolower($property['name']);
            $config = $property['config'] !== null
                ? (json_decode($property['config'], true) ?? [])
                : [];

            if (
                $weightPropertyId === null
                && in_array($name, $weightNames, true)
                && in_array($property['type'], $numericFieldTypes, true)
                && in_array(
                    mb_strtolower($config['unit'] ?? ''),
                    array_column(WeightUnit::cases(), 'value'),
                    true,
                )
            ) {
                $weightPropertyId = (int) $property['id'];
                continue;
            }

            if (
                $originCountryPropertyId === null
                && in_array($name, $originCountryNames, true)
                && in_array($property['type'], $stringFieldTypes, true)
            ) {
                $originCountryPropertyId = (int) $property['id'];
            }
        }

        // - Enregistrement des valeurs de poids dans le matériel.

        if ($weightPropertyId !== null) {
            $materialProperties = $this->getSelectBuilder()
                ->select(['id', 'material_id', 'value'])
                ->from(sprintf('%smaterial_properties', $prefix))
                ->where(['property_id' => $weightPropertyId])
                ->execute()->fetchAll('assoc');

            foreach ($materialProperties as $materialProperty) {
                $this->getUpdateBuilder()
                    ->update(sprintf('%smaterials', $prefix))
                    ->set('weight', (float) $materialProperty['value'])
                    ->where(['id' => $materialProperty['material_id']])
                    ->execute();
            }

            // - Suppression de la propriété "poids".

            $this->getDeleteBuilder()
                ->delete(sprintf('%smaterial_properties', $prefix))
                ->where(['property_id' => $weightPropertyId])
                ->execute();

            $this->getDeleteBuilder()
                ->delete(sprintf('%sproperties', $prefix))
                ->where(['id' => $weightPropertyId])
                ->execute();
        }

        // - Enregistrement des valeurs de pays d'origine dans le matériel.

        if ($originCountryPropertyId !== null) {
            $materialProperties = $this->getSelectBuilder()
                ->select(['id', 'material_id', 'value'])
                ->from(sprintf('%smaterial_properties', $prefix))
                ->where(['property_id' => $originCountryPropertyId])
                ->execute()->fetchAll('assoc');

            foreach ($materialProperties as $materialProperty) {
                $countryCode = json_decode($materialProperty['value']);
                if (!V::countryCode()->validate($countryCode)) {
                    continue;
                }

                $this->getUpdateBuilder()
                    ->update(sprintf('%smaterials', $prefix))
                    ->set('origin_country', $countryCode)
                    ->where(['id' => $materialProperty['material_id']])
                    ->execute();
            }

            // - Suppression de la propriété "pays d'origine".

            $this->getDeleteBuilder()
                ->delete(sprintf('%smaterial_properties', $prefix))
                ->where(['property_id' => $originCountryPropertyId])
                ->execute();

            $this->getDeleteBuilder()
                ->delete(sprintf('%sproperties', $prefix))
                ->where(['id' => $originCountryPropertyId])
                ->execute();
        }
    }

    public function down(): void
    {
        $prefix = Config::get('db.prefix');
        $i18n = new I18n(Config::get('defaultLang'));

        // - Re-création des caractéristiques spéciales de poids et de pays d'origine.

        $properties = $this->table('properties');
        $weightProperty = [
            'name' => $i18n->translate('weight'),
            'type' => CustomFieldType::FLOAT->value,
            'entities' => join(',', [PropertyEntity::MATERIAL->value]),
            'config' => json_encode(['unit' => Config::get('measurementUnits.materials.weight')->value]),
            'is_totalisable' => true,
        ];
        $properties->insert($weightProperty)->save();
        $weightPropertyId = (int) $this->getAdapter()->getConnection()->lastInsertId();

        $originCountryProperty = [
            'name' => $i18n->translate('origin-country'),
            'type' => CustomFieldType::STRING->value,
            'entities' => PropertyEntity::MATERIAL->value,
            'config' => json_encode(['max_length' => null]),
        ];
        $properties->insert($originCountryProperty)->save();
        $originCountryPropertyId = (int) $this->getAdapter()->getConnection()->lastInsertId();

        // - Insertion des valeurs de ces caractéristiques spéciales
        //   dans le matériel.

        $materialsData = $this->getSelectBuilder()
            ->select(['id', 'weight', 'origin_country'])
            ->from(sprintf('%smaterials', $prefix))
            ->where(['OR' => [
                'weight IS NOT' => null,
                'origin_country IS NOT' => null,
            ]])
            ->execute()->fetchAll('assoc');

        $materialProperties = $this->table('material_properties');
        foreach ($materialsData as $material) {
            if ($material['weight'] !== null) {
                $materialProperties->insert([
                    'material_id' => $material['id'],
                    'property_id' => $weightPropertyId,
                    'value' => (string) $material['weight'],
                ])->save();
            }

            if ($material['origin_country'] !== null) {
                $materialProperties->insert([
                    'material_id' => $material['id'],
                    'property_id' => $originCountryPropertyId,
                    'value' => json_encode($material['origin_country']),
                ])->save();
            }
        }

        // - Suppression des colonnes "weight" et "origin_country".

        $materials = $this->table('materials');
        $materials
            ->removeColumn('weight')
            ->removeColumn('origin_country')
            ->update();
    }
}
