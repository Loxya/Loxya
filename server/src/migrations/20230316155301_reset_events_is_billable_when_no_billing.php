<?php
declare(strict_types=1);

use Loxya\Config\Config;
use Loxya\Config\Enums\BillingMode;
use Phinx\Migration\AbstractMigration;

final class ResetEventsIsBillableWhenNoBilling extends AbstractMigration
{
    public function up(): void
    {
        $billingMode = Config::get('billingMode');
        if ($billingMode !== BillingMode::NONE) {
            return;
        }

        $prefix = Config::get('db.prefix');

        $qb = $this->getUpdateBuilder();
        $qb
            ->update(sprintf('%sevents', $prefix))
            ->set(['is_billable' => '0'])
            ->where(['is_billable' => '1'])
            ->execute();
    }

    public function down(): void
    {
        // - Pas de rollback pour ce fix.
    }
}
