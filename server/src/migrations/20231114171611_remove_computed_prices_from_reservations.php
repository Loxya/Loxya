<?php
declare(strict_types=1);

use Brick\Math\BigDecimal as Decimal;
use Brick\Math\RoundingMode;
use Loxya\Config\Config;
use Phinx\Migration\AbstractMigration;

final class RemoveComputedPricesFromReservations extends AbstractMigration
{
    public function up(): void
    {
        $reservationMaterials = $this->table('reservation_materials');
        $reservationMaterials
            ->removeColumn('total_price')
            ->update();

        $reservations = $this->table('reservations');
        $reservations
            ->removeColumn('daily_total_without_taxes')
            ->removeColumn('daily_total_taxes')
            ->removeColumn('daily_total_with_taxes')
            ->removeColumn('total_without_taxes')
            ->removeColumn('total_taxes')
            ->removeColumn('total_with_taxes')
            ->update();
    }

    public function down(): void
    {
        $reservations = $this->table('reservations');
        $reservations
            ->addColumn('daily_total_without_taxes', 'decimal', [
                'precision' => 8,
                'scale' => 2,
                'null' => true,
                'after' => 'vat_rate',
            ])
            ->addColumn('daily_total_taxes', 'decimal', [
                'precision' => 8,
                'scale' => 2,
                'null' => true,
                'after' => 'daily_total_without_taxes',
            ])
            ->addColumn('daily_total_with_taxes', 'decimal', [
                'precision' => 8,
                'scale' => 2,
                'null' => true,
                'after' => 'daily_total_taxes',
            ])
            ->addColumn('total_without_taxes', 'decimal', [
                'precision' => 8,
                'scale' => 2,
                'null' => true,
                'after' => 'daily_total_with_taxes',
            ])
            ->addColumn('total_taxes', 'decimal', [
                'precision' => 8,
                'scale' => 2,
                'null' => true,
                'after' => 'total_without_taxes',
            ])
            ->addColumn('total_with_taxes', 'decimal', [
                'precision' => 8,
                'scale' => 2,
                'null' => true,
                'after' => 'total_taxes',
            ])
            ->update();

        $reservationMaterials = $this->table('reservation_materials');
        $reservationMaterials
            ->addColumn('total_price', 'decimal', [
                'precision' => 8,
                'scale' => 2,
                'null' => true,
                'after' => 'unit_price',
            ])
            ->update();

        $prefix = Config::get('db.prefix');
        $reservationMaterials = $this->fetchAll(sprintf('SELECT * FROM `%sreservation_materials`', $prefix));
        foreach ($reservationMaterials as $reservationMaterial) {
            $totalPrice = $reservationMaterial['unit_price'] === null
                ? null
                : $reservationMaterial['unit_price'] * $reservationMaterial['quantity'];

            $qb = $this->getUpdateBuilder();
            $qb
                ->update(sprintf('%sreservation_materials', $prefix))
                ->set(['total_price' => $totalPrice])
                ->where(['id' => $reservationMaterial['id']])
                ->execute();
        }

        $reservations = $this->fetchAll(sprintf('SELECT * FROM `%sreservations`', $prefix));
        foreach ($reservations as $reservation) {
            if (!$reservation['is_billable']) {
                continue;
            }

            $materials = $this->fetchAll(vsprintf(
                'SELECT * FROM `%sreservation_materials` WHERE `reservation_id` = %d',
                [$prefix, $reservation['id']],
            ));

            $dailyTotalWithoutTaxes = array_reduce(
                $materials,
                static fn ($acc, $material) => $acc->plus(Decimal::of($material['total_price'])),
                Decimal::zero(),
            )->toScale(2, RoundingMode::UNNECESSARY);

            $dailyTotalTaxes = $dailyTotalWithoutTaxes
                ->multipliedBy(Decimal::of($reservation['vat_rate']))
                ->toScale(2, RoundingMode::HALF_UP);

            $dailyTotalWithTaxes = $dailyTotalWithoutTaxes
                ->plus($dailyTotalTaxes)
                ->toScale(2, RoundingMode::UNNECESSARY);

            $totalWithoutTaxes = $dailyTotalWithoutTaxes
                ->multipliedBy(Decimal::of($reservation['degressive_rate']))
                ->toScale(2, RoundingMode::HALF_UP);

            $totalTaxes = $totalWithoutTaxes
                ->multipliedBy(Decimal::of($reservation['vat_rate']))
                ->toScale(2, RoundingMode::HALF_UP);

            $totalWithTaxes = $totalWithoutTaxes
                ->plus($totalTaxes)
                ->toScale(2, RoundingMode::UNNECESSARY);

            $qb = $this->getUpdateBuilder();
            $qb
                ->update(sprintf('%sreservations', $prefix))
                ->set([
                    'daily_total_without_taxes' => (string) $dailyTotalWithoutTaxes,
                    'daily_total_taxes' => (string) $dailyTotalTaxes,
                    'daily_total_with_taxes' => (string) $dailyTotalWithTaxes,
                    'total_without_taxes' => (string) $totalWithoutTaxes,
                    'total_taxes' => (string) $totalTaxes,
                    'total_with_taxes' => (string) $totalWithTaxes,
                ])
                ->where(['id' => $reservation['id']])
                ->execute();
        }
    }
}
