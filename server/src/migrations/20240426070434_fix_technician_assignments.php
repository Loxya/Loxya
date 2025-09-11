<?php
declare(strict_types=1);

use Loxya\Config\Config;
use Phinx\Migration\AbstractMigration;

final class FixTechnicianAssignments extends AbstractMigration
{
    public function up(): void
    {
        $prefix = Config::get('db.prefix');

        $qb = $this->getDeleteBuilder();
        $qb
            ->delete(sprintf('%sevent_technicians', $prefix))
            ->where(['start_date' => $qb->identifier('end_date')])
            ->execute();
    }

    public function down(): void
    {
        // - Pas de rollback pour ce fix.
    }
}
