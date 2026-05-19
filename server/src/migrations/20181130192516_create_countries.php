<?php
declare(strict_types=1);

use Phinx\Migration\AbstractMigration;

final class CreateCountries extends AbstractMigration
{
    public function up(): void
    {
        $countries = $this->table('countries', ['signed' => true]);
        $countries
            ->addColumn('name', 'string', ['length' => 96, 'null' => false])
            ->addColumn('code', 'string', ['length' => 4, 'null' => false])
            ->addColumn('created_at', 'datetime', ['null' => true])
            ->addColumn('updated_at', 'datetime', ['null' => true])
            ->addColumn('deleted_at', 'datetime', ['null' => true])
            ->addIndex(['name'], [
                'unique' => true,
                'name' => 'name_UNIQUE',
            ])
            ->addIndex(['code'], [
                'unique' => true,
                'name' => 'code_UNIQUE',
            ])
            ->create();

        //
        // - Données
        //

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
    }

    public function down(): void
    {
        $this->table('countries')->drop()->save();
    }
}
