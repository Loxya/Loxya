<?php
declare(strict_types=1);

use Phinx\Migration\AbstractMigration;

final class AddPaymentTermDaysToBilling extends AbstractMigration
{
    public function up(): void
    {
        foreach (['invoices', 'estimates'] as $tableName) {
            $table = $this->table($tableName);
            $table
                ->addColumn('due_delay', 'integer', [
                    'signed' => false,
                    'null' => true,
                    'default' => null,
                    'after' => 'due_date',
                ])
                ->update();
        }
    }

    public function down(): void
    {
        foreach (['invoices', 'estimates'] as $tableName) {
            $table = $this->table($tableName);
            $table
                ->removeColumn('due_delay')
                ->update();
        }
    }
}
