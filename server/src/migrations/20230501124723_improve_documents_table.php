<?php
declare(strict_types=1);

use Loxya\Config\Config;
use Phinx\Migration\AbstractMigration;

final class ImproveDocumentsTable extends AbstractMigration
{
    public function up(): void
    {
        // - Oubli dans une précédente migration.
        $materials = $this->table('materials');
        $materials
            ->changeColumn('picture', 'string', [
                'length' => 227,
                'null' => true,
            ])
            ->update();

        //
        // - Documents
        //

        $documents = $this->table('documents');
        $documents
            ->dropForeignKey('material_id')
            ->removeIndex(['material_id'])
            ->removeIndex(['material_id', 'name'])
            ->update();

        $documents
            ->renameColumn('material_id', 'entity_id')
            ->addColumn('entity_type', 'enum', [
                'values' => ['material', 'event', 'reservation', 'technician'],
                'after' => 'id',
                'default' => 'material',
                'null' => false,
            ])
            ->addColumn('file', 'string', [
                'length' => 227,
                'null' => true,
                'after' => 'size',
            ])
            ->addColumn('author_id', 'integer', [
                'signed' => true,
                'null' => true,
                'after' => 'file',
            ])
            ->removeColumn('updated_at')
            ->removeColumn('deleted_at')
            ->addIndex(['entity_type', 'entity_id'])
            ->addIndex(['author_id'])
            ->addForeignKey('author_id', 'users', 'id', [
                'delete' => 'SET_NULL',
                'update' => 'NO_ACTION',
                'constraint' => 'fk__document__author',
            ])
            ->update();

        $prefix = Config::get('db.prefix');
        $documentsData = $this->fetchAll(sprintf('SELECT `id`, `name` FROM `%sdocuments`', $prefix));
        foreach ($documentsData as $documentData) {
            $qb = $this->getUpdateBuilder();
            $qb
                ->update(sprintf('%sdocuments', $prefix))
                ->set(['file' => $documentData['name']])
                ->where(['id' => $documentData['id']])
                ->execute();
        }

        // - On enlève les `default` non désirés...
        //   (après a voir mis les colonnes existantes `null` avec la bonne valeur)
        $documents
            ->changeColumn('entity_type', 'enum', [
                'values' => ['material', 'event', 'reservation', 'technician'],
                'null' => false,
            ])
            ->changeColumn('file', 'string', [
                'length' => 227,
                'null' => false,
            ])
            ->update();
    }

    public function down(): void
    {
        $materials = $this->table('materials');
        $materials
            ->changeColumn('picture', 'string', [
                'length' => 191,
                'null' => true,
            ])
            ->update();

        //
        // - Documents
        //

        $prefix = Config::get('db.prefix');
        $incompatibleDocuments = $this->fetchAll(
            sprintf("SELECT * FROM `%sdocuments` WHERE `entity_type` <> 'material' OR `name` <> `file`", $prefix),
        );
        if (count($incompatibleDocuments) > 0) {
            throw new \RuntimeException(
                "Unable to rollback the migration, this would cause the " .
                "loss of all technicians / events documents or newly uploaded documents.",
            );
        }

        $prefix = Config::get('db.prefix');
        $documentsData = $this->fetchAll(sprintf('SELECT `id`, `name` FROM `%sdocuments`', $prefix));
        foreach ($documentsData as $documentData) {
            $qb = $this->getUpdateBuilder();
            $qb
                ->update(sprintf('%sdocuments', $prefix))
                ->set(['file' => $documentData['name']])
                ->where(['id' => $documentData['id']])
                ->execute();
        }

        $documents = $this->table('documents');
        $documents
            ->dropForeignKey('author_id')
            ->removeIndex(['entity_type', 'entity_id'])
            ->removeIndex(['author_id'])
            ->update();

        $documents
            ->removeColumn('entity_type')
            ->removeColumn('author_id')
            ->removeColumn('file')
            ->renameColumn('entity_id', 'material_id')
            ->addColumn('updated_at', 'datetime', ['null' => true, 'after' => 'created_at'])
            ->addColumn('deleted_at', 'datetime', ['null' => true, 'after' => 'updated_at'])
            ->addIndex(['material_id'])
            ->addForeignKey('material_id', 'materials', 'id', [
                'delete' => 'CASCADE',
                'update' => 'NO_ACTION',
                'constraint' => 'fk_documents_materials',
            ])
            ->addIndex(['material_id', 'name'], [
                'unique' => true,
                'name' => 'material_name_UNIQUE',
            ])
            ->update();
    }
}
