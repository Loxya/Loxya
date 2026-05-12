<?php
declare(strict_types=1);

use Phinx\Migration\AbstractMigration;

final class AddBarcodes extends AbstractMigration
{
    public function up(): void
    {
        $barcodes = $this->table('barcodes', ['id' => false, 'primary_key' => 'id']);
        $barcodes
            ->addColumn('id', 'string', [
                'null' => false,
                'length' => 25,
            ])
            ->addColumn('entity_type', 'enum', [
                'values' => ['material'],
                'null' => false,
            ])
            ->addColumn('entity_id', 'integer', [
                'signed' => true,
                'null' => false,
            ])
            ->addIndex(['entity_type', 'entity_id'], ['unique' => true])
            ->create();
    }

    public function down(): void
    {
        $this->table('barcodes')->drop()->save();
    }
}
