<?php
declare(strict_types=1);

use Loxya\Config\Config;
use Phinx\Migration\AbstractMigration;

final class ReplaceBillingIsLegacyWithFormat extends AbstractMigration
{
    public function up(): void
    {
        $prefix = Config::get('db.prefix');

        //
        // - Factures
        //

        $invoices = $this->table('invoices');
        $invoices
            ->addColumn('format', 'smallinteger', [
                'signed' => false,
                'null' => false,
                'default' => 3,
                'after' => 'uuid',
            ])
            ->update();

        $this->execute(sprintf(
            'UPDATE `%1$sinvoices` SET `format` = 1 WHERE `is_legacy` = 1',
            $prefix,
        ));
        $this->execute(sprintf(
            'UPDATE `%1$sinvoices` SET `format` = 2 WHERE `is_legacy` = 0',
            $prefix,
        ));

        $invoices
            ->removeColumn('is_legacy')
            ->update();

        //
        // - Devis
        //

        $estimates = $this->table('estimates');
        $estimates
            ->addColumn('format', 'smallinteger', [
                'signed' => false,
                'null' => false,
                'default' => 3,
                'after' => 'uuid',
            ])
            ->update();

        $this->execute(sprintf(
            'UPDATE `%1$sestimates` SET `format` = 1 WHERE `is_legacy` = 1',
            $prefix,
        ));
        $this->execute(sprintf(
            'UPDATE `%1$sestimates` SET `format` = 2 WHERE `is_legacy` = 0',
            $prefix,
        ));

        $estimates
            ->removeColumn('is_legacy')
            ->update();
    }

    public function down(): void
    {
        $prefix = Config::get('db.prefix');

        //
        // - Factures
        //

        $invoices = $this->table('invoices');
        $invoices
            ->addColumn('is_legacy', 'boolean', [
                'default' => false,
                'null' => false,
                'after' => 'booking_is_full_days',
            ])
            ->update();

        $this->execute(sprintf(
            'UPDATE `%1$sinvoices` SET `is_legacy` = 1 WHERE `format` = 1',
            $prefix,
        ));

        $invoices
            ->removeColumn('format')
            ->update();

        //
        // - Devis
        //

        $estimates = $this->table('estimates');
        $estimates
            ->addColumn('is_legacy', 'boolean', [
                'default' => false,
                'null' => false,
                'after' => 'booking_is_full_days',
            ])
            ->update();

        $this->execute(sprintf(
            'UPDATE `%1$sestimates` SET `is_legacy` = 1 WHERE `format` = 1',
            $prefix,
        ));

        $estimates
            ->removeColumn('format')
            ->update();
    }
}
