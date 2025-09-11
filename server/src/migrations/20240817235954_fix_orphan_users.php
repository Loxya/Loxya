<?php
declare(strict_types=1);

use Loxya\Config\Config;
use Phinx\Migration\AbstractMigration;

final class FixOrphanUsers extends AbstractMigration
{
    public function up(): void
    {
        $prefix = Config::get('db.prefix');

        $data = $this->fetchAll(sprintf(
            'SELECT id
             FROM `%1$susers`
             WHERE id NOT IN (
                SELECT user_id
                FROM `%1$spersons`
                WHERE user_id IS NOT NULL
            )',
            $prefix,
        ));
        foreach ($data as $datum) {
            $qb = $this->getInsertBuilder();
            $qb
                ->insert(['user_id', 'first_name', 'last_name'])
                ->into(sprintf('%spersons', $prefix))
                ->values([
                    'user_id' => $datum['id'],
                    'first_name' => '?',
                    'last_name' => '?',
                ])
                ->execute();
        }
    }

    public function down(): void
    {
        // - Pas de rollback.
    }
}
