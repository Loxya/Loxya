<?php
declare(strict_types=1);

use Loxya\Config\Config;
use Phinx\Migration\AbstractMigration;

final class AddDraftsInvoicing extends AbstractMigration
{
    public function up(): void
    {
        $invoices = $this->table('invoices');
        $invoices
            ->changeColumn('status', 'enum', [
                'values' => ['draft', 'pending', 'sent'],
                'default' => 'draft',
                'null' => false,
            ])
            ->changeColumn('number', 'string', [
                'length' => 20,
                'null' => true,
                'default' => null,
            ])
            ->changeColumn('date', 'datetime', [
                'null' => true,
                'default' => null,
            ])
            ->update();

        $estimates = $this->table('estimates');
        $estimates
            ->changeColumn('status', 'enum', [
                'values' => ['draft', 'pending', 'sent', 'accepted', 'rejected'],
                'default' => 'draft',
                'null' => false,
            ])
            ->changeColumn('date', 'datetime', [
                'null' => true,
                'default' => null,
            ])
            ->addColumn('number', 'string', [
                'length' => 20,
                'null' => true,
                'default' => null,
                'after' => 'status',
            ])
            ->addIndex(['number'], ['unique' => true])
            ->update();
    }

    public function down(): void
    {
        $prefix = Config::get('db.prefix');

        $draftEstimates = $this->fetchAll(
            sprintf('SELECT `id` FROM `%sestimates` WHERE `status` = \'draft\' LIMIT 1', $prefix),
        );
        $draftInvoices = $this->fetchAll(
            sprintf('SELECT `id` FROM `%sinvoices` WHERE `status` = \'draft\' LIMIT 1', $prefix),
        );
        if (count($draftEstimates) > 0 || count($draftInvoices) > 0) {
            throw new \RuntimeException(
                "Unable to rollback the migration: Draft estimates or invoices exist. " .
                "Please finalize or delete them before rolling back.",
            );
        }

        //
        // - Devis
        //

        $estimates = $this->table('estimates');
        $estimates
            ->removeIndex(['number'])
            ->update();

        $estimates
            ->changeColumn('status', 'enum', [
                'values' => ['pending', 'sent', 'accepted', 'rejected'],
                'default' => 'pending',
                'null' => false,
            ])
            ->changeColumn('date', 'datetime', [
                'null' => false,
            ])
            ->removeColumn('number')
            ->update();

        //
        // - Factures
        //

        $invoices = $this->table('invoices');
        $invoices
            ->changeColumn('status', 'enum', [
                'values' => ['pending', 'sent'],
                'default' => 'pending',
                'null' => false,
            ])
            ->changeColumn('number', 'string', [
                'length' => 20,
                'null' => false,
            ])
            ->changeColumn('date', 'datetime', [
                'null' => false,
            ])
            ->update();
    }
}
