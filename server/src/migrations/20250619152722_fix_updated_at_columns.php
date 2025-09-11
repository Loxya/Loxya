<?php
declare(strict_types=1);

use Phinx\Migration\AbstractMigration;

final class FixUpdatedAtColumns extends AbstractMigration
{
    private const TABLES = [
        'attributes',
        'beneficiaries',
        'carts',
        'categories',
        'companies',
        'countries',
        'estimates',
        'event_lists',
        'events',
        'inventories',
        'invoices',
        'list_templates',
        'material_units',
        'materials',
        'parks',
        'pending_users',
        'persons',
        'reservations',
        'roles',
        'sub_categories',
        'tags',
        'technicians',
        'users',
    ];

    public function up(): void
    {
        foreach (self::TABLES as $tableName) {
            $table = $this->table($tableName);
            $table
                ->changeColumn('updated_at', 'datetime', [
                    'null' => true,
                    'default' => null,
                    'update' => 'CURRENT_TIMESTAMP',
                ])
                ->update();
        }
    }

    public function down(): void
    {
        foreach (self::TABLES as $tableName) {
            $table = $this->table($tableName);
            $table
                ->changeColumn('updated_at', 'datetime', [
                    'null' => true,
                    'default' => null,
                ])
                ->update();
        }
    }
}
