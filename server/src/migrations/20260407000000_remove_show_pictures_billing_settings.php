<?php
declare(strict_types=1);

use Loxya\Config\Config;
use Phinx\Migration\AbstractMigration;

final class RemoveShowPicturesBillingSettings extends AbstractMigration
{
    public function up(): void
    {
        $prefix = Config::get('db.prefix');

        $qb = $this->getDeleteBuilder();
        $qb
            ->delete(sprintf('%ssettings', $prefix))
            ->whereInList('key', [
                'estimates.showPictures',
                'estimates.showBookingDescription',
                'estimates.showMobilizationPeriod',
                'invoices.showPictures',
                'invoices.showBookingDescription',
                'invoices.showMobilizationPeriod',
            ])
            ->execute();
    }

    public function down(): void
    {
        $this
            ->table('settings')
            ->insert([
                [
                    'key' => 'estimates.showPictures',
                    'value' => '0',
                ],
                [
                    'key' => 'estimates.showBookingDescription',
                    'value' => '0',
                ],
                [
                    'key' => 'estimates.showMobilizationPeriod',
                    'value' => '0',
                ],
                [
                    'key' => 'invoices.showPictures',
                    'value' => '0',
                ],
                [
                    'key' => 'invoices.showBookingDescription',
                    'value' => '0',
                ],
                [
                    'key' => 'invoices.showMobilizationPeriod',
                    'value' => '0',
                ],
            ])
            ->saveData();
    }
}
