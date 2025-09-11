<?php
declare(strict_types=1);

use Loxya\Config\Config;
use Phinx\Migration\AbstractMigration;

final class FixCreatedAtColumns extends AbstractMigration
{
    private const TABLES = [
        'attributes' => [
            'wasNullable' => true,
            'hasUpdatedAt' => true,
        ],
        'beneficiaries' => [
            'wasNullable' => false,
            'hasUpdatedAt' => true,
        ],
        'cart_events' => [
            'wasNullable' => false,
            'hasUpdatedAt' => false,
        ],
        'carts' => [
            'wasNullable' => false,
            'hasUpdatedAt' => true,
        ],
        'categories' => [
            'wasNullable' => true,
            'hasUpdatedAt' => true,
        ],
        'companies' => [
            'wasNullable' => true,
            'hasUpdatedAt' => true,
        ],
        'countries' => [
            'wasNullable' => true,
            'hasUpdatedAt' => true,
        ],
        'documents' => [
            'wasNullable' => true,
            'hasUpdatedAt' => false,
        ],
        'estimates' => [
            'wasNullable' => true,
            'hasUpdatedAt' => true,
        ],
        'event_lists' => [
            'wasNullable' => false,
            'hasUpdatedAt' => true,
        ],
        'events' => [
            'wasNullable' => true,
            'hasUpdatedAt' => true,
        ],
        'inventories' => [
            'wasNullable' => true,
            'hasUpdatedAt' => true,
        ],
        'invoices' => [
            'wasNullable' => true,
            'hasUpdatedAt' => true,
        ],
        'list_templates' => [
            'wasNullable' => true,
            'hasUpdatedAt' => true,
        ],
        'material_units' => [
            'wasNullable' => true,
            'hasUpdatedAt' => true,
        ],
        'materials' => [
            'wasNullable' => true,
            'hasUpdatedAt' => true,
        ],
        'parks' => [
            'wasNullable' => true,
            'hasUpdatedAt' => true,
        ],
        'persons' => [
            'wasNullable' => true,
            'hasUpdatedAt' => true,
        ],
        'reservations' => [
            'wasNullable' => false,
            'hasUpdatedAt' => true,
        ],
        'sub_categories' => [
            'wasNullable' => true,
            'hasUpdatedAt' => true,
        ],
        'tags' => [
            'wasNullable' => true,
            'hasUpdatedAt' => true,
        ],
        'technicians' => [
            'wasNullable' => false,
            'hasUpdatedAt' => true,
        ],
        'users' => [
            'wasNullable' => true,
            'hasUpdatedAt' => true,
        ],
    ];

    public function up(): void
    {
        $prefix = Config::get('db.prefix');

        foreach (self::TABLES as $tableName => $tableInfos) {
            // - On tente d'assigner dans un premier temps la valeur du
            //   champ `updated_at` (s'il existe) à `created_at` si spécifiée.
            if ($tableInfos['hasUpdatedAt']) {
                $qb = $this->getUpdateBuilder();
                $qb
                    ->update($prefix . $tableName)
                    ->set('created_at', $qb->newExpr('updated_at'))
                    ->whereNull('created_at')
                    ->execute();
            }

            // - Sinon, on met la date courante.
            $qb = $this->getUpdateBuilder();
            $qb
                ->update($prefix . $tableName)
                ->set('created_at', $qb->newExpr('CURRENT_TIMESTAMP'))
                ->whereNull('created_at')
                ->execute();

            $table = $this->table($tableName);
            $table
                ->changeColumn('created_at', 'datetime', [
                    'null' => false,
                    'update' => '',
                    'default' => 'CURRENT_TIMESTAMP',
                ])
                ->update();
        }
    }

    public function down(): void
    {
        foreach (self::TABLES as $tableName => $tableInfos) {
            $table = $this->table($tableName);
            $table
                ->changeColumn('created_at', 'datetime', (
                    $tableInfos['wasNullable']
                        ? ['null' => true, 'default' => null]
                        : ['null' => false]
                ))
                ->update();
        }
    }
}
