<?php
declare(strict_types=1);

use Loxya\Config\Config;
use Phinx\Migration\AbstractMigration;

final class AddEstimatesInvoicesSettings extends AbstractMigration
{
    private const DATA = [
        [
            'key' => 'estimates.customText.title',
            'value' => null,
        ],
        [
            'key' => 'estimates.customText.content',
            'value' => null,
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
            'key' => 'estimates.showTotalReplacementPrice',
            'value' => '0',
        ],
        [
            'key' => 'estimates.showTotalisableProperties',
            'value' => '0',
        ],
        [
            'key' => 'estimates.showPictures',
            'value' => '0',
        ],
        [
            'key' => 'estimates.showDescriptions',
            'value' => '0',
        ],
        [
            'key' => 'estimates.showReplacementPrices',
            'value' => '1',
        ],
        [
            'key' => 'estimates.showUnitPrices',
            'value' => '1',
        ],
        [
            'key' => 'invoices.customText.title',
            'value' => null,
        ],
        [
            'key' => 'invoices.customText.content',
            'value' => null,
        ],
        [
            'key' => 'invoices.showBookingDescription',
            'value' => '0',
        ],
        [
            'key' => 'invoices.showMobilizationPeriod',
            'value' => '0',
        ],
        [
            'key' => 'invoices.showTotalReplacementPrice',
            'value' => '0',
        ],
        [
            'key' => 'invoices.showTotalisableProperties',
            'value' => '0',
        ],
        [
            'key' => 'invoices.showPictures',
            'value' => '0',
        ],
        [
            'key' => 'invoices.showDescriptions',
            'value' => '0',
        ],
        [
            'key' => 'invoices.showReplacementPrices',
            'value' => '1',
        ],
        [
            'key' => 'invoices.showUnitPrices',
            'value' => '1',
        ],
    ];

    public function up(): void
    {
        $this
            ->table('settings')
            ->insert(self::DATA)
            ->saveData();
    }

    public function down(): void
    {
        $prefix = Config::get('db.prefix');

        foreach (array_column(self::DATA, 'key') as $key) {
            $qb = $this->getDeleteBuilder();
            $qb
                ->delete(sprintf('%ssettings', $prefix))
                ->where(compact('key'))
                ->execute();
        }
    }
}
