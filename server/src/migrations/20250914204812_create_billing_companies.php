<?php
declare(strict_types=1);
use Phinx\Migration\AbstractMigration;
use function Symfony\Component\String\u;

final class CreateBillingCompanies extends AbstractMigration
{
  public function up(): void
  {
    $billingCompanies = $this->table('billing_companies', ['signed' => true]);

    $billingCompanies
      ->addColumn('name', 'string', [
        'limit' => 191,
        'null' => false,
      ])
      ->addColumn('street', 'string', [
        'limit' => 191,
        'null' => false,
      ])
      ->addColumn('postal_code', 'string', [
        'limit' => 10,
        'null' => false,
      ])
      ->addColumn('locality', 'string', [
        'limit' => 191,
        'null' => false,
      ])
      ->addColumn('country_id', 'integer', [
        'signed' => true,
        'null' => false,
      ])
      ->addColumn('phone', 'string', [
        'length' => 24,
        'null' => true,
      ])
      ->addColumn('email', 'string', [
        'length' => 191,
        'null' => true,
      ])
      ->addColumn('website', 'string', [
        'length' => 191,
        'null' => true,
      ])
      ->addColumn('vat_number', 'string', [
        'length' => 50,
        'null' => true,
      ])
      ->addColumn('code1_label', 'string', [
        'length' => 50,
        'null' => true,
      ])
      ->addColumn('code1_value', 'string', [
        'length' => 191,
        'null' => true,
      ])
      ->addColumn('code2_label', 'string', [
        'length' => 50,
        'null' => true,
      ])
      ->addColumn('code2_value', 'string', [
        'length' => 191,
        'null' => true,
      ])
      ->addColumn('logo', 'string', [
        'length' => 191,
        'null' => true,
      ])
      ->addColumn('created_at', 'datetime', [
        'null' => true,
      ])
      ->addColumn('updated_at', 'datetime', [
        'null' => true,
      ])
      ->addColumn('deleted_at', 'datetime', [
        'null' => true,
      ])
      ->addForeignKey('country_id', 'countries', 'id', [
        'delete' => 'RESTRICT',
        'update' => 'NO_ACTION',
        'constraint' => 'fk_billing_companies_countries',
      ])
      ->create();

    $events = $this->table('events');
    $events
      ->addColumn('billing_company_id', 'integer', [
        'signed' => true,
        'null' => true,
        'after' => 'request_id',
      ])
      ->addForeignKey('billing_company_id', 'billing_companies', 'id', [
        'delete' => 'SET_NULL',
        'update' => 'NO_ACTION',
        'constraint' => 'fk_events_billing_companies',
      ])
      ->addIndex(['billing_company_id'])
      ->update();

    $invoices = $this->table('invoices');
    $invoices
      ->addColumn('billing_company_id', 'integer', [
        'signed' => true,
        'null' => true,
        'after' => 'metadata',
      ])
      ->addForeignKey('billing_company_id', 'billing_companies', 'id', [
        'delete' => 'SET_NULL',
        'update' => 'NO_ACTION',
        'constraint' => 'fk_invoices_billing_companies',
      ])
      ->addIndex(['billing_company_id'])
      ->update();

    $estimates = $this->table('estimates');
    $estimates
      ->addColumn('billing_company_id', 'integer', [
        'signed' => true,
        'null' => true,
        'after' => 'metadata',
      ])
      ->addForeignKey('billing_company_id', 'billing_companies', 'id', [
        'delete' => 'SET_NULL',
        'update' => 'NO_ACTION',
        'constraint' => 'fk_estimates_billing_companies',
      ])
      ->addIndex(['billing_company_id'])
      ->update();
  }

  public function down(): void
  {
    $events = $this->table('events');
    $events
      ->dropForeignKey('billing_company_id')
      ->removeIndex(['billing_company_id'])
      ->update();
    $events
      ->removeColumn('billing_company_id')
      ->update();

    $invoices = $this->table('invoices');
    $invoices
      ->dropForeignKey('billing_company_id')
      ->removeIndex(['billing_company_id'])
      ->update();
    $invoices
      ->removeColumn('billing_company_id')
      ->update();

    $estimates = $this->table('estimates');
    $estimates
      ->dropForeignKey('billing_company_id')
      ->removeIndex(['billing_company_id'])
      ->update();
    $estimates
      ->removeColumn('billing_company_id')
      ->update();

    $this->table('billing_companies')->drop()->save();

  }

}
