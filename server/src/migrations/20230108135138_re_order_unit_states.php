<?php
declare(strict_types=1);

use Loxya\Config\Config;
use Phinx\Migration\AbstractMigration;

final class ReOrderUnitStates extends AbstractMigration
{
    public function up(): void
    {
        $states = [
            'brand-new' => 1,
            'excellent' => 2,
            'state-of-use' => 3,
            'bad' => 4,
            'outdated' => 5,
        ];

        $prefix = Config::get('db.prefix');
        foreach ($states as $id => $order) {
            $qb = $this->getUpdateBuilder();
            $qb
                ->update(sprintf('%smaterial_unit_states', $prefix))
                ->set('order', $order)
                ->where(['id' => $id])
                ->execute();
        }
    }

    public function down(): void
    {
        $states = [
            'state-of-use' => 1,
            'excellent' => 2,
            'brand-new' => 3,
            'bad' => 4,
            'outdated' => 5,
        ];

        $prefix = Config::get('db.prefix');
        foreach ($states as $id => $order) {
            $qb = $this->getUpdateBuilder();
            $qb
                ->update(sprintf('%smaterial_unit_states', $prefix))
                ->set('order', $order)
                ->where(['id' => $id])
                ->execute();
        }
    }
}
