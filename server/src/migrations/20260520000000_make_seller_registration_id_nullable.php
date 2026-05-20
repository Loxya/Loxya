<?php
declare(strict_types=1);

use Loxya\Config\Config;
use Phinx\Migration\AbstractMigration;

final class MakeSellerRegistrationIdNullable extends AbstractMigration
{
    public function up(): void
    {
        foreach (['estimates', 'invoices'] as $tableName) {
            $this->table($tableName)
                ->changeColumn('seller_registration_id', 'string', [
                    'length' => 50,
                    'null' => true,
                    'default' => null,
                ])
                ->update();
        }
    }

    public function down(): void
    {
        $prefix = Config::get('db.prefix');

        foreach (['estimates', 'invoices'] as $tableName) {
            $hasNullRegistrationId = count($this->fetchAll(sprintf(
                'SELECT `id` FROM `%s%s` WHERE `seller_registration_id` IS NULL LIMIT 1',
                $prefix,
                $tableName,
            ))) > 0;
            if ($hasNullRegistrationId) {
                throw new \RuntimeException((
                    "Unable to rollback the migration: Some billing entries have an empty " .
                    "seller registration id. Please fill them before rolling back."
                ));
            }
        }

        foreach (['estimates', 'invoices'] as $tableName) {
            $this->table($tableName)
                ->changeColumn('seller_registration_id', 'string', [
                    'length' => 50,
                    'null' => false,
                ])
                ->update();
        }
    }
}
