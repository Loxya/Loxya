<?php
declare(strict_types=1);

use Loxya\Config\Config;
use Phinx\Migration\AbstractMigration;

final class MakeBookingOptionalInBilling extends AbstractMigration
{
    public function up(): void
    {
        //
        // - Devis
        //

        $estimates = $this->table('estimates');
        $estimates
            ->changeColumn('booking_type', 'enum', [
                'values' => ['event', 'reservation'],
                'null' => true,
                'default' => null,
            ])
            ->changeColumn('booking_id', 'integer', [
                'signed' => true,
                'null' => true,
            ])
            ->changeColumn('booking_start_date', 'datetime', [
                'null' => true,
            ])
            ->changeColumn('booking_end_date', 'datetime', [
                'null' => true,
            ])
            ->changeColumn('booking_is_full_days', 'boolean', [
                'null' => true,
                'default' => null,
            ])
            ->update();

        //
        // - Factures
        //

        $invoices = $this->table('invoices');
        $invoices
            ->changeColumn('booking_type', 'enum', [
                'values' => ['event', 'reservation'],
                'null' => true,
                'default' => null,
            ])
            ->changeColumn('booking_id', 'integer', [
                'signed' => true,
                'null' => true,
            ])
            ->changeColumn('booking_start_date', 'datetime', [
                'null' => true,
            ])
            ->changeColumn('booking_end_date', 'datetime', [
                'null' => true,
            ])
            ->changeColumn('booking_is_full_days', 'boolean', [
                'null' => true,
                'default' => null,
            ])
            ->update();
    }

    public function down(): void
    {
        $prefix = Config::get('db.prefix');

        $unlinkedInvoices = $this->fetchAll(
            sprintf('SELECT `id` FROM `%sinvoices` WHERE `booking_type` IS NULL LIMIT 1', $prefix),
        );
        $unlinkedEstimates = $this->fetchAll(
            sprintf('SELECT `id` FROM `%sestimates` WHERE `booking_type` IS NULL LIMIT 1', $prefix),
        );
        if (count($unlinkedInvoices) > 0 || count($unlinkedEstimates) > 0) {
            throw new \RuntimeException(
                "Unable to rollback the migration: invoices or estimates without a linked " .
                "booking exist. Please delete or link them before rolling back.",
            );
        }

        //
        // - Devis
        //

        $estimates = $this->table('estimates');
        $estimates
            ->changeColumn('booking_type', 'enum', [
                'values' => ['event', 'reservation'],
                'null' => false,
            ])
            ->changeColumn('booking_id', 'integer', [
                'signed' => true,
                'null' => false,
            ])
            ->changeColumn('booking_start_date', 'datetime', [
                'null' => false,
            ])
            ->changeColumn('booking_end_date', 'datetime', [
                'null' => false,
            ])
            ->changeColumn('booking_is_full_days', 'boolean', [
                'null' => false,
                'default' => false,
            ])
            ->update();

        //
        // - Factures
        //

        $invoices = $this->table('invoices');
        $invoices
            ->changeColumn('booking_type', 'enum', [
                'values' => ['event', 'reservation'],
                'null' => false,
            ])
            ->changeColumn('booking_id', 'integer', [
                'signed' => true,
                'null' => false,
            ])
            ->changeColumn('booking_start_date', 'datetime', [
                'null' => false,
            ])
            ->changeColumn('booking_end_date', 'datetime', [
                'null' => false,
            ])
            ->changeColumn('booking_is_full_days', 'boolean', [
                'null' => false,
                'default' => false,
            ])
            ->update();
    }
}
