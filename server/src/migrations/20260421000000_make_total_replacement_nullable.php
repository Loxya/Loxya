<?php
declare(strict_types=1);

use Loxya\Config\Config;
use Phinx\Migration\AbstractMigration;

final class MakeTotalReplacementNullable extends AbstractMigration
{
    public function up(): void
    {
        foreach (['estimates', 'invoices'] as $tableName) {
            $this->table($tableName)
                ->changeColumn('total_replacement', 'decimal', [
                    'precision' => 14,
                    'scale' => 2,
                    'null' => true,
                    'default' => null,
                ])
                ->update();
        }
    }

    public function down(): void
    {
        $prefix = Config::get('db.prefix');

        foreach (['estimates', 'invoices'] as $tableName) {
            // - On met à `0` les valeurs `null` avant de rendre la colonne non-nullable.
            $this->getUpdateBuilder()
                ->update(sprintf('%s%s', $prefix, $tableName))
                ->set('total_replacement', 0)
                ->where(['total_replacement IS' => null])
                ->execute();

            $this->table($tableName)
                ->changeColumn('total_replacement', 'decimal', [
                    'precision' => 14,
                    'scale' => 2,
                    'null' => false,
                    'default' => 0,
                ])
                ->update();
        }
    }
}
