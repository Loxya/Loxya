<?php
declare(strict_types=1);

use Loxya\Config\Config;
use Phinx\Migration\AbstractMigration;

final class AddNewSetting extends AbstractMigration
{
    public function up(): void
    {
        $data = [
            'key' => 'eventSummary.showLegalNumbers',
            'value' => '1',
        ];
        $this->table('settings')->insert($data)->saveData();
    }

    public function down(): void
    {
        $prefix = Config::get('db.prefix');

        $qb = $this->getDeleteBuilder();
        $qb
            ->delete(sprintf('%ssettings', $prefix))
            ->where(['key' => 'eventSummary.showLegalNumbers'])
            ->execute();
    }
}
