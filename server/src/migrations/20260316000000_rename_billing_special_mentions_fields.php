<?php
declare(strict_types=1);

use Loxya\Config\Config;
use Phinx\Migration\AbstractMigration;

final class RenameBillingSpecialMentionsFields extends AbstractMigration
{
    public function up(): void
    {
        $prefix = Config::get('db.prefix');

        foreach (['estimates', 'invoices'] as $type) {
            $titleKey = sprintf('%s.customText.title', $type);
            $contentKey = sprintf('%s.customText.content', $type);

            $rows = $this->getSelectBuilder()
                ->select(['key', 'value'])
                ->from(sprintf('%ssettings', $prefix))
                ->whereInList('key', [$titleKey, $contentKey])
                ->execute()->fetchAll('assoc');

            $values = [];
            foreach ($rows as $row) {
                $values[$row['key']] = $row['value'];
            }

            $mention = implode("\n\n", array_filter([
                $values[$titleKey] ?? null,
                $values[$contentKey] ?? null,
            ]));

            // - Suppression des anciennes clés.
            $this->getDeleteBuilder()
                ->delete(sprintf('%ssettings', $prefix))
                ->whereInList('key', [$titleKey, $contentKey])
                ->execute();

            // - Insertion de la nouvelle.
            $this
                ->table('settings')
                ->insert([[
                    'key' => sprintf('%s.specialMentions', $type),
                    'value' => !empty($mention) ? $mention : null,
                ]])
                ->saveData();
        }
    }

    public function down(): void
    {
        $prefix = Config::get('db.prefix');

        foreach (['estimates', 'invoices'] as $type) {
            $key = sprintf('%s.specialMentions', $type);

            $rawContent = $this->getSelectBuilder()
                ->select(['value'])
                ->from(sprintf('%ssettings', $prefix))
                ->where(['key' => $key])
                ->execute()->fetch('assoc');

            // - Suppression de l'ancienne clé.
            $this->getDeleteBuilder()
                ->delete(sprintf('%ssettings', $prefix))
                ->where(['key' => $key])
                ->execute();

            // - Réinsertion sous l'ancien format.
            $this
                ->table('settings')
                ->insert([
                    [
                        'key' => sprintf('%s.customText.title', $type),
                        'value' => null,
                    ],
                    [
                        'key' => sprintf('%s.customText.content', $type),
                        'value' => (
                            !empty($rawContent['value'])
                                ? $rawContent['value']
                                : null
                        ),
                    ],
                ])
                ->saveData();
        }
    }
}
