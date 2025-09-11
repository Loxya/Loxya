<?php
declare(strict_types=1);

use Loxya\Config\Config;
use Phinx\Migration\AbstractMigration;

final class AddEventSummaryDisplaySettings extends AbstractMigration
{
    public function up(): void
    {
        $data = [
            [
                'key' => 'eventSummary.showReplacementPrices',
                'value' => '1',
            ],
            [
                'key' => 'eventSummary.showDescriptions',
                'value' => '0',
            ],
            [
                'key' => 'eventSummary.showTags',
                'value' => '0',
            ],
            [
                'key' => 'eventSummary.showUnitsSerialNumbers',
                'value' => '0',
            ],
            [
                'key' => 'eventSummary.showPictures',
                'value' => '0',
            ],
        ];
        $this->table('settings')->insert($data)->saveData();
    }

    public function down(): void
    {
        $prefix = Config::get('db.prefix');

        $keys = [
            'eventSummary.showReplacementPrices',
            'eventSummary.showDescriptions',
            'eventSummary.showTags',
            'eventSummary.showUnitsSerialNumbers',
            'eventSummary.showPictures',
        ];
        foreach ($keys as $key) {
            $qb = $this->getDeleteBuilder();
            $qb
                ->delete(sprintf('%ssettings', $prefix))
                ->where(compact('key'))
                ->execute();
        }
    }
}
