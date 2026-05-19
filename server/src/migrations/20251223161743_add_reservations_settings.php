<?php
declare(strict_types=1);

use Loxya\Config\Config;
use Phinx\Migration\AbstractMigration;

final class AddReservationsSettings extends AbstractMigration
{
    private const DATA = [
        [
            'key' => 'reservation.notificationsMode',
            'value' => 'both',
        ],
        [
            'key' => 'reservation.isLocationMandatory',
            'value' => '0',
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
