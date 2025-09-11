<?php
declare(strict_types=1);

use Illuminate\Support\Carbon;
use Loxya\Config\Config;
use Phinx\Migration\AbstractMigration;

final class AddHourlyEventSupport extends AbstractMigration
{
    public function up(): void
    {
        $prefix = Config::get('db.prefix');

        //
        // - Settings.
        //

        $data = [
            [
                'key' => 'reservation.isFullDays',
                'value' => '1',
            ],
            [
                'key' => 'calendar.public.displayedPeriod',
                'value' => 'operation',
            ],
        ];
        $this->table('settings')->insert($data)->saveData();

        //
        // - Événements.
        //

        $events = $this->table('events');
        $events
            ->addColumn('is_full_days', 'boolean', [
                'default' => false,
                'null' => false,
                'after' => 'end_date',
            ])
            ->update();

        // - Ajuste l'heure de fin des événements.
        $data = $this->fetchAll(sprintf(
            'SELECT `id`, `start_date`, `end_date` FROM `%1$sevents`',
            $prefix,
        ));
        foreach ($data as $datum) {
            $startDate = (new Carbon($datum['start_date']))
                ->startOfDay()
                ->format('Y-m-d H:i:s');

            $endDate = (new Carbon($datum['end_date']))
                ->add(new \DateInterval('P1D'))
                ->startOfDay()
                ->format('Y-m-d H:i:s');

            $qb = $this->getUpdateBuilder();
            $qb
                ->update(sprintf('%sevents', $prefix))
                ->set('start_date', $startDate)
                ->set('end_date', $endDate)
                ->set('is_full_days', true)
                ->where(['id' => $datum['id']])
                ->execute();
        }

        //
        // - Devis
        //

        $estimates = $this->table('estimates');
        $estimates
            ->addColumn('booking_is_full_days', 'boolean', [
                'default' => false,
                'null' => false,
                'after' => 'booking_end_date',
            ])
            ->update();

        // - Ajuste l'heure de fin des événements.
        $data = $this->fetchAll(sprintf(
            'SELECT `id`, `booking_start_date`, `booking_end_date` FROM `%1$sestimates`',
            $prefix,
        ));
        foreach ($data as $datum) {
            $startDate = (new Carbon($datum['booking_start_date']))
                ->startOfDay()
                ->format('Y-m-d H:i:s');

            $endDate = (new Carbon($datum['booking_end_date']))
                ->add(new \DateInterval('P1D'))
                ->startOfDay()
                ->format('Y-m-d H:i:s');

            $qb = $this->getUpdateBuilder();
            $qb
                ->update(sprintf('%sestimates', $prefix))
                ->set('booking_start_date', $startDate)
                ->set('booking_end_date', $endDate)
                ->set('booking_is_full_days', true)
                ->where(['id' => $datum['id']])
                ->execute();
        }

        //
        // - Factures
        //

        $invoices = $this->table('invoices');
        $invoices
            ->addColumn('booking_is_full_days', 'boolean', [
                'default' => false,
                'null' => false,
                'after' => 'booking_end_date',
            ])
            ->update();

        // - Ajuste l'heure de fin des événements.
        $data = $this->fetchAll(sprintf(
            'SELECT `id`, `booking_start_date`, `booking_end_date` FROM `%1$sinvoices`',
            $prefix,
        ));
        foreach ($data as $datum) {
            $startDate = (new Carbon($datum['booking_start_date']))
                ->startOfDay()
                ->format('Y-m-d H:i:s');

            $endDate = (new Carbon($datum['booking_end_date']))
                ->add(new \DateInterval('P1D'))
                ->startOfDay()
                ->format('Y-m-d H:i:s');

            $qb = $this->getUpdateBuilder();
            $qb
                ->update(sprintf('%sinvoices', $prefix))
                ->set('booking_start_date', $startDate)
                ->set('booking_end_date', $endDate)
                ->set('booking_is_full_days', true)
                ->where(['id' => $datum['id']])
                ->execute();
        }

        //
        // - Réservations.
        //

        $reservations = $this->table('reservations');
        $reservations
            ->changeColumn('start_date', 'datetime', [
                'null' => false,
            ])
            ->changeColumn('end_date', 'datetime', [
                'null' => false,
            ])
            ->addColumn('is_full_days', 'boolean', [
                'null' => false,
                'default' => false,
                'after' => 'end_date',
            ])
            ->update();

        // - Ajuste l'heure de début des réservations (qui n'avaient pas d'heure jusque là).
        $data = $this->fetchAll(sprintf(
            'SELECT `id`, `start_date`, `end_date` FROM `%1$sreservations`',
            $prefix,
        ));
        foreach ($data as $datum) {
            $startDate = (new Carbon($datum['start_date']))
                ->startOfDay()
                ->format('Y-m-d H:i:s');

            $endDate = (new Carbon($datum['end_date']))
                ->add(new \DateInterval('P1D'))
                ->startOfDay()
                ->format('Y-m-d H:i:s');

            $qb = $this->getUpdateBuilder();
            $qb
                ->update(sprintf('%sreservations', $prefix))
                ->set('start_date', $startDate)
                ->set('end_date', $endDate)
                ->set('is_full_days', true)
                ->where(['id' => $datum['id']])
                ->execute();
        }

        //
        // - Paniers.
        //

        $carts = $this->table('carts');
        $carts
            ->changeColumn('reservation_start_date', 'datetime', [
                'null' => false,
            ])
            ->changeColumn('reservation_end_date', 'datetime', [
                'null' => false,
            ])
            ->update();

        // - Ajuste l'heure de début des réservations panier (qui n'avaient pas d'heure jusque là).
        $data = $this->fetchAll(sprintf(
            'SELECT `id`, `reservation_start_date`, `reservation_end_date` FROM `%1$scarts`',
            $prefix,
        ));
        foreach ($data as $datum) {
            $startDate = (new Carbon($datum['reservation_start_date']))
                ->startOfDay()
                ->format('Y-m-d H:i:s');

            $endDate = (new Carbon($datum['reservation_end_date']))
                ->add(new \DateInterval('P1D'))
                ->startOfDay()
                ->format('Y-m-d H:i:s');

            $qb = $this->getUpdateBuilder();
            $qb
                ->update(sprintf('%scarts', $prefix))
                ->set('reservation_start_date', $startDate)
                ->set('reservation_end_date', $endDate)
                ->where(['id' => $datum['id']])
                ->execute();
        }
    }

