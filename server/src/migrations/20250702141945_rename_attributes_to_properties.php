<?php
declare(strict_types=1);

use Phinx\Migration\AbstractMigration;

final class RenameAttributesToProperties extends AbstractMigration
{
    public function up(): void
    {
        $attributes_categories = $this->table('attribute_categories');
        $attributes_categories
            ->renameColumn('attribute_id', 'property_id')
            ->update();

        $material_attributes = $this->table('material_attributes');
        $material_attributes
            ->renameColumn('attribute_id', 'property_id')
            ->update();

        $this->table('attributes')
            ->rename('properties')
            ->update();

        $attributes_categories
            ->rename('property_categories')
            ->update();

        $material_attributes
            ->rename('material_properties')
            ->update();
    }

    public function down(): void
    {
        $this
            ->table('material_properties')
            ->rename('material_attributes')
            ->update();

        $this
            ->table('property_categories')
            ->rename('attribute_categories')
            ->update();

        $this->table('properties')
            ->rename('attributes')
            ->update();

        $material_attributes = $this->table('material_attributes');
        $material_attributes
            ->renameColumn('property_id', 'attribute_id')
            ->update();

        $attribute_categories = $this->table('attribute_categories');
        $attribute_categories
            ->renameColumn('property_id', 'attribute_id')
            ->update();
    }
}
