<?php
declare(strict_types=1);

use Loxya\Config\Config;
use Phinx\Migration\AbstractMigration;

final class NormalizePolymorphTypes extends AbstractMigration
{
    public function up(): void
    {
        $prefix = Config::get('db.prefix');

        $qb = $this->getUpdateBuilder();
        $qb
            ->update(sprintf('%staggables', $prefix))
            ->set(['taggable_type' => 'material'])
            ->where(['taggable_type' => 'Robert2\\API\\Models\\Material'])
            ->execute();
    }

    public function down(): void
    {
        $prefix = Config::get('db.prefix');

        $qb = $this->getUpdateBuilder();
        $qb
            ->update(sprintf('%staggables', $prefix))
            ->set(['taggable_type' => 'Robert2\\API\\Models\\Material'])
            ->where(['taggable_type' => 'material'])
            ->execute();
    }
}
