<?php
declare(strict_types=1);

use Loxya\Config\Config;
use Phinx\Migration\AbstractMigration;

final class AddSupervisorGroupAndRenameManagementOperation extends AbstractMigration
{
    public function up(): void
    {
        $prefix = Config::get('db.prefix');

        $users = $this->table('users');
        $users
            ->changeColumn('group', 'enum', [
                'values' => [
                    'external',
                    'readonly-planning-self',
                    'readonly-planning-general',
                    'management',
                    'operation',
                    'supervision',
                    'administration',
                ],
                'null' => false,
            ])
            ->save();

        $this->execute(sprintf(
            "UPDATE `%susers` SET `group` = '%s' WHERE `group` = '%s'",
            $prefix,
            'operation',
            'management',
        ));

        $users
            ->changeColumn('group', 'enum', [
                'values' => [
                    'external',
                    'readonly-planning-self',
                    'readonly-planning-general',
                    'operation',
                    'supervision',
                    'administration',
                ],
                'null' => false,
            ])
            ->save();
    }

    public function down(): void
    {
        $prefix = Config::get('db.prefix');

        $users = $this->table('users');
        $users
            ->changeColumn('group', 'enum', [
                'values' => [
                    'external',
                    'readonly-planning-self',
                    'readonly-planning-general',
                    'management',
                    'operation',
                    'supervision',
                    'administration',
                ],
                'null' => false,
            ])
            ->save();

        $this->execute(sprintf(
            "UPDATE `%susers` SET `group` = '%s' WHERE `group` IN ('%s', '%s')",
            $prefix,
            'management',
            'supervision',
            'operation',
        ));

        $users = $this->table('users');
        $users
            ->changeColumn('group', 'enum', [
                'values' => [
                    'external',
                    'readonly-planning-self',
                    'readonly-planning-general',
                    'management',
                    'administration',
                ],
                'null' => false,
            ])
            ->save();
    }
}
