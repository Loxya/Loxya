<?php
declare(strict_types=1);

use Loxya\Config\Config;
use Phinx\Migration\AbstractMigration;

final class CreatePendingUsers extends AbstractMigration
{
    public function up(): void
    {
        //
        // - Utilisateurs temporaires.
        //

        $pending_users = $this->table('pending_users', ['id' => false, 'signed' => true]);
        $pending_users
            ->addColumn('id', 'string', ['length' => 36, 'null' => false]) // - UUID.
            ->addColumn('type', 'enum', [
                'values' => ['company', 'individual'],
                'null' => false,
            ])
            ->addColumn('first_name', 'string', ['length' => 35, 'null' => false])
            ->addColumn('last_name', 'string', ['length' => 35, 'null' => false])
            ->addColumn('company_legal_name', 'string', ['length' => 191, 'null' => true])
            ->addColumn('company_registration_id', 'string', ['length' => 50, 'null' => true])
            ->addColumn('email', 'string', ['length' => 191, 'null' => false])
            ->addColumn('password', 'string', ['length' => 191, 'null' => false])
            ->addColumn('street', 'string', ['length' => 191, 'null' => true])
            ->addColumn('postal_code', 'string', ['length' => 10, 'null' => true])
            ->addColumn('locality', 'string', ['length' => 191, 'null' => true])
            ->addColumn('country_id', 'integer', ['signed' => true, 'null' => true])
            ->addColumn('is_verified', 'boolean', ['null' => false, 'default' => false])
            ->addColumn('created_at', 'datetime', [
                'null' => false,
                'update' => '',
                'default' => 'CURRENT_TIMESTAMP',
            ])
            ->addColumn('updated_at', 'datetime', ['null' => true])
            ->create();

        //
        // - Ajout de l'identifiant d'entreprise (SIRET, ...) dans la table des sociétés.
        //

        $companies = $this->table('companies');
        $companies
            ->addColumn('registration_id', 'string', [
                'length' => 50,
                'null' => true,
                'after' => 'legal_name',
            ])
            ->removeIndex(['legal_name'])
            ->update();
    }

    public function down(): void
    {
        $prefix = Config::get('db.prefix');

        $hasDuplicatedCompanyName = !empty($this->fetchAll(vsprintf(
            'SELECT COUNT(*) AS `count` FROM `%1$scompanies` GROUP BY `legal_name` HAVING COUNT(*) > 1',
            [$prefix],
        )));
        if ($hasDuplicatedCompanyName) {
            throw new \RuntimeException(
                "Unable to rollback the migration, some " .
                "companies have the same name.",
            );
        }

        $this->table('pending_users')->drop()->save();

        $companies = $this->table('companies');
        $companies
            ->addIndex(['legal_name'], [
                'unique' => true,
                'name' => 'legal_name_UNIQUE',
            ])
            ->removeColumn('registration_id')
            ->update();
    }
}