    public function down(): void
    {
        $prefix = Config::get('db.prefix');

        //
        // - Settings.
        //

        $qb = $this->getDeleteBuilder();
        $qb
            ->delete(sprintf('%ssettings', $prefix))
            ->where(static fn ($exp) => (
                $exp->in('key', [
                    'reservation.isFullDays',
                    'calendar.public.displayedPeriod',
                ])
            ))
            ->execute();

        //
        // - Événements.
        //

        $events = $this->table('events');
        $events
            ->removeColumn('is_full_days')
            ->update();

        $data = $this->fetchAll(sprintf('SELECT * FROM `%1$sevents`', $prefix));
        foreach ($data as $datum) {
            $startDate = Carbon::parse($datum['start_date'])
                ->startOfDay();

            $endDate = Carbon::parse($datum['end_date'])
                ->when(
                    static fn (Carbon $date) => $date->isStartOfDay(),
                    static fn (Carbon $date) => (
                        $date->sub(new \DateInterval('P1D'))
                    ),
                )
                ->setTime(23, 59, 59);

            $qb = $this->getUpdateBuilder();
            $qb
                ->update(sprintf('%sevents', $prefix))
                ->set('start_date', $startDate->format('Y-m-d H:i:s'))
                ->set('end_date', $endDate->format('Y-m-d H:i:s'))
                ->where(['id' => $datum['id']])
                ->execute();
        }

        //
        // - Devis.
        //

        $estimates = $this->table('estimates');
        $estimates
            ->removeColumn('booking_is_full_days')
            ->update();

        $data = $this->fetchAll(sprintf('SELECT * FROM `%1$sestimates`', $prefix));
        foreach ($data as $datum) {
            $startDate = Carbon::parse($datum['booking_start_date'])
                ->startOfDay();

            $endDate = Carbon::parse($datum['booking_end_date'])
                ->when(
                    static fn (Carbon $date) => $date->isStartOfDay(),
                    static fn (Carbon $date) => (
                        $date->sub(new \DateInterval('P1D'))
                    ),
                )
                ->setTime(23, 59, 59);

            $qb = $this->getUpdateBuilder();
            $qb
                ->update(sprintf('%sestimates', $prefix))
                ->set('booking_start_date', $startDate->format('Y-m-d H:i:s'))
                ->set('booking_end_date', $endDate->format('Y-m-d H:i:s'))
                ->where(['id' => $datum['id']])
                ->execute();
        }

        //
        // - Factures.
        //

        $invoices = $this->table('invoices');
        $invoices
            ->removeColumn('booking_is_full_days')
            ->update();

        $data = $this->fetchAll(sprintf('SELECT * FROM `%1$sinvoices`', $prefix));
        foreach ($data as $datum) {
            $startDate = Carbon::parse($datum['booking_start_date'])
                ->startOfDay();

            $endDate = Carbon::parse($datum['booking_end_date'])
                ->when(
                    static fn (Carbon $date) => $date->isStartOfDay(),
                    static fn (Carbon $date) => (
                        $date->sub(new \DateInterval('P1D'))
                    ),
                )
                ->setTime(23, 59, 59);

            $qb = $this->getUpdateBuilder();
            $qb
                ->update(sprintf('%sinvoices', $prefix))
                ->set('booking_start_date', $startDate->format('Y-m-d H:i:s'))
                ->set('booking_end_date', $endDate->format('Y-m-d H:i:s'))
                ->where(['id' => $datum['id']])
                ->execute();
        }

        //
        // - Réservations.
        //

        $reservations = $this->table('reservations');
        $reservations
            ->changeColumn('start_date', 'date', [
                'null' => false,
            ])
            ->changeColumn('end_date', 'date', [
                'null' => false,
            ])
            ->removeColumn('is_full_days')
            ->update();

        $data = $this->fetchAll(sprintf('SELECT * FROM `%1$sreservations`', $prefix));
        foreach ($data as $datum) {
            $startDate = Carbon::parse($datum['start_date'])
                ->startOfDay();

            $endDate = Carbon::parse($datum['end_date'])
                ->when(
                    static fn (Carbon $date) => $date->isStartOfDay(),
                    static fn (Carbon $date) => (
                        $date->sub(new \DateInterval('P1D'))
                    ),
                )
                ->setTime(23, 59, 59);

            $qb = $this->getUpdateBuilder();
            $qb
                ->update(sprintf('%sreservations', $prefix))
                ->set('start_date', $startDate->format('Y-m-d'))
                ->set('end_date', $endDate->format('Y-m-d'))
                ->where(['id' => $datum['id']])
                ->execute();
        }

        //
        // - Paniers.
        //

        $carts = $this->table('carts');
        $carts
            ->changeColumn('reservation_start_date', 'date', [
                'null' => false,
            ])
            ->changeColumn('reservation_end_date', 'date', [
                'null' => false,
            ])
            ->update();

        $data = $this->fetchAll(sprintf('SELECT * FROM `%1$scarts`', $prefix));
        foreach ($data as $datum) {
            $startDate = Carbon::parse($datum['reservation_start_date'])
                ->startOfDay();

            $endDate = Carbon::parse($datum['reservation_end_date'])
                ->when(
                    static fn (Carbon $date) => $date->isStartOfDay(),
                    static fn (Carbon $date) => (
                        $date->sub(new \DateInterval('P1D'))
                    ),
                )
                ->setTime(23, 59, 59);

            $qb = $this->getUpdateBuilder();
            $qb
                ->update(sprintf('%scarts', $prefix))
                ->set('reservation_start_date', $startDate->format('Y-m-d'))
                ->set('reservation_end_date', $endDate->format('Y-m-d'))
                ->where(['id' => $datum['id']])
                ->execute();
        }
    }
}
