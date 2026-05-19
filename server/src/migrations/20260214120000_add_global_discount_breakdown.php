<?php
declare(strict_types=1);

use Phinx\Migration\AbstractMigration;

final class AddGlobalDiscountBreakdown extends AbstractMigration
{
    public function up(): void
    {
        $estimates = $this->table('estimates');
        $estimates
            ->addColumn('global_discount_breakdown', 'json', [
                'null' => true,
                'default' => null,
                'after' => 'global_discount_rate',
            ])
            ->update();

        $invoices = $this->table('invoices');
        $invoices
            ->addColumn('global_discount_breakdown', 'json', [
                'null' => true,
                'default' => null,
                'after' => 'global_discount_rate',
            ])
            ->update();
    }

    public function down(): void
    {
        $estimates = $this->table('estimates');
        $estimates
            ->removeColumn('global_discount_breakdown')
            ->update();

        $invoices = $this->table('invoices');
        $invoices
            ->removeColumn('global_discount_breakdown')
            ->update();
    }
}
