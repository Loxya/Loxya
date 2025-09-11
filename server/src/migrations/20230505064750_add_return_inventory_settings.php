<?php
declare(strict_types=1);

use Loxya\Config\Config;
use Phinx\Migration\AbstractMigration;

final class AddReturnInventorySettings extends AbstractMigration
{
    public function up(): void
    {
        $data = [
            'key' => 'returnInventory.mode',
            'value' => 'start-empty',
        ];
        $this->table('settings')->insert($data)->save();
    }

    public function down(): void
    {
        $prefix = Config::get('db.prefix');

        $qb = $this->getDeleteBuilder();
        $qb
            ->delete(sprintf('%ssettings', $prefix))
            ->where(['key' => 'returnInventory.mode'])
            ->execute();
    }
}
