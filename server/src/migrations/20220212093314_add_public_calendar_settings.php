<?php
declare(strict_types=1);

use Loxya\Config\Config;
use Loxya\Support\Str;
use Phinx\Migration\AbstractMigration;

final class AddPublicCalendarSettings extends AbstractMigration
{
    public function up(): void
    {
        $data = [
            [
                'key' => 'calendar.public.enabled',
                'value' => '0',
            ],
            [
                'key' => 'calendar.public.uuid',
                'value' => (string) Str::uuid(),
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
                    'calendar.public.enabled',
                    'calendar.public.uuid',
                ])
            ))
            ->execute();
    }
}
