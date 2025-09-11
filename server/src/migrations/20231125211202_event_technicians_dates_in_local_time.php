<?php
declare(strict_types=1);

use Carbon\Carbon;
use Loxya\Config\Config;
use Phinx\Migration\AbstractMigration;

final class EventTechniciansDatesInLocalTime extends AbstractMigration
{
    public function up(): void
    {
        $prefix = Config::get('db.prefix');
        $data = $this->fetchAll(sprintf(
            'SELECT `id`, `start_time`, `end_time` FROM `%1$sevent_technicians`',
            $prefix,
        ));
        foreach ($data as $eventTechnicianData) {
            $startTime = Carbon::createFromFormat('Y-m-d H:i:s', $eventTechnicianData['start_time'], 'UTC')
                ->setTimezone(date_default_timezone_get())
                ->format('Y-m-d H:i:s');

            $endTime = Carbon::createFromFormat('Y-m-d H:i:s', $eventTechnicianData['end_time'], 'UTC')
                ->setTimezone(date_default_timezone_get())
                ->format('Y-m-d H:i:s');

            $qb = $this->getUpdateBuilder();
            $qb
                ->update(sprintf('%sevent_technicians', $prefix))
                ->set('start_time', $startTime)
                ->set('end_time', $endTime)
                ->where(['id' => $eventTechnicianData['id']])
                ->execute();
        }
    }

    public function down(): void
    {
        $prefix = Config::get('db.prefix');
        $data = $this->fetchAll(sprintf(
            'SELECT `id`, `start_time`, `end_time` FROM `%1$sevent_technicians`',
            $prefix,
        ));
        foreach ($data as $eventTechnicianData) {
            $startTime = Carbon::createFromFormat('Y-m-d H:i:s', $eventTechnicianData['start_time'])
                ->setTimezone('UTC')
                ->format('Y-m-d H:i:s');

            $endTime = Carbon::createFromFormat('Y-m-d H:i:s', $eventTechnicianData['end_time'])
                ->setTimezone('UTC')
                ->format('Y-m-d H:i:s');

            $qb = $this->getUpdateBuilder();
            $qb
                ->update(sprintf('%sevent_technicians', $prefix))
                ->set('start_time', $startTime)
                ->set('end_time', $endTime)
                ->where(['id' => $eventTechnicianData['id']])
                ->execute();
        }
    }
}
