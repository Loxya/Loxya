<?php
declare(strict_types=1);

use Phinx\Migration\AbstractMigration;

final class AddSearchableToProperties extends AbstractMigration
{
    public function up(): void
    {
        $properties = $this->table('properties');
        $properties
            ->addColumn('is_searchable', 'boolean', [
                'after' => 'is_totalisable',
                'default' => false,
                'null' => false,
            ])
            ->update();
    }

    public function down(): void
    {
        $properties = $this->table('properties');
        $properties
            ->removeColumn('is_searchable')
            ->update();
    }
}
