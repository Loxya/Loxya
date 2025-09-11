<?php
declare(strict_types=1);

use Loxya\Config\Config;
use Phinx\Migration\AbstractMigration;

final class RemovesTagsFromCompanies extends AbstractMigration
{
    public function up(): void
    {
        $prefix = Config::get('db.prefix');

        $qb = $this->getDeleteBuilder();
        $qb
            ->delete(sprintf('%staggables', $prefix))
            ->where(['taggable_type' => 'Loxya\Models\Company'])
            ->execute();
    }

    public function down(): void
    {
        $prefix = Config::get('db.prefix');
        $defaultTags = Config::get('legacy.defaultTags', []);

        // - Récupère toutes les sociétés déjà en base.
        $qb = $this->getSelectBuilder();
        $companies = $qb
            ->select(['id'])
            ->from(sprintf('%scompanies', $prefix))
            ->execute()->fetchAll('assoc');

        if (empty($companies)) {
            return;
        }

        // - Id du tag "Bénéficiaire".
        $qb = $this->getSelectBuilder();
        $beneficiaryTag = $qb
            ->select(['id'])
            ->from(sprintf('%stags', $prefix))
            ->where(['name' => $defaultTags['beneficiary'] ?? 'Bénéficiaire'])
            ->execute()->fetch('assoc');

        if (!$beneficiaryTag) {
            return;
        }

        $qb = $this->getInsertBuilder();
        $qb
            ->insert(['tag_id', 'taggable_type', 'taggable_id'])
            ->into(sprintf('%staggables', $prefix));

        foreach ($companies as $company) {
            $qb->values([
                'tag_id' => $beneficiaryTag['id'],
                'taggable_type' => 'Loxya\Models\Company',
                'taggable_id' => $company['id'],
            ]);
        }

        $qb->execute();
    }
}
