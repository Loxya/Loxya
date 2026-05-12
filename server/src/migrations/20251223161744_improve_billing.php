<?php
declare(strict_types=1);

use Loxya\Config\Config;
use Phinx\Migration\AbstractMigration;

final class ImproveBilling extends AbstractMigration
{
    public function up(): void
    {
        $prefix = Config::get('db.prefix');
        $defaultLang = Config::get('defaultLang');

        //
        // - Devis
        //

        $estimates = $this->table('estimates');
        $estimates
            ->addColumn('status', 'enum', [
                'values' => ['pending', 'sent', 'accepted', 'rejected'],
                'default' => 'pending',
                'null' => false,
                'after' => 'uuid',
            ])
            ->addColumn('due_date', 'date', [
                'null' => true,
                'after' => 'date',
            ])
            ->addColumn('lang', 'char', [
                'after' => 'currency',
                'limit' => 2,
                'null' => true,
                'default' => null,
            ])
            ->update();

        $estimatesData = $this->getSelectBuilder()
            ->select([
                'estimate.id',
                'user.language',
            ])
            ->from(['estimate' => sprintf('%sestimates', $prefix)])
            ->leftJoin(
                ['beneficiary' => sprintf('%sbeneficiaries', $prefix)],
                'estimate.beneficiary_id = beneficiary.id',
            )
            ->leftJoin(
                ['person' => sprintf('%spersons', $prefix)],
                'beneficiary.person_id = person.id',
            )
            ->leftJoin(
                ['user' => sprintf('%susers', $prefix)],
                'person.user_id = user.id',
            )
            ->execute()->fetchAll('assoc');

        foreach ($estimatesData as $datum) {
            $qb = $this->getUpdateBuilder();
            $qb
                ->update(sprintf('%sestimates', $prefix))
                ->set('lang', $datum['language'] ?? $defaultLang)
                ->where(['id' => $datum['id']])
                ->execute();
        }

        // - Marque les devis existants comme "envoyés".
        $this->getUpdateBuilder()
            ->update(sprintf('%sestimates', $prefix))
            ->set('status', 'sent')
            ->execute();

        $estimates
            ->changeColumn('lang', 'char', [
                'limit' => 2,
                'null' => false,
            ])
            ->update();

        //
        // - Factures
        //

        $invoices = $this->table('invoices');
        $invoices
            ->addColumn('status', 'enum', [
                'values' => ['pending', 'sent', 'paid'],
                'default' => 'pending',
                'null' => false,
                'after' => 'uuid',
            ])
            ->addColumn('due_date', 'date', [
                'null' => true,
                'after' => 'date',
            ])
            ->addColumn('lang', 'char', [
                'after' => 'currency',
                'limit' => 2,
                'null' => true,
                'default' => null,
            ])
            ->update();

        $invoicesData = $this->getSelectBuilder()
            ->select([
                'invoice.id',
                'user.language',
            ])
            ->from(['invoice' => sprintf('%sinvoices', $prefix)])
            ->leftJoin(
                ['beneficiary' => sprintf('%sbeneficiaries', $prefix)],
                'invoice.beneficiary_id = beneficiary.id',
            )
            ->leftJoin(
                ['person' => sprintf('%spersons', $prefix)],
                'beneficiary.person_id = person.id',
            )
            ->leftJoin(
                ['user' => sprintf('%susers', $prefix)],
                'person.user_id = user.id',
            )
            ->execute()->fetchAll('assoc');

        foreach ($invoicesData as $datum) {
            $qb = $this->getUpdateBuilder();
            $qb
                ->update(sprintf('%sinvoices', $prefix))
                ->set('lang', $datum['language'] ?? $defaultLang)
                ->where(['id' => $datum['id']])
                ->execute();
        }

        // - Marque les factures existantes comme "envoyées".
        $this->getUpdateBuilder()
            ->update(sprintf('%sinvoices', $prefix))
            ->set('status', 'sent')
            ->execute();

        $invoices
            ->changeColumn('lang', 'char', [
                'limit' => 2,
                'null' => false,
            ])
            ->update();
    }

    public function down(): void
    {
        $estimates = $this->table('estimates');
        $estimates
            ->removeColumn('status')
            ->removeColumn('due_date')
            ->removeColumn('lang')
            ->update();

        $invoices = $this->table('invoices');
        $invoices
            ->removeColumn('status')
            ->removeColumn('due_date')
            ->removeColumn('lang')
            ->update();
    }
}
