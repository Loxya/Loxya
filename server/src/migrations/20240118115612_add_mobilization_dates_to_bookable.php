<?php
declare(strict_types=1);

use Carbon\CarbonImmutable;
use Loxya\Config\Config;
use Phinx\Migration\AbstractMigration;

final class AddMobilizationDatesToBookable extends AbstractMigration
{
    public function up(): void
    {
        $prefix = Config::get('db.prefix');

        //
        // - Événements.
        //

        $events = $this->table('events');
        $events
            ->addColumn('mobilization_start_date', 'datetime', [
                'null' => true,
                'after' => 'reference',
            ])
            ->addColumn('mobilization_end_date', 'datetime', [
                'null' => true,
                'after' => 'mobilization_start_date',
            ])
            ->renameColumn('start_date', 'operation_start_date')
            ->renameColumn('end_date', 'operation_end_date')
            ->renameColumn('is_full_days', 'operation_is_full_days')
            ->update();

        // - Enregistre les dates de mobilisation des événements.
        $data = $this->fetchAll(sprintf('SELECT * FROM `%1$sevents`', $prefix));
        foreach ($data as $datum) {
            $operationStartDate = CarbonImmutable::parse($datum['operation_start_date']);
            $operationEndDate = CarbonImmutable::parse($datum['operation_end_date']);

            $isDepartureInventoryDone = (bool) $datum['is_departure_inventory_done'];
            $isReturnInventoryDone = (bool) $datum['is_return_inventory_done'];

            $mobilizationStartDate = $operationStartDate;
            if ($isDepartureInventoryDone) {
                $departureInventoryDate = $datum['departure_inventory_datetime'] !== null
                    ? CarbonImmutable::parse($datum['departure_inventory_datetime'])->roundMinutes(15, 'ceil')
                    : null;

                if ($departureInventoryDate?->isBefore($operationStartDate)) {
                    $mobilizationStartDate = $departureInventoryDate;
                }
            }

            $mobilizationEndDate = $operationEndDate;
            if ($isReturnInventoryDone) {
                $returnInventoryDate = $datum['return_inventory_datetime'] !== null
                    ? CarbonImmutable::parse($datum['return_inventory_datetime'])->roundMinutes(15, 'ceil')
                    : null;

                if ($returnInventoryDate?->isBetween($operationStartDate, $operationEndDate)) {
                    $mobilizationEndDate = $returnInventoryDate;
                }
            }

            $qb = $this->getUpdateBuilder();
            $qb
                ->update(sprintf('%sevents', $prefix))
                ->set('mobilization_start_date', $mobilizationStartDate->format('Y-m-d H:i:s'))
                ->set('mobilization_end_date', $mobilizationEndDate->format('Y-m-d H:i:s'))
                ->where(['id' => $datum['id']])
                ->execute();
        }

        $events
            ->changeColumn('mobilization_start_date', 'datetime', [
                'null' => false,
            ])
            ->changeColumn('mobilization_end_date', 'datetime', [
                'null' => false,
            ])
            ->update();

        //
        // - Réservations.
        //

        $reservations = $this->table('reservations');
        $reservations
            ->addColumn('mobilization_start_date', 'datetime', [
                'null' => true,
                'after' => 'approver_id',
            ])
            ->addColumn('mobilization_end_date', 'datetime', [
                'null' => true,
                'after' => 'mobilization_start_date',
            ])
            ->renameColumn('start_date', 'operation_start_date')
            ->renameColumn('end_date', 'operation_end_date')
            ->renameColumn('is_full_days', 'operation_is_full_days')
            ->update();

        // - Enregistre les dates de mobilisation des réservations.
        $data = $this->fetchAll(sprintf('SELECT * FROM `%1$sreservations`', $prefix));
        foreach ($data as $datum) {
            $operationStartDate = CarbonImmutable::parse($datum['operation_start_date']);
            $operationEndDate = CarbonImmutable::parse($datum['operation_end_date']);

            $isDepartureInventoryDone = (bool) $datum['is_departure_inventory_done'];
            $isReturnInventoryDone = (bool) $datum['is_return_inventory_done'];

            $mobilizationStartDate = $operationStartDate;
            if ($isDepartureInventoryDone) {
                $departureInventoryDate = $datum['departure_inventory_datetime'] !== null
                    ? CarbonImmutable::parse($datum['departure_inventory_datetime'])->roundMinutes(15, 'ceil')
                    : null;

                if ($departureInventoryDate?->isBefore($operationStartDate)) {
                    $mobilizationStartDate = $departureInventoryDate;
                }
            }

            $mobilizationEndDate = $operationEndDate;
            if ($isReturnInventoryDone) {
                $returnInventoryDate = $datum['return_inventory_datetime'] !== null
                    ? CarbonImmutable::parse($datum['return_inventory_datetime'])->roundMinutes(15, 'ceil')
                    : null;

                if ($returnInventoryDate?->isBetween($operationStartDate, $operationEndDate)) {
                    $mobilizationEndDate = $returnInventoryDate;
                }
            }

            $qb = $this->getUpdateBuilder();
            $qb
                ->update(sprintf('%sreservations', $prefix))
                ->set('mobilization_start_date', $mobilizationStartDate->format('Y-m-d H:i:s'))
                ->set('mobilization_end_date', $mobilizationEndDate->format('Y-m-d H:i:s'))
                ->where(['id' => $datum['id']])
                ->execute();
        }

        $reservations
            ->changeColumn('mobilization_start_date', 'datetime', [
                'null' => false,
            ])
            ->changeColumn('mobilization_end_date', 'datetime', [
                'null' => false,
            ])
            ->update();
    }

    public function down(): void
    {
        $events = $this->table('events');
        $events
            ->removeColumn('mobilization_start_date')
            ->removeColumn('mobilization_end_date')
            ->renameColumn('operation_start_date', 'start_date')
            ->renameColumn('operation_end_date', 'end_date')
            ->renameColumn('operation_is_full_days', 'is_full_days')
            ->update();

        $reservations = $this->table('reservations');
        $reservations
            ->removeColumn('mobilization_start_date')
            ->removeColumn('mobilization_end_date')
            ->renameColumn('operation_start_date', 'start_date')
            ->renameColumn('operation_end_date', 'end_date')
            ->renameColumn('operation_is_full_days', 'is_full_days')
            ->update();
    }
}
