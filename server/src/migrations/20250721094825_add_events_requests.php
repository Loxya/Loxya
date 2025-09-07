<?php
declare(strict_types=1);

use Loxya\Config\Config;
use Phinx\Migration\AbstractMigration;

final class AddEventsRequests extends AbstractMigration
{
    public function up(): void
    {
        $this
            ->table('settings')
            ->insert([
                'key' => 'reservation.destination',
                'value' => 'reservation',
            ])
            ->saveData();

        $requests = $this->table('requests');
        $requests
            ->addColumn('is_event', 'boolean', [
                'default' => false,
                'after' => 'is_billable',
            ])
            ->addColumn('title', 'string', [
                'length' => 191,
                'default' => null,
                'null' => true,
                'after' => 'is_event',
            ])
            ->addColumn('location', 'string', [
                'length' => 64,
                'default' => null,
                'null' => true,
                'after' => 'title',
            ])
            ->update();

        $events = $this->table('events');
        $events
            ->addColumn('request_id', 'integer', [
                'signed' => true,
                'null' => true,
                'after' => 'reference',
            ])
            ->addIndex(['request_id'])
            ->addForeignKey('request_id', 'requests', 'id', [
                'delete' => 'SET_NULL',
                'update' => 'NO_ACTION',
                'constraint' => 'fk__event__request',
            ])
            ->update();
    }

    public function down(): void
    {
        $events = $this->table('events');
        $events
            ->dropForeignKey('request_id')
            ->removeIndex(['request_id'])
            ->update();
        $events
            ->removeColumn('request_id')
            ->update();

        $requests = $this->table('requests');
        $requests
            ->removeColumn('is_event')
            ->removeColumn('title')
            ->removeColumn('location')
            ->update();

        $prefix = Config::get('db.prefix');

        $qb = $this->getDeleteBuilder();
        $qb
            ->delete(sprintf('%ssettings', $prefix))
            ->where(['key' => 'reservation.destination'])
            ->execute();
    }
}
