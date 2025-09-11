<?php
declare(strict_types=1);

use Loxya\Config\Config;
use Phinx\Db\Adapter\MysqlAdapter;
use Phinx\Migration\AbstractMigration;

final class CreateOpeningHourTable extends AbstractMigration
{
    public function up(): void
    {
        $prefix = Config::get('db.prefix');

        $opening_hours = $this->table('opening_hours', ['signed' => true]);
        $opening_hours
            ->addColumn('weekday', 'integer', [
                'limit' => MysqlAdapter::INT_TINY,
                'signed' => false,
                'null' => false,
            ])
            ->addColumn('start_time', 'time', ['null' => false])
            ->addColumn('end_time', 'time', ['null' => false])
            ->create();

        for ($weekday = 0; $weekday <= 6; $weekday += 1) {
            $qb = $this->getInsertBuilder();
            $qb
                ->insert(['weekday', 'start_time', 'end_time'])
                ->into(sprintf('%sopening_hours', $prefix))
                ->values([
                    'weekday' => $weekday,
                    'start_time' => '00:00:00',
                    'end_time' => '24:00:00',
                ])
                ->execute();
        }
    }

    public function down(): void
    {
        $this->table('opening_hours')->drop()->save();
    }
}
