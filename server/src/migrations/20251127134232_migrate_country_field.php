<?php
declare(strict_types=1);

use Loxya\Config\Config;
use Phinx\Migration\AbstractMigration;

final class MigrateCountryField extends AbstractMigration
{
    private const TABLES = ['companies', 'parks', 'pending_users', 'persons'];

    public function up(): void
    {
        $prefix = Config::get('db.prefix');

        //
        // - Migration des tables
        //

        $qb = $this->getSelectBuilder();
        $countriesMap = array_column(
            $qb
                ->select(['id', 'code'])
                ->from(sprintf('%scountries', $prefix))
                ->execute()->fetchAll('assoc'),
            'code',
            'id',
        );

        foreach (self::TABLES as $tableName) {
            $table = $this->table($tableName);
            $table
                ->addColumn('country', 'char', [
                    'length' => 2,
                    'null' => true,
                    'after' => 'country_id',
                ])
                ->dropForeignKey('country_id')
                ->update();

            $data = $this->fetchAll(sprintf(
                'SELECT `id`, `country_id` FROM `%s` WHERE `country_id` IS NOT NULL',
                $prefix . $tableName,
            ));
            foreach ($data as $datum) {
                $countryCode = $countriesMap[$datum['country_id']];

                $qb = $this->getUpdateBuilder();
                $qb
                    ->update($prefix . $tableName)
                    ->set(['country' => $countryCode])
                    ->where(['id' => $datum['id']])
                    ->execute();
            }

            if ($tableName !== 'pending_users') {
                $table->changeColumn('country', 'char', [
                    'length' => 2,
                    'null' => false,
                ]);
            }

            $table
                ->removeColumn('country_id')
                ->update();
        }

        //
        // - Pays
        //

        $this->table('countries')->drop()->save();
    }

    public function down(): void
    {
        $prefix = Config::get('db.prefix');

        //
        // - Pays
        //

        $countries = $this->table('countries', ['signed' => true]);
        $countries
            ->addColumn('name', 'string', ['length' => 96, 'null' => false])
            ->addColumn('code', 'string', ['length' => 4, 'null' => false])
            ->addColumn('created_at', 'datetime', ['null' => true])
            ->addColumn('updated_at', 'datetime', ['null' => true])
            ->addIndex(['name'], [
                'unique' => true,
                'name' => 'name_UNIQUE',
            ])
            ->addIndex(['code'], [
                'unique' => true,
                'name' => 'code_UNIQUE',
            ])
            ->create();

        $now = date('Y-m-d H:i:s');
        $data = array_map(
            static fn ($country) => array_replace($country, [
                'name' => $country['name']['fr'],
                'created_at' => $now,
                'updated_at' => $now,
            ]),
            include __DIR__ . DS . 'data' . DS . 'countries.php',
        );
        $countries->insert($data)->save();

        //
        // - Migration des tables
        //

        $qb = $this->getSelectBuilder();
        $countriesMap = array_column(
            $qb
                ->select(['id', 'code'])
                ->from(sprintf('%scountries', $prefix))
                ->execute()->fetchAll('assoc'),
            'id',
            'code',
        );

        foreach (self::TABLES as $tableName) {
            $table = $this->table($tableName);
            $table
                ->addColumn('country_id', 'integer', [
                    'signed' => true,
                    'null' => true,
                    'after' => 'country',
                ])
                ->addForeignKey('country_id', 'countries', 'id', [
                    'delete' => 'RESTRICT',
                    'update' => 'NO_ACTION',
                    'constraint' => sprintf('fk__%s__country', $tableName),
                ])
                ->update();

            $data = $this->fetchAll(sprintf(
                'SELECT `id`, `country` FROM `%s` WHERE `country` IS NOT NULL',
                $prefix . $tableName,
            ));
            foreach ($data as $datum) {
                $countryId = $countriesMap[$datum['country']];

                $qb = $this->getUpdateBuilder();
                $qb
                    ->update($prefix . $tableName)
                    ->set(['country_id' => $countryId])
                    ->where(['id' => $datum['id']])
                    ->execute();
            }

            if ($tableName !== 'pending_users') {
                $table->changeColumn('country_id', 'integer', [
                    'signed' => true,
                    'null' => false,
                ]);
            }

            $table
                ->removeColumn('country')
                ->update();
        }
    }
}
