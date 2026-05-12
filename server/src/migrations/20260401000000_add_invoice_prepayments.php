<?php
declare(strict_types=1);

use Phinx\Migration\AbstractMigration;

final class AddInvoicePrepayments extends AbstractMigration
{
    public function up(): void
    {
        $invoice_prepayments = $this->table('invoice_prepayments', ['signed' => true]);
        $invoice_prepayments
            ->addColumn('invoice_id', 'integer', [
                'signed' => true,
                'null' => false,
            ])
            ->addColumn('prepayment_invoice_id', 'integer', [
                'signed' => true,
                'null' => false,
            ])
            ->addIndex(['invoice_id'])
            ->addIndex(['prepayment_invoice_id'])
            ->addForeignKey('invoice_id', 'invoices', 'id', [
                'delete' => 'CASCADE',
                'update' => 'NO_ACTION',
                'constraint' => 'fk__invoice_prepayments__invoice',
            ])
            ->addForeignKey('prepayment_invoice_id', 'invoices', 'id', [
                'delete' => 'RESTRICT',
                'update' => 'NO_ACTION',
                'constraint' => 'fk__invoice_prepayments__prepayment_invoice',
            ])
            ->create();
    }

    public function down(): void
    {
        $this->table('invoice_prepayments')->drop()->save();
    }
}
