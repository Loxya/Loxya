<?php
declare(strict_types=1);

use Loxya\Config\Config;
use Loxya\Support\Str;
use Phinx\Migration\AbstractMigration;

final class AddReferenceToReservations extends AbstractMigration
{
    public function up(): void
    {
        $prefix = Config::get('db.prefix');

        $reservations = $this->table('reservations');
        $reservations
            ->addColumn('reference', 'char', [
                'length' => 6,
                'null' => true,
                'after' => 'id',
            ])
            ->update();

        $reservationsData = $this->fetchAll(sprintf('SELECT id FROM `%sreservations`', $prefix));
        foreach (array_column($reservationsData, 'id') as $reservationId) {
            $qb = $this->getUpdateBuilder();
            $qb
                ->update(sprintf('%sreservations', $prefix))
                ->set('reference', Str::shortid())
                ->where(['id' => $reservationId])
                ->execute();
        }

        $reservations
            ->changeColumn('reference', 'char', [
                'length' => 6,
                'null' => false,
            ])
            ->addIndex(['reference'], ['unique' => true])
            ->update();

        //
        // - Estimates
        //

        $estimates = $this->table('estimates');
        $estimates
            ->addColumn('booking_reference', 'string', [
                'length' => 64,
                'null' => true,
                'after' => 'booking_title',
            ])
            ->update();

        //
        // - Invoices
        //

        $invoices = $this->table('invoices');
        $invoices
            ->addColumn('booking_reference', 'string', [
                'length' => 64,
                'null' => true,
                'after' => 'booking_title',
            ])
            ->update();
    }

    public function down(): void
    {
        $reservations = $this->table('reservations');
        $reservations
            ->removeColumn('reference')
            ->update();

        //
        // - Estimates
        //

        $estimates = $this->table('estimates');
        $estimates
            ->removeColumn('booking_reference')
            ->update();

        //
        // - Invoices
        //

        $invoices = $this->table('invoices');
        $invoices
            ->removeColumn('booking_reference')
            ->update();
    }
}
