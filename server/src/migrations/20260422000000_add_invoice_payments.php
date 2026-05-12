<?php
declare(strict_types=1);

use Brick\Math\BigDecimal as Decimal;
use Loxya\Config\Config;
use Phinx\Migration\AbstractMigration;

final class AddInvoicePayments extends AbstractMigration
{
    public function up(): void
    {
        $prefix = Config::get('db.prefix');
        $now = (new \DateTimeImmutable())->format('Y-m-d H:i:s');

        $invoice_payments = $this->table('invoice_payments', ['signed' => true]);
        $invoice_payments
            ->addColumn('invoice_id', 'integer', [
                'signed' => true,
                'null' => false,
            ])
            ->addColumn('date', 'datetime', [
                'null' => false,
            ])
            ->addColumn('method', 'enum', [
                'values' => [
                    'cash',
                    'card',
                    'transfer',
                    'cheque',
                ],
                'null' => true,
                'default' => null,
            ])
            ->addColumn('taxes_breakdown', 'json', [
                'null' => true,
                'default' => null,
            ])
            ->addColumn('amount', 'decimal', [
                'precision' => 14,
                'scale' => 2,
                'null' => false,
            ])
            ->addColumn('reference', 'string', [
                'length' => 191,
                'null' => true,
                'default' => null,
            ])
            ->addTimestamps(null, false)
            ->addIndex(['invoice_id'])
            ->addForeignKey('invoice_id', 'invoices', 'id', [
                'delete' => 'CASCADE',
                'update' => 'NO_ACTION',
                'constraint' => 'fk__invoice_payments__invoice',
            ])
            ->create();

        // - On enregistre un paiement pour les factures marqués comme "payées" via un statut.
        $paidInvoices = $this->getSelectBuilder()
            ->select([
                'id',
                'date',
                'format',
                'total_with_taxes',
                'global_tax_regime',
                'total_taxes',
            ])
            ->from(sprintf('%sinvoices', $prefix))
            ->where(['status' => 'paid'])
            ->execute()->fetchAll('assoc');

        $newPayments = [];
        foreach ($paidInvoices as $invoice) {
            $totalWithTaxes = Decimal::of($invoice['total_with_taxes'])->abs();
            if ($totalWithTaxes->isNegativeOrZero()) {
                continue;
            }

            $taxesBreakdown = null;
            $hasGlobalExemption = $invoice['global_tax_regime'] !== null;
            if ((int) $invoice['format'] >= 3 && !$hasGlobalExemption) {
                $taxes = $invoice['total_taxes'] !== null
                    ? json_decode($invoice['total_taxes'], true)
                    : [];

                if (is_array($taxes) && !empty($taxes)) {
                    $breakdown = array_values(collect($taxes)->reduce(
                        static function (array $carry, array $tax) {
                            $rate = $tax['type'] === 'S'
                                ? (string) Decimal::of($tax['value'])->toScale(3)
                                : '0.000';

                            $amount = Decimal::of($tax['base']);
                            if ($tax['type'] === 'S') {
                                $amount = $amount->plus($tax['total']);
                            }

                            if (!array_key_exists($rate, $carry)) {
                                $carry[$rate] = [
                                    'rate' => $rate,
                                    'amount' => Decimal::zero()->toScale(2),
                                ];
                            }
                            $total = &$carry[$rate]['amount'];
                            $total = $total->plus($amount);

                            return $carry;
                        },
                        [],
                    ));
                    if (!empty($breakdown)) {
                        $taxesBreakdown = json_encode(array_map(
                            static fn ($tax) => array_replace($tax, [
                                'amount' => (string) $tax['amount'],
                            ]),
                            $breakdown,
                        ));
                    }
                }
            }

            $newPayments[] = [
                'invoice_id' => $invoice['id'],
                'date' => $invoice['date'] ?? $now,
                'amount' => (string) $totalWithTaxes,
                'taxes_breakdown' => $taxesBreakdown,
                'created_at' => $now,
            ];
        }
        if (!empty($newPayments)) {
            $invoice_payments
                ->insert($newPayments)
                ->saveData();
        }

        $this->getUpdateBuilder()
            ->update(sprintf('%sinvoices', $prefix))
            ->set('status', 'sent')
            ->where(['status' => 'paid'])
            ->execute();

        $invoices = $this->table('invoices');
        $invoices
            ->changeColumn('status', 'enum', [
                'values' => ['pending', 'sent'],
                'default' => 'pending',
                'null' => false,
            ])
            ->update();
    }

    public function down(): void
    {
        $prefix = Config::get('db.prefix');

        $invoices = $this->table('invoices');
        $invoices
            ->changeColumn('status', 'enum', [
                'values' => ['pending', 'sent', 'paid'],
                'default' => 'pending',
                'null' => false,
            ])
            ->update();

        // - On marque comme "payées" les factures dont la somme
        //   des paiements couvre l'intégralité du total T.T.C.
        $invoicesData = $this->getSelectBuilder()
            ->select(['id', 'total_with_taxes'])
            ->from(sprintf('%sinvoices', $prefix))
            ->execute()->fetchAll('assoc');

        foreach ($invoicesData as $invoice) {
            $total = Decimal::of($invoice['total_with_taxes'])->abs();
            if ($total->isNegativeOrZero()) {
                continue;
            }

            $payments = $this->getSelectBuilder()
                ->select(['amount'])
                ->from(sprintf('%sinvoice_payments', $prefix))
                ->where(['invoice_id' => $invoice['id']])
                ->execute()->fetchAll('assoc');

            $paid = Decimal::zero();
            foreach ($payments as $payment) {
                $paid = $paid->plus($payment['amount']);
            }
            if ($paid->isLessThan($total)) {
                continue;
            }

            $this->getUpdateBuilder()
                ->update(sprintf('%sinvoices', $prefix))
                ->set('status', 'paid')
                ->where(['id' => $invoice['id']])
                ->execute();
        }

        $this->table('invoice_payments')->drop()->save();
    }
}
