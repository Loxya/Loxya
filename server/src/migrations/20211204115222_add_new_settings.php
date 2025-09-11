<?php
declare(strict_types=1);

use Loxya\Config\Config;
use Phinx\Migration\AbstractMigration;

final class AddNewSettings extends AbstractMigration
{
    public function up(): void
    {
        $data = [
            [
                'key' => 'calendar.event.showLocation',
                'value' => '1',
            ],
            [
                'key' => 'calendar.event.showBorrower',
                'value' => '0',
            ],
        ];
        $this->table('settings')->insert($data)->save();
    }

    public function down(): void
    {
        $prefix = Config::get('db.prefix');

        $qb = $this->getDeleteBuilder();
        $qb
            ->delete(sprintf('%ssettings', $prefix))
            ->where(static fn ($exp) => (
                $exp->in('key', [
                    'calendar.event.showBorrower',
                    'calendar.event.showLocation',
                ])
            ))
            ->execute();
    }
}
