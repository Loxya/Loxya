<?php
declare(strict_types=1);

use Phinx\Migration\AbstractMigration;

final class AddNewBillingFields extends AbstractMigration
{
    public function up(): void
    {
        //
        // - Sociétés
        //

        $companies = $this->table('companies');
        $companies
            ->addColumn('is_public_entity', 'boolean', [
                'null' => false,
                'default' => false,
                'after' => 'legal_name',
            ])
            ->addColumn('service_code', 'string', [
                'limit' => 50,
                'null' => true,
                'default' => null,
                'after' => 'vat_number',
            ])
            ->addColumn('invoice_identifier', 'string', [
                'length' => 125,
                'null' => true,
                'default' => null,
                'after' => 'service_code',
            ])
            ->update();

        //
        // - Devis
        //

        $estimates = $this->table('estimates');
        $estimates
            ->addColumn('buyer_is_public_entity', 'boolean', [
                'null' => false,
                'default' => false,
                'after' => 'buyer_reference',
            ])
            ->addColumn('buyer_service_code', 'string', [
                'limit' => 50,
                'null' => true,
                'default' => null,
                'after' => 'buyer_vat_number',
            ])
            ->update();

        //
        // - Factures
        //

        $invoices = $this->table('invoices');
        $invoices
            ->addColumn('seller_routing_identifier', 'string', [
                'length' => 125,
                'null' => true,
                'default' => null,
                'after' => 'seller_vat_number',
            ])
            ->addColumn('buyer_is_public_entity', 'boolean', [
                'null' => false,
                'default' => false,
                'after' => 'buyer_reference',
            ])
            ->addColumn('buyer_service_code', 'string', [
                'limit' => 50,
                'null' => true,
                'default' => null,
                'after' => 'buyer_vat_number',
            ])
            ->addColumn('buyer_routing_identifier', 'string', [
                'length' => 125,
                'null' => true,
                'default' => null,
                'after' => 'buyer_service_code',
            ])
            ->update();
    }

    public function down(): void
    {
        $companies = $this->table('companies');
        $companies
            ->removeColumn('is_public_entity')
            ->removeColumn('service_code')
            ->removeColumn('invoice_identifier')
            ->update();

        $estimates = $this->table('estimates');
        $estimates
            ->removeColumn('buyer_is_public_entity')
            ->removeColumn('buyer_service_code')
            ->update();

        $invoices = $this->table('invoices');
        $invoices
            ->removeColumn('seller_routing_identifier')
            ->removeColumn('buyer_is_public_entity')
            ->removeColumn('buyer_service_code')
            ->removeColumn('buyer_routing_identifier')
            ->update();
    }
}
