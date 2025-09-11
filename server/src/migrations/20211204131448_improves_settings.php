<?php
declare(strict_types=1);

use Loxya\Config\Config;
use Phinx\Migration\AbstractMigration;

final class ImprovesSettings extends AbstractMigration
{
    private const MIGRATION_MAP = [
        'event_summary_custom_text_title' => 'eventSummary.customText.title',
        'event_summary_custom_text' => 'eventSummary.customText.content',
        'event_summary_material_display_mode' => 'eventSummary.materialDisplayMode',
    ];

    public function up(): void
    {
        $prefix = Config::get('db.prefix');

        foreach (static::MIGRATION_MAP as $from => $to) {
            $qb = $this->getUpdateBuilder();
            $qb
                ->update(sprintf('%ssettings', $prefix))
                ->set('key', $to)
                ->where(['key' => $from])
                ->execute();
        }
    }

    public function down(): void
    {
        $prefix = Config::get('db.prefix');

        foreach (array_flip(static::MIGRATION_MAP) as $from => $to) {
            $qb = $this->getUpdateBuilder();
            $qb
                ->update(sprintf('%ssettings', $prefix))
                ->set('key', $to)
                ->where(['key' => $from])
                ->execute();
        }
    }
}
