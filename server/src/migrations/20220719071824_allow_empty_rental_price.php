<?php
declare(strict_types=1);

use Loxya\Config\Config;
use Phinx\Migration\AbstractMigration;

final class AllowEmptyRentalPrice extends AbstractMigration
{
    public function up(): void
    {
        $table = $this->table('materials');
        $table
            ->changeColumn('rental_price', 'decimal', [
                'precision' => 8,
                'scale' => 2,
                'null' => true,
                'default' => null,
            ])
            ->save();
    }

    public function down(): void
    {
        $prefix = Config::get('db.prefix');

        $qb = $this->getUpdateBuilder();
        $qb
            ->update(sprintf('%smaterials', $prefix))
            ->set('rental_price', 0.0)
            ->where(['rental_price IS' => null])
            ->execute();

        $table = $this->table('materials');
        $table
            ->changeColumn('rental_price', 'decimal', [
                'precision' => 8,
                'scale' => 2,
                'null' => false,
            ])
            ->save();
    }
}
