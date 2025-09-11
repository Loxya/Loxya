<?php
declare(strict_types=1);

use Phinx\Migration\AbstractMigration;

final class AddEstimatesInvoicesMetadata extends AbstractMigration
{
    public function up(): void
    {
        $estimates = $this->table('estimates');
        $estimates
            ->addColumn('metadata', 'json', [
                'default' => null,
                'null' => true,
                'after' => 'author_id',
            ])
            ->update();

        $invoices = $this->table('invoices');
        $invoices
            ->addColumn('metadata', 'json', [
                'default' => null,
                'null' => true,
                'after' => 'author_id',
            ])
            ->update();
    }

    public function down(): void
    {
        $invoices = $this->table('invoices');
        $invoices
            ->removeColumn('metadata')
            ->update();

        $estimates = $this->table('estimates');
        $estimates
            ->removeColumn('metadata')
            ->update();
    }
}
