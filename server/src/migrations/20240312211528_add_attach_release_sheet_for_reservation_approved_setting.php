<?php
declare(strict_types=1);

use Loxya\Config\Config;
use Phinx\Migration\AbstractMigration;

final class AddAttachReleaseSheetForReservationApprovedSetting extends AbstractMigration
{
    public function up(): void
    {
        $data = [
            'key' => 'reservation.attachReleaseSheet',
            'value' => '0',
        ];
        $this->table('settings')->insert($data)->save();
    }

    public function down(): void
    {
        $prefix = Config::get('db.prefix');

        $qb = $this->getDeleteBuilder();
        $qb
            ->delete(sprintf('%ssettings', $prefix))
            ->where(['key' => 'reservation.attachReleaseSheet'])
            ->execute();
    }
}
