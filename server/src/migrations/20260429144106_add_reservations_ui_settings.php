<?php
declare(strict_types=1);

use Loxya\Config\Config;
use Phinx\Migration\AbstractMigration;

final class AddReservationsUiSettings extends AbstractMigration
{
    private function getData()
    {
        return [
            [
                'key' => 'reservation.defaultViewMode',
                'value' => 'tiles',
            ],
            [
                'key' => 'reservation.customGuidelines',
                'value' => null,
            ],
        ];
    }

    public function up(): void
    {
        $this
            ->table('settings')
            ->insert(self::getData())
            ->saveData();
    }

    public function down(): void
    {
        $prefix = Config::get('db.prefix');

        foreach (array_column(self::getData(), 'key') as $key) {
            $qb = $this->getDeleteBuilder();
            $qb
                ->delete(sprintf('%ssettings', $prefix))
                ->where(compact('key'))
                ->execute();
        }
    }
}
