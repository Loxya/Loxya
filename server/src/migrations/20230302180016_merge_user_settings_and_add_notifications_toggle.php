<?php
declare(strict_types=1);

use Loxya\Config\Config;
use Phinx\Migration\AbstractMigration;

final class MergeUserSettingsAndAddNotificationsToggle extends AbstractMigration
{
    public function up(): void
    {
        $users = $this->table('users');
        $users
            ->addColumn('language', 'char', [
                'after' => 'cas_identifier',
                'limit' => 2,
                'default' => 'en',
                'null' => false,
            ])
            ->addColumn('notifications_enabled', 'boolean', [
                'after' => 'language',
                'default' => true,
                'null' => false,
            ])
            ->update();

        $prefix = Config::get('db.prefix');
        $defaultLanguage = Config::get('defaultLang');
        $users = $this->fetchAll(sprintf('SELECT * FROM `%susers`', $prefix));

        foreach (array_column($users, 'id') as $userId) {
            $qb = $this->getSelectBuilder();
            $userSettings = $qb
                ->select(['language'])
                ->from(sprintf('%suser_settings', $prefix))
                ->where(['user_id' => $userId])
                ->execute()->fetch('assoc');

            $language = !empty($userSettings) ? $userSettings['language'] : $defaultLanguage;

            $qb = $this->getUpdateBuilder();
            $qb
                ->update(sprintf('%susers', $prefix))
                ->set(['language' => strtolower($language)])
                ->where(['id' => $userId])
                ->execute();
        }

        $this->table('user_settings')->drop()->save();
    }

    public function down(): void
    {
        $userSettings = $this->table('user_settings', ['signed' => true]);
        $userSettings
            ->addColumn('user_id', 'integer', ['signed' => true, 'null' => false])
            ->addColumn('language', 'char', [
                'limit' => 2,
                'default' => 'EN',
                'null' => false,
            ])
            ->addColumn('auth_token_validity_duration', 'integer', [
                'default' => 12,
                'null' => false,
            ])
            ->addColumn('created_at', 'datetime', ['null' => true])
            ->addColumn('updated_at', 'datetime', ['null' => true])
            ->addIndex(['user_id'], ['unique' => true])
            ->addForeignKey('user_id', 'users', 'id', [
                'delete' => 'CASCADE',
                'update' => 'NO_ACTION',
                'constraint' => 'fk_user_settings_users',
            ])
            ->create();

        $prefix = Config::get('db.prefix');
        $defaultLanguage = Config::get('defaultLang');
        $now = date('Y-m-d H:i:s');
        $users = $this->fetchAll(sprintf('SELECT * FROM `%susers`', $prefix));

        foreach ($users as $user) {
            $language = $user['language'] ?? $defaultLanguage;
            $userSettings->insert([
                'user_id' => $user['id'],
                'language' => $language,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
        $userSettings->saveData();

        $users = $this->table('users');
        $users
            ->removeColumn('language')
            ->removeColumn('notifications_enabled')
            ->update();
    }
}
