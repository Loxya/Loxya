<?php
declare(strict_types=1);

use Loxya\Config\Config;
use Phinx\Migration\AbstractMigration;

final class RemoveShowUnitPricesSetting extends AbstractMigration
{
    public function up(): void
    {
        $prefix = Config::get('db.prefix');

        $qb = $this->getDeleteBuilder();
        $qb
            ->delete(sprintf('%ssettings', $prefix))
            ->whereInList('key', [
                'estimates.showUnitPrices',
                'invoices.showUnitPrices',
            ])
            ->execute();
    }

    public function down(): void
    {
        $this
            ->table('settings')
            ->insert([
                [
                    'key' => 'estimates.showUnitPrices',
                    'value' => '1',
                ],
                [
                    'key' => 'invoices.showUnitPrices',
                    'value' => '1',
                ],
            ])
            ->saveData();
    }
}
