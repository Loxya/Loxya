<?php
declare(strict_types=1);

use Illuminate\Support\Str;
use Loxya\Config\Config;
use Phinx\Migration\AbstractMigration;

final class AddUuidToExtras extends AbstractMigration
{
    public function up(): void
    {
        $prefix = Config::get('db.prefix');

        foreach (['event_extras', 'reservation_extras'] as $tableName) {
            $table = $this->table($tableName);
            $table
                ->addColumn('uuid', 'char', [
                    'limit' => 36,
                    'null' => true,
                    'after' => 'id',
                ])
                ->update();

            // - Génération des UUID pour les lignes existantes.
            $rows = $this->getSelectBuilder()
                ->select(['id'])
                ->from(sprintf('%s%s', $prefix, $tableName))
                ->execute()->fetchAll('assoc');

            $usedUuids = [];
            foreach ($rows as $row) {
                do {
                    $uuid = (string) Str::uuid();
                } while (in_array($uuid, $usedUuids, true));

                $this->getUpdateBuilder()
                    ->update(sprintf('%s%s', $prefix, $tableName))
                    ->set('uuid', $uuid)
                    ->where(['id' => $row['id']])
                    ->execute();
            }

            $table
                ->changeColumn('uuid', 'char', [
                    'limit' => 36,
                    'null' => false,
                ])
                ->addIndex(['uuid'], ['unique' => true])
                ->update();
        }
    }

    public function down(): void
    {
        foreach (['event_extras', 'reservation_extras'] as $tableName) {
            $table = $this->table($tableName);
            $table
                ->removeColumn('uuid')
                ->update();
        }
    }
}
